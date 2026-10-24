# Independent benchmark of three frozen evolution policies

Fixed plan: [PLAN.md](logs/independent-evo-20261024T160826Z-5840825a3ad74ace/PLAN.md). Full machine-readable identities/parameters: [frozen-identities.json](logs/independent-evo-20261024T160826Z-5840825a3ad74ace/frozen-identities.json). Every result/replay and exact publication command: [REPLAY_INDEX.md](logs/independent-evo-20261024T160826Z-5840825a3ad74ace/REPLAY_INDEX.md). This is reporting-only: no training, policy tuning, promotion or opponent-pool update. These seeds are now a known benchmark.

Execution: 375.594 seconds (ceiling 2400), 60/60 recorded games, 60 completed, 0 failures/inconclusive; stop: All 60 scheduled games attempted. All 60 available replays retained.

## Frozen policies and environment

Snapshots were located in `logs/evolution-hour-002/snapshots/<id>`, verified against the checksummed checkpoint and copied with their existing binary before any outcome was observed. No working bot, pending candidate, export substitution or rebuild was used. Training was paused, PID/start identity dead, no owned processes/locks, and exclusive bind/close of port 4444 succeeded before execution.

**initial**: `e539c7dc8871fff608df8e7316c53b2d4f922456037956d3a7c6f0b23fbeb4bc`

Source SHA-256 `8b5b0981cb139d2ee4a13f136a0716c2ea470a7da95e709ba79b7ca8c1ffd4c4`; binary SHA-256 `6f567dcab745aec7d2f7333f9ff81996e3e54b3b0e67143a63e4839276822c5b`; model SHA-256 `a5674c18dc1399532c13714b0f907c04004446a9439f7227faadc461425e6cc1`.

```json
{
  "miners": 2,
  "guards": 2,
  "carriers": 0,
  "economy_end": 400,
  "late_miners": 1,
  "threat_radius": 12,
  "defense_gain": 1,
  "attack_commit": 0,
  "avoid_weight": 16,
  "return_load": 35,
  "carrier_load": 35,
  "resource_home": 2,
  "guard_radius": 12,
  "target_bias": 2,
  "attacker_design": 1
}
```

**first**: `f00215e368bb7a216dd382fa3decd17fe9e806e28c68f8ce503a08337bdd8129`

Source SHA-256 `fcc6ee6480c63923d32a4ffc5acf458a44b6d2f867fb573d18d35583da0dcc8b`; binary SHA-256 `2024101ce8737cc818d6a763de521c476c14e302bf662902becc9294497d6caf`; model SHA-256 `b65827e303c7a74dd98b547765221aa6b72606db90265dca2fa44a704a7f7c8e`.

```json
{
  "miners": 2,
  "guards": 3,
  "carriers": 0,
  "economy_end": 400,
  "late_miners": 1,
  "threat_radius": 12,
  "defense_gain": 1,
  "attack_commit": 0,
  "avoid_weight": 16,
  "return_load": 35,
  "carrier_load": 35,
  "resource_home": 2,
  "guard_radius": 12,
  "target_bias": 2,
  "attacker_design": 1
}
```

**latest**: `13ae14da4b8d3c0a13a5a77559155700dfeccace17e16939ad787f0d7eb3db38`

Source SHA-256 `7b199b4d2d9f12637dafcf4edeb1536f9e5a7d755d913e8b9d3131d7f44eb4fc`; binary SHA-256 `c51d815eca3210e7367de3fe293c75abfd1c7c15492555bc3449f1b7205d2a04`; model SHA-256 `06d9d3d631001e8253817f5886725433fb13674aa27479ea87050bf3151f95ab`.

```json
{
  "miners": 2,
  "guards": 3,
  "carriers": 1,
  "economy_end": 400,
  "late_miners": 1,
  "threat_radius": 12,
  "defense_gain": 1,
  "attack_commit": 0,
  "avoid_weight": 16,
  "return_load": 35,
  "carrier_load": 50,
  "resource_home": 2,
  "guard_radius": 12,
  "target_bias": 2,
  "attacker_design": 1
}
```

