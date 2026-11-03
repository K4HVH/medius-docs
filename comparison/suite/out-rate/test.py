"""OUT packets written at the PC's full rate: does every packet the PC writes reach the real device once, whole and
in order, and how fast does each box take them?

The device: a silent mouse; a vendor-page HID interface with an 8-byte interrupt OUT (0x02); a vendor interface with
an 8-byte interrupt OUT (0x03) and an 8-byte bulk OUT (0x04). Nothing is pumped. Endpoints narrower than 64 bytes are
the hard case. A full packet doesn't end a transfer there, so a relay that arms its reads for more than one packet
holds a packet until the next one arrives, or merges packets. Medius runs with imperfect clones allowed (it clones
vendor bulk only then); stock has no such option. The native run plays the slow leg on the sim lent to the PC hub,
the device plugged straight into the PC: the rates each box's rows are read against.

The PC takes interfaces 1 and 2 from their kernel drivers and writes through usbfs, one packet per transfer, with
eight transfers queued per endpoint so it sends as fast as the clone takes them. Each packet is 8 bytes: a 16-bit
counter, the endpoint address, then a ramp, so no two packets match. Legs:
  alone     N packets on each endpoint in turn
  together  N packets on all three at once
  slow      the same device with each OUT endpoint taking one packet then NAKing for 5 ms, 100 packets on all three
            at once. Natively the PC waits, about 0.5 s per endpoint, and loses nothing.

What the real device received comes from the sim's SIMSTAT: per OUT endpoint, packets, bytes and a CRC16 over the
bytes in arrival order. The CRC is tested against the packets the clone accepted, and against each simple way of
getting them wrong: only the first k arrived (the rest lost, or still held), one run of packets lost, one run
repeated, two neighbours swapped, and every byte in order but in fewer packets (merged). The CRC is 16 bits, so a
match is a hypothesis the counts and CRC agree with. Each hypothesis tried has about a 1 in 65536 chance of matching
by coincidence; when more than one fits, all are listed. A stream none of them explains is reported as unexplained,
with its counts. On the alone leg, the sim's OUT log also gives each of the first 96 packets' length.

Per leg and endpoint:
- transfers the clone completed, and errors;
- the write rate: packets over the time from the first submit to the last completion. An 8-byte interrupt OUT
  polled every frame takes 1000 a second natively. Bulk has no fixed rate: the bus and the real device set it;
- packets and bytes the real device received, and the verdict: lost, merged, repeated, reordered;
- on the slow leg, how long the PC took and whether it waited on the real device;
- Medius's drop counters across each leg.
A clone that comes up without an endpoint is recorded as such."""
import ctypes
import os
import struct
import time

from medius_shapes import personalities as shapes
from medius_shapes.personalities import sim_module

OUT_EPS = (shapes.OUT_HID_EP, shapes.OUT_VINT_EP, shapes.OUT_VBULK_EP)
NAMES = {shapes.OUT_HID_EP: "HID interrupt OUT", shapes.OUT_VINT_EP: "vendor interrupt OUT",
         shapes.OUT_VBULK_EP: "vendor bulk OUT"}
PKT = 8
DEPTH = 8
PACKETS = 1000
FAST_PID, SLOW_PID = 0x7362, 0x7363
NAK_MS = 5
SLOW_PACKETS = 100
LINGER_S = 0.5
SETTLE_S = 1.0
STAT_KEYS = ("tx_drops", "relay_drops", "host_rx_drops", "link_rx_drops")
BASE = {"alone": 0x0000, "together": 0x4000, "slow": 0x8000}
TYPES = {0: "control", 1: "iso", 2: "bulk", 3: "interrupt"}
OUTLOG = 0x5A
_KEEP = []


def _own(p, pid):
    d = bytearray(p.device)
    d[10:12] = pid.to_bytes(2, "little")
    p.device = bytes(d)
    return p


def out_device():
    """A silent mouse; a vendor-page HID interface with an 8-byte interrupt OUT; a vendor interface with 8-byte
    interrupt and bulk OUTs."""
    return _own(shapes.out_personality(), FAST_PID)


def slow_out_device():
    """The same, every OUT endpoint taking one packet then NAKing for NAK_MS."""
    p = _own(shapes.out_personality(), SLOW_PID)
    for e in p.endpoints:
        if not e.addr & 0x80:
            e.nak_every = NAK_MS
    return p


SHAPES = {"out-device": out_device, "slow-out-device": slow_out_device}


def _packets(ep, n, base):
    out = []
    for i in range(n):
        c = (base + i) & 0xFFFF
        out.append(bytes([c & 0xFF, c >> 8, ep] + [(c + ep + k) & 0xFF for k in range(PKT - 3)]))
    return out


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
    if getattr(box, "kind", None) != "medius":
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


