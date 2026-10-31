#!/usr/bin/env python3
"""medius-compare: the Medius comparison's tests that need no USB device emulator, for any MAKCU box and USB mouse.

Run it once on stock firmware and once on Medius, then compare the two runs:

    sudo python3 medius-compare.py run --box stock --out stock.json \\
        --port /dev/serial/by-id/usb-1a86_USB_Single_Serial_<serial>-if00
    sudo python3 medius-compare.py run --box medius --out medius.json \\
        --port /dev/serial/by-id/usb-1a86_USB_Single_Serial_<serial>-if00
    python3 medius-compare.py report stock.json medius.json

The figures depend on your mouse and PC, so they won't match the published ones exactly.

Requirements:
  PC           Linux, run as root
  Python       3.10 or newer, with pyserial
  Medius       the medius package release for the box's firmware (pip install medius)
  Wire timing  USB1 and USB2 on one of the PC's USB buses (lsusb -t). On two, the tool uses host timing

Wiring: USB1 (clone) and USB2 (control) to this PC, USB3 to your mouse. Leave the mouse still while the tool runs.

The tool grabs the clone while it runs, so nothing it injects reaches your desktop. It sends the mouse only the reads
a PC makes at enumeration, never writes the box's flash, and releases every button, key and lock it set, on Ctrl-C
too. Stock is driven over its serial API (km. commands), Medius over the medius package. The malformed test writes its
bytes to the control port directly, since no API sends a broken frame.

On stock, move-accept and malformed can leave the parser one command behind until the box is unplugged. The tool runs
them after every other test that sends the box commands, and skips a test that sends commands while the box is behind.
The ep0 test runs last: it reads the mouse plugged into the PC.

Timing layers, as the report names them:
  wire     USB packets on the PC's bus, timed by usbmon: the command to the control port and the clone's report on
           one clock
  evdev    input events, timed by the kernel as the HID driver handles each report from the clone
  host     this program's clock, read as it writes a command
  outcome  no times: what each side answered (ep0)
"""

import argparse
import ctypes
import fcntl
import json
import os
import random
import re
import select
import signal
import struct
import sys
import threading
import time

VERSION = "1.0.0"

STOCK_BAUD = 4_000_000
MEDIUS_BAUD = 6_000_000

LAYERS = {
    "wire": "USB packets on the PC's bus, timed by usbmon: the command to the control port and the clone's report on one clock.",
    "evdev": "Input events, timed by the kernel as the HID driver handles each report from the clone.",
    "host": "This program's clock, read as it writes a command.",
    "outcome": "No times: what each side answered.",
}

# ---------------------------------------------------------------------------
# small stats
# ---------------------------------------------------------------------------

def pct(xs, p):
    if not xs:
        return None
    s = sorted(xs)
    k = (len(s) - 1) * p / 100.0
    lo = int(k)
    hi = min(lo + 1, len(s) - 1)
    return s[lo] + (s[hi] - s[lo]) * (k - lo)


def summary(xs, scale=1.0, unit="us"):
    xs = [x for x in xs if x is not None]
    if not xs:
        return {"n": 0, "unit": unit}
    r = lambda v: round(v * scale, 3)
    return {
        "n": len(xs), "unit": unit,
        "min": r(min(xs)), "p50": r(pct(xs, 50)), "p95": r(pct(xs, 95)),
        "p99": r(pct(xs, 99)), "max": r(max(xs)),
    }


# ---------------------------------------------------------------------------
# sysfs USB helpers (no transfers, nothing claimed)
# ---------------------------------------------------------------------------

SYSFS = "/sys/bus/usb/devices"


def read_attr(dev, name, binary=False):
    try:
        with open(os.path.join(dev, name), "rb" if binary else "r") as f:
            return f.read() if binary else f.read().strip()
    except OSError:
        return None


def usb_ids(dev):
    v, p = read_attr(dev, "idVendor"), read_attr(dev, "idProduct")
    return (int(v, 16), int(p, 16)) if v and p else (None, None)


def bus_dev(dev):
    b, d = read_attr(dev, "busnum"), read_attr(dev, "devnum")
    return (int(b), int(d)) if b and d else (None, None)


def tty_usb_device(tty_path):
    """The USB device directory (e.g. .../3-2.2) behind a serial tty, or None."""
    try:
        name = os.path.basename(os.path.realpath(tty_path))
        iface = os.path.realpath(f"/sys/class/tty/{name}/device")
    except OSError:
        return None
    # The interface dir is <busid>:config.iface; its parent is the USB device.
    dev = os.path.dirname(iface)
    return dev if os.path.exists(os.path.join(dev, "idVendor")) else None


def port_holders(tty_path):
    """The other processes with the serial port open, as 'name (pid N)'. Each reader takes what it reads, so one
    beside the tool (a browser tab connected to the box) takes replies the tool waits for. Run as root, the tool
    opens a port a browser holds."""
    try:
        path = os.path.realpath(tty_path)
        pids = [p for p in os.listdir("/proc") if p.isdigit() and int(p) != os.getpid()]
    except OSError:
        return []
    held = []
    for pid in pids:
        try:
            fds = os.listdir(f"/proc/{pid}/fd")
        except OSError:
            continue
        for fd in fds:
            try:
                target = os.readlink(f"/proc/{pid}/fd/{fd}")
            except OSError:
                continue
            if target == path:
                try:
                    with open(f"/proc/{pid}/comm") as f:
                        name = f.read().strip()
                except OSError:
                    name = "?"
                held.append(f"{name} (pid {pid})")
                break
    return held


def input_nodes_on(busid):
    """Every /dev/input/eventN whose device sits on this USB device (busid, e.g. 3-2.2)."""
    out = []
    base = "/sys/class/input"
    if not os.path.isdir(base):
        return out
    for n in sorted(os.listdir(base)):
        if not n.startswith("event"):
            continue
        real = os.path.realpath(f"{base}/{n}/device")
        if f"/{busid}/" in real or f"/{busid}:" in real:
            out.append("/dev/input/" + n)
    return out


def hidraw_nodes_on(busid):
    out = []
    base = "/sys/class/hidraw"
    if not os.path.isdir(base):
        return out
    for n in sorted(os.listdir(base)):
        real = os.path.realpath(f"{base}/{n}/device")
        if f"/{busid}/" in real or f"/{busid}:" in real:
            out.append("/dev/" + n)
    return out


def report_descriptor_on(busid):
    """The HID report descriptor bytes read from sysfs (no control transfer, nothing claimed)."""
    base = "/sys/class/hidraw"
    if not os.path.isdir(base):
        return None
    for n in sorted(os.listdir(base)):
        real = os.path.realpath(f"{base}/{n}/device")
        if f"/{busid}/" in real or f"/{busid}:" in real:
            rd = os.path.join(os.path.dirname(real), "report_descriptor")
            try:
                with open(rd, "rb") as f:
                    return f.read()
            except OSError:
                continue
    return None


