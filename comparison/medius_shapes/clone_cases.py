"""Devices with unusual descriptors: gaps in interface numbering, a HID descriptor out of place, many or
high-numbered IN endpoints, report descriptors answered late or STALLed, alternate settings, a second configuration,
a device qualifier. SHAPES lists them with the sim's built-in personalities, by name and PID."""
from .core import (EndpointSpec, EnumHooks, GEN_COUNTER, GEN_FIXED, GEN_MOUSE_JIGGLE, KBD_DESC, MOUSE_DESC, MOUSE_IF,
                   Personality, Pump, SPEED_FULL, VEND8_DESC, VID, cfg, ctrl_record, device_desc, ep, hid, itf,
                   personality, xinput)

HID_OUT_ONLY_PID = 0x61E3
HID_OUT_ONLY_EP, HID_OUT_ONLY_MPS = 0x04, 15
# A boot keyboard with an LED output report, and a vendor-page 64-byte feature report.
BOOT_KBD_OUT_DESC = bytes.fromhex("05010906a101050719e029e71500250175019508810295017508810195057501050819012905"
                                  "910295017503910195067508150026ff00050719002aff008100c0")
LIGHTING_OUT_DESC = bytes.fromhex("0600ff0a00ffa101150026ff00190029ff75089540b102c0")


def hid_out_only():
    """A silent boot keyboard beside a HID interface with only a feature report and an interrupt OUT."""
    body = (itf(0, 1, 3, 1, 1) + hid(len(BOOT_KBD_OUT_DESC)) + ep(0x81)
            + itf(1, 1, 3) + hid(len(LIGHTING_OUT_DESC)) + ep(HID_OUT_ONLY_EP, HID_OUT_ONLY_MPS))
    return personality(HID_OUT_ONLY_PID, cfg(2, body),
                       [EndpointSpec(0x81, 3, 1, 8, 8), EndpointSpec(HID_OUT_ONLY_EP, 3, 1, HID_OUT_ONLY_MPS)],
                       hid_report=BOOT_KBD_OUT_DESC, hid_report2=LIGHTING_OUT_DESC)


def iface_gap():
    """A mouse on interface 0 and a keyboard on interface 2: no interface 1."""
    body = MOUSE_IF + itf(2, 1, 3, 1, 1) + hid(len(KBD_DESC)) + ep(0x82)
    return personality(0x6201, cfg(2, body), [EndpointSpec(0x81, 3, 1, 8, 3), EndpointSpec(0x82, 3, 1, 8, 8)],
                       hid_report2=KBD_DESC, rpt2_iface=2, pump=Pump(0x81, 1000, GEN_MOUSE_JIGGLE),
                       pump2=Pump(0x82, 8000, GEN_FIXED, 0))


def iface_from_one():
    """A mouse on interface 1 and a keyboard on interface 2: numbering starts at 1."""
    body = (itf(1, 1, 3, 1, 2) + hid(len(MOUSE_DESC)) + ep(0x81)
            + itf(2, 1, 3, 1, 1) + hid(len(KBD_DESC)) + ep(0x82))
    return personality(0x6202, cfg(2, body), [EndpointSpec(0x81, 3, 1, 8, 3), EndpointSpec(0x82, 3, 1, 8, 8)],
                       hid_report2=KBD_DESC, rpt2_iface=2, pump=Pump(0x81, 1000, GEN_MOUSE_JIGGLE),
                       pump2=Pump(0x82, 8000, GEN_FIXED, 0))


def hid_after_ep():
    """A mouse whose HID descriptor follows its endpoint descriptor."""
    body = itf(0, 1, 3, 1, 2) + ep(0x81) + hid(len(MOUSE_DESC))
    return personality(0x6203, cfg(1, body), [EndpointSpec(0x81, 3, 1, 8, 3)],
                       pump=Pump(0x81, 1000, GEN_MOUSE_JIGGLE),
                       ctrl=ctrl_record(0x81, 6, 0x2100, 0, hid(len(MOUSE_DESC))))


