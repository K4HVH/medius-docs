"""Keyboard injection, read on the clone's key node.

  merge    a boot keyboard holds 'q'; the box injects 'a' down, then up 0.2 s later: 'q' must still be held
  latency  a still boot keyboard; 'a' down, then up, 200 times: from the command's write to the clone's
           KEY_A edge
  string   stock only: "the quick brown fox 0123456789" through km.string, which the box times itself
  media    Volume Up on a keyboard with no media interface: stock km.down("volumeup"), Medius INJECT media
  pairs    the same text as key down/up pairs sent back to back by the PC, last: it can leave stock's parser
           one command behind, so the parser's state is read after it

Stock gets km.down/km.up, Medius INJECT press and soft-release."""
import fcntl
import os
import time

from medius_compare import stats
from medius_compare.capture import EvCap, mono
from medius_compare.devices import kinds_of, usb_nodes
from medius_shapes.scripted import keys, scripted_keyboard

EVIOCGKEY = 0x80604518
SETTLE_S = 2.5
N = 200
TEXT = "the quick brown fox 0123456789"
KEY_A, KEY_Q = 30, 16
HID_A, HID_Q, HID_VOLUME_UP = 0x04, 0x14, 0xE9
EV_CODES = dict(zip("abcdefghijklmnopqrstuvwxyz", [30, 48, 46, 32, 18, 33, 34, 35, 23, 36, 37, 38, 50, 49, 24, 25,
                                                    16, 19, 31, 20, 22, 47, 17, 45, 21, 44]))
EV_CODES.update({str(d): 2 + (d - 1) % 10 if d else 11 for d in range(10)})
EV_CODES[" "] = 57
HID_CODES = {c: 0x04 + i for i, c in enumerate("abcdefghijklmnopqrstuvwxyz")}
HID_CODES.update({str(d): 0x1E + (d - 1) % 10 if d else 0x27 for d in range(10)})
HID_CODES[" "] = 0x2C
CODE_TO_CH = {v: k for k, v in EV_CODES.items()}

SHAPES = {"hold-q": lambda: scripted_keyboard(0x7093, [(1, keys(HID_Q)), (1999, b"")])}

_settled = []


def _present(ctx, leg):
    p = ctx.device(leg)
    if not any(q is p for q in _settled):
        _settled.append(p)
        time.sleep(SETTLE_S)
    return p


def _key_node(port, timeout=10.0):
    end = time.monotonic() + timeout
    while True:
        for n in usb_nodes(port):
            if "/input/" in n and "keyboard" in kinds_of(n):
                return n
        if time.monotonic() > end:
            raise RuntimeError(f"no key node on {port}")
        time.sleep(0.1)


