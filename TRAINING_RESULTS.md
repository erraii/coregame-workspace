# Local evaluation and training results — 2026-10-24

The evaluation reliability fix is installed and verified on the real engine. The original `Game::Game` shuffled CORE assignments using `random_device`, independently of the requested seed. Login order was not the cause of the observed side changes. Local placement now uses sorted team IDs and `mt19937_64(Config::game().seed)`. The runners start the server first and synchronize accepted logins. Evaluation fingerprints terrain and CORE ownership, rejecting mismatches within a run and across training comparisons.

## Continued self-play experiment — 2026-10-24

The run `logs/selfplay-20261024-economy` is **complete and finalized**, with selection frozen. The later pause request found no trainer or child game processes running and neither lock present. Nothing was killed, resumed, or deleted. No further matches were started after that request.

The latest prior checkpoint (`logs/selfplay-verified/checkpoint.json`) was already finalized, its old final seeds were known benchmarks, and its tool identity predated later changes. It was preserved. The new run started explicitly from the current incumbent, backed up with exact source, embedded header, JSON parameters, and executable in `logs/selfplay-20261024-economy/pre-training-incumbent/`. The first-victory snapshot/archive, friend bot, and reference bots remain unchanged; 84 protected files and the 48 sealed victory files passed hash checks.

### Focused fixes and protocol

Fresh-run initialization now accepts `--from` and defaults to the selected strategy instead of always loading the hardcoded initial model. Mutation uses a reproducible continuous PRNG stream instead of correlated linear per-iteration reseeding. Tests check the declared mutation coverage and exact stream reconstruction on resume. Historical models can be explicitly imported and frozen without importing their results. The runtime reserve protects final evaluation before another candidate starts. Publication now backs up the previous replay atomically. A final-phase resume guard also prevents an interrupted final evaluation after an early budget stop from restarting the unfinished iteration target; that defensive guard was added and tested after this experiment finalized, without changing its outcomes.

No C strategy routines, component prices, game rules, evaluator outcome semantics, fitness formula, or promotion gates were changed. Cooldown and affordability masks still gate production; unaffordable specialists wait, an unaffordable attacker may fall back to Light, and pathfinding avoids impossible zero-damage attacks. Strategy execution, role definitions, resource scoring form, movement, target-score form, and action legality remain handwritten. Evolutionary search changes only eight bounded integer parameters.

The search seed (14) was chosen solely for parameter coverage before matches. Six candidates were planned using the measured prior speed of 3.125 seconds/match. Five completed; the runner reserved final-testing time and stopped before candidate six, with measured speed about 3.59 seconds/match. The search had a 1,270-second build/evaluation budget, 180-second final reserve, 420-match cap, 500-tick limit, and 20-second match watchdog. Training itself took **999.834 seconds (16m 39.8s)**. The two export-verification matches and all final regression checks completed before the interruption; the original inspection/training/verification work finished within the 30-minute ceiling (the last measured verification time was 07:19:14 UTC, versus a conservative budget anchor of 06:55:00 UTC). Later documentation completion after the usage-limit interruption did not run more matches.

The opponent pool froze the original linear policy, Gridmaster, the pre-training strategy, and the prior two-guard Armored challenger. The historical strategy sample rotated using the existing selector. The friend bot was never used for training, promotion, or this run's final tests. Each candidate/incumbent comparison used the same sampled opponents, seeds, actual physical sides, and match limits; layout checks passed.

Seed sets were disjoint:

- Training: `r2-train-2410-a,r2-train-2410-b`.
- Promotion: `r2-promote-2410-a,r2-promote-2410-b`.
- Fresh final test: `r2-final-d73a-001,r2-final-d73a-002`.

Fresh final outcomes were not inspected until selection was frozen. No final result selected or tuned a candidate.

### Actual selection and behavior

