"""Injected left button and 'a' key latency under three loads, read off the PC's USB bus: from the command's
packet reaching the box's control port to the first clone report showing the change.

The device is a mouse (interface 0) beside a boot keyboard (interface 1, an empty report every second).
Per load, 40 rounds of: left press, left release, 'a' down, 'a' up, each 50-250 ms apart.
  rest     the mouse reports once every 2 s
  moving   the mouse reports every millisecond (Y +1, -1)
  stream   moving, and the box also injects a one-count move every millisecond
Stock gets km.left and km.down/km.up, Medius INJECT."""
import random
import struct
import time

from medius_compare import stats, wire
from medius_shapes.core import (EndpointSpec, GEN_FIXED, GEN_SCRIPT, KBD_DESC, Personality, Pump, SPEED_FULL,
                                device_desc, hid, script)
from medius_shapes.scripted import MOUSE_DESC, VID, mouse

N = 40
SETTLE_S = 2.5
INJECT = 0x03
KEY_A = 0x04
LOADS = (("rest", "rest", False), ("moving", "moving", False), ("stream", "moving", True))
EVENTS = (("press", "left", True, 0x81), ("release", "left", False, 0x81),
          ("down", f"key:{KEY_A}", True, 0x82), ("up", f"key:{KEY_A}", False, 0x82))


def mouse_kbd(pid, records):
    """A mouse playing `records` beside a boot keyboard that sends an empty report every second."""
    body = (bytes([9, 4, 0, 0, 1, 3, 1, 2, 0]) + hid(len(MOUSE_DESC)) + bytes([7, 5, 0x81, 3, 8, 0, 1])
            + bytes([9, 4, 1, 0, 1, 3, 1, 1, 0]) + hid(len(KBD_DESC)) + bytes([7, 5, 0x82, 3, 8, 0, 1]))
    total = 9 + len(body)
    cfg = bytes([9, 2, total & 0xFF, total >> 8, 2, 1, 0, 0xA0, 50]) + body
    return Personality(speed=SPEED_FULL, device=device_desc(VID, pid, 1), configs=[cfg],
                       strings=[bytes([4, 3, 9, 4])], hid_report=MOUSE_DESC,
                       endpoints=[EndpointSpec(0x81, 3, 1, 8, 6), EndpointSpec(0x82, 3, 1, 8, 8)],
                       pump=Pump(ep=0x81, interval_us=1000, gen=GEN_SCRIPT), script=script(records),
                       hid_report2=KBD_DESC, rpt2_iface=1, pump2=Pump(ep=0x82, interval_us=1000000, gen=GEN_FIXED))


SHAPES = {
    "rest": lambda: mouse_kbd(0x7160, [(1, mouse(0, 0)), (1999, b"")]),
    "moving": lambda: mouse_kbd(0x7161, [(1, mouse(0, 1)), (1, mouse(0, -1))]),
}

_settled = []


def _present(ctx, leg):
    p = ctx.device(leg)
    if not any(q is p for q in _settled):
        _settled.append(p)
        time.sleep(SETTLE_S)
    return p


def _frames(data):
    i = 0
    while i + 7 <= len(data):
        if data[i] != 0xA5:
            i += 1
            continue
        n = data[i + 3] | data[i + 4] << 8
        yield data[i + 1], bytes(data[i + 5:i + 5 + n])
        i += 7 + n


def _sent(kind, usage, down):
    if kind == "stock":
        if usage == "left":
            text = f"km.left({1 if down else 0})"
        else:
            text = f"km.{'down' if down else 'up'}({int(usage[4:])})"
        return lambda d: text.encode() in d
    cls, ident = (0, 0) if usage == "left" else (1, int(usage[4:]))
    want = struct.pack("<BHB", cls, ident, 1 if down else 0)
    return lambda d: any(t == INJECT and p == want for t, p in _frames(d))


def _shows(name):
    if name == "press":
        return lambda d: d[0] & 1
    if name == "release":
        return lambda d: not d[0] & 1
    if name == "down":
        return lambda d: KEY_A in d[2:8]
    return lambda d: KEY_A not in d[2:8]


def run(ctx):
    box = ctx.box
    results = []
    for load, leg, stream in LOADS:
        p = _present(ctx, leg)
        _, ch = wire.resolve(box.port)
        _, cl = wire.resolve(p.usb)
        plan, t = [], 0.3
        for _ in range(N):
            for ev in EVENTS:
                t += random.uniform(0.05, 0.25)
                plan.append((t, ev))
        time.sleep(0.3)
        try:
            with wire.Wire([p.usb, box.port]) as w:
                t0 = time.monotonic()
                nxt, i = t0, 0
                while i < len(plan):
                    now = time.monotonic()
                    if stream and now >= nxt:
                        box.move(1, 0)
                        nxt += 0.001
                    if now - t0 >= plan[i][0]:
                        _, usage, down, _ = plan[i][1]
                        (box.press if down else box.release)(usage)
                        i += 1
                    if not stream:
                        time.sleep(0.0002)
                time.sleep(0.4)
        finally:
            box.leave()
        for name, usage, down, ep in EVENTS:
            reps = wire.reports(w.events, cl, ep)
            rows = wire.first_after(wire.outs(w.events, ch, _sent(box.kind, usage, down)), reps, _shows(name))
            lat = [r[0] for r in rows if r[0] is not None]
            results.append({"load": load, "event": name, "sent": N, "seen": len(rows), "arrived": len(lat),
                            "latency": stats.summary(lat)})
            ctx.log(f"{load} {name}: {len(lat)}/{N}, p50 {results[-1]['latency'].get('p50')} us")
    return {"results": results}
