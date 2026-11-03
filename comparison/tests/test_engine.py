"""Tests for medius_compare.engine, on fake boxes, devices and bench."""
import json
from pathlib import Path

from fakes import FakeBench, FakeBox, FakeDevices
from medius_compare.declare import load_suite
from medius_compare.engine import Engine, Selection

FIXTURES = Path(__file__).parent / "fixtures" / "suite"


def engine(tmp_path, entry="sim", boxes=None, devices=None, bench=None):
    return Engine(entry=entry, bench=bench or FakeBench(), devices=devices or FakeDevices(),
                  boxes=boxes or {"stock": FakeBox("stock"), "medius": FakeBox("medius")},
                  suite=load_suite(FIXTURES), out_dir=tmp_path)


def load(paths, box):
    [path] = [p for p in paths if p.parent.name == box]
    return json.loads(path.read_text())


def test_runs_three_times_and_writes_each_run(tmp_path):
    paths = engine(tmp_path).run(Selection(tests=["fake-test"]), runs=3)
    for box in ("stock", "medius"):
        runs = load(paths, box)["tests"]["fake-test"]["runs"]
        assert [r["rest"]["run"] for r in runs] == [0, 1, 2]
        assert all(r["rest"]["box"] == box for r in runs)


def test_state_mismatch_refuses_the_test(tmp_path):
    boxes = {"stock": FakeBox("stock"), "medius": FakeBox("medius", readback={"optin": True})}
    paths = engine(tmp_path, boxes=boxes).run(Selection(tests=["fake-test"]), runs=3)
    entry = load(paths, "medius")["tests"]["fake-test"]
    assert entry["runs"] == []
    assert "optin" in entry["failed"]


def test_resume_carries_on_from_the_test_it_stopped_at(tmp_path):
    e = engine(tmp_path)
    [first] = e.run(Selection(tests=["fake-test"], boxes=["medius"]), runs=1)
    stamp = first.stem
    paths = engine(tmp_path).run(Selection(tests=["fake-test", "fake-sim"], boxes=["medius"]), runs=3, resume=stamp)
    tests = load(paths, "medius")["tests"]
    assert [r["rest"]["run"] for r in tests["fake-test"]["runs"]] == [0, 1, 2]
    assert len(tests["fake-sim"]["runs"]) == 3


def test_no_sim_runs_only_still_legs(tmp_path):
    devices = FakeDevices()
    paths = engine(tmp_path, entry="no-sim", devices=devices).run(Selection(tests=["fake-sim"]), runs=1)
    entry = load(paths, "medius")["tests"]["fake-sim"]
    assert entry["legs"] == ["rest"]
    assert "sine" in entry["skipped_legs"] and "sim" in entry["skipped_legs"]["sine"]
    assert all(dev != "sim:sine-mouse" for _, dev, _ in devices.presented)


def test_records_what_it_ran_on(tmp_path):
    paths = engine(tmp_path).run(Selection(tests=["fake-test"], boxes=["medius"]), runs=1)
    f = load(paths, "medius")
    assert f["host"]["kernel"] and f["tool"]["version"] and f["tool"]["entry"] == "sim"
    assert f["firmware"] == {"device": "3.5.0+fake", "proto": 10}
    entry = f["tests"]["fake-test"]
    assert entry["layout"] == "main" and entry["version"] == 2
    assert entry["devices"][0]["descriptor_sha256"] == "ab" * 32


def test_leaves_the_bench_as_the_next_test_needs_it(tmp_path):
    devices = FakeDevices()
    engine(tmp_path, devices=devices).run(Selection(tests=["fake-test"]), runs=1)
    assert set(devices.restored) == {"stock", "medius"}


def test_a_test_in_another_layout_asks_for_the_move(tmp_path):
    bench = FakeBench(layout="native")
    engine(tmp_path, bench=bench).run(Selection(tests=["fake-test"]), runs=1)
    assert bench.moves == ["main"]


def test_a_layout_choice_runs_only_that_layouts_tests(tmp_path):
    e = engine(tmp_path, bench=FakeBench(layout="native"))
    assert [t.id for t in e.select(Selection(layouts=["main"]))] == ["fake-sim", "fake-test"]
    assert e.select(Selection(layouts=["native"])) == []


def test_an_empty_selection_is_refused(tmp_path):
    bench = FakeBench(layout="native")
    try:
        engine(tmp_path, bench=bench).run(Selection(layouts=["native"]), runs=1)
    except ValueError as e:
        assert "no test matches" in str(e)
    else:
        raise AssertionError("ran an empty selection")
    assert bench.moves == [] and not any(tmp_path.iterdir())


def test_a_capture_that_lost_data_fails_the_test(tmp_path, monkeypatch):
    from medius_compare import integrity

    class Lossy:
        @staticmethod
        def run(ctx):
            integrity.report("usbmon_lost", 2)
            return {"value": 1}

    monkeypatch.setattr(Engine, "_module", lambda self, t: Lossy)
    paths = engine(tmp_path).run(Selection(tests=["fake-test"]), runs=3)
    entry = load(paths, "medius")["tests"]["fake-test"]
    assert "usbmon_lost 2" in entry["failed"] and entry["runs"] == []