| Candidate | Mutation from its incumbent | Training delta | Promotion delta | Decision |
| --- | --- | ---: | ---: | --- |
| 1 | Guards 1→2; threat radius 8→4 | +0.18750 | +0.21875 | Promoted: 5 paired gains, 0 regressions |
| 2 | Miners 1→2; pile preference 12→4 | 0 | Not run | Rejected |
| 3 | Guards 2→3; miner cutoff 200→300 | +0.12500 | +0.12500 | Rejected: 4 gains, 2 regressions |
| 4 | Miners 1→2; Healthy→Light attackers | −0.078125 | Not run | Rejected |
| 5 | Guards 2→3; return load 35→20 | +0.12500 | +0.12500 | Rejected: 4 gains, 2 regressions |

The first promotion's 16-game validation fitness increased from **0.640625 to 0.859375**, with approximate paired standard error 0.09375 for the difference. Its improvement was local to the sampled panel. Against the prior Armored challenger it changed 0/4 wins to 2/4, but both new wins were HP-based game-limit decisions, not combat victories. Against the old strategy it changed 2/4 to 4/4 combat wins. The gate was never weakened.

The retained parameters are `miners=1, guards=2, attacker=Healthy, return_load=35, economy_until=200, threat_radius=4, pile_bonus=12, home_weight=2`. The only observed effective selected behavioral change is the additional guard quota. In the first candidate's training panels it produced 38 guards versus 19 and changed 296 single-parameter production decisions on 8,549 sampled states. The radius change had no sampled decision effect and accompanied the effective quota change; it is not evidence of learned threat handling.

The extra-miner candidate demonstrated a real economy change despite rejection: 32 miner births versus 16, 1,855 gems delivered versus 1,050, and 65 deposit attacks versus none across its matched 16 training games per policy. Fitness did not improve. Mining improvements therefore were measured but not retained by the win-based objective.

Seven of eight parameters were mutated in completed candidates. `home_weight` was not reached because candidate six was skipped for time reserve. Counterfactual audit on recorded training trajectories found no decision changes for `threat_radius`, `pile_bonus`, `economy_until`, or the tested 35→20 `return_load` step. Loose piles often deliver 35 gems, so both return thresholds trigger together; pile preference also cannot alter rankings when only loose piles compete. Miner quota, guard quota, and attacker design did change production. These diagnostics sample observed states and are not full causal ablations or proof of inactivity on every map. Target selection and pathfinding were not learned or rewritten.

The earlier single candidate really changed guard/attacker choices: its audit found 202 and 244 changed production decisions on 5,652 sampled training states. That earlier run had only mutated two parameters; its other six were never tested.

### Fresh final test and evidence strength

| Opponent | Pre-training combat W–L | Selected combat W–L | Tiebreaks/failures |
| --- | --- | --- | --- |
| Original linear policy | 4–0 | 4–0 | 0 |
| Gridmaster | 4–0 | 3–1 | 0 |
| Pre-training strategy | 2–2 | 3–1 | 0 |
| Total | 10–2 | 10–2 | 0 |

**Final aggregate fitness stayed 0.833333 for both policies.** A learned parameter change passed the established promotion gate, but no overall fresh-test improvement was demonstrated. The selected policy traded one Gridmaster result for one better result against the old strategy. Only two fresh seeds and a small correlated opponent sample were used, so this does not establish general superiority. The rotating final panel did not include the prior Armored challenger, where part of the promotion benefit occurred. Selection was kept locked; final feedback was not used to roll back or retune it.

There were **280 self-play matches**, with 211 combat decisions, 69 HP-based game-limit decisions, zero random decisions, and zero execution failures. Final tests account for 24 of those matches. Two additional real matches verified the freshly exported root executable against Gridmaster (`r2-export-6f3a`); both were combat wins. Total real matches for this experiment and export verification: **282**. Bot logs printed the selected checkpoint's embedded model digest, and the played executable hash matches the current exported executable.

All **41 regression tests passed**. The exported `selected_strategy.json`, `inc/strategy_params.h`, source hash, and binary fingerprint match the retained snapshot. No restoration was needed when training was paused. The current binary SHA-256 is `1537a49bcbc22c71215f1204c49958d025cc2bd443977380a2c6da9e80e0763a`; model digest is `e81c7dc3450050a3f01abe8d2738da33e0bf24eb0f5b971505c7486c58c806a8`.

