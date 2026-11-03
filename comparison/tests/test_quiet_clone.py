"""Tests for comparison/quiet_clone.py. Run: python3 -m pytest comparison/tests"""
import os
import sys
from types import SimpleNamespace

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
import quiet_clone as qc  # noqa: E402


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


def test_clone_usb_port_finds_the_port_carrying_the_cloned_identity(monkeypatch):
    nodes = {"event3": ("3-1.4", "046d:c077"), "event7": ("3-2.3", "1d50:6160")}
    monkeypatch.setattr(qc.os, "listdir", lambda path: list(nodes) if path == "/dev/input" else [])
    monkeypatch.setattr(qc, "usb_port_of", lambda name: nodes[name])
    box = FakeBox(0x1D50, 0x6160)
    assert qc.clone_usb_port(box) == "3-2.3"
    assert box.closed
