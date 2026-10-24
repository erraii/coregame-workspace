# Autonomous local CORE Game evolution

This standalone Node/C CPU trainer requires no Codex, LLM, API calls, keys, network service or new packages. Games use local sockets on port 4444. Run one game/training tool at a time; the computer/container must remain awake. Existing bots, friend sources, sealed snapshots and historical results are never output destinations. Exports require a new directory.

## Current protocol (version 2, predeclared for new runs)

New runs record `protocol.json`, immutable code/config/compiler identities, input-parameter digest and cumulative budgets before evaluating a candidate. Checkpoint `state.protocol` persists the same declaration. Historical hour-001 used its original four-opponent protocol; it was completed before these search changes and is never reinterpreted under version 2.

- Parent selection retains the champion plus a six-member novelty reservoir. Persisted LCG state controls selection and mutation. Each event chooses a single mutation with probability 0.7 or an intentional joint mutation with probability 0.3. Joint groups are carriers/carrier_load, miners/economy_end and guards/defense_gain. Carrier joint steps ensure a positive carrier count. Rejected reservoir parents may carry multiple changes relative to the champion.
- A carrier_load-only mutation is skipped without real-game panels when its candidate has `carriers=0`. Worlds start without own units; this policy cannot create own carriers at zero quota. Other candidates use the exact exported C action probe over 1200 synthetic worlds. Probe effect is a screening diagnostic, not proof of real-game benefit. Dependencies not encoded in this explicit carrier rule can still be missed.
- Search always includes the frozen verified tactical baseline, current champion, preceding historical champion, and a rotating older champion when distinct. Gridmaster and linear-policy are excluded from training panels because the audited run beat them in 394/394 combat games.
- Before any promotion, **both weak references return as fixed regression checks** in the validation panel, together with every challenging search opponent. Incumbent and challenger each play two seeds and both physical sides; layouts must match. Weak-reference regressions still veto promotion.
- Training delta must be strictly positive. Validation uses the unchanged promotion rule over its entire panel: at least two opponents and two seeds, delta ≥0.05, at least two paired gains, zero paired regressions, zero opponent-average regressions. No gate was relaxed. Combat fitness is 1/0, HP tiebreak 0.75/0.25, random 0.5. Execution failures never score.
- Rejected initial validation with nonnegative delta and zero paired regressions receives at most one extra two-seed panel, pooled under that same rule. Final-report seeds are separate and reporting-only. Friend sources/results never enter selection.
- Every stage uses `${work-basename}-${stage}-${iteration}-${seed-index}`. Choose a fresh basename for a new experiment. A seed is used in both team slots 42/418; actual physical positions are checked. Frozen opponents and saved pending parameters survive interruption unchanged.

Initially there are two challenging opponents: 16 training games per candidate, then 32 validation games if training passes, and optionally 32 extra (80 total). With up to four distinct challenging opponents this becomes 32 + 48 + 48 = 128. Probe/dependency skips use no matches. Budgets may pause any stage; incomplete evidence never promotes.

## Exact commands

Run in `/workspaces/monorepo`. These are examples; use fresh paths. The next one-hour experiment is recommended but has **not** been launched:

```bash
node tools/evolution.mjs start --work logs/evolution-hour-002 \
  --seconds 3600 --matches 1000 --iterations 100 --ticks 1000 --wall 30 \
  --seed 73 --keep-replays 4 --disk-mb 4096 --background
```

A short foreground run:

```bash
node tools/evolution.mjs start --work logs/evolution-v2-short \
  --seconds 300 --matches 64 --iterations 3 --ticks 500 --wall 15 --seed 73
```

Explicitly initialize a **new** compatible run from a saved champion export (parameters only, no carried fitness or population):

```bash
node tools/evolution.mjs start --work logs/evolution-import-001 \
  --from logs/evolution-export-smoke-20261024/model.json \
  --seconds 300 --matches 64 --iterations 3 --ticks 500 --wall 15 --seed 73
```

`--from` accepts a schema-valid parameter JSON, including an exported `model.json`; its absolute input path and SHA-256 are saved. It is accepted only on `start`. Changing the environment requires a new run rather than editing a checkpoint. Input parameters do not claim compatible execution provenance from their original machine.

```bash
node tools/evolution.mjs status --work logs/evolution-hour-002
node tools/evolution.mjs stop --work logs/evolution-hour-002
node tools/evolution.mjs resume --work logs/evolution-hour-002 \
  --seconds 7200 --matches 2000 --iterations 200 --background
node tools/evolution.mjs recover --work logs/evolution-hour-002
```

`status` is read-only and reports liveness, committed completed games separately from reserved slots, pending work, limits, errors and report path. `stop` checks PID start identity and signals the worker. Wait for `alive:false` before resuming, exporting, moving or starting another game tool. `recover` is only for an abruptly terminated worker: it refuses a live owner, cleans only its marked processes/locks and refuses unrelated locks. Do not delete locks by hand.

