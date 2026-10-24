# Evolution hour 001 review

Read-only audit of `logs/evolution-hour-001`, 2026-10-24. Only this review was written. No training, matches, builds, probes, gate changes, checkpoint edits, commits or pushes were performed.

## Evidence and accounting

Sources: `checkpoint.json` (`state.records`, `state.decisions`, `state.pending`, snapshot parameters), `summary.json`, all 395 evaluation manifests, all 395 `results.jsonl` files and all 790 per-game `result.json` files. Every artifact row equals its checkpoint row; manifest snapshot identities match checkpoint keys. All 11 recorded code/config/library/engine file hashes still match. Selection logic was read from `tools/evolution.mjs`, `tools/selfplay-core.mjs`, `tools/evolution-policy.mjs`, and the C policy/probe sources; none was executed.

The run ended paused, not at an iteration limit: `Wall budget reserve reached` at 12:04:51.803 UTC. Elapsed time is 3541.554 seconds of 3600; only 58.446 seconds remained, below the next two-game worst-case reservation of 60 seconds. Initial champion remains `e539c7dc8871fff608df8e7316c53b2d4f922456037956d3a7c6f0b23fbeb4bc`; promotions: zero.

| Quantity | Actual count |
|---|---:|
| Reserved match slots | 790 of 1600 |
| Completed games | 790 |
| Committed two-game seed/side pairs | 395 |
| Finalized candidate decision events | 24 (iterations 0–23) |
| Finalized decisions with full real-game evaluation | 18 |
| Finalized decisions skipped by synthetic effectiveness probe | 6 |
| Distinct candidate snapshots among finalized decisions | 22 |
| Distinct snapshots with finalized real-game evaluations | 17 |
| Pending candidate decisions | 1 (iteration 24) |
| Active/reserved but unfinished games | 0 |
| Missing initial validation games, not yet reserved | 10 |

“Candidate evaluation” is not an evaluation directory: each directory contains one two-game pair. Repeated snapshots can receive new iteration-specific seed panels. Iterations 5/22 reuse the same snapshot; iterations 4/7 also share a snapshot (first skipped, later evaluated relative to a different parent). Thus 24 decision events must not be reported as 24 completed game evaluations. Unused budget capacity (810 slots) is not reserved or pending work.

| Game outcome | Count |
|---|---:|
| Combat | 662 |
| HP tiebreak | 128 |
| Random tiebreak (timeout or combat) | 0 |
| Execution failure | 0 |

HP deaths split into 122 `TIMEOUT_CORE_HP` and 6 `TIMEOUT_UNIT_HP`. There is no `active_pair`, no `failed_pairs`, and no execution-failure error. These are physical game counts, not doubled participant counts.

## Every candidate decision

Iteration numbers below are checkpoint indices. Mutation values are relative to that candidate's parent; fitness compares against the incumbent champion, which may differ from the parent. “Ineffective” means zero action-trace changes in 1200 synthetic states, not proof of global behavioral equivalence. Training rejection means the required strict positive training delta was absent.

| Iteration | Snapshot prefix | Mutation | Changed probe states | Training delta | Disposition |
|---|---|---|---:|---:|---|
| 0 | `9d06d3fc16d2` | target_bias: 2 → 3 | 0 | — | Ineffective mutation; no games |
| 1 | `30daf90da318` | miners: 2 → 1 | 64 | -0.25 | Training rejection |
| 2 | `e6ee82a4565d` | return_load: 35 → 50 | 87 | -0.09375 | Training rejection |
| 3 | `e29b9a98eca3` | target_bias: 2 → 1 | 0 | — | Ineffective mutation; no games |
| 4 | `24effd33880c` | target_bias: 2 → 1 | 0 | — | Ineffective mutation; no games |
| 5 | `7443ad2efd54` | threat_radius: 12 → 13 | 13 | -0.078125 | Training rejection |
| 6 | `9e59cc4fc65c` | attack_commit: 0 → 1 | 0 | — | Ineffective mutation; no games |
| 7 | `24effd33880c` | return_load: 35 → 50 | 87 | -0.09375 | Training rejection |
| 8 | `cb108d8afae0` | economy_end: 400 → 300 | 21 | 0 | Training rejection |
| 9 | `eda87063c30b` | attacker_design: 1 → 2 | 454 | -0.203125 | Training rejection |
| 10 | `9e3f5144783e` | carriers: 0 → 1 | 378 | 0.21875 | Validation rejection |
| 11 | `3b02e7565ac2` | carrier_load: 35 → 20 | 134 | 0 | Training rejection |
| 12 | `58c2989462b3` | defense_gain: 1 → 0 | 74 | -0.0625 | Training rejection |
| 13 | `f00215e368bb` | guards: 2 → 3 | 154 | 0.078125 | Validation rejection |
| 14 | `ed64a890b423` | threat_radius: 12 → 11 | 20 | 0 | Training rejection |
| 15 | `78aa7524bff0` | attack_commit: 0 → 1 | 0 | — | Ineffective mutation; no games |
| 16 | `fb63b604bdd1` | carrier_load: 20 → 10 | 67 | 0 | Training rejection |
| 17 | `edb9f82529d2` | return_load: 35 → 20 | 174 | -0.125 | Training rejection |
| 18 | `665576f84dd9` | late_miners: 1 → 0 | 118 | 0 | Training rejection |
| 19 | `87bc3f2936ad` | guards: 2 → 1 | 136 | -0.078125 | Training rejection |
| 20 | `f49e47ecccad` | miners: 2 → 3 | 53 | 0.03125 | Validation rejection |
| 21 | `a06e8afd0d47` | target_bias: 2 → 3 | 0 | — | Ineffective mutation; no games |
| 22 | `7443ad2efd54` | threat_radius: 12 → 13 | 13 | 0.0625 | Validation rejection |
| 23 | `ceaac9423701` | avoid_weight: 16 → 8 | 219 | 0.0625 | Validation rejection |
| 24 | `c463a83741f8` | late_miners: 1 → 2 | 106 | 0.015625 | Insufficient evidence: validation incomplete |

