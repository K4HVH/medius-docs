"""Standard control requests across device stacks. The sim plays one device stack at a time (medius_shapes.ep0_stacks:
a mouse, a vendor-page HID interface and a vendor interface carrying a class descriptor, answering as each stack
does: the direction bit acted on or refused, recipients read from five bits or two, wLength rules, LUFA, STM32's
library, V-USB, CherryUSB, a stack leaving device-to-host requests with no data stage unanswered, one padding its
replies, one answering long reads from its buffer and SET_DESCRIPTOR only after a read, and the rest). The 22 stacks
are those whose device neither dies, swaps nor falls a reply behind under the reads.

Each stack is presented on the native sim (lent to the PC hub) and read, then on the box's sim and its clone read the
same way: 316 requests that change nothing, as raw control transfers through usbfs with every interface taken from its
kernel driver, each given 1 s. Outcome, the PC's error and every byte must match native. A reply past wLength reads
as an overrun on both sides where the stack is written to give one. A timeout counts only where the native request
times out too. SET_ADDRESS is never sent. Per stack: how many requests the clone gives the native reply, and which
differ (a stack that isn't cloned gives none).
"""
import ctypes
import fcntl
import os
import struct
import time

from medius_shapes import core, ep0_stacks
from medius_shapes.core import (Q_DIR_STRICT, Q_IFREQ_STALL, Q_OUT_REPLY, Q_OVERRUN, Q_WLEN_CONFIG, Q_WLEN_SHORT,
                                Q_WLEN_STATUS, Q_ZLP_IFZERO)
from medius_shapes.personalities import sim_module

KINDS = ["permissive", "strict", "twobit", "lax", "hidown", "laxstrict", "wlenstatus", "wlenconfig", "wlenshort",
         "epdesc", "rwtaken", "rwrefused", "in0nak", "in0strict", "ifstrict", "lufa", "stm32", "vusb", "cherry",
         "twolimit", "padded", "longbuf"]
PID0 = 0x7300
SECS = 30.0
IFACES, ENDPOINTS = (0, 1, 2), (0x00, 0x80, 0x81, 0x82)
STD_DIR = {0: 0x80, 6: 0x80, 8: 0x80, 10: 0x80, 12: 0x80, 1: 0, 3: 0, 5: 0, 7: 0, 9: 0, 11: 0}
STALL, TIMEOUT, OVER = "stall", "timeout", "overrun"

_U = ord("U")
_IOCTL = (3 << 30) | (16 << 16) | (_U << 8) | 18
_GETDRIVER = (1 << 30) | (260 << 16) | (_U << 8) | 8
_DISCONNECT = (_U << 8) | 22


def fresh_mouse():
    """A still mouse no stack matches, so the first stack is a new device to the box."""
    return core.personality(0x62CF, core.cfg(1, core.MOUSE_IF), [core.EndpointSpec(0x81, 3, 1, 8, 3)])


SHAPES = {"fresh_mouse": fresh_mouse}


