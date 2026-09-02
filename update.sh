#!/usr/bin/env bash
# Copyright (c) 2024-2026 Тарабанов Александр Викторович
# All rights reserved.
#
# Применение update-pack на клиентском VDS (этап 3 ТЗ).
# НЕ трогает: volumes данных, .env, ssl/keys, клиентский encryption key.
#
# Примеры:
#   ./update.sh --pack=/path/to/dle-update-v1.0.4.tar.gz
#   ./update.sh --pack=./update-packs/dle-update-v1.0.4.tar.gz --app-dir=/home/docker/dapp
#   ./update.sh --api=https://hb3-accelerator.com --dle-contract=0x...   # через API (authorize)
#
# Опции:
#   --pack=PATH          локальный/скачанный pack (без API)
#   --api=URL            база API автора
#   --dle-contract=0x    контракт DLE клиента (для authorize)
#   --app-dir=PATH       корень приложения (по умолчанию автодетект)
#   --compose=FILE       compose-файл (default: docker-compose.prod.yml)
#   --skip-backup        не делать pg_dump (не рекомендуется)
#   --skip-prerender     не запускать pre-render
#   --keep-pack          не удалять pack после успеха
#   --dry-run            только проверки версии / манифест

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_info() { echo -e "${BLUE}ℹ️  $1${NC}"; }
print_success() { echo -e "${GREEN}✅ $1${NC}"; }
print_warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }
print_error() { echo -e "${RED}❌ $1${NC}"; }

PACK=""
API_BASE=""
DLE_CONTRACT=""
APP_DIR=""
COMPOSE_FILE="docker-compose.prod.yml"
SKIP_BACKUP=0
SKIP_PRERENDER=0
DRY_RUN=0
KEEP_PACK=0
WORK=""

usage() {
  sed -n '2,28p' "$0" | sed 's/^# \{0,1\}//'
  exit "${1:-0}"
}

while [ $# -gt 0 ]; do
  case "$1" in
    --pack=*) PACK="${1#--pack=}"; shift ;;
    --pack) PACK="${2:-}"; shift 2 ;;
    --api=*) API_BASE="${1#--api=}"; shift ;;
    --api) API_BASE="${2:-}"; shift 2 ;;
    --dle-contract=*) DLE_CONTRACT="${1#--dle-contract=}"; shift ;;
    --dle-contract) DLE_CONTRACT="${2:-}"; shift 2 ;;
    --app-dir=*) APP_DIR="${1#--app-dir=}"; shift ;;
    --app-dir) APP_DIR="${2:-}"; shift 2 ;;
    --compose=*) COMPOSE_FILE="${1#--compose=}"; shift ;;
    --skip-backup) SKIP_BACKUP=1; shift ;;
    --skip-prerender) SKIP_PRERENDER=1; shift ;;
    --keep-pack) KEEP_PACK=1; shift ;;
    --dry-run) DRY_RUN=1; shift ;;
    -h|--help) usage 0 ;;
    *) print_error "Неизвестный аргумент: $1"; usage 1 ;;
  esac
done

detect_app_dir() {
  if [ -n "$APP_DIR" ]; then
    echo "$APP_DIR"
    return
  fi
  for candidate in \
    "$(pwd)" \
    "/home/docker/dapp" \
    "/home/ubuntu/dapp" \
    "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." 2>/dev/null && pwd)"; do
    if [ -f "$candidate/$COMPOSE_FILE" ] || [ -f "$candidate/docker-compose.yml" ]; then
      if [ -f "$candidate/.env" ] || [ -f "$candidate/$COMPOSE_FILE" ]; then
        echo "$candidate"
        return
      fi
    fi
  done
  print_error "Не найден корень приложения (compose + .env). Укажите --app-dir="
  exit 1
}

version_ge() {
  # semver-ish: strip leading v, compare via sort -V
  local a="${1#v}"
  local b="${2#v}"
  [ "$(printf '%s\n%s\n' "$a" "$b" | sort -V | tail -n1)" = "$a" ]
}

version_lt() {
  local a="${1#v}"
  local b="${2#v}"
  [ "$a" != "$b" ] && ! version_ge "$a" "$b"
}

