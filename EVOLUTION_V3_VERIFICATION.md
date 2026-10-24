# Evolution V3 verification — 2026-10-24

V3 expands handwritten behavior/design choices available to standalone local evolution. No learned improvement is claimed. Read [EVOLUTION_V3_QUICKSTART.md](EVOLUTION_V3_QUICKSTART.md) for complete mechanics, schema, protocol, compatibility, backup requirements and exact HOST-terminal start/status/stop/resume/export commands. The one-hour experiment was **not launched**.

## Inspection and preservation

No applicable AGENTS.md was found in the parent/workspace search. LOCAL_EVOLUTION.md, actual trainer/identity/checkpoint code, original bot sources, current training records and the independent benchmark report were read before editing. Training was paused, its PID/start identity dead with no owned children, locks absent, and port 4444 exclusively bound/closed successfully before games. The frozen champion was verified from actual hour-002 snapshot records; no pending candidate or working source was substituted.

The exact champion `13ae14da4b8d3c0a13a5a77559155700dfeccace17e16939ad787f0d7eb3db38` is preserved under `preserved/evolution-v3-baseline-13ae14da4b8d/`, including source, parameters, original executable, build evidence and a per-file seal. V3 pins its source/model/binary digests; files/directories were made read-only. Baseline source SHA-256 `7b199b4d2d9f12637dafcf4edeb1536f9e5a7d755d913e8b9d3131d7f44eb4fc`, binary `c51d815eca3210e7367de3fe293c75abfd1c7c15492555bc3449f1b7205d2a04`, model `06d9d3d631001e8253817f5886725433fb13674aa27479ea87050bf3151f95ab`.

V2 files/checkpoints remain unchanged. The new bot is `bots/c/bot/evolution-v3-bot/`; V3 trainer/core/policy/probe have separate filenames. No historical checkpoint was migrated, re-signed, reset or edited. A new version-3 work directory `logs/evolution-v3-ready-20261024/` was initialized via `--from-champion` with a one-slot cap, paused with **0 reservations and 0 real games**. Its 19-field initial model has disabled new features, preserves the champion’s 15 parameters and records source-model provenance.

## Changes and actual properties

Server CreateAction and ComponentLogic allow additive repeated components up to five; armor count ≤4. The active rule requires base action cooldown ≥ sum of attack damages. AttackAction uses orthogonal distance ≤1, appropriate object-type damage and rounded armor reduction with minimum one for positive attacks. Moves require an empty orthogonal neighbor and ready cooldown. Unit cooldown is max(1, base + floor(cargo/gemsPerCooldownStep)). StateEncoder sends all visible object properties, cargo, names, components and positions to both players; no additional private state or future intent is accessed.

| Design | Actual components | Cost | HP | Armor | Unit damage | Base cooldown | Hits to defeat at damage 3 |
|---|---|---:|---:|---:|---:|---:|---:|
| Existing guard | unit_attack, health | 47 | 8 | 0% | 3 | 3 | 3 |
| High HP | unit_attack, health ×3 | 71 | 14 | 0% | 3 | 3 | 5 |
| Armored | unit_attack, health, armor ×3 | 137 | 8 | 60% | 3 | 3 | 8 |
| Hunter | unit_attack, health ×2 | 59 | 11 | 0% | 3 | 3 | 4 |

All have zero CORE/object damage, 100 capacity, 10 gems per cooldown step and 10 post-spawn CORE cooldown. Armor 60% reduces a 3-damage hit to 1; it does not prevent damage. The less useful 77-gem/20%-armor choice was replaced **before smoke execution**, based on derived cost/hit comparisons, not match outcomes. No rule, legality condition or promotion gate was changed.

Existing guards were already moving interceptors: the oldest is leashed, others can chase globally. V3 adds a separately enabled all-defender home leash, reachable attack-position selection, CORE-threat prioritization, re-evaluation/repositioning and return-home behavior. Combat-only units conservatively path through currently empty cells; walls/deposits/cores and other occupied tiles are not treated as removable.

Hunters use own-unit role tags, but enemy economic targets are identified by observed mining damage or unarmed cargo/carry properties, never names alone. Pursuit path/origin radius is configurable; a 60-tick chase expires into 30 ticks of fallback. Enemy combat danger within two tiles is avoided; threatened hunters take a legal lower-risk step or wait. Fallback escorts a reachable forward own CORE attacker or returns to the home-anchor task.

Four new fields: `defense_mode` 0–1 (default 0), `defender_design` 0–2 (default 0, inactive with defense off), `hunter_quota` 0–2 (default 0), `hunter_pursuit` 4–16 (default 8, inactive with no hunters). Existing `guard_radius` is reused for the defender leash. Full 19-field ranges/defaults and all frozen smoke parameters are in the quickstart and PLAN.json. Mutation retains single/coupled proposals, activates coupled dependencies and skips inactive-only changes.