# A HID descriptor listing a physical descriptor before the report descriptor.
HID_PHYS_FIRST = bytes.fromhex("0c2111010002230300223200")


def hid_phys_first():
    """A mouse whose HID descriptor lists a physical descriptor before its report descriptor."""
    body = itf(0, 1, 3, 1, 2) + HID_PHYS_FIRST + ep(0x81)
    return personality(0x6204, cfg(1, body), [EndpointSpec(0x81, 3, 1, 8, 3)],
                       pump=Pump(0x81, 1000, GEN_MOUSE_JIGGLE),
                       ctrl=ctrl_record(0x81, 6, 0x2100, 0, HID_PHYS_FIRST)
                       + ctrl_record(0x81, 6, 0x2300, 0, b"\x01\x07\x00"))


def slow_report(pid, ms):
    """A mouse and a keyboard; the keyboard answers its first report descriptor fetch `ms` late."""
    body = MOUSE_IF + itf(1, 1, 3, 1, 1) + hid(len(KBD_DESC)) + ep(0x82)
    return personality(pid, cfg(2, body), [EndpointSpec(0x81, 3, 1, 8, 3), EndpointSpec(0x82, 3, 1, 8, 8)],
                       hid_report2=KBD_DESC, pump=Pump(0x81, 1000, GEN_MOUSE_JIGGLE),
                       hooks=EnumHooks(slow_rpt_iface=1, slow_rpt_ms=ms, slow_rpt_times=1))


def slow_report_450():
    return slow_report(0x6208, 450)


def slow_report_700():
    return slow_report(0x6209, 700)


def two_high_in():
    """A mouse and a vendor interface streaming on IN endpoints 5 and 6."""
    body = MOUSE_IF + itf(1, 2, 0xFF) + ep(0x85, 64) + ep(0x86, 64)
    return personality(0x6216, cfg(2, body), [EndpointSpec(0x81, 3, 1, 8, 3), EndpointSpec(0x85, 3, 1, 64, 64),
                       EndpointSpec(0x86, 3, 1, 64, 64)],
                       pump=Pump(0x85, 1000, GEN_COUNTER), pump2=Pump(0x86, 1000, GEN_COUNTER))


def five_in():
    """A mouse and four vendor IN endpoints, 0x82 and 0x85 streaming."""
    body = MOUSE_IF + itf(1, 4, 0xFF) + ep(0x82, 64) + ep(0x83, 64) + ep(0x84, 64) + ep(0x85, 64)
    eps = [EndpointSpec(0x81, 3, 1, 8, 3)] + [EndpointSpec(a, 3, 1, 64, 64) for a in (0x82, 0x83, 0x84, 0x85)]
    return personality(0x6235, cfg(2, body), eps,
                       pump=Pump(0x82, 1000, GEN_COUNTER), pump2=Pump(0x85, 1000, GEN_COUNTER))


def unused_config_five_in():
    """A mouse whose second configuration adds a vendor interface with IN endpoints 0x82-0x85."""
    vend = itf(1, 4, 0xFF) + ep(0x82, 64) + ep(0x83, 64) + ep(0x84, 64) + ep(0x85, 64)
    eps = [EndpointSpec(0x81, 3, 0, 8, 3)] + [EndpointSpec(a, 3, 2, 64, 64) for a in (0x82, 0x83, 0x84, 0x85)]
    return Personality(speed=SPEED_FULL, device=device_desc(VID, 0x62C1, 2),
                       configs=[cfg(1, MOUSE_IF), cfg(2, MOUSE_IF + vend, value=2)],
                       hid_report=MOUSE_DESC, endpoints=eps, pump=Pump(0x81, 1000, GEN_MOUSE_JIGGLE))


