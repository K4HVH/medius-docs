"""The PC suspending and resuming the clone, through each box.

The real device's side is the sim's witness (its controller's suspend and resume edges, whether its host armed
remote wakeup, whether a wakeup it fired was refused), never the box. The PC's side is the clone's runtime power
state in sysfs and its reports on the PC's USB bus. Cases, each on a mouse that declares remote wakeup:
  suspend    the PC autosuspends the clone: does the device get suspended, how soon, with remote wakeup armed
  idle       2 s suspended with nothing injected: the PC must stay asleep
  inject     a 50-count move sent to the suspended box: is the PC woken, and does the move arrive whole
  resume     the PC resumes the clone: how soon the device resumes
  wake       the device fires a remote wakeup while suspended: does the PC wake
  input      a mouse reporting every 3 s, left to autosuspend: is the PC woken, and are the reports delivered
The clone's and its hub's power settings are put back afterwards.
"""
import os
import time

from medius_compare import layout, wire
from medius_compare.capture import mono
from medius_shapes import scripted

USB = "/sys/bus/usb/devices"
SETTLE_S = 2.0


def silent_mouse():
    """A mouse that never reports."""
    return scripted.scripted_mouse(0x7130, [(1000, b"")])


def sparse_mouse():
    """A mouse moving X by 1 every 3 s."""
    return scripted.scripted_mouse(0x7131, [(1, scripted.mouse(1, 0)), (2999, b"")])


SHAPES = {"silent-mouse": silent_mouse, "sparse-mouse": sparse_mouse}


def _power(d, **kv):
    for key, v in kv.items():
        try:
            with open(os.path.join(d, "power", key), "w") as f:
                f.write(str(v))
        except OSError:
            pass


def _state(d):
    try:
        with open(os.path.join(d, "power", "runtime_status")) as f:
            return f.read().strip()
    except OSError:
        return "?"


def _wait_for(cond, secs, step=0.005):
    t0 = mono()
    while mono() - t0 < secs:
        if cond():
            return mono() - t0
        time.sleep(step)
    return None


def _xs(events, dev, lay):
    return [(e.ts, layout.field(e.data, lay.x)) for e in events
            if e.dev == dev and e.kind == "C" and e.xfer == 1 and e.ep & 0x80 and len(e.data) * 8 >= sum(lay.x)]


def _ms(v):
    return None if v is None else round(v * 1000, 1)


def _sleep_cases(ctx, rec):
    p = ctx.device("silent")
    time.sleep(SETTLE_S)
    d = f"{USB}/{p.usb}"
    _, dev = wire.resolve(p.usb)
    sl = ctx.sim()

    def log():
        return sl.susplog() or {}

    try:
        s0 = log()
        _power(d, wakeup="enabled", autosuspend_delay_ms=500, control="auto")
        rec["pc_suspended"] = _wait_for(lambda: _state(d) == "suspended", 20) is not None
        t_dev = _wait_for(lambda: log().get("susp_now"), 3, step=0.001)
        s1 = log()
        rec["device_suspended_ms"] = _ms(t_dev)
        rec["device_suspend_edges"] = s1.get("susp_edges", 0) - s0.get("susp_edges", 0)
        rec["remote_wakeup_armed"] = bool(s1.get("rw_armed"))

        time.sleep(2.0)
        rec["idle_pc_stayed_asleep"] = _state(d) == "suspended"

        r0 = log()
        with wire.Wire([p.usb]) as w:
            t0w = time.time() * 1e6
            ctx.box.move(50, 0)
            t_wake = _wait_for(lambda: _state(d) == "active", 5)
            time.sleep(0.6)
        got = [(t, x) for t, x in _xs(w.events, dev, p.layout) if x]
        r1 = log()
        rec["inject_pc_woken_ms"] = _ms(t_wake)
        rec["inject_first_count_ms"] = round((got[0][0] - t0w) / 1000, 1) if got else None
        rec["inject_total"] = sum(x for _, x in got)
        rec["inject_device_resumed"] = r1.get("resume_edges", 0) > r0.get("resume_edges", 0)

        _wait_for(lambda: _state(d) == "suspended", 10)
        _wait_for(lambda: log().get("susp_now"), 3, step=0.001)
        p0 = log()
        with wire.Wire([p.usb]) as w:
            _power(d, control="on")
            t_res = _wait_for(lambda: log().get("resume_edges", 0) > p0.get("resume_edges", 0), 3, step=0.001)
            time.sleep(1.0)
        rec["resume_device_ms"] = _ms(t_res)
        rec["move_held_until_resume"] = sum(x for _, x in _xs(w.events, dev, p.layout))

        sl.wake_in(2500)
        q0 = log()
        t_arm = mono()
        _power(d, control="auto")
        _wait_for(lambda: _state(d) == "suspended", 10)
        t_act = _wait_for(lambda: _state(d) == "active", 6)
        q1 = log()
        rec["wake_fired"] = q1.get("wake_fired", 0) - q0.get("wake_fired", 0)
        rec["wake_refused"] = q1.get("wake_refused", 0) - q0.get("wake_refused", 0)
        rec["wake_pc_woken"] = t_act is not None
        rec["wake_pc_after_fire_ms"] = round((mono() - t_arm - 2.5) * 1000) if t_act is not None else None
    finally:
        sl.close()
        _power(d, control="on", wakeup="disabled", autosuspend_delay_ms=2000)


def _input_case(ctx, rec):
    p = ctx.device("reporting")
    time.sleep(SETTLE_S)
    d = f"{USB}/{p.usb}"
    _, dev = wire.resolve(p.usb)
    sl = ctx.sim()
    try:
        _power(d, wakeup="enabled", autosuspend_delay_ms=500, control="auto")
        woke, prev = 0, _state(d)
        a0 = (sl.diag() or {}).get("appends", 0)
        with wire.Wire([p.usb]) as w:
            end = mono() + 15
            while mono() < end:
                s = _state(d)
                woke += prev == "suspended" and s != "suspended"
                prev = s
                time.sleep(0.005)
        a1 = (sl.diag() or {}).get("appends", 0)
    finally:
        sl.close()
        _power(d, control="on", wakeup="disabled", autosuspend_delay_ms=2000)
    rec["input_pc_woken"] = woke
    rec["input_reports_delivered"] = len([x for _, x in _xs(w.events, dev, p.layout) if x])
    rec["input_reports_device_sent"] = a1 - a0


def _outcomes(rec):
    fired = rec.get("wake_fired")
    return {"recovery-sleep-device": None if "device_suspend_edges" not in rec
            else "Suspended" if rec["device_suspend_edges"] >= 1 else "Kept awake",
            "recovery-sleep-idle": None if "idle_pc_stayed_asleep" not in rec
            else "Asleep" if rec["idle_pc_stayed_asleep"] else "Woken",
            "recovery-wake-inject": None if "inject_total" not in rec
            else "Wakes the PC" if rec["inject_pc_woken_ms"] is not None and rec["inject_total"] > 0
            else "PC stays asleep",
            "recovery-wake-device": None if not fired
            else "Wakes the PC" if rec["wake_pc_woken"] else "PC stays asleep"}


def run(ctx):
    rec = {}
    hub = None
    try:
        p = ctx.device("silent")
        hub = os.path.dirname(os.path.realpath(f"{USB}/{p.usb}"))
        _power(hub, control="on")
        _sleep_cases(ctx, rec)
        _input_case(ctx, rec)
    finally:
        if hub:
            _power(hub, control="on")
    return {"results": [rec], "outcomes": _outcomes(rec)}
