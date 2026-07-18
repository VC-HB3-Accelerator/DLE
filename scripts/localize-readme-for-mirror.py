#!/usr/bin/env python3
"""Rewrite DLE README*.md from GitHub-canonical URLs to a single Gitea mirror.

Canonical source in git always uses GitHub links. Before push to a Gitea
mirror, run this script so that mirror shows only its own install/release URLs.

Usage:
  python3 scripts/localize-readme-for-mirror.py \\
    --gitea-origin https://hb3-accelerator.com/gitea \\
    README.md README.ru.md
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

GH_DLE = "https://github.com/VC-HB3-Accelerator/DLE"
GH_RAW_SETUP = "https://raw.githubusercontent.com/VC-HB3-Accelerator/DLE/main/setup.sh"
GH_DOCS_BLOB = "https://github.com/VC-HB3-Accelerator/Docs/blob/main"

INSTALL_RE = re.compile(
    r"```bash\n"
    r"curl -fsSL https://raw\.githubusercontent\.com/VC-HB3-Accelerator/DLE/main/setup\.sh \\\n"
    r"  \| bash -s -- --base-url=https://github\.com/VC-HB3-Accelerator/DLE\n"
    r"```",
    re.MULTILINE,
)


def gitea_install_block(dle_web: str) -> str:
    return (
        "```bash\n"
        f"BASE={dle_web}\n"
        'curl -fsSL "$BASE/raw/branch/main/setup.sh" | bash -s -- --base-url="$BASE"\n'
        "```"
    )


def localize(text: str, gitea_origin: str) -> str:
    origin = gitea_origin.rstrip("/")
    dle_web = f"{origin}/VC-HB3-Accelerator/DLE"
    docs_src = f"{origin}/VC-HB3-Accelerator/Docs/src/branch/main"

    if not INSTALL_RE.search(text):
        raise SystemExit("install block (GitHub canonical) not found — abort")

    text = INSTALL_RE.sub(gitea_install_block(dle_web), text, count=1)
    text = text.replace(GH_RAW_SETUP, f"{dle_web}/raw/branch/main/setup.sh")
    text = text.replace(f"{GH_DLE}/releases/", f"{dle_web}/releases/")
    text = text.replace(GH_DLE, dle_web)
    # Docs FAQ: GitHub blob → Gitea src
    text = text.replace(f"{GH_DOCS_BLOB}/", f"{docs_src}/")
    return text


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--gitea-origin", required=True, help="e.g. https://host/gitea")
    p.add_argument("files", nargs="+", type=Path)
    args = p.parse_args()

    for path in args.files:
        original = path.read_text(encoding="utf-8")
        updated = localize(original, args.gitea_origin)
        path.write_text(updated, encoding="utf-8")
        print(f"localized {path} → {args.gitea_origin.rstrip('/')}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
