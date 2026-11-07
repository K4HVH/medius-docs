"""Control requests the box's clone passes to the real device, each against the native sim (lent to the PC hub). The
sim's test requests go to the clone and to the native sim as the same raw control transfer through usbfs, on
endpoint 0 and on a control endpoint above 0: replies of 0 to 4,096 bytes, past wLength and in the status stage,
never answered, answered 100-1,900 ms late, refused partway, paced 5 ms a packet; writes of the same kinds; then a
read while the other pipe holds an unanswered request, a read right after one the PC abandoned, and a read answered
1 s late on interface 1's control endpoint while the PC switches interface 2's setting, which natively leaves it
alone. Both sims must run one build.

Per request: each side's outcome (the usbfs status, the bytes received, partial data before a STALL included) and
time, and whether the clone's matches: outcome and bytes equal, and its reply ≤1.5 ms before or ≤3 ms after
native's (a request native leaves unanswered must time out on the clone too). A clone without the control endpoint
above 0 has its requests there recorded as "no endpoint", against the native sim's answers. The summary counts the
matches per pipe and kind of request.
"""
import ctypes
import fcntl
import time

from medius_shapes import core
from medius_shapes.personalities import builtin, sim_module

IFACE = 1
PID_CTRLEP = 0x614A
PID_SWITCH = 0x614E
T0 = 0xA500                    # endpoint 0 takes the test requests at wIndex 0xA5xx
LATE_MS = 3.0
NEVER = 2.0                    # how long the PC waits on a request the device never answers
TIMEOUT = "timeout"
NO_EP = ("no endpoint", None, None)
_SETINTERFACE = (2 << 30) | (8 << 16) | (ord("U") << 8) | 4

# (label, bRequest, wValue, wLength) of the sim's test requests, reads then writes.
IN = [
    ("read 8", 0x81, 0, 8), ("read 64", 0x81, 0, 64), ("short 32 of 64", 0x83, 0, 64),
    ("big 0", 0x84, 1024, 0), ("big 65", 0x84, 65, 65), ("big 200", 0x84, 200, 200),
    ("big 1024", 0x84, 1024, 1024), ("big 3000", 0x84, 3000, 3000), ("big 4096", 0x84, 4096, 4096),
    ("big 3000 of 4096", 0x84, 3000, 4096), ("big 128 of 200", 0x84, 128, 200),
    ("over 24 of 8", 0x85, 24, 8), ("over 64 of 8", 0x85, 64, 8), ("over 100 of 64", 0x85, 100, 64),
    ("over 24 of 0", 0x85, 24, 0), ("over 8 of 64", 0x85, 8, 64),
    ("part 0 of 8", 0x89, 0, 8), ("part 1 of 200", 0x89, 1, 200), ("part 3 of 200", 0x89, 3, 200),
    ("paced 5 ms, 200", 0x8A, 5, 200), ("paced 5 ms, 0", 0x8A, 5, 0),
    ("late 100", 0x88, 100, 8), ("late 450", 0x88, 450, 8), ("late 550", 0x88, 550, 8),
    ("late 1000", 0x88, 1000, 8), ("late 1900", 0x88, 1900, 8),
    ("never", 0x87, 0, 8), ("unknown", 0x99, 0, 8),
]
OUT = [
    ("write 0", 0x02, 0, 0), ("write 16", 0x02, 0, 16), ("write 64", 0x02, 0, 64), ("write 1024", 0x02, 0, 1024),
    ("reply 8 in status", 0x06, 8, 0), ("reply 8 after 16", 0x06, 8, 16), ("reply 0 after 16", 0x06, 0, 16),
    ("part 0 of 8", 0x09, 0, 8), ("part 1 of 200", 0x09, 1, 200),
    ("paced 5 ms, 200", 0x0A, 5, 200), ("paced 5 ms, 0", 0x0A, 5, 0),
    ("late 100", 0x08, 100, 0), ("late 550", 0x08, 550, 0), ("late 1900", 0x08, 1900, 0),
    ("never 0", 0x07, 0, 0), ("never 16", 0x07, 0, 16), ("unknown", 0x19, 0, 0),
]
# Each request's kind, from the first word of its label, for the counts; a write's apart from a read's.
KINDS_IN = {"read": "reads", "short": "reads", "big": "reads", "over": "past wLength", "part": "refused",
            "unknown": "refused", "paced": "paced", "late": "late", "never": "never answered"}
