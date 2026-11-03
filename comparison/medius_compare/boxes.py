"""The two boxes behind one surface: the stock firmware's `km.` text and binary commands, and Medius through
the published `medius` package.

Usages are strings: `left`, `right`, `middle`, `side1`, `side2`, or `key:<HID usage>`. Lock targets are
those, or an axis: `x`, `y`, `wheel`, `pan`.

Opening a box puts its settings at their defaults, and closing it puts back what it found.
"""
import os
import sys
import threading
import time
from typing import Protocol

import serial

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from medius_bench import port_holders, restore_vmin  # noqa: E402

BUTTONS = ("left", "right", "middle", "side1", "side2")
AXES = ("x", "y", "wheel", "pan")


class PortBusy(RuntimeError):
    """Another program has the box's control port open. The port takes one reader."""


class Refused(RuntimeError):
    """The stock box answered a binary command with a refusal."""


class Box(Protocol):
    kind: str

    def firmware(self) -> dict: ...
    def move(self, dx: int, dy: int, now: bool = False) -> None: ...
    def wheel(self, d: int) -> None: ...
    def pan(self, d: int) -> None: ...
    def press(self, usage: str) -> None: ...
    def release(self, usage: str) -> None: ...
    def lock(self, target: str) -> None: ...
    def unlock(self, target: str) -> None: ...
    def settings(self) -> dict: ...
    def apply(self, settings: dict) -> None: ...
    def lagging(self) -> bool: ...
    def leave(self) -> None: ...
    def reopen(self) -> None: ...
    def close(self) -> None: ...


def _key(usage):
    if usage.startswith("key:"):
        return int(usage[4:], 0)
    return None


def _check(usage):
    if usage not in BUTTONS and _key(usage) is None:
        raise ValueError(f"no usage {usage!r}: a button ({', '.join(BUTTONS)}) or key:<HID usage>")


def _unknown(settings, known, kind):
    bad = sorted(set(settings) - set(known))
    if bad:
        raise ValueError(f"the {kind} box has no setting {', '.join(bad)}; it has {', '.join(sorted(known))}")


def _wait_for_path(path, timeout):
    end = time.monotonic() + timeout
    while not os.path.exists(path):
        if time.monotonic() > end:
            raise TimeoutError(f"{path} did not come back within {timeout:.0f} s")
        time.sleep(0.1)