# apply-here идёт из контейнера backend: там есть node, python3 часто нет.
json_field() {
  local file="$1"
  local spec="$2"
  if command -v node >/dev/null 2>&1; then
    node -e '
      const fs = require("fs");
      const m = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
      let v = m;
      for (const k of process.argv[2].split(".")) {
        v = v == null ? undefined : v[k];
      }
      if (Array.isArray(v)) process.stdout.write(v.join(" "));
      else process.stdout.write(v == null || v === undefined ? "" : String(v));
    ' "$file" "$spec"
  elif command -v python3 >/dev/null 2>&1; then
    python3 -c '
import json, sys
m = json.load(open(sys.argv[1], encoding="utf-8"))
v = m
for k in sys.argv[2].split("."):
    v = None if v is None else (v.get(k) if isinstance(v, dict) else None)
if isinstance(v, list):
    sys.stdout.write(" ".join(str(x) for x in v))
elif v is None:
    sys.stdout.write("")
else:
    sys.stdout.write(str(v))
' "$file" "$spec"
  else
    print_error "Нужен node или python3, чтобы прочитать manifest.json"
    exit 1
  fi
}

json_stdin_field() {
  local spec="$1"
  if command -v node >/dev/null 2>&1; then
    node -e '
      let s = "";
      process.stdin.on("data", (d) => { s += d; });
      process.stdin.on("end", () => {
        let v = JSON.parse(s || "{}");
        for (const k of process.argv[1].split(".")) {
          v = v == null ? undefined : v[k];
        }
        process.stdout.write(v == null || v === undefined ? "" : String(v));
      });
    ' "$spec"
  elif command -v python3 >/dev/null 2>&1; then
    python3 -c '
import json, sys
j = json.load(sys.stdin)
v = j
for k in sys.argv[1].split("."):
    v = None if v is None else (v.get(k) if isinstance(v, dict) else None)
sys.stdout.write("" if v is None else str(v))
' "$spec"
  else
    print_error "Нужен node или python3"
    exit 1
  fi
}

json_pretty() {
  local file="$1"
  if command -v node >/dev/null 2>&1; then
    node -e 'console.log(JSON.stringify(JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")), null, 2))' "$file"
  elif command -v python3 >/dev/null 2>&1; then
    python3 -m json.tool "$file"
  else
    cat "$file"
  fi
}

# Имя стека и каталог на ХОСТЕ (не basename /host-project из контейнера backend).
detect_compose_project() {
  if [ -n "${COMPOSE_PROJECT_NAME:-}" ]; then
    echo "$COMPOSE_PROJECT_NAME"
    return
  fi
  local p
  p="$(docker inspect -f '{{index .Config.Labels "com.docker.compose.project"}}' dapp-backend 2>/dev/null || true)"
  if [ -n "$p" ]; then
    echo "$p"
    return
  fi
  if [ "$(basename "$APP_DIR")" = "host-project" ]; then
    echo "dapp"
    return
  fi
  basename "$APP_DIR" | tr '[:upper:]' '[:lower:]' | tr -cd 'a-z0-9_-'
}

detect_host_app_dir() {
  if [ -n "${DLE_HOST_APP_DIR:-}" ]; then
    echo "$DLE_HOST_APP_DIR"
    return
  fi
  local src
  src="$(docker inspect -f '{{range .Mounts}}{{if eq .Destination "/host-project"}}{{.Source}}{{end}}{{end}}' "$(hostname)" 2>/dev/null || true)"
  if [ -z "$src" ]; then
    src="$(docker inspect -f '{{index .Config.Labels "com.docker.compose.project.working_dir"}}' dapp-backend 2>/dev/null || true)"
  fi
  if [ -n "$src" ]; then
    echo "$src"
    return
  fi
  echo "$APP_DIR"
}

detect_compose_runner_image() {
  if [ -n "${DLE_COMPOSE_RUNNER_IMAGE:-}" ]; then
    echo "$DLE_COMPOSE_RUNNER_IMAGE"
    return
  fi
  local img
  img="$(docker inspect -f '{{.Config.Image}}' dapp-backend 2>/dev/null || true)"
  if [ -n "$img" ]; then
    echo "$img"
    return
  fi
  echo "digital_legal_entitydle-backend:latest"
}

