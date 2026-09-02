#!/bin/sh
set -eu

MUD_ROOT=/mud
DATA_DIR="$MUD_ROOT/data"
LOG_DIR="$MUD_ROOT/log"
BACKUP_DIR="$MUD_ROOT/backup"
DUMP_DIR="$MUD_ROOT/dump"
TEMP_DIR="$MUD_ROOT/temp"
SEED_DATA_DIR=/opt/yanhuang-seed/data

if [ "$#" -eq 0 ]; then
    set -- /usr/local/bin/driver config.ini
fi

if [ "$(id -u)" -eq 0 ]; then
    mkdir -p \
        "$DATA_DIR/board" \
        "$DATA_DIR/item/depot" \
        "$DATA_DIR/item/ring" \
        "$DATA_DIR/login" \
        "$DATA_DIR/npc" \
        "$DATA_DIR/pet" \
        "$DATA_DIR/room" \
        "$DATA_DIR/shop" \
        "$DATA_DIR/user" \
        "$DATA_DIR/cchess" \
        "$LOG_DIR/channel" \
        "$LOG_DIR/file" \
        "$LOG_DIR/intermud" \
        "$LOG_DIR/static" \
        "$LOG_DIR/user" \
        "$BACKUP_DIR" \
        "$DUMP_DIR" \
        "$TEMP_DIR"

    if [ -e "$DATA_DIR/.env" ] && [ ! -f "$DATA_DIR/.env" ]; then
        echo "[yanhuang] data/.env exists but is not a regular file" >&2
        exit 1
    fi

    if [ ! -f "$DATA_DIR/.env" ]; then
        cp "$SEED_DATA_DIR/.env.example" "$DATA_DIR/.env"
        echo "[yanhuang] created data/.env from data/.env.example; review it before enabling optional services"
    fi

    # Seed only files that are absent. Existing saves and configuration are
    # never replaced when the container starts again.
    for seed in "$SEED_DATA_DIR"/*.o; do
        [ -f "$seed" ] || continue
        target="$DATA_DIR/$(basename "$seed")"
        if [ ! -e "$target" ]; then
            cp "$seed" "$target"
        fi
    done

    # A bind mount created by Docker is commonly root-owned. Normalize only
    # the writable runtime directories before dropping privileges.
    if ! chown -R mud:mud "$DATA_DIR" "$LOG_DIR" "$BACKUP_DIR" "$DUMP_DIR" "$TEMP_DIR"; then
        echo "[yanhuang] cannot grant the mud user access to runtime directories" >&2
        exit 1
    fi

    exec gosu mud "$@"
fi

exec "$@"
