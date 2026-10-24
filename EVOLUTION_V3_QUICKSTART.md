# CORE Evolution V3 quickstart

V3 is a separate, experimental, standalone Node/C evolutionary trainer. It uses local CPU/game sockets, no tokens, LLM, API keys, network model or downloads. The handwritten policy extensions are new search choices, not learned improvement. The one-hour run below has **not** been launched.

## Files and preserved baseline

- CLI: `tools/evolution-v3.mjs`; checkpoint/build/probe helper: `tools/evolution-v3-core.mjs`; schema/mutation/export: `tools/evolution-v3-policy.mjs`; full-action probe: `tools/evolution-v3-probe.c`.
- Experimental C source: `bots/c/bot/evolution-v3-bot/`. `inc/v3_behaviors.h` is included in every C export.
- Immutable previous champion: `preserved/evolution-v3-baseline-13ae14da4b8d/`, copied from the exact `logs/evolution-hour-002/snapshots/13ae14da4b8d3c0a13a5a77559155700dfeccace17e16939ad787f0d7eb3db38/`. Its exact source, 15 parameters, original executable, build evidence and per-file seal are retained; directories/files were made read-only. V3 pins the ID, source, binary and model digests and checks every sealed file.
- V2 entry points and playable/friendly bots remain unchanged. Historical checkpoints, exports, benchmark files and replays are preserved. Do not run V3 against their work directories.
- `logs/evolution-v3-ready-20261024/` demonstrates new-protocol initialization from the champion with **zero real matches**. It is paused under a one-slot invocation cap; the recommended experiment uses a fresh work directory.

Source digest of the baseline: `7b199b4d2d9f12637dafcf4edeb1536f9e5a7d755d913e8b9d3131d7f44eb4fc`; binary: `c51d815eca3210e7367de3fe293c75abfd1c7c15492555bc3449f1b7205d2a04`; model: `06d9d3d631001e8253817f5886725433fb13674aa27479ea87050bf3151f95ab`.

## Actual mechanics and designs

Active rules: `bots/configs/fake_demo/game.config.json`, `server/src/action/{CreateAction,AttackAction,MoveAction}.cpp`, `server/src/utils/ComponentLogic.cpp`, `server/src/object/Unit.cpp`, `server/src/game/StateEncoder.cpp`, and the C client header/pathfinder. Repeated components add their properties/costs. Maximum five components; maximum four armor components; base action cooldown must be at least the sum of unit/core/object damage. Speed plus unit_attack is illegal here. No rule was changed.

| Design | Components | Gems | HP | Armor | Damage to units | Hits to defeat from repeated 3-damage attacks |
|---|---|---:|---:|---:|---:|---:|
| Existing guard | unit_attack + health | 47 | 8 | 0% | 3 | 3 |
| High HP | unit_attack + health ×3 | 71 | 14 | 0% | 3 | 5 |
| Armored | unit_attack + health + armor ×3 | 137 | 8 | 60% | 3 | 8 |
| Hunter (fixed design) | unit_attack + health ×2 | 59 | 11 | 0% | 3 | 4 |

Every design has base action cooldown **3**, carry capacity **100**, gems-per-cooldown-step **10**, post-spawn CORE cooldown **10**, and **zero CORE/object damage**. Attacks and moves have Manhattan range one, only when cooldown ≤0; move destinations must be empty. Actual cooldown is max(1, base + floor(cargo/step)); cargo slows all actions, not only movement. Damage uses rounded percentage reduction, minimum one for positive attacks: the armored design receives **1** from damage 3. Armor is not invulnerability. The 137-gem option fits the initial 300-gem bank, but is intentionally expensive; affordability masks wait rather than issue an invalid spawn or silently downgrade.

The older 77-gem, 20%-armor option receives 2 damage from damage 3 and offers a poor cost/survival alternative to the high-HP design; V3 uses the distinct 60%-armor option. These properties were derived before smoke games, not tuned from outcomes. No blocking, taunting, healing, automatic protection, ranged combat or one-hit defender is assumed.

## Behavior and compact parameters

The existing champion already has moving interception: its oldest guard is a home goalie, other guards can chase globally or approach the enemy CORE. V3 preserves that entire branch in disabled mode.

With `defense_mode=1`, all guard designs stay responsible for the home area. They prioritize reachable CORE-damaging enemies, find an actually reachable empty orthogonal attack position, attack only adjacent units with positive damage, and re-evaluate every ready tick. All pursuit paths stay within the existing `guard_radius` home leash; guards already outside return to an accessible home anchor. With no target they reposition near home rather than chase globally. Occupied cells, walls, deposits and loose piles are conservatively excluded from the new combat pathfinder; combat-only designs cannot remove walls/deposits/cores. This can be conservative or cause congestion. No interception guarantee is claimed against moving targets.

Hunters are optional and separately counted, produced after miner/guard/carrier requirements, before an additional CORE attacker. Their fixed unit-combat design has two health components. Own hunters are recognized by their own creation tag plus unit-combat property; **enemy names are never used for economic identification**. Enemy mining is recognized by damageObject, carriers by unarmed cargo/carry-efficiency/capacity properties. The active API sends both teams' object locations, HP, team, cargo, cooldown, components and properties; V3 uses only this observed state, not future intentions or hidden data.

