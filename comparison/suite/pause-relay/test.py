"""IN endpoints the PC stops reading for a while: does the PC still get every report the real device would have kept
for it, and how old is the first one it gets after a pause?

Natively only the PC polls the real device, and a report the PC hasn't taken stays in the real device. The sim's IN
ring holds two reports and its counter stops while the ring is full, so a PC that pauses loses nothing, and the
first report it reads after a pause carries the next counter value. A box polls the real device itself. If it polls
ahead of the PC it holds a queue, and once that queue is full it loses reports the real device would have kept.

Legs:
  interrupt  A counter every millisecond on a vendor-page HID interface's interrupt IN (0x82, the sim's first
             pump) and a vendor interface's interrupt IN (0x83, its second), 8-byte packets, beside a silent mouse.
             The PC takes both interfaces from their kernel drivers and reads them through usbfs, one transfer per
             report with eight queued, so an endpoint is polled every frame while a batch is open and never
             between batches. The schedule: 5000 back to back from when the clone is up, then 40 batches of 50
             with pauses of 0, 5, 20, 100 and 1000 ms after them in turn, then 1000 back to back. Both endpoints
             start each batch together.
  bulk       A vendor bulk IN (0x83, 64-byte packets) beside a silent mouse, the sim queuing a packet every 20 us,
             faster than full speed carries them, so the bus sets the pace. Read through usbfs in transfers of 64
             packets with four queued: 20000 back to back, 40 batches of 200 with the same pauses, then 8 batches
             of 2500 back to back.
Medius runs with imperfect clones allowed: it clones a vendor bulk endpoint only then.

Per endpoint:
- Counter steps between consecutive packets. The counter is 8 bits. A step of 1 is the next report; 0 a repeat;
  2 to 192 means that many less one were skipped; 193 to 255 reads as out of order (it went back). A loss of more
  than 191 at once is therefore counted as out of order, or not seen at all if it is a multiple of 256. sim_made
  settles it. Every packet must also be full length, every byte one more than the last.
- sim_made: reports the sim made over the leg, from its DIAG counters (32 bits, no wrap), against reports the PC
  read. Natively made_not_read is about 0: the two reports in the ring when reading starts make up for the two it
  holds at the end.
- Per batch after a pause, `step` is the counter step from the last report before the pause to the first one after.
  For interrupt endpoints, `elapsed` is the report periods between those two reads, and `stale` is elapsed less
  step: how many periods before its read the first report was made, if the real device counted without stopping.
  Natively the step is 1 and stale is about the pause, since the real device stopped counting while it held two
  reports. A box that polls the real device through the pause shows a larger step, the reports between lost. For
  pauses of 100 ms and over, the sim's DIAG is read 5 ms into the pause and again 15 ms before it ends.
  `made_during` is the reports the sim made between those reads; natively none, the ring being full. For the sim's
  first pump only, `made_ahead_at_start` is how many it had made past the last one the PC read, 5 ms into the pause
  (natively 2, its ring; counted modulo 256).
- Per phase: reports read, rate, and for interrupt endpoints `frames_without_report` (batch duration in frames less
  the reports it read; natively about 0).
- Medius's drop counters across each leg.
A clone that comes up without an endpoint is recorded as such."""
import ctypes
import os
import time

from medius_shapes import personalities as shapes
from medius_shapes.personalities import sim_module

FORWARD_MAX = 192
IN_DEPTH = 8
BULK_URB = 64
BULK_DEPTH = 4
TIMEOUT_PER_PACKET = 0.002
DIAG_MIN_PAUSE_MS = 100
DIAG_AFTER_S = 0.005
DIAG_LEAD_S = 0.015
SETTLE_S = 0.3
STAT_KEYS = ("tx_drops", "relay_drops", "host_rx_drops", "link_rx_drops")
PAUSES_MS = (0, 5, 20, 100, 1000)
PAUSE_BATCHES = 40
INT_SCHEDULE = ([(5000, 0, "settle")]
                + [(50, PAUSES_MS[k % len(PAUSES_MS)], "pause") for k in range(PAUSE_BATCHES)]
                + [(1000, 0, "steady")])
BULK_SCHEDULE = ([(20000, 0, "settle")]
                 + [(200, PAUSES_MS[k % len(PAUSES_MS)], "pause") for k in range(PAUSE_BATCHES)]
                 + [(2500, 0, "steady")] * 8)
INT_PID, BULK_PID = 0x7360, 0x7361
TYPES = {0: "control", 1: "iso", 2: "bulk", 3: "interrupt"}


