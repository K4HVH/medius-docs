"""Runs registered tests on boxes: selection, layouts, each box's settings, the runs themselves, and leaving
the bench as the next test needs it."""
import importlib.util
import os
import platform
import sys
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path

from . import TOOL_VERSION
from . import integrity
from .devices import LegUnavailable
from .runfile import RunFile

BOX_ORDER = ("stock", "medius", "native")


class StateMismatch(Exception):
    pass


class StockStillJammed(SystemExit):
    pass


@dataclass
class Selection:
    tests: list = field(default_factory=list)
    categories: list = field(default_factory=list)
    boxes: list = field(default_factory=list)
    layouts: list = field(default_factory=list)


@dataclass
class Context:
    """What a test's run(ctx) gets: the box under test, the legs it may take, and their devices."""
    box_name: str
    box: object
    legs: list
    run_index: int
    _present: object
    integrity: dict = field(default_factory=dict)

    def device(self, leg: str):
        """The device for `leg`, presented (or found) on first use; LegUnavailable if it can't be had."""
        return self._present(leg)

    def log(self, msg: str) -> None:
        print(f"[{self.box_name}] {msg}", file=sys.stderr, flush=True)


def _host() -> dict:
    try:
        import medius
        package = medius.version_string()
    except Exception:
        package = None
    return {"kernel": os.uname().release, "python": platform.python_version(), "medius_package": package}


class Engine:
    def __init__(self, entry, bench, devices, boxes, suite, out_dir):
        if entry not in ("sim", "no-sim"):
            raise ValueError(f"entry {entry!r}")
        self.entry = entry
        self.bench = bench
        self.devices = devices
        self.boxes = boxes
        self.suite = suite
        self.out_dir = Path(out_dir)

    def select(self, selection: Selection) -> list:
        unknown = [t for t in selection.tests if t not in self.suite]
        if unknown:
            raise ValueError(f"no test {', '.join(unknown)}; the tests are {', '.join(sorted(self.suite))}")
        tests = [t for t in self.suite.values()
                 if (not selection.tests or t.id in selection.tests)
                 and (not selection.categories or t.category in selection.categories)
                 and (not selection.layouts or t.layout in selection.layouts)]
        return sorted(tests, key=lambda t: t.id)

    def run(self, selection: Selection, runs: int = 3, resume: str | None = None) -> list:
        stamp = resume or datetime.now().strftime("%Y%m%d-%H%M%S")
        tests = self.select(selection)
        if not tests:
            raise ValueError("no test matches that choice of tests, categories and layout")
        boxes = [b for b in BOX_ORDER
                 if (not selection.boxes or b in selection.boxes) and any(b in t.boxes for t in tests)
                 and (b == "native" or b in self.boxes)]
        files = {b: self._file(b, stamp, resume) for b in boxes}
        here = self.bench.layout_now()
        layouts = sorted({t.layout for t in tests}, key=lambda lay: lay != here)
        for layout in layouts:
            group = [t for t in tests if t.layout == layout]
            if self.bench.layout_now() != layout:
                self.bench.move_to(layout)
                self.bench.wait_for(layout)
            for b in boxes:
                for t in group:
                    if b in t.boxes:
                        self._run_test(t, b, files[b], runs, stamp)
        for rf in files.values():
            rf.close()
        return [rf.path for rf in files.values()]

    def _file(self, box, stamp, resume):
        path = self.out_dir / box / f"{stamp}.json"
        if resume and path.exists():
            return RunFile.open(path)
        firmware = self.boxes[box].firmware() if box in self.boxes else {}
        return RunFile.create(path, box=box, entry=self.entry, tool_version=TOOL_VERSION, host=_host(),
                              firmware=firmware, sims=self.bench.sims())

    def _legs(self, t):
        legs, skipped = [], {}
        for leg in t.legs:
            if leg.needs_sim and self.entry == "no-sim":
                skipped[leg.id] = f"needs the sim ({leg.device})"
            else:
                legs.append(leg)
        return legs, skipped

    def _apply_state(self, box, wanted: dict) -> dict:
        if not wanted:
            return {}
        box.apply(wanted)
        got = box.settings()
        wrong = [f"{k} was {got.get(k)!r}, wanted {v!r}" for k, v in wanted.items() if got.get(k) != v]
        if wrong:
            raise StateMismatch("state readback: " + ", ".join(wrong))
        return {k: got.get(k) for k in wanted}

    def _module(self, t):
        spec = importlib.util.spec_from_file_location(f"suite_{t.id.replace('-', '_')}", t.path / "test.py")
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        return module

    def _run_test(self, t, box_name, rf, runs, stamp):
        entry = rf.data["tests"].get(t.id)
        done = rf.runs_done(t.id) if entry and entry.get("version") == t.version else 0
        if done >= runs:
            return
        legs, skipped = self._legs(t)
        if not legs:
            rf.skip(t.id, t.version, "; ".join(skipped.values()) or "no legs")
            return
        box = self.boxes.get(box_name)
        try:
            try:
                state = self._apply_state(box, t.state.get(box_name, {}))
            except StateMismatch as e:
                rf.begin_test(t.id, t.version, t.layout, [leg.id for leg in legs], [], {}, skipped)
                rf.fail(t.id, str(e))
                return
            rf.begin_test(t.id, t.version, t.layout, [leg.id for leg in legs], [], state, skipped)
            module = self._module(t)
            by_id = {leg.id: leg for leg in legs}
            presented = {}

            def present(leg_id):
                if leg_id not in by_id:
                    raise LegUnavailable(f"leg {leg_id} is not one this run takes")
                if leg_id not in presented:
                    presented[leg_id] = self.devices.present(by_id[leg_id], box_name)
                return presented[leg_id]

            for k in range(done, runs):
                ctx = Context(box_name=box_name, box=box, legs=[leg.id for leg in legs], run_index=k, _present=present)
                with integrity.collecting(ctx.integrity):
                    raw = module.run(ctx)
                rf.data["tests"][t.id]["devices"] = [p.record(leg) for leg, p in presented.items()]
                if any(ctx.integrity.values()):
                    rf.fail(t.id, "capture lost data: " + ", ".join(f"{k} {v}" for k, v in ctx.integrity.items() if v))
                    return
                rf.add_run(t.id, raw)
        except LegUnavailable as e:
            rf.fail(t.id, str(e))
        except Exception as e:
            rf.fail(t.id, f"{type(e).__name__}: {e}")
        finally:
            if box is not None and hasattr(box, "leave"):
                box.leave()
            self.devices.restore(box_name)
            if t.jams_stock and box_name == "stock":
                self._unjam(box, stamp)

    def _unjam(self, box, stamp):
        if not box.lagging():
            return
        self.bench.power_cycle("stock")
        if hasattr(box, "reopen"):
            box.reopen()
        if box.lagging():
            raise StockStillJammed(f"the stock box is still one reply behind after a power cycle; carry on with "
                                   f"--resume {stamp} once it answers in step")
