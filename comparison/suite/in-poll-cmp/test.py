"""How often the real device's IN endpoints are polled through the box, against the same device plugged into the PC.

A device polled by a PC answers each poll; a silent one NAKs it, and the sim counts those NAKs per interrupt IN
endpoint. Each device is presented on the box's sim and on the native sim (the sim lent to the PC hub), and each
endpoint is read the same way on the clone and on the native device, or left unread:
  vendor  a vendor interface's silent interrupt IN declaring 1, 4 and 8 ms, read through usbfs with four transfers
          queued as a driver keeps one polled, then left unread
  hid     a vendor-page HID interface's silent interrupt IN declaring 1, 4 and 8 ms, read through its hidraw node
          (which makes the HID driver poll it), then closed (the driver stops)
Each window is 2 s, starting 0.5 s after the reading starts or stops, and gives polls per second. Read: the polls
through the box match within 2% (and 2.5/s) of native. Unread: none, on either side.
  move    a vendor interrupt IN streaming a counter, which a SET_INTERFACE moves to another address (0x82 <-> 0x83):
          40 single switches, then 40 runs each of two and of three switches back to back, read only where each
          run ends. The worst and median first packet at the new address, through the box and native; a match is
          within 30 ms of the native worst."""
import glob
import os
import struct
import time

from medius_compare.devices import LegUnavailable
from medius_shapes import core
from medius_shapes.personalities import sim_module

WINDOW = 2.0
SETTLE = 0.5
SLACK = 2.5
INTERVALS = (1, 4, 8)
MOVE_PID = 0x62B0
MOVE_SWITCHES = 40
MOVE_MARGIN = 30.0
MOVE_TIMEOUT = 0.2
USBDEVFS_SETINTERFACE = (2 << 30) | (8 << 16) | (ord("U") << 8) | 4
_KEEP = []


def vendor_device(pid, interval):
    """A mouse beside a vendor interface whose interrupt IN declares `interval` ms and never sends."""
    body = core.MOUSE_IF + core.itf(1, 1, 0xFF) + core.ep(0x82, 64, interval)
    return core.personality(pid, core.cfg(2, body),
                            [core.EndpointSpec(0x81, 3, 1, 8, 3), core.EndpointSpec(0x82, 3, 1, 64, 64)])


def hid_device(pid, interval):
    """A mouse beside a vendor-page HID interface whose interrupt IN declares `interval` ms and never sends."""
    body = core.MOUSE_IF + core.itf(1, 1, 3) + core.hid(len(core.VEND8_DESC)) + core.ep(0x82, 8, interval)
    return core.personality(pid, core.cfg(2, body),
                            [core.EndpointSpec(0x81, 3, 1, 8, 3), core.EndpointSpec(0x82, 3, 1, 8, 8)],
                            hid_report2=core.VEND8_DESC, rpt2_iface=1)


def move_device():
    """A mouse beside a vendor interface whose interrupt IN streams a counter at 1 kHz: on 0x82 in alternate
    setting 0, on 0x83 in 1, the same stream."""
    body = (core.MOUSE_IF + core.itf(1, 1, 0xFF) + core.ep(0x82, 8, 1) + core.itf(1, 1, 0xFF, alt=1)
            + core.ep(0x83, 8, 1))
    return core.personality(MOVE_PID, core.cfg(2, body),
                            [core.EndpointSpec(0x81, 3, 1, 8, 3), core.EndpointSpec(0x82, 3, 1, 8, 8),
                             core.EndpointSpec(0x83, 3, 1, 8, 8, alt=1)],
                            pump=core.Pump(0x82, 1000, core.GEN_COUNTER), alt_model=1)


SHAPES = {"move-in": move_device}
SHAPES.update({f"vendor-in-{iv}ms": (lambda iv: lambda: vendor_device(0x6290 + iv, iv))(iv) for iv in INTERVALS})
SHAPES.update({f"hid-in-{iv}ms": (lambda iv: lambda: hid_device(0x62A0 + iv, iv))(iv) for iv in INTERVALS})


