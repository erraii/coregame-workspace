# Latest update: autonomous evolution v2 — 2026-10-24

Lifecycle and search efficiency improvements are complete. Read [LOCAL_EVOLUTION.md](LOCAL_EVOLUTION.md) for standalone commands, invocation caps, automatic reports, version-2 search/validation protocol, parameter import, backups and strict compatibility rules. No LLM/API is required.

Historical `logs/evolution-hour-001` was explicitly migrated for lifecycle scheduling only, then only pending iteration 24 was resolved: 42 added games, 190.879 added seconds, total 832 completed/reserved games. Late-miner candidate was rejected (pooled validation delta +0.0078125, only one paired gain); original champion `e539c7dc8871fff608df8e7316c53b2d4f922456037956d3a7c6f0b23fbeb4bc` remains. Iteration 25, pending null, idle. No broad search occurred. Full result: [EVOLUTION_HOUR_001_ITERATION_24_FINAL.md](EVOLUTION_HOUR_001_ITERATION_24_FINAL.md). Earlier review/outcome evidence remains unchanged and archived. Current v2 code deliberately refuses compatibility with that historical run.

Final relevant suite: **56 passing tests**. Separate real v2 smoke: **48 completed games / 50 reserved slots**, intentional SIGTERM interruption followed by finish-pending resume, one evaluated/rejected candidate, no promotions, 199.720 wall seconds. Weak references were absent from training and restored in validation. Export compiled successfully. **667 protected bot/snapshot/sealed files unchanged**; no trainer children or match/training locks remain. See [EVOLUTION_V2_VERIFICATION.md](EVOLUTION_V2_VERIFICATION.md) for actual scores, artifacts and limitations.

New features: invocation-only finish/time/slot caps without resetting cumulative budgets; automatic `RUN_REPORT.md`; dependency skip for carrier-load-only changes with carriers off; 70% single / 30% intentional coupled mutation events; frozen tactical/current/historical selection opponents; mandatory unchanged promotion gate including weak-reference regression checks; `start --from model.json` with input digest.

The recommended one-hour `logs/evolution-hour-002` command is in the verification report and LOCAL_EVOLUTION.md; it has **not** been launched. No commit or push was made. Existing playable bots, friend sources and historical selections remain untouched. The older handoff below is retained as historical context; its execution state and command recommendations are superseded by this update.

---

# CORE Game project handoff

Update after this handoff: autonomous offline evolution was implemented and smoke-tested on 2026-10-24, with verification completed at 10:45:23 UTC. Read `LOCAL_EVOLUTION.md` for the current commands and parameter schema. The separate bot is `bots/c/bot/evolution-bot/`; the standalone entry point is `tools/evolution.mjs`. Existing bot selections described below remain unchanged. Smoke evidence is `logs/evolution-verification-20261024/results.json`: 51 tests passed, 66 checkpointed search games, no promotions, exported champion 2/2 combat wins, 680 protected files unchanged. The run is stopped and resumable at `logs/evolution-smoke2-20261024/`; no longer run was launched. The dated inspection below remains a historical baseline.

Inspection timestamp: **2026-10-24 10:07:37 UTC** (checks continued immediately afterward).
Workspace: `/workspaces/monorepo`, inside the existing development container.

This handoff was prepared from repository files, saved experiment artifacts, Git metadata, and process/port inspection. No private session contents or credentials were accessed. No training, matches, builds, bot edits, commit, push, or remote fetch were performed for this handoff. Commands below are references for future authorized work, not instructions to start now.

## Current execution state and user intent

- No trainer, evaluator, friendly-match runner, game server, or bot process was found.
- Vite is running: PID 1712 (parent shell 1711), listening on `0.0.0.0:4242`. Port 4444 has no entry in `/proc/net/tcp` or `/proc/net/tcp6`.
- `.training-lock`, `.match-lock`, and `.selfplay-lock` are absent. Never remove locks without checking process ownership and port use.
- Latest implementation/evaluation work is complete. The latest strategy feedback was saved only; it does not authorize training or strategy edits. Read `STRATEGY_FEEDBACK.md` before proposing the next experiment.
- Preserve the trained strategy, completed results, verified tactical experiment, friend sources, reference bots, and sealed first victory. Do not clean ignored logs or snapshots.

