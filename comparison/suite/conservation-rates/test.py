"""Whether injected motion adds up when moves come at a steady rate below 1 kHz.

move(+1,0) paced at 500, 250, 125, 60 and 30/s for 4 s into the idle mouse (one empty report every 2 s, never
moving), each box on its defaults, then 5 s more of capture: the clone's X total on its evdev node against the
moves sent."""
import time

from medius_compare import capture

RATES = (500, 250, 125, 60, 30)
SECS = 4.0
SETTLE_S = 2.0
ROWS = {f"inj-total-rate-{hz}": i for i, hz in enumerate(RATES)}


def total(r):
    off = r["delivered"] - r["commanded"]
    return "Exact" if off == 0 else "Counts lost" if off < 0 else "Counts added"


def outcomes(out):
    return {row: total(out["results"][i]) for row, i in ROWS.items()}


def run(ctx):
    box = ctx.box
    p = ctx.device("idle")
    time.sleep(SETTLE_S)
    cap = capture.EvCap(capture.pointer_node(p.nodes))
    results = []
    try:
        for hz in RATES:
            time.sleep(1.0)
            cap.take()
            n = int(hz * SECS)
            nxt = capture.mono()
            for _ in range(n):
                while capture.mono() < nxt:
                    pass
                box.move(1, 0)
                nxt += 1.0 / hz
            time.sleep(5.0)
            xs = [r.get(capture.REL_X, 0) for _, r, _ in cap.take() if r.get(capture.REL_X, 0)]
            results.append({"hz": hz, "commanded": n, "delivered": sum(xs), "x_reports": len(xs),
                            "hist": {str(v): xs.count(v) for v in sorted(set(xs))}})
            ctx.log(f"{hz}/s: {sum(xs)}/{n}")
    finally:
        cap.close()
    out = {"now": False, "results": results}
    out["outcomes"] = outcomes(out)
    return out