Protocol/schema/state version 3 rejects historical checkpoint versions and incompatible code/compiler/config/library/engine/snapshots. Only parameter import into a NEW run is offered. The unchanged fitness/gate implementation is reused; immutable old champion and frozen tactical/historical opponents remain in selection, and weak references remain mandatory promotion checks. Atomic checksums, interruption recovery, watchdogs, cumulative/invocation limits and standalone C export are retained.

## Focused and regression tests

**64 passed, zero failed** in the final relevant suite (`logs/evolution-v3-validation-20261024/regression-final-checked-worlds.log`). Eight V3 tests cover:

- Active-rule legality, repeated-health/armor properties and invalid fast/double-attack combinations.
- Exact budget edges 47/71/137/59, cooldown masks and 1,000-world JS/exported-C production parity. Those tests caught a stale generated C price during development; the final price is generated from the same cost catalog and all parity checks pass.
- Defender interception, priority, enclosed/unreachable targets, adjacency, target switching, return-home/leash and path constraints.
- Property-based miner/carrier recognition with misleading enemy names, bounded pursuit, timeout, escort/home fallback and actual legal retreat steps.
- New active-field C action effects and inactive-role skips before compilation/game panels.
- New-schema validation, deterministic RNG/checksums, explicit new-run champion import, compatible no-game resume, standalone export/build and refusal to overwrite an export.
- Cached interrupted V3 validation/resume under finish-pending, without another candidate/RNG draw. Cached rows are unit-test fixtures, not real match evidence.

Disabled-feature equivalence: **2,400 identical synthetic worlds, zero changed action traces** between the immutable champion source and V3 with disabled new fields. Every creation component, attack/transfer/move, travel destination and all 400 tile callback outputs were compared. Both trace SHA-256 digests: `f66829c77310a9b7409609b7f7dd5a3554ea1a6e7814d5b412cfb10da2bfe839`. Evidence: `logs/evolution-v3-validation-20261024/disabled-equivalence.json`. This is measured source/action equivalence over the suite, not exhaustive proof or identical binary claims.

## Fixed bounded smoke

Plan: `logs/evolution-v3-smoke-20261024/PLAN.json` and PLAN.md, sealed with all five source/model/binary identities **before any real match**. Three fixed experimental variants × two frozen opponents × two fresh seeds × both physical sides = **24 games**. No variants were selected or tuned from outcomes. Schedule: intercept, high-hp-hunter, armored-hunter; within each, champion then tactical; seed 01 then 02; A team 42 then 418. Ticks 1000, watchdog 30 seconds, serial unchanged evaluator/startup synchronization and pair/cross-panel physical-layout assertions.

Fresh seeds:

- `evo-v3-smoke-225771d29a8f097cb7d068a0-01`
- `evo-v3-smoke-225771d29a8f097cb7d068a0-02`

Seed prefix was searched against existing logs/preserved/bot/tool records before the plan. No known independent benchmark seed was used. All smoke seeds are now known implementation-check seeds, not unseen future evidence.

Execution: **163.613 seconds**, below the 600-second match-execution ceiling. **24/24 completed**, zero execution failures/inconclusive games, no retries, all 24 replays retained. Stop: All 24 scheduled games attempted. Total **11 combat, 13 HP tiebreak, zero random** decisions.

All results below are from the experimental version’s perspective. Fitness is the existing separate weighted metric (combat W/L 1/0, HP W/L .75/.25, random .5), **not win rate**.

| Experimental | Frozen opponent | W–L | Combat W–L | HP W–L | Random | Execution failures | Fitness |
|---|---|---:|---:|---:|---:|---:|---:|
| intercept | champion | 4–0 | 1–0 | 3–0 | 0 | 0 | 0.8125 |
| intercept | tactical | 4–0 | 4–0 | 0–0 | 0 | 0 | 1.0000 |
| high-hp-hunter | champion | 2–2 | 0–1 | 2–1 | 0 | 0 | 0.4375 |
| high-hp-hunter | tactical | 4–0 | 1–0 | 3–0 | 0 | 0 | 0.8125 |
| armored-hunter | champion | 1–3 | 0–1 | 1–2 | 0 | 0 | 0.3125 |
| armored-hunter | tactical | 0–4 | 0–3 | 0–1 | 0 | 0 | 0.0625 |

All policy IDs/parameters/hashes are in `frozen-policies.json` and the immutable plan; all raw rows, per-game configs/logs/replays remain. `REPLAY_INDEX.md` lists every game’s policy identities, seed, actual physical starting positions/team IDs, result, final tick, replay path and exact HOST publication command.

## Diagnostic revision after smoke

The final review found quota-dependent world construction in the first synthetic probe. It was corrected to compare identical observed worlds regardless of parameters, and the helper now rejects differing per-world signatures before counting effects. The final 64-test suite also checks those signatures for each new-field change; disabled-feature traces still match in all 2,400 worlds. This correction changed **only diagnostic construction/checking**, not the C gameplay, any frozen smoke binary/parameters, evaluator, config, seeds, opponents, scoring or gates. No additional real games were run.

