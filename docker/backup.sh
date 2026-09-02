#!/usr/bin/env bash
set -Eeuo pipefail

usage() {
    echo "Usage: $0 <persistent-data-root> [archive-directory]" >&2
    echo "  The root must contain data/ and log/. The archive contains those two directories." >&2
}

die() {
    echo "backup: $*" >&2
    exit 1
}

if [[ $# -lt 1 || $# -gt 2 ]]; then
    usage
    exit 2
fi

ROOT_INPUT=$1
[[ -d "$ROOT_INPUT" ]] || die "persistent data root does not exist: $ROOT_INPUT"
ROOT=$(cd -- "$ROOT_INPUT" && pwd -P)
[[ "$ROOT" != "/" ]] || die "refusing to use / as the data root"
[[ -d "$ROOT/data" ]] || die "missing $ROOT/data"
[[ -d "$ROOT/log" ]] || die "missing $ROOT/log"

if [[ $# -eq 2 ]]; then
    OUTPUT_DIR=$2
else
    OUTPUT_DIR="$ROOT/backup"
fi

mkdir -p -- "$OUTPUT_DIR"
OUTPUT_DIR=$(cd -- "$OUTPUT_DIR" && pwd -P)
case "$OUTPUT_DIR" in
    "$ROOT/data"|"$ROOT/data"/*|"$ROOT/log"|"$ROOT/log"/*)
        die "archive directory must not be inside data/ or log/"
        ;;
esac

umask 077
stamp=$(date '+%Y-%m-%d_%H-%M-%S')
archive="$OUTPUT_DIR/yanhuang-$stamp.tar.gz"
if [[ -e "$archive" ]]; then
    suffix=1
    while [[ -e "$OUTPUT_DIR/yanhuang-$stamp-$suffix.tar.gz" ]]; do
        suffix=$((suffix + 1))
    done
    archive="$OUTPUT_DIR/yanhuang-$stamp-$suffix.tar.gz"
fi

temporary=$(mktemp "$OUTPUT_DIR/.yanhuang-backup.XXXXXX")
cleanup() {
    rm -f -- "$temporary"
}
trap cleanup EXIT

tar -czf "$temporary" -C "$ROOT" data log
mv -- "$temporary" "$archive"
trap - EXIT
printf 'Created %s\n' "$archive"
