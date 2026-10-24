#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

A="${1:-bots/c/bot/my-core-bot}"
B="${2:-bots/c/bot/gridmaster}"

A="$(realpath "$A")"
B="$(realpath "$B")"
LIB="$ROOT/bots/c/client_lib"
CONFIG="$ROOT/bots/configs/fake_demo"

# Aynı portta iki maçın birlikte başlamasını engelle.
mkdir "$ROOT/.match-lock" 2>/dev/null || {
    echo "Başka bir maç çalışıyor veya .match-lock klasörü kalmış."
    exit 1
}

pids=()
cleanup() {
    trap - EXIT INT TERM
    for pid in "${pids[@]}"; do
        kill "$pid" 2>/dev/null || true
    done
    for pid in "${pids[@]}"; do
        wait "$pid" 2>/dev/null || true
    done
    rmdir "$ROOT/.match-lock"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

make -C "$LIB"
make -C "$A" CLIENT_LIB_DIR="$LIB" EXEC=bot
make -C "$B" CLIENT_LIB_DIR="$LIB" EXEC=bot
make -C server dev JOBS=4

mkdir -p replays visualizer/public/replays logs
RUN="$(mktemp -d "$ROOT/logs/match-XXXXXXXX")"
echo "Maç logları: $RUN"

"$B/bot" 418 >"$RUN/player-418.log" 2>&1 &
pids+=("$!")
"$A/bot" 42 >"$RUN/player-42.log" 2>&1 &
pids+=("$!")

./server/server \
    "$CONFIG/server.config.json" \
    "$CONFIG/game.config.json" \
    server/data 42 418 >"$RUN/server.log" 2>&1 &
SERVER_PID=$!
pids+=("$SERVER_PID")

tail -n +1 -f "$RUN/server.log" &
pids+=("$!")

status=0
wait "$SERVER_PID" || status=$?

if [[ -f replays/replay_latest.json ]]; then
    cp replays/replay_latest.json "$RUN/replay_latest.json"
fi

echo "Sunucu kapandı. Çıkış kodu: $status"
echo "Loglar ve varsa replay: $RUN"
exit "$status"