## Bot variants and command selection

| Variant | Location / selection | Meaning |
| --- | --- | --- |
| Original linear policy | `bots/c/bot/policy-bot/` | Four actions, eight features, 32 weights. Retained weights showed no learned improvement in the completed legacy experiment. |
| Selected trained strategy | `bots/c/bot/strategy-bot/`; friendly `--bot current` (also the friendly wrapper default) | Eight-parameter evolutionary strategy, with miners, guards, and CORE attackers. This is not the tactical variant. |
| Current tactical working source | `bots/c/bot/tactical-bot/`; friendly `--bot tactical` | Separate handwritten defense, routing, mining, and optional carriers. `--carriers on/off` explicitly selects the toggle; `auto` uses its source default, currently off. |
| Verified tactical source | `logs/tactical-carrier-analysis/experiment-glS5Xk/no-carrier/`; `tools/friendly-verified-tactical.mjs SEED` | Pinned source/header/Makefile from the 9–1 experiment, hash-checked and rebuilt in a unique isolated directory with carriers off. Prefer this for reproducing that source. |
| Frozen first victory | `preserved/first-victory-20261024/`; friendly `--bot first-victory` | Sealed historical winning executable and sources, independent of later selected parameters. Wrapper verifies the seal and uses the recorded executable without rebuilding it. |
| External friend | `bots/c/bot/friend/` | Current friend source is copied and built in disposable friendly run directories. Kept outside self-play training and promotion selection. |
| Fixed references | `bots/c/bot/gridmaster/`, original policy | Frozen into self-play snapshots. Other existing example bots remain available. |

`tools/evaluate.mjs --a PATH --b PATH` selects the explicit directories and normally builds them. `tools/match.sh A B` selects explicit directories, builds in place, and publishes its replay; without arguments it selects `my-core-bot` versus `gridmaster`, not the selected strategy. Prefer isolated friendly wrappers when preservation matters. Ordinary friendly wrappers save but do not automatically publish; the verified tactical wrapper backs up and publishes automatically.

## Learned parameters versus handwritten behavior

Self-play is bounded evolutionary parameter search, not PPO or gradient-based reinforcement learning. It trains `strategy-bot`, not `tactical-bot`. The selected model is `bots/c/bot/strategy-bot/selected_strategy.json`, embedded in `inc/strategy_params.h`:

```text
miners=1, guards=2, attacker=1 (Healthy), return_load=35,
economy_until=200, threat_radius=4, pile_bonus=12, home_weight=2
```

Only eight bounded integers are searched. Roles, legal designs, cooldown/affordability masks, action execution, production structure, target-scoring formulas, and pathfinding remain handwritten. The selected mutation changed guards 1→2 and threat radius 8→4. Recorded diagnostics found behavior changes from the extra guard quota; the radius change had no sampled decision effect. Seven of eight parameters were mutated in completed candidates; `home_weight` was not reached. Some other tested economy/targeting steps also had no sampled decision effect. These are trajectory-limited observations, not proofs of general inactivity.

The tactical variant adds a home defender, responsive guard production, attacker-priority targeting, threat-aware travel, split resource targeting, and optional miner-to-carrier handoffs. Only guard minimum and miner return load are inherited from the old exported parameters; its new logic is handwritten. Fast carriers use `speed + gem_carrying_efficiency`, cost 52, have 5 HP and cooldown 1 empty / 2 carrying 35 gems. Cargo slows them; they cannot mine deposits or fight. See `TACTICAL_CARRIERS.md` and actual configuration/code for rules.

## Verified results and limitations