KINDS_OUT = {"write": "writes", "reply": "writes", "part": "writes refused", "unknown": "writes refused",
             "paced": "writes paced", "late": "writes late", "never": "writes never answered"}


class Blocked(Exception):
    """The bench can't make the comparison."""


class CloneMissing(Exception):
    """The native sim came up as the device and the clone did not."""


def fresh_mouse():
    """A still mouse no other shape matches, so the first device is a new one to the box."""
    return core.personality(0x62CF, core.cfg(1, core.MOUSE_IF), [core.EndpointSpec(0x81, 3, 1, 8, 3)])


def switch_personality(pid=PID_SWITCH):
    """A mouse; control endpoint 0x82 on vendor interface 1; vendor interface 2, whose alternate setting 1 adds an
    interrupt IN: a SET_INTERFACE on interface 2 changes the device's endpoints and nothing on interface 1."""
    cfg = bytes([9, 2, 75, 0, 3, 1, 0, 0xA0, 50,
                 9, 4, 0, 0, 1, 3, 1, 2, 0,
                 9, 0x21, 0x11, 0x01, 0, 1, 0x22, len(core.MOUSE_DESC), 0,
                 7, 5, 0x81, 0x03, 8, 0, 1,
                 9, 4, 1, 0, 1, 0xFF, 0, 0, 0,
                 7, 5, 0x82, 0x00, 64, 0, 0,
                 9, 4, 2, 0, 0, 0xFF, 0, 0, 0,
                 9, 4, 2, 1, 1, 0xFF, 0, 0, 0,
                 7, 5, 0x83, 0x03, 8, 0, 1])
    return core.Personality(speed=core.SPEED_FULL, device=core.device_desc(core.VID, pid, 1), configs=[cfg],
                            hid_report=core.MOUSE_DESC,
                            endpoints=[core.EndpointSpec(0x81, 3, 1, 8, 3), core.EndpointSpec(0x82, 0, 1, 64),
                                       core.EndpointSpec(0x83, 3, 1, 8, 8, alt=1)],
                            hooks=core.EnumHooks(), alt_model=1)


SHAPES = {"fresh_mouse": fresh_mouse, "switch_personality": switch_personality}


def pipes():
    """Each pipe under test: (name, endpoint, wIndex)."""
    return [("ep0", 0, T0), ("ep2", 2, IFACE)]


def _node(port, pid=None):
    base = f"/sys/bus/usb/devices/{port}"
    try:
        with open(f"{base}/idProduct") as f:
            if pid is not None and int(f.read(), 16) != pid:
                return None
        with open(f"{base}/bConfigurationValue") as f:
            if f.read().strip() in ("", "0"):
                return None
        with open(f"{base}/busnum") as f:
            bus = int(f.read())
        with open(f"{base}/devnum") as f:
            dev = int(f.read())
    except (OSError, ValueError):
        return None
    return f"/dev/bus/usb/{bus:03d}/{dev:03d}"


def _present(links, ports, what, pid, timeout=40.0):
    before = [_node(p) for p in ports]
    for link in links:
        if isinstance(what, (tuple, list)):
            link.present_builtin(builtin(what[0]), *what[1:], settle=0.3)
        else:
            link.present(what, settle=0.5)
    end, got = time.time() + timeout, (None, None)
    while time.time() < end:
        got = tuple(_node(p, pid) for p in ports)
        if all(n and n != b for n, b in zip(got, before)):
            time.sleep(1.0)
            return got
        time.sleep(0.1)
    # A box skips re-cloning a byte-identical device, so an unchanged node there is the device asked for.
    if all(got):
        return got
    if got[1]:
        raise CloneMissing(f"{pid:04x} came up on the native sim, and the clone did not")
    raise Blocked(f"{pid:04x} did not come up on both sides")


def _ep_addr_of(node, want):
    try:
        with open(node, "rb") as f:
            blob = f.read(1024)
    except OSError:
        return False
    i, n = 18, len(blob)
    while i + 2 <= n and blob[i] >= 2:
        if blob[i + 1] == 5 and blob[i] >= 7 and blob[i + 2] == want:
            return True
        i += blob[i]
    return False