# apply-here: CLI в контейнере, docker.sock — хостовый. -f /host-project даёт project=host-project
# и bind'ы /host-project/... на хосте (каталога нет) + конфликт имён dapp-*.
# Если хостовый путь не виден в этом namespace — compose через sibling с тем же bind.
compose() {
  if [ -d "$HOST_APP_DIR" ]; then
    docker compose \
      --project-name "$COMPOSE_PROJECT" \
      --project-directory "$HOST_APP_DIR" \
      -f "$COMPOSE_FILE" \
      "$@"
    return
  fi
  docker run --rm \
    --entrypoint docker \
    -v /var/run/docker.sock:/var/run/docker.sock \
    -v "${HOST_APP_DIR}:${HOST_APP_DIR}" \
    -w "${HOST_APP_DIR}" \
    -e "COMPOSE_PROJECT_NAME=${COMPOSE_PROJECT}" \
    "$COMPOSE_RUNNER_IMAGE" \
    compose \
      --project-name "$COMPOSE_PROJECT" \
      --project-directory "$HOST_APP_DIR" \
      -f "$COMPOSE_FILE" \
      "$@"
}

APP_DIR="$(detect_app_dir)"
cd "$APP_DIR"
print_info "Корень приложения: $APP_DIR"

if [ ! -f "$COMPOSE_FILE" ]; then
  if [ -f docker-compose.prod.yml ]; then
    COMPOSE_FILE="docker-compose.prod.yml"
  elif [ -f docker-compose.yml ]; then
    COMPOSE_FILE="docker-compose.yml"
  else
    print_error "Compose-файл не найден"
    exit 1
  fi
fi

COMPOSE_PROJECT="$(detect_compose_project)"
HOST_APP_DIR="$(detect_host_app_dir)"
COMPOSE_RUNNER_IMAGE="$(detect_compose_runner_image)"
print_info "Compose project=$COMPOSE_PROJECT host_dir=$HOST_APP_DIR"

CURRENT="0.0.0"
if [ -f DLE_VERSION ]; then
  CURRENT="$(tr -d '[:space:]' < DLE_VERSION)"
fi
print_info "Текущая версия: $CURRENT"

# --- получить pack ---
if [ -z "$PACK" ] && [ -n "$API_BASE" ]; then
  API_BASE="${API_BASE%/}"
  print_info "Authorize через API: $API_BASE"
  if [ -z "$DLE_CONTRACT" ]; then
    print_error "Для --api нужен --dle-contract=0x..."
    exit 1
  fi
  AUTH_JSON="$(curl -fsS -X POST "$API_BASE/api/updates/authorize" \
    -H 'Content-Type: application/json' \
    -d "{\"dleContract\":\"$DLE_CONTRACT\",\"fromVersion\":\"$CURRENT\"}" || true)"
  if [ -z "$AUTH_JSON" ]; then
    print_error "authorize не удался (сеть / 403 / stub)"
    exit 1
  fi
  DOWNLOAD_URL="$(json_stdin_field data.downloadUrl <<<"$AUTH_JSON")"
  if [ -z "$DOWNLOAD_URL" ]; then
    print_error "В ответе authorize нет downloadUrl: $AUTH_JSON"
    exit 1
  fi
  PACK="$APP_DIR/.update-download-$$.tar.gz"
  print_info "Скачивание pack…"
  curl -fL --retry 3 -o "$PACK" "$DOWNLOAD_URL"
elif [ -z "$PACK" ]; then
  print_error "Укажите --pack=... или --api=..."
  usage 1
fi

if [ ! -f "$PACK" ]; then
  print_error "Pack не найден: $PACK"
  exit 1
fi

WORK="$(mktemp -d /tmp/dle-update.XXXXXX)"
cleanup() {
  rm -rf "$WORK"
  case "$PACK" in
    "$APP_DIR"/.update-download-*) rm -f "$PACK" ;;
  esac
}
trap cleanup EXIT

