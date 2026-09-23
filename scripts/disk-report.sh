#!/usr/bin/env bash
# disk-report.sh: where the VPS disk goes. Run as root for the full report; as
# another user, sections that need root use `sudo -n` or are skipped.
# Usage: sudo bash disk-report.sh
set -uo pipefail

if [ "$(id -u)" -eq 0 ]; then
  root=""
elif sudo -n true 2>/dev/null; then
  root="sudo -n"
else
  root="none"
fi

section() { printf '\n== %s\n' "$1"; }

as_root() {
  if [ "$root" = none ]; then
    echo "(needs root, skipped)"
    return 1
  fi
  $root "$@"
}

section "Filesystems ($(date -Is))"
df -h -x tmpfs -x devtmpfs -x overlay -x squashfs -x efivarfs
df -i / | awk 'NR == 2 { print "inodes used on /: " $5 }'

if [ "$root" = none ]; then
  section "Largest directories in \$HOME (no root, depth 3)"
  du -xh -d3 "$HOME" 2>/dev/null | sort -rh | head -30
else
  df --output=target -x tmpfs -x devtmpfs -x overlay -x squashfs -x efivarfs -x vfat | tail -n +2 |
    while read -r mount; do
      section "Largest directories on $mount (depth 3)"
      $root du -xh -d3 "$mount" 2>/dev/null | sort -rh | head -30
    done
fi

section "Docker"
docker system df
echo
docker image ls --format '{{.Size}}\t{{.Repository}}:{{.Tag}}\t{{.CreatedSince}}' | sort -rh
echo
echo "dangling images: $(docker image ls -q --filter dangling=true | wc -l)"
echo "stopped containers: $(docker ps -aq --filter status=exited | wc -l)"

section "Container logs"
if [ "$root" = none ]; then
  echo "(needs root, skipped)"
else
  docker ps -a --no-trunc --format '{{.ID}} {{.Names}}' | while read -r id name; do
    size=$($root sh -c "du -cb /var/lib/docker/containers/$id/*-json.log* 2>/dev/null | tail -1 | cut -f1")
    printf '%s\t%s\n' "$(numfmt --to=iec "${size:-0}")" "$name"
  done | sort -rh | head -20
fi

section "PostgreSQL"
for c in $(docker ps --format '{{.Names}}' | grep -E -- '-db-[0-9]+$'); do
  echo "-- $c"
  docker exec -i "$c" sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -X -q -P pager=off' <<'SQL'
select datname, pg_size_pretty(pg_database_size(datname)) as size
from pg_database where not datistemplate order by pg_database_size(datname) desc;
select pg_size_pretty(sum(size)) as wal from pg_ls_waldir();
select relname,
       pg_size_pretty(pg_total_relation_size(relid)) as total,
       pg_size_pretty(pg_indexes_size(relid)) as indexes,
       n_live_tup as live_rows,
       n_dead_tup as dead_rows
from pg_stat_user_tables
order by pg_total_relation_size(relid) desc
limit 15;
select indexrelname as index,
       relname as table,
       pg_size_pretty(pg_relation_size(indexrelid)) as size,
       idx_scan as scans
from pg_stat_user_indexes
order by pg_relation_size(indexrelid) desc
limit 15;
SQL
done

section "System"
as_root journalctl --disk-usage
as_root du -sh /var/log /var/cache/apt /tmp /var/tmp /var/lib/snapd /root 2>/dev/null
