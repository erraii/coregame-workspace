# Local evolutionary self-play

Run these commands inside the Dev Container at `/workspaces/monorepo`. Logs, frozen snapshots, executables, and replays stay under the workspace's ignored `logs/`, backed by `/goinfre` on the school host. No Python or deep-learning packages are required. One match runs at a time on port 4444.

The original `policy-bot` remains the reproducible reference: 15 Light, one Healthy, and no Armored births per match in its latest `eval-101` evaluation. `strategy-bot` is separate. Successful self-play exports its selected parameters to `strategy-bot/inc/strategy_params.h` and `selected_strategy.json`. The C executable does not load JSON or use Node/network services for inference; Node is used only for offline training. The game connection still uses the normal local socket API.

## Short smoke experiment

```bash
node tools/selfplay.mjs --work logs/selfplay-smoke \
  --iterations 1 --max-ticks 500 --wall-seconds 20 \
  --budget-seconds 600 --max-matches 120
```

The default seed sets are two each: `sp-train-001,sp-train-002`, `sp-promote-001,sp-promote-002`, and `sp-test-001,sp-test-002`. All sets must be disjoint. Promotion and final testing require at least two seeds. A first iteration uses 24 training matches, up to 24 promotion matches, and 24 final comparison matches: at most 72. Final testing includes the frozen initial strategy as a historical control. Self-play mirrors can use random tie decisions, which receive neutral fitness.

The global wall budget covers builds and matches. Each individual match has its own watchdog; the runner reduces that watchdog when necessary to respect the remaining session budget. The match budget is reserved before each evaluation, including attempts that fail. Budget exhaustion saves an incomplete checkpoint; it does not turn unfinished work into a successful experiment. These are local 500-tick experiments, not full competition games.

## Longer configurable run

Choose a fresh work directory and seed sets before starting:

```bash
node tools/selfplay.mjs --work logs/selfplay-long \
  --iterations 4 --max-ticks 1000 --wall-seconds 30 \
  --train-seeds long-train-01,long-train-02 \
  --promotion-seeds long-promote-01,long-promote-02 \
  --test-seeds long-test-01,long-test-02 \
  --search-seed 73 --budget-seconds 1800 --max-matches 320
```

With two seeds per stage and up to four opponents, this schedules at most 288 matches. The budgets can stop it sooner. Do not rerun searches on the same final test seeds until one lucky result appears; choose a protocol in advance and report all runs.

## Resume an incomplete run

```bash
node tools/selfplay.mjs --work logs/selfplay-long --resume \
  --budget-seconds 2400 --max-matches 400
```

Budgets are cumulative across resume. Completed evaluation panels are reused from the checkpoint, and reserved match counts are retained. Ordinary errors and Ctrl+C clean up child processes and locks. Failures abort fitness with no automatic retry; an explicit resume may retry the incomplete panel, consuming a new bounded reservation. Keep failure logs. A forced kill can leave locks: inspect running processes and port 4444 before removing a stale lock.

Resume verifies implementation, engine, client-library, configuration, frozen source, model-file, and executable hashes. It refuses changed inputs. You may increase the iteration target before final selection is frozen. Once final testing begins, selection cannot change; a finalized run cannot be extended. Start a new work directory for changed code or rules. Moving a checkpoint directory is not supported because it records absolute snapshot paths.

## Evaluate and play the selected strategy

```bash
node tools/evaluate.mjs --a bots/c/bot/strategy-bot \
  --b bots/c/bot/gridmaster --seeds inspect-001,inspect-002 \
  --max-ticks 1000 --wall-seconds 30

bash tools/match.sh bots/c/bot/strategy-bot bots/c/bot/gridmaster
```

The evaluator builds from the exported C header. Every strategy executable prints its embedded model SHA-256 in its bot log. Self-play checks that the selected digest appears in the freshly compiled export. Snapshot metadata and evaluator manifests record the actual executable hashes and source/model identity. `successful_spawns.a` and `.b` report Light, Healthy, Armored, Miner, Guard, and Other births, counted by unique authoritative unit IDs rather than requests or survivors.

## Watch a replay

A completed self-play run publishes a representative selected-policy final-test replay to `visualizer/public/replays/replay_latest.json`. `tools/match.sh` replaces that file with its own match. Standalone evaluation keeps replays inside the printed evaluation folder; copy a chosen one to that visualizer path when needed.

```bash
cd visualizer
npm run dev -- --host 0.0.0.0 --port 4242 --strictPort
```

Open the actual forwarded address from VS Code's Ports panel and refresh the browser.

## Strategy and legality

The compact genome has eight bounded integer parameters: miner quota (0–3), guard quota (0–5), attacker design (Light/Healthy/Armored), return load (10–100 gems), miner production cutoff (0–800 ticks), defensive threat radius (2–20 tiles), preference for loose piles (0–30), and guard target preference for enemies closer to home (0–4).

Mutation varies a production quota and one targeting/economy/design parameter in a reproducible local neighborhood. This is evolutionary parameter search, not PPO or gradient-based reinforcement learning. Initial parameter values are human choices. The original 32-weight policy remains unchanged in the old bot.

