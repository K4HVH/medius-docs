"""How many one-way move commands each box takes per second, by command form, counted on the PC.

Each run writes moves at a set rate for `secs` and sums the clone's X on its evdev node until X has been still
for 1 s, so counts beyond the commanded total show too. Each command moves `dx` counts on X. Forms:
  stock bin    binary MOVE (0x18): `DE AD 04 00 18 <x i16> <y i16>`; no reply when taken, `DE AD 01 00 18 FF`
               when refused
  stock text   `km.move(dx,0)\\r\\n`
  Medius       MOVE frames, in both stock forms' places
Rates are paced in 1 ms batches. `rate:ms` writes one clump of round(rate * ms / 1000) every `ms` ms instead (a
sender whose timer wakes every 16 ms writes its moves in clumps). `single` writes each command on its own at its
scheduled time. `blast` writes 12,871 moves back to back in 4,096-byte writes, after a 1,000/s run.

Variants, as `{variant: {"results": [...]}}`: the mouse is still (`rest`), or reports every millisecond with Y
moving 1 to 10 and back over 200 ms and X still (`moving`). Per run: commands sent, refusals counted on the
control port, the bytes the box sent back, X counts on the PC, how long after the last write the last count
arrived (`tail_ms`), and whether the box still answers in step afterwards. A box found one command behind before
a run is power-cycled first (`cycled_before`), so every run starts in step; one still behind after the cycle has
that run recorded as skipped, in its place.
"""
import math
import time

from medius_compare import capture, devices, frames
from medius_compare.capture import REL_X, mono
from medius_shapes import scripted

REFUSED = b"\xde\xad\x01\x00\x18\xff"
SINE_PID = 0x704E
BLAST = 12871

# (name, leg, rates, secs, stock forms, dx values, single)
VARIANTS = [
    ("rest", "rest", "500,1000,1500,2000,5000", 1.0, ("bin", "text"), (1,), False),
    ("rest_5s", "rest", "500,500,250,1000,2000", 5.0, ("bin", "text"), (1,), False),
    ("rest_single", "rest", "1000,2000,5000", 1.0, ("bin",), (1,), True),
    ("rest_clump16", "rest", "1000:16", 1.0, ("bin",), (1,), False),
    ("dx", "rest", "500,1000,1500,2000,5000", 1.0, ("bin", "text"), (10, 100, 1000), False),
    ("moving", "moving", "125,500,1000,1500,2000,3000,5000", 1.0, ("bin", "text"), (1,), False),
    ("moving_5s", "moving", "125,250,500,500,1000", 5.0, ("bin", "text"), (1,), False),
    ("moving_single", "moving", "1000,2000,5000", 1.0, ("bin",), (1,), True),
    ("clumped", "rest", "1000:16,2000:16,2000:32,2000:64,5000:16", 1.0, ("bin",), (1,), False),
    ("blast", "rest", "1000", 1.0, ("bin",), (1,), False),
]


def sine_mouse():
    """A mouse reporting every millisecond, Y moving 1 to 10 and back over 200 ms, X still."""
    recs = [(1, scripted.mouse(0, 1 + round(4.5 + 4.5 * math.sin(2 * math.pi * i / 200)))) for i in range(200)]
    return scripted.scripted_mouse(SINE_PID, recs, interval_us=1000)


SHAPES = {"sine-mouse": sine_mouse}


class _Port:
    """The box's control port as bytes. Medius takes its frames on the bare port with the package closed, and
    answers a query through the package between writes."""

    def __init__(self, box):
        self.box = box
        self.raw = box.raw() if box.kind == "medius" else None

    def write(self, data):
        (self.raw or self.box).write(data)

    def drain(self):
        if self.raw is None:
            return self.box.drain()
        got = b""
        while chunk := self.raw.read():
            got += chunk
        return got

    def in_step(self):
        if self.raw is None:
            return not self.box.lagging()
        self.raw.close()
        try:
            self.box.reopen()
            self.box.device.query_health()
            ok = True
        except self.box.medius.MediusError:
            ok = False
        self.raw = self.box.raw()
        return ok

    def close(self):
        if self.raw is not None:
            self.raw.close()
            self.raw = None
            self.box.reopen()


def _moves(kind, form, n, dx):
    if kind == "medius":
        return [frames.move(dx, 0, seq=i) for i in range(n)]
    if form == "bin":
        return [frames.mak_move(dx, 0)] * n
    return [f"km.move({dx},0)\r\n".encode()] * n


def _paced(write, cmds, rate):
    per_ms, acc, i = rate / 1000.0, 0.0, 0
    t0 = nxt = mono()
    while i < len(cmds):
        nxt += 0.001
        acc += per_ms
        k = int(acc)
        acc -= k
        if k:
            write(b"".join(cmds[i:i + k]))
            i += k
        while mono() < nxt:
            pass
    return t0


def _clumped(write, cmds, rate, ms):
    k = max(1, round(rate * ms / 1000))
    t0 = nxt = mono()
    for i in range(0, len(cmds), k):
        write(b"".join(cmds[i:i + k]))
        if i + k >= len(cmds):
            break
        nxt += ms / 1000
        lead = nxt - mono() - 0.0003
        if lead > 0:
            time.sleep(lead)
        while mono() < nxt:
            pass
    return t0