### Saved artifacts and continuing later

- Checkpoint and complete candidate/panel records: `logs/selfplay-20261024-economy/checkpoint.json`.
- Selected snapshot: `logs/selfplay-20261024-economy/snapshots/5a7b181a6aafdfcb35178c5feb264c5a83cebc1e8e47323da5333b44d93ad364/`.
- Summary, full compact evidence, and post-pause verification: `summary.json`, `experiment-results.json`, `final-verification.json` in that run directory.
- Mutation audit: `behavior-audit.json`; test output: `regression-before.log`, `regression-after.log`, `audit-tests.log`.
- Export verification: `logs/evaluation-WaopEi/`.
- Published selected replay: `logs/evaluation-HlJXR5/0001/replay_latest.json`.
- Previous displayed replay backup: `logs/replay-publication-QmVwWH/previous-replay.json` (also copied before training into the run directory).

The native resume command is:

```bash
node tools/selfplay.mjs --work logs/selfplay-20261024-economy --resume
```

This particular run is already finalized, so that command intentionally refuses further search. Do not reopen its known final tests. If an incomplete compatible run is interrupted, the same `--work ... --resume` form resumes its checkpoint; changed code/configuration is rejected. To continue later from this retained policy, start a new bounded experiment with fresh seeds instead (not executed during the pause):

```bash
node tools/selfplay.mjs --work logs/selfplay-next   --from logs/selfplay-20261024-economy/snapshots/5a7b181a6aafdfcb35178c5feb264c5a83cebc1e8e47323da5333b44d93ad364/model.json   --history-models logs/selfplay-20261024-economy/pre-training-incumbent/selected_strategy.json   --iterations 4 --search-seed 73   --train-seeds r3-train-2410-a,r3-train-2410-b   --promotion-seeds r3-promote-2410-a,r3-promote-2410-b   --test-seeds r3-final-45e9-a,r3-final-45e9-b   --max-ticks 500 --wall-seconds 20   --budget-seconds 1200 --max-matches 300 --final-reserve-seconds 180
```

Play the retained selected bot against the external friend later:

```bash
node tools/friendly.mjs pair --bot current --seeds friendly-001   --max-ticks 1000 --wall-seconds 60
```

No commit, push, or upload was performed. The preserved first victory remains available separately with `--bot first-victory`.

## Expanded strategy and self-play experiment

The new `strategy-bot` adds miners, guards, resource delivery, and target selection while preserving the original `policy-bot` and Gridmaster. Eight bounded integer parameters control specialist quotas, attacker design, miner cutoff/return load, threat radius, and target priorities. Role definitions, production ordering, action execution, and the C library's pathfinding are handwritten. Evolutionary search changes the parameters; it is not PPO or gradient-based reinforcement learning.

The bounded experiment in `logs/selfplay-verified` completed **72 real matches in about 226 seconds of active session time**, with a 500-tick game limit, 20-second individual watchdog, 600-second cumulative session budget, and 120-match cap. A deliberate four-match budget stop verified checkpoint recovery; resume reused that completed panel and cached binaries. All matches completed without execution failures, and layout/physical-side checks passed throughout. Both bots occupied both actual starting coordinates for every seed/opponent comparison.

The immutable opponent pool contained the frozen original policy, frozen Gridmaster, and frozen initial expanded strategy. One predeclared mutation was tested: guard quota 1 → 2 and attacker design Healthy → Armored. The other six parameters stayed fixed. Training used `sp-train-001,sp-train-002`; promotion used `sp-promote-001,sp-promote-002`; final testing used `sp-test-001,sp-test-002`. Final tests began only after selection was frozen.

