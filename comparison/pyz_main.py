"""The single-file download's entry: unpack once into ~/.cache/medius-compare, then run compare.py's command line
from there (the suite and its tests are read as files)."""
import hashlib
import os
import sys
import zipfile

here = os.path.dirname(os.path.abspath(__file__))
with open(here, "rb") as f:
    digest = hashlib.sha256(f.read()).hexdigest()[:16]
dest = os.path.join(os.path.expanduser("~/.cache/medius-compare"), digest)
if not os.path.isdir(dest):
    tmp = f"{dest}.{os.getpid()}"
    zipfile.ZipFile(here).extractall(tmp)
    os.replace(tmp, dest)
sys.path.insert(0, dest)
from medius_compare.cli import main  # noqa: E402

sys.exit(main("no-sim"))