Six finalized events were probe-skipped, thirteen rejected in training (including zero deltas), five rejected in validation. Eighteen finalized real-game evaluations used 18 × 32 training games plus 5 × 32 validation games = 736 games. Pending iteration 24 accounts for the remaining 54 games. No promotion-extra games occurred.

## Promotion validation and gates

Six candidate events reached promotion validation: 10, 13, 20, 22, 23 and pending 24. Five finished it. Each completed validation used four opponents, two seeds and two sides: 16 games each for incumbent and candidate. All five satisfy the opponent/seed minimum and have no execution failures.

| Iteration | Mutation | Validation delta | Paired gains / regressions | Failed gate conditions |
|---|---|---:|---:|---|
| 10 | carriers | 0.015625 | 2 / 2 | delta < 0.05; nonzero paired regressions; per-opponent regression: tactical-baseline |
| 13 | guards | 0.109375 | 2 / 1 | nonzero paired regressions |
| 20 | miners | 0.09375 | 3 / 3 | nonzero paired regressions |
| 22 | threat_radius | 0.03125 | 2 / 2 | delta < 0.05; nonzero paired regressions; per-opponent regression: tactical-baseline |
| 23 | avoid_weight | -0.140625 | 1 / 4 | delta < 0.05; fewer than 2 paired gains; nonzero paired regressions; per-opponent regression: tactical-baseline, initial-evolution |

The recorded paired standard errors are approximately 0.0981, 0.0883, 0.1138, 0.1043 and 0.0822 respectively. These are descriptive; statistical significance is not a gate. The rule is operational: delta ≥ 0.05, at least two paired improvements, zero paired regressions and zero opponent-average regressions, with at least two opponents and seeds. Every completed rejection has paired regressions, so none qualifies for the optional extra panel (requires nonnegative delta and zero paired regressions). Pending 24 has no gate result yet.

## Carrier mutations and selection exposure

Iteration 10 (`carriers` 0 → 1) spawned one candidate carrier in each of its 32 training/validation candidate games: 32 total. This was a real carrier experiment, rejected at validation.

Iterations 11 and 16 changed `carrier_load` 35 → 20 and 20 → 10 while retaining `carriers=0`. Each passed the synthetic probe (134 and 67 changed states), then played 16 candidate games and 16 incumbent control games. Candidate carrier spawns were zero in all 32 candidate games combined. In 12/16 candidate games per iteration neither side spawned a carrier; in the other four the tactical opponent spawned one. Incumbent control panels have the same carrier absence. Thus 64 real games were spent on these two comparisons, 48 with no carriers on either side.

Examples: iteration 11 candidate artifacts include `evaluation-N0YWNx` and `evaluation-Br7aT4`; iteration 16 includes `evaluation-ety90Y` and `evaluation-DNPTst`. The complete mapping is in checkpoint record keys (candidate, opponent, seed, ticks).

These games **did affect selection**: all committed rows enter training fitness, with no carrier-presence filter. Both comparisons scored delta zero and were rejected before validation. Rejected candidates can still enter the six-member novelty reservoir and become parents; rejection does not remove their parameters from the search. However, zero delta supplies no evidence that either carrier-load threshold improves actual carrier behavior.

The dependency is visible in C: `carrier_load` is read only in the own-unit `ROLE_CARRIER` branch, while production requires positive `evo.carriers`. The synthetic probe creates carrier-role units regardless of the production setting, so it can call a parameter effective in states never reached by this zero-carrier policy. Opponent carriers do not activate the candidate's own carrier branch.

