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
