"""Injected mouse buttons and keys: every press and release arrives, in order, and nothing stays held. Read on
the clone's evdev nodes.

Mouse (five buttons, still):
  single   right, middle, side1 (BTN_SIDE) and side2 (BTN_EXTRA), each pressed and released 20 times, each
           edge awaited before the next command: write-to-edge latency, presses and releases missed, edges on
           any other button
  chord    the four pressed 25 ms apart, held 0.15 s, released 25 ms apart in the same order and in reverse on
           alternate reps, 5 reps: the edges in the order sent, all held at once, none after
Keyboards, each silent but for one empty report every 2 s: a boot keyboard (six key slots) and an NKRO keyboard
(a modifier byte and a bitmap of usages 0-0x67, on a non-boot interface):
  mods     each of the eight modifiers, then left ctrl+shift+alt+gui together: modifiers down, J down, J up,
           modifiers up in reverse, 25 ms apart, 5 reps: edges in the order sent, the modifiers held when J went
           down, nothing held after
  roll     N letters pressed 25 ms apart, held 0.3 s, released 25 ms apart in the same order, 5 reps. N is 6
           and 8 on the boot keyboard (8 is past its six slots) and 6, 10 and 20 on the NKRO one
Stock gets km.right/middle/side1/side2 and km.down/km.up with the HID usage as a number (modifiers 224-231);
Medius INJECT press and soft-release. Each leg reads what the PC holds (EVIOCGKEY) after its last release,
then releases everything it used and reads again. Stock: ERR replies per leg, and whether its parser is in step
before and after each device; the sweep stops at the first device that leaves it one command behind.
Edges are key events of value 0 or 1."""
import dataclasses
import enum
import fcntl
import os
import time

from medius_compare import stats
from medius_compare.capture import EvCap, mono, pointer_node
from medius_compare.devices import kinds_of, usb_nodes
from medius_shapes.core import EndpointSpec, GEN_SCRIPT, Personality, Pump, SPEED_FULL, device_desc, hid, script
from medius_shapes.scripted import VID, keys, scripted_keyboard

EVIOCGKEY = 0x80604518
SETTLE_S = 2.0
N = 20
REPS = 5
GAP_S = 0.025
BUTTONS = ("right", "middle", "side1", "side2")
BTN = {"left": 0x110, "right": 0x111, "middle": 0x112, "side1": 0x113, "side2": 0x114}
LETTERS = "abcdefghijklmnopqrstuvwxyz"
EV_LETTER = [30, 48, 46, 32, 18, 33, 34, 35, 23, 36, 37, 38, 50, 49, 24, 25, 16, 19, 31, 20, 22, 47, 17, 45, 21, 44]
HID_OF = {c: 0x04 + i for i, c in enumerate(LETTERS)}
EV_OF = dict(zip(LETTERS, EV_LETTER))
MODS = [("lctrl", 0xE0, 29), ("lshift", 0xE1, 42), ("lalt", 0xE2, 56), ("lgui", 0xE3, 125),
        ("rctrl", 0xE4, 97), ("rshift", 0xE5, 54), ("ralt", 0xE6, 100), ("rgui", 0xE7, 126)]
COMBOS = [(n, [(n, u, e)]) for n, u, e in MODS] + [("lctrl+lshift+lalt+lgui", MODS[:4])]
ROLL = "asdfghjklqwertyuiopzxcvbnm"
NAME = {e: c for c, e in EV_OF.items()}
NAME.update({e: n for n, _, e in MODS})
NAME.update({c: n for n, c in BTN.items()})
SIZES = {"boot": (6, 8), "nkro": (6, 10, 20)}

# A keyboard reporting every key as one bit: the modifier byte, then usages 0x00-0x67 (104 bits), 14 bytes.
NKRO_DESC = bytes([
    0x05, 0x01, 0x09, 0x06, 0xA1, 0x01,
    0x05, 0x07, 0x19, 0xE0, 0x29, 0xE7, 0x15, 0x00, 0x25, 0x01, 0x75, 0x01, 0x95, 0x08, 0x81, 0x02,
    0x19, 0x00, 0x29, 0x67, 0x95, 0x68, 0x81, 0x02,
    0xC0,
])
NKRO_LEN = 14


