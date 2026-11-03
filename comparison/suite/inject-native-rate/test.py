"""Native report rate while the box injects, second by second.

The scripted mouse reports every millisecond, and plays its next record only once the box has taken the last
one, so a box that reads the device more slowly shows as fewer, still consecutive, reports rather than gaps.
Mice: `count` (Y counts 1 to 200, so each report names itself), `alt` (Y +1/-1 alternately), `const1` and
`const100` (Y +1 or +100 on every report), `sine` (Y from 1 to 10 and back over 200 ms, a hand-like speed curve).

Variants, each a mouse, the rates its command is paced at (0: none sent), for how long, the command, and how
long the capture runs after the commands stop:
  count, alt, const1, const100   0, 1,000, 500 and 125/s, 15 s, move(+1,0)
  sine                           1,000, 500 and 125/s, 15 s, move(+1,0)
  sine_slow                      10 and 30/s, 5 s, move(+1,0), then 3 s
  sine_move0                     1,000/s, 5 s, move(0,0), then 3 s
  sine_query                     100/s, 5 s, a query (stock km.moving() unanswered; Medius QUERY(HEALTH) waiting
                                 for each reply), then 3 s
Recorded per rate:
  per_second   native reports (frames carrying Y) and box-only reports (X without Y) in each second, from evdev
               kernel timestamps; `tail_per_second` the same after the commands stop; `box_only` their sum while
               the commands run
  hidraw_native  native reports read from hidraw while the commands run and 0.5 s after; `seq_gaps` (count only)
               pairs of consecutive native reports that aren't consecutive in the sequence
  sim          the sim's report count and tick over the run (its tick stops while its endpoint is full)
  stock_lag    whether stock's parser was one command behind as the rate started
  x_delivered  X delivered against commands sent; `refused` (stock) the moves it answered with a refusal
Pacing sleeps to within 0.3 ms of each command, then spins, so the capture threads keep running.
"""
import math
import os
import struct
import time

from medius_compare import capture
from medius_shapes.scripted import mouse, scripted_mouse

SEQ = 200
SETTLE_S = 2.5


def count():
    return scripted_mouse(0x7046, [(1, mouse(0, i + 1)) for i in range(SEQ)])


def alt():
    return scripted_mouse(0x7047, [(1, mouse(0, 1)), (1, mouse(0, -1))])


def const1():
    return scripted_mouse(0x704A, [(1, mouse(0, 1))])


def const100():
    return scripted_mouse(0x704B, [(1, mouse(0, 100))])


def sine():
    return scripted_mouse(0x704E, [(1, mouse(0, 1 + round(4.5 + 4.5 * math.sin(2 * math.pi * i / 200))))
                                   for i in range(200)])


SHAPES = {"count": count, "alt": alt, "const1": const1, "const100": const100, "sine": sine}
# variant: (mouse, rates, seconds, command, tail seconds)
VARIANTS = {
    "count": ("count", (0, 1000, 500, 125), 15.0, "move", 0.0),
    "alt": ("alt", (0, 1000, 500, 125), 15.0, "move", 0.0),
    "const1": ("const1", (0, 1000, 500, 125), 15.0, "move", 0.0),
    "const100": ("const100", (0, 1000, 500, 125), 15.0, "move", 0.0),
    "sine": ("sine", (1000, 500, 125), 15.0, "move", 0.0),
    "sine_slow": ("sine", (10, 30), 5.0, "move", 3.0),
    "sine_move0": ("sine", (1000,), 5.0, "move0", 3.0),
    "sine_query": ("sine", (100,), 5.0, "query", 3.0),
}


def _hidraw(nodes):
    return next(n for n in nodes if os.path.basename(n).startswith("hidraw"))


def _step(box, cmd):
    if cmd == "move":
        return lambda: box.move(1, 0)
    if cmd == "move0":
        return lambda: box.move(0, 0)
    if box.kind == "medius":
        return box.device.query_health
    return lambda: box.send("km.moving()")


def _paced(hz, secs, step):
    sent = 0
    if not hz:
        time.sleep(secs)
        return sent
    t_end = capture.mono() + secs
    nxt = capture.mono()
    while nxt < t_end:
        nxt += 1.0 / hz
        step()
        sent += 1
        lead = nxt - capture.mono() - 0.0003
        if lead > 0:
            time.sleep(lead)
        while capture.mono() < nxt:
            pass
    return sent


def _seq_gaps(raws):
    vals = []
    for _, d in raws:
        if len(d) >= 6:
            y = struct.unpack_from("<h", d, 3)[0]
            if y:
                vals.append(y)
    return len(vals), sum(1 for a, b in zip(vals, vals[1:]) if b != a % SEQ + 1)


def _diag(ctx):
    link = ctx.sim()
    try:
        return link.diag()
    finally:
        link.close()


def _seconds(frames, start, n):
    per = []
    for s in range(n):
        win = [f for f in frames if start + s <= f[0] < start + s + 1]
        per.append({"native": sum(1 for _, r, _ in win if r.get(capture.REL_Y)),
                    "box_only": sum(1 for _, r, _ in win if r.get(capture.REL_X) and not r.get(capture.REL_Y))})
    return per


def _rate(ctx, p, shape, hz, secs, cmd, tail):
    box = ctx.box
    rc = capture.RawCap(_hidraw(p.nodes))
    cap = capture.EvCap(capture.pointer_node(p.nodes))
    try:
        time.sleep(1.0)
        lag = box.lagging() if box.kind == "stock" else None
        d0 = _diag(ctx)
        if box.kind == "stock":
            box.drain()
        rc.take()
        cap.take()
        t0 = capture.mono()
        sent = _paced(hz, secs, _step(box, cmd))
        t1 = capture.mono()
        d1 = _diag(ctx)
        time.sleep(0.5 + tail)
        rx = box.drain() if box.kind == "stock" else b""
        frames, raws = cap.take(), rc.take()
    finally:
        rc.close()
        cap.close()
    per = _seconds(frames, t0, int(secs))
    native, gaps = _seq_gaps([x for x in raws if t0 <= x[0] <= t1 + 0.5])
    return {"shape": shape, "hz": hz, "sent": sent, "wall_s": round(t1 - t0, 3),
            "x_delivered": sum(r.get(capture.REL_X, 0) for _, r, _ in frames),
            "per_second": per, "tail_per_second": _seconds(frames, t1, int(tail)),
            "box_only": sum(s["box_only"] for s in per),
            "hidraw_native": native, "seq_gaps": gaps if shape == "count" else None, "stock_lag": lag,
            "refused": rx.count(b"ERR") + rx.count(b"\xde\xad\x01\x00\x18\xff") if box.kind == "stock" else None,
            "sim": {"appends": (d1["appends"] - d0["appends"]) if d0 and d1 else None,
                    "ticks": (d1["pump_tick"] - d0["pump_tick"]) if d0 and d1 else None}}


def run(ctx):
    out = {}
    for variant, (shape, rates, secs, cmd, tail) in VARIANTS.items():
        p = ctx.device(shape)
        time.sleep(SETTLE_S)
        results = []
        for hz in rates:
            r = _rate(ctx, p, shape, hz, secs, cmd, tail)
            results.append(r)
            ctx.log(f"{variant} {hz}/s: native {r['hidraw_native']}, x {r['x_delivered']}/{r['sent']}, "
                    f"box-only {r['box_only']}")
        out[variant] = {"shape": shape, "rates": list(rates), "secs": secs, "cmd": cmd, "tail": tail,
                        "results": results}
    return out
