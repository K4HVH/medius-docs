"""Native report latency through the box: from the moment the sim queues a native report to the moment the PC has
the clone's copy of it, every report, on the PC's USB bus.

The sim plays a 16-bit mouse whose Y field counts 1..200 and repeats, so each clone report names the sim's report
counter (its pump tick) it was queued on. The sim queues a report every 1001, 2002, 4004 or 8008 us of its clock,
declaring bInterval 1, 2, 4 or 8. That is a device whose clock runs 1,000 ppm slow against the PC's: the moment a
report is ready slides through the poll that takes it by 1/1000 of the interval each report, so every phase is
measured once every 1,000 reports.

The sim replies on its control link at its 1 ms edges, with the pump tick at that edge. Queries are sent at random
phases, and the USB monitor times each query's OUT and its reply's IN on the clock the clone's reports are timed on:
  edges     the edge that served each reply, counted from its time against the replies before it; a line through
            the replies gives the sim's clock against the PC's (`ppm`)
  placing   an edge comes after every query it replies to was submitted and its bytes crossed the UART. It comes
            before each packet of its reply completed, less the reply's bytes up to that packet. Per 2 s window,
            these two envelopes bound where the edges fall on the PC's clock, and the midpoint is used, within
            +-`band_us` (the widest window; `drift_us` is how far the midpoints moved over the capture)
  reports   the tick count at each edge, read as the reports slide past the edges, pins each report's queue time
            on the sim's clock to a few microseconds (`fit_us`), in 2 s windows. A pump that finds its two-report
            queue full queues nothing that interval, and every later report comes an interval later
            (`intervals_held_back`, read as a lasting shortfall of the count)
Latency per report = its completion on the bus (the clone's interrupt IN) - the moment the sim queued it. The
capture starts once the sim reads no report queued at an edge (`drained_after_s`). The sim pumps from
SET_CONFIGURATION, so reports queued before the first poll stay one poll behind on a host polling at the native
interval, until the sim's slow clock skips a poll.
`device_queue_max` is the most reports the sim ever held unread at an edge: 2 means the box stopped taking the
native reports as fast as the sim made them, and the sim's two-report queue filled. Reports the sim queued behind an
unread one are left out of the figures and counted (`queued_behind`, with three intervals either side). After a poll
the PC skips, the sim keeps its next report whole until its slow clock skips a poll; a real mouse would merge its
motion into the next report instead.
A device plugged straight into the PC waits for the PC's poll instead: on average half a poll interval."""
import collections
import random
import struct
import threading
import time

import numpy as np

from medius_compare import capture, wire
from medius_compare.devices import usb_nodes
from medius_shapes import scripted
from medius_shapes.personalities import sim_module

SEQ = 200
SECS = 24.0
BAUD = 6_000_000
BYTE_US = 10 * 1e6 / BAUD
LEGS = {"1000": (0x7240, 1001), "500": (0x7241, 2002), "250": (0x7242, 4004), "125": (0x7243, 8008)}
WIN_MS = 2000
# The sim reads its tick in the first loop pass after its edge, and queues a report in the first pass after it is
# due: a reply whose edge and report fell in one pass reads either way.
SLACK_US = 2.0
SETTLE_S = 2.5


def _records():
    return [(1, scripted.mouse(0, i + 1)) for i in range(SEQ)]


def _shape(pid, iv):
    return lambda: scripted.scripted_mouse(pid, _records(), interval_us=iv)


SHAPES = {f"slow-clock-mouse-{leg}": _shape(*spec) for leg, spec in LEGS.items()}


def _drained(ctx, secs=15.0):
    """Seconds until the sim reads no report queued at an edge, or None if it never drains. Reports can queue
    before the first poll, and a host polling at the native interval takes one a poll and never catches up until
    the sim's slow clock skips a poll."""
    link = ctx.sim()
    try:
        t0 = time.monotonic()
        while time.monotonic() - t0 < secs:
            d = link.diag()
            if d and d["ring_used"] == 0:
                return round(time.monotonic() - t0, 2)
    finally:
        link.close()
    return None


