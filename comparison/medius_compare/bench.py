"""The bench the sim script runs on, from a local config: where each box and sim is plugged, what the person
moving cables calls each one, and which hub ports power the stock box.

A cabling is `main` (each sim behind its own box) or `native:<box>` (that box's sim behind it, the other sim's
device on the PC hub as the native reference). A sim's device carries no serial, so `locate` finds it: given
the sim's serial, the USB port its device enumerates on, or None.
"""
import glob
import os
import sys
import time
import tomllib
from dataclasses import dataclass
from pathlib import Path

from . import power

CONFIG = Path(".config/medius-compare/bench.toml")


def default_config():
    """The bench config in the user's home, or under sudo, in the home of the user who ran sudo."""
    mine = Path.home() / CONFIG
    if not mine.exists() and os.environ.get("SUDO_USER"):
        import pwd
        return Path(pwd.getpwnam(os.environ["SUDO_USER"]).pw_dir) / CONFIG
    return mine
BOXES = ("stock", "medius")
KEYS = {"": {"names", "box", "sim", "sim_library"}, "box": {"control", "clone", "power"}, "power": {"hub", "ports"},
        "sim": {"serial", "box", "native"}}


@dataclass
class Step:
    what: str
    frm: str
    to: str

    def text(self):
        return f"Move the {self.what} from {self.frm} to {self.to}."


@dataclass
class CableMove:
    target: str
    steps: list

    def text(self):
        return " ".join(s.text() for s in self.steps)


def _check(where, d, allowed):
    bad = sorted(set(d) - allowed)
    if bad:
        raise ValueError(f"bench config: {where} has no key {', '.join(bad)}; it takes {', '.join(sorted(allowed))}")


