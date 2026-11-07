"""Delay of each count in a steady stream of moves: each move(+1,0)'s send time against the arrival of the count it
adds on the clone's evdev node, matched one to one in order (every count must arrive for the match to hold).

The mouse is the idle mouse (one empty report every 2 s, never moving): stock won't inject into a device that
hasn't reported since it was cloned. Each box on its default smoothing. One 2 s stream per rate, 1 s apart, and
1.5 s of capture after each.
"""
import time

from medius_compare import capture, stats

RATES = (1000, 500, 250, 125, 60, 30)
SECS = 2.0
SETTLE_S = 2.0


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
            sent = []
            nxt = capture.mono()
            for _ in range(n):
                while capture.mono() < nxt:
                    pass
                sent.append(capture.mono())
                box.move(1, 0)
                nxt += 1.0 / hz
            time.sleep(1.5)
            arr = []
            for t, r, _ in cap.take():
                arr += [t] * max(0, r.get(capture.REL_X, 0))
            lags = [arr[i] - sent[i] for i in range(min(len(arr), len(sent)))]
            r = {"hz": hz, "sent": n, "arrived": len(arr), "lag": stats.summary(lags),
                 "first_pairs_ms": [round(x * 1e3, 2) for x in lags[:12]]}
            results.append(r)
            ctx.log(f"{hz}/s: {len(arr)}/{n} arrived, lag p50 {r['lag'].get('p50')} us")
    finally:
        cap.close()
    return {"now": False, "results": results}
