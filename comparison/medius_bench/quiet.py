"""Keep a clone off this desktop while tests run against it.

libinput ignores whatever enumerates on the clone's USB port, through a runtime udev rule gone at reboot or when
the holder ends. Every input node on that port is held open too: usbhid polls an interrupt-IN endpoint only while
its node is open, so with the desktop ignoring the clone, the wire would otherwise go quiet. The rule names the
process holding it, which `clone_guard` checks before a test injects anything.
"""
import contextlib
import os
import re
import select
import signal
import subprocess
import threading
import time

from . import QUIET_RULE as RULE


def usb_port_of(name):
    """The USB port an input node sits on (1-4), and the vid:pid of the device there."""
    real = os.path.realpath(f"/sys/class/input/{name}/device")
    for part in real.split("/"):
        if re.fullmatch(r"\d+-[\d.]+:\d+\.\d+", part):
            dev = f"/sys/bus/usb/devices/{part.split(':')[0]}"
            try:
                ident = open(dev + "/idVendor").read().strip() + ":" + open(dev + "/idProduct").read().strip()
            except OSError:
                return None, None
            return part.split(":")[0], ident.lower()
    return None, None


def input_ports():
    """Every USB port with an input device on it, as (port, vid:pid, product name)."""
    out = {}
    for name in sorted(os.listdir("/dev/input")):
        if not name.startswith("event"):
            continue
        port, ident = usb_port_of(name)
        if port and port not in out:
            try:
                product = open(f"/sys/bus/usb/devices/{port}/product").read().strip()
            except OSError:
                product = ""
            out[port] = (port, ident, product)
    return list(out.values())


def clone_usb_port(box):
    """The one USB port carrying the identity a Medius box says it cloned."""
    with box:
        info = box.device_info()
    want = f"{info.vid:04x}:{info.pid:04x}"
    end = time.time() + 20.0
    while True:
        ports = {p for p, ident in (usb_port_of(n) for n in os.listdir("/dev/input") if n.startswith("event"))
                 if ident == want}
        if ports or time.time() >= end:
            break
        time.sleep(0.25)
    if not ports:
        raise SystemExit(f"no input node for the clone ({want}); is the box's PC port plugged into this machine?")
    if len(ports) > 1:
        raise SystemExit(f"{want} is on {sorted(ports)}: name the clone's port with --usb-port")
    return ports.pop()


def _reenumerate(usb_port):
    auth = f"/sys/bus/usb/devices/{usb_port}/authorized"
    if not os.path.exists(auth):        # nothing on the port: the rule takes whatever enumerates there next
        return
    for v in ("0", "1"):
        with open(auth, "w") as f:
            f.write(v)
        time.sleep(1.0)


def _udev_reload():
    subprocess.run(["udevadm", "control", "--reload"], check=True)


def set_rule(usb_ports, on, native=None):
    """Write (or remove) the rule for `usb_ports`, then enumerate each port again so the rule takes it."""
    if on:
        os.makedirs(os.path.dirname(RULE), exist_ok=True)
        with open(RULE, "w") as f:
            for p in usb_ports:
                f.write(f'SUBSYSTEM=="input", KERNELS=="{p}", ENV{{LIBINPUT_IGNORE_DEVICE}}="1"\n')
            f.write(f"# holder {os.getpid()}\n")
            if native:
                f.write(f"# native-sim {native[0]} {native[1]}\n")
    elif os.path.exists(RULE):
        os.remove(RULE)
    _udev_reload()
    for p in usb_ports:
        _reenumerate(p)


def hold(usb_ports, stop=None):
    """Keep every input node on `usb_ports` open and drained, until `stop` is set (or forever)."""
    held = {}
    scanned = 0.0
    while not (stop and stop.is_set()):
        if time.time() - scanned >= 0.2:
            scanned = time.time()
            for name in os.listdir("/dev/input"):
                node = "/dev/input/" + name
                if not name.startswith("event") or node in held:
                    continue
                real = os.path.realpath(f"/sys/class/input/{name}/device")
                if not any(f"/{p}/" in real for p in usb_ports):
                    continue
                try:
                    held[node] = os.open(node, os.O_RDONLY | os.O_NONBLOCK)
                except OSError:
                    pass
        if not held:
            time.sleep(0.1)
            continue
        try:
            ready, _, _ = select.select(list(held.values()), [], [], 0.2)
        except (OSError, ValueError):
            ready = list(held.values())
        time.sleep(0.02)                # a moving clone wakes this every millisecond; drain in batches
        for node, fd in list(held.items()):
            if fd not in ready and os.path.exists(node):
                continue
            try:
                while os.read(fd, 4096):
                    pass
            except BlockingIOError:
                pass
            except OSError:             # the clone re-enumerated and this node went with it
                os.close(fd)
                del held[node]
    for fd in held.values():
        os.close(fd)


def held_elsewhere(usb_ports):
    """Another live process (a quiet_clone.py left running) holds the rule, and it covers `usb_ports`."""
    try:
        text = open(RULE).read()
    except OSError:
        return False
    m = re.search(r"^# holder (\d+)$", text, re.M)
    if not m or int(m.group(1)) == os.getpid() or not os.path.exists(f"/proc/{m.group(1)}"):
        return False
    return set(usb_ports) <= set(re.findall(r'KERNELS=="([^"]+)"', text))


@contextlib.contextmanager
def quieted(usb_ports, native=None):
    """The clone kept off this desktop for the body; the rule goes when it ends, Ctrl-C included. A rule another live
    holder keeps for these ports is left as it is: removing it would hand that holder's clone back to the desktop."""
    ports = list(usb_ports) + ([native[1]] if native else [])
    if held_elsewhere(ports):
        yield
        return
    stop = threading.Event()
    holder = threading.Thread(target=hold, args=(ports, stop), daemon=True, name="quiet")
    set_rule(ports, True, native)
    holder.start()
    try:
        yield
    finally:
        stop.set()
        main = threading.current_thread() is threading.main_thread()
        old = {s: signal.signal(s, signal.SIG_IGN) for s in (signal.SIGINT, signal.SIGTERM)} if main else {}
        try:
            set_rule(ports, False)      # a second signal must not leave a port deauthorized
        finally:
            for s, h in old.items():
                signal.signal(s, h)
            holder.join(timeout=1.0)
