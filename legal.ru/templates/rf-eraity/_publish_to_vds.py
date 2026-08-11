#!/usr/bin/env python3
"""Publish RF-ERAITY HTML drafts into admin_pages_simple on VDS. Run on VDS host."""
import hashlib
import subprocess
from pathlib import Path

ENV_PATH = Path("/home/docker/dapp/.env")
BASE = Path("/tmp/rf-eraity")


def load_env():
    env = {}
    for line in ENV_PATH.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        env[k] = v.strip().strip("\"'")
    return env


def psql(env, sql: str) -> str:
    cmd = [
        "docker",
        "exec",
        "-i",
        "-e",
        f"PGPASSWORD={env['DB_PASSWORD']}",
        "dapp-postgres",
        "psql",
        "-U",
        env["DB_USER"],
        "-d",
        env["DB_NAME"],
        "-v",
        "ON_ERROR_STOP=1",
    ]
    r = subprocess.run(cmd, input=sql.encode("utf-8"), capture_output=True)
    if r.returncode != 0:
        raise SystemExit("SQL ERROR:\n" + r.stderr.decode()[:4000])
    return r.stdout.decode()


def psql_scalar(env, sql: str) -> str:
    cmd = [
        "docker",
        "exec",
        "-e",
        f"PGPASSWORD={env['DB_PASSWORD']}",
        "dapp-postgres",
        "psql",
        "-U",
        env["DB_USER"],
        "-d",
        env["DB_NAME"],
        "-t",
        "-A",
        "-c",
        sql,
    ]
    return subprocess.check_output(cmd).decode().strip()


def main():
    env = load_env()
    docs = [
        {
            "mode": "update",
            "id": 36,
            "title": "Лицензионное соглашение авторизованного контрибьютора (Автор ↔ ООО «ЭРАЙТИ»)",
            "summary": "Заполненный CONTRIBUTOR_LICENSE.md для ООО «ЭРАЙТИ» (РФ). ЯДРО не изменено.",
            "file": "author-contributor-agreement.html",
            "slug": "dogovor-avtorizovannogo-kontribyutora-dle-avtor-erayti",
        },
        {
            "mode": "update",
            "id": 34,
            "title": "Акт приёмки лицензии DLE (ООО «ЭРАЙТИ» ↔ Клиент)",
            "summary": "Заполненный шаблон CAA-DLE-2026-07-16 для ООО «ЭРАЙТИ».",
            "file": "contributor-client-acceptance-act.html",
            "slug": "akt-priyomki-litsenzii-dle-erayti-klient",
        },
        {
            "mode": "insert",
            "title": "Договор поставки лицензии DLE (ООО «ЭРАЙТИ» ↔ Клиент)",
            "summary": "Заполненный шаблон CCA-DLE-2026-07-16 для ООО «ЭРАЙТИ».",
            "file": "contributor-client-agreement.html",
            "slug": "dogovor-postavki-litsenzii-dle-erayti-klient",
            "order": 10,
        },
        {
            "mode": "insert",
            "title": "Спецификация / счёт к договору поставки лицензии DLE",
            "summary": "Заполненный шаблон CCS-DLE-2026-07-16 для ООО «ЭРАЙТИ».",
            "file": "contributor-client-specification.html",
            "slug": "spetsifikatsiya-schet-postavki-litsenzii-dle",
            "order": 11,
        },
    ]

    existing = set(
        psql_scalar(
            env,
            "SELECT slug FROM admin_pages_simple WHERE slug IN ("
            "'dogovor-postavki-litsenzii-dle-erayti-klient',"
            "'spetsifikatsiya-schet-postavki-litsenzii-dle',"
            "'akt-priyomki-litsenzii-dle-erayti-klient',"
            "'dogovor-avtorizovannogo-kontribyutora-dle-avtor-erayti'"
            ");",
        ).splitlines()
    )
    print("existing slugs:", existing)

    parts = ["BEGIN;"]
    tag = "htmlbody"
    for d in docs:
        content = (BASE / d["file"]).read_text(encoding="utf-8")
        if f"${tag}$" in content:
            raise SystemExit(f"dollar-tag collision in {d['file']}")
        checksum = hashlib.sha256(content.encode()).hexdigest()
        size = len(content.encode())
        title = d["title"].replace("'", "''")
        summary = d["summary"].replace("'", "''")
        slug = d["slug"]
        body = content
        if d["mode"] == "update":
            parts.append(
                f"""
UPDATE admin_pages_simple SET
  title = '{title}',
  summary = '{summary}',
  content = ${tag}${body}${tag}$,
  format = 'html',
  mime_type = 'text/html',
  size_bytes = {size},
  checksum = '{checksum}',
  slug = '{slug}',
  category = 'договор и акты',
  status = 'published',
  visibility = 'public',
  updated_at = now()
WHERE id = {d['id']};
"""
            )
        elif slug in existing:
            parts.append(
                f"""
UPDATE admin_pages_simple SET
  title = '{title}',
  summary = '{summary}',
  content = ${tag}${body}${tag}$,
  format = 'html',
  mime_type = 'text/html',
  size_bytes = {size},
  checksum = '{checksum}',
  category = 'договор и акты',
  status = 'published',
  visibility = 'public',
  updated_at = now()
WHERE slug = '{slug}';
"""
            )
        else:
            parts.append(
                f"""
INSERT INTO admin_pages_simple (
  title, summary, content, format, mime_type, size_bytes, checksum,
  category, status, visibility, slug, order_index, storage_type, updated_at
) VALUES (
  '{title}',
  '{summary}',
  ${tag}${body}${tag}$,
  'html', 'text/html', {size}, '{checksum}',
  'договор и акты', 'published', 'public', '{slug}', {d.get('order', 0)}, 'db', now()
);
"""
            )

    parts.append("COMMIT;")
    parts.append(
        "SELECT id, title, slug, size_bytes, LEFT(checksum,12) AS chk "
        "FROM admin_pages_simple WHERE category = 'договор и акты' ORDER BY id;"
    )
    print(psql(env, "\n".join(parts)))
    print("OK")


if __name__ == "__main__":
    main()