def _own(p, pid):
    d = bytearray(p.device)
    d[10:12] = pid.to_bytes(2, "little")
    p.device = bytes(d)
    return p


def counter_device():
    """A silent mouse beside a vendor-page HID interface and a vendor interface, each streaming a counter every
    millisecond on an 8-byte interrupt IN."""
    return _own(shapes.counter_personality(), INT_PID)


def bulk_counter_device():
    """A silent mouse beside a vendor bulk IN streaming a counter as fast as the bus takes it."""
    return _own(shapes.bulk_counter_personality(), BULK_PID)


SHAPES = {"counter-device": counter_device, "bulk-counter-device": bulk_counter_device}


def _sys(usb, name):
    with open(f"/sys/bus/usb/devices/{usb}/{name}") as f:
        return f.read().strip()


def _put(path, text):
    with open(path, "w") as f:
        f.write(text)


def _endpoints(usb):
    with open(f"/sys/bus/usb/devices/{usb}/descriptors", "rb") as f:
        blob = f.read()
    return _parse_endpoints(blob, int(_sys(usb, "bConfigurationValue") or 0))


def _parse_endpoints(blob, active):
    """Every endpoint configuration `active` declares, from the device's descriptors: the first declaration of
    each."""
    eps, i = {}, 18
    while i + 4 <= len(blob):
        total = blob[i + 2] | blob[i + 3] << 8
        cfg = blob[i:i + total]
        if total < 9 or cfg[5] != active:
            i += max(total, 9)
            continue
        j, intf, alt = 0, None, None
        while j + 2 <= len(cfg) and cfg[j] >= 2:
            ln, ty = cfg[j], cfg[j + 1]
            if ty == 4 and ln >= 9:
                intf, alt = cfg[j + 2], cfg[j + 3]
            elif ty == 5 and ln >= 7 and intf is not None:
                eps.setdefault(cfg[j + 2], {"present": True, "interface": intf, "alt": alt,
                                            "type": TYPES[cfg[j + 3] & 3],
                                            "mps": (cfg[j + 4] | cfg[j + 5] << 8) & 0x7FF, "bInterval": cfg[j + 6]})
            j += ln
        break
    return eps


def _open_clone(usb, want):
    """Take the interfaces holding the endpoints in `want` from their kernel drivers and claim them through usbfs.
    Returns (device or None, {"0xNN": what the clone declares, or present False}, interfaces unbound, error)."""
    try:
        eps = _endpoints(usb)
    except OSError as e:
        return None, {}, [], f"reading the configuration: {e}"
    info = {f"0x{ep:02x}": eps.get(ep, {"present": False}) for ep in want}
    ifaces = sorted({eps[ep]["interface"] for ep in want if ep in eps})
    if not ifaces:
        return None, info, [], None
    cfg = _sys(usb, "bConfigurationValue")
    unbound = []
    for i in ifaces:
        name = f"{usb}:{cfg}.{i}"
        drv = f"/sys/bus/usb/devices/{name}/driver"
        if os.path.exists(drv):
            d = os.path.basename(os.path.realpath(drv))
            _put(f"/sys/bus/usb/drivers/{d}/unbind", name)
            unbound.append((d, name))
    try:
        raw = sim_module("usbfs").RawDevice(f"/dev/bus/usb/{int(_sys(usb, 'busnum')):03d}/"
                                            f"{int(_sys(usb, 'devnum')):03d}")
    except OSError as e:
        return None, info, unbound, f"opening the clone: {e}"
    for i in ifaces:
        try:
            raw.claim(i)
        except OSError as e:
            raw.close()
            return None, info, unbound, f"claiming interface {i}: {e}"
    return raw, info, unbound, None


def _give_back(unbound):
    for d, name in unbound:
        try:
            _put(f"/sys/bus/usb/drivers/{d}/bind", name)
        except OSError:
            pass


def _stats(box):
    if box.kind != "medius":
        return None
    try:
        s = box.device.query_stats()
    except Exception:
        return None
    return {k: getattr(s, k) for k in STAT_KEYS}


def _stat_delta(a, b):
    if not a or not b:
        return None
    return {k: b[k] - a[k] for k in STAT_KEYS}


def _diag(sim):
    """The sim's report counters: pump_tick (the first pump's reports made) and appends (both pumps'), with the
    time read."""
    try:
        d = sim.diag()
    except Exception:
        return None
    return None if d is None else {"pump_tick": d["pump_tick"], "appends": d["appends"], "t": time.monotonic()}


