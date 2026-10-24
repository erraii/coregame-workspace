# Local evolution run report

Status: idle. Stop: Pending candidate resolved.

Champion: e539c7dc8871fff608df8e7316c53b2d4f922456037956d3a7c6f0b23fbeb4bc

Completed committed games: 832; reserved slots: 832; finalized candidates: 25; evaluated: 19; skipped: 6; promotions: 0.

Rejections/outcomes: {"ineffective/dependency skip":6,"training rejection":13,"validation rejection":6}. Pending: none.

Failures: {}; errors: [{"at":"2026-10-24T12:04:51.803Z","message":"Wall budget reserve reached"}].

| Iteration | Changes from parent | Result | Train delta | Validation delta |
|---|---|---|---:|---:|
| 0 | target_bias: 2 → 3 | ineffective/dependency skip | — | — |
| 1 | miners: 2 → 1 | training rejection | -0.25 | — |
| 2 | return_load: 35 → 50 | training rejection | -0.09375 | — |
| 3 | target_bias: 2 → 1 | ineffective/dependency skip | — | — |
| 4 | target_bias: 2 → 1 | ineffective/dependency skip | — | — |
| 5 | threat_radius: 12 → 13 | training rejection | -0.078125 | — |
| 6 | attack_commit: 0 → 1 | ineffective/dependency skip | — | — |
| 7 | return_load: 35 → 50 | training rejection | -0.09375 | — |
| 8 | economy_end: 400 → 300 | training rejection | 0 | — |
| 9 | attacker_design: 1 → 2 | training rejection | -0.203125 | — |
| 10 | carriers: 0 → 1 | validation rejection: delta below 0.05, paired regressions, opponent-average regression | 0.21875 | 0.015625 |
| 11 | carrier_load: 35 → 20 | training rejection | 0 | — |
| 12 | defense_gain: 1 → 0 | training rejection | -0.0625 | — |
| 13 | guards: 2 → 3 | validation rejection: paired regressions | 0.078125 | 0.109375 |
| 14 | threat_radius: 12 → 11 | training rejection | 0 | — |
| 15 | attack_commit: 0 → 1 | ineffective/dependency skip | — | — |
| 16 | carrier_load: 20 → 10 | training rejection | 0 | — |
| 17 | return_load: 35 → 20 | training rejection | -0.125 | — |
| 18 | late_miners: 1 → 0 | training rejection | 0 | — |
| 19 | guards: 2 → 1 | training rejection | -0.078125 | — |
| 20 | miners: 2 → 3 | validation rejection: paired regressions | 0.03125 | 0.09375 |
| 21 | target_bias: 2 → 3 | ineffective/dependency skip | — | — |
| 22 | threat_radius: 12 → 13 | validation rejection: delta below 0.05, paired regressions, opponent-average regression | 0.0625 | 0.03125 |
| 23 | avoid_weight: 16 → 8 | validation rejection: delta below 0.05, fewer than two paired gains, paired regressions, opponent-average regression | 0.0625 | -0.140625 |
| 24 | late_miners: 1 → 2 | validation rejection: delta below 0.05, fewer than two paired gains | 0.015625 | 0.0078125 |

Per-opponent outcomes (all committed panels, including incumbent controls):

| Opponent | Games | Wins | Losses | Combat | HP | Random |
|---|---:|---:|---:|---:|---:|---:|
| tactical-baseline | 208 | 30 | 178 | 160 | 48 | 0 |
| Gridmaster | 208 | 208 | 0 | 208 | 0 | 0 |
| linear-policy | 208 | 208 | 0 | 208 | 0 | 0 |
| initial-evolution | 208 | 104 | 104 | 123 | 85 | 0 |
