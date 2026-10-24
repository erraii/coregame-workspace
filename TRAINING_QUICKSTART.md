# CORE Game — First Trainable Bot

For the expanded miner/guard strategy, historical opponent pool, bounded self-play, and resume commands, see [SELFPLAY_QUICKSTART.md](SELFPLAY_QUICKSTART.md). This document describes the preserved original four-action bot.

## What this adds

This package adds a separate `bots/c/bot/policy-bot` and `tools/train.mjs`. Your existing My CORE Bot and Gridmaster source files are unchanged. The evaluator now synchronizes startup and verifies initial terrain and team positions across comparisons. The local engine seeds its placement shuffle; see `EVALUATION_QUICKSTART.md`.

The policy is a small linear model with 32 weights. It receives eight features from the normal bot state and selects one of four actions:

1. Create a light CORE attacker.
2. Create an attacker with extra health.
3. Create an attacker with armor.
4. Wait instead of spawning.

Movement remains the existing rush-to-enemy-CORE behavior. Mining, defense, target selection, and pathfinding are not learned in this first experiment.

**Training is real parameter optimization from game results, using stochastic hill climbing. This is not PPO, a neural network with hidden layers, or gradient-based reinforcement learning.** The goal is to verify the complete local train/export/play workflow before expanding it.

## Install

Extract the ZIP into your existing monorepo folder, merging `tools/` and `bots/`:

- Host: `/goinfre/$USER/coregame/monorepo`
- Container: `/workspaces/monorepo`

Stop any running match before training. Leave the visualizer running if desired. All following commands run inside the Dev Container. Node.js and the C toolchain are already available; no npm/Python packages are needed for this trainer.

## First training experiment

```bash
cd /workspaces/monorepo

node tools/train.mjs \
    --iterations 2 \
    --train-seeds train-001 \
    --validation-seeds eval-101 \
    --max-ticks 1000 \
    --wall-seconds 120
```

This runs **10 matches** against Gridmaster:

| Stage | Matches |
| --- | ---: |
| Initial policy on training seed, both sides | 2 |
| Two candidate policies on training seed, both sides | 4 |
| Initial policy on separate validation seed, both sides | 2 |
| Selected policy on validation seed, both sides | 2 |

The trainer generates candidate weights, evaluates each candidate, and retains it only when its training objective improves. Validation results are reported after selection and do not choose the model. A failed game aborts scoring rather than awarding a win, loss, or draw.

Two iterations are a pipeline check, not enough evidence of a strong model. It is completely possible that no candidate improves on the initial policy. The output reports this honestly.

## Where to look

During training, the terminal prints labels such as `initial-training`, `candidate-001`, and `best-validation`, followed by evaluation results and a score.

At completion:

- `logs/training-.../summary.json`: training/validation comparison.
- `logs/training-.../best_policy.json`: selected model parameters.
- `logs/training-.../best_policy_weights.h`: exported C parameters.
- `logs/training-.../history.jsonl`: candidate evaluation references and scores.
- `bots/c/bot/policy-bot/inc/policy_weights.h`: selected parameters embedded in the bot source.

Each evaluated policy also receives a separate `logs/evaluation-...` directory containing its own configs, replays, and logs.

**Refresh the running visualizer after training.** The trainer copies one selected-policy validation replay into `visualizer/public/replays/replay_latest.json` automatically. The browser URL is the forwarded address in VS Code's Ports panel.

If the visualizer is stopped, open another container terminal:

```bash
cd /workspaces/monorepo/visualizer
npm run dev -- --host 0.0.0.0 --port 4242 --strictPort
```

Use **Ports → 4242 → Open in Browser**, then press Play.

## Run the selected bot again

```bash
cd /workspaces/monorepo

node tools/evaluate.mjs \
    --a bots/c/bot/policy-bot \
    --b bots/c/bot/gridmaster \
    --seeds eval-201 \
    --max-ticks 1000 \
    --wall-seconds 120
```

This rebuilds the policy bot as needed using the exported header. Standalone evaluation saves its replays in isolated match folders; copy the replay you want into the visualizer as described in the evaluation guide.

## Model inputs and action validity

| Feature | Calculation |
| --- | --- |
| Bias | Constant 1 |
| Bank | Own CORE gems / 300, clipped to [0, 2] |
| Own unit count | Count / 20, clipped to [0, 2] |
| Enemy unit count | Count / 20, clipped to [0, 2] |
| Own CORE HP | HP / 100, clipped to [0, 1] |
| Enemy CORE HP | HP / 100, clipped to [0, 1] |
| Enemy threat | 1 minus nearest enemy-unit Manhattan distance / (2 × grid size), clipped to [0, 1]; 0 when no enemy units exist |
| Ticks | Elapsed tick / 1000, clipped to [0, 2] |

