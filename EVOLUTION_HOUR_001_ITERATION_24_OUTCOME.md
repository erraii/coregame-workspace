# Iteration 24 resolution preflight — blocked by CLI limits

The earlier review was read. No resume, matches, training, builds, checkpoint edits or implementation edits were performed. No commit or push was made. Existing playable bots are untouched.

## Evidence preservation

Before any execution, the entire existing run directory and `EVOLUTION_HOUR_001_REVIEW.md` were archived in `preserved/evolution-hour-001-iteration24-preflight-20261024T122513Z/evidence.tar.gz`. Its adjacent `sha256.json` records every original file hash. Every archived payload was checked against that manifest, and every original file still matched after preservation. The earlier review is unchanged.

## Actual CLI semantics and blocking limitation

`tools/evolution.mjs` was inspected directly. Budgets are cumulative: checkpoint elapsed time is 3541.554 seconds, reserved matches 790; configured limits are 3600 seconds, 1600 matches and 100 iterations. The loop condition is `s.iteration < s.options.iterations`, and completing a decision clears pending work and increments iteration before the next loop.

A limit of 25 would stop immediately after pending iteration 24. However, the resume option validation explicitly rejects reducing `seconds`, `matches` or `iterations` below their stored option values once a champion exists. Thus `--iterations 25` is rejected against the saved limit of 100. Similarly, the requested hard additional-match cap would be cumulative 790 + 42 = 832, but `--matches 832` is rejected against the saved limit of 1600. The CLI has no stop-after-pending or decision-count option.

The cumulative time limit could be raised to 5041 seconds, giving 1499.446 additional seconds, within 25 minutes, but a time budget cannot enforce the candidate boundary. The `stop` command signals asynchronous graceful cancellation and cannot guarantee that another candidate has not begun. A match ceiling alone would also not prevent a new candidate from being created after an earlier-than-maximum decision. No unrestricted resume was launched, as requested.

Resolving this requires authorization for a different enforcement mechanism, such as a narrowly scoped runner change that can cap the pending decision, or an explicitly authorized checkpoint-limit adjustment on a preserved continuation. Neither is permitted by the current instruction to use the unchanged compatible CLI and implementation; no such adjustment was made.

## Current outcome and progress

There is **no final decision yet**. Pending candidate is `c463a83741f85a1ce34d46d427d25ea302f9ea50544fbf5ea4f08a30374e9198` (`late_miners` 1 → 2). Current champion remains `e539c7dc8871fff608df8e7316c53b2d4f922456037956d3a7c6f0b23fbeb4bc`.

- Additional completed games: **0**. Total completed games: **790**, in 395 committed pairs; reserved slots: **790**.
- Training is complete: incumbent score **0.625**, candidate **0.640625**, difference **+0.015625**.
- Initial promotion validation remains **22/32** games complete: incumbent 16/16, candidate 6/16. The available six paired candidate games have zero score difference; a full validation score difference and promotion gate remain unavailable.
- Exactly **10 initial validation games** remain. The unchanged conditional extra panel would add **32** only if initial validation is rejected with nonnegative delta and zero paired regressions. Neither panel was launched.
- Iteration remains **24**, pending candidate is unchanged, and promotions remain **0**.

Frozen opponents, seeds, physical sides, scoring and gates remain untouched. The requested execution is blocked by the inspected CLI boundary semantics, rather than by candidate rejection or an execution failure.