def nkro_keyboard(pid=0x7272):
    """The NKRO keyboard on a non-boot interface, one empty report every 2 s."""
    iface = (bytes([9, 4, 0, 0, 1, 3, 0, 0, 0]) + hid(len(NKRO_DESC)) + bytes([7, 5, 0x81, 0x03, 16, 0, 1]))
    total = 9 + len(iface)
    cfg = bytes([9, 2, total & 0xFF, total >> 8, 1, 1, 0, 0xA0, 50]) + iface
    return Personality(speed=SPEED_FULL, device=device_desc(VID, pid, 1), configs=[cfg],
                       strings=[bytes([4, 0x03, 0x09, 0x04])], hid_report=NKRO_DESC,
                       endpoints=[EndpointSpec(addr=0x81, xfer=3, config=1, declared_mps=16, emit_size=NKRO_LEN)],
                       pump=Pump(ep=0x81, interval_us=1000, gen=GEN_SCRIPT),
                       script=script([(1, bytes(NKRO_LEN)), (1999, b"")]))


SHAPES = {
    "boot": lambda: scripted_keyboard(0x7271, [(1, keys()), (1999, b"")]),
    "nkro": nkro_keyboard,
}

_settled = []


def _present(ctx, leg):
    p = ctx.device(leg)
    if not any(q is p for q in _settled):
        _settled.append(p)
        time.sleep(SETTLE_S)
    return p


def _node(port, kind, timeout=10.0):
    end = time.monotonic() + timeout
    while True:
        nodes = usb_nodes(port)
        node = pointer_node(nodes) if kind == "mouse" else next(
            (n for n in nodes if "/input/" in n and "keyboard" in kinds_of(n)), None)
        if node:
            return node
        if time.monotonic() > end:
            raise RuntimeError(f"no {kind} node on {port}")
        time.sleep(0.1)


def _jsonable(v):
    if dataclasses.is_dataclass(v):
        return {f.name: _jsonable(getattr(v, f.name)) for f in dataclasses.fields(v)}
    if isinstance(v, enum.Enum):
        return v.name
    if isinstance(v, (bytes, bytearray)):
        return v.hex()
    return v