| Work | Recorded result | Evidence |
| --- | --- | --- |
| Legacy reliable evaluation/training | 14 training/holdout matches; no accepted candidate or score improvement; repeated placement checks passed | `logs/training-PoAABA/`, `bots/c/bot/policy-bot/selected_policy_results.json`, `TRAINING_RESULTS.md` |
| First expanded-strategy self-play | 72 matches; one candidate rejected; selected model remained the initial handwritten parameters; two additional export checks | `logs/selfplay-verified/checkpoint.json`, `TRAINING_RESULTS.md` |
| Continued economy self-play | 5 candidates completed, 1 promoted; 280 self-play matches, 211 combat decisions, 69 HP tiebreak decisions, zero random decisions/failures; 2 additional export matches both combat wins | `logs/selfplay-20261024-economy/{checkpoint,summary,experiment-results,final-verification}.json`, `logs/evaluation-WaopEi/` |
| Tactical/carrier comparison | 30 matches in 120.51 seconds, zero execution failures; both variants 8–0 against selection references; no-carrier chosen by predeclared tie rule; selected variant 9–1 against friend and 4–0 fresh Gridmaster control | `logs/tactical-carrier-analysis/results.json`, `experiment-glS5Xk/{summary,selection,selected-default}.json` |
| Latest pinned tactical friendly pair | New seed `friendly-recovery-20261024-01`: 2–0, one combat win at tick 838 from (19,19), one game-limit HP win at tick 1000 from (0,0); zero failures/random decisions | `logs/friendly-verified-tactical-UwjwxM/result.json`, `evaluation-WWqm06/0001/`, `evaluation-WWqm06/0002/` |

The economy run's promotion panel fitness improved 0.640625→0.859375, but fresh final aggregate fitness stayed 0.833333 for both initial and selected policies (10–2 each). It did not demonstrate overall held-out improvement. Candidate six was skipped to preserve final-testing time; the run finalized normally, not as a crash. Training took 999.834 seconds; final export verification, replay publication, and documentation were completed too.

Tactical friend results improved from the old trained bot's 1–9 to 9–1 on the same five paired seeds. Tactical wins included six combat wins and three HP tiebreak wins. This bundled handwritten change and small known-opponent panel do not isolate causes or prove general strength. Friend outcomes did not select the carrier toggle. Carriers recorded 43 handoffs totaling 2,025 gems and 1,695 carrier-to-CORE gems on reference games, but did not improve the already perfect reference win score. Default remains off.

Recorded regression suites: economy work 41 passing tests; tactical work 43 passing tests in `logs/tactical-carrier-analysis/tests-final.log`, plus final carrier test rerun in `carrier-tests-final.log`. These are historical results, not newly rerun tests. The latest wrapper passed syntax checking and the actual balanced pair; `preservation-after.json` records 4,046 pre-existing files unchanged.

## Checkpoints, snapshots, and executable provenance

- Latest selected self-play checkpoint: `logs/selfplay-20261024-economy/checkpoint.json`, iteration 5, `finalized=true`, `selection_frozen=true`, no `last_error`. It is readable and retained, but cannot be extended with `--resume`.
- Selected snapshot ID: `5a7b181a6aafdfcb35178c5feb264c5a83cebc1e8e47323da5333b44d93ad364`, under that run's `snapshots/`; contains `model.json`, source, header, binary, and `snapshot.json` hashes.
- Pre-training incumbent: `logs/selfplay-20261024-economy/pre-training-incumbent/`.
- Earlier `logs/selfplay-verified/checkpoint.json` is also finalized. Its historical `last_error` says match budget exhausted, but later completion/finalized state supersedes that intermediate stop. Legacy checkpoints also exist in `logs/training-PoAABA/` and `logs/training-dMjjVC/`; the latter contains the old unreliable comparison, not the selected current result.
- Selected model digest: `e81c7dc3450050a3f01abe8d2738da33e0bf24eb0f5b971505c7486c58c806a8`. Root trained binary currently hashes to `1537a49bcbc22c71215f1204c49958d025cc2bd443977380a2c6da9e80e0763a`, matching recorded export verification. Model/header equality was verified during recovery and the pair preserved those files.
- Verified tactical source digest: `17494b2d52934ed5af7f7f98d041f0cdcade9a7b1f7c03a7c0d0345c6fc42976`. Latest isolated binary: `e5ef2d00c50fb5f6d86fd2cd09a738447d8106368cac8b3554b5c2178ace71d0`. Its provenance and evaluator manifests identify compiler, build flags, friend, library, engine, configuration, and played binary hashes.
- Historical tactical experiment binary differs from both the root working binary and the rebuilt isolated binary. The latest pair resolves which source/build was played without claiming historical binary identity. Debug paths can cause rebuild differences; the exact cause of the old root mismatch was not established. Do not infer binary content from timestamps.
- First victory: `preserved/first-victory-20261024/`, archive `preserved/first-victory-20261024.tar.gz`, archive checksum file, manifest, and `SHA256SUMS`. All 48 payload files were rechecked successfully during this inspection; archive checksum passed during recovery. Original match: `logs/evaluation-c3tfKc/0001/`, engine final tick 316 / displayed timeline tick 315. Never build or clean inside the sealed tree.
- Logs and large binaries/replays are ignored by Git. Preserve them separately; a Git commit alone would not retain all recovery evidence.

