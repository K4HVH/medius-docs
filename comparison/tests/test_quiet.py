"""Tests for medius_bench.quiet and the clone guard's check of it, with no udev, input nodes or USB bus."""
import contextlib
import os
from types import SimpleNamespace

import pytest
from medius_bench import clone_guard, quiet


class FakeBox:
    def __init__(self, vid, pid):
        self.info = SimpleNamespace(vid=vid, pid=pid)
        self.closed = False

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        self.closed = True

    def device_info(self):
        return self.info


@pytest.fixture
def rule(tmp_path, monkeypatch):
    path = tmp_path / "rules.d" / "99-quiet.rules"
    monkeypatch.setattr(quiet, "RULE", str(path))
    monkeypatch.setattr(clone_guard, "RULE", str(path))
    monkeypatch.setattr(quiet, "_udev_reload", lambda: None)
    monkeypatch.setattr(quiet, "_reenumerate", lambda port: None)
    return path


def test_clone_usb_port_finds_the_port_carrying_the_cloned_identity(monkeypatch):
    nodes = {"event3": ("1-5", "046d:c077"), "event7": ("1-3", "1d50:6160")}
    monkeypatch.setattr(quiet.os, "listdir", lambda path: list(nodes) if path == "/dev/input" else [])
    monkeypatch.setattr(quiet, "usb_port_of", lambda name: nodes[name])
    box = FakeBox(0x1D50, 0x6160)
    assert quiet.clone_usb_port(box) == "1-3"
    assert box.closed


def test_the_rule_names_the_process_holding_it(rule):
    quiet.set_rule(["1-3"], True)
    text = rule.read_text()
    assert 'KERNELS=="1-3"' in text and f"# holder {os.getpid()}" in text


def test_the_guard_takes_only_a_live_holder(rule):
    assert not clone_guard._quiet_running()
    quiet.set_rule(["1-3"], True)
    assert clone_guard._quiet_running()
    rule.write_text(rule.read_text().replace(f"# holder {os.getpid()}", "# holder 999999999"))
    assert not clone_guard._quiet_running()


def test_quieted_removes_its_rule_however_it_ends(rule, monkeypatch):
    monkeypatch.setattr(quiet, "hold", lambda ports, stop=None: stop.wait())
    with pytest.raises(KeyboardInterrupt):
        with quiet.quieted(["1-3"]):
            assert rule.exists()
            raise KeyboardInterrupt
    assert not rule.exists()


def test_a_stock_run_without_the_clone_port_lists_the_candidates(monkeypatch):
    from medius_compare import cli
    monkeypatch.setattr(cli.os, "geteuid", lambda: 0)
    monkeypatch.setattr(quiet, "input_ports", lambda: [("1-4", "1d50:6160", "Gaming Mouse"),
                                                       ("1-5", "046d:c077", "USB Optical Mouse")])
    with pytest.raises(SystemExit, match=r"--usb-port.*1-4.*Gaming Mouse.*1-5"):
        cli.main("no-sim", ["run", "--box", "stock", "--port", "/dev/ttyACM0"])


def test_a_no_sim_run_keeps_the_clone_quiet_while_it_runs(monkeypatch, tmp_path):
    from medius_compare import cli
    seen = []

    @contextlib.contextmanager
    def quieted(ports, native=None):
        seen.append(("quiet", list(ports)))
        yield
        seen.append(("loud",))

    class Engine:
        def run(self, selection, runs, resume, stock_jam_runs=None):
            seen.append(("run",))
            return []

    monkeypatch.setattr(cli.os, "geteuid", lambda: 0)
    monkeypatch.setattr(quiet, "quieted", quieted)
    monkeypatch.setattr(clone_guard, "engage", lambda: seen.append(("guard",)))
    monkeypatch.setattr(cli, "_engine", lambda entry, args, suite: Engine())
    cli.main("no-sim", ["run", "--box", "stock", "--port", "/dev/ttyACM0", "--usb-port", "1-4",
                        "--out", str(tmp_path)])
    assert seen == [("quiet", ["1-4"]), ("guard",), ("run",), ("loud",)]