class StockBox:
    """The stock firmware's control port: `km.` text at 4 Mbaud, where a query's reply ends at the `>>> `
    prompt and a setter answers nothing, beside binary commands framed `DE AD <len u16> <cmd> <payload>`.
    """

    kind = "stock"
    BAUD = 4_000_000
    PROMPT = b">>> "
    GAP_S = 0.02
    DEFAULTS = {"interp": 255}
    LOCKS = {"x": "mx", "y": "my", "wheel": "mw", "left": "ml", "right": "mr", "middle": "mm",
             "side1": "ms1", "side2": "ms2"}

    def __init__(self, port):
        self.port = port
        self._held_keys = set()
        self._open()
        self._initial = self.settings()
        self.apply(self.DEFAULTS)

    def _open(self):
        holders = port_holders(self.port)
        if holders:
            raise PortBusy(f"{self.port} is open in {', '.join(holders)}; close it first")
        self.s = serial.Serial(self.port, self.BAUD, timeout=0.02)
        self.buf = bytearray()
        self.cv = threading.Condition()
        self.running = True
        self.rx = threading.Thread(target=self._read, daemon=True)
        self.rx.start()
        self.s.write(b"\r\n")
        time.sleep(0.05)
        self.drain()
        self.lag = self.lagging()

    def _read(self):
        while self.running:
            try:
                data = self.s.read(max(1, self.s.in_waiting))
            except (OSError, serial.SerialException, TypeError):
                return
            if data:
                with self.cv:
                    self.buf += data
                    self.cv.notify_all()

    def _shut(self):
        self.running = False
        self.rx.join(1)
        restore_vmin(self.s)
        self.s.close()

    def close(self):
        try:
            self.leave()
            self.apply(self._initial)
        finally:
            self._shut()

    def reopen(self, timeout=15.0):
        """Open the port again, after a power cycle: the port goes away and comes back."""
        try:
            self._shut()
        except (OSError, serial.SerialException):
            pass
        _wait_for_path(self.port, timeout)
        end = time.monotonic() + timeout
        while True:
            try:
                self._open()
                return
            except (OSError, serial.SerialException):
                if time.monotonic() > end:
                    raise
                time.sleep(0.2)

    def drain(self):
        with self.cv:
            data = bytes(self.buf)
            self.buf.clear()
        return data

    def send(self, cmd):
        self.s.write(cmd.encode() + b"\r\n")

    def write(self, data):
        """Bytes as they are, for a test that paces or breaks commands on purpose."""
        self.s.write(data)

    def _prompt(self, timeout):
        end = time.monotonic() + timeout
        with self.cv:
            while self.PROMPT not in self.buf:
                left = end - time.monotonic()
                if left <= 0:
                    return None
                self.cv.wait(left)
            i = self.buf.index(self.PROMPT)
            text = bytes(self.buf[:i])
            del self.buf[:i + len(self.PROMPT)]
        return text.decode("latin1").strip()

    def _reply_to(self, cmd, timeout):
        """The next reply that is not another command's error. A setter that fails answers late with
        itself and ERR, after any query sent behind it has drained the buffer."""
        end = time.monotonic() + timeout
        while True:
            text = self._prompt(max(0.0, end - time.monotonic()))
            if text is None:
                return None
            lines = text.splitlines()
            if len(lines) == 2 and lines[1] == "ERR" and lines[0] != cmd:
                continue
            return text

    def query(self, cmd, timeout=1.0):
        """Send `cmd` and return its reply, the text before the prompt; None if no prompt came."""
        self.drain()
        self.send(cmd)
        if self.lag:
            self._prompt(0.3)
            self.drain()
            self.send("km.screen()")
        return self._reply_to(cmd, timeout)

    def lagging(self):
        """Whether the box answers one command late, holding each reply until the next command arrives.
        In step, `km.screen()` after `km.echo()` answers with the screen size; one behind, with the echo
        state."""
        self.drain()
        self.send("km.echo()")
        self._reply_to("km.echo()", 0.3)
        self.send("km.screen()")
        second = self._reply_to("km.screen()", 0.3) or ""
        self.drain()
        return not second.startswith("km.screen")

    def mak(self, cmd, payload=b"", timeout=0.5, ff_ok=False):
        """A binary command. Returns the reply's payload. A payload of the single byte FF is a refusal,
        except where FF is a value the command can return (`ff_ok`)."""
        payload = bytes(payload)
        n = len(payload) + 1 if cmd in (0xA4, 0xA5) else len(payload)
        self.drain()
        self.s.write(b"\xde\xad" + n.to_bytes(2, "little") + bytes([cmd]) + payload)
        if self.lag:
            self._prompt(0.3)
            self.send("km.screen()")
        end = time.monotonic() + timeout
        with self.cv:
            while True:
                i = self.buf.find(b"\xde\xad")
                if i >= 0 and len(self.buf) >= i + 5:
                    size = int.from_bytes(self.buf[i + 2:i + 4], "little")
                    if len(self.buf) >= i + 5 + size:
                        op, body = self.buf[i + 4], bytes(self.buf[i + 5:i + 5 + size])
                        del self.buf[:i + 5 + size]
                        if op != cmd:
                            continue
                        if body == b"\xff" and not ff_ok:
                            raise Refused(f"binary command {cmd:#04x} refused")
                        return body
                left = end - time.monotonic()
                if left <= 0:
                    raise TimeoutError(f"no reply to binary command {cmd:#04x}")
                self.cv.wait(left)

    def firmware(self):
        n = int.from_bytes(self.mak(0x04), "little")
        return {"version": f"V{n // 1000}.{n % 1000:03d}"}

    def move(self, dx, dy, now=False):
        self.send(f"km.{'move_now' if now else 'move'}({dx},{dy})")

    def wheel(self, d):
        self.send(f"km.wheel({d})")

    def pan(self, d):
        self.send(f"km.pan({d})")

    def press(self, usage):
        _check(usage)
        key = _key(usage)
        if key is None:
            self.send(f"km.{usage}(1)")
        else:
            self._held_keys.add(key)
            self.send(f"km.down({key})")

    def release(self, usage):
        _check(usage)
        key = _key(usage)
        if key is None:
            self.send(f"km.{usage}(0)")
        else:
            self._held_keys.discard(key)
            self.send(f"km.up({key})")

    def _lock_cmd(self, target, on):
        if target not in self.LOCKS:
            raise ValueError(f"the stock box has no lock on {target!r}; it locks {', '.join(self.LOCKS)}")
        self.send(f"km.lock_{self.LOCKS[target]}({1 if on else 0})")

    def lock(self, target):
        self._lock_cmd(target, True)

    def unlock(self, target):
        self._lock_cmd(target, False)

    def settings(self):
        return {"interp": self.mak(0x1F, ff_ok=True)[0]}

    def apply(self, settings):
        _unknown(settings, self.DEFAULTS, "stock")
        if "interp" in settings and settings["interp"] != self.settings()["interp"]:
            self.mak(0x1F, bytes([settings["interp"]]), ff_ok=True)

    def leave(self):
        """Release every button and key and clear every lock, a command at a time, then drop the replies
        the releases of things not held answer with."""
        cmds = [f"km.up({k})" for k in sorted(self._held_keys)] + [f"km.{b}(0)" for b in BUTTONS]
        cmds += [f"km.lock_{v}(0)" for v in self.LOCKS.values()]
        for cmd in cmds:
            self.send(cmd)
            time.sleep(self.GAP_S)
        self._held_keys.clear()
        time.sleep(0.05)
        self.drain()