## Latest completed work and remaining issues

Latest completed execution: isolated verified tactical pair, source/parameter provenance, protection checks, both saved replays, and backup-preserving publication. Documentation: `VERIFIED_TACTICAL_MATCH.md`; repeat runner: `tools/friendly-verified-tactical.mjs`.

Latest feedback: improve miner–carrier–CORE throughput, investigate legal one-hit near-CORE defenders, track enemy spawned units and movement, respond to enemy camping versus rushing, and consider defense/economy with HP tiebreak wins. These ideas are **not implemented by the feedback note** and require future explicit authorization. Existing tactical logic is responsive in limited ways but does not implement a general opponent-adaptive strategy. Measure idle time, handoffs, transport, interception, and outcomes; do not assume fast transport alone improves win rate.

Known limits: small correlated map/opponent samples; no demonstrated general learned improvement; some parameter steps ineffective on observed states; simultaneous movement can collide; tactical variants are outside the current trainer; no established legal one-hit defender; no official competition deployment approval or submission. The old evaluation issue was random-device CORE assignment independent of seed, fixed locally with sorted IDs and seeded placement plus layout validation. See `TRAINING_RESULTS.md`; older documentation's statements about which replay is displayed may be historical.

## Exact commands (reference only)

All commands start in `/workspaces/monorepo`. Use one game at a time on port 4444. Match/training commands build and write artifacts; do not run them during read-only inspection.

### Training the selected strategy, when explicitly requested

The existing finalized run's native command is shown for completeness; it deliberately refuses further search:

```bash
node tools/selfplay.mjs --work logs/selfplay-20261024-economy --resume
```

For a new bounded strategy experiment from the retained selected model, use a fresh directory and fresh disjoint seeds. This example does not train tactical logic and can update the root strategy export; preserve the incumbent first:

```bash
node tools/selfplay.mjs --work logs/selfplay-handoff-next \
  --from logs/selfplay-20261024-economy/snapshots/5a7b181a6aafdfcb35178c5feb264c5a83cebc1e8e47323da5333b44d93ad364/model.json \
  --history-models logs/selfplay-20261024-economy/pre-training-incumbent/selected_strategy.json \
  --iterations 4 --search-seed 73 \
  --train-seeds handoff-train-01,handoff-train-02 \
  --promotion-seeds handoff-promote-01,handoff-promote-02 \
  --test-seeds handoff-final-01,handoff-final-02 \
  --max-ticks 500 --wall-seconds 20 \
  --budget-seconds 1200 --max-matches 300 --final-reserve-seconds 180
```

Only if that new run is incomplete and compatible:

```bash
node tools/selfplay.mjs --work logs/selfplay-handoff-next --resume
```

Resume checks identities and uses cumulative budgets. Changed inputs may require a new run; finalized runs cannot be extended. Keep training, promotion, and final sets separate and never tune using final results.

### Friendly matches

