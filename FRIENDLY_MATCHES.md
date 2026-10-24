# Repeatable friendly matches and the first victory

Run all commands below from `/workspaces/monorepo` inside the Dev Container. The friend remains in `bots/c/bot/friend/`. Neither the friend's strategy nor our selected policy was changed.

That statement describes friendly-match preparation. Subsequent self-play selected new parameters for the current strategy; `--bot first-victory` still uses the original sealed winning executable. See `TRAINING_RESULTS.md` for the later experiment.

## Permanent first-victory snapshot

- Snapshot: `preserved/first-victory-20261024/`
- Portable archive: `preserved/first-victory-20261024.tar.gz`
- Archive checksum: `preserved/first-victory-20261024.tar.gz.sha256`
- Verification/provenance: snapshot `manifest.json`, `SHA256SUMS`, and `evidence/`
- Original winning match: `logs/evaluation-c3tfKc/0001/`

The original visualizer replay matched that winning match byte-for-byte (SHA-256 `a1f9dd0943a6bc62c8bc0463edf7c64097801d41ffdd24ce317bb4d37db1fdb1`). It was COREStrategy vs ULTIMATE_CORE, seed `friendly-001`, our team 42 at `(19,19)`, opponent CORE destroyed. No other original candidate matched the victory description in the inspected saved replay locations. The later verification pair reproduced identical replay bytes; it is a known repeat of this match, not an unidentified earlier candidate.

The engine records final tick **316**. The visualizer caps its displayed timeline index at `full_tick_amount - 1`, hence **315**, and interpolates the next tick's state. This explains the apparent discrepancy.

The snapshot includes exact sources and embedded `strategy_params.h`, original Makefiles, selected parameters, matching recorded executables, compatible C client library source/static library, opponent source/executable, exact game/server configurations, logs, replay, and original match/provenance metadata. Source files match the contemporaneous `protected-inputs.json` hashes; the current selected executable matches the winning evaluator's executable hash `e7845b95fbddba4db0aa42589fc3ab6d605ca8a4ccf423be72696f7d322cd575`. The friend and engine executable hashes also matched when captured.

The historical evaluator manifest did not itself hash sources. Source provenance therefore rests on the separate contemporaneous protected-inputs manifest and its recorded before/after verification, rather than a clean Git commit. These checks establish equality with the recorded local hashes, not an independently authenticated history or bit-for-bit reproducible recompilation. The snapshot manifest states these limits. A writable copy extracted from the portable archive compiled successfully against the existing client library; this left the permanent snapshot untouched.

The preserved tree and archive are read-only, and every snapshot payload file is hash-sealed. They are outside `logs/`, all bot/build trees, and the trainer's output locations. The wrapper never builds, writes, or cleans there; it verifies the seal before selecting the frozen executable. Do not include `preserved/` in manual cleanup commands. An owner can deliberately override permissions; this is an application-level immutable archive with tamper detection, not a privileged filesystem immutable flag.

Verify the preserved files and archive:

```bash
(cd preserved/first-victory-20261024 && sha256sum -c SHA256SUMS)
(cd preserved && sha256sum -c first-victory-20261024.tar.gz.sha256)
```

Build instructions are included in the snapshot README. Build writable working copies only. Its recorded executable is specific to this development platform; sources and library are provided for rebuilding elsewhere. Historical server replay-output paths are preserved as evidence and must be relocated in a working copy when reproducing outside this checkout. The engine executable/data are not bundled; the recorded engine hash is available.

## Play again

One match with our current selected source:

```bash
node tools/friendly.mjs single --bot current --seeds friendly-001
```

One match with the exact recorded winning executable:

```bash
node tools/friendly.mjs single --bot first-victory --seeds friendly-001
```

The default single-match team ID is 42. Add `--side 418` to use the other ID. A team ID's physical coordinates depend on the seed; results record the actual coordinates. Use a pair when physical-side balance matters.

Balanced pair, same seed, using the frozen first-victory bot:

```bash
node tools/friendly.mjs pair --bot first-victory --seeds friendly-001
```

Batch with both physical starting sides for every seed:

```bash
node tools/friendly.mjs batch --bot current \
  --seeds friendly-001,friendly-002,friendly-003 \
  --max-ticks 1000 --wall-seconds 60
```

