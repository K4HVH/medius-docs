"""Tests for medius_compare.bench and medius_compare.power, on a fake bench: no hubs, sims or boxes."""
import dataclasses
import json
import os
import stat
from pathlib import Path

import pytest
from fakes import FakeBox, FakeDevices
from medius_compare.bench import Bench
from medius_compare.declare import load_suite
from medius_compare.engine import Engine, Selection, StockStillJammed

FIXTURES = Path(__file__).parent / "fixtures" / "suite"
CONFIG = {
    "names": {"stock": "stock box", "medius": "Medius box", "sim.stock": "stock sim", "sim.medius": "Medius sim",
              "2-5.1": "PC hub socket 2"},
    "box": {"stock": {"control": "STOCKSERIAL", "clone": "2-3.4", "power": {"hub": "2-5", "ports": [1, 2, 3]}},
            "medius": {"control": "MEDIUSSERIAL", "clone": "2-3.1"}},
    "sim": {"stock": {"serial": "SIMSTOCK", "box": "stock", "native": "2-5.1"},
            "medius": {"serial": "SIMMEDIUS", "box": "medius", "native": "2-5.1"}},
}


def bench(tmp_path, where):
    by_id = tmp_path / "by-id"
    by_id.mkdir(exist_ok=True)
    for serial in ("STOCKSERIAL", "MEDIUSSERIAL"):
        (by_id / f"usb-1a86_USB_Single_Serial_{serial}-if00").touch()
    return Bench(CONFIG, locate=lambda serial: where.get(serial), by_id=by_id)


def test_layout_now_reads_the_native_layout_from_sim_serials(tmp_path):
    assert bench(tmp_path, {"SIMSTOCK": "2-3.4", "SIMMEDIUS": "2-3.1"}).layout_now() == "main"
    assert bench(tmp_path, {"SIMSTOCK": "2-5.1", "SIMMEDIUS": "2-3.1"}).layout_now() == "native:medius"
    assert bench(tmp_path, {"SIMSTOCK": "2-3.4", "SIMMEDIUS": "2-5.1"}).layout_now() == "native:stock"
    assert bench(tmp_path, {"SIMSTOCK": None, "SIMMEDIUS": "2-3.1"}).layout_now() == "unknown"


def test_each_box_takes_its_own_native_cabling(tmp_path):
    b = bench(tmp_path, {})
    assert b.cabling_for("main", "stock") == ("main", "native:stock")
    assert b.cabling_for("main", "medius") == ("main", "native:medius")
    assert b.cabling_for("native", "stock") == ("native:stock",)
    assert b.cabling_for("native", "medius") == ("native:medius",)
    assert set(b.cabling_for("native", "native")) == {"native:stock", "native:medius"}


def test_cable_move_names_sockets_from_bench_names(tmp_path):
    b = bench(tmp_path, {"SIMSTOCK": "2-3.4", "SIMMEDIUS": "2-3.1"})
    assert b.move_to("native:stock").text() == (
        "Move the Medius sim's device cable from the Medius box's USB3 socket to PC hub socket 2.")
    b = bench(tmp_path, {"SIMSTOCK": "2-5.1", "SIMMEDIUS": "2-3.1"})
    assert b.move_to("native:stock").text() == (
        "Move the stock sim's device cable from PC hub socket 2 to the stock box's USB3 socket. "
        "Move the Medius sim's device cable from the Medius box's USB3 socket to PC hub socket 2.")
    b = bench(tmp_path, {"SIMSTOCK": "2-3.4", "SIMMEDIUS": "2-5.1"})
    assert b.move_to("native:medius").text() == (
        "Move the Medius sim's device cable from PC hub socket 2 to the Medius box's USB3 socket. "
        "Move the stock sim's device cable from the stock box's USB3 socket to PC hub socket 2.")


def test_an_unknown_config_key_is_refused():
    with pytest.raises(ValueError, match="cloen"):
        Bench({**CONFIG, "box": {**CONFIG["box"], "medius": {"control": "X", "cloen": "2-3.1"}}})


class JamBox(FakeBox):
    """A stock box one reply behind until the hub has switched its power off and on."""

    def __init__(self, record):
        super().__init__("stock")
        self.record = record
        self.reopened = 0

    def lagging(self):
        return not (self.record.exists() and "-a on" in self.record.read_text())

    def reopen(self):
        if not self.port_open:
            self.port_open = True
            return
        self.reopened += 1


def fake_uhubctl(tmp_path, monkeypatch, code=0):
    bindir = tmp_path / "bin"
    bindir.mkdir()
    record = tmp_path / "uhubctl.log"
    script = bindir / "uhubctl"
    script.write_text(f"#!/bin/sh\necho \"$*\" >> {record}\nexit {code}\n")
    script.chmod(script.stat().st_mode | stat.S_IEXEC)
    monkeypatch.setenv("PATH", f"{bindir}{os.pathsep}{os.environ['PATH']}")
    monkeypatch.setattr("medius_compare.power.OFF_S", 0.0)
    return record


def jamming_engine(tmp_path, box):
    suite = load_suite(FIXTURES)
    suite["fake-test"] = dataclasses.replace(suite["fake-test"], jams_stock=True, boxes=["stock"])
    b = bench(tmp_path, {"SIMSTOCK": "2-3.4", "SIMMEDIUS": "2-3.1"})
    return Engine(entry="sim", bench=b, devices=FakeDevices(), boxes={"stock": box}, suite=suite,
                  out_dir=tmp_path / "runs")


