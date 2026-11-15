"""Tests for medius_compare.runfile."""
import json

from medius_compare.runfile import RunFile, resume_point


def test_each_run_is_on_disk_as_it_lands(tmp_path):
    path = tmp_path / "medius" / "s1.json"
    rf = RunFile.create(path, box="medius", entry="sim", tool_version="1.0.0", host={"kernel": "k"},
                        firmware={"device": "3.5.0"}, sims={})
    rf.begin_test("t", version=3, layout="main", legs=["rest"], devices=[], state={})
    rf.add_run("t", {"rest": {"value": 1}})
    on_disk = json.loads(path.read_text())
    assert on_disk["format"] == "medius-compare-run/1"
    assert on_disk["tests"]["t"]["runs"] == [{"rest": {"value": 1}}]
    assert on_disk["finished"] is None
    rf.close()
    assert json.loads(path.read_text())["finished"] is not None


def test_resume_point_counts_runs_per_test(tmp_path):
    path = tmp_path / "medius" / "s1.json"
    rf = RunFile.create(path, box="medius", entry="sim", tool_version="1.0.0", host={}, firmware={}, sims={})
    rf.begin_test("a", version=1, layout="main", legs=[], devices=[], state={})
    rf.add_run("a", {})
    rf.begin_test("b", version=1, layout="main", legs=[], devices=[], state={})
    rf.fail("b", "state readback: optin was True")
    assert resume_point(path) == {"a": 1, "b": 0}