Current unchanged configuration: 1000 ticks, 30-second watchdog, serial games, no builds. Evaluator starts the server, waits for listening, then synchronizes each accepted team. Actual CORE locations and seed layouts were checked per pair and across comparisons. Base configuration differs per game only by injected seed and server timeout/replay paths. Execution file hashes:

| File | SHA-256 |
|---|---|
| `bots/configs/fake_demo/game.config.json` | `5a68e07dab6235844537b9ef0abdbe764561196646b3e8f892235fd6fedbfc1c` |
| `bots/configs/fake_demo/server.config.json` | `9f336d3870828bfcd6b2e8ad095271e0001f97e7d5482e802468f3ead2ef70e1` |
| `server/server` | `2f6d676e7d9c8800309df7b4982074c99cb773c39a342e15221dfdf7d352d9ba` |
| `bots/c/client_lib/core_lib.a` | `3639314b3bd52f10c332517fcfe2c5d1c6c7266fbf482b533953476cde14ecd0` |
| `tools/evaluate.mjs` | `aba78c7c42ceccb468d3aab3c7f5dbfd2edef4db5f7c519f2f25df5cb3790144` |
| `tools/selfplay-core.mjs` | `293a2c005522f68efd691fffdd17c6cf668433e908f5b595bca2891f2901b15e` |
| `tools/friendly.mjs` | `dccac3ca90f1b1d9ac1d70b6e50a981fbac7fbbb26daa6e00ebdb52168eff507` |

## Full-panel results

All W/L counts below are from policy A’s perspective. Random engine winners, if any, remain raw wins/losses and are reported separately; random fitness is always 0.5. Failures receive no win or fitness credit. Fitness is a distinct outcome-weighted metric, **not win rate**: combat W/L = 1/0; HP W/L = 0.75/0.25.

| A versus B | Completed | W–L | Win rate A | Fitness A / B | Combat W–L | HP W–L | Random W–L | Failures |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| latest vs initial | 20 | 20–0 | 100.0% | 0.962500 / 0.037500 | 17–0 | 3–0 | 0–0 | 0 |
| latest vs first | 20 | 19–1 | 95.0% | 0.887500 / 0.112500 | 14–1 | 5–0 | 0–0 | 0 |
| initial vs first | 20 | 3–17 | 15.0% | 0.262500 / 0.737500 | 2–7 | 1–10 | 0–0 | 0 |

## Seed-pair uncertainty

The independent unit is a seed pair, not an individual game: ten clusters per comparison, each containing both physical sides. Whole clusters were resampled 100,000 times (fixed PRNG seed 20261024) for percentile 95% bootstrap intervals. We also give distribution-free bounded Hoeffding intervals for seed-pair means (assuming independent sampled seeds). These are conservative and expose the uncertainty hidden by a degenerate bootstrap when every observed pair agrees. Exact two-sided sign tests use favorable/unfavorable **seed-pair mean fitness versus 0.5**, exclude ties, and receive Holm correction across all three comparisons. No normal/binomial interval treating 20 games as independent was used. These intervals are exploratory small-panel summaries, not universal-strength guarantees.

| Comparison | Seed pairs | Favorable / tied / unfavorable | Win-rate bootstrap 95% | Win-rate Hoeffding 95% | Fitness bootstrap 95% | Fitness Hoeffding 95% | Sign p / Holm p |
|---|---:|---:|---|---|---|---|---|
| latest-vs-initial | 10 | 10 / 0 / 0 | [1.0000, 1.0000] | [0.5705, 1.0000] | [0.9125, 1.0000] | [0.5330, 1.0000] | 0.001953 / 0.005859 |
| latest-vs-first | 10 | 9 / 0 / 1 | [0.8500, 1.0000] | [0.5205, 1.0000] | [0.7500, 0.9875] | [0.4580, 1.0000] | 0.021484 / 0.021484 |
| initial-vs-first | 10 | 0 / 2 / 8 | [0.0000, 0.3000] | [0.0000, 0.5795] | [0.1750, 0.3625] | [0.0000, 0.6920] | 0.007812 / 0.015625 |

