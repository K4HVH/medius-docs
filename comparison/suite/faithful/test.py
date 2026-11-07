"""Does what the PC does to the clone reach the real device, and what the real device does reach the PC?

The real device's side is read from the sim's records (bus resets it saw, endpoint halts set and cleared, its
alternate setting), never from the box; the PC's side from usbfs and the USB monitor. Cases:
  boot     SET_PROTOCOL(boot) to both boot interfaces of a gaming mouse: the device switches to 3-byte boot
           reports, and those reach the PC
  reset    a bus reset of the clone: the device receives a reset and returns to report protocol
  restart  the clone's hub port off for 1 s and on, as a PC restart: the device receives a reset
  halt     the PC halts the mouse's interrupt IN and clears it: the device receives both
  stall    a device whose interrupt IN STALLs mid-stream: whether the PC reads a STALL or the box clears the
           device itself, and whether the PC's CLEAR_FEATURE(HALT) reaches the device
  altset   SET_INTERFACE to the streaming setting of a device with a zero-bandwidth setting: the device follows,
           its packets reach the PC, and it follows back
  zlp      a mouse replying to idle polls with zero-length packets: they reach the PC
  config   SET_CONFIGURATION(2) on a device whose configuration 2 alone declares a counting IN endpoint: the
           clone enters it and the real device's packets reach the PC; back to configuration 1. The sim counts
           the bus resets the real device took on the way, which a native switch never sends"""
import errno
import os
import struct
import time
from collections import Counter

from medius_compare import wire
from medius_compare.devices import LegUnavailable
from medius_shapes import core, scripted
from medius_shapes.personalities import sim_module

GAMING_PID, STALL_PID, ZLP_PID = 0x6160, 0x6130, 0x7120
STALL_AFTER = 1000      # reports at 100/s: about 10 s, so the STALL lands mid-read
EXTRA_EP = 0x82         # declared by configuration 2 alone
CONFIG_PACKETS = 100
CONFIG_SETTLE_S = 2.5
USBDEVFS_SETINTERFACE = (2 << 30) | (8 << 16) | (ord("U") << 8) | 4
_KEEP = []


def stall_mouse():
    """A boot mouse reporting every 10 ms whose interrupt IN STALLs after STALL_AFTER reports."""
    return core.personality(STALL_PID, core.hid_config(1, 2, len(core.MOUSE_DESC), 0x81, 0x03, 8, 10),
                            [core.EndpointSpec(0x81, 3, 1, 8, 3, stall_after=STALL_AFTER)],
                            pump=core.Pump(0x81, 10000, core.GEN_FIXED, 0))


def zlp_mouse():
    """A mouse that reports once a second and answers the polls between with zero-length packets."""
    return scripted.scripted_mouse(ZLP_PID, [(1, scripted.mouse(0, 0)), (999, b"")], zlp_idle=True)


SHAPES = {"stall-mouse": stall_mouse, "zlp-mouse": zlp_mouse}


def _sys(usb, name):
    with open(f"/sys/bus/usb/devices/{usb}/{name}") as f:
        return f.read().strip()


def _put(path, text):
    with open(path, "w") as f:
        f.write(text)


def _node(usb):
    return f"/dev/bus/usb/{int(_sys(usb, 'busnum')):03d}/{int(_sys(usb, 'devnum')):03d}"


def _config(usb):
    return int(_sys(usb, "bConfigurationValue") or 0)


class _Taken:
    def __init__(self, usb, intfs):
        self.usb, self.intfs, self.unbound = usb, intfs, []

    def __enter__(self):
        cfg = _config(self.usb)
        for i in self.intfs:
            name = f"{self.usb}:{cfg}.{i}"
            drv = f"/sys/bus/usb/devices/{name}/driver"
            if os.path.exists(drv):
                d = os.path.basename(os.path.realpath(drv))
                _put(f"/sys/bus/usb/drivers/{d}/unbind", name)
                self.unbound.append((d, name))
        self.dev = sim_module("usbfs").RawDevice(_node(self.usb))
        for i in self.intfs:
            try:
                self.dev.claim(i)
            except OSError:
                pass
        return self.dev

    def __exit__(self, *a):
        self.dev.close()
        for d, name in self.unbound:
            try:
                _put(f"/sys/bus/usb/drivers/{d}/bind", name)
            except OSError:
                pass


def _read(dev, ep, size, timeout_s):
    """One read of `ep`: (bytes, None), or (None, why it failed)."""
    urb, buf = dev.submit_in(ep, size)
    try:
        _, status, data = dev.reap(timeout=timeout_s)
    except TimeoutError:
        dev.discard(urb)
        try:
            _, status, data = dev.reap(timeout=1.0)
        except TimeoutError:
            _KEEP.append((urb, buf))
            return None, "timeout"
        return (data, None) if status == 0 else (None, "timeout")
    if status:
        return None, {errno.EPIPE: "STALL", errno.ETIMEDOUT: "timeout"}.get(-status, f"errno {-status}")
    return data, None