def _node(usb):
    def read(name):
        with open(f"/sys/bus/usb/devices/{usb}/{name}") as f:
            return int(f.read())
    return f"/dev/bus/usb/{read('busnum'):03d}/{read('devnum'):03d}"


def _diag(ctx, on):
    link = ctx.sim(on)
    try:
        return link.diag() or {}
    finally:
        link.close()


def _naks(ctx, ep):
    """(when asked, NAKs so far) on each sim: the reply waits out the serial read's timeout, so it is timed from the
    asking."""
    out = []
    for on in (None, "native"):
        t = time.monotonic()
        out.append((t, _diag(ctx, on).get("naks", [0] * 8)[ep & 0x0F]))
    return out


def _window(ctx, ep):
    a = _naks(ctx, ep)
    time.sleep(WINDOW)
    b = _naks(ctx, ep)
    return tuple(round((nb - na) / (tb - ta), 1) for (ta, na), (tb, nb) in zip(a, b))


def _judge(rows, label, read, got):
    box, native = got
    if read:
        good = native > 0 and abs(box - native) <= max(SLACK, 0.02 * native)
    else:
        good = box == 0 and native == 0
    rows.append({"case": label, "read": read, "box": box, "native": native, "match": bool(good)})


def _missing(rows, labels, why):
    rows.extend({"case": label, "error": why} for label in labels)


def _pair(ctx, leg):
    """(clone's USB port, native device's USB port); the clone's is None if it did not come up."""
    native = ctx.native(leg).usb
    try:
        return ctx.device(leg).usb, native, None
    except LegUnavailable as e:
        return None, native, str(e)


def _vendor(ctx, rows):
    for iv in INTERVALS:
        labels = [f"vendor {iv} ms, unread", f"vendor {iv} ms, read", f"vendor {iv} ms, unread again"]
        clone, native, why = _pair(ctx, f"vendor-{iv}ms")
        if clone is None:
            _missing(rows, labels, why)
            continue
        devs = [sim_module("usbfs").RawDevice(_node(u)) for u in (clone, native)]
        try:
            for d in devs:
                d.claim(1)
            time.sleep(SETTLE)
            _judge(rows, labels[0], False, _window(ctx, 0x82))
            urbs = [[d.submit_in(0x82, 64) for _ in range(4)] for d in devs]
            time.sleep(SETTLE)
            _judge(rows, labels[1], True, _window(ctx, 0x82))
            for d, us in zip(devs, urbs):
                for u, _ in us:
                    d.discard(u)
                for _ in us:
                    try:
                        d.reap(timeout=1.0)
                    except TimeoutError:
                        pass
            _KEEP.extend(urbs)
            time.sleep(SETTLE)
            _judge(rows, labels[2], False, _window(ctx, 0x82))
        finally:
            for d in devs:
                d.close()


def _hidraw(usb, iface):
    nodes = glob.glob(f"/sys/bus/usb/devices/{usb}:1.{iface}/*/hidraw/hidraw*")
    return f"/dev/{os.path.basename(nodes[0])}" if nodes else None


def _hid(ctx, rows):
    for iv in INTERVALS:
        labels = [f"hid {iv} ms, unread", f"hid {iv} ms, read", f"hid {iv} ms, closed again"]
        clone, native, why = _pair(ctx, f"hid-{iv}ms")
        if clone is None:
            _missing(rows, labels, why)
            continue
        time.sleep(SETTLE)
        _judge(rows, labels[0], False, _window(ctx, 0x82))
        paths = [_hidraw(u, 1) for u in (clone, native)]
        if None in paths:
            _missing(rows, labels[1:], f"no hidraw node: {paths}")
            continue
        fds = [os.open(p, os.O_RDONLY | os.O_NONBLOCK) for p in paths]
        try:
            time.sleep(SETTLE)
            _judge(rows, labels[1], True, _window(ctx, 0x82))
        finally:
            for fd in fds:
                os.close(fd)
        time.sleep(SETTLE)
        _judge(rows, labels[2], False, _window(ctx, 0x82))