| Stage | Incumbent fitness | Candidate fitness | Result |
| --- | ---: | ---: | --- |
| Training, 12 games each | 0.83333 | 0.95833 | Candidate reached promotion |
| Promotion, 12 games each | 0.83333 | 0.89583 | Rejected: one paired gain and one regression |
| Final test, 12 games each | 0.83333 | Not tested | Selected policy stayed identical to the initial expanded strategy |

The promotion delta was 0.0625 with approximate paired standard error 0.0877. The predeclared gate also required at least two paired gains and zero regressions, which the candidate failed. It was not retuned or evaluated on the final test set. Fitness separates combat outcomes, HP-based game-limit decisions, and random decisions; random winners receive neutral fitness. The candidate had two training game-limit wins and one promotion game-limit win; these were not counted as combat wins. No random decisions occurred in this experiment.

Selected-policy final results:

| Opponent | Combat wins | Combat losses | Game-limit/random decisions | Failures |
| --- | ---: | ---: | ---: | ---: |
| Frozen original policy | 4 | 0 | 0 | 0 |
| Frozen Gridmaster | 4 | 0 | 0 | 0 |
| Frozen initial expanded strategy | 2 | 2 | 0 | 0 |

This is evidence of stronger **local play from the new handwritten roles** against the two fixed references on these two held-out seeds. It is **not evidence of learned improvement**: no candidate was promoted and the exported parameters retain their human-chosen initial values. The old 0.50418 objective used a different opponent panel and a speed bonus, so it is not directly comparable to this new 0.83333 fitness. Two correlated seeds and a small reference pool cannot establish general strength or competition performance.

Actual selected-policy births across the 12 final games were 14 Light, 133 Healthy, 0 Armored, 12 Miner, and 14 Guard units. Against each fixed reference, each game produced one miner and one guard, with 1–2 Light and 11 Healthy attackers. Successful replay actions show miners delivering 35–70 gems per fixed-reference game and guards performing 14–19 attacks on enemy units. Gathering in these short games used loose piles; deposit mining is implemented and legality-tested but was not exercised in the final games. Simultaneous movement requests can still collide, and movement coordination is not learned.

Two additional real matches verified the freshly exported root executable against Gridmaster (`export-check-001`, both physical sides, same limits). Its bot logs print the expected embedded model SHA-256; both games completed successfully. The selected model/header and compact evidence are preserved under `bots/c/bot/strategy-bot/`, including `selfplay_results.json`. Large snapshot binaries, replays, and logs remain ignored. No commit, push, or submission was made.

The combined evaluator, legacy policy, and self-play suite passes **32 tests**, covering C inference/export parity over affordability/cooldown cases, legal designs and rule drift, gathering/return/defence execution, immutable snapshots, opponent selection, paired promotion, layout checks, neutral random decisions, and checkpoint restoration. The real four-match stop/resume additionally verifies recovery against the actual engine.

The representative selected-policy replay is published at `visualizer/public/replays/replay_latest.json` from `logs/evaluation-NDNUSq/0001/replay_latest.json`. Exact smoke, longer-run, resume, selected-policy evaluation, and replay commands are in [SELFPLAY_QUICKSTART.md](SELFPLAY_QUICKSTART.md). The available upstream setup guide was inspected; this separate local bot has not been packaged or approved for official competition deployment.

The sections below retain the earlier four-action bot's experiment history.

## Verification

The sequential mock-engine and C inference regression suite passes 22 tests:

```bash
node --test --test-concurrency=1 tools/evaluate.test.mjs tools/policy.test.mjs
```

Six real smoke matches used `eval-101`, three repetitions, and both bot assignments. All completed without failures. Every match placed team 418 at `(0,0)` and team 42 at `(19,19)`; team 418 won by combat at tick 164. Both assignments repeated the same winner, decision, tick, and layout hash. Logs: `logs/evaluation-8HbKlb`.

The updated shell runner also completed a real match with exit code 0 and published its replay (`logs/match-bDVuJiWW`). The selected-policy holdout replay was restored afterward for viewing.

