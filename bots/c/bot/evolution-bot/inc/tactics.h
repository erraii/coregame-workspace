#ifndef TACTICS_H
#define TACTICS_H
#include "core_lib.h"
#ifndef ENABLE_CARRIERS
#define ENABLE_CARRIERS 1
#endif
enum { ROLE_ATTACKER, ROLE_MINER, ROLE_GUARD, ROLE_CARRIER };
int tactics_role(const t_obj *u);
unsigned long tactics_handoff_amount(const t_obj *m, const t_obj *c, unsigned long reserved);
unsigned long tactics_cooldown(const t_obj *u, unsigned long cargo);
void tactics_tick(unsigned long tick);
#endif
