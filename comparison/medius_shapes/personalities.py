"""Turning a shape into what the sim's library uploads, and the shapes of devices that stream, take OUT traffic,
halt and switch settings. The sim's library is reached only through this module, from a checkout of it beside
whatever path the caller has it on, or from `SIM_LIBRARY` (set from the bench config's `sim_library`, or the
environment variable of that name)."""
import os
import sys
from dataclasses import asdict, fields

from . import core
from .clone_cases import VEND8_IN_DESC

SIM_LIBRARY = None


def _rig():
    try:
        from rig import personality
        return personality
    except ImportError:
        pass
    where = SIM_LIBRARY or os.environ.get("SIM_LIBRARY")
    if not where:
        raise RuntimeError("the sim's library isn't on the path: name its tools directory as sim_library in the "
                           "bench config, or in SIM_LIBRARY")
    if where not in sys.path:
        sys.path.insert(0, where)
    from rig import personality
    return personality


def sim_module(name):
    """A module of the sim's library (`rig.<name>`), for a test that only runs on the sim."""
    _rig()
    import importlib
    return importlib.import_module(f"rig.{name}")


def sim_link(port):
    """An open link to the sim on control port `port`."""
    _rig()
    from rig.link import SimLink
    return SimLink(port)


def builtin(name):
    """The id of the sim's built-in personality `name`."""
    _rig()
    from sim_ctl import BUILTINS
    return BUILTINS[name]


def build(p: core.Personality):
    """The sim library's Personality for shape `p`."""
    rp = _rig()
    kw = {f.name: getattr(p, f.name) for f in fields(p)}
    kw["endpoints"] = [rp.EndpointSpec(**asdict(e)) for e in p.endpoints]
    kw["hooks"] = rp.EnumHooks(**asdict(p.hooks))
    kw["pump"] = rp.Pump(**asdict(p.pump))
    kw["pump2"] = rp.Pump(**asdict(p.pump2))
    s = p.script
    kw["script"] = b"" if s is None else s if isinstance(s, bytes) else rp.script(s.records, s.once, s.zlp_idle)
    c = p.ctrl
    kw["ctrl"] = c if isinstance(c, bytes) else b"".join(
        rp.ctrl_record(r.bm, r.req, r.wv, r.wi, r.data, r.any_wv, r.any_wi, r.link) for r in c)
    return rp.Personality(**kw)


OUT_PID = 0x61E2
OUT_HID_EP, OUT_VINT_EP, OUT_VBULK_EP = 0x02, 0x03, 0x04
# A vendor-page report, 4 bytes in and 8 out.
VEND_PAGE_DESC = bytes.fromhex("0600ff0901a1010902150026ff007508950481020903750895089102c0")


def out_personality():
    """A silent mouse; a vendor-page HID interface with an 8-byte interrupt OUT; a vendor interface with 8-byte
    interrupt and bulk OUTs."""
    body = (core.itf(0, 1, 3, 1, 2) + core.hid(len(core.MOUSE_REPORT)) + core.ep(0x81)
            + core.itf(1, 2, 3) + core.hid(len(VEND_PAGE_DESC)) + core.ep(0x82) + core.ep(OUT_HID_EP)
            + core.itf(2, 2, 0xFF) + core.ep(OUT_VINT_EP) + core.ep(OUT_VBULK_EP, 8, 0, 2))
    return core.personality(OUT_PID, core.cfg(3, body),
                            [core.EndpointSpec(0x81, 3, 1, 8, 3), core.EndpointSpec(0x82, 3, 1, 8, 4),
                             core.EndpointSpec(OUT_HID_EP, 3, 1, 8), core.EndpointSpec(OUT_VINT_EP, 3, 1, 8),
                             core.EndpointSpec(OUT_VBULK_EP, 2, 1, 8)],
                            hid_report=core.MOUSE_REPORT, hid_report2=VEND_PAGE_DESC)


