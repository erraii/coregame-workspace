#include "core_lib.h"
#include "policy.h"
#include "policy_weights.h"

static double clamp(double value, double maximum)
{
    if (value < 0.0)
        return 0.0;
    if (value > maximum)
        return maximum;
    return value;
}

static unsigned long distance(t_pos a, t_pos b)
{
    long dx = (long)a.x - (long)b.x;
    long dy = (long)a.y - (long)b.y;

    return (unsigned long)((dx < 0 ? -dx : dx) + (dy < 0 ? -dy : dy));
}

static void on_tick(unsigned long tick)
{
    t_obj *own_core = NULL;
    t_obj *enemy_core = NULL;
    t_obj *obj;
    unsigned int own_units = 0;
    unsigned int enemy_units = 0;
    unsigned long nearest = ULONG_MAX;
    double features[POLICY_FEATURES];
    int available[POLICY_ACTIONS];
    int action;
    int a;
    size_t i;

    if (!game.objects)
        return;
    for (i = 0; game.objects[i]; ++i)
    {
        obj = game.objects[i];
        if (obj->hp == 0)
            continue;
        if (obj->type == OBJ_CORE)
        {
            if (obj->s_core.team_id == game.my_team_id)
                own_core = obj;
            else
                enemy_core = obj;
        }
        else if (obj->type == OBJ_UNIT)
        {
            if (obj->s_unit.team_id == game.my_team_id)
                ++own_units;
            else
                ++enemy_units;
        }
    }
    if (!own_core || !enemy_core)
        return;
    for (i = 0; game.objects[i]; ++i)
    {
        obj = game.objects[i];
        if (obj->hp > 0 && obj->type == OBJ_UNIT && obj->s_unit.team_id != game.my_team_id)
        {
            unsigned long d = distance(own_core->pos, obj->pos);
            if (d < nearest)
                nearest = d;
        }
    }
    features[0] = 1.0;
    features[1] = clamp((double)own_core->s_core.gems / 300.0, 2.0);
    features[2] = clamp((double)own_units / 20.0, 2.0);
    features[3] = clamp((double)enemy_units / 20.0, 2.0);
    features[4] = clamp((double)own_core->hp / 100.0, 1.0);
    features[5] = clamp((double)enemy_core->hp / 100.0, 1.0);
    features[6] = nearest == ULONG_MAX ? 0.0 :
        1.0 - clamp((double)nearest / (2.0 * (game.grid_size ? game.grid_size : 1)), 1.0);
    features[7] = clamp((double)tick / 1000.0, 2.0);
    for (a = 0; a < POLICY_ACTIONS; ++a)
        available[a] = a == 3 || (own_core->s_core.spawn_cooldown == 0 &&
            own_core->s_core.gems >= policy_costs[a]);
    action = policy_choose(features, available);
    /* Distinct design names are shown on the spawned units in the replay. */
    if (action == 0)
        core_action_createUnit("PolicyLight", "core_attack", NULL);
    else if (action == 1)
        core_action_createUnit("PolicyHealthy", "core_attack", "health", NULL);
    else if (action == 2)
        core_action_createUnit("PolicyArmored", "core_attack", "armor", NULL);

    /* Movement is a fixed baseline; only the production policy is learned. */
    for (i = 0; game.objects[i]; ++i)
    {
        obj = game.objects[i];
        if (obj->hp > 0 && obj->type == OBJ_UNIT && obj->s_unit.team_id == game.my_team_id &&
            obj->s_unit.action_cooldown <= 0)
            core_action_travel(obj, enemy_core->pos, NULL);
    }
}

int main(int argc, char **argv)
{
    return core_startGame("Thus Spoke the Prompt - Policy", argc, argv, on_tick, false);
}
