# Tactical logic and fast carriers

This is a separate handwritten strategy variant. The trained `strategy-bot`, legacy `policy-bot`, reference bots, friend sources, and permanent first-victory snapshot were preserved. The old trained bot remains `--bot current`; choose `--bot tactical` for this new implementation. No training or learned-weight update was performed.

## What the ten losses showed

On the original five paired seeds, our trained strategy scored 1 win and 9 losses against the new friend. Successful replay transfers totaled 1,495 gems for us and 2,425 for the friend. Our units made 350 unit attacks versus 452. We often produced only the fixed guard quota while the friend fielded more defenders and prioritized incoming CORE attackers. These observations and source inspection motivated the changes; they do not establish a separate causal contribution for every heuristic.

## New logic

- One stable guard ID stays near home when no immediate threat is present.
- Responsive production raises the living guard target up to six when enemies approach, instead of keeping a fixed quota of two. Dead guards may be replaced, so total births can exceed six.
- Guards prioritize adjacent strikes, incoming CORE attackers, nearby threats, and enemies obstructing our attackers.
- Healthy CORE attackers still directly attack an adjacent CORE. Other travel uses extra cost near enemy fighters; unarmed units cannot path through walls, deposits, or enemies they cannot damage.
- Two miners can split resource targets, penalizing targets already claimed this turn and dangerous enemy-controlled resources.
- All roles obey action cooldowns and production affordability. No prices or game rules were changed.

Only guard minimum and miner return load are inherited from the old exported parameters. The rest of this tactical behavior is explicitly handwritten, not a newly trained eight-parameter policy. The existing self-play trainer continues to target `strategy-bot`; it does not silently train this variant.

## Carrier mechanics

`TacticalCarrier` uses `speed + gem_carrying_efficiency`: 52 gems, 5 HP, base cooldown 1, carrying step 20, capacity 100, and no combat/mining damage. Engine cooldown is `max(1, base + floor(cargo / carrying_step))`:

| Cargo | Carrier cooldown | Basic miner cooldown |
| --- | ---: | ---: |
| 0 | 1 | 3 |
| 35 | 2 | 6 |
| 70 | 4 | 10 |
| 100 | 6 | 13 |

It is fast, not invulnerable: cargo slows it, it has only 5 HP, and obstacles/interception can trap it. A speed-plus-mining or speed-plus-attack design is illegal in this configuration because its cooldown would be below its attack sum. An unarmed unit can collect a loose pile using the engine's special pile-pickup behavior, but cannot break a deposit or fight.

Miners push cargo to adjacent friendly carriers; carriers cannot pull it. Receiving is legal even while a carrier is on cooldown. Capacity reservations prevent two miners from overfilling the same carrier in a turn. A miner that hands off does not also attack/move. Carriers return loaded, seek loaded miners when empty, or gather safe loose piles. Miners fall back to self-delivery if no carrier is nearby. Same-phase transfers are shuffled, so carriers forward only cargo already held in the observed state, never expected incoming cargo.

Carriers are optional and **off by default**. The predetermined selection rule preferred the simpler no-carrier variant when reference win fitness tied. This is not a conclusion that carriers are useless: they measurably increased economy in these reference games, but did not improve the already perfect reference win score.

## Actual bounded comparison

Artifacts: `logs/tactical-carrier-analysis/experiment-glS5Xk/`; detailed activity and preservation checks: `logs/tactical-carrier-analysis/results.json`.

The comparison completed **30 real matches in 120.51 seconds**, with a 900-second budget, 1,000-tick limit, serial execution, seeded placement, layout checks, and both physical sides per seed. All 30 completed without execution failures. Snapshots record exact source, build flags, binary hashes, configurations, seeds, logs, and replays.

| Stage | With carrier | Without carrier |
| --- | --- | --- |
| Frozen trained strategy, two seeds/both sides | 4–0 | 4–0 |
| Gridmaster, same reference panel | 4–0 | 4–0 |