Economic pursuits require a safe reachable attack position, at most `hunter_pursuit` path steps, and remain within that distance of the engagement origin. They expire after **60 ticks**, followed by **30 ticks** of fallback. Hunters avoid any enemy unit fighter within distance two of a target/path; when already threatened they take a legal empty step reducing observed threat exposure, otherwise wait. They escort a reachable advancing own CORE attacker when no safe economic target is eligible, or perform the existing home-anchor task when no escort exists. They cannot damage the enemy CORE. Fast carriers can outrun them.

Four fields extend the existing 15-field space:

| New field | Range; default | Dependency/effect |
|---|---|---|
| `defense_mode` | 0–1; 0 | 0 uses the original guard behavior/design; 1 enables home-leashed interception. |
| `defender_design` | 0–2; 0 | Existing/high-HP/armored; inactive at defense_mode=0. |
| `hunter_quota` | 0–2; 0 | Optional living hunter target; zero produces no hunter and disables hunter recognition. |
| `hunter_pursuit` | 4–16; 8 | Economic chase path/origin bound; inactive at hunter_quota=0. |

Full V3 schema (default legacy parameters match the frozen champion):

| Parameter | Range | Default |
|---|---:|---:|
| `miners` | 1–4 | 2 |
| `guards` | 1–5 | 3 |
| `carriers` | 0–2 | 1 |
| `economy_end` | 100–800 | 400 |
| `late_miners` | 0–3 | 1 |
| `threat_radius` | 4–16 | 12 |
| `defense_gain` | 0–2 | 1 |
| `attack_commit` | 0–5 | 0 |
| `avoid_weight` | 0–32 | 16 |
| `return_load` | 10–100 | 35 |
| `carrier_load` | 10–100 | 50 |
| `resource_home` | 0–4 | 2 |
| `guard_radius` | 3–16 | 12 |
| `target_bias` | 0–3 | 2 |
| `attacker_design` | 0–2 | 1 |
| `defense_mode` | 0–1 | 0 |
| `defender_design` | 0–2 | 0 |
| `hunter_quota` | 0–2 | 0 |
| `hunter_pursuit` | 4–16 | 8 |

Inactive-only changes to defender_design with defense off, hunter_pursuit with no hunters, or carrier_load with no carriers skip real panels. Remaining candidates use 2,400 full C action counterfactuals; probes hash every creation component, movement/attack/transfer and tile callback, not just the first component. Counterfactual observed worlds are parameter-independent and the helper rejects mismatched per-world signatures before comparing action traces. Synthetic role-effect screening is not evidence of win improvement.

Mutation remains 70% single and 30% coupled proposals. Coupled groups include defense_mode/design, hunter_quota/pursuit, carriers/load, miners/economy_end and guards/defense_gain. Coupled role proposals activate their dependency when necessary. Zero hunters remains searchable. The four new defaults are disabled: a 2,400-world comparison against the exact previous champion source found zero action differences, including component lists and all tile callbacks.

## V3 selection and compatibility

Protocol/schema/state version **3** is recorded before games. Training includes the exact frozen tactical baseline, immutable V2 champion and current/historical V3 policies; frozen Gridmaster and linear-policy still return before every promotion. Candidate/incumbent share stage seeds, both real starting sides and layout validation. The independent benchmark's known seeds are never imported.

Fitness and promotion gates are unchanged: combat 1/0, HP tiebreak 0.75/0.25, random 0.5; failures do not score. Training delta must be >0. Promotion still needs ≥2 opponents/seeds, delta ≥0.05, ≥2 paired gains, zero paired regressions and no opponent-average regression. Only the existing nonnegative/no-regression borderline case gets one pooled extra validation panel. Smoke results do not enter any of those decisions.

V3 will reject old checkpoint versions/identities; there is no compatibility migration or checksum editing. `--from-champion` explicitly verifies and copies only the frozen champion's parameters into a **new** 19-field model, appending disabled defaults. `--from` accepts an already valid V3 model JSON, only on new starts. A V2 parameter file is not silently accepted as V3.

All original lifecycle/resource features remain: cumulative wall/slot/iteration limits, invocation `--additional-seconds`/`--additional-matches`, finish-pending boundary, deterministic RNG, saved pending work, atomic checksums/previous copy, exact code/compiler/config/library/engine/snapshot verification, watchdogs, owned-process recovery and replay retention. An interrupted pair consumes reservations without fitness; failures cannot become wins. Synchronous compilation and cleanup can extend nominal wall deadlines; keep one runner on port 4444.

A post-smoke diagnostic-only correction made probe worlds parameter-independent and added explicit world-signature checks. No gameplay C source/binary, evaluator, game rule, fitness, seed, opponent or promotion gate changed. The executed smoke tools and their original hashes remain in `logs/evolution-v3-smoke-20261024/executed-tools/`; `probe-revision.json` records the delta. The earlier zero-game `logs/evolution-v3-initialized-20261024/` is preserved and intentionally incompatible with the final probe identity. The final zero-game `logs/evolution-v3-ready-20261024/` is freshly initialized and compatible; no earlier checkpoint checksum/identity was edited.

