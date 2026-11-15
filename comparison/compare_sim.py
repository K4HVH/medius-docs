#!/usr/bin/env python3
"""The bench's entry point: every test, with the sim playing each device, on both boxes and the native sim."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from medius_compare.cli import main  # noqa: E402

if __name__ == "__main__":
    sys.exit(main("sim"))
