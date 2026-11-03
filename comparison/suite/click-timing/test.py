"""Clicks and typing timed by the box, against the same clicks driven by the PC, read off the PC's USB bus.

The device is a mouse (interface 0, at rest) beside a boot keyboard (interface 1).
  onbox    10 left clicks, 50 ms down and 50 ms up, timed by the box: stock km.click(1,10,50), Medius a clip
           (press, 49 empty frames, release, 49 empty frames)
  host     the same 10 clicks with each press and release sent by the PC, 50 ms apart
  typing   "the quick brown fox 0123456789": stock km.string, Medius a clip (each character's down and up on
           consecutive frames)
Five runs of each. Per run: clicks or characters that reached the PC, in order; hold and gap times; start
latency from the command's packet reaching the box's control port; total time for the string."""
import struct
import time

from medius_compare import stats, wire
from medius_shapes.core import (EndpointSpec, GEN_FIXED, GEN_SCRIPT, KBD_DESC, Personality, Pump, SPEED_FULL,
                                device_desc, hid, script)
from medius_shapes.scripted import MOUSE_DESC, VID, mouse

RUNS = 5
SETTLE_S = 2.5
TEXT = "the quick brown fox 0123456789"
HID = {**{c: 4 + i for i, c in enumerate("abcdefghijklmnopqrstuvwxyz")},
       **{c: 30 + i for i, c in enumerate("1234567890")}, " ": 0x2C}
INJECT, CLIP_CTRL, CLIP_START = 0x03, 0x13, 0


def mouse_kbd(pid, records):
    """A mouse playing `records` beside a boot keyboard that sends an empty report every second."""
    body = (bytes([9, 4, 0, 0, 1, 3, 1, 2, 0]) + hid(len(MOUSE_DESC)) + bytes([7, 5, 0x81, 3, 8, 0, 1])
            + bytes([9, 4, 1, 0, 1, 3, 1, 1, 0]) + hid(len(KBD_DESC)) + bytes([7, 5, 0x82, 3, 8, 0, 1]))
    total = 9 + len(body)
    cfg = bytes([9, 2, total & 0xFF, total >> 8, 2, 1, 0, 0xA0, 50]) + body
    return Personality(speed=SPEED_FULL, device=device_desc(VID, pid, 1), configs=[cfg],
                       strings=[bytes([4, 3, 9, 4])], hid_report=MOUSE_DESC,
                       endpoints=[EndpointSpec(0x81, 3, 1, 8, 6), EndpointSpec(0x82, 3, 1, 8, 8)],
                       pump=Pump(ep=0x81, interval_us=1000, gen=GEN_SCRIPT), script=script(records),
                       hid_report2=KBD_DESC, rpt2_iface=1, pump2=Pump(ep=0x82, interval_us=1000000, gen=GEN_FIXED))


SHAPES = {"rest": lambda: mouse_kbd(0x7180, [(1, mouse()), (1999, b"")])}

_settled = []


def _present(ctx, leg):
    p = ctx.device(leg)
    if not any(q is p for q in _settled):
        _settled.append(p)
        time.sleep(SETTLE_S)
    return p


def _frames(data):
    i = 0
    while i + 7 <= len(data):
        if data[i] != 0xA5:
            i += 1
            continue
        n = data[i + 3] | data[i + 4] << 8
        yield data[i + 1], bytes(data[i + 5:i + 5 + n])
        i += 7 + n


def _edges(reps, on):
    out, prev = [], False
    for t, d in reps:
        s = bool(on(d))
        if s != prev:
            out.append((t, s))
            prev = s
    return out


def _clicks(reps):
    e = _edges(reps, lambda d: d[0] & 1)
    presses = [t for t, s in e if s]
    releases = [t for t, s in e if not s]
    holds = [(r - p) / 1e6 for p, r in zip(presses, releases)]
    gaps = [(p - r) / 1e6 for r, p in zip(releases, presses[1:])]
    return presses, holds, gaps


