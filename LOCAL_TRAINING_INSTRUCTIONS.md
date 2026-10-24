# Local CORE Game Training Instructions

Use this guide to run autonomous local evolution without keeping Codex or VS Code open. The training loop uses local Node/C processes and does not call an LLM or cloud API. The computer and Docker container must remain running.

## 1. Open the training environment

In a normal host terminal (prompt similar to `1-B-7%`), run:

```bash
docker start 8c5465c61af5
docker exec -it -w /workspaces/monorepo 8c5465c61af5 bash
```

The prompt should now resemble:

```text
root@8c5465c61af5:/workspaces/monorepo#
```

Run all subsequent commands inside this container, from `/workspaces/monorepo`. Do not paste them into the Codex chat. If already inside the container, skip this step.

## 2. Start the first one-hour run

Do not run another training job or friendly match at the same time: they share game port 4444. The visualizer can stay open.

```bash
cd /workspaces/monorepo
node tools/evolution.mjs start --work logs/evolution-hour-001 \
  --seconds 3600 --matches 1600 --iterations 100 \
  --ticks 1000 --wall 30 --seed 73 \
  --keep-replays 4 --disk-mb 4096 --background
```

This starts a detached worker. You can close this terminal and Codex after checking status. Closing the computer, stopping the container, or suspending execution prevents further progress.

The limits are up to one hour of cumulative active run time, 1,600 reserved match slots, 100 iterations, and a soft run-disk ceiling of 4,096 MiB. The worker can pause earlier when another limit is reached. Each match has a 1,000-tick game limit and a 30-second watchdog. Cleanup overhead can slightly extend elapsed time.

`start` requires a new work directory. If this run already exists, use `resume`; do not delete its directory. Use a different run name only when you intend a separate experiment. A new start uses the derived initial parameters, not automatically the champion from another run.

## 3. Check progress

```bash
node tools/evolution.mjs status --work logs/evolution-hour-001
```

Check worker liveness (`alive`), completed progress, current champion, promotion count, pending candidate, recent errors, and budget/disk usage. `alive: false` means the worker is no longer running; inspect the reported state to distinguish a normal pause from an error.

To follow the worker log:

```bash
tail -n 40 -f logs/evolution-hour-001/console.log
```

Press Ctrl+C to stop following this log. This does not stop the detached trainer.

## 4. Stop safely

```bash
node tools/evolution.mjs stop --work logs/evolution-hour-001
```

Then check status until `alive` is false:

```bash
node tools/evolution.mjs status --work logs/evolution-hour-001
```

Allow cleanup to finish. A synchronous build may delay signal handling by up to its 60-second timeout. A partial interrupted pair receives no fitness. Do not manually delete lock files.

## 5. Resume using the remaining budget

```bash
node tools/evolution.mjs resume --work logs/evolution-hour-001 --background
```

The checkpoint retains search RNG state, pending candidates, completed comparisons, champion, and opponent identities. Budgets are cumulative; resume does not grant another full hour automatically.

## 6. Extend to two cumulative hours

With the worker stopped, run:

```bash
node tools/evolution.mjs resume --work logs/evolution-hour-001 \
  --seconds 7200 --matches 3200 --iterations 200 --background
```

This sets the overall time budget to two hours, not two additional hours. Keep the original tick, watchdog, and search-seed settings. Do not edit the training implementation or game rules while a run is active; compatibility checks can reject a changed environment on resume.

## 7. Recover after an abrupt stop

After a computer/container interruption, start the container and enter it using step 1. Check status first. If the worker is dead and recovery is needed:

```bash
node tools/evolution.mjs recover --work logs/evolution-hour-001
node tools/evolution.mjs resume --work logs/evolution-hour-001 --background
```

Recovery checks ownership and refuses to interfere with a live worker or unrelated locks. If it refuses, preserve the error and inspect it; do not delete locks blindly. A partial uncommitted comparison may need to repeat and consume another reservation.

## 8. Locate and export the retained champion

Status reports artifact locations. The full run is stored in:

```text
/workspaces/monorepo/logs/evolution-hour-001/
```

With training stopped, export to a new destination:

```bash
node tools/evolution.mjs export \
  --work logs/evolution-hour-001 \
  --out logs/evolution-hour-001-export-001
```

Existing export destinations are refused. This does not replace the existing strategy or tactical bots. See `LOCAL_EVOLUTION.md` for build, evaluation, replay publication, and complete backup instructions.

## 9. Understand the result

Candidates are evaluated against frozen opponents and historical champions. A candidate must pass the promotion gate before replacing this run's champion. Rejected candidates leave the incumbent intact. Zero promotions is a valid result.

A promotion is evidence under the recorded evaluation protocol, not a guarantee of superiority on every map or against every opponent. This system searches 15 parameters and implemented behavior alternatives; it does not invent new C functions or train a neural network.

## 10. Before changing computers

Stop the worker, wait for `alive: false`, and back up the complete run plus the code/runtime dependencies listed in `LOCAL_EVOLUTION.md`. Copy the backup off this computer. `/goinfre` is machine-local, and files under `logs/` are ignored by Git; a normal Git push will not preserve this run.

Existing checkpoints require compatible code, compiler, engine, configuration, and workspace paths. Cross-machine continuation is not guaranteed merely by copying `checkpoint.json`. Keep all original records.

## Verified implementation baseline

The supplied implementation report recorded 51 passing tests, 66 completed checkpointed games, real graceful-stop/resume and abrupt-recovery exercises, zero promotions, and two exported-bot combat wins against Gridmaster. These are prior smoke-test results, not results of the one-hour run above.

