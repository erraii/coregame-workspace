#ifndef EVOLUTION_PARAMS_H
#define EVOLUTION_PARAMS_H
typedef struct { int miners, guards, carriers, economy_end, late_miners, threat_radius, defense_gain, attack_commit, avoid_weight, return_load, carrier_load, resource_home, guard_radius, target_bias, attacker_design; } t_evolution;
static const t_evolution evo = {2,2,0,400,1,12,1,0,16,35,35,2,12,2,1};
#define EVOLUTION_DIGEST "ac0fc85a35a56b6f5b395e988a9c1946f3c84b3a6a1b00d5a63df853133213c4"
static inline int evolution_production(t_evolution p, unsigned long bank, int cooldown,
 int tick, int miners, int guards, int attackers, int carriers, int threats) {
 int role=0,desired=p.guards+threats*p.defense_gain;
 if(desired>8)desired=8;
 if(threats && guards<desired)role=2;
 else if(miners<(tick<100?1:tick<p.economy_end?p.miners:p.late_miners))role=1;
 else if(guards<p.guards)role=2;
 else if(miners && carriers<p.carriers && tick<p.economy_end)role=3;
 else if(threats>guards && attackers<p.attack_commit)role=2;
 const int cost[]={35,47,65}; const int specialist[]={0,35,47,52};
 return cooldown || bank<(unsigned long)(role==0?cost[p.attacker_design]:specialist[role])?4:role;
}
#endif
