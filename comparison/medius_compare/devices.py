"""What a test leg runs against: a still device an owner plugged into the box, or a shape the sim plays.

A leg names its device: `still-mouse`, `still-keyboard` or `still-composite`, which any bench has, or
`sim:<shape>`, which only the sim can play: a builder in the test's own `SHAPES`, or a function in
`medius_shapes`.
"""
import glob
import hashlib
import importlib
import os
import select
import struct
import time
from dataclasses import dataclass, field
from typing import Protocol

from . import layout as layout_mod

STILL = {"still-mouse": ("mouse",), "still-keyboard": ("keyboard",), "still-composite": ("mouse", "keyboard")}
DEFAULT_BUILTIN = "gamingmouse"
EVIOCGBIT = lambda ev, n: 0x80004520 | (n << 16) | ev  # noqa: E731
EV_KEY, EV_REL = 1, 2
REL_X, KEY_A = 0, 30
EV = struct.Struct("llHHi")


@dataclass
class Presented:
    vid: int
    pid: int
    product: str
    nodes: list = field(default_factory=list)
    descriptor_sha256: str = ""
    layout: object = None
    usb: str = ""

    def record(self, leg: str) -> dict:
        return {"leg": leg, "vid": self.vid, "pid": self.pid, "product": self.product,
                "descriptor_sha256": self.descriptor_sha256}


class LegUnavailable(Exception):
    """The leg's device can't be had on this bench (no sim, no keyboard plugged in)."""


class Devices(Protocol):
    def present(self, leg, box: str, shapes=None) -> Presented: ...
    def restore(self, box: str) -> None: ...


def usb_nodes(port, sysfs="/sys"):
    """The evdev and hidraw nodes of the USB device on `port`, interface order."""
    found = []
    for cls, prefix in (("input", "event"), ("hidraw", "hidraw")):
        for path in glob.glob(f"{sysfs}/class/{cls}/{prefix}*"):
            real = os.path.realpath(os.path.join(path, "device"))
            if f"/{port}:" in real:
                found.append((real, "/dev/" + ("input/" if cls == "input" else "") + os.path.basename(path)))
    return [node for _, node in sorted(found)]