def vendor_seven_shapes():
    """Seven vendor endpoints beside a mouse, three IN and four OUT: across two interfaces, on one, and one
    on each of seven, as (name, PID, personality, vendor interfaces)."""
    ins = [core.EndpointSpec(0x81, 3, 1, 8, 3)] + [core.EndpointSpec(a, 3, 1, 64, 64) for a in (0x82, 0x83, 0x84)]
    eps = ins + [core.EndpointSpec(a, 3, 1, 64) for a in (0x01, 0x02, 0x03, 0x04)]
    order = (0x82, 0x01, 0x83, 0x02, 0x84, 0x03, 0x04)
    split = (core.MOUSE_IF
             + core.itf(1, 4, 0xFF) + core.ep(0x82, 64) + core.ep(0x83, 64) + core.ep(0x01, 64) + core.ep(0x02, 64)
             + core.itf(2, 3, 0xFF) + core.ep(0x84, 64) + core.ep(0x03, 64) + core.ep(0x04, 64))
    one = core.MOUSE_IF + core.itf(1, 7, 0xFF) + b"".join(core.ep(a, 64) for a in order)
    seven = core.MOUSE_IF + b"".join(core.itf(1 + k, 1, 0xFF) + core.ep(a, 64) for k, a in enumerate(order))
    pumps = dict(pump=core.Pump(0x82, 1000, core.GEN_COUNTER), pump2=core.Pump(0x83, 1000, core.GEN_COUNTER))
    return [("two interfaces", 0x6218, core.personality(0x6218, core.cfg(3, split), eps, **pumps), (1, 2)),
            ("one interface", 0x6238, core.personality(0x6238, core.cfg(2, one), eps, **pumps), (1,)),
            ("seven interfaces", 0x6239, core.personality(0x6239, core.cfg(8, seven), eps, **pumps),
             tuple(range(1, 8)))]


LINE_DEFAULT = bytes.fromhex("80250000000008")


def class_device():
    """A mouse beside a CDC ACM interface with no union descriptor and a DFU runtime interface, each
    answering its class requests."""
    body = (core.MOUSE_IF
            + core.itf(1, 1, 2, 2, 1) + bytes.fromhex("0524001001" "04240206") + core.ep(0x82, 16)
            + core.itf(2, 0, 0xFE, 1, 1) + bytes.fromhex("09210bff0000041001"))
    ctrl = (core.ctrl_record(0xA1, 0x21, 0, 1, LINE_DEFAULT)
            + core.ctrl_record(0x21, 0x20, 0, 1, link=0)
            + core.ctrl_record(0x21, 0x22, 0, 1, any_wv=True)
            + core.ctrl_record(0xA1, 0x03, 0, 2, bytes.fromhex("006400000000"))
            + core.ctrl_record(0xA1, 0x05, 0, 2, b"\x00")
            + core.ctrl_record(0x21, 0x00, 0, 2, any_wv=True))
    return core.personality(0x620C, core.cfg(3, body),
                            [core.EndpointSpec(0x81, 3, 1, 8, 3), core.EndpointSpec(0x82, 3, 1, 16)],
                            pump=core.Pump(0x81, 1000, core.GEN_MOUSE_JIGGLE), ctrl=ctrl)


# A vendor-page report, 8 bytes in and 8 out.
VEND8_IO_DESC = bytes.fromhex("0600ff0901a101090215002600ff750895088102090395089102c0")
OUT_RATE_EPS = (0x01, 0x02, 0x03, 0x04)


def out_rate_personality(pid, slow_nak_ms=0):
    """A HID interface with an interrupt OUT beside a vendor interface with three OUT endpoints, 0x02
    taking one packet per `slow_nak_ms` ms when set."""
    body = (core.itf(0, 2, 3) + core.hid(len(VEND8_IO_DESC)) + core.ep(0x81, 8) + core.ep(0x01, 8)
            + core.itf(1, 3, 0xFF) + core.ep(0x02, 64) + core.ep(0x03, 64) + core.ep(0x04, 64))
    eps = [core.EndpointSpec(0x81, 3, 1, 8), core.EndpointSpec(0x01, 3, 1, 8),
           core.EndpointSpec(0x02, 3, 1, 64, 0, 0, 0, 0, slow_nak_ms), core.EndpointSpec(0x03, 3, 1, 64),
           core.EndpointSpec(0x04, 3, 1, 64)]
    return core.personality(pid, core.cfg(2, body), eps, hid_report=VEND8_IO_DESC)


