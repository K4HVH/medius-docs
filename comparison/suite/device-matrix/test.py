"""Device support: the same USB device shapes presented to the box one at a time, and what its clone shows the PC.

About 60 shapes: unusual descriptors (medius_shapes.clone_cases, the sim's built-in devices among them), and mice
and keyboards at several report rates. Per shape: whether a clone with the real device's VID:PID enumerated, how
long that took from the sim presenting it, the descriptors, strings, interfaces and drivers the PC read (checked
against the bytes the shape was written with, where this test wrote them), and how many reports each HID interface
delivered in a second, read through hidraw.

Medius runs as it ships, imperfect clones off. The shapes it refuses are then presented again with imperfect clones
on (the `imperfect` pass). Stock has no such setting. A clone that disconnects again after it is configured keeps
the snapshot taken when it was configured.

Outcomes. Native data, per shape: not cloned; an interface sends nothing when one the real device declares is
missing from the clone, or a HID interface the real device streams on delivers nothing in a second; otherwise all
data arrives. Interval: native when every endpoint of the clone's first configuration declares the real device's
interval. Reports a second: above native rate when the clone delivers >5% (and ≥2) more than the PC polls the real
device for. A row takes its worst shape.
"""
import glob
import os
import time

from medius_compare.capture import RawCap
from medius_shapes import clone_cases, core, scripted
from medius_shapes.personalities import builtin

SECS = 25.0
SETTLE_S = 1.5
OUTCOMES = ("All data arrives", "Not cloned", "An interface sends nothing")


def fresh_mouse():
    """A still mouse no other shape matches, so the first shape is a new device to the box."""
    return core.personality(0x62CF, core.cfg(1, core.MOUSE_IF), [core.EndpointSpec(0x81, 3, 1, 8, 3)])


def eight_bit_mouse():
    """A mouse with 8-bit X and Y moving every millisecond."""
    return scripted.scripted_mouse8(0x7101, [(1, scripted.mouse8(1, 0)), (1, scripted.mouse8(-1, 0))])


def report_id_combo():
    """A mouse and a keyboard on one endpoint under report IDs, the mouse moving every millisecond."""
    return scripted.scripted_combo(0x7102, [(1, scripted.combo_mouse(1, 0)), (1, scripted.combo_mouse(-1, 0))])


def boot_keyboard():
    """A boot keyboard sending one empty report a second."""
    return scripted.scripted_keyboard(0x7103, [(1, scripted.keys()), (999, b"")])


def mouse_125():
    """A mouse with 16-bit axes declaring and reporting every 8 ms."""
    return scripted.scripted_mouse(0x7104, [(1, scripted.mouse(1, 0)), (1, scripted.mouse(-1, 0))],
                                   interval_us=8000)


def mouse_500():
    """The same every 2 ms."""
    return scripted.scripted_mouse(0x7107, [(1, scripted.mouse(1, 0)), (1, scripted.mouse(-1, 0))],
                                   interval_us=2000)


def mouse_250():
    """The same every 4 ms."""
    return scripted.scripted_mouse(0x7108, [(1, scripted.mouse(1, 0)), (1, scripted.mouse(-1, 0))],
                                   interval_us=4000)


def mouse_16bit():
    """The same every millisecond."""
    return scripted.scripted_mouse(0x7105, [(1, scripted.mouse(1, 0)), (1, scripted.mouse(-1, 0))])


def mouse_with_streaming_vendor():
    """That mouse beside a vendor-page HID interface streaming a 64-byte counter every millisecond."""
    return scripted.scripted_mouse(0x7106, [(1, scripted.mouse(1, 0)), (1, scripted.mouse(-1, 0))],
                                   stream_beside=True)


SHAPES = {f.__name__: f for f in (fresh_mouse, eight_bit_mouse, report_id_combo, boot_keyboard, mouse_125,
                                  mouse_500, mouse_250, mouse_16bit, mouse_with_streaming_vendor)}

# (name, a builder or the sim's built-in device as its name and arguments, PID or None where unknown)
CASES = clone_cases.SHAPES + [
    ("gamingmouse", ["gamingmouse"], None),
    ("keyboard", ["keyboard"], None),
    ("silentmouse", ["silentmouse"], None),
    ("hsmouse", ["hsmouse"], None),
    ("stall 200", ["stall", "200"], None),
    ("vendorbulk 1000 0", ["vendorbulk", "1000", "0"], None),
    ("wide 1024 8 0", ["wide", "1024", "8", "0"], None),
    ("multiconfigshift", ["multiconfigshift"], None),
] + [(f.__name__, f, None) for f in (eight_bit_mouse, report_id_combo, boot_keyboard, mouse_125, mouse_500, mouse_250,
                                     mouse_16bit, mouse_with_streaming_vendor)]