def six_in():
    """A mouse moving every millisecond beside a vendor interface with IN endpoints 0x82-0x86, 0x82 streaming a
    counter."""
    body = (MOUSE_IF + itf(1, 5, 0xFF) + ep(0x82, 64) + ep(0x83, 64) + ep(0x84, 64) + ep(0x85, 64)
            + ep(0x86, 64))
    eps = [EndpointSpec(0x81, 3, 1, 8, 3)] + [EndpointSpec(a, 3, 1, 64, 64) for a in (0x82, 0x83, 0x84, 0x85, 0x86)]
    return personality(0x623E, cfg(2, body), eps,
                       pump=Pump(0x81, 1000, GEN_MOUSE_JIGGLE), pump2=Pump(0x82, 1000, GEN_COUNTER))


def five_hid_interfaces():
    """Five HID interfaces with one IN each (0x81 8 B every 10 ms, a boot keyboard's 0x82 28 B, 0x83 64 B
    beside OUT 0x03, 0x84 8 B every 4 ms, 0x85 64 B), counters streaming on 0x85 and 0x83."""
    vend, kbd = VEND8_DESC, KBD_DESC
    body = (itf(0, 1, 3) + hid(len(vend)) + ep(0x81, 8, 10)
            + itf(1, 1, 3, 1, 1) + hid(len(kbd)) + ep(0x82, 28, 1)
            + itf(2, 2, 3) + hid(len(vend)) + ep(0x03, 64, 1) + ep(0x83, 64, 1)
            + itf(3, 1, 3) + hid(len(vend)) + ep(0x84, 8, 4)
            + itf(4, 1, 3) + hid(len(vend)) + ep(0x85, 64, 1))
    eps = [EndpointSpec(0x81, 3, 1, 8), EndpointSpec(0x82, 3, 1, 28), EndpointSpec(0x03, 3, 1, 64),
           EndpointSpec(0x83, 3, 1, 64, 8), EndpointSpec(0x84, 3, 1, 8), EndpointSpec(0x85, 3, 1, 64, 8)]
    return personality(0x623F, cfg(5, body), eps, hid_report=vend, hid_report2=kbd, rpt2_iface=1,
                       pump=Pump(0x85, 1000, GEN_COUNTER), pump2=Pump(0x83, 1000, GEN_COUNTER))


# An 8-byte vendor-page input report.
VEND8_IN_DESC = bytes.fromhex("0600ff0901a101090215002600ff750895088102c0")


def hid_alt():
    """A HID interface streaming a counter at 500 Hz on IN 0x81 in alternate setting 0 and on IN 0x82 in 1."""
    rl = len(VEND8_IN_DESC)
    body = itf(0, 1, 3) + hid(rl) + ep(0x81) + itf(0, 1, 3, alt=1) + hid(rl) + ep(0x82)
    return personality(0x6232, cfg(1, body), [EndpointSpec(0x81, 3, 1, 8, 8), EndpointSpec(0x82, 3, 1, 8, 8, alt=1)],
                       hid_report=VEND8_IN_DESC, pump=Pump(0x81, 2000, GEN_COUNTER), alt_model=1)


def vend_alt():
    """A vendor interface streaming a counter at 500 Hz in 64-byte packets on IN 0x83 in alternate setting 0 and on
    IN 0x85 in 1."""
    body = itf(0, 1, 0xFF) + ep(0x83, 64) + itf(0, 1, 0xFF, alt=1) + ep(0x85, 64)
    return personality(0x6234, cfg(1, body),
                       [EndpointSpec(0x83, 3, 1, 64, 64), EndpointSpec(0x85, 3, 1, 64, 64, alt=1)],
                       pump=Pump(0x83, 2000, GEN_COUNTER), alt_model=1)


def hid_one_alt():
    """A HID interface with one alternate setting, streaming a counter at 250 Hz on IN 0x81."""
    body = itf(0, 1, 3) + hid(len(VEND8_IN_DESC)) + ep(0x81)
    return personality(0x6233, cfg(1, body), [EndpointSpec(0x81, 3, 1, 8, 8)],
                       hid_report=VEND8_IN_DESC, pump=Pump(0x81, 4000, GEN_COUNTER), alt_model=1)


# The device qualifier of a mouse that could run at high speed.
SPEED_QUALIFIER = bytes([10, 6, 0x00, 0x02, 0, 0, 0, 64, 1, 0])