class MediusBox:
    """Medius through the `medius` package. `device` is the package's `Device`, for what the shared surface
    leaves out."""

    kind = "medius"
    DEFAULTS = {"optin": False, "riding": 0, "emit": "learned", "force_hz": 0, "bearing": 20,
                "bearing_mode": "per_axis", "render": "despiked", "full": False, "spread": 100}

    def __init__(self, port):
        import medius
        self.medius = medius
        self.port = port
        self._open()
        self._initial = self.settings()
        self.apply(self.DEFAULTS)

    def _open(self):
        try:
            self.device = self.medius.Device.open(self.port)
        except self.medius.PortBusyError as e:
            raise PortBusy(str(e)) from None

    def close(self):
        try:
            self.leave()
            self.apply(self._initial)
        finally:
            self.device.close()

    def reopen(self, timeout=15.0):
        try:
            self.device.close()
        except self.medius.MediusError:
            pass
        _wait_for_path(self.port, timeout)
        self._open()

    def lagging(self):
        return False

    def firmware(self):
        v = self.device.query_version()
        info = self.device.firmware_info()
        return {"version": f"{v.fw_major}.{v.fw_minor}.{v.fw_patch}", "proto": v.proto_ver,
                "device": str(info.device), "host": str(info.host) if info.host else None}

    def _usage(self, usage):
        _check(usage)
        key = _key(usage)
        if key is None:
            return self.medius.Usage.button(self.medius.Button[usage.upper()])
        return self.medius.Usage.key(key)

    def _target(self, target):
        if target in AXES:
            return getattr(self.medius.LockTarget, target)()
        return self.medius.LockTarget.usage(self._usage(target))

    def move(self, dx, dy, now=False):
        (self.device.move_rel_now if now else self.device.move_rel)(dx, dy)

    def wheel(self, d):
        self.device.wheel(d)

    def pan(self, d):
        self.device.pan(d)

    def press(self, usage):
        self.device.press(self._usage(usage))

    def release(self, usage):
        self.device.soft_release(self._usage(usage))

    def lock(self, target):
        self.device.lock(self._target(target), self.medius.Direction.BOTH)

    def unlock(self, target):
        self.device.unlock(self._target(target), self.medius.Direction.BOTH)

    def settings(self):
        d = self.device
        pace = d.query_emit_pace()
        mode = pace.mode
        emit = f"fixed:{mode.hz}" if mode.mode == self.medius.EmitMode.FIXED else mode.mode.name.lower()
        bearing = d.query_bearing()
        render = d.query_render()
        return {"optin": d.query_imperfect().allowed, "riding": d.query_movement_riding() or 0, "emit": emit,
                "force_hz": pace.force_hz or 0, "bearing": bearing.window_ms or 0,
                "bearing_mode": bearing.mode.name.lower(), "render": render.mode.name.lower(),
                "full": render.full, "spread": d.query_spread().percent}

    def _pace(self, emit):
        if emit.startswith("fixed:"):
            return self.medius.EmitPace.fixed(int(emit[6:]))
        return getattr(self.medius.EmitPace, emit)()

    def apply(self, settings):
        _unknown(settings, self.DEFAULTS, "Medius")
        now = self.settings()
        want = {**now, **settings}
        changed = {k for k in want if want[k] != now[k]}
        m, d = self.medius, self.device
        if "optin" in changed:
            d.allow_imperfect_clones(want["optin"])
        if "riding" in changed:
            d.set_movement_riding(want["riding"] or None)
        if changed & {"emit", "force_hz"}:
            d.set_emit_pace(self._pace(want["emit"]), want["force_hz"] or None)
        if changed & {"bearing", "bearing_mode"}:
            d.set_bearing(want["bearing"] or None, m.BearingMode[want["bearing_mode"].upper()])
        if changed & {"render", "full"}:
            d.set_render(m.RenderMode[want["render"].upper()], want["full"])
        if "spread" in changed:
            d.set_spread(want["spread"])

    def leave(self):
        """Back to passthrough: every injected press, lock and pending move cleared."""
        self.device.reset()

    def raw(self):
        """Close the package's connection and return the bare port, for a test that writes what the package
        would refuse to send. `reopen()` brings the package back."""
        self.device.close()
        s = serial.Serial(self.port, 6_000_000, timeout=0.05)
        return _RawPort(s)


class _RawPort:
    def __init__(self, s):
        self.s = s

    def write(self, data):
        self.s.write(data)

    def read(self, n=4096):
        return self.s.read(n)

    def close(self):
        restore_vmin(self.s)
        self.s.close()


def open_box(kind, port):
    if kind == "stock":
        return StockBox(port)
    if kind == "medius":
        return MediusBox(port)
    raise ValueError(f"no box {kind!r}: stock or medius")