def _held(node):
    fd = os.open(node, os.O_RDONLY | os.O_NONBLOCK)
    try:
        st = bytearray(96)
        fcntl.ioctl(fd, EVIOCGKEY, st)
    finally:
        os.close(fd)
    return {i for i in range(len(st) * 8) if st[i // 8] >> (i % 8) & 1}


def _edges(frames, code):
    return [(t, v) for t, _, ks in frames for c, v in ks if c == code]


def _presses(frames):
    return [(t, c) for t, _, ks in frames for c, v in ks if v == 1]


def _key(box, ch, down):
    (box.press if down else box.release)(f"key:{HID_CODES[ch]}")


def _settle_keys(cap, want, first_wait=5.0, quiet=1.0, hard=30.0):
    start = time.monotonic()
    while time.monotonic() - start < hard:
        f = cap.peek()
        if len(_presses(f)) >= want:
            break
        if not f and time.monotonic() - start > first_wait:
            break
        if f and mono() - f[-1][0] > quiet:
            break
        time.sleep(0.01)
    return cap.peek()


def _type(box, cap, leg):
    cap.take()
    time.sleep(0.5)
    t0 = mono()
    if leg == "string":
        box.send(f'km.string("{TEXT}")')
    else:
        for ch in TEXT:
            _key(box, ch, True)
            _key(box, ch, False)
    presses = _presses(_settle_keys(cap, len(TEXT)))
    typed = "".join(CODE_TO_CH.get(c, "?") for _, c in presses)
    return {"leg": leg, "typed": typed, "exact": typed == TEXT,
            "secs": round(presses[-1][0] - t0, 3) if presses else None,
            "per_char_ms": round((presses[-1][0] - presses[0][0]) / max(1, len(presses) - 1) * 1e3, 2)
            if len(presses) > 1 else None}


def _merge(ctx):
    node = _key_node(_present(ctx, "hold-q").usb)
    box = ctx.box
    cap = EvCap(node)
    try:
        time.sleep(0.5)
        cap.take()
        box.press(f"key:{HID_A}")
        time.sleep(0.2)
        box.release(f"key:{HID_A}")
        time.sleep(0.3)
        ev = [(round(t, 4), c, v) for t, _, ks in cap.take() for c, v in ks]
        q_held = KEY_Q in _held(node)
    finally:
        cap.close()
    return {"leg": "merge", "events": ev, "q_still_held": q_held}


def _latency(box, cap):
    dl, ul, miss = [], [], 0
    for _ in range(N):
        cap.take()
        t0 = mono()
        box.press(f"key:{HID_A}")
        f = cap.wait(lambda fr: _edges(fr, KEY_A), 0.3)
        e = _edges(f, KEY_A)
        t1 = mono()
        box.release(f"key:{HID_A}")
        f2 = cap.wait(lambda fr: [x for x in _edges(fr, KEY_A) if x[1] == 0], 0.3)
        e2 = [x for x in _edges(f2, KEY_A) if x[1] == 0]
        if e and e2:
            dl.append(e[0][0] - t0)
            ul.append(e2[0][0] - t1)
        else:
            miss += 1
        time.sleep(0.03)
    return {"leg": "latency", "down": stats.summary(dl), "up": stats.summary(ul), "missed": miss}


def _media(box, cap):
    cap.take()
    reply = None
    if box.kind == "stock":
        reply = box.query('km.down("volumeup")')
        box.query('km.up("volumeup")')
    else:
        usage = box.medius.Usage.media(HID_VOLUME_UP)
        try:
            box.device.press(usage)
            time.sleep(0.05)
            box.device.soft_release(usage)
        except box.medius.MediusError as e:
            reply = f"{type(e).__name__}: {e}"
    time.sleep(0.3)
    return {"leg": "media", "reply": reply, "events": [(c, v) for _, _, ks in cap.take() for c, v in ks]}


def run(ctx):
    box = ctx.box
    results, outcomes = [], {}
    if box.lagging():
        ctx.log("one command behind before the run: stopping")
        return {"in_step_before": False, "results": results, "outcomes": outcomes}
    if "hold-q" in ctx.legs:
        r = _merge(ctx)
        results.append(r)
        outcomes["input-held-key-q"] = "Still held" if r["q_still_held"] else "Released"
        ctx.log(f"merge: q still held {r['q_still_held']}")
    else:
        results.append(None)
    node = _key_node(_present(ctx, "idle").usb)
    cap = EvCap(node)
    try:
        time.sleep(0.5)
        results.append(_latency(box, cap))
        ctx.log(f"latency down p50 {results[-1]['down'].get('p50')} up p50 {results[-1]['up'].get('p50')} us")
        if box.kind == "stock":
            results.append(_type(box, cap, "string"))
        else:
            results.append({"leg": "string", "typed": None, "note": "no string command; the box-timed typing "
                                                                    "rows type the same text through a clip"})
        results.append(_media(box, cap))
        r = _type(box, cap, "pairs")
        r["in_step_after"] = not box.lagging()
        results.append(r)
        outcomes["input-typing-pc-pairs"] = "Exact" if r["exact"] else "Characters lost"
        ctx.log(f"pairs: typed {r['typed']!r}, in step after {r['in_step_after']}")
    finally:
        cap.close()
    return {"in_step_before": True, "results": results, "outcomes": outcomes}