Use `--bot current` or `--bot first-victory` with any match mode. Defaults are 1,000 ticks and a 60-second external watchdog per match. These commands never train or edit policies. Each build is limited to 120 seconds; matches are serial on port 4444.

Current-bot source and friend source are copied to a new disposable `logs/friendly-run-.../` directory and built there against the existing client library. The frozen option copies the sealed winning executable into the run directory without rebuilding it. All source/binary hashes are recorded in `friendly-manifest.json`. The root bots and shared library are not rebuilt or overwritten. Build adaptations, if needed in future, belong in `friend/`; a failing build leaves a diagnostic build log and does not silently alter a strategy.

Each run stores its evaluator output inside a unique `evaluation-.../` subdirectory, with `0001/`, `0002/`, and subsequent match folders. Configurations, logs, results, and replays are separate per match. `friendly-result.json` points to the evaluation and includes its rows. Failures are recorded in `failure.json` and receive no successful result summary.

The existing evaluator retains server-first startup, accepted-login synchronization, seeded CORE placement, seed/layout checks, watchdogs, `.match-lock`, and child cleanup. Pairs/batches additionally verify actual physical-side balance. The wrapper holds `.training-lock` to prevent a trainer or another friendly wrapper from starting during preparation or evaluation. Do not run the root Makefile concurrently; it does not honor these locks. A forced kill can leave a lock; inspect processes/port 4444 before removing a stale one.

Frozen mode also checks the current engine executable and base game/server configuration hashes against the victory record. It rejects changed rules or engine inputs rather than silently running a different historical setup. Its per-match seed, tick/watchdog limits, and output paths remain explicit run options.

The evaluator CLI was inspected and extended with `--a-teams 42` or `--a-teams 418` for the single-match case. Omitting it retains the original `[42,418]` behavior used by training. The wrapper calls this same evaluator implementation; it does not create a second game runner.

## Select any replay

Publish the preserved first victory:

```bash
node tools/friendly.mjs publish preserved/first-victory-20261024/match/replay_latest.json
```

Publish either match from the verified new pair:

```bash
# Match 1: our win
node tools/friendly.mjs publish logs/friendly-run-gMVJNK/evaluation-9LihuW/0001/replay_latest.json

# Or match 2: our loss
node tools/friendly.mjs publish logs/friendly-run-gMVJNK/evaluation-9LihuW/0002/replay_latest.json
```

For future runs, substitute the new path printed by the wrapper. Every publication backs up the previously displayed replay in a fresh `logs/replay-publication-.../previous-replay.json`, records old/new hashes, then atomically replaces `visualizer/public/replays/replay_latest.json`. Publication does not overwrite saved match replays. Match commands do not publish automatically.

If the visualizer is stopped:

```bash
cd /workspaces/monorepo/visualizer
npm run dev -- --host 0.0.0.0 --port 4242 --strictPort
```

Open the actual forwarded address for port 4242 in VS Code's Ports panel. Refresh after publishing a different replay. If the visualizer is running already, just refresh it.

## Verification performed

All **36 tests** passed with socket tests run sequentially:

```bash
node --test --test-concurrency=1 tools/evaluate.test.mjs tools/policy.test.mjs tools/selfplay.test.mjs tools/friendly.test.mjs
```

Tests cover the existing evaluation/training behavior plus exactly-one-match selection, invalid side lists, friendly argument validation, hash-seal rejection, and backup-preserving atomic publication (including publishing the already displayed file).

The real frozen pair completed in `logs/friendly-run-gMVJNK/evaluation-9LihuW/`: our win from `(19,19)` at tick 316 and loss from `(0,0)` at tick 534, no execution failures. Layouts matched and physical sides were balanced. The original winning replay was backed up during actual publication to `logs/replay-publication-83jeo6/previous-replay.json`. The first victory is currently displayed. No training, commit, or push was performed.

## Handwritten tactical variant and optional carriers

The separate `tactical-bot` is available with `node tools/friendly.mjs pair --bot tactical --seeds friendly-001`. Add `--carriers on` to enable its fast carrier role, or `--carriers off` to disable it explicitly. The original `--bot current` remains the unchanged trained strategy. See [TACTICAL_CARRIERS.md](TACTICAL_CARRIERS.md) for actual results and the reference-only variant-selection protocol.