# Native data: per row, each shape and the HID interfaces (configuration.interface) the real device streams on.
DATA_ROWS = {
    "devices-data-mice-1ms": [("eight_bit_mouse", ["1.0"]), ("mouse_16bit", ["1.0"]), ("report_id_combo", ["1.0"])],
    "devices-data-boot-keyboard": [("boot_keyboard", ["1.0"])],
    "devices-data-hid-stream-beside-mouse": [("mouse_with_streaming_vendor", ["1.0", "1.1"])],
    "devices-data-hid-variants": [("hid_alt", ["1.0"]), ("widehid 64", ["1.0"]), ("hid_after_ep", ["1.0"])],
    "devices-data-layouts": [("iface_gap", ["1.0", "1.2"]), ("iface_from_one", ["1.1", "1.2"])],
    "devices-data-slow-report": [("slow_report_450", ["1.0"]), ("slow_report_700", ["1.0"]),
                                 ("rpt_stall_declared_zero", ["1.0"]), ("rpt_stall_declared", ["1.0"])],
    "devices-data-qualifier": [("speed_both", ["1.0"]), ("speed_neither", ["1.0"])],
    "devices-data-mice-slow": [("mouse", ["1.0"]), ("composite", ["1.0", "1.1"]), ("multiconfig", ["1.0"]),
                               ("multiconfigrptgap", ["1.0"]), ("mouse_125", ["1.0"])],
    "devices-data-report-1500": [("bigreport 0 1500", ["1.0"])],
    "devices-data-five-hid": [("five_hid_interfaces", ["1.2", "1.4"])],
    "devices-data-six-in": [("six_in", ["1.0"])],
    "devices-data-report-declared-3000": [("bigreport 3000 0", ["1.0"])],
    "devices-data-second-config": [("multiconfigovercap", ["1.0"])],
    "devices-data-nine-alternates": [("nine_alternates", ["1.0"])],
    "devices-data-far-interfaces": [("far_interfaces", ["1.200"])],
    "devices-data-builtin-gamingmouse": [("gamingmouse", ["1.0"])],
    "devices-data-builtin-keyboard": [("keyboard", ["1.0"])],
    "devices-data-builtin-hsmouse": [("hsmouse", ["1.0"])],
    "devices-data-builtin-stall": [("stall 200", ["1.0"])],
}
IMPERFECT_DATA_ROWS = {"devices-imperfect-data-five-hid": [("five_hid_interfaces", ["1.2", "1.4"])]}
# The interval each endpoint of the sim's built-in devices declares in its first configuration; shapes written here
# are read from their own bytes.
BUILTIN_INTERVALS = {"mouse": {0x81: 10}, "composite": {0x81: 10, 0x82: 10}, "multiconfig": {0x81: 10},
                     "multiconfigrptgap": {0x81: 10}, "bigreport 0 1500": {0x81: 10}, "widehid 64": {0x81: 4}}
INTERVAL_ROWS = {
    "devices-interval-mouse-10": ["mouse", "composite", "multiconfig", "multiconfigrptgap"],
    "devices-interval-mouse-8": ["mouse_125"],
    "devices-interval-mouse-4": ["mouse_250"],
    "devices-interval-mouse-2": ["mouse_500"],
    "devices-interval-mouse-big-report": ["bigreport 0 1500"],
    "devices-interval-vendor-hid": ["widehid 64"],
    "devices-interval-xinput": ["xinput"],
}
# (shape, interface, reports a second the PC takes from the real device: an interval of 10 ms is polled every 8 ms)
RATE_ROWS = {"devices-poll-reports-1ms-behind-10ms": ("multiconfigrptgap", "1.0", 125),
             "devices-poll-reports-8ms-behind-8ms": ("mouse_125", "1.0", 125)}
HS_MOUSE = ("hsmouse", 0x81, 4)


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


def _up(port):
    return _read(port, "bConfigurationValue") not in (None, "", "0")


