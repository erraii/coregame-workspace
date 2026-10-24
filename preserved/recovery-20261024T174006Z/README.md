# Recovery backup: 20261024T174006Z

Target repository: **erraii/coregame-workspace**, branch **dev**. No upload or push targets the upstream 42core-team repository.

## What is stored in Git

`source-recovery.tar.gz` is a compact source/data-only fallback archive (17,197,708 bytes; 11,996 files). It contains unchanged V2/V3 checkpoints, every source/model/snapshot record needed to understand the selected real runs, champion source/parameters, the source-only immutable V3 baseline, frozen tactical source, selected exports, training/benchmark reports and replay indexes. It includes **all 60 independent benchmark replays and all 24 V3 smoke replays**, at their original relative paths. It excludes compiled binaries, static/object libraries, build/dependency caches, credentials, agent sessions, nested opaque archives and bulk console/server logs. The payload manifest is `source-files.json`; checkpoint inventory and original identities are in `checkpoint-inventory.json`.

A GitHub Release asset was preferred, but no authenticated Release tool, gh CLI/API token or usable HTTPS API credential was available. Existing SSH Git transport can push source commits but cannot authenticate Release uploads. This source/data bundle is the explicitly authorized fallback; **this is not a full external strict-resume backup**.

## What remains local

The full runtime recovery archive exists only on this computer:

`logs/recovery-backup-20261024T174006Z/full-runtime-recovery.tar.gz`

Size: 65,950,837 bytes. SHA-256: `9ac45ee2c6ee40b14e52e2afad4451a7b2a01a54420005d3023f5476c3317f88`.

It preserves the selected original checkpoint trees, all recorded snapshots' executable/model/source files, original engine and client static library, the complete sealed V3 baseline (including cached files referenced by its unchanged seal), older frozen runtime/evidence bundles and selected runtime exports. It is intentionally **not committed**, because it contains binaries and runtime artifacts. Matching compiler/Node/OS runtime dependencies are still required; a container image is not included. Keep this archive on separate storage or upload it through an authenticated Release workflow later.

Other bulk logs, extra historical replays outside the selected set, scratch test runs, caches, dependencies, Codex handoff/session material and the rest of the workspace remain local unless already tracked separately. The unrelated local edits to `.vscode/settings.json` and `CORE_GAME_FRESH_SETUP.md` were left unstaged; their exact current files are retained in the local runtime archive. No local evidence was deleted, rewritten or cleaned up.

## Integrity and extraction

All archive members were checked against SHA-256 manifests and against the unchanged originals. The Git bundle has no ELF executables or static archives. `integrity.json` records the checks. Checksum files use archive basenames; run checks from this directory:

```bash
sha256sum -c source-recovery.tar.gz.sha256
```

After cloning/checking out this personal repository at `/workspaces/monorepo`, extract the source/data package at the repository root to restore the ignored relative paths. It contains the exact source version captured for this backup; use a fresh restoration checkout or back up later edits before extraction:

```bash
cd /workspaces/monorepo
tar -xzf preserved/recovery-20261024T174006Z/source-recovery.tar.gz -C /workspaces/monorepo
```

The restored replay indexes are:

- `logs/independent-evo-20261024T160826Z-5840825a3ad74ace/REPLAY_INDEX.md` (60 games).
- `logs/evolution-v3-smoke-20261024/REPLAY_INDEX.md` (24 games).

Their original publication paths work after restoration at the original root. Publish an existing saved replay without running a new match:

```bash
node tools/friendly.mjs publish logs/evolution-v3-smoke-20261024/evaluation-VLfNEi/0001/replay_latest.json
```

## Strict resume limitations

Source restoration alone does **not** permit strict continuation. Checkpoints and baseline seals retain their original identities/checksums, but the Git archive omits the executable/runtime files those checks require. The trainers verify **all** recorded snapshot binaries, not merely the current champion, plus engine/library/compiler/tool/configuration identities. V3 additionally verifies every sealed baseline file and pins the original V2 champion binary. Rebuilding at another path/toolchain can produce different hashes.

