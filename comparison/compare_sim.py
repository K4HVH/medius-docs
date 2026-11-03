#!/usr/bin/env python3
"""The bench's entry point: every test, with a USB device emulator (the sim) playing each device, on both
boxes and on the native sim. The comparison's published numbers come from this script.

  sudo python3 comparison/compare_sim.py run [--test ID] [--category CAT] [--box stock|medius|native]

Needs the sim's library checked out beside this repo, and a local bench config. Nobody outside
the bench can run it; it is published so the method behind the numbers can be read.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from medius_compare.cli import main  # noqa: E402

if __name__ == "__main__":
    sys.exit(main("sim"))
