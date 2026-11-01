#!/usr/bin/env bash
# Daily database backup: compressed pg_dump kept for KEEP_DAYS days.
#
#   crontab -e  ->  0 3 * * * /opt/foodihub/backend/deploy/backup.sh >> /var/log/foodihub-backup.log 2>&1
#
# A backup that stays on the same server is not enough if the server dies: copy BACKUP_DIR somewhere
# else too (another machine with rsync, or a bucket with rclone).
set -euo pipefail
cd "$(dirname "$0")"

BACKUP_DIR="${BACKUP_DIR:-/opt/foodihub-backups}"
KEEP_DAYS="${KEEP_DAYS:-14}"
mkdir -p "$BACKUP_DIR"

FILE="$BACKUP_DIR/foodihub-$(date +%F-%H%M).sql.gz"
docker compose --env-file .env.prod -f docker-compose.prod.yml exec -T db \
  sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' | gzip > "$FILE"

# a failed dump leaves a tiny file: do not keep it as if it were a backup
if [ "$(stat -c%s "$FILE")" -lt 2000 ]; then
  echo "backup too small, discarding: $FILE" >&2
  rm -f "$FILE"
  exit 1
fi

find "$BACKUP_DIR" -name 'foodihub-*.sql.gz' -mtime +"$KEEP_DAYS" -delete
echo "ok: $FILE ($(du -h "$FILE" | cut -f1))"