In particular, the current V3 CLI verifies the immutable baseline even when starting from a V3 parameter file. Therefore a source-only clone can rebuild/play standalone V3 C source, but cannot start/resume the V3 trainer until the exact baseline/runtime material is restored. Do **not** reseal rebuilt files, edit checkpoint checksums, remove identity fields or declare them compatible.

For strict continuation, first obtain the local `full-runtime-recovery.tar.gz` and its checksum through separate trusted storage, verify it, and extract it only into a fresh matching restoration environment at the original root. Current V2 hour-002 and final V3 ready work use the committed implementations. Hour-001 and earlier diagnostic V3 work require the exact archived tools referenced by their recorded identities, in an isolated matching environment; their checkpoints must remain unchanged. Legacy finalized selfplay runs remain finalized.

The full local archive is a recovery selection, not an image of every local log or operating-system library. If its runtime artifacts are unavailable, only the source/data fallback described below is available.

## Source-only rebuild/import fallback

Run these examples only in a fresh restoration checkout, never over the preserved sealed directories or the original working runtime. These are **future recovery instructions**, not commands executed during this backup. Rebuilds are suitable for playing source or creating new compatible V2 experiments; they do not make old checkpoints compatible.

The V2 champion model/source is at:

`logs/evolution-hour-002/snapshots/13ae14da4b8d3c0a13a5a77559155700dfeccace17e16939ad787f0d7eb3db38/`

The disabled-feature V3 champion model/source is at:

`logs/evolution-v3-ready-20261024/snapshots/661916b9726df597b051428ed1e5489375dd69a1b8ba20687dfc95766fecd840/`

Example: build standalone V3 C in a new disposable directory, leaving the sealed baseline untouched:

```bash
cd /workspaces/monorepo
make -C bots/c/client_lib
mkdir -p logs/rebuilt-v3-champion
cp -a logs/evolution-v3-ready-20261024/snapshots/661916b9726df597b051428ed1e5489375dd69a1b8ba20687dfc95766fecd840/src logs/rebuilt-v3-champion/
cp -a logs/evolution-v3-ready-20261024/snapshots/661916b9726df597b051428ed1e5489375dd69a1b8ba20687dfc95766fecd840/inc logs/rebuilt-v3-champion/
cp logs/evolution-v3-ready-20261024/snapshots/661916b9726df597b051428ed1e5489375dd69a1b8ba20687dfc95766fecd840/Makefile logs/rebuilt-v3-champion/
make -C logs/rebuilt-v3-champion CLIENT_LIB_DIR=/workspaces/monorepo/bots/c/client_lib 'CFLAGS=-Wall -Wextra -Werror -O2 -fsanitize=address'
```

That executable embeds its parameters and V3 helpers; it needs no Node/model download/LLM/API during play. A running CORE server/socket and normal C/ASan runtime dependencies are still needed.

For a NEW V2 run after rebuilding the ordinary engine/library in a fresh environment, the explicit parameter import is:

```bash
node tools/evolution.mjs start --work logs/recovered-v2-new \
  --from logs/evolution-hour-002/snapshots/13ae14da4b8d3c0a13a5a77559155700dfeccace17e16939ad787f0d7eb3db38/model.json \
  --seconds 3600 --matches 1000 --iterations 100 --ticks 1000 --wall 30 --seed 73
```

This instruction deliberately creates new evidence and does not resume an old checkpoint. For NEW V3 training, restore the exact immutable baseline/runtime archive first, then follow EVOLUTION_V3_QUICKSTART.md with a fresh work directory. None of these recovery examples were run during this backup; no tests, matches or training were launched.

Prior reports are dated historical records. The archived checkpoint/inventory is authoritative about actual stop states. Current training owners were confirmed stopped before copying.