## Results by physical starting side

The position is policy A’s actual initial CORE coordinate, rather than team ID alone.

| Comparison | A CORE | Games | A W–L | Combat / HP / random decisions | Fitness A |
|---|---|---:|---:|---:|---:|
| latest-vs-initial | (0,0) | 10 | 10–0 | 9 / 1 / 0 | 0.975000 |
| latest-vs-initial | (19,19) | 10 | 10–0 | 8 / 2 / 0 | 0.950000 |
| latest-vs-first | (0,0) | 10 | 10–0 | 7 / 3 / 0 | 0.925000 |
| latest-vs-first | (19,19) | 10 | 9–1 | 8 / 2 / 0 | 0.850000 |
| initial-vs-first | (0,0) | 10 | 3–7 | 4 / 6 / 0 | 0.400000 |
| initial-vs-first | (19,19) | 10 | 0–10 | 5 / 5 / 0 | 0.125000 |

## Results by seed

A-side outcomes below identify actual physical start and decision. Each mean uses the paired seed, not two independent observations.

### latest-vs-initial

| Seed | A on first scheduled side | A on reversed side | Pair win fraction | Pair fitness A |
|---|---|---|---:|---:|
| `independent-evo-20261024T160826Z-5840825a3ad74ace-01` | (19,19): win / combat (tick 904) | (0,0): win / combat (tick 676) | 1.00 | 1.0000 |
| `independent-evo-20261024T160826Z-5840825a3ad74ace-02` | (0,0): win / combat (tick 806) | (19,19): win / combat (tick 726) | 1.00 | 1.0000 |
| `independent-evo-20261024T160826Z-5840825a3ad74ace-03` | (0,0): win / combat (tick 685) | (19,19): win / combat (tick 650) | 1.00 | 1.0000 |
| `independent-evo-20261024T160826Z-5840825a3ad74ace-04` | (0,0): win / combat (tick 808) | (19,19): win / combat (tick 712) | 1.00 | 1.0000 |
| `independent-evo-20261024T160826Z-5840825a3ad74ace-05` | (0,0): win / combat (tick 912) | (19,19): win / combat (tick 525) | 1.00 | 1.0000 |
| `independent-evo-20261024T160826Z-5840825a3ad74ace-06` | (19,19): win / timeout_tiebreak (tick 1000) | (0,0): win / timeout_tiebreak (tick 1000) | 1.00 | 0.7500 |
| `independent-evo-20261024T160826Z-5840825a3ad74ace-07` | (0,0): win / combat (tick 769) | (19,19): win / timeout_tiebreak (tick 1000) | 1.00 | 0.8750 |
| `independent-evo-20261024T160826Z-5840825a3ad74ace-08` | (19,19): win / combat (tick 773) | (0,0): win / combat (tick 678) | 1.00 | 1.0000 |
| `independent-evo-20261024T160826Z-5840825a3ad74ace-09` | (0,0): win / combat (tick 981) | (19,19): win / combat (tick 527) | 1.00 | 1.0000 |
| `independent-evo-20261024T160826Z-5840825a3ad74ace-10` | (19,19): win / combat (tick 705) | (0,0): win / combat (tick 926) | 1.00 | 1.0000 |

### latest-vs-first