def _sim_stat(ctx):
    link = ctx.sim()
    try:
        return link.simstat()
    finally:
        link.close()


def _out_log(ctx, secs=0.6):
    """What the sim's OUT endpoints received since the last read: packets, bytes, CRC16 over the bytes in arrival
    order, and each packet's length. Reading clears it."""
    lk = sim_module("link")
    link = ctx.sim()
    try:
        link.s.reset_input_buffer()
        link.s.write(lk.frame(OUTLOG, 0))
        link.s.flush()
        buf, end, p = b"", time.monotonic() + secs, None
        while p is None and time.monotonic() < end:
            buf += link.s.read(256)
            got, buf = lk.decode_stream(buf)
            p = next((pl for t, _, pl in got if t == lk.RESP), None)
    finally:
        link.close()
    if p is None or len(p) < 11:
        return None
    packets, nbytes, crc, n = struct.unpack("<IIHB", p[:11])
    return {"packets": packets, "bytes": nbytes, "crc": crc, "lens": list(struct.unpack(f"<{n}H", p[11:11 + 2 * n]))}


def _submit_out(raw, ep, data, xfer):
    usbfs = sim_module("usbfs")
    buf = ctypes.create_string_buffer(bytes(data), max(len(data), 1))
    urb = usbfs.Urb()
    urb.type = xfer
    urb.endpoint = ep & 0x0F
    urb.buffer = ctypes.cast(buf, ctypes.c_void_p)
    urb.buffer_length = len(data)
    usbfs._ioctl(raw.fd, usbfs.SUBMITURB, ctypes.byref(urb))
    return urb, buf


def _write_all(raw, plan, deadline_s):
    """plan: {ep: (usbfs transfer type, [packets])}. Keeps DEPTH transfers queued on each endpoint until its packets
    are all written, it fails, or the deadline passes. An endpoint stops at its first failed transfer. Returns per
    endpoint the indices the clone accepted in completion order, failures by status, transfers left unfinished, and
    times."""
    st = {ep: {"next": 0, "inflight": 0, "ok": [], "errors": {}, "short": 0, "stopped": None,
               "t0": None, "t_last": None, "unfinished": 0} for ep in plan}
    live = {}
    end = time.monotonic() + deadline_s
    while True:
        for ep, (xfer, pk) in plan.items():
            s = st[ep]
            while s["stopped"] is None and s["inflight"] < DEPTH and s["next"] < len(pk):
                try:
                    u, b = _submit_out(raw, ep, pk[s["next"]], xfer)
                except OSError as e:
                    s["stopped"] = f"submit: {e}"
                    break
                if s["t0"] is None:
                    s["t0"] = time.monotonic()
                live[ctypes.addressof(u)] = (ep, s["next"], u, b)
                s["next"] += 1
                s["inflight"] += 1
        if not live:
            break
        left = end - time.monotonic()
        if left <= 0:
            for s in st.values():
                if s["inflight"]:
                    s["stopped"] = s["stopped"] or f"deadline: {deadline_s:.0f} s"
            break
        try:
            addr, status, data = raw.reap(timeout=min(left, 0.25))
        except TimeoutError:
            continue
        except OSError as e:
            for s in st.values():
                s["stopped"] = s["stopped"] or f"reap: {e}"
            break
        t = time.monotonic()
        ent = live.pop(addr, None)
        if ent is None:
            continue
        ep, i, _, _ = ent
        s = st[ep]
        s["inflight"] -= 1
        if status == 0:
            s["ok"].append(i)
            s["t_last"] = t
            if len(data) != len(plan[ep][1][i]):
                s["short"] += 1
        else:
            s["errors"][str(status)] = s["errors"].get(str(status), 0) + 1
            s["stopped"] = s["stopped"] or f"URB status {status}"
    for ep, i, u, _ in list(live.values()):
        raw.discard(u)
    stop = time.monotonic() + 1.0
    while live and time.monotonic() < stop:
        try:
            addr, status, _ = raw.reap(timeout=0.2)
        except (TimeoutError, OSError):
            break
        ent = live.pop(addr, None)
        if ent is None:
            continue
        s = st[ent[0]]
        if status == 0:
            s["ok"].append(ent[1])
            s["t_last"] = time.monotonic()
        else:
            s["unfinished"] += 1
    for s in st.values():
        s["unfinished"] += sum(1 for e in live.values() if st[e[0]] is s)
    _KEEP.extend(live.values())
    return st


def _table():
    t = []
    for i in range(256):
        c = i << 8
        for _ in range(8):
            c = ((c << 1) ^ 0x1021) & 0xFFFF if c & 0x8000 else (c << 1) & 0xFFFF
        t.append(c)
    return t


