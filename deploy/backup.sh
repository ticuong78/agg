#!/bin/sh
# Nightly database backup (crontab: 0 2 * * * /opt/agg/deploy/backup.sh). Each dump is deleted 14 days after it was
# written (Retention.backupDays): find's -mtime +13 matches 14 whole days, so a dump made at 02:00 goes at the run
# 14 days later, not a day after that.
# GD-7: rows that live shorter than a backup are left out of the dumps, so a backup never keeps them longer than the
# privacy page says (the tables' schema is still dumped, and nothing references them):
#   - daily_usage (allowance counters, 2 days): always;
#   - conversions: in MVP mode, where every set is a guest's and lives 24 hours. In full mode accounts keep their sets
#     for 30 days or more, so conversions are backed up.
# The mode is the one the running API uses. If it cannot be told, no backup is made: silently dropping accounts'
# sets would be worse than a missing night, which cron reports.
set -eu
HERE=$(dirname "$0")
DIR=${BACKUP_DIR:-/var/backups/agg}
COMPOSE="docker compose -f $HERE/docker-compose.yml"

# The API's own view, unset meaning mvp (config/environment.ts). Falls back to the env file when the API is down:
# the last APP_MODE line, without `export`, quotes or a trailing comment, as Compose reads it.
# `sh -c` always exits 0 in a running container (an unset variable prints nothing), so any failure means the API
# container is not running, never that the mode is unset.
# shellcheck disable=SC2016 # expanded inside the container, not here.
if ! MODE=$($COMPOSE exec -T api sh -c 'printf "%s" "${APP_MODE:-}"' 2>/dev/null); then
  MODE=$(sed -n 's/^[[:space:]]*\(export[[:space:]]\{1,\}\)\{0,1\}APP_MODE=//p' "$HERE/api.env" | tail -n 1 |
    sed 's/[[:space:]]#.*$//; s/^["'\'']//; s/["'\'']\{0,1\}[[:space:]]*$//')
fi
MODE=$(printf '%s' "$MODE" | tr -d '[:space:]' | tr '[:upper:]' '[:lower:]')

case "$MODE" in
  full) EXCLUDE="--exclude-table-data=daily_usage" ;;
  mvp | "") EXCLUDE="--exclude-table-data=daily_usage --exclude-table-data=conversions" ;;
  *) echo "backup.sh: APP_MODE '$MODE' is neither mvp nor full; no backup made" >&2; exit 1 ;;
esac

mkdir -p "$DIR"
# shellcheck disable=SC2086 # COMPOSE and EXCLUDE are lists of words.
$COMPOSE exec -T postgres pg_dump -U agg -Fc $EXCLUDE agg > "$DIR/agg-$(date +%F).dump"
find "$DIR" -name 'agg-*.dump' -mtime +13 -delete