def test_jammed_stock_is_power_cycled_then_reprobed(tmp_path, monkeypatch):
    record = fake_uhubctl(tmp_path, monkeypatch)
    box = JamBox(record)
    [path] = jamming_engine(tmp_path, box).run(Selection(tests=["fake-test"]), runs=1)
    assert record.read_text().splitlines() == ["-l 2-5 -p 1,2,3 -a off", "-l 2-5 -p 1,2,3 -a on"]
    assert box.reopened == 1
    assert len(json.loads(path.read_text())["tests"]["fake-test"]["runs"]) == 1


def test_failed_power_cycle_stops_with_a_resume_pointer(tmp_path, monkeypatch):
    record = fake_uhubctl(tmp_path, monkeypatch, code=1)
    monkeypatch.setattr(Bench, "replug_by_hand", lambda self, name: None)
    with pytest.raises(StockStillJammed, match=r"--resume \d{8}-\d{6}"):
        jamming_engine(tmp_path, JamBox(record)).run(Selection(tests=["fake-test"]), runs=1)


def test_a_cycle_that_leaves_stock_jammed_asks_for_a_replug_by_hand(tmp_path, monkeypatch):
    record = fake_uhubctl(tmp_path, monkeypatch)
    box = JamBox(tmp_path / "never-written")
    asked = []

    def replug(self, name):
        asked.append(name)
        box.record.write_text("-a on")

    monkeypatch.setattr(Bench, "replug_by_hand", replug)
    [path] = jamming_engine(tmp_path, box).run(Selection(tests=["fake-test"]), runs=1)
    assert record.read_text().count("-a on") == 1 and asked == ["stock"]
    assert box.reopened == 2 and not box.lagging()


def test_replug_by_hand_waits_for_the_port_to_go_and_come_back(tmp_path, capsys):
    import threading
    import time
    b = bench(tmp_path, {})
    link = tmp_path / "by-id" / "usb-1a86_USB_Single_Serial_STOCKSERIAL-if00"
    done = []

    def person():
        time.sleep(0.1)
        link.unlink()
        done.append("unplugged")
        time.sleep(0.1)
        done.append("plugged")
        link.touch()

    threading.Thread(target=person).start()
    b.replug_by_hand("stock", every=0.01)
    assert done == ["unplugged", "plugged"]
    assert "Unplug the stock box" in capsys.readouterr().err


def test_under_sudo_the_config_is_the_invoking_users(tmp_path, monkeypatch):
    import pwd
    import tomllib
    from medius_compare import bench as bench_mod
    home = tmp_path / "home"
    (home / ".config" / "medius-compare").mkdir(parents=True)
    (home / ".config" / "medius-compare" / "bench.toml").write_text("[names]\n")
    monkeypatch.setenv("HOME", str(tmp_path / "root"))
    monkeypatch.setenv("SUDO_USER", "someone")
    monkeypatch.setattr(pwd, "getpwnam", lambda name: type("P", (), {"pw_dir": str(home)})())
    assert bench_mod.default_config() == home / ".config" / "medius-compare" / "bench.toml"


def test_the_config_names_the_sim_library():
    assert Bench({**CONFIG, "sim_library": "/opt/sim/tools"}).sim_library == "/opt/sim/tools"
    assert Bench(CONFIG).sim_library is None


def test_the_sim_entry_hands_the_shapes_the_configured_sim_library(monkeypatch, tmp_path):
    from medius_compare import boxes, cli
    from medius_shapes import personalities
    monkeypatch.setattr(personalities, "SIM_LIBRARY", None)
    monkeypatch.setattr(Bench, "load", classmethod(lambda cls, path=None: cls({**CONFIG, "sim_library": "/opt/sim"})))
    monkeypatch.setattr(boxes, "open_box", lambda kind, port: FakeBox(kind))
    monkeypatch.setattr(Bench, "control_port", lambda self, box: f"/dev/serial/{box}")
    args = type("A", (), {"bench": None, "box": "medius", "out": tmp_path})()
    cli._engine("sim", args, {})
    assert personalities.SIM_LIBRARY == "/opt/sim"


def test_the_run_file_names_each_sims_build_but_never_its_serial():
    b = Bench(CONFIG, describe=lambda serial: {"build": 412816493})
    sims = b.sims()
    assert sims == {name: {"build": 412816493} for name in CONFIG["sim"]}
    assert not any(cfg["serial"] in repr(sims) for cfg in CONFIG["sim"].values())


def test_the_no_sim_tool_asks_for_a_replug_and_carries_on_after_enter(tmp_path, monkeypatch, capsys):
    from medius_compare.bench import SoloBench
    suite = load_suite(FIXTURES)
    suite["fake-test"] = dataclasses.replace(suite["fake-test"], jams_stock=True, boxes=["stock"])
    box = JamBox(tmp_path / "power.log")
    entered = []

    def person(prompt=""):
        box.record.write_text("-a on")
        entered.append(True)
        return ""

    monkeypatch.setattr("builtins.input", person)
    eng = Engine(entry="no-sim", bench=SoloBench(), devices=FakeDevices(), boxes={"stock": box}, suite=suite,
                 out_dir=tmp_path / "runs")
    [path] = eng.run(Selection(tests=["fake-test"]), runs=1)
    assert entered == [True]
    assert "unplug both its USB cables, wait 3 s, plug them back in, then press Enter" in capsys.readouterr().err
    assert box.reopened == 1 and not box.lagging()
    assert len(json.loads(path.read_text())["tests"]["fake-test"]["runs"]) == 1
