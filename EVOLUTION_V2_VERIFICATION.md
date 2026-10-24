# Autonomous evolution v2 verification — 2026-10-24

Implemented invocation-local finish-pending/time/reservation limits, explicit lifecycle-only migration, automatic human-readable reports, dependency-aware screening, mixed single/joint mutations, challenging search panels with mandatory weak-reference promotion checks, and explicit parameter import. No LLM or API is part of operation. No long experiment, commit or push was launched.

## Historical continuation

Read `EVOLUTION_HOUR_001_ITERATION_24_FINAL.md` and `EVOLUTION_HOUR_001_RUN_REPORT.md`. The original run, code and reviews were archived before execution. A pinned migration compared all non-trainer identities, verified snapshots, used the production checksum writer and recorded old/new identities. Policy/evaluator/scoring/seed/opponent/gate changes were made only after the historical worker stopped.

Command executed: `node tools/evolution.mjs resume --work logs/evolution-hour-001 --finish-pending --additional-matches 42 --additional-seconds 1500 --seconds 5042`.

- 42 new games: 10 missing initial validation, then the existing conditional 32-game panel. Exactly 832 completed/reserved games total; no new candidate began.
- 190.879 additional checkpointed seconds, within 25 minutes. 37 new combat games and 5 HP tiebreaks; no random results or execution failures.
- Training 0.625 → 0.640625 (+0.015625). Initial validation 0.640625 → 0.640625 (0; zero gains/regressions), requiring extra validation. Pooled validation 0.6640625 → 0.671875 (+0.0078125); one gain, zero regressions. Rejected for delta <0.05 and fewer than two gains.
- Champion stays `e539c7dc8871fff608df8e7316c53b2d4f922456037956d3a7c6f0b23fbeb4bc`. Iteration 25, pending null, idle, zero promotions. Original 395 records, first 24 decisions, RNG and all snapshot records remain identical.
- Current v2 code deliberately rejects historical v1 compatibility; do not resume broad search there. Archived executed lifecycle code and identities permit independent audit.

## Tests and bounded new-protocol smoke

Final relevant suite: **56 passed, zero failed**. Log: `logs/evolution-v2-smoke-20261024/regression-final.log`. Includes real CLI fixture initialization, no-pending refusal, boundary/cap checks, cached interrupted conditional-extra panel resume without another candidate, schema/LCG/C parity, joint/single coverage, dependency and regression-gate checks. Cached outcome rows in unit tests are synthetic fixtures, not new game evidence. Existing evaluator/strategy/friendly/tactical regressions also pass.

Real smoke is separate at `logs/evolution-v2-smoke-20261024/`; its commands and predeclared limits are in `smoke-plan.json`, not retrofitted from results. It imported an existing saved champion export with a recorded SHA-256. Supervisor signaled SIGTERM after observing an actual active pair, waited for cleanup, then used finish-pending to resolve that saved candidate with independent invocation caps. Before/after/final checkpoints and console are retained.

- Elapsed wall time **199.720 seconds**, below the 10-minute smoke ceiling. 48 committed completed games, 50 reserved slots. The interrupted pair reserved two slots and contributed no fitness.
- Intentional interruption happened during server startup: error log records `Server exited before Server listening on port 4444`. Worker correctly paused, retained the same pending candidate and no committed results for that pair. This is cancellation evidence, not a scored combat/fitness failure. All 48 committed games completed; zero failed game results were scored.
- One `guard_radius` 12 → 11 candidate, 61/1200 probe changes. Training uses two challenging opponents (16 games versus the historical four-opponent 32); validation restored both weak references (32 games). Training delta +0.0625; validation 0.6875 → 0.625 (−0.0625), zero gains/two regressions, rejected. No extra panel was permitted. No promotion or strength improvement was demonstrated.
- Finish preserved RNG and stopped at iteration 1, pending null; no second candidate was generated. `RUN_REPORT.md` contains parameter changes, rejection conditions, opponent outcomes, errors, slot/game counts and stop reason without an interactive assistant.
- Export to `logs/evolution-v2-export-20261024/` succeeded and the exported C bot compiled against the existing library with ASan flags. Existing bots were not rebuilt.
- Final identity check: smoke checkpoint matches current code. Both historical and smoke owners are dead, no owned children remain, and `.training-lock`/`.match-lock` are absent.

## Preservation

667 pre-existing files under bots, historical run snapshots and sealed first victory were hash-checked unchanged. `preservation-check.json` records these checks; `preserved/evolution-lifecycle-original-20261024/protected-bots.json` contains the manifest. All 42 new historical per-game result files and JSONL rows agree with checkpoint records. Earlier review/outcome documents are unchanged; evidence backups remain intact. Replay pruning occurred only inside active run directories under the existing retention rule; original historical evidence was archived first. No displayed replay was published.

## Remaining limits and next experiment

No measured improvement is a valid outcome. One smoke candidate does not establish search superiority. Joint mutation frequency and dependency gates are tested, but no joint-carrier real-game benefit is claimed. Only the explicit carrier-load reachability dependency is encoded; synthetic worlds can still screen other unreachable or rare behavior poorly. Weak references still consume validation games, deliberately preserving regression protection. Acceptance stays conservative and score saturation elsewhere may remain.

Invocation caps restrict scheduling/reservations. Active async games receive a deadline signal; synchronous compilation (60-second timeout each) and cleanup/checkpoint overhead can extend a nominal wall deadline. Historical finish required no compilation and completed comfortably inside both requested caps. Resume across changed environments remains strict; import parameters into a new run instead of altering identities. While a worker is running, a retained stop_reason/error can describe the previous invocation; terminal report stop reason is authoritative.

Recommended next one-hour experiment, **not launched**:

```bash
node tools/evolution.mjs start --work logs/evolution-hour-002 \
  --seconds 3600 --matches 1000 --iterations 100 --ticks 1000 --wall 30 \
  --seed 73 --keep-replays 4 --disk-mb 4096 --background
```
