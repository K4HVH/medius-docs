import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

try:
    import tomllib
    from medius_compare.bench import default_config
    _lib = tomllib.loads(default_config().read_text()).get("sim_library")
    if _lib:
        os.environ.setdefault("SIM_LIBRARY", _lib)
except (OSError, ValueError):
    pass