def _present(link, shape, settle=0.3, tries=3):
    if isinstance(shape, (list, tuple)):
        args = [int(a, 0) for a in shape[1:]] + [0, 0, 0]
        link.present_builtin(builtin(shape[0]), *args[:3], settle=settle)
        return
    for k in range(tries):
        try:
            link.present(shape, settle=settle)
            return
        except RuntimeError:
            if k == tries - 1:
                raise
            time.sleep(0.4)


def _snapshot(port):
    d = f"/sys/bus/usb/devices/{port}"
    if not os.path.exists(d + "/idVendor"):
        return None
    snap = {"ident": _ident(port), "speed": _read(port, "speed"), "bcdDevice": _read(port, "bcdDevice"),
            "manufacturer": _read(port, "manufacturer"), "product": _read(port, "product"),
            "serial": _read(port, "serial"), "bNumConfigurations": _read(port, "bNumConfigurations"),
            "bConfigurationValue": _read(port, "bConfigurationValue"),
            "descriptors": (_read(port, "descriptors", True) or b"").hex(), "interfaces": []}
    for idir in sorted(glob.glob(f"{d}/{port}:*")):
        def ri(n):
            try:
                with open(f"{idir}/{n}") as f:
                    return f.read().strip()
            except OSError:
                return None
        drv = os.path.basename(os.path.realpath(idir + "/driver")) if os.path.exists(idir + "/driver") else None
        it = {"name": os.path.basename(idir).split(":", 1)[1], "class": ri("bInterfaceClass"),
              "sub": ri("bInterfaceSubClass"), "proto": ri("bInterfaceProtocol"), "alt": ri("bAlternateSetting"),
              "n_ep": ri("bNumEndpoints"), "driver": drv, "hid": []}
        for hdir in sorted(glob.glob(f"{idir}/0003:*")):
            try:
                with open(hdir + "/report_descriptor", "rb") as f:
                    rdesc = f.read().hex()
            except OSError:
                rdesc = None
            raws = [os.path.basename(x) for x in glob.glob(f"{hdir}/hidraw/hidraw*")]
            it["hid"].append({"rdesc": rdesc, "hidraw": raws})
        snap["interfaces"].append(it)
    return snap


def _hid_activity(snap, secs=1.0):
    caps = []
    for it in snap["interfaces"]:
        for h in it["hid"]:
            for r in h["hidraw"]:
                try:
                    caps.append((it["name"], RawCap("/dev/" + r)))
                except OSError:
                    pass
    time.sleep(secs)
    out = {}
    for name, c in caps:
        out[name] = len(c.take())
        c.close()
    return out


def _authored(p):
    return {"device": p.device.hex(), "configs": [c.hex() for c in p.configs], "hid_report": p.hid_report.hex(),
            "hid_report2": p.hid_report2.hex()}


def _vs_authored(snap, auth):
    if not snap or not auth:
        return None
    raw = bytes.fromhex(snap["descriptors"])
    res = {"device": raw[:18].hex() == auth["device"]}
    cfgs = raw[18:]
    first = auth["configs"][0] if auth["configs"] else None
    res["config0"] = cfgs[:len(bytes.fromhex(first))].hex() == first if first else None
    rd = [h["rdesc"] for it in snap["interfaces"] for h in it["hid"]]
    want = {auth["hid_report"], auth["hid_report2"]} - {""}
    res["hid_reports"] = all(r in want for r in rd) if rd else None
    return res


def _wait(port, ident, before, t0):
    while time.monotonic() < t0 + SECS:
        snap = _snapshot(port)
        if snap and _up(port) and (snap["ident"] == ident if ident else _read(port, "devnum") not in (None, before)):
            t = time.monotonic() - t0
            time.sleep(SETTLE_S)
            return t, _snapshot(port) or snap
        time.sleep(0.05)
    return None, _snapshot(port)


def _case(ctx, link, port, name, spec, pid):
    before = _read(port, "devnum")
    t0 = time.monotonic()
    p = spec() if callable(spec) else None
    _present(link, p if p is not None else spec)
    if p is not None:
        ident = f"{p.device[8] | p.device[9] << 8:04x}:{p.device[10] | p.device[11] << 8:04x}"
    else:
        ident = f"{core.VID:04x}:{pid:04x}" if pid else None
    t, snap = _wait(port, ident, before, t0)
    row = {"case": name, "authored": _authored(p) if p is not None else None, "cloned": t is not None,
           "enum_s": round(t, 2) if t is not None else None, "snapshot": snap}
    if t is not None:
        row["hid_reports_1s"] = _hid_activity(snap)
        row["vs_authored"] = _vs_authored(snap, row["authored"])
    ctx.log(f"{name}: {'cloned in ' + str(row['enum_s']) + ' s' if row['cloned'] else 'not cloned'}"
            f" {row.get('hid_reports_1s', '')}")
    return row


