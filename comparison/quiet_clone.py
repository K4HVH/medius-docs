#!/usr/bin/env python3
"""Keep the clone off this desktop while tests run against it.

  sudo python3 comparison/quiet_clone.py [box port or id] [--usb-port 1-4 ...] [--native SIM_SERIAL@1-5]

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
import os, signal, sys

import medius

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from medius_bench.quiet import clone_usb_port, hold, set_rule  # noqa: E402


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
