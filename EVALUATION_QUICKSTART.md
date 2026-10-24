# CORE Game — Repeatable Evaluation Runner

The evaluator uses the demo configuration without modifying it. The local engine now seeds CORE placement from the game seed, and both runners synchronize startup. Baseline bot sources remain unchanged.

It is the first stage of a training experiment: reliably evaluate policies before optimizing them. **This version does not train a model.**

## Install

Extract the archive into your existing monorepo checkout. The resulting files should be:

```text
tools/evaluate.mjs
tools/evaluate.test.mjs
EVALUATION_QUICKSTART.md
```

Host checkout: `/goinfre/$USER/coregame/monorepo`.
Container checkout: `/workspaces/monorepo`.

Use the VS Code Dev Container for all commands below. Node.js 22 is already installed there. No npm packages, Python installation, or additional inference runtime is needed for this runner.

## First real-engine smoke test

Stop any existing match first. The visualizer can remain running because it uses a different port.

```bash
cd /workspaces/monorepo
node tools/evaluate.mjs --seeds eval-001 --max-ticks 1000 --wall-seconds 120
```

This builds the C library, both example bots, and the server once, then runs two matches:

| Match | Team 42 | Team 418 |
| --- | --- | --- |
| 1 | Bot A: My CORE Bot | Bot B: Gridmaster |
| 2 | Bot B: Gridmaster | Bot A: My CORE Bot |

The engine is always launched with team IDs `42 418`. Its original placement shuffle used `random_device`, independently of the map seed; login order did not determine the physical side. The local engine now sorts team IDs and shuffles with `mt19937_64(game.seed)`. Swapping bots between IDs therefore swaps physical sides for a given seed and engine build. This is a local evaluation change, not a competition submission change.

The runner waits for the listening message, launches team 42, waits for its accepted-login message, then launches team 418. Each result records `initial_cores` and `initial_layout_sha256`. The fingerprint normalizes object order and excludes object IDs, spawned units, and dynamic CORE state because replay tick 0 is recorded after the first turn. Terrain and CORE ownership must match for every match of the same seed. Changed layouts are rejected; the trainer also checks them across candidate and holdout comparisons.

The 1,000-tick limit is intentionally shorter than the original 30,000-tick configuration. It tests the runner rather than measuring full-match strength. The 120-second external watchdog is separate: if it fires, the match is recorded as a failure, not a loss or draw.

At the end, send the printed summary and any error message. If something fails, preserve the evaluation folder and share its `result.json` and relevant logs.

## Larger evaluation

Once the smoke test succeeds:

```bash
node tools/evaluate.mjs \
    --seeds eval-001,eval-002,eval-003 \
    --max-ticks 30000 \
    --wall-seconds 300
```

This schedules six matches. Increase the external wall limit if normal full matches cannot finish within it. Do not count interrupted matches as game outcomes.

To repeat a fixed seed for a reproducibility check:

```bash
node tools/evaluate.mjs \
    --seeds eval-001 \
    --repeats 2 \
    --max-ticks 1000
```

Fixed seeds control the requested map seed; they do not by themselves prove full determinism across timing, binaries, or engine versions. Compare repeated results before claiming deterministic simulation.

## Different C opponents

```bash
node tools/evaluate.mjs \
    --a bots/c/bot/my-core-bot \
    --b opponents/friend \
    --seeds eval-001,eval-002
```

Both folders must have compatible Makefiles supporting `CLIENT_LIB_DIR=... EXEC=bot` and producing a `bot` executable. The runner builds with the existing sanitizer settings from those Makefiles. External bots may need an adapter.

Use `--no-build` only when the correct binaries have already been built:

```bash
node tools/evaluate.mjs --no-build --seeds eval-001
```

Run `node tools/evaluate.mjs --help` for options. Both sides are always evaluated.

## Saved files

Each invocation creates a unique `logs/evaluation-...` directory:

```text
manifest.json
build.log
results.jsonl
summary.json
0001/
    game.config.json
    server.config.json
    a.log
    b.log
    server.log
    replay_latest.json
    result.json
0002/
    ...
```

`build.log` is omitted with `--no-build`. A replay exists only when the engine successfully writes one.

The manifest records options, base configuration hashes, executable hashes, Git state, and the engine death-code mapping. Each match receives its own copies of the demo configs and its own replay output folder. Existing configuration files and visualizer replays are not overwritten.

## Result interpretation

