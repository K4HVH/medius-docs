"""Query round trips timed on the bus: from a query's packet to the box's control port until the reply's packet
back, read off the kernel's USB monitor, so the PC's client and scheduler are not in the figures.

Stock answers km.version() and km.moving() (text, 4 Mbaud); Medius answers QUERY(VERSION) and QUERY(HEALTH)
(framed, 6 Mbaud). Per query: submit to reply (what the PC waits) and delivered to reply (the box and its
USB-serial chip)."""
from medius_compare import stats, wire

N = 3000


def _queries(box):
    if box.kind == "stock":
        return [("km.version()", lambda: box.query("km.version()")), ("km.moving()", lambda: box.query("km.moving()"))]
    return [("QUERY(VERSION)", box.device.query_version), ("QUERY(HEALTH)", box.device.query_health)]


def _is_reply(kind, data):
    return b"\xa5\x06" in data if kind == "medius" else b">>> " in data


def _pair(events, kind, dev):
    """(submit to reply, delivered to reply) per query, in seconds."""
    rows, sub, done = [], None, None
    for e in events:
        if e.dev != dev or e.xfer != 3:
            continue
        if not e.ep & 0x80:
            if e.kind == "S" and e.len:
                sub, done = e.ts, None
            elif e.kind == "C" and sub is not None:
                done = e.ts
        elif e.kind == "C" and e.len and sub is not None and done is not None and _is_reply(kind, e.data):
            rows.append(((e.ts - sub) / 1e6, (e.ts - done) / 1e6))
            sub = done = None
    return rows


def run(ctx):
    ctx.device("rest")
    box = ctx.box
    _, dev = wire.resolve(box.port)
    results = []
    for name, ask in _queries(box):
        ask()
        with wire.Wire([box.port]) as w:
            for _ in range(N):
                ask()
        rows = _pair(w.events, box.kind, dev)
        results.append({"query": name, "sent": N, "paired": len(rows),
                        "submit_to_reply": stats.summary([r[0] for r in rows]),
                        "delivered_to_reply": stats.summary([r[1] for r in rows])})
        ctx.log(f"{name}: paired {len(rows)}/{N}, p50 {results[-1]['submit_to_reply'].get('p50')} us")
    return {"results": results}
