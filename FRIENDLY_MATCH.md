# Friendly match and shareable source

For the permanent first-victory archive, simplified single/pair/batch commands, and automatic replay backups, see [FRIENDLY_MATCHES.md](FRIENDLY_MATCHES.md). This document retains the original friendly-set record.

The friend's existing files in `bots/c/bot/friend/` were inspected and preserved. Its original Makefile builds successfully with our existing client library; no source or Makefile adaptations were necessary. New objects went into `friend/build/friendly/`. The previous friend executable was backed up to `logs/friendly-d9fcb6xm/friend-original-bot` before rebuilding.

Our selected bot, embedded parameters, shared client library, training checkpoints, evaluator, and game configurations were not modified. Existing verified server and selected-bot binaries were checked against their recorded hashes, allowing `--no-build` evaluation without rebuilding shared components. Before/after hashes and package verification are recorded in `logs/friendly-d9fcb6xm/session.json` and `protected-inputs.json`.

## Source package to send

`logs/friendly-d9fcb6xm/selected-strategy-source.tar.gz`

The archive contains only our selected strategy's `src/*.c`, `inc/*.h` (including `strategy_params.h`), a compatible Makefile, a short English README, and the supported demo `game.config.json`. It contains no opponent code, executable, object files, logs, credentials, or training history. The client library is required separately. Extracting and building the archive against our existing client library succeeded, and the built executable contains the selected policy fingerprint.

The package's Makefile links the specified library without rebuilding it:

```bash
tar -xzf selected-strategy-source.tar.gz
cd strategy-bot
make CLIENT_LIB_DIR=/absolute/path/to/bots/c/client_lib
```

## Results

Seed: `friendly-001`. Limit: 1,000 ticks, with a separate 60-second watchdog per match. Both completed by combat; neither used a game-limit tiebreak. The initial-layout fingerprints matched, and our bot occupied each actual starting position once.

| Match | Our team | Our CORE position | Our result | Final tick |
| --- | ---: | --- | --- | ---: |
| 0001 | 42 | (19,19) | Win | 316 |
| 0002 | 418 | (0,0) | Loss | 534 |

Both matches have separate configs, bot/server logs, results, and replays under `logs/evaluation-c3tfKc/0001/` and `logs/evaluation-c3tfKc/0002/`. This two-game friendly set split 1–1; it does not establish general superiority. No training was run.

## Repeat the match

From the container checkout, with no other game running:

```bash
cd /workspaces/monorepo
make -C bots/c/bot/friend \
  CLIENT_LIB_DIR=/workspaces/monorepo/bots/c/client_lib \
  OBJDIR=build/friendly EXEC=bot -B
node tools/evaluate.mjs \
  --a bots/c/bot/strategy-bot --b bots/c/bot/friend \
  --seeds friendly-001 --repeats 1 \
  --max-ticks 1000 --wall-seconds 60 --no-build
```

This uses the current verified selected-bot and server executables and rebuilds only the friend's bot. It retains synchronized startup and layout validation. A repeated evaluation writes a fresh printed `logs/evaluation-...` directory and does not overwrite previous match replays or publish to the visualizer. If our selected bot, shared client library, or server sources change later, verify/rebuild their binaries separately before using `--no-build` again.

## View either saved replay

The previous visualizer replay was backed up before publication to:

`logs/friendly-d9fcb6xm/visualizer-replay-before-friendly.json`

Friendly match 0001 is currently published. To select either saved friendly replay while preserving whatever is currently displayed:

```bash
cd /workspaces/monorepo
FRIENDLY_VIEW_BACKUP=$(mktemp -d logs/friendly-view-XXXXXXXX)
cp visualizer/public/replays/replay_latest.json "$FRIENDLY_VIEW_BACKUP/replay_previous.json"

# Match 1: our win
cp logs/evaluation-c3tfKc/0001/replay_latest.json visualizer/public/replays/replay_latest.json

# Or match 2: our loss
cp logs/evaluation-c3tfKc/0002/replay_latest.json visualizer/public/replays/replay_latest.json
```

Choose one of the last two copy commands; the last copied replay is the one displayed. Start the visualizer if needed:

```bash
cd /workspaces/monorepo/visualizer
npm run dev -- --host 0.0.0.0 --port 4242 --strictPort
```

Open the actual forwarded address for port 4242 in VS Code's Ports panel and refresh the browser after changing the replay. If the visualizer is already running, refresh it instead of starting a second instance.