## Limits on progress: measurements versus hypotheses

Measured:

- Gridmaster: 198/198 combat wins; linear-policy: 196/196 combat wins, counting both incumbent and candidate panels. These opponents consume 394/790 games while providing no positive score headroom. Both have fitness 1 everywhere observed.
- Tactical baseline: 200 games, 24 combat wins, 133 combat losses, 4 HP wins, 39 HP losses. Champion/self opponent: 196 games, 52 combat wins, 59 combat losses, 46 HP wins, 39 HP losses. Variation is concentrated in these two opponents.
- Fitness is combat win/loss = 1/0, HP win/loss = 0.75/0.25, random = 0.5. Improvements within the same outcome class are invisible. No random tiebreak influenced this run.
- Every mutation changes one parameter relative to its parent. Parents may be rejected reservoir members, so candidates can accumulate multiple differences from the champion; this is not a strictly one-coordinate search around the champion.
- Four target_bias events and two attack_commit events were skipped for zero probe changes. Source code still reads these parameters in tactical decisions; probe silence does not establish global irrelevance.
- The same threat_radius snapshot was training-rejected at iteration 5 (−0.078125), then passed training at 22 (+0.0625) on different seed panels, before validation rejection. Seed sensitivity is directly observed; it does not by itself prove an engine nondeterminism defect.
- Carrier-load dependency wasted real-game panels without activating the changed own-unit branch. Five completed validations all failed the zero-paired-regression condition, even when average delta was positive.

Hypotheses requiring another controlled experiment:

- A more challenging opponent mix could improve information per game; this audit does not establish a safe replacement panel or justify changing promotion gates.
- Joint carrier-count/load mutations or dependency-aware probes might reveal improvements missed by individual changes. No interaction effect was measured here.
- Coarse saturated scores, small panels and a strict no-regression rule may suppress useful tradeoffs. The observations do not demonstrate that any rejected candidate deserves promotion or that more training would succeed.

## Exact pending late_miners progress

Iteration 24 candidate `c463a83741f85a1ce34d46d427d25ea302f9ea50544fbf5ea4f08a30374e9198` is a built snapshot of the initial champion with only `late_miners` increased from 1 to 2. Its probe changed 106/1200 states.

Training is complete: 16 incumbent and 16 candidate games, seeds `evolution-hour-001-train-24-0` and `-1`, four opponents and both team slots. Incumbent fitness is 0.625; candidate 0.640625; delta +0.015625. The gain is one tactical loss changing from combat (0) to HP loss (0.25), spread over 16 games; all other paired training fitness values are equal. It cleared the strict-positive training condition, not the promotion threshold.

Promotion seeds are `evolution-hour-001-promotion-24-0` and `-1`:

| Side being evaluated | Opponent | Completed / required games |
|---|---|---:|
| Incumbent | All four opponents | 16 / 16 |
| Candidate | Tactical baseline | 4 / 4 |
| Candidate | Gridmaster | 2 / 4 (seed 0 only) |
| Candidate | linear-policy | 0 / 4 |
| Candidate | Initial champion | 0 / 4 |

Validation is 22/32 games complete; total work on this candidate is 54 games (27 pairs). All six available candidate validation games have the same paired fitness as their incumbent counterparts, so observed paired delta is zero over that subset. A full delta/gate cannot be computed from unequal partial panels. No match is in flight. Remaining pairs: candidate versus Gridmaster seed 1; linear-policy seeds 0/1; champion seeds 0/1, each in both team slots. No final test/report panel exists (`tests` is empty).

## Smallest justified next experiment (proposal only)

Complete those five missing pairs, preserving frozen snapshots, seeds, sides, scoring and gates. This resolves the already-open question with **10 additional games**, rather than starting another broad search. Do not interpret this proposal as authorization to resume this run.

Measured historical mean is 4.43918 seconds per game, implying about **44 seconds** of game execution plus runner/checkpoint overhead. The conservative wall cost is **300 seconds** at the configured 30 seconds per game; the existing 58.446-second remainder cannot fund all of it (and cannot fund even the next 60-second pair reservation). If a later execution is authorized, budget additional time accordingly, or use an isolated continuation that preserves the original evidence. No additional build is needed for these already-built snapshots.

If the completed initial validation fails with nonnegative delta and zero paired regressions, the unchanged runner can request one extra two-seed panel: **32 more games**, about **142 seconds** at the observed mean or **960 seconds** worst-case wall allowance. Thus resolving the initial missing evidence costs 10 games; allowing the entire conditional decision path costs up to 42 games (about 186 seconds measured-rate estimate; 1260 seconds worst-case). Current partial evidence cannot guarantee that extra validation will be unnecessary.