def _held(node):
    fd = os.open(node, os.O_RDONLY | os.O_NONBLOCK)
    try:
        st = bytearray(96)
        fcntl.ioctl(fd, EVIOCGKEY, st)
    finally:
        os.close(fd)
    return {i for i in range(len(st) * 8) if st[i // 8] >> (i % 8) & 1}


def _edges(frames):
    return [(t, c, v) for t, _, ks in frames for c, v in ks if v in (0, 1)]


def _names(codes):
    return [NAME.get(c, str(c)) for c in sorted(codes)]


def _named(pairs):
    return [f"{NAME.get(c, str(c))}{'+' if v else '-'}" for c, v in pairs]


def _refused(box):
    return box.drain().count(b"ERR") if box.kind == "stock" else None


def _key(box, usage, down):
    (box.press if down else box.release)(f"key:{usage}")


def _info(box):
    try:
        if box.kind == "stock":
            return box.query("km.device()")
        return _jsonable(box.device.caps())
    except Exception as e:
        return f"{type(e).__name__}: {e}"


def _single(box, cap, node, name):
    code = BTN[name]
    time.sleep(0.3)
    _refused(box)
    dl, ul, miss_d, miss_u, other = [], [], 0, 0, []
    for _ in range(N):
        cap.take()
        t0 = mono()
        box.press(name)
        cap.wait(lambda fr: any(c == code and v == 1 for _, c, v in _edges(fr)), 0.3)
        t1 = mono()
        box.release(name)
        f = cap.wait(lambda fr: any(c == code and v == 0 and t > t1 for t, c, v in _edges(fr)), 0.3)
        e = _edges(f)
        d = [t for t, c, v in e if c == code and v == 1 and t > t0]
        u = [t for t, c, v in e if c == code and v == 0 and t > t1]
        other += [(c, v) for _, c, v in e if c != code]
        if d:
            dl.append(d[0] - t0)
        else:
            miss_d += 1
        if u:
            ul.append(u[0] - t1)
        else:
            miss_u += 1
        time.sleep(0.03)
    time.sleep(0.1)
    after = _held(node) & set(BTN.values())
    box.release(name)
    time.sleep(0.1)
    return {"device": "mouse", "leg": "single", "button": name, "n": N, "press": stats.summary(dl),
            "release": stats.summary(ul), "missed_press": miss_d, "missed_release": miss_u,
            "other_edges": _named(other), "held_after": _names(after),
            "held_after_cleanup": _names(_held(node) & set(BTN.values())), "refused": _refused(box)}


def _chord(box, cap, node):
    codes = set(BTN.values())
    _refused(box)
    reps = []
    for rep in range(REPS):
        up_order = BUTTONS if rep % 2 == 0 else BUTTONS[::-1]
        time.sleep(0.2)
        cap.take()
        for n in BUTTONS:
            box.press(n)
            time.sleep(GAP_S)
        time.sleep(0.15)
        peak = _held(node) & codes
        for n in up_order:
            box.release(n)
            time.sleep(GAP_S)
        time.sleep(0.15)
        after = _held(node) & codes
        e = [(c, v) for _, c, v in _edges(cap.take()) if c in codes]
        want = [(BTN[n], 1) for n in BUTTONS] + [(BTN[n], 0) for n in up_order]
        for n in BUTTONS:
            box.release(n)
        time.sleep(0.1)
        reps.append({"release_order": list(up_order), "in_order": e == want, "edges": _named(e),
                     "held_at_peak": _names(peak), "all_held_at_peak": peak == {BTN[n] for n in BUTTONS},
                     "held_after": _names(after), "held_after_cleanup": _names(_held(node) & codes)})
    return {"device": "mouse", "leg": "chord", "buttons": list(BUTTONS), "reps": reps,
            "in_order": sum(r["in_order"] for r in reps), "all_held": sum(r["all_held_at_peak"] for r in reps),
            "left_held": sum(1 for r in reps if r["held_after"]), "refused": _refused(box)}


def _release_keys(box, usages):
    for u in usages:
        _key(box, u, False)
        time.sleep(0.003)
    time.sleep(0.1)


def _mods(box, cap, node, dev):
    j_hid, j_ev = HID_OF["j"], EV_OF["j"]
    out = []
    for label, mods in COMBOS:
        _refused(box)
        mod_evs = {e for _, _, e in mods}
        reps = []
        for _ in range(REPS):
            steps = ([(u, True) for _, u, _ in mods] + [(j_hid, True), (j_hid, False)]
                     + [(u, False) for _, u, _ in reversed(mods)])
            want = ([(e, 1) for _, _, e in mods] + [(j_ev, 1), (j_ev, 0)] + [(e, 0) for _, _, e in reversed(mods)])
            time.sleep(0.15)
            cap.take()
            for u, d in steps:
                _key(box, u, d)
                time.sleep(GAP_S)
            time.sleep(0.15)
            after = _held(node)
            e = [(c, v) for _, c, v in _edges(cap.take())]
            hs, at_j = set(), None
            for c, v in e:
                if c == j_ev and v == 1 and at_j is None:
                    at_j = set(hs)
                (hs.add if v else hs.discard)(c)
            _release_keys(box, [u for _, u, _ in mods] + [j_hid])
            reps.append({"in_order": e == want, "edges": _named(e),
                         "mods_held_at_j": _names(at_j) if at_j is not None else None,
                         "mods_ok_at_j": at_j is not None and (at_j & {x for _, _, x in MODS}) == mod_evs,
                         "held_after": _names(after), "held_after_cleanup": _names(_held(node))})
        out.append({"device": dev, "leg": "mods", "mods": label, "reps": reps,
                    "in_order": sum(x["in_order"] for x in reps), "mods_ok_at_j": sum(x["mods_ok_at_j"] for x in reps),
                    "left_held": sum(1 for x in reps if x["held_after"]), "refused": _refused(box)})
    return out


def _roll(box, cap, node, dev, n):
    letters = ROLL[:n]
    sent = {EV_OF[c] for c in letters}
    _refused(box)
    reps = []
    for _ in range(REPS):
        time.sleep(0.2)
        cap.take()
        for c in letters:
            _key(box, HID_OF[c], True)
            time.sleep(GAP_S)
        time.sleep(0.3)
        peak = _held(node)
        for c in letters:
            _key(box, HID_OF[c], False)
            time.sleep(GAP_S)
        time.sleep(0.2)
        after = _held(node)
        e = [(c, v) for _, c, v in _edges(cap.take())]
        want = [(EV_OF[c], 1) for c in letters] + [(EV_OF[c], 0) for c in letters]
        _release_keys(box, [HID_OF[c] for c in letters])
        reps.append({"in_order": e == want,
                     "presses": "".join(NAME.get(c, "?") for c, v in e if v == 1 and c in sent),
                     "releases": "".join(NAME.get(c, "?") for c, v in e if v == 0 and c in sent),
                     "unsent_edges": _named([(c, v) for c, v in e if c not in sent]),
                     "held_at_peak": _names(peak), "all_held_at_peak": sent <= peak,
                     "held_after": _names(after), "held_after_cleanup": _names(_held(node))})
    return {"device": dev, "leg": "roll", "n": n, "keys": letters, "reps": reps,
            "in_order": sum(x["in_order"] for x in reps), "all_held": sum(x["all_held_at_peak"] for x in reps),
            "left_held": sum(1 for x in reps if x["held_after"]), "refused": _refused(box)}


def _sweep(ctx, results):
    box = ctx.box
    for dev in ("mouse", "boot", "nkro"):
        if dev not in ctx.legs:
            continue
        port = _present(ctx, dev).usb
        info = {"device": dev, "info": None, "in_step_before": not box.lagging()}
        results.append(info)
        if not info["in_step_before"]:
            ctx.log(f"one command behind before the {dev}: stopping")
            return False
        info["info"] = _info(box)
        node = _node(port, "mouse" if dev == "mouse" else "keyboard")
        cap = EvCap(node)
        try:
            if dev == "mouse":
                for name in BUTTONS:
                    results.append(_single(box, cap, node, name))
                results.append(_chord(box, cap, node))
            else:
                results.extend(_mods(box, cap, node, dev))
                for n in SIZES[dev]:
                    results.append(_roll(box, cap, node, dev, n))
        finally:
            cap.close()
        info["in_step_after"] = not box.lagging()
        ctx.log(f"{dev}: done, in step after {info['in_step_after']}")
        if not info["in_step_after"]:
            return False
    return True


def _find(results, **match):
    return [r for r in results if r and all(r.get(k) == v for k, v in match.items())]


def _outcomes(results):
    out = {}
    single = _find(results, leg="single")
    if len(single) == len(BUTTONS):
        ok = all(r["missed_press"] == 0 and r["missed_release"] == 0 for r in single)
        out["input-bk-buttons"] = "All arrive" if ok else "Some lost"
    for dev, row in (("boot", "input-bk-mods-boot"), ("nkro", "input-bk-mods-nkro")):
        mods = _find(results, device=dev, leg="mods")
        if len(mods) == len(COMBOS):
            out[row] = "All arrive" if all(r["mods_ok_at_j"] == REPS for r in mods) else "Some lost"
    for row, match in (("input-bk-mouse-chord", dict(leg="chord")),
                       ("input-bk-boot-6", dict(device="boot", n=6)),
                       ("input-bk-nkro-10", dict(device="nkro", n=10)),
                       ("input-bk-nkro-20", dict(device="nkro", n=20))):
        found = _find(results, **match)
        if found:
            r = found[0]
            out[row] = "All arrive" if r["all_held"] == REPS and r["in_order"] == REPS else "Some lost"
    boot8 = _find(results, device="boot", n=8)
    if boot8:
        late = all({"j", "k"} <= set(rep["presses"]) for rep in boot8[0]["reps"])
        out["input-bk-boot-8"] = "Last 2 pressed once a key is up" if late else "Last 2 refused"
    return out


def run(ctx):
    results = []
    try:
        _sweep(ctx, results)
    finally:
        ctx.box.leave()
    return {"results": results, "outcomes": _outcomes(results)}
