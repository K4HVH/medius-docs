#!/usr/bin/env python3
"""Keep the clone off this desktop while tests run against it.

  sudo python3 comparison/quiet_clone.py [box port or id] [--usb-port 3-1.1 ...] [--native SIM_SERIAL@3-1.2]

Tests grab the clone's input nodes only inside a capture, so between captures a device that moves drags
this desktop's cursor. This tool makes libinput ignore whatever enumerates on the clone's USB port,
via a runtime udev rule gone at reboot or exit. It also keeps every input node on that port open: usbhid
polls an interrupt-IN endpoint only while its node is open, so with the desktop ignoring the clone, the wire
would otherwise go quiet. Tests read and grab the nodes as before.

Leave it running for the session, in a separate terminal or detached with
`sudo setsid nohup python3 comparison/quiet_clone.py ... &`. Ctrl-C or SIGTERM removes the rule and returns the
clone to the desktop. The USB port is found from the identity the box says it cloned; if that identity is
on more than one port here (the real device plugged into this PC too), or the box is not running Medius,
name the clone's port. `--usb-port` repeats, for two boxes' clones on this machine at once; tests guard the
first.

`--native` names the native sim (a USB device emulator) plugged straight into this PC, which tests read as the real
device (`medius_bench.native_sim()`). Its port gets the clone's treatment, so the PC polls both the same way.
"""
import os, re, select, signal, subprocess, sys, time

import medius

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from medius_bench import QUIET_RULE as RULE  # noqa: E402


def usb_port_of(name):
    """The USB port an input node sits on (3-1.1), and the vid:pid of the device there."""
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


def clone_usb_port(box):
    """The one USB port carrying the identity the box says it cloned."""
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
        sys.exit(f"no input node for the clone ({want}); is the box's PC port plugged into this machine?")
    if len(ports) > 1:
        sys.exit(f"{want} is on {sorted(ports)}: name the clone's port with --usb-port")
    return ports.pop()


def reenumerate(usb_port):
    auth = f"/sys/bus/usb/devices/{usb_port}/authorized"
    if not os.path.exists(auth):        # nothing on the port: the rule takes whatever enumerates there next
        return
    for v in ("0", "1"):
        with open(auth, "w") as f:
            f.write(v)
        time.sleep(1.0)


def set_rule(usb_ports, on, native=None):
    if on:
        os.makedirs(os.path.dirname(RULE), exist_ok=True)
        with open(RULE, "w") as f:
            for p in usb_ports:
                f.write(f'SUBSYSTEM=="input", KERNELS=="{p}", ENV{{LIBINPUT_IGNORE_DEVICE}}="1"\n')
            if native:
                f.write(f"# native-sim {native[0]} {native[1]}\n")
    elif os.path.exists(RULE):
        os.remove(RULE)
    subprocess.run(["udevadm", "control", "--reload"], check=True)
    for p in usb_ports:
        reenumerate(p)


def hold(usb_ports):
    held = {}
    scanned = 0.0
    while True:
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


def main():
    if os.geteuid() != 0:
        sys.exit("run as root: it writes a udev rule and opens input nodes")
    args = sys.argv[1:]
    usb_ports = []
    while "--usb-port" in args:
        i = args.index("--usb-port")
        usb_ports.append(args[i + 1])
        del args[i:i + 2]
    native = None
    if "--native" in args:
        i = args.index("--native")
        serial, _, nport = args[i + 1].partition("@")
        if not serial or not nport:
            sys.exit("--native SIM_SERIAL@USB_PORT")
        native = (serial, nport)
        del args[i:i + 2]
    if not usb_ports:
        if args and ("/" in args[0]):
            box = medius.Device.open(args[0])
        elif args:
            box = medius.Device.open_by_id(args[0])
        else:
            boxes = medius.list_boxes()
            if len(boxes) != 1:
                sys.exit(f"{len(boxes)} boxes answered; name one by port, MAC or CH343 serial")
            box = medius.Device.open(boxes[0].port.path)
        usb_ports = [clone_usb_port(box)]
    # A hang-up ends it cleanly, unless it was started to outlive its terminal (nohup, setsid), where
    # the hang-up arrives ignored and stays that way.
    signal.signal(signal.SIGTERM, lambda *_: sys.exit(0))
    if signal.getsignal(signal.SIGHUP) != signal.SIG_IGN:
        signal.signal(signal.SIGHUP, lambda *_: sys.exit(0))
    try:
        ports = usb_ports + ([native[1]] if native else [])
        set_rule(ports, True, native)
        print(f"the desktop ignores USB port {', '.join(ports)}; Ctrl-C to hand the clone back", flush=True)
        hold(ports)
    except KeyboardInterrupt:
        pass
    finally:
        for sig in (signal.SIGINT, signal.SIGTERM, signal.SIGHUP):
            signal.signal(sig, signal.SIG_IGN)      # a second signal must not leave the port deauthorized
        set_rule(usb_ports + ([native[1]] if native else []), False)


if __name__ == "__main__":
    main()