def _control(d, ep, bm, rq, wv, wi, arg, timeout=3.0):
    is_in = bool(bm & 0x80)
    urb, _buf = d.submit_control(ep, bm, rq, wv, wi, arg)
    t, a = time.monotonic(), ctypes.addressof(urb)
    while True:
        try:
            addr, st, data = d.reap(timeout=max(0.0, timeout - (time.monotonic() - t)))
        except TimeoutError:
            d.discard(urb)
            try:
                d.reap(timeout=1.0)
            except TimeoutError:
                pass
            return TIMEOUT, b"", round((time.monotonic() - t) * 1000, 2)
        if addr == a:
            return (-st if st else 0), (data if is_in else len(data)), round((time.monotonic() - t) * 1000, 2)


def _open_pair(nodes, iface):
    usbfs = sim_module("usbfs")
    devs = []
    for n in nodes:
        d = usbfs.RawDevice(n)
        d.claim(iface)
        devs.append(d)
    return devs


def _result(r):
    st, d, ms = r
    return {"status": st, "bytes": d.hex() if isinstance(d, bytes) and len(d) <= 32 else
            (f"{len(d)} B" if isinstance(d, bytes) else d), "ms": ms}


def matches(c, n):
    (cs, cd, cms), (ns, nd, nms) = c, n
    if cs != ns or cd != nd:
        return False
    return ns == TIMEOUT or nms - 1.5 <= cms <= nms + LATE_MS


def kind(row):
    pipe, _, rest = row["case"].partition(" ")
    if " across " in rest:
        return pipe, "across a setting switch"
    if " while " in rest:
        return pipe, "beside an unanswered request"
    if " after one the PC abandoned" in rest:
        return pipe, "after an abandoned request"
    word = rest.split()[0]
    return pipe, (KINDS_OUT if row.get("dir") == "out" else KINDS_IN).get(word, word)


def summarize(rows):
    out = {"cases": len(rows), "same": sum(bool(r["match"]) for r in rows), "kinds": {}}
    for r in rows:
        pipe, k = kind(r)
        g = out["kinds"].setdefault(pipe, {}).setdefault(k, {"cases": 0, "same": 0})
        g["cases"] += 1
        g["same"] += bool(r["match"])
    return out


def _run_pair(ctx, rows, label, devs, has, ep, bm, rq, wv, wi, arg, timeout=NEVER):
    if ep and not has:
        c, n = NO_EP, _control(devs[1], ep, bm, rq, wv, wi, arg, timeout)
    else:
        c, n = (_control(d, ep, bm, rq, wv, wi, arg, timeout) for d in devs)
    rows.append({"case": label, "dir": "in" if bm & 0x80 else "out", "clone": _result(c), "native": _result(n),
                 "match": matches(c, n)})
    ctx.log(f"{label:44s} {'same' if rows[-1]['match'] else 'DIFF'}  clone {_result(c)}  native {_result(n)}")


def _open_ctrlep(links, ports, addr):
    usbfs = sim_module("usbfs")
    nodes = _present(links, ports, ("ctrlep", addr), PID_CTRLEP)
    if not _ep_addr_of(nodes[1], addr):
        raise Blocked(f"the native sim has no endpoint {addr:#04x}")
    if _ep_addr_of(nodes[0], addr):
        return _open_pair(nodes, IFACE), True
    return [usbfs.RawDevice(nodes[0])] + _open_pair(nodes[1:], IFACE), False


