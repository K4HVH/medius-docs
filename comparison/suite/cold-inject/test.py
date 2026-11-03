"""Injection into a device that has not reported since it was cloned.

A resting mouse sends nothing, so right after a box clones it the device may never have sent a report. Each try
presents the mouse afresh, so the box clones it again, then asks the box for one immediate 10-count move (stock
km.move_now, Medius MOVE with NOW) and one left click:
  never      the mouse never reports
  once       one empty report as the device starts, then silence
  every_100  one empty report every 100 ms
Three tries per mouse, the mice taken in turn. Per try: whether the move and the click reached the PC within 1 s,
read off the clone's evdev node, and how fast.
"""
import time

from medius_compare import capture
from medius_shapes.scripted import mouse, scripted_mouse

TRIES = 3
BTN_LEFT = 0x110
SETTLE_S = 1.5


def never():
    return scripted_mouse(0x70D0, [(1000, b"")])


def once():
    return scripted_mouse(0x70D1, [(1, mouse(0, 0)), (60000, b"")], once=True)


def every_100():
    return scripted_mouse(0x70D2, [(1, mouse(0, 0)), (99, b"")])


SHAPES = {"never": never, "once": once, "every_100": every_100}
ROWS = {"never": "inj-fresh-click-never", "once": "inj-fresh-click-once", "every_100": "inj-fresh-click-every-100"}


def _try(box, cap, shape, rep):
    time.sleep(0.3)
    cap.take()
    t0 = capture.mono()
    if box.kind == "stock":
        box.send("km.move_now(10,0)")
    else:
        box.move(10, 0, now=True)
    fr = cap.wait(lambda f: sum(x[1].get(capture.REL_X, 0) for x in f) >= 10, 1.0)
    xs = [t for t, r, _ in fr if r.get(capture.REL_X, 0)]
    cap.take()
    t1 = capture.mono()
    box.press("left")
    fr2 = cap.wait(lambda f: any(c == BTN_LEFT for _, _, ks in f for c, v in ks), 1.0)
    box.release("left")
    edges = [t for t, _, ks in fr2 for c, v in ks if c == BTN_LEFT and v == 1]
    time.sleep(0.2)
    return {"shape": shape, "repeat": rep, "move_delivered": sum(x[1].get(capture.REL_X, 0) for x in fr),
            "move_first_ms": round((xs[0] - t0) * 1e3, 2) if xs else None, "click_delivered": bool(edges),
            "click_ms": round((edges[0] - t1) * 1e3, 2) if edges else None}


def clicks(n):
    return "All arrive" if n == TRIES else "All lost" if n == 0 else "Some arrive"


def outcomes(results):
    """Per mouse, how many of its clicks arrived."""
    return {row: clicks(sum(r["click_delivered"] for r in results if r["shape"] == shape))
            for shape, row in ROWS.items()}


def run(ctx):
    box = ctx.box
    got = {shape: [] for shape in SHAPES}
    for rep in range(TRIES):
        for shape in SHAPES:
            p = ctx.device(shape)
            time.sleep(SETTLE_S)
            cap = capture.EvCap(capture.pointer_node(p.nodes))
            try:
                r = _try(box, cap, shape, rep)
            finally:
                cap.close()
            got[shape].append(r)
            ctx.log(f"{shape} try {rep}: move {r['move_delivered']}/10, click {r['click_delivered']}")
    results = [r for shape in SHAPES for r in got[shape]]
    return {"results": results, "outcomes": outcomes(results)}