For each action, the model computes a weighted sum of these features. It chooses the highest-scoring available action. Spawn actions are unavailable when the CORE is cooling down or cannot afford the design; waiting is always available.

Demo designs:

| Action | Components | Default demo cost |
| --- | --- | ---: |
| Light | `core_attack` | 35 gems |
| Healthy | `core_attack`, `health` | 47 gems |
| Armored | `core_attack`, `armor` | 65 gems |
| Wait | None | 0 |

The trainer checks the component definitions and exports costs from the current demo configuration. This first implementation is specifically for our existing `fake_demo` rules. It does not establish legality for a future competition configuration, and it does not automatically support arbitrary new component validation rules.

## Training objective

Each completed match contributes:

| Result | Score |
| --- | ---: |
| Combat win | 1.0 plus up to 0.01 for finishing earlier |
| Combat loss | 0 |
| Game-limit tiebreak win | 0.75 |
| Game-limit tiebreak loss | 0.25 |
| Random tiebreak, either winner | 0.5 |

Scores are averaged across seeds and sides. Random tiebreak winners do not receive an advantage over random tiebreak losers. Failures never receive a score.

These are explicit experimental objective choices, not official tournament scoring. The 1,000-tick horizon changes the task from the original 30,000-tick game. Do not claim competition strength from this smoke test.

## Larger experiments

Only after the first run succeeds:

```bash
node tools/train.mjs \
    --iterations 12 \
    --train-seeds train-001,train-002,train-003 \
    --validation-seeds eval-101,eval-102 \
    --max-ticks 3000 \
    --wall-seconds 180
```

That configuration schedules 86 matches: 13 training evaluations × 6 matches, followed by 8 validation matches. Choose the budget consciously; results, replays, and logs consume disk space.

To start another search from a saved JSON model:

```bash
node tools/train.mjs \
    --from logs/training-REPLACE_ME/best_policy.json \
    --iterations 4 \
    --train-seeds train-004,train-005 \
    --validation-seeds eval-301
```

Replace the path with a real checkpoint path. Without `--from`, each invocation starts from the bundled initial model. Input/output normalization is fixed; it is not learned.

Use `--opponent opponents/friend` for another compatible C bot, `--sigma` for mutation size, and `--search-seed` for the optimizer's random sequence. Fixed seeds alone do not prove the engine itself is deterministic. Repeat evaluations to check variance.

## Interruptions

Training shares the evaluator's match lock and also holds `.training-lock`. Run one trainer and no other matches at a time. The root Makefile does not honor these locks.

On an ordinary failure or Ctrl+C, the best policy evaluated so far is restored to the header. If the initial evaluation never succeeded, the previous header is restored. The next `make` or evaluation rebuilds the executable if its header changed. A forced kill can leave locks behind; inspect running processes before removing stale locks.

Checkpoints after a failed run remain useful diagnostic records, but a training run without the final validation stage is incomplete.

## Tests and verification

```bash
node --test --test-concurrency=1 tools/evaluate.test.mjs tools/policy.test.mjs
```

Twenty-two automated tests passed in the development workspace. They cover C/JavaScript inference agreement, action masks, score handling, candidate acceptance/export, disjoint seeds, checkpoint restoration, layout mismatch rejection, and evaluator orchestration. End-to-end training regression tests use a mock TCP server.

The C bot compiled against the checkout's real client library. The inference regression test compiles C and compares its scores and action masking against JavaScript expectations.

The real client library, bots, and server were built locally. A two-candidate training experiment completed with unchanged training and holdout scores of 0.50418. Full results and limits are recorded in `TRAINING_RESULTS.md`; no improvement was found.

## Preserve and deploy the model

Training runs locally. Inference requires only compiled C code; the model weights are embedded in `inc/policy_weights.h`. No runtime model download, JSON loading, Python interpreter, or ONNX library is needed.

To save the experiment and the selected header to your preparation repository:

```bash
git add bots/c/bot/policy-bot \
    tools/train.mjs tools/policy-model.mjs tools/policy.test.mjs \
    tools/evaluate.mjs tools/evaluate.test.mjs TRAINING_QUICKSTART.md

git commit -m "Add match-trained linear C policy and trainer"
git push origin dev
```

The `.gitignore` rules already exclude the bot executable, build output, and logs. The selected header is source and is included in the commit. The current portable checkpoint is `bots/c/bot/policy-bot/selected_policy.json`; see `TRAINING_RESULTS.md` for measured results. Future checkpoints should also be preserved outside ignored logs before committing.

For official submission, adapt/copy the bot's C sources and headers into the official team's expected bot folder and preserve its build contract. Our local `dev` push does not submit to the competition. Event rules, actual configuration, and CPU/memory limits still need verification before competition deployment.