The small training experiment tested two mutations on `train-001` and compared initial and selected policies on separate holdout seeds `eval-101,eval-102`. Both physical sides were tested for every seed, with a 1,000-tick game limit and 120-second watchdog. All 14 matches completed; layout checks passed across comparisons.

| Measurement | Initial | Selected |
| --- | ---: | ---: |
| Training score | 0.50418 | 0.50418 |
| Holdout score | 0.50418 | 0.50418 |
| Holdout wins | 2/4 | 2/4 |

Neither candidate improved the training score. The selected policy is identical to the initial policy. No learning improvement was found; the previous unexplained validation drop did not recur. Training logs: `logs/training-PoAABA`. Compact match evidence and binary hashes are preserved in `bots/c/bot/policy-bot/selected_policy_results.json`.

## Play, inspect, or resume

The portable model is `bots/c/bot/policy-bot/selected_policy.json`; its weights are embedded in `inc/policy_weights.h`. These files are source artifacts suitable for version control; binaries and logs remain ignored. No commit or upload was made.

Play the selected bot against Gridmaster:

```bash
bash tools/match.sh bots/c/bot/policy-bot bots/c/bot/gridmaster
```

The trainer already published a selected-policy holdout replay to `visualizer/public/replays/replay_latest.json`. The match command replaces it with the new match. To view it, run:

```bash
cd visualizer
npm run dev -- --host 0.0.0.0 --port 4242 --strictPort
```

Open the actual forwarded address from VS Code's Ports panel and refresh the visualizer. Standalone evaluation saves its replays inside its own log folder and does not publish them automatically.

To resume the search from the portable model:

```bash
node tools/train.mjs --from bots/c/bot/policy-bot/selected_policy.json \
  --iterations 2 --train-seeds train-001 --validation-seeds eval-101,eval-102 \
  --max-ticks 1000 --wall-seconds 120
```

Successful future training runs also export `selected_policy.json` automatically. Baseline bots remain available.

## Limits and next work

A subsequent evaluation of the unchanged selected policy added per-design spawn reporting (`logs/evaluation-XAZEw8`, seed `eval-101`, both team assignments, 1,000-tick limit). In each match the policy successfully spawned 15 Light units named `PolicyLight`, one Healthy unit named `PolicyHealthy`, and zero Armored units. Counts use unique authoritative replay unit IDs and exact component sets, not create requests or final survivors. All 23 regression tests passed after adding this reporting. The visualizer replay was updated to match `0001` from this evaluation.

Matching samples establish repeatability only for the tested configurations. The engine still randomly orders simultaneous CORE deaths and randomly breaks otherwise tied game-limit results. Timing failures and different standard-library implementations may also change behavior. The evaluator reports repetition consistency; a single match is not evidence of repeatability.

Replay tick 0 is recorded after the first turn. The layout fingerprint excludes spawned units and dynamic CORE state and cannot establish equality of all hidden initial engine state. It does verify the terrain and team positions relevant to the reported evaluation bug.

All tested games favored the top-left CORE and ended at tick 164. This small experiment does not establish why or prove that every map favors it. Movement is still a handwritten rush, and only the four-action attacker-design policy is learned. Investigating this positional behavior and adding meaningful strategy variation are the next useful steps before larger searches. This is a local preparation workspace; competition deployment rules remain unverified.

## Later handwritten tactical/carrier work

A separate `tactical-bot` was added after analyzing the new friend's 1–9 benchmark. This did not alter the trained strategy, its retained checkpoint, or the friend. Reference-only carrier ablation tied at 8–0 per variant; the predeclared tie rule kept carriers optional/off. After selection was locked, the tactical default scored 9–1 on the same five paired friend seeds (six combat wins and three game-limit wins), with no failures. A fresh four-game Gridmaster control was 4–0. Carrier-enabled reference replays demonstrate working miner handoffs and increased resource delivery, without an observed reference win benefit. These are handwritten logic changes, not learned-parameter improvement. Full evidence, limitations, and commands are in [TACTICAL_CARRIERS.md](TACTICAL_CARRIERS.md).