def _made(pump, a, b):
    """Reports the sim's pump 1 or 2 made between DIAG reads a and b; None if a read is missing or the counters
    started again between them (a bus reset)."""
    if not a or not b or b["pump_tick"] < a["pump_tick"] or b["appends"] < a["appends"]:
        return None
    dt, da = b["pump_tick"] - a["pump_tick"], b["appends"] - a["appends"]
    return dt if pump == 1 else da - dt


def _wait_until(t):
    left = t - time.monotonic()
    if left > 0:
        time.sleep(left)


class _Stream:
    """One IN endpoint read to the schedule: every packet with its batch and the time its transfer was reaped."""

    def __init__(self, name, ep, xfer, pkt, buf_pkt, per_urb, depth, pump):
        self.name, self.ep, self.xfer, self.pkt = name, ep, xfer, pkt
        self.buf_pkt, self.per_urb, self.depth, self.pump = buf_pkt, per_urb, depth, pump
        self.pkts = []
        self.batches = []
        self.zlps = 0
        self.error = None
        self.got = self.asked = self.inflight = 0
        self.t_first = self.t_last = None


class _Reader:
    """Reads the streams of one usbfs handle in batches, every stream starting each batch together."""

    def __init__(self, raw, streams):
        self.raw, self.streams, self.live = raw, streams, {}

    def _submit(self, s, n):
        try:
            u, b = self.raw.submit_in(s.ep, n * s.buf_pkt, s.xfer)
        except OSError as e:
            s.error = f"submit: {e}"
            return
        self.live[ctypes.addressof(u)] = (s, u, b, n)
        s.inflight += 1
        s.asked += n

    def _take(self, s, k, t, data):
        if s.t_first is None:
            s.t_first = t
        s.t_last = t
        for i in range(0, len(data), s.pkt):
            s.pkts.append((k, t, data[i:i + s.pkt]))
            s.got += 1

    def batch(self, k, n, timeout):
        run = [s for s in self.streams if s.error is None]
        t_open = time.monotonic()
        for s in run:
            s.got, s.t_first, s.t_last = 0, None, None
        end = t_open + timeout
        while True:
            for s in run:
                while s.error is None and s.inflight < s.depth and s.got + s.asked < n:
                    self._submit(s, min(s.per_urb, n - s.got - s.asked))
            if all(s.error is not None or s.got >= n for s in run):
                break
            left = end - time.monotonic()
            if left <= 0:
                for s in run:
                    if s.error is None and s.got < n:
                        s.error = f"batch {k}: {s.got} of {n} in {timeout:.1f} s"
                break
            try:
                addr, status, data = self.raw.reap(timeout=min(left, 0.25))
            except TimeoutError:
                continue
            except OSError as e:
                for s in run:
                    s.error = s.error or f"batch {k}: {e}"
                break
            t = time.monotonic()
            ent = self.live.pop(addr, None)
            if ent is None:
                continue
            s, _, _, asked = ent
            s.inflight -= 1
            s.asked -= asked
            if status != 0:
                s.error = s.error or f"batch {k}: URB status {status}"
            elif not data:
                s.zlps += 1
            else:
                self._take(s, k, t, data)
        self.cancel(k)
        for s in run:
            s.batches.append((t_open, s.t_first, s.t_last, s.got))

    def cancel(self, k):
        """Discard what a failed stream left queued; anything those transfers did carry still counts as read."""
        for _, u, _, _ in list(self.live.values()):
            self.raw.discard(u)
        end = time.monotonic() + 1.0
        while self.live and time.monotonic() < end:
            try:
                addr, _, data = self.raw.reap(timeout=0.2)
            except (TimeoutError, OSError):
                break
            ent = self.live.pop(addr, None)
            if ent is not None:
                s = ent[0]
                s.inflight -= 1
                s.asked -= ent[3]
                if data:
                    self._take(s, k, time.monotonic(), data)

    def run(self, schedule, sim):
        """Every batch in turn, each pause slept out after it; the sim's DIAG read at both ends of the long ones."""
        pauses = {}
        for k, (n, pause, _) in enumerate(schedule):
            if all(s.error is not None for s in self.streams):
                break
            self.batch(k, n, n * TIMEOUT_PER_PACKET + 2.0)
            t_end = time.monotonic()
            if not pause:
                continue
            rec = {}
            if pause >= DIAG_MIN_PAUSE_MS:
                _wait_until(t_end + DIAG_AFTER_S)
                rec["a"] = _diag(sim)
                _wait_until(t_end + pause / 1000.0 - DIAG_LEAD_S)
                rec["b"] = _diag(sim)
            _wait_until(t_end + pause / 1000.0)
            pauses[k] = rec
        return pauses