| Role/design | Components | Cost | Replay name |
| --- | --- | ---: | --- |
| Light | core_attack | 35 | StrategyLight |
| Healthy | core_attack, health | 47 | StrategyHealthy |
| Armored | core_attack, armor | 65 | StrategyArmored |
| Miner | mining | 35 | StrategyMiner |
| Guard | unit_attack, health | 47 | StrategyGuard |

These designs satisfy the actual demo constraint: base action cooldown must be at least the sum of attack properties. A speed attacker or combined core/mining attacker would violate it and is not offered. Training rejects rule/configuration changes against the preserved `supported_game_config.json`, including changes to invalid conditions, default properties, and costs. No game rules or prices are changed.

Handwritten execution is explicit: specialists are produced up to the learned quotas, with guards prioritized under a nearby threat. Cooldown and affordability gate production; an unaffordable attacker falls back to Light, an unaffordable specialist waits. Miners prefer targets using distance, return distance, pile preference, and estimated deposit work. Destroying a deposit creates a pile; attacking a pile collects gems. Loaded miners travel home and transfer their cargo from an adjacent tile. Guards select enemy units using travel distance and home threat priority. CORE attackers rush the enemy CORE. The existing C library supplies deterministic weighted pathfinding and blocks zero-damage attacks. Execution, role definitions, and pathfinding are handwritten; the search learns only the eight strategy parameters.

## Opponents, promotion, and records

Each work directory freezes the original policy, Gridmaster, and the initial strategy as content-addressed source/model/executable snapshots. Promoted strategies join the historical pool. Every panel contains both fixed references, the latest historical strategy, and a rotating older strategy when available; it never consists only of the newest policy. Compiled snapshots are cached and hash-verified before reuse.

Candidate and incumbent face the identical opponent sample, seeds, sides, and tick limit. Each evaluator runs both IDs; the trainer additionally verifies that the candidate's actual coordinates differ across the two matches and that layout hashes match within and across panels. Sequential execution and synchronized logins preserve the earlier evaluation fixes.

Fitness is 1/0 for combat wins/losses, 0.75/0.25 for CORE/unit-HP game-limit tiebreaks, and 0.5 for either random winner. Simultaneous CORE deaths are recognized as `combat_random` and neutralized as well. Execution failures never get fitness. Training speed bonuses are deliberately omitted from this new trainer.

A candidate reaches promotion only after a strictly higher training score. Promotion requires at least two opponents and two seeds, average fitness delta at least 0.05, at least two paired gains, zero paired regressions, and no opponent-level regression. This is a conservative operational gate, not a significance test. Promotion records include an approximate paired standard error; seed/opponent dependence and the small sample limit its interpretation. Final test seeds are exposed only after selection is frozen and never influence acceptance.

`checkpoint.json` contains the pool, selected snapshot, budgets, completed panels, decisions, and error context. Each panel keeps rows with winners, death reasons, tiebreak types, failures, initial positions, spawn counts, and evaluator paths; executable hashes connect each result to a snapshot. `summary.json` reports per-opponent results and initial/selected final tests. Large artifacts remain ignored; preserve a small result/model summary as source when recording an experiment.

## Checks and competition scope

```bash
node --test --test-concurrency=1 tools/evaluate.test.mjs tools/policy.test.mjs tools/selfplay.test.mjs
```

Tests cover C/model parity, affordability/cooldown masks, component legality, mining/return/defence execution, snapshot integrity/selection, paired promotion, layout protection, random-decision handling, and checkpoint restoration. Real experiment results are in `TRAINING_RESULTS.md`.

The checked-in upstream guide `wiki/documentation/website_setup.md` describes a `my-core-bot/` folder, `make` producing `bot`, and `./bot <id>`. This local `strategy-bot` is not an official submission in that layout. No claim is made that learned-policy deployment, current event rules, or resource limits have been approved. No submission, commit, or push is part of this workflow.

## Continuing from an incumbent with a bounded reserve

Fresh runs now load `strategy-bot/selected_strategy.json` by default, or an explicit `--from MODEL.json`; they no longer reset silently to the hardcoded initial strategy. A finalized run cannot be extended using exposed final-test results. Keep it and start a new work directory with fresh final seeds. `--history-models MODEL.json,MODEL.json` freezes explicitly chosen historical models using the current strategy implementation, without importing their outcomes or the friend bot.

Mutation now advances one reproducible PRNG stream. The previous linear per-iteration reseeding correlated neighboring secondary-parameter choices. Resume reconstructs the stream offset from the iteration count. `--final-reserve-seconds 180` checks measured match speed before starting another full comparison; when estimated work would eat into the reserve, it stops between candidates, freezes selection, and proceeds to final tests. The summary records this early stop; promotion gates and fitness semantics stay unchanged.

Self-play publication now backs up the previous displayed replay through the same atomic helper as friendly matches. The summary records the backup directory and old/new hashes.

Read-only diagnostics restricted to completed training trajectories:

```bash
node tools/audit-strategy.mjs logs/YOUR_RUN/checkpoint.json > logs/YOUR_RUN/behavior-audit.json
```

This reports actual births, resource deliveries and attack types, plus single-parameter counterfactual production/miner/guard decisions. It never reads final-test replay panels. Changed decisions are not causal estimates of win improvement and do not change scoring or promotion.
