"""Endpoint 0: what the box's clone replies to standard, class and vendor requests, against the same device plugged
into the PC (the native sim), and how long each reply takes on the bus.

The device is a scripted 16-bit mouse with manufacturer, product and serial strings, a canned feature report (HID
GET_REPORT, feature report 3) and a canned vendor IN reply (request 0x42). Every other request the sim serves as a
conformant device does (STALL for what it doesn't support). Each request goes to the clone, then to the native sim,
as a raw control transfer through usbfs, with interface 0 taken from its kernel driver. Its outcome (bytes, STALL or
the PC's error) is compared with the reply the device was written to give and with native's, and timed over 200
repeats: in user space (the same overhead on both sides) and on the bus, from the setup's submission to its
completion, off the kernel's USB monitor. Per clone row: its reply against native (`native_match`) and its time on
the bus less native's (`wire_past_native`, and `wire_from_native` without the sign).

Outcome per request group: the native reply when every request in it matched native; otherwise STALL, the only
other reply the table names.
"""
import ctypes
import fcntl
import os
import select
import struct
import time

from medius_compare import stats, wire
from medius_shapes import core, scripted
from medius_shapes.personalities import sim_module

N = 200
SETTLE_S = 2.5
PID = 0x7070
FEATURE = bytes([3, 0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77])
VENDOR = b"vendor-answer-0123456789"
STRINGS = [bytes([4, 3, 0x09, 0x04]), core.sd("Test Lab"), core.sd("Scripted Mouse"), core.sd("SN-000123")]
GROUPS = {"devices-ep0-device-descriptor": (0, 1, 2), "devices-ep0-configuration": (3, 4),
          "devices-ep0-strings": (6, 7, 8, 9), "devices-ep0-absent-descriptors": (5, 10, 11, 12, 13, 14),
          "devices-ep0-report-descriptor": (15,), "devices-ep0-hid-descriptor": (16,),
          "devices-ep0-status": (17, 18, 19, 21, 22), "devices-ep0-feature-report": (23,),
          "devices-ep0-vendor": (28, 29)}

_U = ord("U")
_IOCTL = (3 << 30) | (16 << 16) | (_U << 8) | 18
_GETDRIVER = (1 << 30) | (260 << 16) | (_U << 8) | 8
_DISCONNECT, _CONNECT = (_U << 8) | 22, (_U << 8) | 23


def request_mouse():
    """A still mouse sending one empty report every 2 s, with strings, a feature report and a vendor reply."""
    p = scripted.scripted_mouse(PID, [(1, scripted.mouse(0, 0)), (1999, b"")])
    p.device = core.device_desc(scripted.VID, PID, 1, i_man=1, i_prod=2, i_ser=3)
    p.strings = STRINGS
    p.ctrl = core.ctrl_record(0xA1, 0x01, 0x0303, 0, FEATURE) + core.ctrl_record(0xC0, 0x42, 0, 0, VENDOR)
    return p


SHAPES = {"request_mouse": request_mouse}


