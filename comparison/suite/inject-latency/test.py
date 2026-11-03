"""Move latency: from a move command to the clone's report carrying it, timed on the PC's USB bus (the move's
packet reaching the box's control port to the clone's reports) and on the clone's evdev node.

Scripted 16-bit mice, injection on X, so native motion never reaches the measured axis:
  base    idle (one empty report every 2 s, never moving), moving on Y at 1 kHz (+1/-1), and the same at 125 Hz
  rested  3 s moving on Y at 1 kHz, then silent: a mouse in use that has stopped
Stock won't inject into a device that hasn't reported since it was cloned, so the idle mouse reports now and
then. Medius smooths only once it has seen the mouse move since it was cloned, so its default moves into the
idle mouse go out unsmoothed, and into the rested mouse as a mouse in use gets them.

Per mouse, moves of 1 and 50 counts, default and immediate (stock km.move and km.move_now, Medius MOVE and MOVE
with NOW), 200 each, 30-60 ms after the previous move arrived. Per move: the first report carrying X, the report
completing the move, and how many reports it took. `done_every_move` takes its percentiles over every move sent:
a move not done within 0.5 s counts as slower than any that was (nearest rank, so a percentile that falls on one
reads "unfinished").
"""
import random
import time

from medius_compare import capture, layout, stats, wire
from medius_shapes.scripted import mouse, scripted_mouse

N = 200
GAP_S = (0.03, 0.06)
DXS = (1, 50)
WAIT_S = 0.5
SETTLE_S = 2.0


def moving_1k():
    return scripted_mouse(0x7011, [(1, mouse(0, 1)), (1, mouse(0, -1))])


def moving_125():
    return scripted_mouse(0x7012, [(1, mouse(0, 1)), (1, mouse(0, -1))], interval_us=8000)


def rested():
    return scripted_mouse(0x7013, [(1500, mouse(0, 1)), (1500, mouse(0, -1)), (1, b"")], once=True)


SHAPES = {"moving_1k": moving_1k, "moving_125": moving_125, "rested": rested}
# Per variant, (leg, seconds after the clone is up before the first move). The rested mouse moves for 3 s first.
VARIANTS = {"base": [("idle", 0.5), ("moving_1k", 0.5), ("moving_125", 0.5)], "rested": [("rested", 4.0)]}


def _move(box, dx, dy, now):
    if now and box.kind == "stock":
        box.send(f"km.move_now({dx},{dy})")
    else:
        box.move(dx, dy, now=now)


def _moves(box, cap, dx, now):
    rows = []
    for _ in range(N):
        cap.take()
        t0 = capture.mono()
        _move(box, dx, 0, now)
        fr = cap.wait(lambda f: sum(x[1].get(capture.REL_X, 0) for x in f) >= dx, WAIT_S)
        xs = [(t, r.get(capture.REL_X, 0)) for t, r, _ in fr if r.get(capture.REL_X, 0)]
        if xs:
            acc, done = 0, None
            for t, v in xs:
                acc += v
                if acc >= dx:
                    done = t
                    break
            rows.append({"first": xs[0][0] - t0, "done": (done - t0) if done else None, "reports": len(xs),
                         "sum": sum(v for _, v in xs)})
        else:
            rows.append({"first": None, "done": None, "reports": 0, "sum": 0})
        time.sleep(random.uniform(*GAP_S))
    return rows


def every_move(dones):
    n = len(dones)
    if not n:
        return {"n": 0}
    s = sorted(d for d in dones if d is not None)

    def rank(q):
        k = max(1, -(-q * n // 100)) - 1
        return round(s[k] * 1e6, 2) if k < len(s) else "unfinished"
    return {"n": n, "unfinished": sum(d is None for d in dones), "unit": "us", "p50": rank(50), "p95": rank(95),
            "p99": rank(99)}


def _cell(box, p, cap, shape, dx, now):
    _, ch = wire.resolve(box.port)
    _, cl = wire.resolve(p.usb)
    with wire.Wire([p.usb, box.port]) as w:
        rows = _moves(box, cap, dx, now)
        time.sleep(0.2)
    wrows = wire.move_latency(w.events, box.kind, ch, cl, dx, field=lambda d: layout.field(d, p.layout.x))
    ok = [r for r in rows if r["first"] is not None]
    return {"shape": shape, "dx": dx, "now": now, "delivered": len(ok),
            "exact": sum(1 for r in rows if r["sum"] == dx),
            "first": stats.summary([r["first"] for r in ok]),
            "done": stats.summary([r["done"] for r in ok if r["done"] is not None]),
            "reports": stats.summary([r["reports"] for r in ok], scale=1, unit="reports"),
            "done_every_move": every_move([r["done"] for r in rows]),
            "rows": rows,
            "wire": {"moves": len(wrows), "done_every_move": every_move([r[1] for r in wrows]),
                     "first": stats.summary([r[0] for r in wrows if r[0] is not None]),
                     "done": stats.summary([r[1] for r in wrows if r[1] is not None]),
                     "reports": stats.summary([r[2] for r in wrows if r[0] is not None], scale=1,
                                              unit="reports")}}


def run(ctx):
    box = ctx.box
    out = {}
    for variant, legs in VARIANTS.items():
        cells = []
        for leg, settle in legs:
            p = ctx.device(leg)
            time.sleep(SETTLE_S + settle)
            cap = capture.EvCap(capture.pointer_node(p.nodes))
            try:
                for dx in DXS:
                    for now in (False, True):
                        cell = _cell(box, p, cap, leg, dx, now)
                        cells.append(cell)
                        ctx.log(f"{leg} dx={dx} now={int(now)}: {cell['delivered']}/{N}, wire done p50 "
                                f"{cell['wire']['done'].get('p50')} us")
            finally:
                cap.close()
        out[variant] = {"n": N, "gap_s": list(GAP_S), "cells": cells}
    return out