def _read_until(dev, ep, size, n, timeout_ms=200):
    got, err = 0, None
    for _ in range(n):
        _, err = _read(dev, ep, size, timeout_ms / 1000)
        if err:
            break
        got += 1
    return got, err


def _set_interface(dev, intf, alt):
    import fcntl
    fcntl.ioctl(dev.fd, USBDEVFS_SETINTERFACE, struct.pack("<II", intf, alt))


def _sim(ctx, fn):
    link = ctx.sim()
    try:
        return fn(link)
    finally:
        link.close()


def _resets(ctx):
    r = _sim(ctx, lambda s: s.susplog())
    return r["resets"] if r else None


def _simstat(ctx):
    return _sim(ctx, lambda s: s.simstat()) or {}


def _hidraw(usb, intf):
    base = f"/sys/bus/usb/devices/{usb}/{usb}:{_config(usb)}.{intf}"
    for root, dirs, _ in os.walk(base):
        if os.path.basename(root) == "hidraw":
            for n in dirs:
                return os.open(f"/dev/{n}", os.O_RDONLY | os.O_NONBLOCK)
    return None


def _lengths(usb, ep, secs=0.6, intf=0):
    """Lengths of the packets the clone completed on `ep` over `secs`, with its hidraw node open so the PC polls."""
    fd = _hidraw(usb, intf)
    _, dev = wire.resolve(usb)
    try:
        with wire.Wire([usb]) as w:
            time.sleep(secs)
    finally:
        if fd is not None:
            os.close(fd)
    return Counter(e.len for e in w.events if e.dev == dev and e.kind == "C" and e.xfer == 1 and e.ep == ep)


def _wait_pid(usb, pid, secs=20.0):
    end = time.monotonic() + secs
    while time.monotonic() < end:
        try:
            if int(_sys(usb, "idProduct"), 16) == pid and os.path.exists(f"/sys/bus/usb/devices/{usb}/devnum"):
                time.sleep(1.5)
                return True
        except (OSError, ValueError):
            pass
        time.sleep(0.2)
    return False


def _hub_port_off(usb, off):
    hub, n = usb.rsplit(".", 1)
    _put(f"/sys/bus/usb/devices/{hub}/{hub}:1.0/{hub}-port{n}/disable", "1" if off else "0")


def _boot_reset_restart(ctx, out):
    usb = ctx.device("gaming").usb
    before = _lengths(usb, 0x81)
    unanswered = []

    def ask(dev, name, bm, rq, wv, i, wl):
        try:
            return dev.control(0, bm, rq, wv, i, b"" if wl is None else wl, timeout=1.0)
        except OSError as e:
            unanswered.append({"request": name, "interface": i, "error": str(e)})
            return None

    with _Taken(usb, (0, 1)) as dev:
        for i in (0, 1):
            ask(dev, "SET_PROTOCOL(boot)", 0x21, 0x0B, 0, i, None)
            ask(dev, "SET_IDLE(0)", 0x21, 0x0A, 0, i, None)
        proto = []
        for i in (0, 1):
            r = ask(dev, "GET_PROTOCOL", 0xA1, 0x03, 0, i, 1)
            proto.append(r[0] if r else None)
    time.sleep(1.0)
    boot = _lengths(usb, 0x81)
    out.append({"case": "boot", "report_lengths_before": dict(before), "get_protocol": proto,
                "report_lengths_after": dict(boot), "device_switched": set(boot) == {3}, "unanswered": unanswered})
    ctx.log(f"boot: before {dict(before)} GET_PROTOCOL {proto} after {dict(boot)} unanswered {unanswered}")

    r0 = _resets(ctx)
    dev = sim_module("usbfs").RawDevice(_node(usb))
    try:
        dev.reset()
    except OSError:
        pass
    finally:
        dev.close()
    time.sleep(3.0)
    r1 = _resets(ctx)
    after = _lengths(usb, 0x81)
    out.append({"case": "reset", "device_resets": (r1 - r0) if None not in (r0, r1) else None,
                "report_lengths_after": dict(after)})
    ctx.log(f"reset: device saw {out[-1]['device_resets']} resets; lengths after {dict(after)}")

    r0 = _resets(ctx)
    _hub_port_off(usb, True)
    time.sleep(1.0)
    _hub_port_off(usb, False)
    _wait_pid(usb, GAMING_PID)
    time.sleep(1.0)
    r1 = _resets(ctx)
    out.append({"case": "restart", "device_resets": (r1 - r0) if None not in (r0, r1) else None})
    ctx.log(f"restart: device saw {out[-1]['device_resets']} resets")


