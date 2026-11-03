"""Tests for medius_compare.boxes: a pty playing a stock box, and a stand-in for medius.Device."""
import os
import pty
import re
import subprocess
import threading
import time
import tty

import medius
import pytest

from medius_compare import boxes

ANSWERS = {"km.echo()": "0", "km.screen()": "km.screen(1920,1080)", "km.version()": "km.MAKCU"}
SETTER = re.compile(r"km\.(move|wheel|pan|left|right|middle|side1|side2|down|up|lock_m[xywlrm]|lock_ms[12])\(.+\)")


class StockFake:
    """The master end of a pty, answering as V4.122 does with echo off: a query replies with its value
    and a prompt, a setter is silent, anything else echoes itself and ERR. With `lag`, each reply is held
    until the next line arrives."""

    def __init__(self, lag=False):
        self.master, self.slave = pty.openpty()
        tty.setraw(self.slave)
        self.path = os.ttyname(self.slave)
        self.lag = lag
        self.held = b""
        self.lines = []
        self.interp = 255
        threading.Thread(target=self._serve, daemon=True).start()

    def _serve(self):
        buf = b""
        while True:
            try:
                buf += os.read(self.master, 4096)
            except OSError:
                return
            while True:
                if buf.startswith(b"\xde\xad"):
                    if len(buf) < 5 or len(buf) < 5 + int.from_bytes(buf[2:4], "little"):
                        break
                    n = int.from_bytes(buf[2:4], "little")
                    cmd, payload, buf = buf[4], buf[5:5 + n], buf[5 + n:]
                    self._reply(self._mak(cmd, payload))
                    continue
                if b"\r\n" not in buf:
                    break
                line, buf = buf.split(b"\r\n", 1)
                line = line.decode()
                if not line:
                    continue
                self.lines.append(line)
                self._reply(self._text(line))

    def _mak(self, cmd, payload):
        if cmd == 0x1F:
            if payload:
                self.interp = payload[0]
            body = bytes([self.interp])
        elif cmd == 0x04:
            body = (4122).to_bytes(4, "little")
        else:
            body = b"\xff"
        return b"\xde\xad" + len(body).to_bytes(2, "little") + bytes([cmd]) + body

    def _text(self, line):
        if line in ANSWERS:
            return ANSWERS[line].encode() + b"\r\n>>> "
        if re.fullmatch(r"km\.lock_m\w+\(\)|km\.isdown\(\d+\)|km\.left\(\)", line):
            return b"0\r\n>>> "
        if SETTER.fullmatch(line):
            return b""
        time.sleep(0.03)
        return line.encode() + b"\r\nERR\r\n>>> "

    def _reply(self, reply):
        if not self.lag:
            os.write(self.master, reply)
            return
        out, self.held = self.held, reply
        if out:
            os.write(self.master, out)


def test_stock_query_reads_to_the_prompt():
    fake = StockFake()
    box = boxes.StockBox(fake.path)
    try:
        assert box.query("km.screen()") == "km.screen(1920,1080)"
        assert box.firmware() == {"version": "V4.122"}
    finally:
        box.close()


def test_stock_query_skips_a_late_error_reply():
    fake = StockFake()
    box = boxes.StockBox(fake.path)
    try:
        box.send("km.bogus(1)")
        assert box.query("km.version()") == "km.MAKCU"
        box.send("km.bogus(2)")
        assert not box.lagging()
    finally:
        box.close()


def test_stock_mak_refusal_is_reported():
    fake = StockFake()
    box = boxes.StockBox(fake.path)
    try:
        with pytest.raises(boxes.Refused):
            box.mak(0x7E)
        assert box.mak(0x1F, ff_ok=True) == b"\xff"
    finally:
        box.close()


def test_stock_lag_probe_detects_one_reply_behind():
    box = boxes.StockBox(StockFake().path)
    try:
        assert not box.lagging()
    finally:
        box.close()
    box = boxes.StockBox(StockFake(lag=True).path)
    try:
        assert box.lagging()
        assert box.query("km.version()") == "km.MAKCU"
        assert box.firmware() == {"version": "V4.122"}
        assert box.query("km.screen()") == "km.screen(1920,1080)"
    finally:
        box.close()


def test_stock_refuses_a_held_port():
    fake = StockFake()
    fd = os.open(fake.path, os.O_RDWR | os.O_NOCTTY)
    holder = subprocess.Popen(["sleep", "30"], stdin=fd)
    os.close(fd)
    try:
        with pytest.raises(boxes.PortBusy, match=r"sleep \(pid \d+\)"):
            boxes.StockBox(fake.path)
    finally:
        holder.kill()
        holder.wait()


def test_stock_settings_round_trip_and_close_puts_them_back():
    fake = StockFake()
    fake.interp = 40
    box = boxes.StockBox(fake.path)
    assert box.settings() == {"interp": 255}
    box.apply({"interp": 60})
    assert box.settings() == {"interp": 60}
    with pytest.raises(ValueError, match="optin"):
        box.apply({"optin": True})
    box.close()
    assert fake.interp == 40