def requests(p):
    """(name, bmRequestType, bRequest, wValue, wIndex, wLength or OUT bytes, the written reply: bytes, STALL or None
    where the reply is left to the device)."""
    cfg = p.configs[0]
    return [
        ("GET_DESCRIPTOR device", 0x80, 6, 0x0100, 0, 18, p.device),
        ("GET_DESCRIPTOR device wLength 64", 0x80, 6, 0x0100, 0, 64, p.device),
        ("GET_DESCRIPTOR device wLength 8", 0x80, 6, 0x0100, 0, 8, p.device[:8]),
        ("GET_DESCRIPTOR config 9", 0x80, 6, 0x0200, 0, 9, cfg[:9]),
        ("GET_DESCRIPTOR config full", 0x80, 6, 0x0200, 0, 255, cfg),
        ("GET_DESCRIPTOR config index 1 (absent)", 0x80, 6, 0x0201, 0, 255, "STALL"),
        ("GET_DESCRIPTOR string 0", 0x80, 6, 0x0300, 0, 255, STRINGS[0]),
        ("GET_DESCRIPTOR string 1", 0x80, 6, 0x0301, 0x0409, 255, STRINGS[1]),
        ("GET_DESCRIPTOR string 2", 0x80, 6, 0x0302, 0x0409, 255, STRINGS[2]),
        ("GET_DESCRIPTOR string 3 (serial)", 0x80, 6, 0x0303, 0x0409, 255, STRINGS[3]),
        ("GET_DESCRIPTOR string 9 (absent)", 0x80, 6, 0x0309, 0x0409, 255, "STALL"),
        ("GET_DESCRIPTOR string 0xEE (MS OS)", 0x80, 6, 0x03EE, 0, 255, "STALL"),
        ("GET_DESCRIPTOR device qualifier", 0x80, 6, 0x0600, 0, 10, "STALL"),
        ("GET_DESCRIPTOR other speed config", 0x80, 6, 0x0700, 0, 255, "STALL"),
        ("GET_DESCRIPTOR BOS", 0x80, 6, 0x0F00, 0, 255, "STALL"),
        ("GET_DESCRIPTOR HID report", 0x81, 6, 0x2200, 0, 255, p.hid_report),
        ("GET_DESCRIPTOR HID class", 0x81, 6, 0x2100, 0, 9, cfg[18:27]),
        ("GET_STATUS device", 0x80, 0, 0, 0, 2, bytes([0, 0])),
        ("GET_STATUS interface", 0x81, 0, 0, 0, 2, bytes([0, 0])),
        ("GET_STATUS endpoint 0x81", 0x82, 0, 0, 0x81, 2, bytes([0, 0])),
        ("GET_STATUS endpoint 0x82 (absent)", 0x82, 0, 0, 0x82, 2, "STALL"),
        ("GET_CONFIGURATION", 0x80, 8, 0, 0, 1, bytes([1])),
        ("GET_INTERFACE", 0x81, 10, 0, 0, 1, bytes([0])),
        ("HID GET_REPORT feature 3 (canned)", 0xA1, 1, 0x0303, 0, 8, FEATURE),
        ("HID GET_REPORT feature 5 (none)", 0xA1, 1, 0x0305, 0, 8, "STALL"),
        ("HID GET_REPORT input 0", 0xA1, 1, 0x0100, 0, 6, None),
        ("HID GET_IDLE", 0xA1, 2, 0, 0, 1, None),
        ("HID GET_PROTOCOL", 0xA1, 3, 0, 0, 1, None),
        ("vendor IN 0x42 (canned)", 0xC0, 0x42, 0, 0, 64, VENDOR),
        ("vendor IN 0x43 (unknown)", 0xC0, 0x43, 0, 0, 64, "STALL"),
        ("SET_FEATURE remote wakeup (not declared)", 0x00, 3, 1, 0, b"", None),
        ("CLEAR_FEATURE remote wakeup", 0x00, 1, 1, 0, b"", None),
    ]


def _take(node, iface):
    fd = os.open(node, os.O_RDWR)
    try:
        try:
            drv = fcntl.ioctl(fd, _GETDRIVER, struct.pack("I256s", iface, b""))[4:].split(b"\0", 1)[0]
        except OSError:
            return False
        if drv == b"usbfs":
            return False
        try:
            fcntl.ioctl(fd, _IOCTL, struct.pack("iiP", iface, _DISCONNECT, 0))
            return True
        except OSError:
            return False
    finally:
        os.close(fd)


def _give_back(node, iface):
    try:
        fd = os.open(node, os.O_RDWR)
    except OSError:
        return
    try:
        fcntl.ioctl(fd, _IOCTL, struct.pack("iiP", iface, _CONNECT, 0))
    except OSError:
        pass
    finally:
        os.close(fd)