### Resolve only the saved pending candidate

```bash
node tools/evolution.mjs resume --work logs/evolution-v2-short \
  --finish-pending --additional-seconds 1500 --additional-matches 42 \
  --seconds 1800
```

The cumulative `--seconds` example must be at least the stored limit and must leave sufficient remaining time; inspect `status` first. The 42-slot example matches the historical candidate's missing 10 + conditional 32 games; a different pending candidate may need more. No-pending runs are refused without generating a candidate. A finish invocation caches/resumes all stages, allows the normal conditional extra panel and stops after that one final decision, before RNG draws or another candidate. If a cap interrupts it, a later finish invocation continues the same pending candidate with fresh invocation allowances.

`--seconds`, `--matches`, `--iterations` remain cumulative, monotone limits. `--additional-seconds` and `--additional-matches` cap only that invocation, including interrupted reservations, without lowering/resetting cumulative limits. Both types of limits must allow a pair. Each new pair reserves two slots and two configured watchdog durations before launch. A wall deadline also signals active asynchronous evaluation for cleanup. Initialization/compilation is synchronous (each compile has a 60-second timeout); a deadline cannot preempt that synchronous section, and cleanup/checkpoint overhead may extend the deadline. Finish-pending with an already-built/evaluated pending candidate requires no compile. Conservative pair reservation can stop early.

SIGINT/SIGTERM preserve pending work. Interrupted pairs consume reservations but contribute no fitness until a complete paired checkpoint record exists; completed evaluator files can contain uncommitted individual games, so inspect them separately from committed counts. No automatic retry after an execution failure; explicit resume can retry once, then a pair's two-failure limit refuses further attempts. Never retry until lucky.

### Export and reporting-only final evaluation

```bash
node tools/evolution.mjs export --work logs/evolution-hour-002 --out logs/evolution-export-002
make -C logs/evolution-export-002 \
  CLIENT_LIB_DIR=/workspaces/monorepo/bots/c/client_lib \
  CFLAGS='-Wall -Wextra -Werror -O2 -fsanitize=address'
node tools/evolution.mjs test --work logs/evolution-hour-002 --seconds 7500 --matches 2100
```

Export refuses an existing path and writes C sources, embedded header, model and provenance. The exported bot needs CORE's C client library/game sockets, but no Node, model service or network API at inference. `test` uses distinct final-report seeds, records `final-report-N.json`, and never selects a candidate. Once consulted, final reports are benchmarks rather than unseen holdouts.

Every checkpoint update writes `RUN_REPORT.md`: committed games, slots, evaluated/skipped decisions, parameter differences, rejection conditions, promotions, pending work, per-opponent outcomes, failure attempts/errors and stop reason. Checkpoint/evaluator JSON remains authoritative. Background workers append to `console.log`; reports need no Codex session. `--keep-replays` prunes only older replay payloads within that run, keeping result rows, manifests, logs and snapshots. Explicit initial/champion replay directories stay protected. `--disk-mb` is a scheduling ceiling, not a filesystem quota.

## Compatibility, preservation and moving computers

Checksummed checkpoints use the production atomic fsync writer and retain a previous copy. Never hand-edit checksums, drop identity fields or declare changed code compatible. Resume/export verifies exact trainer, runtime helper, policy, C source, evaluator, scoring, compiler, engine, library, configuration and frozen snapshot identities. The new search implementation intentionally refuses historical identities.

The hour-001 continuation used an explicit **lifecycle-only migration before any search change**. `migrate-lifecycle` required the exact audited legacy trainer SHA-256, checked every other identity field and every frozen snapshot, backed up checkpoint/previous/summary and legacy trainer, and recorded old/new identities. This command is narrowly pinned; it does not authorize migration across policy/core changes and the current v2 code deliberately rejects the old run. The executed lifecycle source bundle is in `preserved/evolution-lifecycle-continuation-20261024/`; original tools and full run archive are in `preserved/evolution-lifecycle-original-20261024/`. The migration was not a checksum bypass. Do not launch broad search on hour-001.

Migration command used during that audited phase (not a generic current-version conversion):

```bash
node tools/evolution.mjs migrate-lifecycle --work logs/evolution-hour-001 \
  --legacy-trainer preserved/evolution-lifecycle-original-20261024/evolution.mjs
```

Before moving computers: stop, verify `alive:false`, retain the full run including checkpoints, snapshots/binaries, manifests/configs/logs, input exports, exact tools (including `evolution-runtime.mjs`), engine/library/configuration, compiler/Node/runtime environment and verified tactical source dependency. Git ignores many large artifacts; a commit alone is not a backup. Archive to a fresh name and verify its digest:

