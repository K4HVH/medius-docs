"""Endpoint 0 packet size and strings: mice declaring bMaxPacketSize0 8, 16 and 32 (the sim's endpoint 0 runs at that
size), and one with manufacturer, product and serial strings. Per shape: whether the clone enumerated and how long
that took, whether its device and configuration descriptors match the shape's bytes, its strings, and the reports
its mouse delivered in a second, read through hidraw.

Outcomes: a clone is faithful when both descriptors match byte for byte (and its strings, where the shape has
them). Its data arrives when the mouse delivered reports in that second.
"""
import glob
import os
import time

from medius_compare.capture import RawCap
from medius_shapes import core, scripted

SECS = 25.0
SETTLE_S = 1.5
TEXTS = ("Test Lab", "Scripted Mouse", "SN-000123")
STRINGS = [bytes([4, 3, 0x09, 0x04])] + [core.sd(t) for t in TEXTS]


def fresh_mouse():
    """A still mouse no other shape matches, so the first shape is a new device to the box."""
    return core.personality(0x62CF, core.cfg(1, core.MOUSE_IF), [core.EndpointSpec(0x81, 3, 1, 8, 3)])


def _mouse(pid, mps0=64, strings=False):
    p = scripted.scripted_mouse(pid, [(1, scripted.mouse(1, 0)), (1, scripted.mouse(-1, 0))])
    p.device = core.device_desc(scripted.VID, pid, 1, mps0=mps0, i_man=1 if strings else 0,
                                i_prod=2 if strings else 0, i_ser=3 if strings else 0)
    p.hooks = core.EnumHooks(ep0_mps=mps0)
    if strings:
        p.strings = STRINGS
    return p


def ep0_8():
    """A mouse moving every millisecond with an 8-byte endpoint 0."""
    return _mouse(0x70F8, 8)


def ep0_16():
    """The same with a 16-byte endpoint 0."""
    return _mouse(0x70F6, 16)


def ep0_32():
    """The same with a 32-byte endpoint 0."""
    return _mouse(0x70F2, 32)


def strings():
    """The same with a 64-byte endpoint 0 and manufacturer, product and serial strings."""
    return _mouse(0x70F5, 64, True)


SHAPES = {f.__name__: f for f in (fresh_mouse, ep0_8, ep0_16, ep0_32, strings)}
CASES = [("ep0_8", ep0_8), ("ep0_16", ep0_16), ("ep0_32", ep0_32), ("strings", strings)]
ROWS = {"ep0_8": "8", "ep0_16": "16", "ep0_32": "32", "strings": "strings"}


def _read(port, name, binary=False):
    try:
        with open(f"/sys/bus/usb/devices/{port}/{name}", "rb" if binary else "r") as f:
            v = f.read()
    except OSError:
        return None
    return v if binary else v.strip()


def _ident(port):
    v, p = _read(port, "idVendor"), _read(port, "idProduct")
    return f"{v}:{p}".lower() if v and p else None


def _present(link, p, settle=0.3, tries=3):
    for k in range(tries):
        try:
            link.present(p, settle=settle)
            return
        except RuntimeError:
            if k == tries - 1:
                raise
            time.sleep(0.4)


def _hid_activity(port, secs=1.0):
    caps = []
    for raw in sorted(glob.glob(f"/sys/bus/usb/devices/{port}/{port}:*/*/hidraw/hidraw*")):
        iface = raw.split(f"{port}:", 1)[1].split("/", 1)[0]
        try:
            caps.append((iface, RawCap("/dev/" + os.path.basename(raw))))
        except OSError:
            pass
    time.sleep(secs)
    out = {}
    for name, c in caps:
        out[name] = len(c.take())
        c.close()
    return out


def _case(ctx, link, port, name, build):
    p = build()
    ident = f"{p.device[8] | p.device[9] << 8:04x}:{p.device[10] | p.device[11] << 8:04x}"
    t0 = time.monotonic()
    _present(link, p)
    t = None
    while time.monotonic() < t0 + SECS:
        if _ident(port) == ident and _read(port, "bConfigurationValue") not in (None, "", "0"):
            t = time.monotonic() - t0
            time.sleep(SETTLE_S)
            break
        time.sleep(0.05)
    r = {"case": name, "cloned": t is not None, "enum_s": round(t, 2) if t is not None else None}
    raw = _read(port, "descriptors", True)
    if raw and _ident(port) == ident:
        r["device_desc_match"] = raw[:18] == p.device
        r["config_match"] = raw[18:18 + len(p.configs[0])] == p.configs[0]
        r["strings"] = [_read(port, "manufacturer"), _read(port, "product"), _read(port, "serial")]
        r["hid_reports_1s"] = _hid_activity(port) if t is not None else None
    ctx.log(f"{name}: {r}")
    return r


def outcomes(results):
    o = {}
    for r in results:
        key = ROWS[r["case"]]
        if not r["cloned"]:
            o[f"devices-ep0-data-{key}"] = "Not cloned"
            o[f"devices-ep0-size-{key}"] = "Imperfect"
            continue
        o[f"devices-ep0-data-{key}"] = ("All data arrives" if (r.get("hid_reports_1s") or {}).get("1.0")
                                        else "An interface sends nothing")
        same = r.get("device_desc_match") and r.get("config_match")
        if r["case"] == "strings":
            same = same and tuple(r.get("strings") or ()) == TEXTS
        o[f"devices-ep0-size-{key}"] = "Faithful" if same else "Imperfect"
    return o


def run(ctx):
    port = ctx.device("start").usb
    link = ctx.sim()
    try:
        results = [_case(ctx, link, port, name, build) for name, build in CASES]
    finally:
        link.close()
    return {"results": results, "outcomes": outcomes(results)}