Executed smoke tool copies and old hashes remain in `logs/evolution-v3-smoke-20261024/executed-tools/`; `probe-revision.json` records executed/final identities. The earlier zero-game `logs/evolution-v3-initialized-20261024/` remains unchanged and intentionally fails final compatibility. `logs/evolution-v3-ready-20261024/` is a fresh zero-game initialization under the final identity. There was no migration or manual checksum edit. A final standalone export at `logs/evolution-v3-final-export-20261024/` compiled successfully from that compatible ready run.

## Observed role execution

Real engine births confirmed all proposed designs and their exact HP/armor/cooldown properties: **63 existing guards, 54 high-HP defenders, 34 armored defenders and 18 hunters** (8 in high-hp-hunter, 10 in armored-hunter; replacement births count separately). Replay object properties match the active catalog. No inference from create requests alone was used.

Successful replay actions contain **45 hunter attacks** in high-hp-hunter and **22** in armored-hunter against economically classified enemy units, plus 1,845/1,395 hunter movement actions respectively. ReplayEncoder excludes failed actions before recording them; counts are attacks, not kills or causal win attribution. All observed living non-hunter defenders stayed at home distance ≤12, matching the configured leash. `behavior-observations.json` contains this reconstruction; `summary.json` records births/properties.

## Replay display and limits

The first scheduled completed match is published **regardless of outcome**. It was not selected as a highlight. The previous display is retained both in `displayed-before.json` and `displayed-publication-backup.json`; publication.json also identifies the helper’s original backup.

First-match exact HOST command:

```bash
docker exec -w /workspaces/monorepo 8c5465c61af5 node tools/friendly.mjs publish logs/evolution-v3-smoke-20261024/evaluation-VLfNEi/0001/replay_latest.json
```

If the viewer is stopped:

```bash
docker exec -it -w /workspaces/monorepo/visualizer 8c5465c61af5 npm run dev -- --host 0.0.0.0 --port 4242 --strictPort
```

Open forwarded port 4242; otherwise refresh an existing viewer. The next one-hour start command is in EVOLUTION_V3_QUICKSTART.md. It was not executed.

These are implementation checks on only two shared maps and two ancestral opponents, not independent proof of strength. Intercept won 8/8 here, high-hp-hunter 6/8, armored-hunter 1/8; **no version was adopted/promoted from those results**. The bundled role/design changes and different surviving match lengths do not isolate causes. Expensive armor and defense quotas may delay offense, but that causal explanation remains a hypothesis.

Conservative empty-cell reachability can miss routes through breakable piles or temporarily occupied cells. Interception is reactive and can be bypassed. Hunters are slower than fast empty carriers, avoid any nearby fighter conservatively, and depend on escorts to reach distant economies. Own role tagging uses an own name plus combat property; enemy targeting uses properties. Fixed 60/30-tick pursuit limits and two-tile risk neighborhoods are deliberately not extra search dimensions. Disabled equivalence is synthetic and not exhaustive. No hidden information, healing, taunt or automatic CORE protection exists. Compatibility is strict across environments; keep exact tools/baseline/config/binaries and use new-run parameter import on changed machines. Synchronous compiles/cleanup may extend nominal invocation wall deadlines.

Final preservation/compatibility/cleanup checks are recorded in `logs/evolution-v3-validation-20261024/preservation-after.json`. The original training, benchmark, friendly, export and snapshot evidence was not modified. No commit or push was made.

## Final preservation and ready state

Final verification hash-checked **24,112 pre-existing files unchanged**, including all prior bot sources/binaries, friendly bots, checkpoints, snapshots, exports, independent benchmark evidence and replays. All 24 smoke result JSON/JSONL rows agree with replay seeds, winners and final ticks; actual born components/properties match the catalog. Every generated game/server configuration differs only by the predeclared seed, timeout and replay path. The fixed-plan seal and all frozen gameplay source/binary hashes remain valid. The two changed diagnostic helper identities are explicitly archived and documented; no historical checksum was changed.

`logs/evolution-v3-ready-20261024/` matches the final trainer identity and remains paused with zero reserved/completed games. The original V2 hour-002 checkpoint still matches its original trainer identity and remains paused. The earlier V3 initialization deliberately fails final identity compatibility and was preserved rather than migrated. Final source/export compilation succeeded at `logs/evolution-v3-final-export-20261024/`.

Raw disabled-mode comparison traces are retained at `logs/evolution-v3-validation-20261024/disabled-equivalence-{legacy,v3}.trace`. There are no active trainer children or game/training locks; port 4444 is free. `logs/evolution-v3-hour-001` does not exist: the next one-hour command is documentation only. Full checks are in preservation-after.json and final-identity.json. All 24 smoke replays are retained; replay index commands target the existing container from the HOST terminal. The host Docker daemon was not reachable from inside the container, so the equivalent inner Node/make paths were exercised directly and the observed hostname `8c5465c61af5` is used in the documented Docker commands.