## Exact commands from the HOST terminal

These commands run **on the Docker host**, not inside the container terminal. The observed current container hostname/ID is `8c5465c61af5`. Confirm it with `docker ps`; if the container was recreated, replace only that ID. The Docker daemon/socket is not exposed inside this workspace, so host execution itself was not tested from inside the container. Do not add `--from-champion` to resume.

Start a NEW one-hour background experiment (not launched):

```bash
docker exec -w /workspaces/monorepo 8c5465c61af5 node tools/evolution-v3.mjs start \
  --work logs/evolution-v3-hour-001 --from-champion \
  --seconds 3600 --matches 1000 --iterations 100 --ticks 1000 --wall 30 \
  --seed 73 --keep-replays 4 --disk-mb 4096 --background
```

Inspect status and the automatic human-readable report:

```bash
docker exec -w /workspaces/monorepo 8c5465c61af5 node tools/evolution-v3.mjs status --work logs/evolution-v3-hour-001
docker exec -w /workspaces/monorepo 8c5465c61af5 cat logs/evolution-v3-hour-001/RUN_REPORT.md
```

Stop safely; inspect status until `alive:false` before another game tool, export or backup:

```bash
docker exec -w /workspaces/monorepo 8c5465c61af5 node tools/evolution-v3.mjs stop --work logs/evolution-v3-hour-001
docker exec -w /workspaces/monorepo 8c5465c61af5 node tools/evolution-v3.mjs status --work logs/evolution-v3-hour-001
```

Resume the same compatible V3 run with **cumulative** extended budgets:

```bash
docker exec -w /workspaces/monorepo 8c5465c61af5 node tools/evolution-v3.mjs resume \
  --work logs/evolution-v3-hour-001 --seconds 7200 --matches 2000 --iterations 200 --background
```

After abrupt termination only, recover owned processes/locks first:

```bash
docker exec -w /workspaces/monorepo 8c5465c61af5 node tools/evolution-v3.mjs recover --work logs/evolution-v3-hour-001
```

To finish only its saved pending candidate, use `resume --finish-pending --additional-seconds 1500 --additional-matches 200`, with enough cumulative budget left. Caps may pause an incomplete decision; a later compatible finish invocation resumes it and never samples another candidate. Slot/time allowances depend on the current panel size, not always the historical 42-game example.

Export to a **new** path, then compile standalone C against the existing client library:

```bash
docker exec -w /workspaces/monorepo 8c5465c61af5 node tools/evolution-v3.mjs export \
  --work logs/evolution-v3-hour-001 --out logs/evolution-v3-export-001
docker exec -w /workspaces/monorepo 8c5465c61af5 make -C logs/evolution-v3-export-001 \
  CLIENT_LIB_DIR=/workspaces/monorepo/bots/c/client_lib 'CFLAGS=-Wall -Wextra -Werror -O2 -fsanitize=address'
```

The exported executable needs only the game socket/runtime and C dependencies; it embeds every parameter and V3 helper. Node is a training/evaluation launcher, not an inference dependency. No downloads/model service/API call is needed to play. Existing export paths are refused.

Every smoke replay has an exact HOST-terminal publication command in `logs/evolution-v3-smoke-20261024/REPLAY_INDEX.md`; copy the desired row's command. Publication automatically backs up the current display. `EVOLUTION_V3_VERIFICATION.md` records the first scheduled completed match and its exact command. To view it, start the visualizer **only if stopped**:

```bash
docker exec -it -w /workspaces/monorepo/visualizer 8c5465c61af5 npm run dev -- --host 0.0.0.0 --port 4242 --strictPort
```

Open forwarded port 4242 (usually `http://localhost:4242`); otherwise refresh the already running viewer after publication.

## Backups and limitations

Before moving computers, stop and verify no live owner/owned children. Back up the complete new work directory, exact V3 and shared tools, experimental source, immutable baseline/seal, tactical baseline dependency, engine/library/configs, compiler/runtime environment and exported parameters. Include older checkpoints, friend sources, sealed artifacts and benchmark replays separately; ignored logs are not retained by a Git commit alone. Verify archive digests and preserve absolute workspace paths for old manifests. A changed machine/compiler/binary can fail compatibility; use a new V3 run from a verified exported V3 model rather than editing checksums or rebuilding sealed snapshots.

Guard pathfinding is conservative, hunter risk estimation is local/reactive, pursuit timers are fixed, and expensive defenders can starve the economy/attackers. Cargo-only or efficiency-based economic classification can miss atypical transports. The disabled-feature equivalence is measured over synthetic states, not exhaustive proof. These are handwritten tactical options available to evolution; neither their existence nor a 24-game implementation smoke proves learned strength improvement. See EVOLUTION_V3_VERIFICATION.md for tests, all smoke outcomes and remaining limits.