def speed_other_config():
    """That mouse's other-speed configuration."""
    body = itf(0, 1, 3, 1, 2) + hid(len(MOUSE_DESC)) + ep(0x81, 8, 4)
    c = cfg(1, body)
    return c[:1] + bytes([7]) + c[2:]


def speed_both():
    """A mouse that answers its device qualifier and other-speed configuration."""
    return personality(0x6210, cfg(1, MOUSE_IF), [EndpointSpec(0x81, 3, 1, 8, 3)],
                       pump=Pump(0x81, 1000, GEN_MOUSE_JIGGLE), qualifier=SPEED_QUALIFIER,
                       ctrl=ctrl_record(0x80, 6, 0x0700, 0, speed_other_config()))


def speed_neither():
    """A mouse that STALLs both."""
    return personality(0x6211, cfg(1, MOUSE_IF), [EndpointSpec(0x81, 3, 1, 8, 3)],
                       pump=Pump(0x81, 1000, GEN_MOUSE_JIGGLE))


def rpt_stall_declared_zero():
    """A mouse beside an interface that declares a zero-length report descriptor and STALLs its fetch."""
    body = MOUSE_IF + itf(1, 1, 3) + hid(0) + ep(0x82)
    return personality(0x620B, cfg(2, body), [EndpointSpec(0x81, 3, 1, 8, 3), EndpointSpec(0x82, 3, 1, 8, 8)],
                       pump=Pump(0x81, 1000, GEN_MOUSE_JIGGLE))


def rpt_stall_declared():
    """A mouse beside a keyboard that declares its report descriptor and STALLs every fetch of it."""
    body = MOUSE_IF + itf(1, 1, 3, 1, 1) + hid(len(KBD_DESC)) + ep(0x82)
    return personality(0x620A, cfg(2, body), [EndpointSpec(0x81, 3, 1, 8, 3), EndpointSpec(0x82, 3, 1, 8, 8)],
                       hid_report2=KBD_DESC, pump=Pump(0x81, 1000, GEN_MOUSE_JIGGLE),
                       hooks=EnumHooks(slow_rpt_iface=1, slow_rpt_ms=0xFFFF, slow_rpt_times=0xFF))


def ten_interfaces():
    """Ten interfaces: a mouse, a keyboard, two vendor interfaces with endpoints, six without."""
    body = (MOUSE_IF + itf(1, 1, 3, 1, 1) + hid(len(KBD_DESC)) + ep(0x82)
            + itf(2, 1, 0xFF) + ep(0x83, 64) + itf(3, 1, 0xFF) + ep(0x03, 64)
            + b"".join(itf(n, 0, 0xFF) for n in range(4, 10)))
    eps = [EndpointSpec(0x81, 3, 1, 8, 3), EndpointSpec(0x82, 3, 1, 8, 8),
           EndpointSpec(0x83, 3, 1, 64, 64), EndpointSpec(0x03, 3, 1, 64)]
    return personality(0x6205, cfg(10, body), eps, hid_report2=KBD_DESC,
                       pump=Pump(0x83, 1000, GEN_COUNTER), pump2=Pump(0x81, 1000, GEN_MOUSE_JIGGLE))


def nine_alternates():
    """A mouse beside a vendor interface declaring nine alternate settings."""
    body = MOUSE_IF + b"".join(itf(1, 0, 0xFF, alt=a) for a in range(9))
    return personality(0x6206, cfg(2, body), [EndpointSpec(0x81, 3, 1, 8, 3)],
                       pump=Pump(0x81, 1000, GEN_MOUSE_JIGGLE), alt_model=1)


def high_interface():
    """A vendor interface numbered 12, alone, streaming a counter on IN 0x81."""
    body = itf(12, 1, 0xFF) + ep(0x81, 64)
    return personality(0x623A, cfg(1, body), [EndpointSpec(0x81, 3, 1, 64, 64)],
                       pump=Pump(0x81, 1000, GEN_COUNTER))


