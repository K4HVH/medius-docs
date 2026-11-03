"""Switching a box's power off and on through a hub that switches each port's power (uhubctl, as root)."""
import subprocess
import time

OFF_S = 3.0


class PowerCycleFailed(RuntimeError):
    """The hub would not switch the ports."""


def _switch(hub, ports, action):
    r = subprocess.run(["uhubctl", "-l", hub, "-p", ports, "-a", action], capture_output=True, text=True)
    if r.returncode:
        detail = (r.stderr or r.stdout).strip().splitlines()
        raise PowerCycleFailed(f"uhubctl could not switch hub {hub} port(s) {ports} {action}"
                               + (f": {detail[0]}" if detail else ""))


def cycle(hub: str, ports: list, off_s: float = None):
    """Every port in `ports` off, then on after `off_s` seconds. A failed switch-on is tried twice more: a
    port left off leaves the box dark."""
    p = ",".join(str(n) for n in ports)
    _switch(hub, p, "off")
    time.sleep(OFF_S if off_s is None else off_s)
    for attempt in range(3):
        try:
            _switch(hub, p, "on")
            return
        except PowerCycleFailed:
            if attempt == 2:
                raise
            time.sleep(1.0)