def kinds_of(node):
    """What an evdev node is: `mouse` if it reports REL_X, `keyboard` if it has KEY_A."""
    import fcntl
    kinds = set()
    try:
        fd = os.open(node, os.O_RDONLY | os.O_NONBLOCK)
    except OSError:
        return kinds
    try:
        rel, key = bytearray(8), bytearray(96)
        fcntl.ioctl(fd, EVIOCGBIT(EV_REL, len(rel)), rel)
        fcntl.ioctl(fd, EVIOCGBIT(EV_KEY, len(key)), key)
        if rel[0] & (1 << REL_X):
            kinds.add("mouse")
        if key[KEY_A // 8] & (1 << (KEY_A % 8)):
            kinds.add("keyboard")
    except OSError:
        pass
    finally:
        os.close(fd)
    return kinds


def moved(nodes, secs):
    """Whether any of `nodes` reports motion or a key during `secs`."""
    fds = []
    try:
        for n in nodes:
            fds.append(os.open(n, os.O_RDONLY | os.O_NONBLOCK))
        end = time.monotonic() + secs
        while (left := end - time.monotonic()) > 0:
            r, _, _ = select.select(fds, [], [], left)
            for fd in r:
                data = os.read(fd, EV.size * 64)
                for i in range(0, len(data) - len(data) % EV.size, EV.size):
                    _, _, typ, _, val = EV.unpack_from(data, i)
                    if typ in (EV_REL, EV_KEY) and val:
                        return True
        return False
    finally:
        for fd in fds:
            os.close(fd)


def describe(port, sysfs="/sys"):
    """VID, PID, product, a hash of the device's descriptors, and the mouse layout, read from sysfs."""
    d = f"{sysfs}/bus/usb/devices/{port}"

    def read(name, binary=False):
        try:
            with open(os.path.join(d, name), "rb" if binary else "r") as f:
                return f.read() if binary else f.read().strip()
        except OSError:
            return b"" if binary else ""

    lay = None
    for rd in sorted(glob.glob(f"{d}/{port}:*/*:*/report_descriptor")):
        with open(rd, "rb") as f:
            lay = lay or layout_mod.mouse_layout(f.read())
    return {"vid": int(read("idVendor") or "0", 16), "pid": int(read("idProduct") or "0", 16),
            "product": read("product"), "descriptor_sha256": hashlib.sha256(read("descriptors", True)).hexdigest(),
            "layout": lay}


class RealDevices:
    """The device an owner plugged into the box, found on the clone's USB port (the port quiet_clone.py
    guards). It must sit still while a leg runs: a hand on it would be measured as the box."""

    def __init__(self, box_name, clone_port=None, settle_s=1.0, nodes=usb_nodes, kinds=kinds_of, moved=moved,
                 describe=describe):
        if clone_port is None:
            from medius_bench import clone_usb_port
            clone_port = clone_usb_port()
        self.box_name, self.clone_port, self.settle_s = box_name, clone_port, settle_s
        self._nodes, self._kinds, self._moved, self._describe = nodes, kinds, moved, describe

    def present(self, leg, box, shapes=None):
        if leg.device not in STILL:
            raise LegUnavailable(f"leg {leg.id} plays {leg.device}, which needs the sim")
        if not self.clone_port:
            raise LegUnavailable("quiet_clone.py is not running with the clone's USB port")
        nodes = self._nodes(self.clone_port)
        events = [n for n in nodes if "/input/" in n]
        have = set().union(*(self._kinds(n) for n in events)) if events else set()
        for kind in STILL[leg.device]:
            if kind not in have:
                raise LegUnavailable(f"leg {leg.id} needs a {kind} plugged into the box")
        if self._moved(events, self.settle_s):
            raise LegUnavailable(f"the device moved in the {self.settle_s:.0f} s it must sit still; leave it "
                                 f"untouched and run again")
        return Presented(**self._describe(self.clone_port), nodes=nodes, usb=self.clone_port)

    def restore(self, box):
        pass


def _sim_link(port):
    from medius_shapes.personalities import sim_link
    return sim_link(port)


def appears(port, vid, pid, timeout, sysfs="/sys"):
    """Wait until the USB device on `port` is vid:pid with an input or hidraw node."""
    d = f"{sysfs}/bus/usb/devices/{port}"
    end = time.monotonic() + timeout
    while True:
        try:
            with open(f"{d}/idVendor") as f:
                v = int(f.read(), 16)
            with open(f"{d}/idProduct") as f:
                p = int(f.read(), 16)
            if (v, p) == (vid, pid) and usb_nodes(port, sysfs):
                return True
        except (OSError, ValueError):
            pass
        if time.monotonic() >= end:
            return False
        time.sleep(0.1)


def _builtin_id(name):
    from medius_shapes.personalities import builtin
    return builtin(name)


def devnum(port, sysfs="/sys"):
    try:
        with open(f"{sysfs}/bus/usb/devices/{port}/devnum") as f:
            return int(f.read())
    except (OSError, ValueError):
        return None


def reenumerated(port, before, timeout, sysfs="/sys", keep_s=3.0):
    """Wait until the device on `port` is a new enumeration (another device number) with input nodes, or is still
    the same one `keep_s` later: a clone already of that device can be kept rather than made again."""
    start = time.monotonic()
    while True:
        now = devnum(port, sysfs)
        if now is not None and usb_nodes(port, sysfs):
            if now != before:
                time.sleep(1.0)
                return True
            if time.monotonic() - start >= keep_s:
                return True
        if time.monotonic() - start >= timeout:
            return False
        time.sleep(0.1)


def shape(name):
    """The zero-argument builder `name` (after `sim:`) in any medius_shapes module."""
    fn_name = name.replace("-", "_")
    for module in ("scripted", "clone_cases", "personalities", "ep0_stacks", "core"):
        try:
            mod = importlib.import_module(f"medius_shapes.{module}")
        except ImportError:
            continue
        fn = getattr(mod, fn_name, None)
        if callable(fn):
            return fn
    raise LegUnavailable(f"no shape {name} in medius_shapes")


class SimDevices:
    """Shapes the sims play: on the sim behind the box for a box's leg, on the sim lent to the PC hub for the
    native reference."""

    def __init__(self, bench, link=_sim_link, shapes=None, appears=appears, describe=describe, nodes=usb_nodes,
                 timeout=30.0):
        self.bench = bench
        self._link, self._shapes, self._appears = link, shapes or {}, appears
        self._describe, self._nodes, self.timeout = describe, nodes, timeout
        self._builtin, self._changed = _builtin_id, reenumerated

    def _builder(self, device, shapes=None):
        if device in self._shapes:
            return self._shapes[device]
        if device in STILL:
            return shape(device.replace("-", "_"))
        name = device.split(":", 1)[1]
        if shapes and name in shapes:
            return shapes[name]
        return shape(name)

    def _sim_for(self, box):
        if box in self.bench.box:
            [name] = [s for s, cfg in self.bench.sim.items() if cfg["box"] == box]
            return name, self.bench.box[box]["clone"]
        cabling = self.bench.layout_now()
        if not cabling.startswith("native:"):
            raise LegUnavailable(f"the native reference needs a sim on the PC hub; the bench is cabled {cabling}")
        under_test = cabling.split(":", 1)[1]
        [name] = [s for s, cfg in self.bench.sim.items() if cfg["box"] != under_test]
        return name, self.bench.sim[name]["native"]

    def present(self, leg, box, shapes=None):
        name, port = self._sim_for(box)
        if leg.device.startswith("sim:builtin:"):
            before = devnum(port)
            link = self._link(self.bench.sim_port(name))
            try:
                link.present_builtin(self._builtin(leg.device.split(":", 2)[2]))
            finally:
                link.close()
            if not self._changed(port, before, self.timeout):
                raise LegUnavailable(f"{leg.device} did not appear on {port}")
            return Presented(**self._describe(port), nodes=self._nodes(port), usb=port)
        p = self._builder(leg.device, shapes)()
        vid = p.device[8] | p.device[9] << 8
        pid = p.device[10] | p.device[11] << 8
        link = self._link(self.bench.sim_port(name))
        try:
            link.present(p, settle=0.5)
        finally:
            link.close()
        if not self._appears(port, vid, pid, self.timeout):
            raise LegUnavailable(f"{leg.device} did not appear on {port} as {vid:04x}:{pid:04x}")
        return Presented(**self._describe(port), nodes=self._nodes(port), usb=port)

    def park_others(self, box):
        """A silent mouse on every other box's sim, unless that sim is lent to the PC hub: the PC then polls a
        quiet clone beside the one under test, the same for both boxes."""
        cabling = self.bench.layout_now()
        lent = cabling.split(":", 1)[1] if cabling.startswith("native:") else None
        for name, cfg in self.bench.sim.items():
            if cfg["box"] == box or (lent and cfg["box"] != lent):
                continue
            link = self._link(self.bench.sim_port(name))
            try:
                link.present_builtin(self._builtin("silentmouse"))
            finally:
                link.close()

    def sim_link(self, box):
        """An open link to the sim playing `box`'s legs."""
        name, _ = self._sim_for(box)
        return self._link(self.bench.sim_port(name))

    def restore(self, box):
        """Back to the bench's default device on that box's sim."""
        try:
            name, _ = self._sim_for(box)
        except LegUnavailable:
            return
        from medius_shapes.personalities import builtin
        link = self._link(self.bench.sim_port(name))
        try:
            link.present_builtin(builtin(DEFAULT_BUILTIN))
        finally:
            link.close()

    def locate(self, serial):
        """The USB port a sim's device is on: it plays a beacon mouse whose PID no other shape uses, and the
        beacon is looked for on every port the bench names."""
        from medius_shapes import core
        [name] = [s for s, cfg in self.bench.sim.items() if cfg["serial"] == serial]
        pid = 0x6FF0 + list(self.bench.sim).index(name)
        beacon = core.personality(pid, core.cfg(1, core.MOUSE_IF), [core.EndpointSpec(0x81, 3, 1, 8, 3)])
        link = self._link(self.bench.sim_port(name))
        try:
            link.present(beacon, settle=0.5)
        finally:
            link.close()
        ports = [b["clone"] for b in self.bench.box.values()] + sorted({s["native"] for s in self.bench.sim.values()})
        end = time.monotonic() + 10.0
        while time.monotonic() < end:
            for port in ports:
                if self._appears(port, core.VID, pid, 0.0):
                    return port
            time.sleep(0.2)
        return None

    def describe_sim(self, serial):
        """The sim's build, as its DIAG reports it."""
        [name] = [s for s, cfg in self.bench.sim.items() if cfg["serial"] == serial]
        link = self._link(self.bench.sim_port(name))
        try:
            return {"build": link.diag().get("build")}
        finally:
            link.close()