print_info "Распаковка pack…"
tar -xzf "$PACK" -C "$WORK"

if [ ! -f "$WORK/manifest.json" ]; then
  print_error "В pack нет manifest.json"
  exit 1
fi

TARGET="$(json_field "$WORK/manifest.json" version)"
MIN_FROM="$(json_field "$WORK/manifest.json" min_from)"

print_info "Целевая версия: $TARGET (min_from=$MIN_FROM)"

if [ "$CURRENT" = "$TARGET" ]; then
  print_success "Уже на $TARGET — обновление не требуется (идемпотентность)"
  exit 0
fi

if [ -n "$MIN_FROM" ] && version_lt "$CURRENT" "$MIN_FROM"; then
  print_error "Текущая $CURRENT < min_from $MIN_FROM — сначала установите промежуточный релиз"
  exit 1
fi

if version_ge "$CURRENT" "$TARGET" && [ "$CURRENT" != "$TARGET" ]; then
  print_warning "Текущая $CURRENT новее pack $TARGET — отказ"
  exit 1
fi

if [ "$DRY_RUN" -eq 1 ]; then
  print_success "dry-run OK: можно обновлять $CURRENT → $TARGET"
  json_pretty "$WORK/manifest.json" | head -n 40
  exit 0
fi

# --- backup ---
BACKUP_DIR="$APP_DIR/backups/update-${CURRENT}-to-${TARGET}-$(date +%Y%m%d%H%M%S)"
mkdir -p "$BACKUP_DIR"
echo -n "$CURRENT" > "$BACKUP_DIR/DLE_VERSION.before"
if [ -f .env ]; then
  cp .env "$BACKUP_DIR/.env.bak"
fi

if [ "$SKIP_BACKUP" -eq 0 ]; then
  print_info "Бэкап БД (pg_dump)…"
  if compose exec -T postgres pg_isready -U "${DB_USER:-dapp_user}" -d "${DB_NAME:-dapp_db}" >/dev/null 2>&1; then
    # content_media.file_data — огромные bytea; полный dump часто падает (invalid memory alloc).
    # Схему таблицы сохраняем, данные медиа исключаем из update-бэкапа.
    compose exec -T postgres \
      pg_dump -U "${DB_USER:-dapp_user}" "${DB_NAME:-dapp_db}" \
      --exclude-table-data=public.content_media \
      > "$BACKUP_DIR/db.dump.sql" \
      || print_warning "pg_dump не удался — продолжаем с осторожностью"
  else
    print_warning "Postgres не готов — pg_dump пропущен"
  fi
else
  print_warning "Бэкап БД пропущен (--skip-backup)"
fi
print_success "Бэкап: $BACKUP_DIR"

# --- load images ---
print_info "docker load образов из pack…"
shopt -s nullglob
for tarimg in "$WORK"/images/*.tar; do
  print_info "  load $(basename "$tarimg")"
  docker load -i "$tarimg"
done
shopt -u nullglob

# --- pull public ---
print_info "compose pull публичных образов…"
PULL_IMAGES="$(json_field "$WORK/manifest.json" pull_images)"
if [ -n "$PULL_IMAGES" ]; then
  # shellcheck disable=SC2086
  for img in $PULL_IMAGES; do
    print_info "  pull $img"
    docker pull "$img" || print_warning "pull не удался: $img"
  done
else
  print_info "  публичных образов в pack нет — пропуск"
fi

# --- overlay (не трогаем ssl, .env) ---
print_info "Overlay файлов…"
apply_overlay_tar() {
  local archive="$1"
  local dest="$2"
  mkdir -p "$dest"
  # archive содержит top-level dirname (backend/...)
  # DLE_VERSION: compose монтирует ./DLE_VERSION → /app/DLE_VERSION поверх bind
  # ./backend→/app; путь backend/DLE_VERSION занят mountpoint → tar EEXIST.
  # Версию пишем в корень APP_DIR отдельно в конце update.sh.
  tar -xzf "$archive" -C "$(dirname "$dest")" \
    --exclude='DLE_VERSION' \
    --exclude='*/DLE_VERSION' \
    --exclude='backend/DLE_VERSION'
}

