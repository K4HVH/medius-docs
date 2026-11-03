"""Does injected motion add up? Every move command's counts must reach the PC once: no more, no less.

Each box on its defaults. Mice: `default` runs the idle mouse (one empty report every 2 s, never moving; stock
won't inject into a device that hasn't reported since it was cloned), a mouse moving on Y at 1 kHz (+1/-1), and
the same at 125 Hz with bInterval 8; `moving_var` runs a mouse moving on Y from 1 to 10 counts and back every
200 ms at 1 kHz, a hand-like speed curve. Per mouse, default and immediate moves (stock km.move and km.move_now,
Medius MOVE and MOVE with NOW), each in two patterns:
  sparse  400 move(+1,0) commands 30-60 ms apart
  dense   2,000 move(+1,0) commands paced at 1 kHz
The clone's X is read off its evdev node end to end (2 s after the last command), so any count added, dropped or
reversed shows in the total and the per-report histogram.
"""
import math
import random
import time

from medius_compare import capture
from medius_shapes.scripted import mouse, scripted_mouse

SPARSE_N, DENSE_N = 400, 2000
SETTLE_S = 2.0


def moving_1k():
    return scripted_mouse(0x7061, [(1, mouse(0, 1)), (1, mouse(0, -1))])


def moving_125():
    return scripted_mouse(0x7060, [(1, mouse(0, 1)), (1, mouse(0, -1))], interval_us=8000)


def moving_var():
    return scripted_mouse(0x7063, [(1, mouse(0, 1 + round(4.5 + 4.5 * math.sin(2 * math.pi * i / 200))))
                                   for i in range(200)])


SHAPES = {"moving_1k": moving_1k, "moving_125": moving_125, "moving_var": moving_var}
VARIANTS = {"default": ("idle", "moving_1k", "moving_125"), "moving_var": ("moving_var",)}

# Outcome rows: (variant, result index, rule).
TOTAL_DEFAULT, TOTAL, REVERSED = "total_default", "total", "reversed"
ROWS = {
    "inj-total-rest-spaced": ("default", 0, TOTAL_DEFAULT), "inj-total-rest-1000": ("default", 1, TOTAL_DEFAULT),
    "inj-total-1k-spaced": ("default", 4, TOTAL_DEFAULT), "inj-total-1k-1000": ("default", 5, TOTAL_DEFAULT),
    "inj-total-125-spaced": ("default", 8, TOTAL_DEFAULT), "inj-total-125-1000": ("default", 9, TOTAL_DEFAULT),
    "inj-total-var-spaced": ("moving_var", 0, TOTAL_DEFAULT), "inj-total-var-1000": ("moving_var", 1, TOTAL_DEFAULT),
    "inj-total-now-rest-spaced": ("default", 2, TOTAL), "inj-total-now-rest-1000": ("default", 3, TOTAL),
    "inj-total-now-1k-spaced": ("default", 6, TOTAL), "inj-total-now-1k-1000": ("default", 7, TOTAL),
    "inj-total-now-125-spaced": ("default", 10, TOTAL), "inj-total-now-125-1000": ("default", 11, TOTAL),
    "inj-total-now-var-spaced": ("moving_var", 2, TOTAL), "inj-total-now-var-1000": ("moving_var", 3, TOTAL),
    "inj-reversed-1k": ("default", 4, REVERSED), "inj-reversed-125": ("default", 8, REVERSED),
    "inj-reversed-var": ("moving_var", 0, REVERSED),
}


def _move(box, dx, dy, now):
    if now and box.kind == "stock":
        box.send(f"km.move_now({dx},{dy})")
    else:
        box.move(dx, dy, now=now)


def _leg(box, cap, now, dense):
    n = DENSE_N if dense else SPARSE_N
    time.sleep(0.5)
    cap.take()
    if dense:
        nxt = capture.mono()
        for _ in range(n):
            nxt += 0.001
            _move(box, 1, 0, now)
            while capture.mono() < nxt:
                pass
    else:
        for _ in range(n):
            _move(box, 1, 0, now)
            time.sleep(random.uniform(0.03, 0.06))
    time.sleep(2.0)
    xs = [r.get(capture.REL_X, 0) for _, r, _ in cap.take() if r.get(capture.REL_X, 0)]
    return {"commanded": n, "delivered": sum(xs), "x_reports": len(xs),
            "hist": {str(v): xs.count(v) for v in sorted(set(xs))}}


def total(r, one_short=False):
    off = r["delivered"] - r["commanded"]
    if off == 0:
        return "Exact"
    if off == -1 and one_short:
        return "1 count short"
    return "Counts lost" if off < 0 else "Counts added"


def outcomes(out):
    """Each outcome row's label: a total against the counts sent, or whether any report moved X the wrong way."""
    labels = {}
    for row, (variant, i, rule) in ROWS.items():
        r = out[variant]["results"][i]
        if rule == REVERSED:
            labels[row] = "Some" if any(int(v) < 0 for v in r["hist"]) else "None"
        else:
            labels[row] = total(r, one_short=rule == TOTAL_DEFAULT)
    return labels


def run(ctx):
    box = ctx.box
    out = {}
    for variant, legs in VARIANTS.items():
        results = []
        for leg in legs:
            p = ctx.device(leg)
            time.sleep(SETTLE_S)
            cap = capture.EvCap(capture.pointer_node(p.nodes))
            try:
                for now in (False, True):
                    for dense in (False, True):
                        r = _leg(box, cap, now, dense)
                        r.update(shape=leg, now=now, pattern="dense" if dense else "sparse")
                        results.append(r)
                        ctx.log(f"{leg} now={int(now)} {r['pattern']}: {r['delivered']}/{r['commanded']}")
            finally:
                cap.close()
        out[variant] = {"results": results}
    out["outcomes"] = outcomes(out)
    return out
