#!/bin/sh
# Nightly database backup (crontab: 0 2 * * * /opt/agg/deploy/backup.sh). Keeps 14 days.
set -eu
DIR=${BACKUP_DIR:-/var/backups/agg}
mkdir -p "$DIR"
docker compose -f "$(dirname "$0")/docker-compose.yml" exec -T postgres pg_dump -U agg -Fc agg > "$DIR/agg-$(date +%F).dump"
find "$DIR" -name 'agg-*.dump' -mtime +14 -delete
