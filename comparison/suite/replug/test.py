"""The real device unplugged and plugged back in: what each box presents to the PC with nothing on its device port,
and how long the clone takes to come back.

The sim disconnects (its D+ pull-up off, as an unplug looks to the box) and reconnects. Per cycle: time from the
disconnect until the clone's port reads disconnected at its hub (GET_STATUS(port) read about every 0.3 ms, so the
box's delay alone), and until the clone leaves the PC's bus as the kernel sees it, or stays if the box keeps
presenting something. The kernel hears of it at the hub's next status poll, every 256 ms on common hubs, so each
disconnect first waits a random 0-256 ms and the cycles cover every phase of that poll. Then what is on the
clone's port while the device is away, and the time from reconnect until the clone is configured with its hidraw
node, then until its first report reaches the PC. Ten cycles. The device is a mouse reporting every millisecond.
"""
import random
import time

from medius_bench import HubPort
from medius_compare import capture, devices, stats
from medius_shapes import scripted

PID = 0x7080
CYCLES = 10


def ticking_mouse():
    """A mouse moving X +1 and -1 on alternate milliseconds."""
    return scripted.scripted_mouse(PID, [(1, scripted.mouse(1, 0)), (1, scripted.mouse(-1, 0))], interval_us=1000)


SHAPES = {"ticking-mouse": ticking_mouse}


def _read(path):
    try:
        with open(path) as f:
            return f.read().strip()
    except OSError:
        return None


def _ident(usb):
    d = f"/sys/bus/usb/devices/{usb}"
    v, p = _read(f"{d}/idVendor"), _read(f"{d}/idProduct")
    return f"{v}:{p}".lower() if v and p else None


def _configured(usb):
    return _read(f"/sys/bus/usb/devices/{usb}/bConfigurationValue") not in (None, "", "0")


def _hidraw(usb):
    return [n for n in devices.usb_nodes(usb) if "/hidraw" in n]


def _cycle(ctx, usb, want, hub):
    time.sleep(random.uniform(0.0, 0.256))
    s = ctx.sim()
    try:
        t0 = time.monotonic()
        s.disconnect()
        port_gone = gone = None
        while time.monotonic() - t0 < 6.0 and (port_gone is None or gone is None):
            if port_gone is None and not hub.connected():
                port_gone = time.monotonic() - t0
            if gone is None and _ident(usb) != want:
                gone = time.monotonic() - t0
    finally:
        s.close()
    time.sleep(3.0)
    nodes = devices.usb_nodes(usb)
    away = {"ident": _ident(usb), "inputs": sum(1 for n in nodes if "/input/" in n),
            "hidraw": sum(1 for n in nodes if "/hidraw" in n)}
    product = _read(f"/sys/bus/usb/devices/{usb}/product")
    if product is not None:
        away["product"] = product
    s = ctx.sim()
    try:
        t1 = time.monotonic()
        s.reconnect(settle=0)
    finally:
        s.close()
    back = node = first = None
    while time.monotonic() - t1 < 30.0:
        if back is None and _ident(usb) == want and _configured(usb):
            back = time.monotonic() - t1
        if back is not None and _hidraw(usb):
            node = time.monotonic() - t1
            break
        time.sleep(0.005)
    if node is not None:
        try:
            rc = capture.RawCap(_hidraw(usb)[0])
            try:
                while time.monotonic() - t1 < 30.0:
                    if rc.take():
                        first = time.monotonic() - t1
                        break
                    time.sleep(0.002)
            finally:
                rc.close()
        except OSError:
            pass
    return {"port_gone_s": port_gone, "clone_gone_s": gone, "while_away": away, "configured_s": back,
            "hidraw_s": node, "first_report_s": first}


def run(ctx):
    p = ctx.device("mouse")
    want = f"{p.vid:04x}:{p.pid:04x}"
    rows = []
    hub = HubPort(p.usb)
    try:
        for c in range(CYCLES):
            row = {"cycle": c, **_cycle(ctx, p.usb, want, hub)}
            rows.append(row)
            ctx.log(f"cycle {c}: gone {row['clone_gone_s']}, configured {row['configured_s']}, "
                    f"first report {row['first_report_s']}")
            time.sleep(1.0)
    finally:
        hub.close()
    res = {"rows": rows,
           "port_gone": stats.summary([r["port_gone_s"] for r in rows if r["port_gone_s"] is not None], scale=1e3,
                                      unit="ms"),
           "configured": stats.summary([r["configured_s"] for r in rows if r["configured_s"]], scale=1, unit="s"),
           "first_report": stats.summary([r["first_report_s"] for r in rows if r["first_report_s"]], scale=1,
                                         unit="s"),
           "gone": stats.summary([r["clone_gone_s"] for r in rows if r["clone_gone_s"]], scale=1, unit="s")}
    return {"results": [res]}