def reads(total):
    """The requests: (bmRequestType, bRequest, wValue, wIndex, wLength), for a configuration `total` bytes long."""
    r = []
    for wl in (0, 1, 2, 8, 64, 255):
        r.append((0x80, 0, 0, 0, wl))
    r += [(0x80, 0, 1, 0, 2), (0x80, 0, 0, 1, 2), (0x00, 0, 0, 0, 0), (0x00, 0, 0, 0, 2)]
    r += [(0x80, 8, 0, 0, wl) for wl in (0, 1, 2, 8, 64)] + [(0x80, 8, 1, 0, 1), (0x00, 8, 0, 0, 0), (0x00, 8, 0, 0, 1)]
    for wl in (0, 1, 7, 8, 9, 17, 18, 19, 64, 255):
        r.append((0x80, 6, 0x0100, 0, wl))
    r += [(0x80, 6, 0x0100 | i, 0, 18) for i in (1, 5, 0xFF)] + [(0x80, 6, 0x0100, 0x0409, 18)]
    for wl in sorted({0, 1, 8, 9, 10, total - 1, total, total + 1, 255}):
        r.append((0x80, 6, 0x0200, 0, wl))
    r += [(0x80, 6, 0x0201, 0, 255), (0x80, 6, 0x02FF, 0, 255), (0x80, 6, 0x0200, 1, 255)]
    r += [(0x80, 6, 0x0300 | i, 0x0409 if i else 0, 255) for i in (0, 1, 2, 3, 4, 9, 0xEE, 0xFF)]
    r += [(0x80, 6, 0x0301, lang, 255) for lang in (0, 0x0407, 0xDEAD)] + [(0x80, 6, 0x0301, 0x0409, 2)]
    r += [(0x80, 6, t << 8, 0, 255) for t in (4, 5, 6, 7, 8, 9, 0x0A, 0x0B, 0x0F, 0x10, 0x21, 0x22, 0x23, 0x29,
                                              0x40, 0x7F, 0xFF)]
    r += [(0x00, 6, 0x0100, 0, 0), (0x00, 6, 0x0100, 0, 18), (0x00, 6, 0x0200, 0, 0), (0x00, 6, 0x0301, 0x0409, 0)]
    r += [(0x00, 1, s, 0, 0) for s in (0, 2, 0xFF)] + [(0x00, 3, s, 0, 0) for s in (0, 3)]
    r += [(0x00, 7, 0x0100, 0, 0), (0x00, 7, 0x0100, 0, 18), (0x80, 7, 0x0100, 0, 18)]
    # SET_DESCRIPTOR after a read, after itself (a write), either way round, at an interface, and with a data stage.
    dev18 = (0x80, 6, 0x0100, 0, 18)
    r += [dev18, (0x00, 7, 0x7F00, 0, 0), (0x00, 7, 0x7F00, 0, 0), dev18, (0x80, 7, 0x0100, 0, 18),
          (0x00, 7, 0x0100, 0, 0), (0x80, 0, 0, 0, 2), (0x01, 7, 0x0100, 0, 0), dev18, (0x00, 7, 0x0100, 0, 1)]
    r += [(0x80, 10, 0, 0, 1), (0x00, 11, 0, 0, 0), (0x80, 12, 0, 0, 2)]
    for q in (2, 4, 13, 14, 15, 16, 0x1F, 0x30, 0x80, 0xFF):
        r += [(0x80, q, 0, 0, 2), (0x00, q, 0, 0, 0)]
    for i in (0, 1, 2):
        r += [(0x81, 0, 0, i, 2), (0x81, 0, 0, i, 0), (0x01, 0, 0, i, 0), (0x81, 0, 1, i, 2), (0x81, 0, 0, i, 64)]
        r += [(0x01, 1, 0, i, 0), (0x01, 3, 0, i, 0), (0x01, 3, 1, i, 0)]
        r += [(0x81, 6, 0x2100, i, 9), (0x81, 6, 0x2100, i, 255), (0x81, 6, 0x2101, i, 9), (0x81, 6, 0x2100, i, 2)]
        r += [(0x81, 6, 0x2200, i, 255), (0x81, 6, 0x2201, i, 255), (0x81, 6, 0x2200, i, 8), (0x81, 6, 0x2300, i, 255)]
        r += [(0x81, 6, 0x0100, i, 18), (0x81, 6, 0x0200, i, 9), (0x81, 6, 0x0301, i, 255), (0x81, 6, 0x2900, i, 255)]
        r += [(0x01, 6, 0x2200, i, 0), (0x01, 6, 0x2100, i, 0)]
        r += [(0x81, 10, 0, i, 1), (0x81, 10, 0, i, 2), (0x81, 10, 0, i, 0), (0x01, 10, 0, i, 0), (0x81, 10, 0, i, 8)]
        r += [(0x81, 12, 0, i, 2)]
        r += [(0x81, q, 0, i, 2) for q in (2, 4, 13, 0xFF)]
    for e in (0x81, 0x82, 0x00, 0x80):
        r += [(0x82, 0, 0, e, 2), (0x02, 0, 0, e, 0), (0x82, 0, 0, e, 0), (0x82, 0, 0, e, 64)]
        r += [(0x02, 1, 1, e, 0), (0x02, 3, 1, e, 0), (0x82, 12, 0, e, 2), (0x82, 6, 0x0100, e, 18)]
        r += [(0x82, q, 0, e, 2) for q in (2, 4, 13, 0xFF)]
    for rc in (3, 4, 5, 6, 7, 0x1F):
        r += [(0x80 | rc, 0, 0, 0, 2), (0x80 | rc, 6, 0x0100, 0, 18), (0x80 | rc, 8, 0, 0, 1)]
        r += [(0x80 | rc, 10, 0, 0, 1), (rc, 1, 1, 1, 0)]
    r += [(0x83, 6, 0x0100, 0, 0), (0x03, 0, 0, 0, 2)]
    # An interface and an endpoint the descriptors lack, named through recipients 5 and 6: usbfs refuses them at 1 and
    # 2, and a stack reading two recipient bits takes these for them.
    r += [(0x85, 0, 0, 7, 2), (0x85, 0, 0, 7, 1), (0x85, 10, 0, 7, 1), (0x86, 0, 0, 0x8F, 2), (0x86, 0, 0, 0x8F, 1)]
    r += [(0x85, 0, 0, 3, 2), (0x86, 0, 0, 0x83, 2)]
    r += [(0xE0, 0, 0, 0, 2), (0xE0, 6, 0x0100, 0, 18), (0xE1, 1, 0x0100, 0, 8), (0x60, 9, 0, 0, 0)]
    r += [(0xA0, 1, 0x0100, 0, 8), (0xA3, 1, 0x0100, 0, 8), (0xA2, 1, 0x0100, 0x81, 8), (0xA1, 1, 0x0303, 0, 8)]
    r += [(0x21, 1, 0x0303, 0, 0), (0xA1, 2, 0, 0, 1), (0xA1, 3, 0, 0, 1), (0xA1, 5, 0, 0, 1)]
    r += [(0xC0, 0x43, 0, 0, 64), (0xC3, 0x43, 0, 0, 8), (0xC1, 0x43, 0, 9, 8)]
    return [x for x in r if not (x[0] & 0x60 == 0 and x[1] == 5)]


