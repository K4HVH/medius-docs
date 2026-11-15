#!/usr/bin/env python3
"""Measure a MAKCU box, stock or Medius, on your own still mouse or keyboard, and write a run file (Linux, root)."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from medius_compare.cli import main  # noqa: E402

if __name__ == "__main__":
    sys.exit(main("no-sim"))