def halt_personality():
    """A streaming mouse beside vendor endpoints that STALL (IN 0x82 after 200 packets, OUT 0x03 after 5,
    OUT 0x04 after 200, OUT 0x02 never), taking 30 ms to finish a CLEAR_FEATURE(HALT)."""
    body = (core.MOUSE_IF + core.itf(1, 4, 0xFF) + core.ep(0x82, 64) + core.ep(0x02, 64) + core.ep(0x03, 64)
            + core.ep(0x04, 64))
    eps = [core.EndpointSpec(0x81, 3, 1, 8, 3), core.EndpointSpec(0x82, 3, 1, 64, 64, 0, 0, 200),
           core.EndpointSpec(0x02, 3, 1, 64), core.EndpointSpec(0x03, 3, 1, 64, 0, 0, 0, 5),
           core.EndpointSpec(0x04, 3, 1, 64, 0, 0, 0, 200)]
    return core.personality(0x6236, core.cfg(2, body), eps, pump=core.Pump(0x82, 1000, core.GEN_COUNTER),
                            pump2=core.Pump(0x81, 1000, core.GEN_COUNTER), hooks=core.EnumHooks(slow_reset_ms=30))


def hid_halt_personality(pid, interval):
    """A still mouse beside a vendor-page HID interface whose interrupt IN 0x81, declaring `interval` ms,
    counts in its first byte, STALLs after 200 reports and takes 30 ms to clear."""
    body = (core.itf(0, 1, 3) + core.hid(len(core.VEND8_DESC)) + core.ep(0x81, 8, interval)
            + core.itf(1, 1, 3, 1, 2) + core.hid(len(core.MOUSE_DESC)) + core.ep(0x82))
    eps = [core.EndpointSpec(0x81, 3, 1, 8, 8, 0, 0, 200), core.EndpointSpec(0x82, 3, 1, 8, 3)]
    return core.personality(pid, core.cfg(2, body), eps, hid_report=core.VEND8_DESC, hid_report2=core.MOUSE_DESC,
                            rpt2_iface=1, pump=core.Pump(0x81, interval * 1000, core.GEN_COUNTER),
                            hooks=core.EnumHooks(slow_reset_ms=30))


SWITCH_PID = 0x6237


def switch_personality():
    """Counters on a HID interface (IN 0x81 in setting 0, 0x82 in 1) and on a vendor interface's IN 0x84
    beside OUT 0x04, with a vendor interface between holding IN 0x83 and OUT 0x03 in setting 0 and nothing in 1;
    SET_INTERFACE and CLEAR_FEATURE(HALT) take 30 ms."""
    rl = len(VEND8_IN_DESC)
    body = (core.itf(0, 1, 3) + core.hid(rl) + core.ep(0x81) + core.itf(0, 1, 3, alt=1) + core.hid(rl)
            + core.ep(0x82)
            + core.itf(1, 2, 0xFF) + core.ep(0x83, 64) + core.ep(0x03, 64) + core.itf(1, 0, 0xFF, alt=1)
            + core.itf(2, 2, 0xFF) + core.ep(0x84, 64) + core.ep(0x04, 64))
    eps = [core.EndpointSpec(0x81, 3, 1, 8, 8), core.EndpointSpec(0x82, 3, 1, 8, 8, alt=1),
           core.EndpointSpec(0x83, 3, 1, 64, 64), core.EndpointSpec(0x03, 3, 1, 64),
           core.EndpointSpec(0x84, 3, 1, 64, 64), core.EndpointSpec(0x04, 3, 1, 64)]
    return core.personality(SWITCH_PID, core.cfg(3, body), eps, hid_report=VEND8_IN_DESC,
                            pump=core.Pump(0x81, 1000, core.GEN_COUNTER), pump2=core.Pump(0x84, 1000, core.GEN_COUNTER),
                            alt_model=1, hooks=core.EnumHooks(slow_reset_ms=30))


