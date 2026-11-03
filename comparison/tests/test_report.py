"""Tests for medius_compare.report."""
from pathlib import Path

from fakes import FakeBench, FakeBox, FakeDevices
from medius_compare.declare import load_suite
from medius_compare.engine import Engine, Selection
from medius_compare.report import report

FIXTURES = Path(__file__).parent / "fixtures" / "suite"


def test_report_puts_two_runs_side_by_side(tmp_path):
    suite = load_suite(FIXTURES)
    paths = Engine(entry="no-sim", bench=FakeBench(), devices=FakeDevices(),
                   boxes={"stock": FakeBox("stock"), "medius": FakeBox("medius")}, suite=suite,
                   out_dir=tmp_path).run(Selection(tests=["fake-test"]), runs=2)
    text = report(paths, suite)
    assert "Fake latency" in text and "Fake condition" in text
    line = next(l for l in text.splitlines() if "Fake condition" in l)
    assert line.count("7") >= 2          # the stock and the Medius value
    assert "V4.122" in text and "3.5.0+fake" in text


def test_report_refuses_two_runs_of_one_box(tmp_path):
    suite = load_suite(FIXTURES)
    e = Engine(entry="no-sim", bench=FakeBench(), devices=FakeDevices(), boxes={"medius": FakeBox("medius")},
               suite=suite, out_dir=tmp_path)
    a = e.run(Selection(tests=["fake-test"], boxes=["medius"]), runs=1, resume="a")
    b = e.run(Selection(tests=["fake-test"], boxes=["medius"]), runs=1, resume="b")
    import pytest
    with pytest.raises(ValueError, match="one run per box"):
        report(a + b, suite)
