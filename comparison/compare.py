#!/usr/bin/env python3
"""Measure a MAKCU box, stock firmware or Medius, on your own still mouse or keyboard, the way the
comparison on medius.k4tech.net does, and write what it measured to a run file.

  sudo python3 compare.py run --box medius --port /dev/ttyACM0
  sudo python3 compare.py run --box stock --port /dev/ttyACM1 --test wire-rtt
  python3 compare.py report runs/stock/<stamp>.json runs/medius/<stamp>.json

Linux only, as root, with `pip install medius pyserial`. Tests that need a device emulator are skipped.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from medius_compare.cli import main  # noqa: E402

if __name__ == "__main__":
    sys.exit(main("no-sim"))