Selection was locked to no-carrier on that tie, before any new friend result was read. The friend was never used to select a variant. Automatic approval review rejected the initial proposal to select from friend benchmarks because earlier instructions reserved that bot as an external opponent; the revised protocol used only our frozen strategy and Gridmaster for selection.

On the carrier branch's eight reference games, successful actions recorded **43 miner-to-carrier transfers totaling 2,025 gems**, and carriers delivered **1,695 gems to the CORE**. Some delivered cargo was collected directly from loose piles, so delivery is not attributed entirely to handoffs. Total CORE delivery was 1,835 gems with carriers versus 1,150 without. Normalized delivery rates were 80.64 versus 46.40 gems per 100 ticks against the frozen strategy and 62.90 versus 44.59 against Gridmaster. These are measured local economy differences, not proof of a general win advantage.

After selection was locked, the no-carrier tactical variant played the unchanged friend on the same five seeds and sides as the earlier ten games:

- Old trained strategy: **1–9**, with one combat win, eight combat losses, and one HP-based game-limit loss.
- Tactical default: **9–1**, with six combat wins, one combat loss, and three HP-based game-limit wins.
- Additional fresh Gridmaster control: **4–0**, all combat wins.

The friend source hash matched the earlier benchmark exactly. The new tactical friend games delivered 5,050 CORE gems over 8,150 ticks (61.96 gems/100 ticks); the old bot delivered 1,495 over 5,974 ticks (25.03/100 ticks). The tactical bundle changed defense, production, routing, and economy together; the experiment does not isolate each individual heuristic. This is a small known-opponent/map benchmark after human analysis, not independent evidence of general tournament strength or learned-model improvement. The carrier variant was not subsequently selected or retuned using friend outcomes.

## Play

From `/workspaces/monorepo`:

```bash
# Recommended tactical default, preserving the old trained bot separately
node tools/friendly.mjs pair --bot tactical --seeds friendly-001

# Explicitly try fast carriers
node tools/friendly.mjs pair --bot tactical --carriers on --seeds friendly-001

# Explicitly disable carriers
node tools/friendly.mjs pair --bot tactical --carriers off --seeds friendly-001

# Original trained bot remains available
node tools/friendly.mjs pair --bot current --seeds friendly-001
```

These commands build disposable copies and do not change the source friend or trained policy. They do not train. The carrier toggle is allowed only with `--bot tactical`. The tactical variant checks the supplied demo rule contract before running.

## Replays

```bash
# New tactical win against the friend
node tools/friendly.mjs publish logs/tactical-carrier-analysis/experiment-glS5Xk/evaluation-D3uyjY/0001/replay_latest.json

# Carrier handoff and delivery demonstration against the frozen strategy
node tools/friendly.mjs publish logs/tactical-carrier-analysis/experiment-glS5Xk/evaluation-R6VDPt/0001/replay_latest.json
```

Publication backs up the previously displayed replay. Refresh the running visualizer, or start it from `visualizer/` with `npm run dev -- --host 0.0.0.0 --port 4242 --strictPort` and open the forwarded address from VS Code's Ports panel.

## Verification and reproducibility

All **43 tests passed**, including carrier design legality, loaded cooldowns, adjacent handoffs, receiver cooldown independence, capacity reservation, unarmed travel masks, tactical argument validation, and authoritative carrier birth counting. The new C code builds with warnings treated as errors and AddressSanitizer. Formatting and the final default were followed by a rebuild and carrier test rerun. Ninety protected files were verified unchanged.

```bash
node --test --test-concurrency=1 tools/evaluate.test.mjs tools/policy.test.mjs tools/selfplay.test.mjs tools/friendly.test.mjs tools/audit-strategy.test.mjs tools/tactics.test.mjs

# Explicitly rerun the bounded reference-selection/external-test protocol
node tools/tactical-experiment.mjs
```

The experiment script is a development comparison, not self-play training or a model promotion. It freezes both variants and references before play, locks selection from reference fitness only, and stores each rerun in a unique directory. Repeated use of these now-known maps does not create a fresh unseen test. No competition compatibility claim is made. No commit, push, or upload was performed.