def _requests(ctx, links, ports, rows):
    devs, has = _open_ctrlep(links, ports, 0x82)
    try:
        for name, ep, wi in pipes():
            for label, rq, wv, wl in IN:
                _run_pair(ctx, rows, f"{name} {label}", devs, has, ep, 0xC0 | (ep and 1), rq, wv, wi, wl)
        for (hn, hep, hwi), (un, uep, uwi) in ((pipes()[1], pipes()[0]), (pipes()[0], pipes()[1])):
            res = []
            for d in devs:
                if d is devs[0] and not has:
                    res.append(NO_EP)
                    continue
                # The held request: endpoint 2 never answers its read; endpoint 0's is answered 3 s late.
                rq, wv = (0x87, 0) if hep else (0x88, 3000)
                urb, _ = d.submit_control(hep, 0xC0 | (hep and 1), rq, wv, hwi, 8)
                time.sleep(0.02)
                res.append(_control(d, uep, 0xC0 | (uep and 1), 0x81, 0, uwi, 8))
                d.discard(urb)
                try:
                    d.reap(timeout=1.0)
                except TimeoutError:
                    pass
            rows.append({"case": f"{un} read while {hn} holds an unanswered request", "clone": _result(res[0]),
                         "native": _result(res[1]), "match": matches(res[0], res[1])})
        for name, ep, wi in pipes():
            bm, res = 0xC0 | (ep and 1), []
            for d in devs:
                if ep and d is devs[0] and not has:
                    res.append(NO_EP)
                    continue
                urb, _ = d.submit_control(ep, bm, 0x88, 100, wi, 8)
                time.sleep(0.02)
                d.discard(urb)
                try:
                    d.reap(timeout=1.0)
                except TimeoutError:
                    pass
                res.append(_control(d, ep, bm, 0x81, 0, wi, 8))
            rows.append({"case": f"{name} read after one the PC abandoned", "clone": _result(res[0]),
                         "native": _result(res[1]), "match": matches(res[0], res[1])})
    finally:
        for d in devs:
            d.close()
    devs, has = _open_ctrlep(links, ports, 0x02)
    try:
        for name, ep, wi in pipes():
            for label, rq, wv, wl in OUT:
                data = bytes((i * 7 + wl) & 0xFF for i in range(wl))
                _run_pair(ctx, rows, f"{name} {label}", devs, has, ep, 0x40 | (ep and 1), rq, wv, wi, data)
    finally:
        for d in devs:
            d.close()


def _across_switch(d, alt):
    urb, _ = d.submit_control(2, 0xC1, 0x88, 1000, IFACE, 8)
    t, a = time.monotonic(), ctypes.addressof(urb)
    time.sleep(0.05)
    fcntl.ioctl(d.fd, _SETINTERFACE, (2).to_bytes(4, "little") + alt.to_bytes(4, "little"))
    while True:
        try:
            addr, st, data = d.reap(timeout=max(0.0, 3.0 - (time.monotonic() - t)))
        except TimeoutError:
            d.discard(urb)
            try:
                d.reap(timeout=1.0)
            except TimeoutError:
                pass
            return TIMEOUT, b"", round((time.monotonic() - t) * 1000, 2)
        if addr == a:
            return (-st if st else 0), data, round((time.monotonic() - t) * 1000, 2)


def _switching(links, ports, rows):
    usbfs = sim_module("usbfs")
    nodes = _present(links, ports, switch_personality(), PID_SWITCH)
    if not _ep_addr_of(nodes[1], 0x82):
        raise Blocked("the native sim has no endpoint 0x82")
    has = bool(_ep_addr_of(nodes[0], 0x82))
    devs = [usbfs.RawDevice(n) for n in nodes]
    try:
        for d in devs if has else devs[1:]:
            d.claim(IFACE)
            d.claim(2)
        for alt in (1, 0):
            res = [_across_switch(d, alt) if d is not devs[0] or has else NO_EP for d in devs]
            rows.append({"case": f"ep2 read across interface 2 switching to setting {alt}", "dir": "in",
                         "clone": _result(res[0]), "native": _result(res[1]), "match": matches(res[0], res[1])})
    finally:
        for d in devs:
            d.close()


def run(ctx):
    ports = [ctx.device("start").usb, ctx.native("start").usb]
    links = [ctx.sim()]
    rows = []
    out = {"rows": rows}
    try:
        links.append(ctx.sim("native"))
        builds = [(link.diag() or {}).get("build") for link in links]
        if None in builds or builds[0] != builds[1]:
            raise RuntimeError(f"the sims run different builds ({builds}); flash both with one build")
        out["sim_build"] = builds[0]
        try:
            _requests(ctx, links, ports, rows)
            _switching(links, ports, rows)
        except CloneMissing as e:
            out["clone_missing"] = str(e)
            ctx.log(f"clone missing: {e}")
    finally:
        for link in links:
            link.close()
    out["summary"] = summarize(rows)
    ctx.log(f"{out['summary']['same']}/{len(rows)} as the native sim answers them")
    return out