def may_over(quirks, req):
    """Whether this stack answers `req` with more than wLength asks for, or with data where the status stage is due."""
    bm, rq, wv, wi, wl = req
    q = quirks
    if q & Q_OUT_REPLY and not bm & 0x60 and not bm & 0x80 and wl and STD_DIR.get(rq) == 0x80:
        return True
    if not q & Q_OVERRUN or bm & 0x60 or rq not in (0, 8, 10) or wl >= (2 if rq == 0 else 1):
        return False
    if not (bm & 0x80 or wl == 0) or (q & Q_DIR_STRICT and not bm & 0x80):
        return False
    recip = bm & 0x1F
    if recip == 0:
        return ((rq == 0 and not q & (Q_WLEN_STATUS | Q_WLEN_SHORT))
                or (rq == 8 and not q & (Q_WLEN_CONFIG | Q_WLEN_SHORT)))
    if recip == 1:
        return rq in (0, 10) and not q & Q_IFREQ_STALL and wi in IFACES and not (q & Q_ZLP_IFZERO and wl == 0)
    return recip == 2 and rq == 0 and wi in ENDPOINTS


def seen(quirks, req, got):
    """The PC's overrun read as one where this stack runs past wLength: an overflow, or, when the bytes come in the
    status stage (no IN data stage), an I/O error. Both sides are read so."""
    status_stage = req[4] == 0 or not req[0] & 0x80
    if may_over(quirks, req) and got == ("error 5" if status_stage else "error 75"):
        return OVER
    return got


def _xfer(d, bm, rq, wv, wi, arg, timeout):
    try:
        urb, _buf = d.submit_control(0, bm, rq, wv, wi, arg)
    except OSError as e:
        return (19 if e.errno == 19 else 5), b""
    a, t0 = ctypes.addressof(urb), time.monotonic()
    while True:
        try:
            addr, st, data = d.reap(timeout=max(0.0, timeout - (time.monotonic() - t0)))
        except TimeoutError:
            d.discard(urb)
            try:
                d.reap(timeout=1.0)
            except TimeoutError:
                pass
            return "timeout", b""
        if addr == a:
            break
    if st == 0:
        return 0, data if bm & 0x80 else b""
    return {-32: 32, -75: 75, -19: 19, -108: 19}.get(st, 5), data


