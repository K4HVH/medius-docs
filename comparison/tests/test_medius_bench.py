"""Tests for medius_bench. Run: python3 -m pytest comparison/tests"""
import os
import pty
import subprocess
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
import medius_bench as mb  # noqa: E402


def test_clone_usb_port_reads_first_rule_port(tmp_path):
    rule = tmp_path / "99-medius-quiet-clone.rules"
    rule.write_text('SUBSYSTEM=="input", KERNELS=="3-2.3", ENV{LIBINPUT_IGNORE_DEVICE}="1"\n'
                    'SUBSYSTEM=="input", KERNELS=="3-2.2", ENV{LIBINPUT_IGNORE_DEVICE}="1"\n')
    assert mb.clone_usb_port(str(rule)) == "3-2.3"


def test_clone_usb_port_without_a_rule(tmp_path):
    assert mb.clone_usb_port(str(tmp_path / "absent.rules")) is None


def test_native_sim_parses_comment(tmp_path):
    rule = tmp_path / "99-medius-quiet-clone.rules"
    rule.write_text('SUBSYSTEM=="input", KERNELS=="3-2.3", ENV{LIBINPUT_IGNORE_DEVICE}="1"\n'
                    "# native-sim SIM0000001 3-1.4\n")
    assert mb.native_sim(str(rule)) == ("/dev/serial/by-id/usb-1a86_USB_Single_Serial_SIM0000001-if00", "3-1.4")


def test_port_holders_excludes_self_unless_asked():
    master, slave = pty.openpty()
    path = os.ttyname(slave)
    try:
        assert mb.port_holders(path) == []
        assert any(f"(pid {os.getpid()})" in h for h in mb.port_holders(path, include_self=True))
    finally:
        os.close(slave)
        os.close(master)


def test_port_holders_names_another_process():
    master, slave = pty.openpty()
    path = os.ttyname(slave)
    child = subprocess.Popen(["sleep", "30"], stdin=slave)
    os.close(slave)
    try:
        assert f"sleep (pid {child.pid})" in mb.port_holders(path)
    finally:
        child.kill()
        child.wait()
        os.close(master)