```bash
mkdir -p backups
tar -czf backups/evolution-hour-002-backup-001.tar.gz \
  logs/evolution-hour-002 tools bots/c/bot/evolution-bot bots/c/client_lib \
  bots/c/bot/gridmaster bots/c/bot/policy-bot bots/configs/fake_demo \
  logs/tactical-carrier-analysis/experiment-glS5Xk/no-carrier \
  server/server server/data server/inc/game/ReplayEncoder.h LOCAL_EVOLUTION.md
sha256sum backups/evolution-hour-002-backup-001.tar.gz
```

Back up friend sources, sealed victory and older results separately too; never overwrite them. Restore with matching OS/runtime/compiler and preferably the same workspace path (manifests contain absolute paths). Verify archive and checkpoint integrity, compatibility and snapshot hashes before resume. If the environment differs, export parameters under the original compatible environment and use `start --from` on the new one. Rebuilding binaries can change identity; do not replace historical snapshots in place.

## Parameters and handwritten policy

Schema is authoritative in `tools/evolution-policy.mjs`; integer values only. The 15 searched fields are:

| Parameter | Range; initial | Effect |
| --- | --- | --- |
| `miners` | 1–4; 2 | Living miner target in midgame. Early ticks 0–99 use one miner; late game uses `late_miners`. |
| `guards` | 1–5; 2 | Minimum living guard target; priority over carriers/attackers. |
| `carriers` | 0–2; 0 | Optional living fast-carrier target during economy phase, after miner/guard needs. Zero disables handoffs and carrier production. |
| `economy_end` | 100–800 ticks; 400 | End of midgame economy allocation and new-carrier production; mutated in 100-tick steps. |
| `late_miners` | 0–3; 1 | Living miner replacement target after economy phase. No units are destroyed to meet quotas. |
| `threat_radius` | 4–16 tiles; 12 | Manhattan distance from CORE for counted enemy threats. |
| `defense_gain` | 0–2; 1 | Extra desired guards per nearby enemy, capped at eight guards total. |
| `attack_commit` | 0–5 attackers; 0 | Stage/retreat toward home until this living attacker count, except adjacent enemy CORE strikes; also favors guards when outnumbered near home. |
| `avoid_weight` | 0–32; 16 | Path cost per enemy-fighter danger cell for non-guards; mutated in steps of eight. |
| `return_load` | 10–100 gems; 35 | Miner self-return threshold when no nearby carrier has capacity; steps of 15 gems. |
| `carrier_load` | 10–100 gems; 35 | Carrier return threshold; reservations also cause return movement, never forwarding unobserved cargo; steps of 15. |
| `resource_home` | 0–4; 2 | Resource score adds 0.25 × value × home distance. |
| `guard_radius` | 3–16 tiles; 12 | Stable goalie ignores enemies beyond this home distance. |
| `target_bias` | 0–3; 2 | Guard target-score bonus of 100 × value for incoming CORE attackers. Guards attack units; CORE attackers cannot attack units. |
| `attacker_design` | 0–2; 1 | Legal Light / Healthy / Armored CORE attacker; costs 35 / 47 / 65. |

Production order, legal components, affordability/cooldown masks, role recognition, carrier rendezvous, transfer capacity reservations, pathfinding, danger-map shape, and action legality are handwritten. The search changes parameters and existing alternatives, not source code. There is no healing. The legal guard is `unit_attack + health` (damage 3); one-hit kills are not assumed. Legal carrier is unarmed `speed + gem_carrying_efficiency`; speed-plus-attack/mining combinations are rejected under current rules. Engine evidence: `server/src/action/{AttackAction,TransferGemsAction}.cpp`, `server/src/object/Unit.cpp`, `bots/configs/fake_demo/game.config.json`.


## Verification and measured results

```bash
node --test --test-concurrency=1 tools/evaluate.test.mjs tools/policy.test.mjs \
  tools/selfplay.test.mjs tools/friendly.test.mjs tools/audit-strategy.test.mjs \
  tools/tactics.test.mjs tools/evolution.test.mjs
```

Tests exercise component legality, exported-C parity/effect, RNG continuity, atomic integrity and incompatible identities, CLI lifecycle, invocation caps, no-pending refusal, cached interruption/resume through conditional extra validation without a new candidate, dependency skips, mixed joint/single mutation, and weak-reference regression vetoes. Synthetic cached results in tests are fixtures, not claims of real-game improvement.

Historical iteration 24: 42 added games (10 missing + 32 conditional extra), 190.879 added seconds; all 832 total games completed, no execution failures. Training delta +0.015625; final pooled validation 0.6640625 → 0.671875, delta +0.0078125, one paired gain and zero regressions. Rejected for delta below 0.05 and fewer than two gains. Original champion retained. See `EVOLUTION_HOUR_001_ITERATION_24_FINAL.md`; earlier reviews remain intact. The one-hour next experiment has not been launched.

The earlier implementation document and its historical smoke evidence are preserved in `preserved/evolution-lifecycle-original-20261024/LOCAL_EVOLUTION.md`. New bounded smoke results are recorded separately in `logs/evolution-v2-smoke-20261024/smoke-results.json` and `EVOLUTION_V2_VERIFICATION.md`.