def test_stock_leave_releases_what_was_pressed_and_locked():
    fake = StockFake()
    box = boxes.StockBox(fake.path)
    try:
        box.press("left")
        box.press("key:4")
        box.lock("x")
        box.leave()
        time.sleep(0.05)
        sent = fake.lines
        assert sent.index("km.left(0)") > sent.index("km.left(1)")
        assert sent.index("km.up(4)") > sent.index("km.down(4)")
        assert sent.index("km.lock_mx(0)") > sent.index("km.lock_mx(1)")
    finally:
        box.close()


class FakeDevice:
    """Records the verbs a MediusBox sends and keeps the settings it is given."""

    def __init__(self, spread=100):
        self.calls = []
        self.state = dict(optin=False, riding=None, pace=medius.EmitPace.learned(), force=None, window=20,
                          bearing=medius.BearingMode.PER_AXIS, render=medius.RenderMode.DESPIKED, full=False,
                          spread=spread)

    def __getattr__(self, name):
        def record(*args):
            self.calls.append((name, args))
        return record

    def allow_imperfect_clones(self, allow):
        self.calls.append(("allow_imperfect_clones", (allow,)))
        self.state["optin"] = allow

    def set_movement_riding(self, ms):
        self.calls.append(("set_movement_riding", (ms,)))
        self.state["riding"] = ms

    def set_emit_pace(self, pace, force_hz=None):
        self.calls.append(("set_emit_pace", (pace, force_hz)))
        self.state.update(pace=pace, force=force_hz)

    def set_bearing(self, window, mode):
        self.calls.append(("set_bearing", (window, mode)))
        self.state.update(window=window, bearing=mode)

    def set_render(self, mode, full):
        self.calls.append(("set_render", (mode, full)))
        self.state.update(render=mode, full=full)

    def set_spread(self, percent):
        self.calls.append(("set_spread", (percent,)))
        self.state["spread"] = percent

    def query_imperfect(self):
        return medius.ImperfectStatus(allowed=self.state["optin"], over_capacity=False, clone_imperfect=False)

    def query_movement_riding(self):
        return self.state["riding"]

    def query_emit_pace(self):
        return medius.EmitPaceStatus(mode=self.state["pace"], resolved_hz=1000, force_hz=self.state["force"])

    def query_bearing(self):
        return medius.Bearing(window_ms=self.state["window"], mode=self.state["bearing"])

    def query_render(self):
        return medius.RenderStatus(mode=self.state["render"], full=self.state["full"])

    def query_spread(self):
        return medius.SpreadStatus(percent=self.state["spread"])


def open_medius(monkeypatch, device):
    monkeypatch.setattr(medius.Device, "open", classmethod(lambda cls, path: device))
    return boxes.MediusBox("/dev/null")


def verbs(device):
    return [(n, a) for n, a in device.calls if not n.startswith(("set_", "allow_"))]


def test_medius_box_maps_the_verbs(monkeypatch):
    device = FakeDevice()
    box = open_medius(monkeypatch, device)
    device.calls.clear()
    box.move(3, -2)
    box.move(1, 1, now=True)
    box.wheel(-1)
    box.pan(2)
    box.press("right")
    box.release("right")
    box.press("key:4")
    box.lock("x")
    box.unlock("left")
    names = [n for n, _ in verbs(device)]
    assert names == ["move_rel", "move_rel_now", "wheel", "pan", "press", "soft_release", "press", "lock", "unlock"]
    args = [a for _, a in verbs(device)]
    assert args[0] == (3, -2) and args[1] == (1, 1) and args[2] == (-1,) and args[3] == (2,)
    assert args[4] == (medius.Usage.button(medius.Button.RIGHT),)
    assert args[6] == (medius.Usage.key(4),)
    target, direction = args[7]
    assert target.kind == medius.LockTargetKind.X and direction == medius.Direction.BOTH
    target, _ = args[8]
    assert target.input == medius.Usage.button(medius.Button.LEFT)


def test_medius_box_applies_only_what_differs_and_puts_settings_back(monkeypatch):
    device = FakeDevice(spread=50)
    box = open_medius(monkeypatch, device)
    assert ("set_spread", (100,)) in device.calls
    assert box.settings() == boxes.MediusBox.DEFAULTS
    device.calls.clear()
    box.apply({"render": "off"})
    assert device.calls == [("set_render", (medius.RenderMode.OFF, False))]
    assert box.settings()["render"] == "off"
    with pytest.raises(ValueError, match="interp"):
        box.apply({"interp": 1})
    device.calls.clear()
    box.close()
    names = [n for n, _ in device.calls]
    assert names.index("reset") < names.index("set_spread")
    assert ("set_spread", (50,)) in device.calls and device.state["render"] == medius.RenderMode.DESPIKED


def test_medius_held_port_is_port_busy(monkeypatch):
    def busy(cls, path):
        raise medius.PortBusyError(medius.Status.ERR_PORT_BUSY, "held by dashboard (pid 7)")
    monkeypatch.setattr(medius.Device, "open", classmethod(busy))
    with pytest.raises(boxes.PortBusy, match=r"dashboard \(pid 7\)"):
        boxes.MediusBox("/dev/null")