# ---------------------------------------------------------------------------
# clone discovery
# ---------------------------------------------------------------------------

EVIOCGBIT_REL = 0x80084522  # EVIOCGBIT(EV_REL, 8)


def has_rel_xy(node):
    try:
        fd = os.open(node, os.O_RDONLY | os.O_NONBLOCK)
    except OSError:
        return False
    try:
        buf = bytearray(8)
        fcntl.ioctl(fd, EVIOCGBIT_REL, buf)
        return bool(buf[0] & 0x03)  # REL_X and REL_Y
    except OSError:
        return False
    finally:
        os.close(fd)


def pointer_busids(exclude):
    """USB busids that present a relative pointer, excluding the control-port device."""
    found = set()
    base = "/sys/class/input"
    if not os.path.isdir(base):
        return found
    for n in sorted(os.listdir(base)):
        if not n.startswith("event"):
            continue
        if not has_rel_xy("/dev/input/" + n):
            continue
        real = os.path.realpath(f"{base}/{n}/device")
        # Walk up to the USB device directory (the one with idVendor).
        p = real
        for _ in range(8):
            if os.path.exists(os.path.join(p, "idVendor")):
                busid = os.path.basename(p)
                if busid != exclude:
                    found.add(busid)
                break
            p = os.path.dirname(p)
    return found


def find_clone(port, arg):
    """Return the clone's (busid, sysfs dir). arg is a busid, a VID:PID, or None to auto-detect."""
    ctrl = tty_usb_device(port)
    ctrl_busid = os.path.basename(ctrl) if ctrl else None
    if arg and ":" in arg:
        vid, pid = (int(x, 16) for x in arg.split(":"))
        for busid in os.listdir(SYSFS):
            dev = os.path.join(SYSFS, busid)
            if usb_ids(dev) == (vid, pid) and busid != ctrl_busid:
                return busid, dev
        raise SystemExit(f"no USB device {arg} found (other than the control port)")
    if arg:
        dev = os.path.join(SYSFS, arg)
        if not os.path.exists(os.path.join(dev, "idVendor")):
            raise SystemExit(f"{arg} is not a USB device directory under {SYSFS}")
        return arg, dev
    cand = pointer_busids(ctrl_busid)
    if not cand:
        raise SystemExit("no clone found: give --clone BUSID (e.g. 3-2.2) or VID:PID "
                         "(the clone is the mouse as the box presents it on USB1)")
    if len(cand) > 1:
        raise SystemExit(f"more than one mouse on the PC ({', '.join(sorted(cand))}): "
                         "give --clone with the clone's busid or VID:PID")
    busid = cand.pop()
    return busid, os.path.join(SYSFS, busid)


# ---------------------------------------------------------------------------
# evdev capture + grab
# ---------------------------------------------------------------------------

EVIOCGRAB = 0x40044590
EVIOCSCLOCKID = 0x400445A0
EVIOCGKEY = 0x80604518   # EVIOCGKEY(96)
EVIOCGBIT_KEY = 0x80604521  # EVIOCGBIT(EV_KEY, 96)
CLOCK_MONOTONIC = 1
EV_SYN, EV_KEY, EV_REL = 0, 1, 2
SYN_REPORT, SYN_DROPPED = 0, 3
REL_X, REL_Y = 0, 1
BTN_LEFT, KEY_A = 0x110, 30
EVSZ = struct.calcsize("llHHi")


def mono():
    return time.clock_gettime(time.CLOCK_MONOTONIC)


