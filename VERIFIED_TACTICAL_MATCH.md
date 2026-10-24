# Friendly pair from the verified tactical experiment

Run from `/workspaces/monorepo`:

```bash
node tools/friendly-verified-tactical.mjs friendly-recovery-20261024-01
```

Use another seed argument for a new map. Each invocation creates a unique run directory, builds disposable copies, plays both physical sides, checks preservation, backs up the displayed replay, and publishes the first win (or the first match if neither wins). Limits are 1,000 ticks and a 60-second external watchdog per match. No training is performed.

The source is pinned to `logs/tactical-carrier-analysis/experiment-glS5Xk/no-carrier/`, the selected variant from the verified 9–1 experiment. Source, header, and Makefile are copied together and checked against the recorded source digest. Carriers are explicitly disabled using the original build flags. Existing root binaries are neither used nor overwritten. Friend sources are copied from `bots/c/bot/friend/` at invocation time.

The historical binary hash is not assumed to survive rebuilding: debug paths can vary. The new provenance records the compiler, flags, library, engine, source, header, and rebuilt executable hashes; the evaluator manifest independently identifies the executables actually played. This establishes provenance for the new matches without claiming historical binary identity or explaining the old root binary mismatch from timestamps.

## Completed pair: 2026-10-24

Run: `logs/friendly-verified-tactical-UwjwxM/`; evaluation: `evaluation-WWqm06/`.

| Match | Tactical starting position | Outcome | Tick |
| --- | --- | --- | --- |
| 0001 | (19,19), team 42 | Combat win | 838 |
| 0002 | (0,0), team 418 | Game-limit HP tiebreak win | 1000 |

Both matches completed, no execution failures or random decisions. Physical-side/layout checks passed. All 4,046 previously existing regular files under bot, client-library, preserved, and log directories retained their hashes. See `preservation-before.json`, `preservation-after.json`, `provenance.json`, and `result.json` in the run directory. These are two local games, not evidence of general superiority.

Rebuilt tactical executable SHA-256: `e5ef2d00c50fb5f6d86fd2cd09a738447d8106368cac8b3554b5c2178ace71d0`.

Match 0001 was published. The prior replay is saved at `logs/replay-publication-AudwSs/previous-replay.json`.

To display either saved match, with another automatic backup:

```bash
node tools/friendly.mjs publish logs/friendly-verified-tactical-UwjwxM/evaluation-WWqm06/0001/replay_latest.json
node tools/friendly.mjs publish logs/friendly-verified-tactical-UwjwxM/evaluation-WWqm06/0002/replay_latest.json
```

To start the visualizer:

```bash
cd /workspaces/monorepo/visualizer
npm run dev -- --host 0.0.0.0 --port 4242 --strictPort
```

Open its forwarded address and refresh after publication. No commit or push was performed.
