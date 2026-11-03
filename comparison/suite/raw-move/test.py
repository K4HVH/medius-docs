"""Stock's move with a receipt (binary RAW_MOVE 0x69) against Medius MOVE with NOW, read off the PC's USB bus.

RAW_MOVE carries an id, a delta and a timeout; the box replies with a state and reason, and RAW_STATUS (0x6A)
reads a result back. Medius has no receipt; its MOVE with NOW is the move that skips smoothing. Legs, one-count
moves:
  rest     40 into the idle mouse (one empty report every 2 s; stock won't inject into a device that hasn't
           reported since it was cloned), 150-250 ms apart
  moving   40 into a mouse reporting every millisecond (Y +1, -1), 150-250 ms apart
  stream   200 into the idle mouse, 5 ms after each command (stock's after its reply), presented again
Per leg: latency from the command's packet reaching the box's control port to the clone report carrying it,
reports per move, the total, and stock's reply and receipt states.

Once a stream of receipted moves has gone unread, stock refuses every later one (reply ff03) until a power cycle,
ordinary moves unaffected. So before its legs the run sends one receipted move, and power-cycles a stock box that
refuses it (`power_cycled_first`).
"""
import random
import struct
import time
from collections import Counter

from medius_compare import frames, layout, stats, wire
from medius_shapes.scripted import mouse, scripted_mouse

SETTLE_S = 2.5
LEGS = [("rest", "rest", 40, (0.15, 0.25)), ("moving", "moving", 40, (0.15, 0.25)),
        ("stream", "rest", 200, (0.005, 0.005))]
_rid = 0


def moving():
    return scripted_mouse(0x7191, [(1, mouse(0, 1)), (1, mouse(0, -1))])


SHAPES = {"moving": moving}


def _next_id():
    global _rid
    _rid = max(_rid + 1, int(time.time()) & 0x3FFFFFFF)
    return _rid


def _head(r):
    if r is None:
        return "none"
    return r.hex() if len(r) <= 2 else r[:2].hex()


def _mak(box, cmd, payload):
    try:
        return box.mak(cmd, payload, timeout=0.1, ff_ok=True)
    except TimeoutError:
        return None


def _is_cmd(kind):
    if kind == "stock":
        return lambda d: d[:2] == b"\xde\xad" and len(d) > 4 and d[4] == 0x69
    return lambda d: len(d) > 1 and d[0] == frames.SOF and d[1] == frames.MOVE


def _leg(box, p, name, n, gap):
    _, ch = wire.resolve(box.port)
    _, cl = wire.resolve(p.usb)
    replies, receipts = Counter(), Counter()
    if box.kind == "stock":
        box.send("km.echo(0)")
    time.sleep(0.3)
    with wire.Wire([p.usb, box.port]) as w:
        for _ in range(n):
            if box.kind == "stock":
                rid = _next_id()
                replies[_head(_mak(box, 0x69, struct.pack("<IhhH", rid, 1, 0, 0)))] += 1
                if name != "stream":
                    time.sleep(0.05)
                    s = _mak(box, 0x6A, struct.pack("<IB", rid, 1))
                    receipts[s[:2].hex() if s else "none"] += 1
            else:
                box.move(1, 0, now=True)
            time.sleep(random.uniform(*gap))
        time.sleep(0.4)
    reps = wire.reports(w.events, cl)
    o = wire.outs(w.events, ch, _is_cmd(box.kind))
    x = p.layout.x
    rows = wire.first_after(o, reps, lambda d: layout.field(d, x) != 0)
    lat = [r[0] for r in rows if r[0] is not None]
    rec = {"leg": name, "sent": n, "packets_seen": len(o),
           "total": sum(layout.field(d, x) for t, d in reps if len(d) >= 3 and o and t >= o[0]),
           "arrived": len(lat), "latency": stats.summary(lat),
           "reports_per_move": stats.summary([r[1] for r in rows], scale=1, unit="reports")}
    if box.kind == "stock":
        rec["reply_heads"], rec["receipt_heads"] = dict(replies), dict(receipts)
    return rec


def _receipts_refused(box):
    return _head(_mak(box, 0x69, struct.pack("<IhhH", _next_id(), 1, 0, 0))) == "ff03"


def run(ctx):
    results, cycled = [], False
    for name, leg, n, gap in LEGS:
        p = ctx.device(leg)
        time.sleep(SETTLE_S)
        if ctx.box_name == "stock" and not results and _receipts_refused(ctx.box):
            ctx.log("stock refuses every receipted move: power cycle first")
            ctx.unjam(force=True)
            cycled = True
            p = ctx.device(leg)
            time.sleep(SETTLE_S)
        r = _leg(ctx.box, p, name, n, gap)
        results.append(r)
        ctx.log(f"{name}: total {r['total']}/{n}, arrived {r['arrived']}, p50 {r['latency'].get('p50')} us")
    return {"results": results, "power_cycled_first": cycled}