def _steps(vals):
    """Steps between consecutive 8-bit counter values: next, repeated, skipped (reports), out of order."""
    out = {"repeated": 0, "skipped": 0, "skip_runs": 0, "out_of_order": 0}
    odd = []
    for i in range(1, len(vals)):
        u = (vals[i] - vals[i - 1]) & 0xFF
        if u == 1:
            continue
        if u == 0:
            out["repeated"] += 1
        elif u <= FORWARD_MAX:
            out["skipped"] += u - 1
            out["skip_runs"] += 1
        else:
            out["out_of_order"] += 1
        odd.append([i, vals[i - 1], vals[i]])
    out["first_odd"] = odd[:8]
    return out


def _analyse(s, schedule, pauses, d0, d1, period_ms):
    vals = [p[0] for _, _, p in s.pkts if p]
    whole = sum(1 for _, _, p in s.pkts
                if len(p) == s.pkt and all(p[i] == (p[0] + i) & 0xFF for i in range(len(p))))
    r = {"name": s.name, "present": True, "read": len(s.pkts),
         "asked": sum(n for n, _, _ in schedule[:len(s.batches)]), "not_whole": len(s.pkts) - whole,
         "zero_length": s.zlps, "error": s.error, **_steps(vals)}
    m = _made(s.pump, d0, d1)
    r["sim_made"] = m
    r["made_not_read"] = None if m is None else m - len(s.pkts)

    by = [[] for _ in s.batches]
    for k, t, p in s.pkts:
        if p and k < len(by):
            by[k].append((t, p[0]))

    phases = {}
    for k, (t_open, t_first, t_last, got) in enumerate(s.batches):
        phase = schedule[k][2]
        ph = phases.setdefault(phase, {"batches": 0, "read": 0, "secs": 0.0, "repeated": 0, "skipped": 0,
                                       "out_of_order": 0, "frames_without_report": 0 if period_ms else None})
        ph["batches"] += 1
        ph["read"] += got
        if t_last is not None:
            ph["secs"] += t_last - t_open
        st = _steps([v for _, v in by[k]])
        for key in ("repeated", "skipped", "out_of_order"):
            ph[key] += st[key]
        if period_ms and t_first is not None and got > 1:
            ph["frames_without_report"] += max(0, round((t_last - t_first) * 1000 / period_ms) - (got - 1))
    for ph in phases.values():
        ph["per_second"] = round(ph["read"] / ph["secs"], 1) if ph["secs"] else None
        if s.pkt >= 64:
            ph["bytes_per_second"] = round(ph["read"] * s.pkt / ph["secs"]) if ph["secs"] else None
        ph["secs"] = round(ph["secs"], 3)
    r["phases"] = phases

    trans = []
    for k in range(1, len(s.batches)):
        if schedule[k - 1][2] != "pause" or not by[k - 1] or not by[k]:
            continue
        (tp, vprev), (t0, v0) = by[k - 1][-1], by[k][0]
        u = (v0 - vprev) & 0xFF
        step = u if u <= FORWARD_MAX else u - 256
        rec = {"batch": k, "pause_ms": schedule[k - 1][1], "gap_ms": round((t0 - tp) * 1000, 1), "step": step,
               "skipped_after": _steps([v for _, v in by[k]])["skipped"]}
        if period_ms:
            rec["elapsed"] = round((t0 - tp) * 1000 / period_ms)
            rec["stale"] = rec["elapsed"] - step if step > 0 else None
        pz = pauses.get(k - 1) or {}
        a, b = pz.get("a"), pz.get("b")
        if a and b:
            rec["window_ms"] = round((b["t"] - a["t"]) * 1000, 1)
            rec["made_during"] = _made(s.pump, a, b)
        if a and s.pump == 1:
            rec["made_ahead_at_start"] = (a["pump_tick"] - 1 - vprev) & 0xFF
        if rec.get("made_during") is not None and rec["made_during"] + rec.get("made_ahead_at_start", 0) >= FORWARD_MAX:
            rec["step_ambiguous"] = True
        trans.append(rec)
    r["after_pause"] = trans

    summary = {}
    for rec in trans:
        g = summary.setdefault(rec["pause_ms"], {"batches": 0, "steps": {}, "stale": [], "skipped_after": 0,
                                                 "made_during_max": None})
        g["batches"] += 1
        g["steps"][rec["step"]] = g["steps"].get(rec["step"], 0) + 1
        if rec.get("stale") is not None:
            g["stale"].append(rec["stale"])
        g["skipped_after"] += rec["skipped_after"]
        if rec.get("made_during") is not None:
            g["made_during_max"] = max(g["made_during_max"] or 0, rec["made_during"])
    for g in summary.values():
        st = sorted(g.pop("stale"))
        g["stale_median"] = st[len(st) // 2] if st else None
        g["stale_max"] = st[-1] if st else None
        g["steps"] = {str(k): v for k, v in g["steps"].items()}
    r["by_pause"] = {str(p): summary[p] for p in sorted(summary)}
    return r


def _read_leg(ctx, usb, specs, schedule, per_urb, depth, period_ms):
    """specs: (name, endpoint, native packet size, sim pump 1 or 2). Returns ({ep: clone's endpoint}, {ep: result})."""
    usbfs = sim_module("usbfs")
    raw, info, unbound, err = _open_clone(usb, [ep for _, ep, _, _ in specs])
    out = {f"0x{ep:02x}": {"name": name, "present": False} for name, ep, _, _ in specs
           if not info.get(f"0x{ep:02x}", {}).get("present")}
    if raw is None:
        _give_back(unbound)
        return info, {"error": err or "the clone exposes none of these endpoints", **out}
    streams, sim, d0, d1, pauses = [], None, None, None, {}
    try:
        for name, ep, pkt, pump in specs:
            d = info[f"0x{ep:02x}"]
            if d.get("present"):
                xfer = usbfs.TYPE_BULK if d["type"] == "bulk" else usbfs.TYPE_INTERRUPT
                streams.append(_Stream(name, ep, xfer, pkt, max(pkt, d["mps"]), per_urb, depth, pump))
        reader = _Reader(raw, streams)
        sim = ctx.sim()
        sim.s.timeout = 0.005
        d0 = _diag(sim)
        pauses = reader.run(schedule, sim)
        time.sleep(0.05)
        d1 = _diag(sim)
    except OSError as e:
        out["error"] = str(e)
    finally:
        raw.close()
        if sim is not None:
            sim.close()
        _give_back(unbound)
    for s in streams:
        out[f"0x{s.ep:02x}"] = _analyse(s, schedule, pauses, d0, d1, period_ms)
    return info, out


def _interrupt_leg(ctx):
    rec = {"leg": "interrupt"}
    if ctx.box_name == "medius":
        rec["imperfect_optin"] = ctx.box.device.query_imperfect().allowed
    st0 = _stats(ctx.box)
    usb = ctx.device("interrupt").usb
    time.sleep(SETTLE_S)
    rec["cloned"] = True
    rec["clone_endpoints"], rec["endpoints"] = _read_leg(
        ctx, usb, [("vendor-page HID", shapes.COUNTER_HID_EP, shapes.COUNTER_PKT, 1),
                   ("vendor", shapes.COUNTER_VEND_EP, shapes.COUNTER_PKT, 2)], INT_SCHEDULE, 1, IN_DEPTH, 1.0)
    if ctx.box_name == "medius":
        rec["medius_counters"] = _stat_delta(st0, _stats(ctx.box))
    return rec


def _bulk_leg(ctx):
    rec = {"leg": "bulk"}
    if ctx.box_name == "medius":
        rec["imperfect_optin"] = ctx.box.device.query_imperfect().allowed
    st0 = _stats(ctx.box)
    usb = ctx.device("bulk").usb
    time.sleep(SETTLE_S)
    rec["cloned"] = True
    rec["clone_endpoints"], rec["endpoints"] = _read_leg(
        ctx, usb, [("vendor bulk", shapes.BULK_COUNTER_EP, shapes.BULK_COUNTER_PKT, 1)], BULK_SCHEDULE, BULK_URB,
        BULK_DEPTH, None)
    if ctx.box_name == "medius":
        rec["medius_counters"] = _stat_delta(st0, _stats(ctx.box))
    return rec


def _show(ctx, rec):
    for ep, r in rec["endpoints"].items():
        if not isinstance(r, dict) or not r.get("present"):
            ctx.log(f"{rec['leg']} {ep}: {r}")
            continue
        ctx.log(f"{rec['leg']} {ep} read {r['read']}/{r['asked']} skipped {r['skipped']} repeated {r['repeated']} "
                f"out_of_order {r['out_of_order']} not_whole {r['not_whole']} made_not_read {r['made_not_read']} "
                f"error {r['error']}")


def run(ctx):
    results = []
    for leg in (_interrupt_leg, _bulk_leg):
        rec = leg(ctx)
        _show(ctx, rec)
        results.append(rec)
    return {"results": results}