class _Sampler:
    """Asks the sim for its pump tick at random phases until stopped; the USB monitor keeps the times."""

    def __init__(self, link):
        self.lk = sim_module("link")
        self.link = link
        self.stop = threading.Event()
        self.sent = self.lost = 0
        self.t = threading.Thread(target=self._run, daemon=True)

    def _run(self):
        lk, s, seq = self.lk, self.link.s, 0
        s.reset_input_buffer()
        while not self.stop.is_set():
            seq = (seq + 1) & 0xFF
            s.write(lk.frame(lk.DIAG, seq))
            self.sent += 1
            buf, t0 = b"", time.perf_counter()
            while time.perf_counter() - t0 < 0.02:
                buf += s.read(s.in_waiting or 1)
                got, buf = lk.decode_stream(buf)
                if any(ty == lk.RESP and sq == seq for ty, sq, _ in got):
                    break
            else:
                self.lost += 1
            until = time.perf_counter() + random.uniform(0, 0.0013)
            while time.perf_counter() < until:
                pass

    def __enter__(self):
        self.t.start()
        return self

    def __exit__(self, *a):
        self.stop.set()
        self.t.join(timeout=2)


def _link_samples(events, dev, t0):
    """(query OUT submitted, reply IN done, latest the reply's edge can be, pump tick, ring fill) per DIAG reply,
    times in us from t0. One query is out at a time, so a reply belongs to the last query sent with its sequence
    number. Each byte of a reply crossed the UART after its edge and came in with its packet, so the edge is no
    later than any packet's completion less the reply's bytes up to that packet's last."""
    lk = sim_module("link")
    out, pending, buf, when = [], {}, b"", []
    for e in events:
        if e.dev != dev or e.xfer != 3:
            continue
        if not e.ep & 0x80:
            if e.kind == "S":
                for ty, seq, _ in lk.decode_stream(e.data)[0]:
                    if ty == lk.DIAG:
                        pending[seq] = e.ts - t0
            continue
        if e.kind != "C" or not e.data:
            continue
        if len(e.data) < e.len:
            raise RuntimeError(f"usbmon kept {len(e.data)} of a {e.len}-byte transfer from the sim's link")
        when.extend([e.ts - t0] * len(e.data))
        buf += e.data
        i = 0
        while i + 5 <= len(buf):
            if buf[i] != 0xA5:
                i += 1
                continue
            end = i + 7 + (buf[i + 3] | buf[i + 4] << 8)
            if end > len(buf):
                break
            got = lk.decode_stream(buf[i:end])[0]
            if not got:
                i += 1
                continue
            ty, seq, pl = got[0]
            if ty == lk.RESP and len(pl) >= 22 and seq in pending:
                latest = min(when[i + n] - (n + 1) * BYTE_US for n in range(end - i))
                out.append((pending.pop(seq), when[i], latest, struct.unpack_from("<I", pl, 0)[0], pl[8]))
            i = end
        buf, when = buf[i:], when[i:]
    return out


class _EdgeClock:
    """The sim's edges on the PC's clock: a line through the replies, moved per window of edges to the middle of
    that window's envelopes. usbmon stamps wall time, which the PC's time sync steers, and a reply's delay can drift
    against the PC's frames, so each window's envelopes alone bound its edges."""

    def __init__(self, a0, beta, centres, mids):
        self.a0, self.beta, self.centres, self.mids = a0, beta, centres, mids

    def pc(self, edges):
        edges = np.asarray(edges, dtype=np.float64)
        return self.a0 + self.beta * edges + np.interp(edges, self.centres, self.mids)

    def edges(self, pc_us):
        pc_us = np.asarray(pc_us, dtype=np.float64)
        e = (pc_us - self.a0) / self.beta
        for _ in range(3):
            e = (pc_us - self.a0 - np.interp(e, self.centres, self.mids)) / self.beta
        return e