def test_each_box_runs_in_its_own_native_cabling_with_no_extra_moves(tmp_path):
    import dataclasses
    suite = load_suite(FIXTURES)
    suite["fake-test"] = dataclasses.replace(suite["fake-test"], layout="native", boxes=["stock", "medius", "native"])
    bench = FakeBench(layout="native:medius")
    eng = Engine(entry="sim", bench=bench, devices=FakeDevices(),
                 boxes={"stock": FakeBox("stock"), "medius": FakeBox("medius")}, suite=suite, out_dir=tmp_path)
    paths = eng.run(Selection(tests=["fake-test"]), runs=1)
    assert bench.moves == ["native:stock"]
    assert all(len(load(paths, b)["tests"]["fake-test"]["runs"]) == 1 for b in ("stock", "medius", "native"))


def test_a_tests_own_shapes_reach_the_devices(tmp_path, monkeypatch):
    class WithShapes:
        SHAPES = {"sine-mouse": lambda: "a sine mouse"}

        @staticmethod
        def run(ctx):
            ctx.device("rest")
            return {"value": 1}

    monkeypatch.setattr(Engine, "_module", lambda self, t: WithShapes)
    devices = FakeDevices()
    engine(tmp_path, devices=devices).run(Selection(tests=["fake-test"]), runs=1)
    assert list(devices.shapes) == ["sine-mouse"]


def test_a_test_reaches_the_sim_behind_its_box(tmp_path, monkeypatch):
    got = []

    class UsesSim:
        @staticmethod
        def run(ctx):
            got.append(ctx.sim())
            return {"value": 1}

    monkeypatch.setattr(Engine, "_module", lambda self, t: UsesSim)
    devices = FakeDevices()
    devices.sim_link = lambda box: f"link to {box}'s sim"
    engine(tmp_path, devices=devices).run(Selection(tests=["fake-test"], boxes=["medius"]), runs=1)
    assert got == ["link to medius's sim"]


def test_a_box_run_can_present_on_the_native_sim_too(tmp_path, monkeypatch):
    class Both:
        @staticmethod
        def run(ctx):
            ctx.device("rest")
            ctx.native("rest")
            return {"value": 1}

    monkeypatch.setattr(Engine, "_module", lambda self, t: Both)
    devices = FakeDevices()
    engine(tmp_path, devices=devices).run(Selection(tests=["fake-test"], boxes=["medius"]), runs=1)
    assert [(leg, box) for leg, _, box in devices.presented] == [("rest", "medius"), ("rest", "native")]


def test_a_leg_another_replaced_on_its_sim_is_presented_again(tmp_path, monkeypatch):
    import dataclasses
    from medius_compare.declare import LegDecl
    suite = load_suite(FIXTURES)
    suite["fake-test"] = dataclasses.replace(suite["fake-test"], legs=[LegDecl("a", "still-mouse"), LegDecl("b", "still-keyboard")])

    class Alternates:
        @staticmethod
        def run(ctx):
            ctx.device("a")
            ctx.device("b")
            ctx.device("a")
            return {"value": 1}

    monkeypatch.setattr(Engine, "_module", lambda self, t: Alternates)
    devices = FakeDevices()
    Engine(entry="sim", bench=FakeBench(), devices=devices, boxes={"medius": FakeBox("medius")}, suite=suite,
           out_dir=tmp_path).run(Selection(tests=["fake-test"], boxes=["medius"]), runs=2)
    assert [leg for leg, _, _ in devices.presented] == ["a", "b", "a", "b", "a"]


def test_a_test_reaches_the_native_sim(tmp_path, monkeypatch):
    got = []

    class UsesNative:
        @staticmethod
        def run(ctx):
            got.append(ctx.sim("native"))
            return {"value": 1}

    monkeypatch.setattr(Engine, "_module", lambda self, t: UsesNative)
    devices = FakeDevices()
    devices.sim_link = lambda box: f"link to {box}'s sim"
    engine(tmp_path, devices=devices).run(Selection(tests=["fake-test"], boxes=["medius"]), runs=1)
    assert got == ["link to native's sim"]


def test_a_jammed_stock_box_is_cleared_after_every_run(tmp_path, monkeypatch):
    import dataclasses
    suite = load_suite(FIXTURES)
    suite["fake-test"] = dataclasses.replace(suite["fake-test"], jams_stock=True, boxes=["stock"])
    box = FakeBox("stock")
    box.jammed = False
    box.lagging = lambda: box.jammed
    box.reopen = lambda: None
    started_jammed = []

    class Jams:
        @staticmethod
        def run(ctx):
            ctx.device("rest")
            started_jammed.append(ctx.box.jammed)
            ctx.box.jammed = True
            return {"value": 1}

    bench = FakeBench()
    bench.power_cycle = lambda name: (bench.cycled.append(name), setattr(box, "jammed", False))
    devices = FakeDevices()
    monkeypatch.setattr(Engine, "_module", lambda self, t: Jams)
    Engine(entry="sim", bench=bench, devices=devices, boxes={"stock": box}, suite=suite,
           out_dir=tmp_path).run(Selection(tests=["fake-test"]), runs=3)
    assert started_jammed == [False, False, False] and bench.cycled == ["stock"] * 3
    assert [leg for leg, _, _ in devices.presented] == ["rest"] * 3


