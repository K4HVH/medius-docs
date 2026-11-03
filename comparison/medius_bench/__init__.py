"""Bench helpers for running tests against a box: which USB port its clone is on, which input node is
the clone's mouse, whether a device is connected on a hub port, and who else holds a serial port.

`quiet` keeps the clone off this desktop while tests run against it (run by `comparison/quiet_clone.py`, or
by the no-sim run itself), and writes the udev rule these helpers read. Linux only.
"""
import os
import re
import subprocess
import time

QUIET_RULE = "/run/udev/rules.d/99-medius-quiet-clone.rules"


def clone_usb_port(rule=QUIET_RULE):
    """The USB port tests guard (`1-4`): the first one the quiet rule names, or None
    without one.

    A second box's clone can carry the same VID:PID as this one's, so a lookup by VID:PID alone reads
    whichever the bus lists first. `on_clone_port` and `on_clone_sysfs` pin lookups to this port."""
    try:
        with open(rule) as f:
            ports = re.findall(r'KERNELS=="([^"]+)"', f.read())
    except OSError:
        return None
    return ports[0] if ports else None


def native_sim(rule=QUIET_RULE):
    """The native sim `quiet_clone.py --native` names, as (its control port, its USB port), or None.

    The native sim is a second device emulator plugged straight into this PC, presenting the same device
    as the one behind the box, so a test reads the clone and the real device the same way."""
    try:
        with open(rule) as f:
            m = re.search(r"^# native-sim (\S+) (\S+)$", f.read(), re.M)
    except OSError:
        return None
    if not m:
        return None
    return f"/dev/serial/by-id/usb-1a86_USB_Single_Serial_{m.group(1)}-if00", m.group(2)


def on_clone_port(dev):
    """pyusb `custom_match`: the device sits on the clone's USB port, or no port is known."""
    port = clone_usb_port()
    if port is None:
        return True
    bus, _, path = port.partition("-")
    try:
        return dev.bus == int(bus) and tuple(dev.port_numbers or ()) == tuple(int(x) for x in path.split("."))
    except ValueError:
        return False


def on_clone_sysfs(path):
    """A sysfs path (a /sys/bus/usb/devices entry, or a device path through it) is on the clone's port,
    or no port is known."""
    port = clone_usb_port()
    if port is None:
        return True
    found = re.findall(r"(?:^|/)(\d+-[\d.]+)(?=$|/|:)", path)
    return bool(found) and found[-1] == port


def clone_event_node(vid=None, pid=None, wait_s=0.0):
    """The clone's mouse event node, or None.

    Event numbers shift on any replug, and a wrong node reads all zeros. The clone's keyboard
    collections share its VID:PID, so ID_INPUT_MOUSE tells them apart. Pass the cloned device's vid and
    pid to pin this box. Without them a lone USB mouse is taken, and two mice (a second box's clone, a
    real mouse) give None rather than a node that may be another box's. `wait_s` polls that long,
    covering the gap while the box enumerates the clone again."""
    end = time.time() + wait_s
    while True:
        node = _clone_event_node_once(vid, pid)
        if node or time.time() >= end:
            return node
        time.sleep(0.25)


def _clone_event_node_once(vid, pid):
    found, devices = None, set()
    nodes = [n for n in os.listdir("/dev/input") if n.startswith("event")]
    for name in sorted(nodes, key=lambda n: int(n[5:])):
        node = "/dev/input/" + name
        try:
            props = subprocess.run(["udevadm", "info", "-q", "property", "-n", node],
                                   capture_output=True, text=True, timeout=5).stdout
        except (OSError, subprocess.SubprocessError):
            continue
        p = dict(line.split("=", 1) for line in props.splitlines() if "=" in line)
        if p.get("ID_INPUT_MOUSE") != "1" or p.get("ID_BUS") != "usb":
            continue
        if vid is not None and int(p.get("ID_VENDOR_ID", "-1"), 16) != vid:
            continue
        if pid is not None and int(p.get("ID_MODEL_ID", "-1"), 16) != pid:
            continue
        if not on_clone_sysfs(p.get("DEVPATH", "")):
            continue
        if vid is not None and pid is not None:
            return node
        devices.add((p.get("ID_VENDOR_ID"), p.get("ID_MODEL_ID"), p.get("ID_PATH", "").split(":1.")[0]))
        found = found or node
    return found if len(devices) == 1 else None


class HubPort:
    """Whether a device is connected on a USB port (`1-4`), read from its hub with GET_STATUS(port) on
    demand. It shows a device arriving or leaving within a read (~0.3 ms), where the kernel's hub driver
    hears of it at the hub's next status poll (every 256 ms on common hubs). Needs root."""

    def __init__(self, usb):
        import ctypes
        import fcntl
        hub, _, port = usb.rpartition(".")
        d = f"/sys/bus/usb/devices/{hub}"
        bus, dev = (int(open(f"{d}/{k}").read()) for k in ("busnum", "devnum"))

        class Ctrl(ctypes.Structure):
            _fields_ = [("bRequestType", ctypes.c_uint8), ("bRequest", ctypes.c_uint8),
                        ("wValue", ctypes.c_uint16), ("wIndex", ctypes.c_uint16), ("wLength", ctypes.c_uint16),
                        ("timeout", ctypes.c_uint32), ("data", ctypes.c_void_p)]

        self._ioctl = fcntl.ioctl
        self._buf = ctypes.create_string_buffer(4)
        self._req = Ctrl(0xA3, 0x00, 0, int(port), 4, 1000, ctypes.cast(self._buf, ctypes.c_void_p))
        self._op = (3 << 30) | (ctypes.sizeof(Ctrl) << 16) | (ord("U") << 8)     # USBDEVFS_CONTROL
        self.fd = os.open(f"/dev/bus/usb/{bus:03d}/{dev:03d}", os.O_RDWR)

    def connected(self):
        self._ioctl(self.fd, self._op, self._req)
        return bool(self._buf.raw[0] & 1)

    def close(self):
        os.close(self.fd)


def port_holders(port, include_self=False):
    """The processes with `port` open, as 'name (pid N)'; empty where /proc can't say. This process is
    left out unless `include_self`. Each descriptor's link is read, never followed: a stat of one on a
    hung network mount would hang here."""
    try:
        path = os.path.realpath(port)
        me = os.getpid()
        pids = [p for p in os.listdir("/proc") if p.isdigit() and (include_self or int(p) != me)]
    except OSError:
        return []
    held = []
    for pid in pids:
        try:
            fds = os.listdir(f"/proc/{pid}/fd")
        except OSError:
            continue
        for fd in fds:
            try:
                target = os.readlink(f"/proc/{pid}/fd/{fd}")
            except OSError:
                continue
            if target == path:
                try:
                    with open(f"/proc/{pid}/comm") as f:
                        name = f.read().strip()
                except OSError:
                    name = "?"
                held.append(f"{name} (pid {pid})")
                break
    return held


def restore_vmin(s):
    """Put a pyserial port's read minimum back to 1 before closing it. pyserial leaves it at 0, and a
    browser's Web Serial that opens the port next reads 0 bytes and calls the device lost."""
    try:
        import termios
        attrs = termios.tcgetattr(s.fileno())
        attrs[6][termios.VMIN] = 1
        termios.tcsetattr(s.fileno(), termios.TCSANOW, attrs)
    except (ImportError, OSError, ValueError, AttributeError):
        pass
