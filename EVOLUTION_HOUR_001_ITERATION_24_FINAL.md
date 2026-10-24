# Iteration 24 final decision

The explicit lifecycle-only migration preserved all non-trainer identity fields, verified every frozen snapshot and saved old/new identities in `logs/evolution-hour-001/lifecycle-migration-1792844989558/identities.json`. Original full evidence and trainer are archived in `preserved/evolution-lifecycle-original-20261024/`; the executed lifecycle code is retained in `preserved/evolution-lifecycle-continuation-20261024/`. No policy, evaluator, scoring, seed, opponent or gate change was applied during continuation.

Command: `node tools/evolution.mjs resume --work logs/evolution-hour-001 --finish-pending --additional-matches 42 --additional-seconds 1500 --seconds 5042`. Stored matches/iterations were not reduced.

Final decision: validation rejected. Iteration 25, pending None, status idle. Completed and reserved games: 832 (42 added: 10 missing validation + 32 conditional extra). Additional elapsed: 190.879 seconds, below 25 minutes. Training delta: 0.015625. Final pooled validation incumbent 0.6640625, candidate 0.671875, delta 0.0078125; gains 1, regressions 0. Champion: `e539c7dc8871fff608df8e7316c53b2d4f922456037956d3a7c6f0b23fbeb4bc`. No new candidate began; RNG stayed unchanged.

Initial validation was 0.640625 versus 0.640625: delta 0, no gains or regressions. This required the conditional extra panel. Final rejection conditions: delta below 0.05 and fewer than two paired gains. All 42 new game artifacts were checked against checkpoint rows; 37 combat and 5 HP tiebreaks, zero random or execution failures. The 395 original records, first 24 decisions, RNG and snapshot metadata remained unchanged.

Gate evidence:
```json
{
  "accepted": false,
  "delta": 0.0078125,
  "paired_gains": 1,
  "paired_regressions": 0,
  "approximate_paired_standard_error": 0.0078125,
  "incumbent": {
    "matches": 32,
    "score": 0.6640625,
    "wins": 21,
    "losses": 11,
    "combat_wins": 20,
    "combat_losses": 9,
    "game_limit_tiebreaks": 3,
    "random_tiebreaks": 0,
    "failures": 0,
    "per_opponent": {
      "fbf6f25a4d9cb3c5973ff456654e0a14304b60e4409d0220178593f422d81a8a": {
        "matches": 8,
        "score": 0.15625,
        "wins": 1,
        "losses": 7,
        "combat_wins": 0,
        "combat_losses": 5,
        "game_limit_tiebreaks": 3,
        "random_tiebreaks": 0,
        "failures": 0,
        "successful_spawns": {
          "Light": 0,
          "Healthy": 113,
          "Armored": 0,
          "Miner": 16,
          "Guard": 66,
          "Carrier": 0,
          "Other": 0
        }
      },
      "8473042b4966ba9d75e37423f1db064c7a0c565ff86aa26a5b2e0f9e5b08b0fc": {
        "matches": 8,
        "score": 1,
        "wins": 8,
        "losses": 0,
        "combat_wins": 8,
        "combat_losses": 0,
        "game_limit_tiebreaks": 0,
        "random_tiebreaks": 0,
        "failures": 0,
        "successful_spawns": {
          "Light": 0,
          "Healthy": 49,
          "Armored": 0,
          "Miner": 16,
          "Guard": 47,
          "Carrier": 0,
          "Other": 0
        }
      },
      "f1e7109a8ab401c92361bcf260261139c551256b4863fe0560759cc1b051c4ef": {
        "matches": 8,
        "score": 1,
        "wins": 8,
        "losses": 0,
        "combat_wins": 8,
        "combat_losses": 0,
        "game_limit_tiebreaks": 0,
        "random_tiebreaks": 0,
        "failures": 0,
        "successful_spawns": {
          "Light": 0,
          "Healthy": 53,
          "Armored": 0,
          "Miner": 16,
          "Guard": 43,
          "Carrier": 0,
          "Other": 0
        }
      },
      "e539c7dc8871fff608df8e7316c53b2d4f922456037956d3a7c6f0b23fbeb4bc": {
        "matches": 8,
        "score": 0.5,
        "wins": 4,
        "losses": 4,
        "combat_wins": 4,
        "combat_losses": 4,
        "game_limit_tiebreaks": 0,
        "random_tiebreaks": 0,
        "failures": 0,
        "successful_spawns": {
          "Light": 0,
          "Healthy": 117,
          "Armored": 0,
          "Miner": 16,
          "Guard": 48,
          "Carrier": 0,
          "Other": 0
        }
      }
    }
  },
  "candidate": {
    "matches": 32,
    "score": 0.671875,
    "wins": 21,
    "losses": 11,
    "combat_wins": 20,
    "combat_losses": 8,
    "game_limit_tiebreaks": 4,
    "random_tiebreaks": 0,
    "failures": 0,
    "per_opponent": {
      "fbf6f25a4d9cb3c5973ff456654e0a14304b60e4409d0220178593f422d81a8a": {
        "matches": 8,
        "score": 0.1875,
        "wins": 1,
        "losses": 7,
        "combat_wins": 0,
        "combat_losses": 4,
        "game_limit_tiebreaks": 4,
        "random_tiebreaks": 0,
        "failures": 0,
        "successful_spawns": {
          "Light": 0,
          "Healthy": 113,
          "Armored": 0,
          "Miner": 17,
          "Guard": 66,
          "Carrier": 0,
          "Other": 0
        }
      },
      "8473042b4966ba9d75e37423f1db064c7a0c565ff86aa26a5b2e0f9e5b08b0fc": {
        "matches": 8,
        "score": 1,
        "wins": 8,
        "losses": 0,
        "combat_wins": 8,
        "combat_losses": 0,
        "game_limit_tiebreaks": 0,
        "random_tiebreaks": 0,
        "failures": 0,
        "successful_spawns": {
          "Light": 0,
          "Healthy": 49,
          "Armored": 0,
          "Miner": 16,
          "Guard": 47,
          "Carrier": 0,
          "Other": 0
        }
      },
      "f1e7109a8ab401c92361bcf260261139c551256b4863fe0560759cc1b051c4ef": {
        "matches": 8,
        "score": 1,
        "wins": 8,
        "losses": 0,
        "combat_wins": 8,
        "combat_losses": 0,
        "game_limit_tiebreaks": 0,
        "random_tiebreaks": 0,
        "failures": 0,
        "successful_spawns": {
          "Light": 0,
          "Healthy": 53,
          "Armored": 0,
          "Miner": 16,
          "Guard": 43,
          "Carrier": 0,
          "Other": 0
        }
      },
      "e539c7dc8871fff608df8e7316c53b2d4f922456037956d3a7c6f0b23fbeb4bc": {
        "matches": 8,
        "score": 0.5,
        "wins": 4,
        "losses": 4,
        "combat_wins": 4,
        "combat_losses": 4,
        "game_limit_tiebreaks": 0,
        "random_tiebreaks": 0,
        "failures": 0,
        "successful_spawns": {
          "Light": 0,
          "Healthy": 116,
          "Armored": 0,
          "Miner": 17,
          "Guard": 48,
          "Carrier": 0,
          "Other": 0
        }
      }
    }
  },
  "rule": "At least two opponents and two seeds, delta >= 0.05, >= 2 paired gains, zero paired or per-opponent regressions."
}
```