def far_interfaces():
    """A vendor-page HID interface numbered 200 and a vendor interface numbered 60, each streaming a counter."""
    body = (itf(200, 1, 3) + hid(len(VEND8_DESC)) + ep(0x81, 8, 1)
            + itf(60, 1, 0xFF) + ep(0x82, 64))
    eps = [EndpointSpec(0x81, 3, 1, 8, 8), EndpointSpec(0x82, 3, 1, 64, 64)]
    return personality(0x6241, cfg(2, body), eps,
                       hid_report=VEND8_DESC, pump=Pump(0x81, 1000, GEN_COUNTER),
                       pump2=Pump(0x82, 1000, GEN_COUNTER))


def long_configuration():
    """A 2083-byte configuration: a mouse, and a vendor interface carrying eight class descriptors."""
    body = MOUSE_IF + itf(1, 0, 0xFF) + 8 * (bytes([255, 0x24]) + bytes(range(253)))
    return personality(0x6207, cfg(2, body), [EndpointSpec(0x81, 3, 1, 8, 3)],
                       pump=Pump(0x81, 1000, GEN_MOUSE_JIGGLE))


# (name, a builder or the sim's built-in personality as the sim's built-in personality name and arguments, PID)
SHAPES = [
    ("mouse", ["mouse"], 0x6100),
    ("composite", ["composite"], 0x6102),
    ("vendorintr", ["vendorintr"], 0x6140),
    ("vendoriso", ["vendoriso"], 0x6142),
    ("altsetting", ["altsetting"], 0x6143),
    ("hid_alt", hid_alt, 0x6232),
    ("vendbulkhigh", ["vendbulkhigh"], 0x6145),
    ("vendintrep 0x84", ["vendintrep", "0x84"], 0x6184),
    ("vendintrep 0x85", ["vendintrep", "0x85"], 0x6185),
    ("vendintrep 0x86", ["vendintrep", "0x86"], 0x6186),
    ("two_high_in", two_high_in, 0x6216),
    ("five_in", five_in, 0x6235),
    ("six_in", six_in, 0x623E),
    ("five_hid_interfaces", five_hid_interfaces, 0x623F),
    ("vendintrep 0x87", ["vendintrep", "0x87"], 0x6187),
    ("widehid 64", ["widehid", "64"], 0x6150),
    ("widehid 65 8", ["widehid", "65", "8"], 0x6151),
    ("cdcnotify", ["cdcnotify"], 0x6146),
    ("bigreport 0 1500", ["bigreport", "0", "1500"], 0x6147),
    ("bigreport 3000 0", ["bigreport", "3000", "0"], 0x6148),
    ("hidbulkin", ["hidbulkin"], 0x6144),
    ("hidtwoin", ["hidtwoin"], 0x6149),
    ("multiconfig", ["multiconfig"], 0x6120),
    ("ctrlep", ["ctrlep"], 0x614A),
    ("multiconfigovercap", ["multiconfigovercap"], 0x614B),
    ("unused_config_five_in", unused_config_five_in, 0x62C1),
    ("multiconfigrptgap", ["multiconfigrptgap"], 0x614C),
    ("hid_out_only", hid_out_only, HID_OUT_ONLY_PID),
    ("iface_gap", iface_gap, 0x6201),
    ("iface_from_one", iface_from_one, 0x6202),
    ("hid_after_ep", hid_after_ep, 0x6203),
    ("hid_phys_first", hid_phys_first, 0x6204),
    ("slow_report_450", slow_report_450, 0x6208),
    ("slow_report_700", slow_report_700, 0x6209),
    ("rpt_stall_declared_zero", rpt_stall_declared_zero, 0x620B),
    ("rpt_stall_declared", rpt_stall_declared, 0x620A),
    ("ten_interfaces", ten_interfaces, 0x6205),
    ("nine_alternates", nine_alternates, 0x6206),
    ("high_interface", high_interface, 0x623A),
    ("far_interfaces", far_interfaces, 0x6241),
    ("long_configuration", long_configuration, 0x6207),
    ("xinput", xinput, 0x6200),
    ("speed_both", speed_both, 0x6210),
    ("speed_neither", speed_neither, 0x6211),
]