class InputCap:
    """Reads one evdev node with kernel timestamps, optionally grabbing it so its events never reach the
    desktop. `frames` is a list of (t, {rel code: summed value}, [(key code, value)]) per SYN_REPORT."""

    def __init__(self, node, grab=False):
        self.node = node
        self.fd = os.open(node, os.O_RDONLY | os.O_NONBLOCK)
        try:
            fcntl.ioctl(self.fd, EVIOCSCLOCKID, struct.pack("i", CLOCK_MONOTONIC))
        except OSError:
            pass
        self.grabbed = False
        if grab:
            try:
                fcntl.ioctl(self.fd, EVIOCGRAB, 1)
                self.grabbed = True
            except OSError:
                pass
        self.frames = []
        self.dropped = 0
        self.lock = threading.Lock()
        self.running = True
        self._rel, self._keys = {}, []
        self.t = threading.Thread(target=self._run, daemon=True)
        self.t.start()

    def _run(self):
        rem = b""
        while self.running:
            r, _, _ = select.select([self.fd], [], [], 0.05)
            if not r:
                continue
            try:
                data = os.read(self.fd, 65536)
            except BlockingIOError:
                continue
            except OSError:
                break
            if not data:
                break
            data = rem + data
            n = len(data) - len(data) % EVSZ
            rem = data[n:]
            for i in range(0, n, EVSZ):
                sec, usec, typ, code, val = struct.unpack_from("llHHi", data, i)
                if typ == EV_REL:
                    self._rel[code] = self._rel.get(code, 0) + val
                elif typ == EV_KEY:
                    self._keys.append((code, val))
                elif typ == EV_SYN and code == SYN_REPORT:
                    with self.lock:
                        self.frames.append((sec + usec / 1e6, self._rel, self._keys))
                    self._rel, self._keys = {}, []
                elif typ == EV_SYN and code == SYN_DROPPED:
                    self.dropped += 1
                    self._rel, self._keys = {}, []

    def take(self):
        with self.lock:
            f, self.frames = self.frames, []
        return f

    def peek(self):
        with self.lock:
            return list(self.frames)

    def clear(self):
        with self.lock:
            self.frames = []

    def held(self, code):
        buf = bytearray(96)
        try:
            fcntl.ioctl(self.fd, EVIOCGKEY, buf)
        except OSError:
            return None
        return bool(buf[code // 8] & (1 << (code % 8)))

    def wait_sum(self, rel_code, target, timeout):
        """Wait until the summed value of rel_code reaches target; return the frames so far."""
        end = time.monotonic() + timeout
        while time.monotonic() < end:
            with self.lock:
                if sum(r.get(rel_code, 0) for _, r, _ in self.frames) >= target:
                    return list(self.frames)
            time.sleep(0.0005)
        return self.peek()

    def close(self):
        self.running = False
        self.t.join(1)
        if self.grabbed:
            try:
                fcntl.ioctl(self.fd, EVIOCGRAB, 0)
            except OSError:
                pass
        os.close(self.fd)


def node_has_key(node, code):
    try:
        fd = os.open(node, os.O_RDONLY | os.O_NONBLOCK)
    except OSError:
        return False
    try:
        buf = bytearray(96)
        fcntl.ioctl(fd, EVIOCGBIT_KEY, buf)
        return bool(buf[code // 8] & (1 << (code % 8)))
    except OSError:
        return False
    finally:
        os.close(fd)


# ---------------------------------------------------------------------------
# usbmon wire reader
# ---------------------------------------------------------------------------

_MON = struct.Struct("<QBBBBHccqiiII8s")  # 48-byte usbmon_packet header


class Usbmon:
    """Reads /dev/usbmonN, keeping events of the asked-for device numbers. Each event: ts (us), kind
    ('S'/'C'/'E'), xfer (1 intr, 2 ctrl, 3 bulk), ep (0x80 = IN), dev, length, data."""

    def __init__(self, bus, devnums):
        self.bus, self.devnums = bus, set(devnums)
        self.events = []
        self.fd = None
        self.running = False

    def __enter__(self):
        try:
            self.fd = os.open(f"/dev/usbmon{self.bus}", os.O_RDONLY)
        except OSError:
            self.fd = None
            return self
        self.running = True
        self.t = threading.Thread(target=self._run, daemon=True)
        self.t.start()
        return self

    @property
    def ok(self):
        return self.fd is not None

    def _run(self):
        while self.running:
            r, _, _ = select.select([self.fd], [], [], 0.1)
            if not r:
                continue
            try:
                b = os.read(self.fd, 4096)
            except OSError:
                break
            if len(b) < 48:
                continue
            (_id, typ, xt, ep, dn, _bus, fsetup, _fdata, sec, usec,
             _st, ln, lc, setup) = _MON.unpack_from(b)
            if dn not in self.devnums:
                continue
            data = setup if (xt == 2 and typ == ord("S")) else b[48:48 + max(0, lc)]
            self.events.append((sec * 1_000_000 + usec, chr(typ), xt, ep, dn, ln, data))

    def __exit__(self, *a):
        self.running = False
        if self.fd is not None:
            time.sleep(0.05)
            try:
                self.t.join(1)
            except Exception:
                pass
            os.close(self.fd)

    def take(self):
        ev, self.events = self.events, []
        return ev


def out_completions(events, dev, pred):
    """Delivery times (us) of OUT (bulk) packets on `dev` whose bytes satisfy pred."""
    t, pending = [], False
    for ts, kind, xt, ep, dn, ln, data in events:
        if dn != dev or xt != 3 or ep & 0x80:
            continue
        if kind == "S":
            pending = pred(data)
        elif kind == "C" and pending:
            t.append(ts)
            pending = False
    return t


def in_reports(events, dev):
    """(ts us, data) of every interrupt-IN packet `dev` completed with data (a clone report)."""
    return [(ts, data) for ts, kind, xt, ep, dn, ln, data in events
            if dn == dev and kind == "C" and xt == 1 and ep & 0x80 and ln]


def rtt_pairs(events, dev, is_reply):
    """(submit->reply, delivered->reply) seconds per control-port round trip on `dev`."""
    rows, sub, done = [], None, None
    for ts, kind, xt, ep, dn, ln, data in events:
        if dn != dev or xt != 3:
            continue
        if not ep & 0x80:
            if kind == "S" and ln:
                sub, done = ts, None
            elif kind == "C" and sub is not None:
                done = ts
        elif kind == "C" and ln and sub is not None and done is not None and is_reply(data):
            rows.append(((ts - sub) / 1e6, (ts - done) / 1e6))
            sub = done = None
    return rows


# ---------------------------------------------------------------------------
# usbfs read-only control transfers (safe: IN GETs only, never SET_ADDRESS)
# ---------------------------------------------------------------------------

USBDEVFS_CONTROL = 0xC0185500
SAFE_GET = {0, 6, 8, 10}  # GET_STATUS, GET_DESCRIPTOR, GET_CONFIGURATION, GET_INTERFACE


class _Ctrl(ctypes.Structure):
    _fields_ = [("bRequestType", ctypes.c_uint8), ("bRequest", ctypes.c_uint8),
                ("wValue", ctypes.c_uint16), ("wIndex", ctypes.c_uint16),
                ("wLength", ctypes.c_uint16), ("timeout", ctypes.c_uint32),
                ("data", ctypes.c_void_p)]


def control_read(node, bRequestType, bRequest, wValue, wIndex, wLength, timeout_ms=1000):
    """One read-only standard GET to a USB device node. Refuses anything that could change state."""
    if not bRequestType & 0x80:
        raise ValueError("refused: only device-to-host (IN) requests are allowed")
    if bRequest not in SAFE_GET:
        raise ValueError(f"refused: bRequest {bRequest} is not a read-only standard GET")
    fd = os.open(node, os.O_RDWR)
    try:
        buf = ctypes.create_string_buffer(wLength)
        ct = _Ctrl(bRequestType, bRequest, wValue, wIndex, wLength, timeout_ms,
                   ctypes.cast(buf, ctypes.c_void_p))
        try:
            n = fcntl.ioctl(fd, USBDEVFS_CONTROL, ct)
        except OSError as e:
            if e.errno == 32:      # EPIPE
                return "STALL"
            if e.errno in (110, 62):  # ETIMEDOUT / ETIME
                return "TIMEOUT"
            return f"ERR {e.errno}"
        return bytes(buf.raw[:n if isinstance(n, int) else wLength])
    finally:
        os.close(fd)


# The read-only requests the EP0 test compares, clone against the native mouse.
EP0_REQUESTS = [
    ("device descriptor", 0x80, 6, 0x0100, 0, 18),
    ("configuration descriptor", 0x80, 6, 0x0200, 0, 255),
    ("string 0 (language ids)", 0x80, 6, 0x0300, 0, 255),
    ("string 1", 0x80, 6, 0x0301, 0x0409, 255),
    ("string 2", 0x80, 6, 0x0302, 0x0409, 255),
    ("string 3", 0x80, 6, 0x0303, 0x0409, 255),
    ("GET_STATUS device", 0x80, 0, 0, 0, 2),
    ("GET_CONFIGURATION", 0x80, 8, 0, 0, 1),
]


def ep0_read_device(dev):
    """Every EP0 request against one USB device directory, plus the report descriptor from sysfs."""
    bus, num = bus_dev(dev)
    node = f"/dev/bus/usb/{bus:03d}/{num:03d}"
    out = []
    for name, bmt, req, wv, wi, wl in EP0_REQUESTS:
        try:
            got = control_read(node, bmt, req, wv, wi, wl)
        except (OSError, ValueError) as e:
            got = f"ERR {e}"
        out.append({"request": name, "value": got.hex() if isinstance(got, (bytes, bytearray)) else got})
    busid = os.path.basename(dev)
    rd = report_descriptor_on(busid)
    out.append({"request": "HID report descriptor (sysfs)", "value": rd.hex() if rd else "none"})
    return out


# ---------------------------------------------------------------------------
# box drivers
# ---------------------------------------------------------------------------

def crc16_ccitt(data):
    crc = 0xFFFF
    for b in data:
        crc ^= b << 8
        for _ in range(8):
            crc = ((crc << 1) ^ 0x1021) & 0xFFFF if crc & 0x8000 else (crc << 1) & 0xFFFF
    return crc


def medius_frame(ty, seq, payload):
    """A Medius control frame, as the public frame format documents it (used only to build the half-frame
    the malformed-input test cuts)."""
    body = bytes([ty, seq]) + len(payload).to_bytes(2, "little") + payload
    return bytes([0xA5]) + body + crc16_ccitt(body).to_bytes(2, "little")


class StockBox:
    """Stock MAKCU firmware over the public `km.` serial API."""
    kind = "stock"
    move_marker = b"km.move"
    reply_marker = b">>> "

    def __init__(self, port, baud):
        self.port, self.baud = port, baud
        self.s = None

    def open(self):
        import serial
        self.s = serial.Serial(self.port, self.baud, timeout=0.05)
        self.s.reset_input_buffer()
        return self

    def close(self):
        if self.s:
            self.s.close()
            self.s = None

    def write(self, data):
        self.s.write(data)

    def send(self, cmd):
        self.s.write(cmd.encode() + b"\r\n")

    def query(self, cmd, timeout=1.0):
        self.s.reset_input_buffer()
        self.send(cmd)
        end = time.monotonic() + timeout
        buf = bytearray()
        while time.monotonic() < end:
            d = self.s.read(64)
            if d:
                buf += d
                if b">>> " in buf:
                    return bytes(buf).split(b">>> ")[0].decode("latin1").strip()
        return None

    def answers_in_step(self):
        """One command behind, stock holds each reply until the next command arrives, so a query answers with
        the reply before it. Ask the echo state then the screen size: in step, the second reply is the screen."""
        self.query("km.echo()", timeout=0.3)
        second = self.query("km.screen()", timeout=0.3) or ""
        return second.startswith("km.screen")

    def firmware(self):
        text = self.query("km.version()", timeout=0.6) or ""
        num = None
        try:
            self.s.reset_input_buffer()
            self.s.write(b"\xde\xad\x00\x00\x04")
            end = time.monotonic() + 0.4
            buf = bytearray()
            while time.monotonic() < end:
                d = self.s.read(64)
                if d:
                    buf += d
                i = buf.find(b"\xde\xad")
                if i >= 0 and len(buf) >= i + 9 and buf[i + 4] == 0x04:
                    num = int.from_bytes(buf[i + 5:i + 9], "little")
                    break
        except Exception:
            pass
        # The name alone: binary frames the box sends unasked can land among the reply's bytes.
        m = re.search(r"MAKCU[!-~]*", text)
        name = m.group(0) if m else "MAKCU"
        return f"{name} ({num})" if num else name

    def move(self, dx, dy, now=False):
        self.send(f"km.{'move_now' if now else 'move'}({dx},{dy})")

    def hold_button(self):
        self.send("km.left(1)")

    def release_button(self):
        self.send("km.left(0)")

    def hold_key(self):
        self.send(f"km.down({KEY_A_HID})")

    def release_key(self):
        self.send(f"km.up({KEY_A_HID})")

    def lock_x(self):
        self.send("km.lock_mx(1)")

    def unlock_x(self):
        self.send("km.lock_mx(0)")

    def lock_x_state(self):
        r = self.query("km.lock_mx()", timeout=0.6)
        return None if r is None else r.strip().endswith("1")

    def keepalive(self, seconds):
        time.sleep(seconds)  # stock needs none; it holds state until told otherwise

    def raw_port(self):
        return _SameSerial(self)

    def rtt_queries(self):
        return [("version", lambda: self.query("km.version()")),
                ("status", lambda: self.query("km.moving()"))]


KEY_A_HID = 4  # HID usage for 'a' on stock's keyboard commands


class _SameSerial:
    """Stock's control port is a plain serial handle, so the malformed test writes to it directly."""
    def __init__(self, box):
        self.box = box

    def __enter__(self):
        return self.box.s

    def __exit__(self, *a):
        return False


class MediusBox:
    """Medius over the public `medius` Python bindings."""
    kind = "medius"
    move_marker = b"\xa5\x01"
    reply_marker = b"\xa5\x06"

    def __init__(self, port, baud=MEDIUS_BAUD):
        self.port, self.baud = port, baud
        self.dev = None
        self._m = None

    def open(self):
        import medius
        self._m = medius
        self.dev = medius.Device.open(self.port)
        return self

    def close(self):
        if self.dev:
            try:
                self.dev.close()
            except Exception:
                pass
            self.dev = None

    def firmware(self):
        try:
            v = self.dev.query_version()
        except self._m.BadProtoVerError:
            raise SystemExit(f"the box speaks another control protocol than medius {self._m.version_string()}: "
                             "install the medius release made for the box's firmware")
        return f"{v.fw_major}.{v.fw_minor}.{v.fw_patch} (proto {v.proto_ver})"

    def _usage_button(self):
        return self._m.Usage.button(self._m.Button.LEFT)

    def _usage_key(self):
        return self._m.Usage.key(self._m.Key.A)

    def _lock_x(self):
        return self._m.LockTarget.x()

    def move(self, dx, dy, now=False):
        (self.dev.move_rel_now if now else self.dev.move_rel)(dx, dy)

    def hold_button(self):
        self.dev.press(self._usage_button())

    def release_button(self):
        self.dev.soft_release(self._usage_button())

    def hold_key(self):
        self.dev.press(self._usage_key())

    def release_key(self):
        self.dev.soft_release(self._usage_key())

    def lock_x(self):
        self.dev.lock(self._lock_x(), self._m.Direction.BOTH)

    def unlock_x(self):
        self.dev.unlock(self._lock_x(), self._m.Direction.BOTH)

    def lock_x_state(self):
        try:
            return self.dev.query_locks().is_locked(self._lock_x(), self._m.Direction.BOTH)
        except Exception:
            return None

    def answers_in_step(self):
        try:
            self.dev.query_health()
            return True
        except Exception:
            return False

    def keepalive(self, seconds):
        # The binding's keepalive thread holds the override; just wait, querying so nothing times out.
        end = time.monotonic() + seconds
        while time.monotonic() < end:
            try:
                self.dev.query_health()
            except Exception:
                pass
            time.sleep(min(0.2, max(0.0, end - time.monotonic())))

    def raw_port(self):
        return _MediusRaw(self)

    def rtt_queries(self):
        return [("version", lambda: self.dev.query_version()),
                ("status", lambda: self.dev.query_health())]


class _MediusRaw:
    """For the malformed test only: close the binding, open the control port raw, reopen the binding after.
    Raw bytes are the test stimulus (a broken frame has no API); the box is driven back through the binding."""
    def __init__(self, box):
        self.box = box

    def __enter__(self):
        import serial
        self.box.close()
        self.s = serial.Serial(self.box.port, self.box.baud, timeout=0.05)
        self.s.reset_input_buffer()
        return self.s

    def __exit__(self, *a):
        self.s.close()
        self.box.open()
        return False


def build_box(kind, port, baud):
    return StockBox(port, baud or STOCK_BAUD) if kind == "stock" else MediusBox(port, baud or MEDIUS_BAUD)


# ---------------------------------------------------------------------------
# the run context: clone, grab, usbmon buses
# ---------------------------------------------------------------------------

class Rig:
    def __init__(self, box, port, clone_busid, clone_dir):
        self.box = box
        self.port = port
        self.clone_busid = clone_busid
        self.clone_dir = clone_dir
        self.clone_bus, self.clone_dev = bus_dev(clone_dir)
        ctrl = tty_usb_device(port)
        self.ctrl_bus, self.ctrl_dev = bus_dev(ctrl) if ctrl else (None, None)
        self.pointer_node = None
        self.key_node = None
        self.caps = []

    def grab(self):
        nodes = input_nodes_on(self.clone_busid)
        for n in nodes:
            if self.pointer_node is None and has_rel_xy(n):
                self.pointer_node = n
            if self.key_node is None and node_has_key(n, KEY_A):
                self.key_node = n
        if not self.pointer_node:
            raise SystemExit(f"the clone on {self.clone_busid} has no pointer node to read")
        self.pointer = InputCap(self.pointer_node, grab=True)
        self.caps.append(self.pointer)
        if self.key_node and self.key_node != self.pointer_node:
            self.keycap = InputCap(self.key_node, grab=True)
            self.caps.append(self.keycap)
        else:
            self.keycap = self.pointer if self.key_node else None

    def ungrab(self):
        for c in self.caps:
            try:
                c.close()
            except Exception:
                pass
        self.caps = []

    def same_bus(self):
        return self.clone_bus is not None and self.clone_bus == self.ctrl_bus


# ---------------------------------------------------------------------------
# tests
# ---------------------------------------------------------------------------

def t_query(rig, n):
    """Query round trip: many version/status queries one at a time, timed on the wire if usbmon is up,
    else on this program's clock. Lines up with the control-link query rows (link-rtt-version-p50 ...)."""
    box = rig.box
    rows = []
    for name, fn in box.rtt_queries():
        fn()  # warm up
        host = []
        mon = Usbmon(rig.ctrl_bus, [rig.ctrl_dev]) if rig.ctrl_bus else None
        if mon:
            mon.__enter__()
        for _ in range(n):
            t0 = mono()
            ok = fn()
            host.append(mono() - t0)
        wire = None
        if mon and mon.ok:
            mon.__exit__()
            events = mon.take()
            pairs = rtt_pairs(events, rig.ctrl_dev, lambda d: box.reply_marker in d)
            wire = {"paired": len(pairs),
                    "submit_to_reply": summary([p[0] * 1e6 for p in pairs]),
                    "delivered_to_reply": summary([p[1] * 1e6 for p in pairs]),
                    "submit_to_reply_samples_us": [round(p[0] * 1e6, 2) for p in pairs]}
        elif mon:
            mon.__exit__()
        rows.append({"id": name, "label": f"{name} query", "n": n,
                     "host": summary([x * 1e6 for x in host]), "wire": wire,
                     "host_samples_us": [round(x * 1e6, 2) for x in host]})
    layer = "wire" if any(r["wire"] for r in rows) else "host"
    return {"about": "Version and status queries, one at a time: the round trip.",
            "layer": layer, "rows": rows}


def _latency_cell(rig, size, now, n, gap):
    box, cap = rig.box, rig.pointer
    mon = None
    if rig.same_bus():
        mon = Usbmon(rig.clone_bus, [rig.ctrl_dev, rig.clone_dev])
        mon.__enter__()
    host_first, host_done, counts = [], [], []
    for _ in range(n):
        cap.clear()
        t0 = mono()
        box.move(size, 0, now=now)
        frames = cap.wait_sum(REL_X, size, 0.5)
        xs = [(t, r.get(REL_X, 0)) for t, r, _ in frames if r.get(REL_X, 0)]
        if xs:
            host_first.append(xs[0][0] - t0)
            acc, done = 0, None
            for t, v in xs:
                acc += v
                if acc >= size:
                    done = t
                    break
            host_done.append((done - t0) if done else None)
            counts.append(len(xs))
        else:
            host_first.append(None)
            host_done.append(None)
            counts.append(0)
        time.sleep(random.uniform(*gap))
    wire = None
    if mon and mon.ok:
        mon.__exit__()
        events = mon.take()
        outs = out_completions(events, rig.ctrl_dev, lambda d: box.move_marker in d)
        reps = in_reports(events, rig.clone_dev)
        lat, j = [], 0
        for i, t0 in enumerate(outs):
            t1 = outs[i + 1] if i + 1 < len(outs) else float("inf")
            while j < len(reps) and reps[j][0] < t0:
                j += 1
            k = j
            hit = None
            while k < len(reps) and reps[k][0] < t1:
                hit = reps[k][0]
                break
            lat.append((hit - t0) / 1e6 if hit else None)
        wire = {"pairs": len(outs), "first_report": summary([x * 1e6 for x in lat if x is not None]),
                "first_report_samples_us": [round(x * 1e6, 2) if x is not None else None for x in lat]}
    elif mon:
        mon.__exit__()
    return {"size": size, "now": now, "n": n,
            "delivered": sum(1 for x in host_first if x is not None),
            "reports_per_move": summary(counts, unit="reports"),
            "host_first": summary([x * 1e6 for x in host_first if x is not None]),
            "host_done": summary([x * 1e6 for x in host_done if x is not None]),
            "wire_first": wire,
            "host_first_samples_us": [round(x * 1e6, 2) if x is not None else None for x in host_first]}


def t_move_latency(rig, n):
    """Move latency into a still mouse: a 1-count default move (through each box's smoothing) and a 1-count
    immediate move (which skips it), command to the first report carrying it. Lines up with inj-latency
    (inj-lat-rest-1, inj-lat-now-rest-1)."""
    rows = [_latency_cell(rig, 1, False, n, (0.03, 0.06)),
            _latency_cell(rig, 1, True, n, (0.03, 0.06))]
    for r in rows:
        r["label"] = ("Immediate move, 1 count" if r["now"] else "Default move, 1 count")
        r["id"] = "now-1" if r["now"] else "default-1"
    layer = "wire" if any(r["wire_first"] for r in rows) else "evdev"
    return {"about": "One-count moves, then immediate ones, into the still mouse: the time to the first report "
                     "carrying each.",
            "layer": layer, "rows": rows}


def t_move_spread(rig, sizes, n):
    """How long a single move takes to arrive whole, and how many reports carry it: n moves of each size into the
    still mouse, default and immediate, 150-250 ms apart. Compares with the smoothing settings (inj-settings)."""
    box, cap = rig.box, rig.pointer
    rows = []
    for size in sizes:
        for now in (False, True):
            last, reports, whole = [], [], 0
            for _ in range(n):
                cap.clear()
                t0 = mono()
                box.move(size, 0, now=now)
                cap.wait_sum(REL_X, size, 1.0)
                time.sleep(0.05)                    # so a count past the move shows too
                xs = [(t, r[REL_X]) for t, r, _ in cap.peek() if r.get(REL_X)]
                acc, done = 0, None
                for t, v in xs:
                    acc += v
                    if done is None and acc >= size:
                        done = t
                last.append((done - t0) * 1e6 if done else None)
                reports.append(len(xs))
                whole += acc == size
                time.sleep(random.uniform(0.15, 0.25))
            rows.append({"id": f"{'now' if now else 'default'}-{size}",
                         "label": f"{'Immediate' if now else 'Default'} move of {size}",
                         "size": size, "now": now, "n": n, "whole": whole,
                         "last_count": summary([x for x in last if x is not None]),
                         "reports": summary(reports, unit="reports"),
                         "last_count_samples_us": [round(x, 1) if x is not None else None for x in last]})
    return {"about": "Moves of 1, 10 and 100 counts, then immediate ones: the time to the last count, and the "
                     "reports carrying it.", "layer": "evdev", "rows": rows}


def t_move_accept(rig, rates, secs, burst):
    """Moves accepted: one-count moves paced at a series of rates, and a burst of moves back to back;
    arrived (the clone's X total) against sent. Lines up with the paced and clumped rows (link-paced-rest,
    link-paced-fast, link-one-write)."""
    box, cap = rig.box, rig.pointer
    rows = []
    for rate in rates:
        cap.clear()
        sent = _pace_moves(box, cap, rate, secs)
        _settle(cap)
        arrived = sum(r.get(REL_X, 0) for _, r, _ in cap.peek())
        rows.append({"id": f"paced-{rate}", "label": f"Paced {rate}/s", "sent": sent,
                     "arrived": arrived, "lost": sent - arrived})
    # Burst. Stock can batch one raw write; the binding sends one frame per call.
    cap.clear()
    if box.kind == "stock":
        with box.raw_port() as s:
            s.write(b"".join(f"km.move(1,0)\r\n".encode() for _ in range(burst)))
    else:
        for _ in range(burst):
            box.move(1, 0)
    _settle(cap)
    arrived = sum(r.get(REL_X, 0) for _, r, _ in cap.peek())
    how = "one write" if box.kind == "stock" else "back to back"
    rows.append({"id": "burst", "label": f"{burst} moves {how}", "sent": burst,
                 "arrived": arrived, "lost": burst - arrived})
    return {"about": "One-count moves paced at each rate for 1 s, then a burst: counts arriving against moves "
                     "sent.", "layer": "evdev", "rows": rows}


def _pace_moves(box, cap, rate, secs):
    """Send one-count moves at `rate`/s in 1 ms batches. A batch then a sleep yields the interpreter lock
    between batches, so the input-reading thread keeps draining and doesn't drop events (the batch keeps
    pacing honest where a per-move busy-wait would starve that thread)."""
    per_ms = rate / 1000.0
    acc = 0.0
    sent = 0
    nxt = mono()
    for _ in range(int(secs * 1000)):
        nxt += 0.001
        acc += per_ms
        k = int(acc)
        acc -= k
        for _ in range(k):
            box.move(1, 0)
            sent += 1
        lead = nxt - mono()
        if lead > 0:
            time.sleep(lead)
    return sent


def _settle(cap, quiet=1.0, cap_s=30.0):
    end = time.monotonic() + cap_s
    last = time.monotonic()
    seen = len(cap.peek())
    while time.monotonic() < end:
        now = len(cap.peek())
        if now != seen:
            seen = now
            last = time.monotonic()
        elif time.monotonic() - last > quiet:
            break
        time.sleep(0.02)


def _malformed_cases(kind):
    """Each case's bytes, written 64 a millisecond (stock's receive path loses longer bursts, which is another
    test), and how long to wait before the check move."""
    rng = random.Random(1)
    garbage = bytes(b for b in (rng.randrange(256) for _ in range(65536 * 2))
                    if b not in (0xDE, 0xA5))[:65536]  # no frame can form by chance
    move = b"km.move(5,0)\r\n" if kind == "stock" else medius_frame(0x01, 0, bytes([0, 5, 0, 0, 0, 0]))
    return [("garbage", garbage, 0.3), ("cut", move[:len(move) // 2], 0.1)]


def _write_paced(s, data, chunk=64):
    nxt = mono()
    for i in range(0, len(data), chunk):
        s.write(data[i:i + chunk])
        nxt += 0.001
        lead = nxt - mono()
        if lead > 0:
            time.sleep(lead)


def t_malformed(rig):
    """Malformed input, then a valid move and a query: does the box act on the bad bytes, and is it still
    answering in step. Lines up with link-malformed. The bad bytes go straight to the control port; the box
    is driven and read back through its normal path."""
    box, cap = rig.box, rig.pointer
    rows = []
    for name, payload, wait in _malformed_cases(box.kind):
        cap.clear()
        with box.raw_port() as s:
            _write_paced(s, payload)
            time.sleep(wait)
        acted = sum(r.get(REL_X, 0) for _, r, _ in cap.peek())
        cap.clear()
        box.move(7, 0, now=True)
        time.sleep(0.5)
        arrived = sum(r.get(REL_X, 0) for _, r, _ in cap.peek())
        rows.append({"id": name, "label": {"garbage": "64 KB of random bytes",
                                            "cut": "Half a move, the check move 100 ms later"}[name],
                     "acted_counts": acted, "valid_move_arrives": arrived >= 7,
                     "in_step_after": box.answers_in_step()})
    return {"about": "Random bytes, then half a move, each followed by a 7-count move: whether it arrives, and "
                     "whether the box still answers each query with its own reply.",
            "layer": "evdev", "rows": rows}


def t_release(rig, hold_s, window_s):
    """Release on exit: hold the left button, a key (if the clone has one) and an X lock through the box,
    then close the port and send nothing, as a program exiting does. Watch for each release and how long
    after. Lines up with recovery-program-exit."""
    box, cap = rig.box, rig.pointer
    rows = []

    # Left button.
    cap.clear()
    box.open() if box.kind == "medius" and box.dev is None else None
    box.hold_button()
    box.keepalive(hold_s)
    held_before = cap.held(BTN_LEFT)
    t_close = mono()
    box.close()
    edge = _wait_release_edge(cap, BTN_LEFT, 0, t_close, window_s)
    rows.append({"id": "button", "label": "Left button",
                 "held_while_connected": held_before,
                 "released": edge is not None,
                 "released_after_close_ms": round((edge - t_close) * 1e3, 1) if edge else None,
                 "held_at_end": cap.held(BTN_LEFT)})
    _reopen(box)
    box.release_button()
    box.keepalive(0.1)

    # Key, only if the clone presents a keyboard.
    if rig.keycap is not None:
        kc = rig.keycap
        kc.clear()
        box.hold_key()
        box.keepalive(hold_s)
        held_before = kc.held(KEY_A)
        t_close = mono()
        box.close()
        edge = _wait_release_edge(kc, KEY_A, 0, t_close, window_s)
        rows.append({"id": "key", "label": "Key 'a'",
                     "held_while_connected": held_before,
                     "released": edge is not None,
                     "released_after_close_ms": round((edge - t_close) * 1e3, 1) if edge else None,
                     "held_at_end": kc.held(KEY_A)})
        _reopen(box)
        box.release_key()
        box.keepalive(0.1)
    else:
        rows.append({"id": "key", "label": "Key 'a'", "skipped": "the clone presents no keyboard"})

    # X lock. With a still mouse there is no native motion to time, so the outcome is read back from the box.
    box.lock_x()
    box.keepalive(hold_s)
    locked_before = box.lock_x_state()
    t_close = mono()
    box.close()
    time.sleep(window_s)
    _reopen(box)
    locked_after = box.lock_x_state()
    rows.append({"id": "lock", "label": "X axis lock",
                 "locked_while_connected": locked_before,
                 "released": locked_after is False,
                 "readback": "locked" if locked_after else ("released" if locked_after is False else "unknown")})
    box.unlock_x()
    box.keepalive(0.1)
    return {"about": "The left button held, a key held and X locked, then the control port closed: whether each "
                     "is released, and when.",
            "layer": "evdev", "rows": rows}


def _wait_release_edge(cap, code, value, after, window_s):
    end = time.monotonic() + window_s
    while time.monotonic() < end:
        for t, _, keys in cap.peek():
            if t > after and any(c == code and v == value for c, v in keys):
                return t
        time.sleep(0.01)
    for t, _, keys in cap.peek():
        if t > after and any(c == code and v == value for c, v in keys):
            return t
    return None


def _reopen(box):
    if box.kind == "medius":
        if box.dev is None:
            box.open()
    else:
        if box.s is None:
            box.open()


def t_ep0(rig, native_arg):
    """Endpoint 0 replies: the standard read-only requests off the clone, then off the same mouse plugged
    straight into this PC, reply bytes and outcome compared. Lines up with devices-endpoint-0."""
    clone = ep0_read_device(rig.clone_dir)
    vid, pid = usb_ids(rig.clone_dir)
    print("\n  ep0: move the mouse from the box's USB3 to this PC.")
    print(f"  Press Enter once it is plugged in (the tool looks for {vid:04x}:{pid:04x}), or type s and Enter to skip.")
    ans = sys.stdin.readline().strip().lower()
    native = None
    native_err = None
    if ans != "s":
        native_dir = None
        if native_arg:
            native_dir = native_arg if native_arg.startswith("/") else os.path.join(SYSFS, native_arg)
        else:
            end = time.monotonic() + 30
            while time.monotonic() < end and native_dir is None:
                for busid in os.listdir(SYSFS):
                    dev = os.path.join(SYSFS, busid)
                    if busid != rig.clone_busid and usb_ids(dev) == (vid, pid):
                        native_dir = dev
                        break
                time.sleep(0.5)
        if native_dir and os.path.exists(os.path.join(native_dir, "idVendor")):
            native = ep0_read_device(native_dir)
        else:
            native_err = "native mouse not found on the PC"
    rows = []
    by_native = {r["request"]: r["value"] for r in (native or [])}
    for r in clone:
        nv = by_native.get(r["request"])
        rows.append({"id": r["request"].split()[0].lower(), "request": r["request"],
                     "clone": r["value"], "native": nv,
                     "match": (nv == r["value"]) if native else None})
    return {"about": "The descriptor and status reads a PC makes at enumeration, to the clone and to the mouse "
                     "on the PC: whether the replies match.", "layer": "outcome",
            "native_read": native is not None, "native_error": native_err, "rows": rows}


# ---------------------------------------------------------------------------
# run orchestration
# ---------------------------------------------------------------------------

# move-accept and malformed can leave stock's parser one command behind until the box is power-cycled, as the
# Control link results show, so they run after every other test that drives the box, and a test that drives it
# only runs while it answers in step. ep0 runs last: it has the mouse moved off the box.
ALL_TESTS = ["query", "move-latency", "move-spread", "release", "move-accept", "malformed", "ep0"]
CONTROL_PORT = {"query", "move-latency", "move-spread", "release", "move-accept", "malformed"}
BEHIND = ("the box answered a query with the reply before it, so it is one command behind: power-cycle it "
          "(unplug every cable) and run again")

_CLEANUP = {"box": None, "rig": None}


def _cleanup():
    box = _CLEANUP["box"]
    if box is not None:
        try:
            _reopen(box)
            if box.kind == "stock":
                box.release_button()
                box.release_key()
                box.unlock_x()
            else:
                try:
                    box.dev.reset()
                except Exception:
                    pass
            time.sleep(0.2)
            box.close()
        except Exception:
            pass
    rig = _CLEANUP["rig"]
    if rig is not None:
        rig.ungrab()


def run(args):
    if os.geteuid() != 0:
        raise SystemExit("run needs root (usbmon, usbfs, grabbing the clone's input nodes)")
    os.system("modprobe usbmon >/dev/null 2>&1")
    want = set(args.tests.split(",")) if args.tests else set(ALL_TESTS)
    if want - set(ALL_TESTS):
        raise SystemExit(f"unknown test {', '.join(sorted(want - set(ALL_TESTS)))}; known: {', '.join(ALL_TESTS)}")
    tests = [t for t in ALL_TESTS if t in want]
    held = port_holders(args.port)
    if held:
        raise SystemExit(f"{args.port} is open in {', '.join(held)}, which would take replies the tool waits for: "
                         "close it, or disconnect the browser tab, first")

    clone_busid, clone_dir = find_clone(args.port, args.clone)
    box = build_box(args.box, args.port, args.baud)
    rig = Rig(box, args.port, clone_busid, clone_dir)
    _CLEANUP["box"], _CLEANUP["rig"] = box, rig
    signal.signal(signal.SIGINT, lambda *a: (_cleanup(), sys.exit(130)))
    signal.signal(signal.SIGTERM, lambda *a: (_cleanup(), sys.exit(143)))

    vid, pid = usb_ids(clone_dir)
    print(f"Box: {args.box}   clone: {clone_busid} {vid:04x}:{pid:04x} "
          f"({read_attr(clone_dir, 'product') or 'unknown'})")
    print("Leave the mouse still. The tool grabs the clone, so nothing it injects reaches your desktop.\n")

    rig.grab()
    box.open()
    out = {
        "tool": "medius-compare", "tool_version": VERSION, "box": args.box,
        "box_firmware": box.firmware(),
        "started": time.strftime("%Y-%m-%dT%H:%M:%S"),
        "host": {"uname": " ".join(os.uname()), "python": sys.version.split()[0]},
        "clone": {"busid": clone_busid, "vid": f"{vid:04x}", "pid": f"{pid:04x}",
                  "product": read_attr(clone_dir, "product")},
        "wire_available": rig.same_bus(),
        "layers": LAYERS,
        "tests": {},
    }
    try:
        for t in tests:
            print(f"- {t} ...", flush=True)
            if t in CONTROL_PORT and not box.answers_in_step():
                out["tests"][t] = {"skipped": BEHIND}
                print(f"  skipped: {BEHIND}", flush=True)
                continue
            if t == "query":
                out["tests"]["query"] = t_query(rig, args.samples)
            elif t == "move-latency":
                out["tests"]["move-latency"] = t_move_latency(rig, max(20, args.samples // 4))
            elif t == "move-spread":
                out["tests"]["move-spread"] = t_move_spread(rig, [1, 10, 100], 10)
            elif t == "move-accept":
                out["tests"]["move-accept"] = t_move_accept(rig, [500, 1000, 2000, 5000], 1.0, 200)
            elif t == "release":
                out["tests"]["release"] = t_release(rig, 0.5, 3.0)
            elif t == "malformed":
                out["tests"]["malformed"] = t_malformed(rig)
            elif t == "ep0":
                out["tests"]["ep0"] = t_ep0(rig, args.native)
        out["in_step_at_end"] = box.answers_in_step()
        if not out["in_step_at_end"]:
            print(f"\nAt the end, {BEHIND}.", flush=True)
    finally:
        _cleanup()
        _CLEANUP["box"], _CLEANUP["rig"] = None, None

    with open(args.out, "w") as f:
        json.dump(out, f, indent=1)
    print(f"\nWrote {args.out}  (box {args.box}, firmware {out['box_firmware']})")


# ---------------------------------------------------------------------------
# report
# ---------------------------------------------------------------------------

def _two_col(label, a, b, width=38):
    return f"  {label:<{width}} {str(a):>16}  {str(b):>16}"


def report(args):
    by_box = {}
    for p in args.files:
        f = json.load(open(p))
        box = f.get("box")
        if f.get("tool") != "medius-compare" or box not in ("stock", "medius"):
            raise SystemExit(f"{p}: not a run this tool wrote")
        if box in by_box:
            raise SystemExit(f"{p}: a second {box} run. Give one run of each box")
        by_box[box] = f
    # A box with no run shows "-" throughout.
    a, b = by_box.get("stock", {}), by_box.get("medius", {})
    print(f"medius-compare report  (tool {a.get('tool_version', '-')} / {b.get('tool_version', '-')})\n")
    print(_two_col("", "Stock", "Medius"))
    print(_two_col("firmware", a.get("box_firmware", "-"), b.get("box_firmware", "-")))
    print(_two_col("clone", _clone_str(a), _clone_str(b)))
    print()

    for name in ALL_TESTS:
        ta, tb = a.get("tests", {}).get(name), b.get("tests", {}).get(name)
        if not ta and not tb:
            continue
        ran = tb if (ta or {}).get("skipped") else (ta or tb)
        print(f"[{name}]  layer: {ran.get('layer', '-')}")
        if ran.get("about"):
            print(f"  {ran['about']}")
        for box, t in (("stock", ta), ("medius", tb)):
            if t and t.get("skipped"):
                print(f"  {box} skipped: {t['skipped']}")
        _report_rows(name, ta, tb)
        print()
    print("The figures depend on the mouse and PC each run used, so they won't match the published ones exactly.")


def _clone_str(f):
    c = f.get("clone")
    return f"{c.get('vid','?')}:{c.get('pid','?')}" if c else "-"


def _rows_by_id(t):
    # ep0's rows share an id per kind of request; its request names each one.
    return {r.get("request", r.get("id", str(i))): r for i, r in enumerate((t or {}).get("rows", []))}


def _report_rows(name, ta, tb):
    ra, rb = _rows_by_id(ta), _rows_by_id(tb)
    ids = list(ra) + [i for i in rb if i not in ra]
    for i in ids:
        x, y = ra.get(i, {}), rb.get(i, {})
        label = x.get("label") or y.get("label") or x.get("request") or y.get("request") or i
        print(_two_col(label, _cell(name, x), _cell(name, y)))


def _cell(name, r):
    if not r:
        return "-"
    if "skipped" in r:
        return "skipped"
    if name == "query":
        w = r.get("wire") or {}
        s = (w.get("submit_to_reply") if w else None) or r.get("host") or {}
        return f"p50 {s.get('p50','?')}{s.get('unit','')}"
    if name == "move-latency":
        s = (r.get("wire_first") or {}).get("first_report") if r.get("wire_first") else r.get("host_first")
        s = s or {}
        return f"p50 {s.get('p50','?')}us x{r.get('reports_per_move',{}).get('p50','?')}"
    if name == "move-spread":
        lc, rp = r.get("last_count") or {}, r.get("reports") or {}
        return f"{lc.get('p50', '?')}us x{rp.get('p50', '?')}"
    if name == "move-accept":
        return f"{r.get('arrived')}/{r.get('sent')}"
    if name == "malformed":
        return f"move {'ok' if r.get('valid_move_arrives') else 'LOST'}, step {'ok' if r.get('in_step_after') else 'NO'}"
    if name == "release":
        if r.get("id") == "lock":
            return r.get("readback", "?")
        if r.get("released"):
            return f"released +{r.get('released_after_close_ms','?')}ms"
        return "still held" if r.get("held_at_end") else "released?"
    if name == "ep0":
        m = r.get("match")
        return "match" if m else ("differs" if m is False else "clone only")
    return str(r)


# ---------------------------------------------------------------------------
# main
# ---------------------------------------------------------------------------

def main():
    ap = argparse.ArgumentParser(
        prog="medius-compare.py",
        description="The Medius comparison's tests that need no USB device emulator: run them on a box, or compare two runs.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="Tests: " + ", ".join(ALL_TESTS))
    sub = ap.add_subparsers(dest="cmd", required=True)

    r = sub.add_parser("run", help="run the tests on one box")
    r.add_argument("--box", required=True, choices=["stock", "medius"])
    r.add_argument("--port", required=True, help="control port, e.g. /dev/serial/by-id/usb-...-if00")
    r.add_argument("--out", required=True, help="where to write this box's JSON")
    r.add_argument("--tests", help="comma list; default is every test (" + ",".join(ALL_TESTS) + ")")
    r.add_argument("--clone", help="the clone's busid (e.g. 3-2.2) or VID:PID; auto-detected if omitted")
    r.add_argument("--native", help="for the ep0 test, the mouse's busid or VID:PID once plugged into the PC; "
                                     "found by its VID:PID if omitted")
    r.add_argument("--baud", type=int, help="control-port baud (default stock 4000000, medius 6000000)")
    r.add_argument("--samples", type=int, default=400, help="query samples (move samples scale from it)")
    r.set_defaults(fn=run)

    p = sub.add_parser("report", help="compare two runs side by side")
    p.add_argument("files", nargs="+", help="the JSON files (stock.json medius.json, any order)")
    p.set_defaults(fn=report)

    args = ap.parse_args()
    args.fn(args)


if __name__ == "__main__":
    main()
