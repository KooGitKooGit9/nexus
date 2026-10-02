#!/bin/sh
# Container entrypoint: make the data volume writable for the unprivileged `node` user, then drop root.
set -e
DATA="${NEXUS_DATA_DIR:-/app/server/data}"
mkdir -p "$DATA"
if [ "$(id -u)" = "0" ] && command -v setpriv >/dev/null 2>&1; then
  chown -R node:node "$DATA" 2>/dev/null || true
  exec setpriv --reuid=node --regid=node --init-groups "$@"
fi
exec "$@"
