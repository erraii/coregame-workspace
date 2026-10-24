#ifndef EVOLUTION_PARAMS_H
#define EVOLUTION_PARAMS_H
#define EVOLUTION_V3 1
typedef struct { int miners, guards, carriers, economy_end, late_miners, threat_radius, defense_gain, attack_commit, avoid_weight, return_load, carrier_load, resource_home, guard_radius, target_bias, attacker_design, defense_mode, defender_design, hunter_quota, hunter_pursuit; } t_evolution;
static const t_evolution evo = {2,3,1,400,1,12,1,0,16,35,50,2,12,2,1,0,0,0,8};
#define EVOLUTION_DIGEST "4a9643a59849926c17c1f70ebc66e0b875a52e10b714362b5a49c01b5c8a0b7d"
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
static inline int evolution_v3_production(t_evolution p, unsigned long bank, int cooldown,
 int tick, int miners, int guards, int attackers, int carriers, int hunters, int threats) {
 if(!p.defense_mode&&!p.hunter_quota)return evolution_production(p,bank,cooldown,tick,miners,guards,attackers,carriers,threats);
 int role=0,desired=p.guards+threats*p.defense_gain;
 if(desired>8)desired=8;
 if(threats&&guards<desired)role=2;
 else if(miners<(tick<100?1:tick<p.economy_end?p.miners:p.late_miners))role=1;
 else if(guards<p.guards)role=2;
 else if(miners&&carriers<p.carriers&&tick<p.economy_end)role=3;
 else if(threats>guards&&attackers<p.attack_commit)role=2;
 else if(hunters<p.hunter_quota)role=5;
 const int attacks[]={35,47,65},guards_cost[]={47,71,137},specialist[]={0,35,47,52,0,59};
 int cost=role==0?attacks[p.attacker_design]:role==2&&p.defense_mode?guards_cost[p.defender_design]:specialist[role];
 return cooldown||bank<(unsigned long)cost?4:role;
}
#endif