TABLE = _table()


def crc_upd(c, data):
    """CRC16-CCITT-FALSE (the sim's) carried from state c over data."""
    for b in data:
        c = ((c << 8) & 0xFFFF) ^ TABLE[(c >> 8) ^ b]
    return c


class Explainer:
    """Which simple account of a sent list of equal-size packets fits what the real device counted (packets, bytes,
    CRC).

    The CRC has no final XOR, so it is linear: carrying state s over bytes B gives crc(0, B) ^ crc(s, zeros(len B)).
    With the CRC of every prefix, of every suffix from state 0, and the carry of each state bit over k packets of
    zeros, the CRC of any splice of the sent list costs 16 steps, and every account below is tried in O(n)."""

    def __init__(self, sent):
        self.sent, self.n = sent, len(sent)
        self.size = len(sent[0]) if sent else 0
        self.pre = [0xFFFF]
        for p in sent:
            self.pre.append(crc_upd(self.pre[-1], p))
        zero = bytes(self.size)
        self.z = [[1 << b for b in range(16)]]
        for _ in range(self.n):
            self.z.append([crc_upd(x, zero) for x in self.z[-1]])
        self.suf = [0] * (self.n + 1)
        for j in range(self.n - 1, -1, -1):
            self.suf[j] = self.suf[j + 1] ^ self.carry(crc_upd(0, sent[j]), self.n - j - 1)

    def carry(self, s, k):
        """State s carried over k packets of zeros."""
        r, row, b = 0, self.z[k], 0
        while s:
            if s & 1:
                r ^= row[b]
            s >>= 1
            b += 1
        return r

    def then(self, s, j):
        """The CRC from state s over sent[j:]."""
        return self.suf[j] ^ self.carry(s, self.n - j)

    def explain(self, got):
        n, sz = self.n, self.size
        out = {"received": None, "received_bytes": None, "sent": n, "sent_bytes": n * sz,
               "lost": None, "merged": None, "repeated": None, "reordered": None}
        if got is None:
            out["verdict"] = "the sim did not answer"
            return out
        P, B, C = got["packets"], got["bytes"], got["crc"]
        out.update(received=P, received_bytes=B)
        if n == 0:
            out["verdict"] = ("nothing sent completed at the clone" if not P else
                              f"{P} packets ({B} bytes) the clone never completed reached the real device")
            return out

        def found(verdict, at=None, lost=0, merged=0, repeated=0, reordered=0):
            out.update(verdict=verdict, lost=lost, merged=merged, repeated=repeated, reordered=reordered)
            if at is not None:
                out["at"] = at[:8]
                if len(at) > 1:
                    out["candidates"] = len(at)
            return out

        if P == n and B == n * sz and C == self.pre[n]:
            return found("all, once, in order")
        if B == n * sz and C == self.pre[n]:
            if P < n:
                return found("every byte in order, in fewer packets", merged=n - P)
            return found(f"every byte in order, in {P - n} more packets")
        if B != P * sz:
            out["verdict"] = f"packets of another length: {B} bytes in {P} packets"
            return out
        if P < n:
            d = n - P
            at = sorted((i for i in range(n - d + 1) if self.then(self.pre[i], i + d) == C), key=lambda i: i != P)
            if at and at[0] == P:
                return found(f"the first {P} in order, the last {d} missing (lost, or still held)", at=at, lost=d)
            if at:
                return found(f"packets {at[0]} to {at[0] + d - 1} missing, the rest in order", at=at, lost=d)
        if P > n:
            d = P - n
            at = [i for i in range(n - d + 1) if self.then(self.pre[i + d], i) == C]
            if at:
                return found(f"one run of {d} repeated, from packet {at[0]}", at=at, repeated=d)
        if P == n:
            at = [i for i in range(n - 1)
                  if self.then(crc_upd(crc_upd(self.pre[i], self.sent[i + 1]), self.sent[i]), i + 2) == C]
            if at:
                return found(f"packets {at[0]} and {at[0] + 1} swapped", at=at, reordered=1)
        out["verdict"] = "unexplained: neither all in order nor one simple loss, repeat or swap"
        return out


def _lens_of(log, n):
    """The sim's OUT log on a leg with one endpoint: the first 96 packets' lengths, and the first that isn't PKT."""
    if log is None:
        return None
    lens = log["lens"]
    hist = {}
    for x in lens:
        hist[str(x)] = hist.get(str(x), 0) + 1
    odd = next((i for i, x in enumerate(lens) if x != PKT), None)
    return {"packets": log["packets"], "bytes": log["bytes"], "lengths_first_96": hist, "first_not_8_bytes": odd,
            "logged": len(lens), "of": min(n, 96)}


