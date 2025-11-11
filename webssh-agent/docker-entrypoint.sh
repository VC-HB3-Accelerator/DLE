#!/bin/bash
set -euo pipefail

SOCK_PATH=${DOCKER_SOCK_PATH:-/var/run/docker.sock}

if [ -S "${SOCK_PATH}" ]; then
  SOCK_GID=$(stat -c %g "${SOCK_PATH}" || echo "")
  if [ -n "${SOCK_GID}" ]; then
    GROUP_LOOKUP=$(getent group "${SOCK_GID}" || true)
    if [ -n "${GROUP_LOOKUP}" ]; then
      GROUP_NAME=$(echo "${GROUP_LOOKUP}" | cut -d: -f1)
    else
      GROUP_NAME=docker-host
      if ! getent group "${GROUP_NAME}" >/dev/null 2>&1; then
        groupadd -g "${SOCK_GID}" "${GROUP_NAME}" || true
      fi
    fi

    usermod -aG "${GROUP_NAME}" webssh || true
  fi
fi

chown -R webssh:webssh /home/webssh/.ssh 2>/dev/null || true

exec gosu webssh "$@"