def test_a_test_clears_a_jammed_stock_box_mid_run(tmp_path, monkeypatch):
    import dataclasses
    suite = load_suite(FIXTURES)
    suite["fake-test"] = dataclasses.replace(suite["fake-test"], jams_stock=True, boxes=["stock"])
    box = FakeBox("stock")
    box.jammed = False
    box.lagging = lambda: box.jammed
    box.reopen = lambda: None
    seen = []

    class TwoJams:
        @staticmethod
        def run(ctx):
            ctx.device("rest")
            ctx.box.jammed = True
            ctx.unjam()
            seen.append(ctx.box.jammed)
            ctx.device("rest")
            return {"value": 1}

    bench = FakeBench()
    bench.power_cycle = lambda name: (bench.cycled.append(name), setattr(box, "jammed", False))
    devices = FakeDevices()
    monkeypatch.setattr(Engine, "_module", lambda self, t: TwoJams)
    Engine(entry="sim", bench=bench, devices=devices, boxes={"stock": box}, suite=suite,
           out_dir=tmp_path).run(Selection(tests=["fake-test"]), runs=1)
    assert seen == [False] and bench.cycled == ["stock"]
    assert [leg for leg, _, _ in devices.presented] == ["rest", "rest"]


def test_a_test_with_no_legs_runs(tmp_path, monkeypatch):
    import dataclasses

    class NoDevice:
        @staticmethod
        def run(ctx):
            return {"value": 1}

    monkeypatch.setattr(Engine, "_module", lambda self, t: NoDevice)
    suite = load_suite(FIXTURES)
    suite["fake-test"] = dataclasses.replace(suite["fake-test"], legs=[])
    paths = Engine(entry="no-sim", bench=FakeBench(), devices=FakeDevices(), boxes={"medius": FakeBox("medius")},
                   suite=suite, out_dir=tmp_path).run(Selection(tests=["fake-test"], boxes=["medius"]), runs=1)
    assert len(load(paths, "medius")["tests"]["fake-test"]["runs"]) == 1


def test_the_native_sim_is_restored_after_a_test_used_it(tmp_path, monkeypatch):
    class Both:
        @staticmethod
        def run(ctx):
            ctx.native("rest")
            return {"value": 1}

    monkeypatch.setattr(Engine, "_module", lambda self, t: Both)
    devices = FakeDevices()
    engine(tmp_path, devices=devices).run(Selection(tests=["fake-test"], boxes=["medius"]), runs=1)
    assert devices.restored == ["medius", "native"]


def test_the_other_box_is_parked_before_a_box_runs(tmp_path):
    devices = FakeDevices()
    devices.parked = []
    devices.park_others = devices.parked.append
    engine(tmp_path, devices=devices).run(Selection(tests=["fake-test"]), runs=1)
    assert devices.parked == ["stock", "medius"]


def test_a_box_returns_to_its_defaults_before_each_test(tmp_path):
    import dataclasses
    suite = load_suite(FIXTURES)
    suite["fake-sim"] = dataclasses.replace(suite["fake-sim"], state={"medius": {"optin": True}})
    suite["fake-test"] = dataclasses.replace(suite["fake-test"], state={})
    box = FakeBox("medius")
    box.DEFAULTS = {"optin": False, "spread": 100}
    Engine(entry="sim", bench=FakeBench(), devices=FakeDevices(), boxes={"medius": box}, suite=suite,
           out_dir=tmp_path).run(Selection(tests=["fake-sim", "fake-test"], boxes=["medius"]), runs=1)
    assert box.settings()["optin"] is False


def test_a_power_cycle_mid_run_puts_the_tests_settings_back(tmp_path, monkeypatch):
    import dataclasses
    suite = load_suite(FIXTURES)
    suite["fake-test"] = dataclasses.replace(suite["fake-test"], jams_stock=True, boxes=["stock"],
                                             state={"stock": {"interp": 40}})
    box = FakeBox("stock")
    box.DEFAULTS = {"interp": 255}
    box.jammed = False
    box.lagging = lambda: box.jammed
    box.reopen = lambda: None
    seen = []

    class Jams:
        @staticmethod
        def run(ctx):
            ctx.box.jammed = True
            ctx.unjam()
            seen.append(ctx.box.settings()["interp"])
            return {"value": 1}

    bench = FakeBench()

    def cycle(name):
        bench.cycled.append(name)
        box.jammed = False
        box._settings = {"interp": 255}

    bench.power_cycle = cycle
    monkeypatch.setattr(Engine, "_module", lambda self, t: Jams)
    Engine(entry="sim", bench=bench, devices=FakeDevices(), boxes={"stock": box}, suite=suite,
           out_dir=tmp_path).run(Selection(tests=["fake-test"]), runs=1)
    assert seen == [40]