| Seed | A on first scheduled side | A on reversed side | Pair win fraction | Pair fitness A |
|---|---|---|---:|---:|
| `independent-evo-20261024T160826Z-5840825a3ad74ace-01` | (19,19): win / combat (tick 881) | (0,0): win / combat (tick 967) | 1.00 | 1.0000 |
| `independent-evo-20261024T160826Z-5840825a3ad74ace-02` | (0,0): win / timeout_tiebreak (tick 1000) | (19,19): loss / combat (tick 998) | 0.50 | 0.3750 |
| `independent-evo-20261024T160826Z-5840825a3ad74ace-03` | (0,0): win / timeout_tiebreak (tick 1000) | (19,19): win / combat (tick 557) | 1.00 | 0.8750 |
| `independent-evo-20261024T160826Z-5840825a3ad74ace-04` | (0,0): win / combat (tick 727) | (19,19): win / combat (tick 674) | 1.00 | 1.0000 |
| `independent-evo-20261024T160826Z-5840825a3ad74ace-05` | (0,0): win / timeout_tiebreak (tick 1000) | (19,19): win / timeout_tiebreak (tick 1000) | 1.00 | 0.7500 |
| `independent-evo-20261024T160826Z-5840825a3ad74ace-06` | (19,19): win / combat (tick 932) | (0,0): win / combat (tick 960) | 1.00 | 1.0000 |
| `independent-evo-20261024T160826Z-5840825a3ad74ace-07` | (0,0): win / combat (tick 620) | (19,19): win / combat (tick 728) | 1.00 | 1.0000 |
| `independent-evo-20261024T160826Z-5840825a3ad74ace-08` | (19,19): win / timeout_tiebreak (tick 1000) | (0,0): win / combat (tick 862) | 1.00 | 0.8750 |
| `independent-evo-20261024T160826Z-5840825a3ad74ace-09` | (0,0): win / combat (tick 970) | (19,19): win / combat (tick 885) | 1.00 | 1.0000 |
| `independent-evo-20261024T160826Z-5840825a3ad74ace-10` | (19,19): win / combat (tick 777) | (0,0): win / combat (tick 909) | 1.00 | 1.0000 |

### initial-vs-first

| Seed | A on first scheduled side | A on reversed side | Pair win fraction | Pair fitness A |
|---|---|---|---:|---:|
| `independent-evo-20261024T160826Z-5840825a3ad74ace-01` | (19,19): loss / combat (tick 916) | (0,0): win / combat (tick 565) | 0.50 | 0.5000 |
| `independent-evo-20261024T160826Z-5840825a3ad74ace-02` | (0,0): loss / combat (tick 693) | (19,19): loss / timeout_tiebreak (tick 1000) | 0.00 | 0.1250 |
| `independent-evo-20261024T160826Z-5840825a3ad74ace-03` | (0,0): win / combat (tick 697) | (19,19): loss / combat (tick 770) | 0.50 | 0.5000 |
| `independent-evo-20261024T160826Z-5840825a3ad74ace-04` | (0,0): win / timeout_tiebreak (tick 1000) | (19,19): loss / combat (tick 715) | 0.50 | 0.3750 |
| `independent-evo-20261024T160826Z-5840825a3ad74ace-05` | (0,0): loss / timeout_tiebreak (tick 1000) | (19,19): loss / timeout_tiebreak (tick 1000) | 0.00 | 0.2500 |
| `independent-evo-20261024T160826Z-5840825a3ad74ace-06` | (19,19): loss / timeout_tiebreak (tick 1000) | (0,0): loss / timeout_tiebreak (tick 1000) | 0.00 | 0.2500 |
| `independent-evo-20261024T160826Z-5840825a3ad74ace-07` | (0,0): loss / combat (tick 974) | (19,19): loss / combat (tick 896) | 0.00 | 0.0000 |
| `independent-evo-20261024T160826Z-5840825a3ad74ace-08` | (19,19): loss / timeout_tiebreak (tick 1000) | (0,0): loss / timeout_tiebreak (tick 1000) | 0.00 | 0.2500 |
| `independent-evo-20261024T160826Z-5840825a3ad74ace-09` | (0,0): loss / timeout_tiebreak (tick 1000) | (19,19): loss / combat (tick 994) | 0.00 | 0.1250 |
| `independent-evo-20261024T160826Z-5840825a3ad74ace-10` | (19,19): loss / timeout_tiebreak (tick 1000) | (0,0): loss / timeout_tiebreak (tick 1000) | 0.00 | 0.2500 |