def _ctrl(d, req):
    bm, rq, wv, wi, wl = req
    if bm & 0x60 == 0 and rq == 0x05:
        raise RuntimeError("refusing to send SET_ADDRESS")
    st, data = _xfer(d, bm, rq, wv, wi, wl if bm & 0x80 else bytes(wl), 1.0)
    if st == 0:
        return data
    return {32: STALL, "timeout": TIMEOUT}.get(st, f"error {st}")


def _show(x):
    return x if isinstance(x, str) else (x.hex() or "ack")


def _read(port, name):
    try:
        with open(f"/sys/bus/usb/devices/{port}/{name}") as f:
            return f.read().strip()
    except OSError:
        return None


def _find(port, pid):
    end = time.monotonic() + SECS
    while time.monotonic() < end:
        try:
            if (int(_read(port, "idProduct") or "0", 16) == pid
                    and _read(port, "bConfigurationValue") not in (None, "", "0")):
                return f"/dev/bus/usb/{int(_read(port, 'busnum')):03d}/{int(_read(port, 'devnum')):03d}"
        except (TypeError, ValueError):
            pass
        time.sleep(0.1)
    return None


def _present(link, p, tries=3):
    for k in range(tries):
        try:
            link.present(p, settle=0.5)
            return True
        except RuntimeError:
            if k == tries - 1:
                return False
            time.sleep(0.5)
    return False


def _detach(node, ifaces):
    fd = os.open(node, os.O_RDWR)
    try:
        for n in ifaces:
            try:
                drv = fcntl.ioctl(fd, _GETDRIVER, struct.pack("I256s", n, b""))[4:].split(b"\0", 1)[0]
            except OSError:
                continue
            if drv != b"usbfs":
                try:
                    fcntl.ioctl(fd, _IOCTL, struct.pack("iiP", n, _DISCONNECT, 0))
                except OSError:
                    pass
    finally:
        os.close(fd)


def _read_all(node, quirks, rows, settle):
    usbfs = sim_module("usbfs")
    time.sleep(settle)
    _detach(node, IFACES)
    try:
        with usbfs.RawDevice(node) as d:
            for n in IFACES:
                try:
                    d.claim(n)
                except OSError:
                    pass
            return [seen(quirks, r, _ctrl(d, r)) for r in rows]
    except OSError:
        return None


def _kind(ctx, links, ports, n, name):
    pid = PID0 + n
    p = ep0_stacks.personality(name, pid)
    quirks = ep0_stacks.KINDS[name][0]
    rows = reads(len(p.configs[0]))
    res = {"rows": len(rows)}
    node = _find(ports[1], pid) if _present(links[1], p) else None
    native = _read_all(node, quirks, rows, 0.5) if node else None
    if native is None:
        res["error"] = "the native sim did not come up"
        ctx.log(f"{name}: {res['error']}")
        return res
    node = _find(ports[0], pid) if _present(links[0], p) else None
    clone = _read_all(node, quirks, rows, 1.0) if node else None
    if clone is None:
        res.update(cloned=False, match=0, diffs=[])
    else:
        diffs = [{"req": "%02x %02x %04x %04x %d" % r, "clone": _show(c), "device": _show(v)}
                 for r, c, v in zip(rows, clone, native) if c != v]
        res.update(cloned=True, match=len(rows) - len(diffs), diffs=diffs)
    ctx.log(f"{name}: {res['match']}/{len(rows)} given the native reply")
    return res


def run(ctx):
    ports = [ctx.device("start").usb, ctx.native("start").usb]
    links = [ctx.sim()]
    out = {"sim_build": None, "results": {}}
    try:
        links.append(ctx.sim("native"))
        builds = [(link.diag() or {}).get("build") for link in links]
        if None in builds or builds[0] != builds[1]:
            raise RuntimeError(f"the sims run different builds ({builds}); flash both with one build")
        out["sim_build"] = builds[0]
        for n, name in enumerate(KINDS):
            out["results"][name] = _kind(ctx, links, ports, n, name)
    finally:
        for link in links:
            link.close()
    return out
