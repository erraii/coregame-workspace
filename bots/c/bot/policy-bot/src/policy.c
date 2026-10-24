#include "policy.h"
#include "policy_weights.h"

void policy_scores(const double features[POLICY_FEATURES], double scores[POLICY_ACTIONS])
{
    int a;
    int f;

    for (a = 0; a < POLICY_ACTIONS; ++a)
    {
        scores[a] = 0.0;
        for (f = 0; f < POLICY_FEATURES; ++f)
            scores[a] += policy_weights[a][f] * features[f];
    }
}

int policy_choose(const double features[POLICY_FEATURES], const int available[POLICY_ACTIONS])
{
    double scores[POLICY_ACTIONS];
    int best;
    int a;

    policy_scores(features, scores);
    best = -1;
    for (a = 0; a < POLICY_ACTIONS; ++a)
        if (available[a] && (best < 0 || scores[a] > scores[best]))
            best = a;
    return best;
}
