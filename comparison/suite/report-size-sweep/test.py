"""The largest HID report descriptor the box's clone serves: the sim's built-in mouse whose report descriptor is
padded to N bytes and declared as N, at sizes from 256 to 2,047 bytes (`base`) and from 513 to 700 (`513_700`). Per
size: whether the clone enumerated again, how many bytes of report descriptor the PC got, and the driver bound to
each interface. Every size shares one VID:PID, so a clone counts as the new one only once its device number changes.

Outcome: the HID driver loads when, at every size in the row, it is bound and the PC got at least the declared
bytes of report descriptor.
"""
import glob
import os
import time

from medius_shapes import core
from medius_shapes.personalities import builtin

SIZES = {"base": (256, 512, 768, 1000, 1023, 1024, 1025, 1100, 1200, 1300, 1400, 1500, 1800, 2000, 2047),
         "513_700": (513, 520, 560, 600, 640, 700)}
ROWS = {"devices-report-256-512": ("base", range(256, 513)),
        "devices-report-513-700": ("513_700", range(513, 701)),
        "devices-report-768-2047": ("base", range(768, 2048))}
SECS = 20.0
SETTLE_S = 2.0


def fresh_mouse():
    """A still mouse no other shape matches, so the first size is a new device to the box."""
    return core.personality(0x62CF, core.cfg(1, core.MOUSE_IF), [core.EndpointSpec(0x81, 3, 1, 8, 3)])


SHAPES = {"fresh_mouse": fresh_mouse}


def _read(port, name):
    try:
        with open(f"/sys/bus/usb/devices/{port}/{name}") as f:
            return f.read().strip()
    except OSError:
        return None


def _size(ctx, link, port, n):
    before = _read(port, "devnum")
    link.present_builtin(builtin("bigreport"), 0, n, 0, settle=0.3)
    end = time.monotonic() + SECS
    while time.monotonic() < end:
        d = _read(port, "devnum")
        if d and d != before and _read(port, "bConfigurationValue") not in (None, "", "0"):
            break
        time.sleep(0.05)
    time.sleep(SETTLE_S)
    rdesc, drivers, hidraw = [], [], []
    v, p = _read(port, "idVendor"), _read(port, "idProduct")
    for idir in sorted(glob.glob(f"/sys/bus/usb/devices/{port}/{port}:*")):
        drv = idir + "/driver"
        drivers.append(os.path.basename(os.path.realpath(drv)) if os.path.exists(drv) else None)
        for hdir in sorted(glob.glob(f"{idir}/0003:*")):
            try:
                with open(hdir + "/report_descriptor", "rb") as f:
                    rdesc.append(len(f.read()))
            except OSError:
                rdesc.append(0)
            hidraw += [os.path.basename(x) for x in glob.glob(f"{hdir}/hidraw/hidraw*")]
    row = {"size": n, "reenumerated": _read(port, "devnum") != before, "ident": f"{v}:{p}" if v and p else None,
           "rdesc_bytes": rdesc, "driver": drivers, "hidraw": hidraw}
    ctx.log(f"{n}: {row['reenumerated']} {rdesc} {drivers}")
    return row


def _loads(row):
    return (row["reenumerated"] and "usbhid" in row["driver"] and bool(row["rdesc_bytes"])
            and min(row["rdesc_bytes"]) >= row["size"])


def outcomes(out):
    o = {}
    for rid, (variant, sizes) in ROWS.items():
        rows = [r for r in out[variant]["results"] if r["size"] in sizes]
        o[rid] = ("Loads" if all(_loads(r) for r in rows) else "Doesn't load") if rows else None
    return o


def run(ctx):
    port = ctx.device("start").usb
    link = ctx.sim()
    try:
        out = {v: {"results": [_size(ctx, link, port, n) for n in sizes]} for v, sizes in SIZES.items()}
    finally:
        link.close()
    out["outcomes"] = outcomes(out)
    return out