def six_in_slow():
    """A mouse moving every millisecond beside a vendor interface: 0x82 streaming a counter every millisecond,
    0x83, 0x84 and 0x85 declaring a poll every 32 ms, 0x86 every millisecond."""
    body = (core.MOUSE_IF + core.itf(1, 5, 0xFF) + core.ep(0x82, 64) + core.ep(0x83, 64, 32) + core.ep(0x84, 64, 32)
            + core.ep(0x85, 64, 32) + core.ep(0x86, 64))
    eps = ([core.EndpointSpec(0x81, 3, 1, 8, 3)]
           + [core.EndpointSpec(a, 3, 1, 64, 64) for a in (0x82, 0x83, 0x84, 0x85, 0x86)])
    return core.personality(0x6240, core.cfg(2, body), eps,
                            pump=core.Pump(0x81, 1000, core.GEN_MOUSE_JIGGLE),
                            pump2=core.Pump(0x82, 1000, core.GEN_COUNTER))


def zlp_personalities():
    """Three devices pairing a HID interface (0x81, a 64-byte report over 32-byte packets) with a vendor
    one (0x82): `ends` ends every transfer with a zero-length packet, `alone` sends one alone after two packets,
    `idle` answers every poll with one."""
    cfg = core.cfg(2, core.itf(0, 1, 3) + core.hid(len(core.VEND64_DESC)) + core.ep(0x81, 32)
                   + core.itf(1, 1, 0xFF) + core.ep(0x82, 64))
    ends = core.personality(0x623B, cfg, [core.EndpointSpec(0x81, 3, 1, 32, 32),
                                          core.EndpointSpec(0x82, 3, 1, 64, 64)],
                            hid_report=core.VEND64_DESC, pump=core.Pump(0x81, 4000, core.GEN_BULK_ZLP, 1),
                            pump2=core.Pump(0x82, 4000, core.GEN_BULK_ZLP, 1))
    alone = core.personality(0x623C, cfg, [core.EndpointSpec(0x81, 3, 1, 32, 32),
                                           core.EndpointSpec(0x82, 3, 1, 64, 64)],
                             hid_report=core.VEND64_DESC,
                             pump=core.Pump(0x81, 4000, core.GEN_BULK_ZLP, 2),
                             pump2=core.Pump(0x82, 4000, core.GEN_BULK_ZLP, 2))
    idle = core.personality(0x623D, cfg, [core.EndpointSpec(0x81, 3, 1, 32, 0), core.EndpointSpec(0x82, 3, 1, 64, 0)],
                            hid_report=core.VEND64_DESC, pump=core.Pump(0x81, 1000, core.GEN_FIXED),
                            pump2=core.Pump(0x82, 1000, core.GEN_FIXED))
    return ends, alone, idle


BULK_MOVE_PID = 0x6242
HID_MULTI_PID = 0x6243
BIG_MPS_PID = 0x6244
SWAP_PID = 0x6247
# A vendor-page report descriptor declaring a 40-byte input report.
VEND40_DESC = bytes.fromhex("0600ff0901a1010901150026ff00750895288102c0")


def bulk_move_personality():
    """A mouse beside a vendor interface whose bulk IN streams a counter: on 0x82 in alternate setting 0, on 0x83 in
    1, the same stream."""
    body = (core.MOUSE_IF + core.itf(1, 1, 0xFF) + core.ep(0x82, 64, 0, attr=2)
            + core.itf(1, 1, 0xFF, alt=1) + core.ep(0x83, 64, 0, attr=2))
    eps = [core.EndpointSpec(0x81, 3, 1, 8, 3), core.EndpointSpec(0x82, 2, 1, 64, 64),
           core.EndpointSpec(0x83, 2, 1, 64, 64, alt=1)]
    return core.personality(BULK_MOVE_PID, core.cfg(2, body), eps, pump=core.Pump(0x82, 500, core.GEN_COUNTER),
                            alt_model=1)


def swap_personality():
    """A mouse beside a vendor interface listing interrupt INs 0x82 then 0x83 in setting 0 and the reverse in
    1, a counter streaming on the first and nothing on the second; SET_INTERFACE takes 30 ms."""
    body = (core.MOUSE_IF + core.itf(1, 2, 0xFF) + core.ep(0x82, 8, 1) + core.ep(0x83, 8, 1)
            + core.itf(1, 2, 0xFF, alt=1) + core.ep(0x83, 8, 1) + core.ep(0x82, 8, 1))
    eps = [core.EndpointSpec(0x81, 3, 1, 8, 3), core.EndpointSpec(0x82, 3, 1, 8, 8),
           core.EndpointSpec(0x83, 3, 1, 8, 8)]
    return core.personality(SWAP_PID, core.cfg(2, body), eps, pump=core.Pump(0x82, 1000, core.GEN_COUNTER),
                            alt_model=1, hooks=core.EnumHooks(slow_reset_ms=30))