## Interpretation and limits

The latest champion outperformed both earlier policies descriptively on this fixed unseen panel. The seed-level sign evidence also survives Holm correction for both direct comparisons. The two direct latest matchups share the same ten seeds, so their combined 40 games must not be represented as 40 independent samples. Three policies, ten sampled maps, one execution per physical side, known ancestral opponents and one unchanged game configuration limit generalization. These results do not establish performance against other opponents or eliminate runtime/game randomness. No policy was selected or changed from these results, and they are excluded from training, promotion and opponent pools. The seeds are now known benchmarks and must not be called unseen in future use.

## Replay publication and selected examples

The published replay is **the latest champion’s first scheduled match**, regardless of result, rather than a selected highlight. The prior display was copied before execution and the publication helper made another backup. Publication hashes/paths are in `publication.json`. Selected examples in REPLAY_INDEX.md are explicitly **not representative performance evidence**; every benchmark replay remains available. No extra games were played to obtain examples.

- **Selected example — Latest champion combat win:** match 01, latest wins via combat, final tick 904.
- **Selected example — Latest champion loss:** match 24, first wins via combat, final tick 998.
- **Selected example — HP tiebreak match:** match 11, latest wins via timeout_tiebreak, final tick 1000.
- **Selected example — Latest champion versus first promoted champion:** match 21, latest wins via combat, final tick 881.

## Verification and preservation

An independent pass read every evaluator JSONL row, per-game result, replay seed/winner/final tick, manifest binary hash and generated game/server configuration. All 60 rows and replays agree. Ten distinct seed layouts were reproduced across all three comparisons; both actual physical sides were verified per seed pair. Total decisions: **41 combat, 19 HP tiebreak, zero random, zero execution failures**. Each seed pair was attempted once; no extra matches or retries were run.

All **10,277 protected pre-existing files** were hash-checked unchanged, including playable/friend bots, tools, all hour-002 checkpoint/snapshot/results files and preserved evidence. The pre-execution plan/identity seal is unchanged. The training checkpoint remains paused and byte-identical; benchmark outcomes were not written into its decisions, promotion history or opponent pool. Existing exports were never output destinations and no builds were performed. Port 4444 is free and benchmark locks were removed after completion.

The earlier displayed replay is preserved at `displayed-before.json` and `displayed-publication-backup.json`; the helper's original backup is also retained at the path in `publication.json`. The displayed replay SHA-256 matches scheduled match 01, latest versus initial, seed 01, latest starting at **(19,19)**: combat win, final tick **904**. This display choice was fixed before results.

`verification.json`, `game-config-hashes.json`, `pre-execution-seal.json`, `protected-before.json` and `evidence-sha256.json` supply audit digests. Full copied evaluator/helper/configuration/engine/library evidence is under `environment/`; policy files and original snapshot records are under `policies/`. The original stopped training checkpoint/summary/owner/protocol copies are included. `seed-novelty.json` and `seed-archive-novelty.json` record no prior seed collisions, including archived textual panels. `KNOWN_BENCHMARK_SEEDS.json` marks this panel as known for subsequent use.

Exact commands to view the currently published first scheduled match:

```bash
cd /workspaces/monorepo
node tools/friendly.mjs publish logs/independent-evo-20261024T160826Z-5840825a3ad74ace/evaluation-ly9l4b/0001/replay_latest.json
cd visualizer
npm run dev -- --host 0.0.0.0 --port 4242 --strictPort
```

Open the forwarded port 4242, usually `http://localhost:4242`. If the viewer is already running, refresh it instead of starting another instance. To view another saved game, use its exact publication command in REPLAY_INDEX.md and refresh. No commit or push was performed.