def _singles(write, cmds, rate):
    t0 = mono()
    for i, c in enumerate(cmds):
        if rate:
            due = t0 + i / rate
            lead = due - mono() - 0.0003
            if lead > 0:
                time.sleep(lead)
            while mono() < due:
                pass
        write(c)
    return t0


def _settle_x(cap, quiet=1.0, cap_s=120.0):
    total, last = 0, None
    end = time.monotonic() + cap_s
    still_since = time.monotonic()
    while time.monotonic() < end:
        for t, rel, _ in cap.take():
            v = rel.get(REL_X, 0)
            if v:
                total += v
                last = t
                still_since = time.monotonic()
        if time.monotonic() - still_since > quiet:
            break
        time.sleep(0.005)
    return total, last


def _one(port, cap, cmds, rate, ms=None, dx=1, single=False):
    time.sleep(0.5)
    cap.take()
    port.drain()
    wrote = [0.0]

    def timed(d):
        port.write(d)
        wrote[0] = mono()

    if single:
        t0 = _singles(timed, cmds, rate)
    elif rate and ms:
        t0 = _clumped(timed, cmds, rate, ms)
    elif rate:
        t0 = _paced(timed, cmds, rate)
    else:
        t0 = mono()
        data = b"".join(cmds)
        for i in range(0, len(data), 4096):
            timed(data[i:i + 4096])
    t1 = wrote[0]
    want = len(cmds) * dx
    got, last = _settle_x(cap)
    time.sleep(0.3)
    rx = port.drain()
    r = {"sent": len(cmds), "write_s": round(t1 - t0, 3), "x_delivered": got, "x_wanted": want,
         "refused_replies": rx.count(REFUSED), "rx_bytes": len(rx), "rx_head": rx[:48].hex() or None,
         "tail_ms": round((last - t1) * 1e3, 1) if last and got >= want else None}
    if rate and ms:
        r["per_write"] = max(1, round(rate * ms / 1000))
    r["in_step_after"] = port.in_step()
    return r


def _rates(spec):
    return [tuple(int(v) for v in x.split(":")) if ":" in x else (int(x), None) for x in spec.split(",")]


class _Clone:
    def __init__(self, ctx, leg):
        self.ctx, self.leg = ctx, leg
        self.p = ctx.device(leg)
        self.cap = capture.EvCap(capture.pointer_node(self.p.nodes))

    def ready(self):
        box = self.ctx.box
        if not box.lagging():
            return False, False
        self.close()
        self.ctx.unjam()
        p = _back(self.ctx, self.leg, self.p)
        cycled, self.p = p is not self.p, p
        self.cap = capture.EvCap(capture.pointer_node(p.nodes))
        return cycled, box.lagging()

    def close(self):
        if self.cap is not None:
            self.cap.close()
            self.cap = None


def _back(ctx, leg, old, timeout=30.0):
    end = time.monotonic() + timeout
    while capture.pointer_node(devices.usb_nodes(old.usb)) is None and time.monotonic() < end:
        time.sleep(0.1)
    return ctx.device(leg)


def _variant(ctx, port, leg, rates, secs, forms, dxs, single, blast):
    box = ctx.box

    def shown(form):
        return "frame" if box.kind == "medius" else form

    steps = [(form, int(rate * secs), rate, ms, dx,
              {"form": shown(form), "slot": form, "dx": dx, "rate": rate, "clump_ms": ms, "single": single},
              f"{form} dx {dx} at {rate}/s{f' in {ms} ms clumps' if ms else ''}")
             for form in forms for dx in dxs for rate, ms in _rates(rates)]
    if blast:
        steps.append(("bin", blast, 0, None, 1,
                      {"form": shown("bin"), "slot": "bin", "rate": "back to back", "single": single},
                      f"{blast} back to back"))
    clone = _Clone(ctx, leg)
    results = []
    try:
        for form, n, rate, ms, dx, tag, what in steps:
            cycled, behind = clone.ready()
            if behind:
                results.append({**tag, "cycled_before": cycled, "skipped": "one command behind after a power cycle"})
                ctx.log(f"{what}: skipped, one command behind after a power cycle")
                continue
            r = _one(port, clone.cap, _moves(box.kind, form, n, dx), rate, ms, dx, single)
            r.update(tag, cycled_before=cycled)
            results.append(r)
            ctx.log(f"{what}: {r['x_delivered']}/{r['x_wanted']}{', after a power cycle' if cycled else ''}")
    finally:
        clone.close()
    return {"results": results}


def _parser(variant, i):
    rows = variant.get("results", [])
    if len(rows) <= i or "in_step_after" not in rows[i]:
        return None
    return "In step" if rows[i]["in_step_after"] else "One command behind until a power cycle"


def run(ctx):
    port = _Port(ctx.box)
    out = {}
    try:
        for name, leg, rates, secs, forms, dxs, single in VARIANTS:
            if leg not in ctx.legs:
                out[name] = {"skipped": "needs the sim", "results": []}
                continue
            out[name] = _variant(ctx, port, leg, rates, secs, forms, dxs, single, BLAST if name == "blast" else 0)
    finally:
        port.close()
    out["outcomes"] = {"link-clump-parser-2000": _parser(out["clumped"], 1),
                       "link-back-to-back-parser": _parser(out["blast"], 1)}
    return out
