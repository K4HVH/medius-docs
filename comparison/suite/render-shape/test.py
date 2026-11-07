"""What each smoothing setting does to a move, read off the PC's USB bus: every report the clone emits, bytes and
time, against the move's packet reaching the box's control port.

Settings, each set in turn and the box's own put back after: stock interpolation AUTO (its default), 0, 25, 50
and 100; Medius render DESPIKED (its default), OFF, STOCK, UNSMOOTHED, DESPIKED with full rendering, and OFF with
spread 0. Per setting, on a scripted 16-bit mouse (injection on X, native motion on Y):
  single   moves of 1, 10 and 100 counts into a mouse at rest, 40 each, 150-250 ms apart
  stream   one-count moves at 1,000/s and 125/s for 2 s, mouse at rest
  moving   100 one-count moves 150-250 ms apart (past stock's longest payout, ~73 ms) into a mouse reporting
           every millisecond (Y +1/-1)
The mouse at rest is the idle mouse in `base` (one empty report every 2 s, never moving) and the rested mouse
in `rested` (3 s moving on Y first, then silent). Medius smooths only once it has seen the mouse move since it
was cloned, so into the idle mouse every render setting reads as render OFF. `rested` has single and stream only.
Per cell: latency to the first and last count, reports carrying X per move, the X each report carries, reports
with no X while the box pays a move out, and the total.
"""
import random
import time

from medius_compare import layout, stats, wire
from medius_shapes.scripted import mouse, scripted_mouse

SETTLE_S = 2.0
WINDOW_US = 140000
SETTINGS = {
    "stock": [("interpolation AUTO", {"interp": 255}), ("interpolation 0", {"interp": 0}),
              ("interpolation 25", {"interp": 25}), ("interpolation 50", {"interp": 50}),
              ("interpolation 100", {"interp": 100})],
    "medius": [("render DESPIKED", {"render": "despiked", "full": False, "spread": 100}),
               ("render OFF", {"render": "off", "full": False, "spread": 100}),
               ("render STOCK", {"render": "stock", "full": False, "spread": 100}),
               ("render UNSMOOTHED", {"render": "unsmoothed", "full": False, "spread": 100}),
               ("render DESPIKED, full", {"render": "despiked", "full": True, "spread": 100}),
               ("render OFF, spread 0", {"render": "off", "full": False, "spread": 0})],
}


def rested():
    return scripted_mouse(0x7112, [(1500, mouse(0, 1)), (1500, mouse(0, -1)), (1, b"")], once=True)


def moving():
    return scripted_mouse(0x7111, [(1, mouse(0, 1)), (1, mouse(0, -1))])


SHAPES = {"rested": rested, "moving": moving}


def _shape_of(rep, t_outs, window_us):
    rows, xs_all, empty = [], [], 0
    for i, t0 in enumerate(t_outs):
        t1 = min(t_outs[i + 1] if i + 1 < len(t_outs) else t0 + window_us, t0 + window_us)
        mine = [(t, x) for t, x in rep if t0 <= t < t1]
        withx = [(t, x) for t, x in mine if x]
        if withx:
            last = withx[-1][0]
            empty += sum(1 for t, x in mine if not x and t <= last)
        xs_all += [x for _, x in withx]
        rows.append(((withx[0][0] - t0) / 1e6 if withx else None, (withx[-1][0] - t0) / 1e6 if withx else None,
                     len(withx), sum(x for _, x in withx)))
    return rows, xs_all, empty


def _hist(xs):
    h = {}
    for x in xs:
        k = str(x) if abs(x) < 4 else ("4+" if x > 0 else "-4-")
        h[k] = h.get(k, 0) + 1
    return dict(sorted(h.items(), key=lambda kv: kv[0]))


class _Clone:
    def __init__(self, box, p):
        self.box, self.usb = box, p.usb
        _, self.ch = wire.resolve(box.port)
        _, self.cl = wire.resolve(p.usb)
        self.x = p.layout.x

    def capture(self):
        return wire.Wire([self.usb, self.box.port])

    def reports(self, events):
        return [(t, layout.field(d, self.x)) for t, d in wire.reports(events, self.cl) if len(d) >= 3]

    def outs(self, events):
        return wire.outs(events, self.ch, lambda d: wire.is_move(self.box.kind, d))


def _at_rest(c):
    cells = []
    for dx in (1, 10, 100):
        with c.capture() as w:
            for _ in range(40):
                c.box.move(dx, 0)
                time.sleep(random.uniform(0.15, 0.25))
            time.sleep(0.3)
        rows, xs, empty = _shape_of(c.reports(w.events), c.outs(w.events), WINDOW_US)
        cells.append(("single", dx, rows, xs, empty, dx * len(rows)))
    for hz in (1000, 125):
        with c.capture() as w:
            n, nxt = int(2 * hz), time.monotonic()
            for _ in range(n):
                c.box.move(1, 0)
                nxt += 1.0 / hz
                while time.monotonic() < nxt:
                    pass
            time.sleep(0.3)
        rep, o = c.reports(w.events), c.outs(w.events)
        t_end = (o[-1] if o else 0) + 120000
        win = [(t, x) for t, x in rep if o and o[0] <= t < t_end]
        xs = [x for _, x in win if x]
        last = max((t for t, x in win if x), default=0)
        cells.append(("stream", hz, [(None, (last - o[-1]) / 1e6 if o and last else None, len(xs), sum(xs))], xs,
                      sum(1 for t, x in win if not x and t <= last), n))
    return cells


def _moving(c):
    with c.capture() as w:
        for _ in range(100):
            c.box.move(1, 0)
            time.sleep(random.uniform(0.15, 0.25))
        time.sleep(0.5)
    rows, xs, _ = _shape_of(c.reports(w.events), c.outs(w.events), WINDOW_US)
    return ("moving", 1, rows, xs, None, 100)


def _cell(name, part, arg, rows, xs, empty, want):
    ok = [r for r in rows if r[0] is not None]
    return {"setting": name, "part": part, "arg": arg, "moves": len(rows), "total": sum(r[3] for r in rows),
            "wanted": want, "first": stats.summary([r[0] for r in ok]),
            "last": stats.summary([r[1] for r in rows if r[1] is not None]),
            "reports_per_move": stats.summary([r[2] for r in rows], scale=1, unit="reports"),
            "x_hist": _hist(xs), "empty_in_payout": empty}


def _leg(ctx, leg, settle):
    p = ctx.device(leg)
    time.sleep(SETTLE_S + settle)
    return _Clone(ctx.box, p)


def run(ctx):
    box = ctx.box
    plan = SETTINGS[box.kind]
    keys = sorted({k for _, s in plan for k in s})
    now = box.settings()
    before = {k: now[k] for k in keys}
    out = {"base": {"cells": []}, "rested": {"cells": []}}
    try:
        for name, setting in plan:
            box.apply(setting)
            time.sleep(0.5)
            for cell in _at_rest(_leg(ctx, "idle", 0.5)):
                out["base"]["cells"].append(_cell(name, *cell))
            out["base"]["cells"].append(_cell(name, *_moving(_leg(ctx, "moving", 1.5))))
            for cell in _at_rest(_leg(ctx, "rested", 4.0)):
                out["rested"]["cells"].append(_cell(name, *cell))
            ctx.log(f"{name}: single 1 last p50 base {out['base']['cells'][-6]['last'].get('p50')} us, rested "
                    f"{out['rested']['cells'][-5]['last'].get('p50')} us")
    finally:
        box.apply(before)
    return out
