"""Typing 300 characters: capitals, digits and symbols arrive whole, in order, with nothing left held, and how
long it takes. Read on the clone's key node.

The device is a boot keyboard nobody is typing on. The text (300 characters on a US layout) mixes capitals,
lower case, digits, spaces and the symbols ! @ # $ % ^ & * - _ = + [ ] { } ; : . < > / ? ~ ` |, with doubled
letters, digits and symbols. It leaves out the six characters that delimit a stock command line:
, ( ) ' " and backslash. Legs:
  string       stock: km.string("..."), documented for 0-256 ASCII characters and one timed string at a time,
               sent 150 characters per command, each once the last one's characters have arrived (or gone
               quiet for 2 s). Medius has no string command; the PC types through INJECT, as below
  host_paced   the PC types each character as key presses: (left shift down,) key down, key up (, left shift
               up), one change every 10, 4 and 2 ms (stock km.down/km.up with the HID usage, Medius INJECT
               press and soft-release)
  host_burst   Medius only: every change sent back to back at once. Not sent to stock: commands back to back
               at this rate leave its parser one command behind until a power cycle
Characters are decoded from the key codes with the shift state at each press (either shift). Per leg: what was
typed, exact or not, characters delivered, missing / extra / replaced counts and the replaced ones that are the
right key with the wrong shift, the first difference, presses with ctrl, alt or gui held, keys the edges leave
down, keys the PC holds after the leg (EVIOCGKEY) and after cleanup (stock km.init(), which releases keys and
cancels a string; Medius RESET), the time from the first command to the last key edge, characters per second,
and the time between presses. Stock: ERR replies, km.device(), and whether its parser is in step before the run
and after each leg; the run stops at the first leg that leaves it one command behind. Medius: its capabilities."""
import dataclasses
import difflib
import enum
import fcntl
import os
import time

from medius_compare import stats
from medius_compare.capture import EvCap, mono
from medius_compare.devices import kinds_of, usb_nodes

SETTLE_S = 2.5
CHUNK = 150
GAPS_S = (0.010, 0.004, 0.002)
EVIOCGKEY = 0x80604518
LETTERS = "abcdefghijklmnopqrstuvwxyz"
EV_LETTER = [30, 48, 46, 32, 18, 33, 34, 35, 23, 36, 37, 38, 50, 49, 24, 25, 16, 19, 31, 20, 22, 47, 17, 45, 21, 44]
# (HID usage, evdev code, character, shifted character) on a US layout
KEYS = ([(0x04 + i, e, c, c.upper()) for i, (c, e) in enumerate(zip(LETTERS, EV_LETTER))]
        + [(0x1E + i, 2 + i, d, s) for i, (d, s) in enumerate(zip("1234567890", "!@#$%^&*()"))]
        + [(0x2C, 57, " ", " "), (0x2D, 12, "-", "_"), (0x2E, 13, "=", "+"), (0x2F, 26, "[", "{"),
           (0x30, 27, "]", "}"), (0x31, 43, "\\", "|"), (0x33, 39, ";", ":"), (0x34, 40, "'", '"'),
           (0x35, 41, "`", "~"), (0x36, 51, ",", "<"), (0x37, 52, ".", ">"), (0x38, 53, "/", "?")])
CHAR_TO = {}
for _u, _e, _p, _s in KEYS:
    CHAR_TO.setdefault(_p, (_u, False))
    CHAR_TO.setdefault(_s, (_u, True))
DECODE = {**{(e, False): p for _, e, p, _ in KEYS}, **{(e, True): s for _, e, _, s in KEYS}}
SHIFT_HID = 0xE1
SHIFT_EVS = {42, 54}
MOD_EVS = {29, 42, 56, 125, 97, 54, 100, 126}
NAME = {e: p for _, e, p, _ in KEYS}
NAME.update({29: "lctrl", 42: "lshift", 56: "lalt", 125: "lgui", 97: "rctrl", 54: "rshift", 100: "ralt", 126: "rgui"})

BASE1 = ("The Quick Brown Fox Jumps Over 13 Lazy Dogs. PACK MY BOX WITH 5 DOZEN JUGS! "
         "aa BB 00 11 ?? !! zz ZZ ~~ x+y=z; a-b_c: [1] {2} <3> #4 @5 $6 %7 ^8 &9 *0 `~ | / ? ")
