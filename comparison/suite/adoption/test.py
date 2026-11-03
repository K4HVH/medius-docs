"""How many people use each box's packages and community, from the registries' and Discord's public figures.

Read when the run happens, from their public APIs: PyPI downloads in the last 30 days (pypistats.org), crates.io
downloads in the last 90 days, and the members of each project's Discord server (its invite's approximate member
count). Stock's figures sum three packages on each registry, Medius's are its one package; KMBox packages are left
out. Each run returns the totals of the box it runs for, with each package's own figure beside them.
"""
import json
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone

from medius_compare import TOOL_VERSION

SOURCES = {
    "stock": {"pypi": ("makcu", "pymakcu", "makxd"), "crates": ("makcu", "makcu-rs", "makxd"), "discord": "wjyTaqCbHm"},
    "medius": {"pypi": ("medius",), "crates": ("medius",), "discord": "ArRqcA84pB"},
}
AGENT = f"medius-compare/{TOOL_VERSION}"
TRIES = 4


def _get(url):
    req = urllib.request.Request(url, headers={"User-Agent": AGENT, "Accept": "application/json"})
    for attempt in range(TRIES):
        try:
            with urllib.request.urlopen(req, timeout=20) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            if e.code != 429 and e.code < 500 or attempt == TRIES - 1:
                raise
        except urllib.error.URLError:
            if attempt == TRIES - 1:
                raise
        time.sleep(2 ** (attempt + 1))


def run(ctx):
    src = SOURCES[ctx.box_name]
    pypi = {n: _get(f"https://pypistats.org/api/packages/{n}/recent")["data"]["last_month"] for n in src["pypi"]}
    crates = {n: _get(f"https://crates.io/api/v1/crates/{n}")["crate"]["recent_downloads"] for n in src["crates"]}
    invite = _get(f"https://discord.com/api/v10/invites/{src['discord']}?with_counts=true")
    ctx.log(f"PyPI {pypi}, crates.io {crates}, Discord {invite.get('approximate_member_count')} members")
    return {"fetched_utc": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "pypi_last_month": sum(pypi.values()), "crates_recent": sum(crates.values()),
            "discord_members": invite["approximate_member_count"],
            "pypi": pypi, "crates": crates,
            "discord": {"invite": src["discord"], "members": invite["approximate_member_count"],
                        "online": invite.get("approximate_presence_count")}}