class Bench:
    def __init__(self, config: dict, locate=None, describe=None, by_id="/dev/serial/by-id"):
        _check("the file", config, KEYS[""])
        for name, box in config.get("box", {}).items():
            _check(f"box.{name}", box, KEYS["box"])
            if "power" in box:
                _check(f"box.{name}.power", box["power"], KEYS["power"])
        for name, sim in config.get("sim", {}).items():
            _check(f"sim.{name}", sim, KEYS["sim"])
        self.names = config.get("names", {})
        self.box = config.get("box", {})
        self.sim = config.get("sim", {})
        self.sim_library = config.get("sim_library")
        self._locate = locate
        self._describe = describe or (lambda serial: {})
        self.by_id = Path(by_id)

    @classmethod
    def load(cls, path=None, **kw):
        path = Path(path or default_config())
        if not path.exists():
            raise SystemExit(f"no bench config at {path}; copy bench.example.toml there and fill it in")
        with open(path, "rb") as f:
            return cls(tomllib.load(f), **kw)

    def _name(self, key):
        return self.names.get(key, key)

    def control_port(self, box):
        serial = self.box[box]["control"]
        found = sorted(glob.glob(str(self.by_id / f"*_{serial}-if*")))
        if not found:
            raise FileNotFoundError(f"the {self._name(box)}'s control port ({serial}) is not plugged in")
        return found[0]

    def sim_port(self, name):
        serial = self.sim[name]["serial"]
        found = sorted(glob.glob(str(self.by_id / f"*_{serial}-if*")))
        if not found:
            raise FileNotFoundError(f"the {self._name('sim.' + name)}'s control adapter ({serial}) is not plugged in")
        return found[0]

    def cabling_for(self, layout, box):
        if layout == "main":
            return ("main", f"native:{box}") if box in BOXES else ("main",)
        if box in BOXES:
            return (f"native:{box}",)
        return tuple(f"native:{b}" for b in BOXES)

    def _where(self):
        return {name: self._locate(sim["serial"]) for name, sim in self.sim.items()}

    def _cabling(self, where):
        behind = {s: where[s] == self.box[cfg["box"]]["clone"] for s, cfg in self.sim.items()}
        on_pc = {s: where[s] == cfg["native"] for s, cfg in self.sim.items()}
        if all(behind.values()):
            return "main"
        if sum(on_pc.values()) == 1 and sum(behind.values()) == len(self.sim) - 1:
            [lent] = [s for s, v in on_pc.items() if v]
            [b] = [cfg["box"] for s, cfg in self.sim.items() if s != lent]
            return f"native:{b}"
        return "unknown"

    def layout_now(self):
        return self._cabling(self._where())

    def _wanted(self, target):
        if target == "main":
            return {s: "behind" for s in self.sim}
        box = target.split(":", 1)[1]
        return {s: ("behind" if cfg["box"] == box else "pc") for s, cfg in self.sim.items()}

    def move_to(self, target):
        where = self._where()
        steps = []
        for s, cfg in self.sim.items():
            usb3 = f"the {self._name(cfg['box'])}'s USB3 socket"
            pc = self._name(cfg["native"])
            here = "behind" if where[s] == self.box[cfg["box"]]["clone"] else "pc" if where[s] == cfg["native"] else None
            want = self._wanted(target)[s]
            if here == want:
                continue
            frm = {"behind": usb3, "pc": pc, None: "wherever it is now"}[here]
            steps.append(Step(f"{self._name('sim.' + s)}'s device cable", frm, usb3 if want == "behind" else pc))
        steps.sort(key=lambda st: not st.to.endswith("USB3 socket"))
        move = CableMove(target, steps)
        if steps:
            print(f"CABLE MOVE for {target}: {move.text()}", file=sys.stderr, flush=True)
        return move

    def wait_for(self, target, timeout=None, every=2.0):
        end = None if timeout is None else time.monotonic() + timeout
        while self.layout_now() != target:
            if end is not None and time.monotonic() > end:
                raise TimeoutError(f"the bench is not cabled for {target}")
            time.sleep(every)

    def power_cycle(self, box, timeout=30.0):
        cfg = self.box[box].get("power")
        if not cfg:
            raise power.PowerCycleFailed(f"the bench config names no hub ports powering the {self._name(box)}")
        power.cycle(cfg["hub"], cfg["ports"])
        end = time.monotonic() + timeout
        while True:
            try:
                self.control_port(box)
                return
            except FileNotFoundError:
                if time.monotonic() > end:
                    raise
                time.sleep(0.2)

    def replug_by_hand(self, box, every=0.2):
        """Ask for the box's power to be cut by hand, and wait until its control port has gone and come back."""
        cables = f"the {self._name(box)}'s USB1 and USB2 cables"
        for s, cfg in self.sim.items():
            if cfg["box"] == box:
                cables += f" and the {self._name('sim.' + s)}'s device cable from its USB3 socket"
        print(f"POWER CYCLE BY HAND: the {self._name(box)} is in a state only a power cycle clears. "
              f"Unplug {cables}, wait 3 s, and plug them back in.", file=sys.stderr, flush=True)
        for gone in (True, False):
            while True:
                try:
                    self.control_port(box)
                    present = True
                except FileNotFoundError:
                    present = False
                if present != gone:
                    break
                time.sleep(every)

    def sims(self):
        return {name: self._describe(sim["serial"]) for name, sim in self.sim.items()}


class SoloBench:
    """The no-sim script's bench: one box, the device the verifier plugged in, no cable moves."""

    def layout_now(self):
        return "solo"

    def cabling_for(self, layout, box):
        return ("solo",)

    def move_to(self, target):
        raise RuntimeError("the no-sim script has no cabling to move to")

    def wait_for(self, target, timeout=None):
        return True

    def power_cycle(self, box):
        raise power.PowerCycleFailed("this bench has no hub to switch")

    def replug_by_hand(self, box):
        print("The stock box is in a state only a power cycle clears: unplug both its USB cables, "
              "wait 3 s, plug them back in, then press Enter.", file=sys.stderr, flush=True)
        input()

    def sims(self):
        return {}