```bash
# Exact verified tactical source, isolated build, balanced pair, backup + publication
node tools/friendly-verified-tactical.mjs friendly-recovery-20261024-01

# Current tactical working source, optional carriers
node tools/friendly.mjs pair --bot tactical --carriers off --seeds friendly-next-001
node tools/friendly.mjs pair --bot tactical --carriers on --seeds friendly-next-001

# Retained trained strategy, single / pair / batch
node tools/friendly.mjs single --bot current --seeds friendly-next-001
node tools/friendly.mjs pair --bot current --seeds friendly-next-001
node tools/friendly.mjs batch --bot current --seeds friendly-next-001,friendly-next-002

# Sealed historical winning executable
node tools/friendly.mjs pair --bot first-victory --seeds friendly-001
```

Friend source is read at invocation time. Each wrapper uses unique output directories; normal wrapper defaults are 1,000 ticks and 60 seconds per match. Pinned tactical repeats the known latest seed unless the positional seed is changed. Do not describe reused seeds as unseen tests.

### Replay selection and viewing

Currently displayed: latest pair match 0001. Current file `visualizer/public/replays/replay_latest.json` has SHA-256 `ebd89b9e0ade5a05e53fddbef0252119987de2ee6e54605a348c087606b147b5`, matching publication evidence. Previous displayed replay: `logs/replay-publication-AudwSs/previous-replay.json`.

```bash
node tools/friendly.mjs publish logs/friendly-verified-tactical-UwjwxM/evaluation-WWqm06/0001/replay_latest.json
node tools/friendly.mjs publish logs/friendly-verified-tactical-UwjwxM/evaluation-WWqm06/0002/replay_latest.json

# Only start if the current visualizer has stopped
cd /workspaces/monorepo/visualizer
npm run dev -- --host 0.0.0.0 --port 4242 --strictPort
```

Publication saves another backup. Use the actual forwarded port address and refresh the browser. Standalone evaluator output is not automatically published.

## Git and publication state

Branch: `dev`. HEAD: `09953bc44526739a424126dd0eeae838c2158ed9` — `Set up local C bot matches, replay paths, and setup guides`.

Local `origin/dev` equals HEAD (ahead/behind 0/0). No remote fetch was performed, so this describes cached remote-tracking state, not independently verified live remote state. The later training/tactical/handoff work is uncommitted and therefore is not included in that commit or a Git push of it. No push was performed in the recent work; there is no evidence here of publication of these uncommitted files elsewhere.

Tracked modifications at inspection: `.gitignore`, `.vscode/settings.json`, `CORE_GAME_FRESH_SETUP.md`, `server/src/game/Game.cpp`, `tools/match.sh` (32 insertions / 13 deletions total).

Untracked at inspection: `CODEX_HANDOFF.txt`, `EVALUATION_QUICKSTART.md`, `FRIENDLY_MATCH.md`, `FRIENDLY_MATCHES.md`, `SELFPLAY_QUICKSTART.md`, `STRATEGY_FEEDBACK.md`, `TACTICAL_CARRIERS.md`, `TRAINING_QUICKSTART.md`, `TRAINING_RESULTS.md`, `VERIFIED_TACTICAL_MATCH.md`; directories `bots/c/bot/{friend,policy-bot,strategy-bot,tactical-bot}/` and `preserved/`; tools `audit-strategy.mjs`, `audit-strategy.test.mjs`, `evaluate.mjs`, `evaluate.test.mjs`, `friendly-verified-tactical.mjs`, `friendly.mjs`, `friendly.test.mjs`, `policy-model.mjs`, `policy.test.mjs`, `selfplay-core.mjs`, `selfplay.mjs`, `selfplay.test.mjs`, `strategy-model.mjs`, `tactical-experiment.mjs`, `tactics.test.mjs`, `train.mjs`. This handoff adds untracked `PROJECT_STATUS.md`.

No applicable `AGENTS.md` was found in the earlier parent-tree inspection or current repository file search. Inspect again if the checkout or instructions change. Preserve unrelated changes and never assume untracked files are disposable.
