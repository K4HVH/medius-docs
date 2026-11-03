"""Keep what a test injects off this desktop.

    from medius_bench import clone_guard; clone_guard.engage()

Exits unless `comparison/quiet_clone.py` is running with its rule naming the clone's USB port. Then holds an
exclusive grab (EVIOCGRAB) on every input node on that port for the life of the process, taking each new
node as the clone re-enumerates. When the process opens a node, the grab is handed to that fd, and comes
back when it is closed or ungrabbed. So a test reads its nodes as usual, and nothing injected reaches
anything else. If the clone turns up on another USB port, one the desktop still reads, the process stops
at once.
"""
import builtins
import fcntl
import io
import os
import re
import subprocess
import sys
import threading
import time

from . import QUIET_RULE as RULE

EVIOCGRAB = 0x40044590
SCAN_S = 0.005

_lock = threading.RLock()
_port = None
_covered = []       # every port the rule names; _port is the first
_guard = {}         # node -> the guard's fd
_holder = {}        # node -> the fd holding the grab (the guard's, or one the process opened)
_real_ioctl = fcntl.ioctl
_real_os_open = os.open
_real_open = builtins.open
_usb_start = None


def _die(msg):
    sys.stderr.write(f"clone_guard: {msg}\n")
    sys.stderr.flush()
    os._exit(3)


def _rule_ports():
    try:
        text = _real_open(RULE).read()
    except OSError:
        return []
    return re.findall(r'KERNELS=="([^"]+)"', text)


def _quiet_running():
    r = subprocess.run(["pgrep", "-f", "quiet_clone.py"], capture_output=True, text=True)
    return bool(r.stdout.strip())


def _on_port(name):
    try:
        real = os.path.realpath(f"/sys/class/input/{name}/device")
    except OSError:
        return False
    return any(f"/{p}/" in real or real.endswith(f"/{p}") or f"/{p}:" in real for p in _covered)


def _node_of(fd):
    if hasattr(fd, "fileno"):
        fd = fd.fileno()
    try:
        return os.readlink(f"/proc/self/fd/{fd}"), fd
    except OSError:
        return None, fd


def _grab(fd, on):
    _real_ioctl(fd, EVIOCGRAB, 1 if on else 0)


def _take_back(node):
    """The guard's fd holds the grab again. Caller holds _lock."""
    gfd = _guard.get(node)
    if gfd is None:
        return
    try:
        _grab(gfd, True)
        _holder[node] = gfd
    except OSError:
        pass


def _hand_to(node, fd):
    """Move the grab on `node` from the guard to `fd`. Caller holds _lock."""
    if _holder.get(node) == fd:
        return
    gfd = _guard.get(node)
    if _holder.get(node) == gfd and gfd is not None:
        try:
            _grab(gfd, False)
        except OSError:
            pass
    try:
        _grab(fd, True)
        _holder[node] = fd
    except OSError:
        _take_back(node)


def _usb_devices():
    out = {}
    for d in os.listdir("/sys/bus/usb/devices"):
        if ":" in d or not os.path.exists(f"/sys/bus/usb/devices/{d}/idVendor"):
            continue
        out[d] = _real_open(f"/sys/bus/usb/devices/{d}/idVendor").read().strip()
    return out


def _scan():
    names = [n for n in os.listdir("/dev/input") if n.startswith("event")]
    with _lock:
        live = set()
        for name in names:
            if not _on_port(name):
                continue
            node = "/dev/input/" + name
            live.add(node)
            if node not in _guard:
                try:
                    _guard[node] = _real_os_open(node, os.O_RDONLY | os.O_NONBLOCK)
                except OSError:
                    continue
                _take_back(node)
                continue
            holder = _holder.get(node)
            if holder is not None and holder != _guard[node]:
                cur, _ = _node_of(holder)
                if cur != node:                      # the fd the process held it on is closed
                    _take_back(node)
            elif holder is None:
                _take_back(node)
            try:
                while os.read(_guard[node], 4096):
                    pass
            except OSError:
                pass
        for node in list(_guard):
            if node not in live:
                try:
                    os.close(_guard[node])
                except OSError:
                    pass
                _guard.pop(node, None)
                _holder.pop(node, None)
    # A device new since the start, with input nodes on a port the rule does not name, is the clone where
    # the desktop reads it.
    now = _usb_devices()
    for d, vendor in now.items():
        if d in _usb_start or any(d == p or d.startswith(p + ".") for p in _covered):
            continue
        if any(os.path.realpath(f"/sys/class/input/{n}/device").find(f"/{d}/") >= 0 for n in names):
            _die(f"a new input device appeared on USB port {d}, not {_port} that quiet_clone covers; "
                 "the clone may have moved: stopping")


def _loop():
    while True:
        try:
            _scan()
        except SystemExit:
            raise
        except Exception:
            pass
        time.sleep(SCAN_S)


def _patched_ioctl(fd, req, arg=0, *rest):
    if req == EVIOCGRAB:
        node, n = _node_of(fd)
        with _lock:
            if node in _guard:
                if arg:
                    _hand_to(node, n)
                    return 0
                # Released for real (EINVAL when this fd never held it), then taken straight back.
                try:
                    _grab(n, False)
                except OSError:
                    pass
                _take_back(node)
                return 0
    return _real_ioctl(fd, req, arg, *rest)


def _after_open(path, fd):
    try:
        node = os.path.realpath(path) if isinstance(path, (str, bytes)) else None
    except Exception:
        return
    if isinstance(node, bytes):
        node = node.decode()
    if not node or not node.startswith("/dev/input/event"):
        return
    with _lock:
        if node in _guard:
            _hand_to(node, fd)


def _patched_os_open(path, flags, *a, **k):
    fd = _real_os_open(path, flags, *a, **k)
    _after_open(path, fd)
    return fd


def _patched_open(file, *a, **k):
    f = _real_open(file, *a, **k)
    if isinstance(file, (str, bytes)):
        _after_open(file, f.fileno())
    return f


def engage():
    """Check quiet_clone and start holding the clone's input nodes. Exits if the desktop is not covered."""
    global _port, _covered, _usb_start
    if _port is not None:
        return _port
    if os.geteuid() != 0:
        _die("run as root: the clone's input nodes have to be grabbed")
    ports = _rule_ports()
    if not _quiet_running() or not ports:
        _die("quiet_clone.py is not running (or its udev rule is gone): start it before injecting")
    _port, _covered = ports[0], ports
    port = _port
    _usb_start = _usb_devices()
    # A clone that is re-enumerating is briefly on no port at all.
    end = time.monotonic() + 10.0
    while not os.path.exists(f"/sys/bus/usb/devices/{port}"):
        if time.monotonic() > end:
            _die(f"nothing on USB port {port}, which quiet_clone covers: the clone has moved")
        time.sleep(0.05)
    fcntl.ioctl = _patched_ioctl
    os.open = _patched_os_open
    builtins.open = _patched_open
    io.open = _patched_open
    _scan()
    threading.Thread(target=_loop, daemon=True, name="clone_guard").start()
    return _port


def held():
    """The nodes currently grabbed, for a test to assert on."""
    with _lock:
        return {n: (_holder.get(n) is not None) for n in _guard}