The runner reads `misc.team_results`, `misc.worldGeneratorSeed`, and `full_tick_amount` from each new replay. It reads the numeric death-reason enum from your installed engine headers rather than assigning guessed numeric meanings.

- `completed`: one unambiguous winner and one loser were found.
- `execution_failure`: a client connection or launch failure was identified.
- `server_failure`: the server failed to start or returned a nonzero exit status.
- `wall_timeout`: the external watchdog stopped the match.
- `invalid_result`: missing replay, wrong seed, unknown result code, ambiguous placement, or another validation failure.

Only completed matches contribute wins and losses. Failures make the command exit with status 1. A disconnect is excluded from the policy win rate, even if the engine awards a placement.

Completed matches are further classified as:

- `combat`: no game-timeout decision was detected.
- `timeout_tiebreak`: the engine selected a loser at its game limit.
- `timeout_random`: the engine used a random timeout tiebreak.

The inspected engine compares CORE HP, then total unit HP, then makes a random choice when resolving a tie at the limit. There is no verified draw outcome in this format, so this runner does not invent one. Do not confuse winning a timeout tiebreak with destroying the opponent's CORE.

## Watch an evaluation replay

Choose the exact match you want to inspect:

```bash
cd /workspaces/monorepo
mkdir -p visualizer/public/replays
cp logs/evaluation-REPLACE_ME/0001/replay_latest.json \
    visualizer/public/replays/replay_latest.json
```

Replace `evaluation-REPLACE_ME` with the actual folder printed by the runner. Refresh the existing visualizer page. Keep the per-match original as the authoritative result.

## Locks and cleanup

The runner shares `.match-lock` with the existing `tools/match.sh` and checks port 4444 before starting. It terminates only processes it launched. Do not run the root Makefile or a separate server concurrently: the root Makefile does not honor this lock.

`Ctrl+C` stops the current evaluation and cleans up its children. A forced termination such as `SIGKILL` can leave `.match-lock` behind. Inspect processes and port 4444 before manually removing a stale lock; never delete it while a match is running.

## Verification and limitations

Each match's `result.json` and `results.jsonl` row includes `successful_spawns.a` and `.b`, with `Light`, `Healthy`, `Armored`, `Miner`, `Guard`, `Carrier`, and `Other` counts. These count unique authoritative replay unit births by team and exact component design, including units that later die. Failed create requests are excluded. The counts are also printed after each match. Legacy names are `PolicyLight`, `PolicyHealthy`, and `PolicyArmored`; the expanded strategy uses `StrategyLight`, `StrategyHealthy`, `StrategyArmored`, `StrategyMiner`, and `StrategyGuard`.

Simultaneous CORE deaths can use random placement ordering. The evaluator recognizes both final CORE HP values reaching zero and reports `combat_random`, separately from `timeout_random`, `timeout_tiebreak`, and ordinary `combat`. Both trainers give random resolutions neutral fitness. `SPAMMED`, disconnects, client timeouts, and external watchdog terminations are execution failures rather than game outcomes.

The combined 32-test suite includes mock TCP engines and compiled C strategy/inference checks; real-match evidence is recorded in `TRAINING_RESULTS.md`. It covers successful spawn counting, layout rejection, enum parsing, side mapping, timeout/random classification, invalid outcomes, isolated replays, unchanged base configs, cleanup, missing-replay protection, watchdog behavior, lock preservation, and self-play safeguards.

```bash
node --test --test-concurrency=1 tools/evaluate.test.mjs tools/policy.test.mjs tools/selfplay.test.mjs
```

The real CORE executable and bots were rebuilt and exercised in six repeated smoke matches and 14 training/holdout matches. If the engine enum uses unsupported numeric expressions, the runner deliberately stops instead of guessing results.

## Next stage: train an exportable policy

After validating this runner:

1. Establish baseline results with the current bots.
2. Add a separate policy bot with a small parameterized decision model.
3. Optimize its parameters on training seeds and opponents.
4. Evaluate on held-out seeds and opponents, keeping random tiebreaks visible.
5. Export the chosen parameters into C for inference.

Reserve `eval-...` seeds for evaluation. Use a separate `train-...` seed list for optimization; do not tune on evaluation results repeatedly.

## Save the source to GitHub

After reviewing the new files:

```bash
git add tools/evaluate.mjs tools/evaluate.test.mjs EVALUATION_QUICKSTART.md
git commit -m "Add isolated fixed-seed match evaluation"
git push origin dev
```

Generated evaluation directories belong under ignored `logs/`; no binaries or node_modules are included in this package.