def _halt(ctx, out):
    usb = ctx.device("mouse").usb
    time.sleep(4.0)
    pid = int(_sys(usb, "idProduct"), 16)
    _simstat(ctx)
    with _Taken(usb, (0,)) as dev:
        dev.control(0, 0x02, 0x03, 0, 0x81, b"", timeout=1.0)
        _, err_halted = _read_until(dev, 0x81, 64, 1)
        dev.control(0, 0x02, 0x01, 0, 0x81, b"", timeout=1.0)
        n_after, err_after = _read_until(dev, 0x81, 64, 20)
    h = _simstat(ctx).get("halt", {}).get(0x81, {})
    out.append({"case": "halt", "pid": pid, "pc_read_while_halted": err_halted, "reads_after_clear": n_after,
                "device_halt_set": h.get("set"), "device_halt_clear": h.get("clear")})
    ctx.log(f"halt: PC read while halted: {err_halted}; after clear {n_after}/20 ({err_after}); device saw set "
            f"{h.get('set')} clear {h.get('clear')}")


def _stall(ctx, out):
    usb = ctx.device("stall").usb
    time.sleep(4.0)
    _simstat(ctx)
    with _Taken(usb, (0,)) as dev:
        n, err = _read_until(dev, 0x81, 64, 1500)
        before_pc = _simstat(ctx)
        cleared = True
        try:
            dev.control(0, 0x02, 0x01, 0, 0x81, b"", timeout=1.0)
        except OSError:
            cleared = False
        n2, err2 = _read_until(dev, 0x81, 64, 20)
    st = _simstat(ctx)
    hb, h = before_pc.get("halt", {}).get(0x81, {}), st.get("halt", {}).get(0x81, {})
    out.append({"case": "stall", "reports_before": n, "pc_saw": err, "device_cleared_before_pc": hb.get("clear"),
                "device_stalled_before_pc": 0x81 in before_pc.get("stalled", []), "clear_ok": cleared,
                "reads_after_clear": n2, "after_clear": err2, "device_cleared_by_pc": h.get("clear")})
    ctx.log(f"stall: {n} reports then {err}; device cleared before the PC acted: {hb.get('clear')}; PC clear "
            f"{'ok' if cleared else 'refused'}; after clear {n2}/20 ({err2}); device saw the PC's clear "
            f"{h.get('clear')}")


def _altset(ctx, out):
    usb = ctx.device("altsetting").usb
    _simstat(ctx)
    with _Taken(usb, (1,)) as dev:
        _set_interface(dev, 1, 1)
        time.sleep(0.2)
        alt_on = _simstat(ctx).get("alt", [])
        n, err = _read_until(dev, 0x82, 64, 50)
        _set_interface(dev, 1, 0)
        time.sleep(0.2)
        alt_off = _simstat(ctx).get("alt", [])
    out.append({"case": "altset", "device_alt_after_set1": alt_on[:2], "packets_on_alt1": n, "read_error": err,
                "device_alt_after_set0": alt_off[:2]})
    ctx.log(f"altset: device alt after SET_INTERFACE(1,1): {alt_on[:2]}; {n}/50 packets ({err}); after (1,0): "
            f"{alt_off[:2]}")


def _zlp(ctx, out):
    usb = ctx.device("zlp").usb
    time.sleep(1.5)
    ln = _lengths(usb, 0x81, 1.0)
    out.append({"case": "zlp", "packet_lengths_1s": dict(ln), "zlps": ln.get(0, 0)})
    ctx.log(f"zlp: packets in 1 s by length: {dict(ln)}")


def _select(usb, value):
    """SET_CONFIGURATION through the kernel, which rebinds its drivers to the new configuration's interfaces.
    Returns the error the write met, if any."""
    try:
        _put(f"/sys/bus/usb/devices/{usb}/bConfigurationValue", str(value))
        err = None
    except OSError as e:
        err = repr(e)
    time.sleep(CONFIG_SETTLE_S)
    return err


def _drain(usb, ep, packets, timeout_ms):
    """(received, went_absent, malformed, distinct). With the sim's counter, a correct packet ramps up from its
    first byte, and every packet is new."""
    got, bad, seen = 0, 0, set()
    with _Taken(usb, (0,)) as dev:
        for _ in range(packets):
            try:
                data, err = _read(dev, ep, 64, timeout_ms / 1000)
            except OSError as e:
                if e.errno in (errno.ENOENT, errno.EINVAL):
                    return got, True, bad, len(seen)
                raise
            if err == "timeout" or not data:
                continue
            if err:
                raise OSError(errno.EIO, f"reading {ep:#04x}: {err}")
            got += 1
            if any(data[i] != (data[0] + i) & 0xFF for i in range(len(data))):
                bad += 1
            seen.add(bytes(data))
    return got, False, bad, len(seen)