BASE2 = "Sphinx Of Black Quartz: Judge My Vow 24680 + 97531 = 122211? Yes! [OK] {DONE} <END> "
TEXT = (BASE1 + BASE2 + BASE1)[:300]
ROWS = {"host_paced_10ms": "input-typing-300-10ms", "host_paced_4ms": "input-typing-300-4ms",
        "host_paced_2ms": "input-typing-300-2ms"}

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


def _jsonable(v):
    if dataclasses.is_dataclass(v):
        return {f.name: _jsonable(getattr(v, f.name)) for f in dataclasses.fields(v)}
    if isinstance(v, enum.Enum):
        return v.name
    if isinstance(v, (bytes, bytearray)):
        return v.hex()
    return v


def _key(box, usage, down):
    (box.press if down else box.release)(f"key:{usage}")


def _changes(text):
    out = []
    for ch in text:
        u, sh = CHAR_TO[ch]
        out += ([(SHIFT_HID, True)] if sh else []) + [(u, True), (u, False)] + ([(SHIFT_HID, False)] if sh else [])
    return out


def _held(node):
    fd = os.open(node, os.O_RDONLY | os.O_NONBLOCK)
    try:
        st = bytearray(96)
        fcntl.ioctl(fd, EVIOCGKEY, st)
    finally:
        os.close(fd)
    return sorted(NAME.get(i, str(i)) for i in range(len(st) * 8) if st[i // 8] >> (i % 8) & 1)


def _key_edges(frames):
    return [(t, c, v) for t, _, ks in frames for c, v in ks if v in (0, 1)]


def _decode(e):
    down, typed, other_mod, unknown = set(), [], 0, 0
    for _, c, v in e:
        if v == 1:
            if c not in MOD_EVS:
                ch = DECODE.get((c, bool(down & SHIFT_EVS)))
                if ch is None:
                    unknown += 1
                    ch = "�"
                if down & (MOD_EVS - SHIFT_EVS):
                    other_mod += 1
                typed.append(ch)
            down.add(c)
        else:
            down.discard(c)
    return "".join(typed), down, other_mod, unknown


def _presses(e):
    return sum(1 for _, c, v in e if v == 1 and c not in MOD_EVS)


def _collect(cap, want, t_sent, first_wait, quiet, hard):
    end = mono() + hard
    while mono() < end:
        e = _key_edges(cap.peek())
        if e:
            if _presses(e) >= want and not _decode(e)[1]:
                break
            if mono() - e[-1][0] > quiet:
                break
        elif mono() - t_sent > first_wait:
            break
        time.sleep(0.01)
    time.sleep(0.2)


def _subsequence(sub, s):
    it = iter(s)
    return all(c in it for c in sub)


def _compare(text, typed):
    sm = difflib.SequenceMatcher(None, text, typed, autojunk=False)
    miss = extra = repl = shift = 0
    for op, i1, i2, j1, j2 in sm.get_opcodes():
        if op == "delete":
            miss += i2 - i1
        elif op == "insert":
            extra += j2 - j1
        elif op == "replace":
            repl += max(i2 - i1, j2 - j1)
            if i2 - i1 == j2 - j1:
                shift += sum(1 for x, y in zip(text[i1:i2], typed[j1:j2])
                             if x != y and CHAR_TO.get(x, (None,))[0] == CHAR_TO.get(y, (-1,))[0])
    first = next((i for i, (x, y) in enumerate(zip(text, typed)) if x != y), None)
    if first is None and len(text) != len(typed):
        first = min(len(text), len(typed))
    return {"missing": miss, "extra": extra, "replaced": repl, "shift_errors": shift, "first_diff": first,
            "around_first_diff": None if first is None else
            {"text": text[max(0, first - 10):first + 10], "typed": typed[max(0, first - 10):first + 10]}}


def _result(box, leg, text, frames, t0, t_sent, node):
    e = _key_edges(frames)
    typed, left, other_mod, unknown = _decode(e)
    pt = [t for t, c, v in e if v == 1 and c not in MOD_EVS]
    secs = (e[-1][0] - t0) if e else None
    return {"leg": leg, "text": text, "text_len": len(text), "typed": typed, "exact": typed == text,
            "delivered": len(typed), "in_order_subsequence": _subsequence(typed, text), **_compare(text, typed),
            "presses": len(pt), "releases": sum(1 for _, c, v in e if v == 0 and c not in MOD_EVS),
            "other_modifier_presses": other_mod, "unknown_codes": unknown,
            "left_down_by_edges": sorted(NAME.get(c, str(c)) for c in left), "held_after": _held(node),
            "secs_to_last_edge": round(secs, 3) if secs is not None else None,
            "send_secs": round(t_sent - t0, 3),
            "chars_per_s": round(len(typed) / secs, 2) if secs else None,
            "between_presses": stats.summary([y - x for x, y in zip(pt, pt[1:])], scale=1e3, unit="ms"),
            "refused": box.drain().count(b"ERR") if box.kind == "stock" else None}


def _cleanup(box, node):
    if box.kind == "stock":
        box.send("km.init()")
    else:
        box.device.reset()
    time.sleep(0.3)
    return _held(node)


def _start(box, cap):
    time.sleep(0.5)
    cap.take()
    if box.kind == "stock":
        box.drain()


def _string(box, cap, node):
    _start(box, cap)
    pieces = [TEXT[i:i + CHUNK] for i in range(0, len(TEXT), CHUNK)]
    t0, sent, info, t_sent = mono(), 0, [], mono()
    for p in pieces:
        line = f'km.string("{p}")'
        t_sent = mono()
        box.send(line)
        sent += len(p)
        _collect(cap, sent, t_sent, first_wait=3.0, quiet=2.0, hard=len(p) * 0.5 + 5.0)
        info.append({"chars": len(p), "line_bytes": len(line) + 2, "sent_at_s": round(t_sent - t0, 3),
                     "presses_by_then": _presses(_key_edges(cap.peek()))})
    rec = _result(box, "string", TEXT, cap.take(), t0, t_sent, node)
    rec.update(command="km.string", chunks=info)
    return rec


def _host(box, cap, node, gap, leg):
    _start(box, cap)
    steps = _changes(TEXT)
    t0 = mono()
    if gap:
        nxt = t0
        for u, d in steps:
            _key(box, u, d)
            nxt += gap
            lead = nxt - mono() - 0.0003
            if lead > 0:
                time.sleep(lead)
            while mono() < nxt:
                pass
    else:
        for u, d in steps:
            _key(box, u, d)
    t_sent = mono()
    _collect(cap, len(TEXT), t_sent, first_wait=3.0, quiet=1.0 if gap else 0.5, hard=30.0)
    rec = _result(box, leg, TEXT, cap.take(), t0, t_sent, node)
    rec.update(command="km.down/km.up" if box.kind == "stock" else "INJECT key press/soft-release",
               gap_ms=round(gap * 1e3, 3), changes=len(steps))
    return rec


def _legs(box, cap, node):
    if box.kind == "stock":
        yield "string", lambda: _string(box, cap, node)
    else:
        yield "string", None
    for g in GAPS_S:
        yield f"host_paced_{g * 1e3:g}ms", lambda g=g: _host(box, cap, node, g, f"host_paced_{g * 1e3:g}ms")
    if box.kind == "medius":
        yield "host_burst", lambda: _host(box, cap, node, 0.0, "host_burst")
    else:
        yield "host_burst", None


def run(ctx):
    box = ctx.box
    node = _key_node(_present(ctx, "keyboard").usb)
    results, outcomes = [], {}
    if box.kind == "stock":
        info = {"in_step_before": not box.lagging()}
        results.append(info)
        if not info["in_step_before"]:
            ctx.log("one command behind before the run: stopping")
            return {"results": results, "outcomes": outcomes}
        info["info"] = box.query("km.device()")
    else:
        results.append({"in_step_before": True, "info": _jsonable(box.device.caps())})
    cap = EvCap(node)
    try:
        for leg, go in _legs(box, cap, node):
            if go is None:
                results.append({"leg": leg, "command": None, "skipped":
                                "no string command; the PC types through INJECT" if leg == "string" else
                                "commands back to back at this rate leave stock's parser one command behind"})
                continue
            rec = go()
            rec["held_after_cleanup"] = _cleanup(box, node)
            rec["in_step_after"] = not box.lagging()
            results.append(rec)
            if leg in ROWS:
                outcomes[ROWS[leg]] = "Exact" if rec["exact"] and not rec["held_after"] else "Characters lost"
            ctx.log(f"{leg}: exact {rec['exact']} delivered {rec['delivered']}/{rec['text_len']} in "
                    f"{rec['secs_to_last_edge']} s, held after {rec['held_after']}, in step {rec['in_step_after']}")
            if not rec["in_step_after"]:
                ctx.log(f"one command behind after {leg}: stopping")
                break
    finally:
        cap.close()
        box.leave()
    return {"results": results, "outcomes": outcomes}