def _xfer(d, bm, rq, wv, wi, arg, timeout):
    try:
        urb, _buf = d.submit_control(0, bm, rq, wv, wi, arg)
    except OSError as e:
        return (19 if e.errno == 19 else 5), b""
    a, t0 = ctypes.addressof(urb), time.monotonic()
    done = select.poll()
    done.register(d.fd, select.POLLOUT)
    while True:
        try:
            if not done.poll(max(0.0, timeout - (time.monotonic() - t0)) * 1000):
                raise TimeoutError
            addr, st, data = d.reap(timeout=0.0)
        except TimeoutError:
            d.discard(urb)
            try:
                d.reap(timeout=1.0)
            except TimeoutError:
                pass
            return "timeout", b""
        if addr == a:
            break
    if st == 0:
        return 0, data if bm & 0x80 else b""
    return {-32: 32, -75: 75, -19: 19, -108: 19}.get(st, 5), data


def _do(d, bm, rq, wv, wi, arg):
    st, data = _xfer(d, bm, rq, wv, wi, arg, 1.0)
    if st == 0:
        return data
    return "STALL" if st == 32 else f"ERR {110 if st == 'timeout' else st}"


def _node(port):
    with open(f"/sys/bus/usb/devices/{port}/busnum") as f:
        bus = int(f.read())
    with open(f"/sys/bus/usb/devices/{port}/devnum") as f:
        dev = int(f.read())
    return bus, dev, f"/dev/bus/usb/{bus:03d}/{dev:03d}"


def _side(ctx, side, port, p):
    usbfs = sim_module("usbfs")
    bus, dev, node = _node(port)
    taken = _take(node, 0)
    rows = []
    try:
        with usbfs.RawDevice(node) as d:
            try:
                d.claim(0)
            except OSError as e:
                ctx.log(f"{side}: could not claim interface 0: {e}")
            for name, bm, rq, wv, wi, ln, want in requests(p):
                got = _do(d, bm, rq, wv, wi, ln)
                times = []
                with wire.Wire([dev], bus=bus) as w:
                    for _ in range(N):
                        t0 = time.monotonic()
                        _do(d, bm, rq, wv, wi, ln)
                        times.append(time.monotonic() - t0)
                wtimes, sub = [], None
                for e in w.events:
                    if e.xfer != 2:
                        continue
                    if e.kind == "S":
                        sub = e.ts
                    elif sub is not None:
                        wtimes.append((e.ts - sub) / 1e6)
                        sub = None
                r = {"side": side, "request": name, "got": got.hex() if isinstance(got, bytes) else got,
                     "authored": want.hex() if isinstance(want, bytes) else want,
                     "match": None if want is None else got == want, "time": stats.summary(times),
                     "wire": stats.summary(wtimes)}
                rows.append(r)
                ctx.log(f"{side:6} {name:42} match={r['match']!s:5} p50={r['time'].get('p50')} us "
                        f"wire p50={r['wire'].get('p50')} us")
    finally:
        if taken:
            _give_back(node, 0)
    return rows


def outcomes(results):
    clone = [r for r in results if r["side"] == "clone"]
    o = {}
    for rid, idx in GROUPS.items():
        got = [clone[i].get("native_match") for i in idx if i < len(clone)]
        o[rid] = None if len(got) != len(idx) or None in got else ("Native reply" if all(got) else "STALL")
    return o


def run(ctx):
    clone_port = ctx.device("mouse").usb
    native_port = ctx.native("mouse").usb
    time.sleep(SETTLE_S)
    p = request_mouse()
    results = _side(ctx, "clone", clone_port, p) + _side(ctx, "native", native_port, p)
    nat = {r["request"]: r for r in results if r["side"] == "native"}
    for r in results:
        n = nat.get(r["request"])
        if r["side"] == "native" or n is None:
            continue
        r["native_match"] = r["got"] == n["got"]
        if r["wire"].get("n") and n["wire"].get("n"):
            r["wire_past_native"] = round(r["wire"]["p50"] - n["wire"]["p50"], 2)
            r["wire_from_native"] = abs(r["wire_past_native"])
    return {"results": results, "outcomes": outcomes(results)}