def _first_packet_ms(d, ep):
    """Milliseconds from submitting a read on `ep` to the first packet arriving, or the whole timeout if none comes."""
    u, b = d.submit_in(ep, 8)
    t = time.monotonic()
    while True:
        left = MOVE_TIMEOUT - (time.monotonic() - t)
        if left <= 0:
            d.discard(u)
            try:
                d.reap(timeout=0.5)
            except TimeoutError:
                _KEEP.append((u, b))
            return MOVE_TIMEOUT * 1000
        try:
            d.reap(timeout=left)
            return (time.monotonic() - t) * 1000
        except TimeoutError:
            pass


def _set_interface(d, iface, alt):
    import fcntl
    fcntl.ioctl(d.fd, USBDEVFS_SETINTERFACE, struct.pack("<II", iface, alt))


def _move_latencies(usb, hops):
    """First-packet latency (ms) after each of MOVE_SWITCHES runs of `hops` back-to-back SET_INTERFACEs, each
    moving the stream 0x82 <-> 0x83, read at the address the run ends on."""
    d = sim_module("usbfs").RawDevice(_node(usb))
    ep, cur, lat = {0: 0x82, 1: 0x83}, 0, []
    try:
        d.claim(1)
        _first_packet_ms(d, ep[cur])
        for _ in range(MOVE_SWITCHES):
            for _ in range(hops):
                cur ^= 1
                _set_interface(d, 1, cur)
            lat.append(_first_packet_ms(d, ep[cur]))
    finally:
        d.close()
    return lat


def _moves(ctx, rows):
    clone, native, why = _pair(ctx, "move")
    for hops, what in ((1, "one switch"), (2, "two switches"), (3, "three switches")):
        nat = _move_latencies(native, hops)
        if max(nat) >= MOVE_TIMEOUT * 1000:
            raise RuntimeError("the native device did not deliver after a SET_INTERFACE")
        row = {"case": f"move, {what}", "hops": hops, "unit": "ms",
               "native_max": round(max(nat), 1), "native_median": round(sorted(nat)[len(nat) // 2], 1)}
        try:
            if clone is None:
                raise OSError(why)
            got = _move_latencies(clone, hops)
        except OSError as e:
            row.update(box_max=None, box_median=None, past_native_ms=None, match=False, box_error=str(e))
        else:
            row.update(box_max=round(max(got), 1), box_median=round(sorted(got)[len(got) // 2], 1))
            row["past_native_ms"] = round(row["box_max"] - row["native_max"], 1)
            row["match"] = row["box_max"] <= row["native_max"] + MOVE_MARGIN
        rows.append(row)


def _polling(group):
    if any("error" in r for r in group):
        return "Polled at another rate"
    unread, read = (group[0], group[2]), group[1]
    if not all(r["match"] for r in unread):
        return "Polled while unread"
    return "Native polling" if read["match"] else "Polled at another rate"


def _outcomes(rows):
    out = {}
    for k, name in enumerate(f"{kind}-{iv}ms" for kind in ("vendor", "hid") for iv in INTERVALS):
        out[f"pass-polls-{name}"] = _polling(rows[3 * k:3 * k + 3])
    for k, n in enumerate(("one", "two", "three")):
        out[f"pass-polls-move-{n}"] = "≤30 ms after native" if rows[18 + k].get("match") else ">30 ms after native"
    return out


def run(ctx):
    builds = [_diag(ctx, on).get("build") for on in (None, "native")]
    if None in builds or builds[0] != builds[1]:
        raise RuntimeError(f"the sims run different builds ({builds}): flash both with one build")
    if "naks" not in _diag(ctx, None):
        raise RuntimeError("the sims' DIAG carries no NAK counts: flash a sim with them")
    rows = []
    _vendor(ctx, rows)
    _hid(ctx, rows)
    _moves(ctx, rows)
    for r in rows:
        ctx.log(str(r))
    return {"window_s": WINDOW, "unit": "polls/s", "rows": rows,
            "summary": {"cases": len(rows), "same": sum(bool(r.get("match")) for r in rows)},
            "outcomes": _outcomes(rows)}