def _typed(reps):
    out, prev = [], set()
    inv = {v: k for k, v in HID.items()}
    for t, d in reps:
        cur = {k for k in d[2:8] if k}
        for k in sorted(cur - prev):
            out.append((t, inv.get(k, "?")))
        prev = cur
    return out


def _is_start(kind, part):
    if kind == "stock":
        text = {"onbox": b"km.click(", "typing": b"km.string(", "host": b"km.left(1)"}[part]
        return lambda d: text in d
    if part == "host":
        want = struct.pack("<BHB", 0, 0, 1)
        return lambda d: any(t == INJECT and p == want for t, p in _frames(d))
    return lambda d: any(t == CLIP_CTRL and p == bytes([CLIP_START]) for t, p in _frames(d))


def _play(box, build):
    m = box.medius
    clip = box.device.clip()
    clip.clear()
    clip.set_retain(False)
    clip.set_loop(False)
    time.sleep(0.05)
    b = m.ClipBuilder()
    build(b, m)
    clip.append(b)
    time.sleep(0.1)
    clip.start()


def _clip_clicks(b, m):
    left = m.Usage.button(m.Button.LEFT)
    for _ in range(10):
        b.press(left).gap(49).release(left).gap(49)


def _clip_typing(b, m):
    for ch in TEXT:
        b.press(m.Usage.key(HID[ch])).release(m.Usage.key(HID[ch]))


def _host_clicks(box):
    nxt = time.monotonic()
    for _ in range(10):
        for down in (True, False):
            (box.press if down else box.release)("left")
            nxt += 0.05
            while time.monotonic() < nxt:
                pass


def _one(ctx, part, r, ch, cl, usb):
    box = ctx.box
    time.sleep(0.3)
    try:
        with wire.Wire([usb, box.port]) as w:
            if part == "onbox":
                if box.kind == "stock":
                    box.send("km.click(1,10,50)")
                else:
                    _play(box, _clip_clicks)
                secs = 1.6
            elif part == "host":
                _host_clicks(box)
                secs = 0.3
            else:
                if box.kind == "stock":
                    box.send(f'km.string("{TEXT}")')
                else:
                    _play(box, _clip_typing)
                secs = 4.5 if box.kind == "stock" else 0.6
            time.sleep(secs)
    finally:
        if box.kind == "medius":
            box.leave()
    starts = wire.outs(w.events, ch, _is_start(box.kind, part))
    t0 = starts[0] if starts else None
    if part == "typing":
        got = _typed(wire.reports(w.events, cl, 0x82))
        text = "".join(c for _, c in got)
        return {"part": part, "run": r, "typed": text, "exact": text == TEXT,
                "start_ms": round((got[0][0] - t0) / 1000, 2) if got and t0 else None,
                "total_ms": round((got[-1][0] - got[0][0]) / 1000, 1) if len(got) > 1 else None}
    presses, holds, gaps = _clicks(wire.reports(w.events, cl, 0x81))
    return {"part": part, "run": r, "clicks": len(presses), "hold": stats.summary(holds), "gap": stats.summary(gaps),
            "start_ms": round((presses[0] - t0) / 1000, 2) if presses and t0 else None}


def run(ctx):
    p = _present(ctx, "rest")
    _, ch = wire.resolve(ctx.box.port)
    _, cl = wire.resolve(p.usb)
    results = []
    for part in ("onbox", "host", "typing"):
        for r in range(RUNS):
            rec = _one(ctx, part, r, ch, cl, p.usb)
            results.append(rec)
            if part == "typing":
                ctx.log(f"typing run {r}: exact {rec['exact']} total {rec['total_ms']} ms")
            else:
                ctx.log(f"{part} run {r}: clicks {rec['clicks']} hold min {rec['hold'].get('min')} max "
                        f"{rec['hold'].get('max')} us")
    typing = [x for x in results if x["part"] == "typing"]
    return {"results": results,
            "outcomes": {"input-typing-box-exact": "Exact" if all(x["exact"] for x in typing) else "Changed"}}