if [ -f "$WORK/overlay/backend.tar.gz" ]; then
  apply_overlay_tar "$WORK/overlay/backend.tar.gz" "$APP_DIR/backend"
fi
if [ -f "$WORK/overlay/shared.tar.gz" ]; then
  apply_overlay_tar "$WORK/overlay/shared.tar.gz" "$APP_DIR/shared"
fi
if [ -f "$WORK/overlay/scripts.tar.gz" ]; then
  apply_overlay_tar "$WORK/overlay/scripts.tar.gz" "$APP_DIR/scripts"
fi
if [ -f "$WORK/overlay/docker/blanc-xray.tar.gz" ]; then
  mkdir -p "$APP_DIR/docker"
  apply_overlay_tar "$WORK/overlay/docker/blanc-xray.tar.gz" "$APP_DIR/docker/blanc-xray"
fi
if [ -f "$WORK/overlay/frontend/dist.tar.gz" ]; then
  mkdir -p "$APP_DIR/frontend"
  tar -xzf "$WORK/overlay/frontend/dist.tar.gz" -C "$APP_DIR/frontend"
fi
if [ -f "$WORK/overlay/webssh-agent/docker-compose.prod.yml" ]; then
  cp "$WORK/overlay/webssh-agent/docker-compose.prod.yml" "$APP_DIR/docker-compose.prod.yml"
fi
if [ -f "$WORK/update.sh" ]; then
  cp "$WORK/update.sh" "$APP_DIR/update.sh"
  chmod +x "$APP_DIR/update.sh"
  print_success "update.sh обновлён"
fi

# --- recreate ---
SERVICES="$(json_field "$WORK/manifest.json" recreate_services)"
if [ -z "$SERVICES" ]; then
  print_error "В manifest.json нет recreate_services"
  exit 1
fi
print_info "compose up -d --force-recreate $SERVICES"
# shellcheck disable=SC2086
compose up -d --force-recreate $SERVICES

# --- post steps ---
print_info "yarn install (backend volume)…"
for i in 1 2 3 4 5 6; do
  if compose exec -T backend yarn install --frozen-lockfile; then
    break
  fi
  sleep 5
  if [ "$i" -eq 6 ]; then
    print_warning "yarn install не выполнен"
  fi
done

print_info "Миграции…"
for i in 1 2 3 4 5 6; do
  if compose exec -T backend node scripts/run-migrations.js; then
    break
  fi
  sleep 5
  if [ "$i" -eq 6 ]; then
    print_error "Миграции не прошли — см. $BACKUP_DIR для отката"
    exit 1
  fi
done

if [ "$SKIP_PRERENDER" -eq 0 ]; then
  print_info "SEO pre-render…"
  compose exec -T backend node scripts/pre-render-blog.js \
    || print_warning "pre-render пропущен"
fi

# --- health ---
print_info "Healthcheck backend…"
ok=0
for i in 1 2 3 4 5 6 7 8 9 10; do
  if compose exec -T backend \
    node -e "require('http').get('http://127.0.0.1:8000/api/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"; then
    ok=1
    break
  fi
  sleep 3
done
if [ "$ok" -ne 1 ]; then
  print_error "Healthcheck не прошёл — откат: восстановите $BACKUP_DIR/db.dump.sql и предыдущие образы вручную"
  exit 1
fi

echo -n "$TARGET" > DLE_VERSION
print_success "Обновление завершено: $CURRENT → $TARGET"
print_info "Бэкап сохранён в $BACKUP_DIR"

# Удаляем скачанный pack после успешного применения (единый поток локал/VDS)
if [ "${KEEP_PACK:-0}" != "1" ]; then
  if rm -f "$PACK"; then
    print_success "Pack удалён: $PACK"
  else
    print_warning "Не удалось удалить pack: $PACK"
  fi
else
  print_info "Pack сохранён (--keep-pack / KEEP_PACK=1)"
fi

print_info "Откат (документально): restore dump + docker load старых образов + вернуть DLE_VERSION"