def _edge_clock(samples):
    """Each reply's edge index, which replies to trust, and the edges on the PC's clock."""
    ts = np.array([s[0] for s in samples])
    tr = np.array([s[1] for s in samples])
    latest = np.array([s[2] for s in samples])
    # Counted against the median of the last replies, not the one before: a reply held up half a millisecond then
    # lands on the wrong edge alone, and is dropped below, instead of shifting every edge after it.
    m = np.zeros(len(tr), dtype=np.int64)
    recent = collections.deque([tr[0]], maxlen=64)
    for j in range(1, len(tr)):
        m[j] = int(round((tr[j] - float(np.median(recent))) / 1000.0))
        recent.append(tr[j] - 1000.0 * m[j])
    use = np.ones(len(m), dtype=bool)
    for _ in range(2):
        beta, a0 = np.polyfit(m[use], tr[use], 1)
        res = tr - (a0 + beta * m)
        use = np.abs(res - np.median(res)) < 300
    # An edge comes after a query it replied to was submitted and its bytes crossed the UART, and no later than
    # `latest`. A reply that could have come from more than one edge is dropped: counted from its time, it can land
    # on the wrong edge and read a tick off. A reply no edge fits is counted separately. Both are found against
    # envelopes over the whole capture, first inside the outermost 0.5%, then again over the replies kept.
    q_off = ts + 7 * BYTE_US - (a0 + beta * m)
    a_off = latest - (a0 + beta * m)
    early, late = np.percentile(q_off, 99.5), np.percentile(a_off, 0.5)
    for _ in range(2):
        first = np.ceil((ts + 7 * BYTE_US - late - a0) / beta)
        last = np.floor((latest - early - a0) / beta)
        keep = (first == m) & (last == m)
        contra = (m < first) | (m > last)
        early, late = np.max(q_off[keep]), np.min(a_off[keep])
    centres, mids, bands = [], [], []
    for c in range(int(m.min()) + WIN_MS // 2, int(m.max()) - WIN_MS // 2 + 1, WIN_MS // 4):
        sel = keep & (np.abs(m - c) <= WIN_MS // 2)
        if sel.sum() < 200:
            continue
        e, l_ = np.max(q_off[sel]), np.min(a_off[sel])
        if l_ < e:
            raise RuntimeError(f"edge envelopes cross by {e - l_:.1f} us in the window at edge {c}")
        centres.append(c)
        mids.append((e + l_) / 2)
        bands.append((l_ - e) / 2)
    if not centres:
        raise RuntimeError("no window of answers to place the edges")
    return m, _EdgeClock(a0, beta, np.array(centres, dtype=np.float64), np.array(mids)), keep, {
        "ppm": round((beta / 1000.0 - 1) * 1e6, 2),
        "band_us": round(float(max(bands)), 1),
        "band_median_us": round(float(np.median(bands)), 1),
        "drift_us": round(float(np.ptp(mids)), 1),
        "answer_delay_p1_p99_us": round(float(np.ptp(np.percentile(res[use], [1, 99]))), 1),
        "answers_ambiguous": int(np.sum(~keep & ~contra)),
        "answers_contradicting": int(np.sum(contra))}


def _tick_fit(m, P, iv):
    """Per window of edges, the tick grid on the sim's clock (us from edge 0): queue(k) = e_c + b (k - k_c). Each
    reply says ticks up to P-1 were queued by its edge and tick P was not, within SLACK_US."""
    fits, widths = [], []
    lo_m, hi_m = int(m.min()), int(m.max())
    bs = iv + np.arange(-0.5, 3.0, 0.001)
    for c in range(lo_m + WIN_MS // 2, hi_m - WIN_MS // 2 + 1, WIN_MS // 4):
        sel = np.abs(m - c) <= WIN_MS // 2
        mm, pp = 1000.0 * m[sel], P[sel].astype(np.float64)
        if len(mm) < 200:
            continue
        kc = float(np.median(pp))
        hi = np.min(mm[None, :] + SLACK_US - bs[:, None] * (pp[None, :] - 1 - kc), axis=1)
        lo = np.max(mm[None, :] - SLACK_US - bs[:, None] * (pp[None, :] - kc), axis=1)
        ok = np.nonzero(hi > lo)[0]
        if not len(ok):
            continue
        i = ok[len(ok) // 2]
        fits.append((c, kc, float(bs[i]), float((hi[i] + lo[i]) / 2)))
        widths.append(float(hi[i] - lo[i]))
    return fits, widths


def _held_back(m, P, iv):
    """The intervals the sim's pump held back: a pump that finds its two-report queue full queues nothing that
    interval and tries again the next, so every later report comes one interval later than its tick says. Found as
    a lasting shortfall of the tick count against one window's grid. Returns the count per reply, and per count the
    first tick it is sure to cover: the next tick at the first reply that shows it."""
    fits, _ = _tick_fit(m, P, iv)
    if not fits:
        return np.zeros(len(m), dtype=np.int64), []
    c, kc, b, ec = fits[0]
    short = np.floor(kc + (1000.0 * m - ec) / b).astype(np.int64) + 1 - P
    # A count read in the loop pass that queued a report can be one off for that reply alone.
    smooth = np.array([np.median(short[max(0, j - 25):j + 26]) for j in range(len(short))])
    held = np.maximum.accumulate(np.round(smooth).astype(np.int64))
    held -= held[0]
    steps = [(int(P[j]), int(held[j])) for j in range(1, len(held)) if held[j] > held[j - 1]]
    return held, steps


def _queue_time(fits, u):
    c, kc, b, ec = min(fits, key=lambda f: abs(f[1] - u))
    return ec + b * (u - kc)


def _behind_spans(m, ring, held_at, iv):
    """Spans of the sim's clock (us) in which it queued a report behind one the box had not read: from an edge that
    read two queued to the next edge that read none, and around each interval the pump held back, widened by three
    intervals each way to take in the reports either side that the edges' sampling leaves an interval out."""
    raw, j = [(q - iv, q + iv) for q in held_at], 0
    while j < len(m):
        if ring[j] < 2:
            j += 1
            continue
        start = 1000.0 * m[j] - iv
        while j < len(m) and ring[j] != 0:
            j += 1
        raw.append((start, 1000.0 * m[j] if j < len(m) else np.inf))
    spans = []
    for lo, hi in sorted((lo - 3 * iv, hi + 3 * iv) for lo, hi in raw):
        if spans and lo <= spans[-1][1]:
            spans[-1] = (spans[-1][0], max(spans[-1][1], hi))
        else:
            spans.append((lo, hi))
    return spans


def _analyse(events, sim_dev, clone, iv):
    t0 = events[0].ts
    samples = _link_samples(events, sim_dev, t0)
    m, ec_map, keep, clock = _edge_clock(samples)
    P = np.array([s[3] for s in samples], dtype=np.int64)
    ring = np.array([s[4] for s in samples], dtype=np.int64)
    queue_max = int(ring.max())
    m, P, ring = m[keep], P[keep], ring[keep]
    held, steps = _held_back(m, P, iv)
    fits, widths = _tick_fit(m, P + held, iv)
    if not fits:
        raise RuntimeError("no window of answers fits a tick grid")
    tried = len(range(int(m.min()) + WIN_MS // 2, int(m.max()) - WIN_MS // 2 + 1, WIN_MS // 4))
    clock.update(answers=len(samples), windows=len(fits), windows_tried=tried, fit_us=round(max(widths) / 2, 2),
                 intervals_held_back=int(held[-1]))
    reach = WIN_MS / 2 * 1000.0 / iv
    k_lo, k_hi = min(f[1] for f in fits) - reach, max(f[1] for f in fits) + reach
    spans = _behind_spans(m, ring, [_queue_time(fits, first + h) for first, h in steps], iv)

    def slot(k):
        return k + max([h for first, h in steps if first <= k], default=0)

    lat, ticks, timed, untimed, behind = [], [], [], [], 0
    for e in events:
        if e.dev != clone or e.kind != "C" or e.xfer != 1 or not e.ep & 0x80 or len(e.data) < 5:
            continue
        y = struct.unpack_from("<h", e.data, 3)[0]
        if not 1 <= y <= SEQ:
            continue
        w = e.ts - t0
        s_us = float(ec_map.edges([w])[0]) * 1000.0
        c, kc, b, ec = min(fits, key=lambda f: abs(f[0] * 1000.0 - s_us))
        if abs(c * 1000.0 - s_us) > WIN_MS * 500.0:
            untimed.append(w)
            continue
        u = int(np.floor(kc + (s_us - ec) / b))
        k = u - max([h for first, h in steps if first + h <= u], default=0)
        k -= (k - (y - 1)) % SEQ
        while _queue_time(fits, slot(k)) > s_us:
            k -= SEQ
        if not k_lo <= slot(k) <= k_hi:
            untimed.append(w)
            continue
        ticks.append(k)
        timed.append(w)
        q = _queue_time(fits, slot(k))
        if any(lo < q < hi for lo, hi in spans):
            behind += 1
            continue
        lat.append(w - float(ec_map.pc([q / 1000.0])[0]))
    ticks = np.array(ticks)
    lat = np.array(lat)
    span = np.arange(ticks.min(), ticks.max() + 1) if len(ticks) else np.array([])
    uniq, counts = np.unique(ticks, return_counts=True)
    # A report left untimed between the first and last timed ones is in the span but not lost.
    inside = sum(1 for x in untimed if timed and timed[0] < x < timed[-1])
    return lat, {"clock": clock, "reports": int(len(ticks)), "queued_behind": behind, "outside_fit": len(untimed),
                 "untimed_inside": inside, "missing": int(len(span) - len(uniq) - inside),
                 "repeated": int(np.sum(counts - 1)), "device_queue_max": queue_max}


def _summary(lat):
    if not len(lat):
        return {}
    q = lambda p: round(float(np.percentile(lat, p)), 1)  # noqa: E731
    edges = np.arange(0, float(np.max(lat)) + 50, 25.0)
    hist, _ = np.histogram(lat, bins=edges)
    return {"min": q(0), "p1": q(1), "p5": q(5), "p50": q(50),
            "mean": round(float(np.mean(lat)), 1), "p95": q(95), "p99": q(99), "p999": q(99.9), "max": q(100),
            "sd": round(float(np.std(lat)), 1), "n": int(len(lat)), "hist_25us": [int(h) for h in hist]}


def _hidraw(nodes):
    for n in nodes:
        if "hidraw" in n:
            return n
    raise RuntimeError("the clone has no hidraw node")


def _leg(ctx, leg):
    _, iv = LEGS[leg]
    p = ctx.device(leg)
    time.sleep(SETTLE_S)
    rc = capture.RawCap(_hidraw(usb_nodes(p.usb)))
    try:
        time.sleep(2.0)
        waited = _drained(ctx)
        link = ctx.sim()
        try:
            _, sim_dev = wire.resolve(link.port)
            _, clone = wire.resolve(p.usb)
            with wire.Wire([p.usb, link.port], keep=256) as w:
                time.sleep(0.2)
                with _Sampler(link) as smp:
                    time.sleep(SECS)
                time.sleep(0.3)
        finally:
            link.close()
        raws = rc.take()
    finally:
        rc.close()
    lat, r = _analyse(w.events, sim_dev, clone, iv)
    r.update(leg=leg, interval_us=iv, drained_after_s=waited, queries=smp.sent, queries_unanswered=smp.lost,
             hidraw_reports=len(raws), latency_us=_summary(lat))
    L, c = r["latency_us"], r["clock"]
    ctx.log(f"{leg}: n={L.get('n')} min={L.get('min')} p50={L.get('p50')} p95={L.get('p95')} max={L.get('max')} us "
            f"| queue_max={r['device_queue_max']} behind={r['queued_behind']} missing={r['missing']} "
            f"repeated={r['repeated']} | ppm={c['ppm']} band=+-{c['band_us']} fit=+-{c['fit_us']}")
    return r


def run(ctx):
    return {"secs": SECS, "results": [_leg(ctx, leg) for leg in LEGS]}
