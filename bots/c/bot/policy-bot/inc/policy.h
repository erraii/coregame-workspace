#ifndef POLICY_H
#define POLICY_H

#define POLICY_ACTIONS 4
#define POLICY_FEATURES 8

/* Actions: light attacker, healthy attacker, armored attacker, wait.
 * Features: bias, bank, own units, enemy units, own core HP,
 * enemy core HP, nearest enemy threat, elapsed ticks. */
void policy_scores(const double features[POLICY_FEATURES], double scores[POLICY_ACTIONS]);
int policy_choose(const double features[POLICY_FEATURES], const int available[POLICY_ACTIONS]);

#endif