def _interfaces(cfg):
    out, i = set(), 0
    while i + 2 <= len(cfg) and cfg[i] >= 2:
        if cfg[i + 1] == 4:
            out.add(cfg[i + 2])
        i += cfg[i]
    return out


def _intervals(cfg):
    out, i = {}, 0
    while i + 2 <= len(cfg) and cfg[i] >= 2:
        if cfg[i + 1] == 5 and cfg[i] >= 7:
            out.setdefault(cfg[i + 2], cfg[i + 6])
        i += cfg[i]
    return out


def _first_config(snap):
    raw = bytes.fromhex(snap["descriptors"])[18:]
    return raw[:raw[2] | raw[3] << 8] if len(raw) >= 4 else b""


def _worst(labels, order):
    if any(x is None for x in labels):
        return None
    return max(labels, key=order.index) if labels else None


def _data(row, ifaces):
    if row is None:
        return None
    if not row["cloned"]:
        return "Not cloned"
    counts = row.get("hid_reports_1s") or {}
    if any(not counts.get(i) for i in ifaces):
        return "An interface sends nothing"
    if row["authored"] and row["authored"]["configs"] and row["snapshot"]:
        have = {int(it["name"].split(".")[1]) for it in row["snapshot"]["interfaces"]}
        if not _interfaces(bytes.fromhex(row["authored"]["configs"][0])) <= have:
            return "An interface sends nothing"
    return "All data arrives"


def _interval(row):
    if row is None or not row["cloned"] or not row["snapshot"]:
        return None
    native = (_intervals(bytes.fromhex(row["authored"]["configs"][0])) if row["authored"]
              else BUILTIN_INTERVALS.get(row["case"]))
    if native is None:
        return None
    clone = _intervals(_first_config(row["snapshot"]))
    return "Native interval" if all(clone.get(ep) == iv for ep, iv in native.items()) else "1 ms"


def _rate(row, iface, native):
    if row is None or not row["cloned"]:
        return None
    n = (row.get("hid_reports_1s") or {}).get(iface, 0)
    return "Above native rate" if n > native + max(2, 0.05 * native) else "Native rate"


def outcomes(out):
    base = {r["case"]: r for r in out["base"]["results"]}
    again = {r["case"]: r for r in (out.get("imperfect") or {}).get("results", [])}
    o = {}
    for rid, shapes in DATA_ROWS.items():
        o[rid] = _worst([_data(base.get(s), ifs) for s, ifs in shapes], OUTCOMES)
    for rid, shapes in IMPERFECT_DATA_ROWS.items():
        o[rid] = _worst([_data(again.get(s, base.get(s)), ifs) for s, ifs in shapes], OUTCOMES)
    for rid, shapes in INTERVAL_ROWS.items():
        o[rid] = _worst([_interval(base.get(s)) for s in shapes], ("Native interval", "1 ms"))
    for rid, (s, iface, native) in RATE_ROWS.items():
        o[rid] = _rate(base.get(s), iface, native)
    s, ep, want = HS_MOUSE
    row = base.get(s)
    if row is None or not row["cloned"] or not row["snapshot"]:
        o["devices-interval-hs-mouse"] = None
    else:
        got = _intervals(_first_config(row["snapshot"])).get(ep)
        o["devices-interval-hs-mouse"] = f"Native bInterval {want}" if got == want else "1 ms"
    return o


def run(ctx):
    port = ctx.device("start").usb
    link = ctx.sim()
    out = {"base": None, "imperfect": None}
    try:
        out["base"] = {"results": [_case(ctx, link, port, *c) for c in CASES]}
        if ctx.box_name == "medius":
            refused = [c for c, r in zip(CASES, out["base"]["results"]) if not r["cloned"]]
            was = ctx.box.settings()["optin"]
            ctx.box.apply({"optin": True})
            try:
                out["imperfect"] = {"imperfect_opt_in": True,
                                    "results": [_case(ctx, link, port, *c) for c in refused]}
            finally:
                ctx.box.apply({"optin": was})
    finally:
        link.close()
    out["outcomes"] = outcomes(out)
    return out