def hid_multi_personality():
    """A HID interface whose 40-byte input report spans five 8-byte packets, streaming a counter: on 0x81 in
    alternate setting 0, on 0x82 in 1, the same stream."""
    rl = len(VEND40_DESC)
    body = (core.itf(0, 1, 3) + core.hid(rl) + core.ep(0x81, 8, 1) + core.itf(0, 1, 3, alt=1) + core.hid(rl)
            + core.ep(0x82, 8, 1))
    return core.personality(HID_MULTI_PID, core.cfg(1, body),
                            [core.EndpointSpec(0x81, 3, 1, 8, 40), core.EndpointSpec(0x82, 3, 1, 8, 40, alt=1)],
                            hid_report=VEND40_DESC, pump=core.Pump(0x81, 1000, core.GEN_COUNTER), alt_model=1)


def big_mps_personality():
    """A moving mouse beside a vendor interface whose interrupt IN declares a 256-byte packet, illegal at full
    speed, and sends 64-byte counters."""
    body = core.MOUSE_IF + core.itf(1, 1, 0xFF) + core.ep(0x82, 256, 1)
    return core.personality(BIG_MPS_PID, core.cfg(2, body),
                            [core.EndpointSpec(0x81, 3, 1, 8, 3), core.EndpointSpec(0x82, 3, 1, 256, 64)],
                            pump=core.Pump(0x81, 2000, core.GEN_MOUSE_JIGGLE),
                            pump2=core.Pump(0x82, 1000, core.GEN_COUNTER))


COUNTER_PID = 0x6260
COUNTER_HID_EP, COUNTER_VEND_EP = 0x82, 0x83
COUNTER_HID_IF, COUNTER_VEND_IF = 1, 2
COUNTER_PKT = 8


def counter_personality():
    """A silent mouse beside a vendor-page HID interface and a vendor interface, each streaming a counter every
    millisecond on an 8-byte interrupt IN."""
    body = (core.MOUSE_IF
            + core.itf(COUNTER_HID_IF, 1, 3) + core.hid(len(core.VEND8_DESC)) + core.ep(COUNTER_HID_EP, COUNTER_PKT)
            + core.itf(COUNTER_VEND_IF, 1, 0xFF) + core.ep(COUNTER_VEND_EP, COUNTER_PKT))
    eps = [core.EndpointSpec(0x81, 3, 1, 8, 3), core.EndpointSpec(COUNTER_HID_EP, 3, 1, COUNTER_PKT, COUNTER_PKT),
           core.EndpointSpec(COUNTER_VEND_EP, 3, 1, COUNTER_PKT, COUNTER_PKT)]
    return core.personality(COUNTER_PID, core.cfg(3, body), eps, hid_report2=core.VEND8_DESC,
                            rpt2_iface=COUNTER_HID_IF, pump=core.Pump(COUNTER_HID_EP, 1000, core.GEN_COUNTER),
                            pump2=core.Pump(COUNTER_VEND_EP, 1000, core.GEN_COUNTER))


BULK_COUNTER_PID = 0x6261
BULK_COUNTER_EP, BULK_COUNTER_IF = 0x83, 1
BULK_COUNTER_PKT = 64
# A tick faster than full speed carries 64-byte packets, so the bus sets the pace.
BULK_COUNTER_IV_US = 20


def bulk_counter_personality():
    """A silent mouse beside a vendor bulk IN streaming a counter as fast as the bus takes it."""
    body = (core.MOUSE_IF + core.itf(BULK_COUNTER_IF, 1, 0xFF)
            + core.ep(BULK_COUNTER_EP, BULK_COUNTER_PKT, 0, 2))
    eps = [core.EndpointSpec(0x81, 3, 1, 8, 3),
           core.EndpointSpec(BULK_COUNTER_EP, 2, 1, BULK_COUNTER_PKT, BULK_COUNTER_PKT)]
    return core.personality(BULK_COUNTER_PID, core.cfg(2, body), eps,
                            pump=core.Pump(BULK_COUNTER_EP, BULK_COUNTER_IV_US, core.GEN_COUNTER))
