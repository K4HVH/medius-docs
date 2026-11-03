"""Injected wheel and horizontal scroll (AC Pan), read off the PC's USB bus.

A scripted mouse declaring a wheel and AC Pan ([buttons][x i16][y i16][wheel i8][pan i8]). Each step sends one
command at a time, 150-250 ms apart: stock km.wheel(n) and km.pan(n), Medius MOVE on the wheel and on pan. Per
step: latency from the command's packet reaching the box's control port to the first clone report carrying it,
the reports it took, the total against what was sent, and stock's ERR replies.
  wheel   +1, +5 and -3, 100 each, into a mouse at rest; +1 100 times into a mouse reporting every millisecond
  pan     +1, 100 times, into a mouse at rest
"""
import random
import struct
import time

from medius_compare import frames, layout, stats, wire
from medius_shapes import scripted

COUNT = 100
SETTLE_S = 2.0
PAN_DESC = scripted.MOUSE_DESC[:-2] + bytes([0x05, 0x0C, 0x0A, 0x38, 0x02, 0x15, 0x81, 0x25, 0x7F, 0x75, 0x08,
                                             0x95, 0x01, 0x81, 0x06]) + scripted.MOUSE_DESC[-2:]


def _rep(dy=0, wheel=0, pan=0):
    return struct.pack("<BhhbB", 0, 0, dy, wheel, pan & 0xFF)


def rest():
    return scripted._one_hid(0x7150, 2, PAN_DESC, 7, [(1, _rep()), (1999, b"")], False, 1000)


def moving():
    return scripted._one_hid(0x7151, 2, PAN_DESC, 7, [(1, _rep(1)), (1, _rep(-1))], False, 1000)


SHAPES = {"rest": rest, "moving": moving}
STEPS = [("wheel", 1, "rest"), ("wheel", 5, "rest"), ("wheel", -3, "rest"), ("pan", 1, "rest"),
         ("wheel", 1, "moving")]
PAN_STEP = 3


def _is_cmd(kind, axis):
    if kind == "stock":
        return lambda d: d.startswith(f"km.{axis}(".encode())
    m = frames.MOTION_WHEEL if axis == "wheel" else frames.MOTION_PAN
    return lambda d: len(d) > 5 and d[0] == frames.SOF and d[1] == frames.MOVE and d[5] == m


def _step(box, p, axis, n):
    _, ch = wire.resolve(box.port)
    _, cl = wire.resolve(p.usb)
    fld = p.layout.wheel if axis == "wheel" else p.layout.pan
    send = box.wheel if axis == "wheel" else box.pan
    if box.kind == "stock":
        box.send("km.echo(0)")
    time.sleep(0.3)
    if box.kind == "stock":
        box.drain()
    with wire.Wire([p.usb, box.port]) as w:
        for _ in range(COUNT):
            send(n)
            time.sleep(random.uniform(0.15, 0.25))
        time.sleep(0.3)
    rx = box.drain().decode("latin1") if box.kind == "stock" else ""
    reps = wire.reports(w.events, cl)
    o = wire.outs(w.events, ch, _is_cmd(box.kind, axis))
    rows = wire.first_after(o, reps, lambda d: layout.field(d, fld) != 0)
    lat = [r[0] for r in rows if r[0] is not None]
    return {"axis": axis, "n": n, "sent": COUNT, "packets_seen": len(o),
            "total": sum(layout.field(d, fld) for t, d in reps if o and t >= o[0]), "wanted": n * COUNT,
            "arrived": len(lat), "latency": stats.summary(lat),
            "reports_per_command": stats.summary([r[1] for r in rows], scale=1, unit="reports"),
            "errors_from_box": rx.count("ERR")}


def pan_outcome(r):
    if r["arrived"] == r["sent"]:
        return "Arrives"
    return "Refused" if r["errors_from_box"] else "Lost"


def run(ctx):
    results = []
    for axis, n, leg in STEPS:
        p = ctx.device(leg)
        time.sleep(SETTLE_S)
        r = _step(ctx.box, p, axis, n)
        r["mouse"] = leg
        results.append(r)
        ctx.log(f"{axis} {n:+d} {leg}: total {r['total']}/{r['wanted']}, arrived {r['arrived']}, p50 "
                f"{r['latency'].get('p50')} us, ERR {r['errors_from_box']}")
    return {"results": results, "outcomes": {"inj-pan-arrives": pan_outcome(results[PAN_STEP])}}
