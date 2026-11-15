#!/usr/bin/env python3
"""Keep the clone off this desktop while tests run against it; leave it running for the session."""
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
    # Under nohup or setsid SIGHUP arrives ignored, and must stay ignored.
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
            signal.signal(sig, signal.SIG_IGN)
        set_rule(usb_ports + ([native[1]] if native else []), False)


if __name__ == "__main__":
    main()
