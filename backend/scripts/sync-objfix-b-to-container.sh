#!/usr/bin/env bash
# Host objfix-b → dapp-backend (только если НЕТ bind-mount на /tmp/objfix-b).
# Merge: без rm -rf всего дерева; docker cp перезаписывает совпадающие файлы.
#
#   PAGE_IDS=1042,744  — скопировать только эти подпапки (дозалив, не всё дерево)
#   PAGE_IDS пусто     — cp всего HOST_ROOT/. (legacy)
#
set -euo pipefail
HOST_ROOT="${OBJFIX_HOST_ROOT:-/tmp/objfix-b}"
if [ ! -d "$HOST_ROOT" ]; then
  echo "{\"sync\":\"objfix-b\",\"error\":\"missing host dir $HOST_ROOT\"}" >&2
  exit 1
fi

docker.exe exec dapp-backend mkdir -p /tmp/objfix-b

parse_ids() {
  local s="${PAGE_IDS:-${TEST_IDS:-}}"
  [ -z "$s" ] && return 0
  echo "$s" | tr ',' '\n' | sed 's/^[[:space:]]*//;s/[[:space:]]*$//' | grep -E '^[0-9]+$' || true
}

IDS="$(parse_ids)"
if [ -n "$IDS" ]; then
  n=0
  while IFS= read -r id; do
    [ -z "$id" ] && continue
    src="$HOST_ROOT/$id"
    if [ ! -d "$src" ]; then
      echo "{\"sync\":\"objfix-b\",\"warn\":\"missing dir\",\"id\":$id}" >&2
      continue
    fi
    docker.exe cp "$src" dapp-backend:/tmp/objfix-b/
    n=$((n + 1))
  done <<< "$IDS"
  echo "{\"sync\":\"objfix-b\",\"ok\":true,\"mode\":\"merge\",\"scope\":\"page_ids\",\"count\":$n}"
else
  docker.exe cp "$HOST_ROOT/." dapp-backend:/tmp/objfix-b/
  echo '{"sync":"objfix-b","ok":true,"mode":"merge","scope":"full"}'
fi
