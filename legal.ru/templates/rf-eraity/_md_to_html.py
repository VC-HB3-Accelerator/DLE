#!/usr/bin/env python3
"""Convert rf-eraity MD → HTML with real <a href>, publish to VDS admin_pages_simple.

Run locally for HTML only, or on VDS host for DB update (see _publish_to_vds.py).
"""
from __future__ import annotations

import html
import re
from pathlib import Path

BASE = Path(__file__).resolve().parent

# Gitea (DLE, public) — канонические MD
GITEA = "https://ru.hb3-accelerator.com/gitea/vc-hb3-accelerator/DLE/src/branch/main"

# CMS published pages
CMS = {
    "cla": "/content/published/dogovor-avtorizovannogo-kontribyutora-dle-avtor-erayti",
    "caa": "/content/published/akt-priyomki-litsenzii-dle-erayti-klient",
    "cca": "/content/published/dogovor-postavki-litsenzii-dle-erayti-klient",
    "ccs": "/content/published/spetsifikatsiya-schet-postavki-litsenzii-dle",
}

# Relative / bare paths → plain names (бланк для печати: без URL)
# Раньше здесь были Gitea-URL; для клиентских бланков оставляем имена документов.
REWRITES: list[tuple[str, str]] = []



def rewrite_urls(md: str) -> str:
    out = md
    for pat, repl in REWRITES:
        out = re.sub(pat, repl, out)
    return out


_MD_LINK = re.compile(r"\[([^\]]+)\]\(([^)]+)\)")


def linkify_escaped(text: str) -> str:
    """After html.escape: restore markdown links as <a>."""

    def repl(m: re.Match) -> str:
        label = html.escape(m.group(1))
        href = m.group(2).strip()
        # unescape was not applied to href from original — use raw from match before escape
        return f'<a href="{html.escape(href, quote=True)}" target="_blank" rel="noopener noreferrer">{label}</a>'

    # Work on original unescaped segment: caller should pass unescaped line and we escape around links
    parts = []
    last = 0
    for m in _MD_LINK.finditer(text):
        parts.append(html.escape(text[last : m.start()]))
        label = html.escape(m.group(1))
        href = html.escape(m.group(2).strip(), quote=True)
        parts.append(
            f'<a href="{href}" target="_blank" rel="noopener noreferrer">{label}</a>'
        )
        last = m.end()
    parts.append(html.escape(text[last:]))
    t = "".join(parts)
    t = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", t)
    t = re.sub(r"`([^`]+)`", r"<code>\1</code>", t)
    return t


def md_to_simple_html(md: str) -> str:
    md = rewrite_urls(md)
    lines = md.splitlines()
    out: list[str] = []
    in_list = False
    in_table = False

    def close_list():
        nonlocal in_list
        if in_list:
            out.append("</ul>")
            in_list = False

    def close_table():
        nonlocal in_table
        if in_table:
            out.append("</tbody></table>")
            in_table = False

    for line in lines:
        if line.startswith("|") and line.endswith("|"):
            # skip separator |---|
            if re.match(r"^\|[\s\-:|]+\|$", line):
                continue
            cells = [c.strip() for c in line.strip("|").split("|")]
            close_list()
            if not in_table:
                out.append('<table border="1" cellpadding="6" cellspacing="0">')
                out.append("<thead><tr>")
                for c in cells:
                    out.append(f"<th>{linkify_escaped(c)}</th>")
                out.append("</tr></thead><tbody>")
                in_table = True
                # first row as header already; next data rows in tbody
                # Actually we used first as header - OK for our docs
                continue
            out.append("<tr>")
            for c in cells:
                out.append(f"<td>{linkify_escaped(c)}</td>")
            out.append("</tr>")
            continue

        close_table()

        if line.startswith("# "):
            close_list()
            out.append(f"<h1>{linkify_escaped(line[2:])}</h1>")
        elif line.startswith("## "):
            close_list()
            out.append(f"<h2>{linkify_escaped(line[3:])}</h2>")
        elif line.startswith("### "):
            close_list()
            out.append(f"<h3>{linkify_escaped(line[4:])}</h3>")
        elif line.startswith("- "):
            if not in_list:
                out.append("<ul>")
                in_list = True
            out.append(f"<li>{linkify_escaped(line[2:])}</li>")
        elif line.strip() == "---":
            close_list()
            out.append("<hr/>")
        elif line.strip() == "":
            close_list()
            out.append("<br/>")
        else:
            close_list()
            out.append(f"<p>{linkify_escaped(line)}</p>")

    close_list()
    close_table()
    return "\n".join(out)


def main():
    for name in [
        "author-contributor-agreement.md",
        "contributor-client-acceptance-act.md",
        "contributor-client-agreement.md",
        "contributor-client-specification.md",
    ]:
        md = (BASE / name).read_text(encoding="utf-8")
        html_out = md_to_simple_html(md)
        outp = BASE / name.replace(".md", ".html")
        outp.write_text(html_out, encoding="utf-8")
        n_links = html_out.count("<a href=")
        print(f"{name} -> {outp.name} bytes={len(html_out.encode())} links={n_links}")


if __name__ == "__main__":
    main()