def _absent(usb, ep, timeout_ms):
    """Whether the active configuration lacks `ep` (as opposed to declaring it and sending nothing)."""
    with _Taken(usb, (0,)) as dev:
        try:
            _read(dev, ep, 8, timeout_ms / 1000)
        except OSError as e:
            if e.errno in (errno.ENOENT, errno.EINVAL):
                return True
            raise
    return False


def _config_case(ctx, out):
    usb = ctx.device("multiconfig").usb
    n0 = int(_sys(usb, "devnum"))
    rec = {"case": "config"}
    r0 = _resets(ctx)
    try:
        t0 = time.monotonic()
        err = _select(usb, 2)
        if err:
            rec["set2_error"] = err
        rec["config_after_set2"] = _config(usb)
        got, absent, bad, distinct = _drain(usb, EXTRA_EP, CONFIG_PACKETS, 200)
        rec["switch_and_read_s"] = round(time.monotonic() - t0, 3)
        r1 = _resets(ctx)
        rec["device_resets_on_switch"] = r1 - r0 if r0 is not None and r1 is not None else None
        rec.update(packets_in_config2=got, absent=absent, malformed=bad, distinct=distinct)
        err = _select(usb, 1)
        if err:
            rec["set1_error"] = err
        rec["config_after_set1"] = _config(usb)
        rec["endpoint_gone_in_config1"] = _absent(usb, EXTRA_EP, 200)
    except (OSError, ValueError) as e:
        rec["error"] = repr(e)
    time.sleep(3.0)
    try:
        rec["reenumerated"] = int(_sys(usb, "devnum")) != n0
        rec["config_now"] = _config(usb)
    except (OSError, ValueError):
        rec["reenumerated"] = None
    r2 = _resets(ctx)
    rec["device_resets_on_round_trip"] = r2 - r0 if r0 is not None and r2 is not None else None
    out.append(rec)
    ctx.log(f"config: {rec}")


CASES = (_boot_reset_restart, _halt, _stall, _altset, _zlp, _config_case)
NAMES = {_boot_reset_restart: "boot", _halt: "halt", _stall: "stall", _altset: "altset", _zlp: "zlp",
         _config_case: "config"}


def _case(results, name):
    return next((r for r in results if r.get("case") == name), {})


def _passed(ok):
    return "Passed on" if ok else "Clone reconnects instead"


def _outcomes(results):
    boot, halt, stall = _case(results, "boot"), _case(results, "halt"), _case(results, "stall")
    alt, zlp, cfg = _case(results, "altset"), _case(results, "zlp"), _case(results, "config")
    after_set1, after_set0 = alt.get("device_alt_after_set1") or [], alt.get("device_alt_after_set0") or []

    def resets(r):
        return "Once" if r.get("device_resets") == 1 else "Twice"

    boot_reports = sum(v for k, v in (boot.get("report_lengths_after") or {}).items() if int(k) == 3)
    return {
        "pass-pc-boot": _passed(bool(boot.get("device_switched")) and boot_reports > 0),
        "pass-pc-halt": _passed((halt.get("device_halt_set") or 0) >= 1 and (halt.get("device_halt_clear") or 0) >= 1),
        "pass-pc-altset": _passed(after_set1[1:2] == [1] and (alt.get("packets_on_alt1") or 0) > 0
                                  and after_set0[1:2] == [0]),
        "pass-pc-config": _passed(cfg.get("config_after_set2") == 2 and (cfg.get("packets_in_config2") or 0) > 0
                                  and cfg.get("config_after_set1") == 1 and not cfg.get("reenumerated")),
        "pass-pc-reset": resets(_case(results, "reset")),
        "pass-pc-port-off": resets(_case(results, "restart")),
        "pass-dev-stall": "Reaches the PC" if (stall.get("pc_saw") == "STALL" and stall.get("device_stalled_before_pc")
                                              and not stall.get("device_cleared_before_pc")) else "Hidden",
        "pass-dev-zlp": "Reaches the PC" if zlp.get("zlps") else "Hidden",
    }


def run(ctx):
    results = []
    for case in CASES:
        try:
            case(ctx, results)
        except LegUnavailable:
            raise
        except Exception as e:
            results.append({"case": NAMES[case], "error": repr(e)})
            ctx.log(f"{NAMES[case]}: {e!r}")
    return {"results": results, "outcomes": _outcomes(results)}