def _run_leg(ctx, raw, info, leg, eps, n):
    """Write n packets on each endpoint in eps at once; read what the sim received. Returns one row per endpoint."""
    usbfs = sim_module("usbfs")
    sent = {ep: _packets(ep, n, BASE[leg]) for ep in eps}
    plan = {ep: (usbfs.TYPE_BULK if info[f"0x{ep:02x}"]["type"] == "bulk" else usbfs.TYPE_INTERRUPT, sent[ep])
            for ep in eps}
    st0 = _stats(ctx.box)
    _sim_stat(ctx)
    _out_log(ctx)
    w = _write_all(raw, plan, max(10.0, n * 0.02))
    time.sleep(LINGER_S)
    stat = _sim_stat(ctx)
    log = _out_log(ctx) if len(eps) == 1 else None
    counters = _stat_delta(st0, _stats(ctx.box))
    rows = []
    for ep in eps:
        s = w[ep]
        accepted = [sent[ep][i] for i in s["ok"]]
        secs = (s["t_last"] - s["t0"]) if s["t_last"] and s["t0"] else None
        got = stat["out"][ep & 0x0F] if stat else None
        row = {"leg": leg, "ep": f"0x{ep:02x}", "name": NAMES[ep], "clone_endpoint": info[f"0x{ep:02x}"],
               "submitted": s["next"], "accepted_by_clone": len(s["ok"]),
               "accepted_in_order": s["ok"] == sorted(s["ok"]), "urb_errors": s["errors"],
               "short_writes": s["short"], "unfinished": s["unfinished"], "stopped": s["stopped"],
               "secs": round(secs, 3) if secs else None,
               "per_second": round(len(s["ok"]) / secs, 1) if secs else None,
               "device": got, **Explainer(accepted).explain(got)}
        if leg == "slow":
            row["pc_waited"] = bool(secs and secs >= 0.9 * len(s["ok"]) * NAK_MS / 1000.0)
        if log is not None:
            row["out_log"] = _lens_of(log, len(accepted))
        if counters is not None:
            row["medius_counters"] = counters
        rows.append(row)
    return rows


def _device_legs(ctx, leg_id, legs):
    """Present the leg's device, take its OUT interfaces, run `legs` on it. Returns rows."""
    usb = ctx.device(leg_id).usb
    time.sleep(SETTLE_S)
    raw, info, unbound, err = _open_clone(usb, OUT_EPS)
    rows = [{"leg": leg, "ep": f"0x{ep:02x}", "name": NAMES[ep], "cloned": True, "present": False}
            for leg in legs for ep in OUT_EPS if not info.get(f"0x{ep:02x}", {}).get("present")]
    if raw is None:
        _give_back(unbound)
        why = err or "the clone has none of the OUT endpoints"
        return rows + [{"leg": leg, "cloned": True, "error": why} for leg in legs]
    live = [ep for ep in OUT_EPS if info[f"0x{ep:02x}"].get("present")]
    try:
        for leg in legs:
            if leg == "alone":
                for ep in live:
                    rows += _run_leg(ctx, raw, info, leg, [ep], PACKETS)
            else:
                rows += _run_leg(ctx, raw, info, leg, live, SLOW_PACKETS if leg == "slow" else PACKETS)
    except OSError as e:
        rows.append({"leg": ",".join(legs), "cloned": True, "error": str(e)})
    finally:
        raw.close()
        _give_back(unbound)
    return rows


def _verdict(rows, leg):
    mine = [r for r in rows if r.get("leg") == leg]
    good = len(mine) == len(OUT_EPS) and all(r.get("verdict") == "all, once, in order" for r in mine)
    return "All, once, in order" if good else "Lost, merged or out of order"


def run(ctx):
    native = ctx.box_name == "native"
    legs = ("slow",) if native else ("alone", "together", "slow")
    rows = [] if native else _device_legs(ctx, "fast", ["alone", "together"])
    rows += _device_legs(ctx, "slow", ["slow"])
    for r in rows:
        ctx.log(f"{r.get('leg')} {r.get('ep', '')} {r.get('name', '')}: accepted {r.get('accepted_by_clone')}/"
                f"{r.get('submitted')} at {r.get('per_second')}/s, device {r.get('received')} packets: "
                f"{r.get('verdict', r.get('error', 'not on the clone'))}")
    base = {"results": rows}
    if ctx.box_name == "medius":
        base["medius_imperfect_optin"] = ctx.box.device.query_imperfect().allowed
    return {"base": base, "outcomes": {f"pass-out-verdict-{leg}": _verdict(rows, leg) for leg in legs}}
