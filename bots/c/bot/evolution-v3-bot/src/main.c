#include "tactics.h"
#include "evolution_params.h"
#include "strategy.h"
#include "strategy_params.h"
#include <float.h>
#include <string.h>

#define MAX_OBJECTS 512
static t_obj *units[MAX_OBJECTS];
static unsigned long incoming[MAX_OBJECTS], claimed[MAX_OBJECTS];
static size_t unit_count, claim_count;
static unsigned int danger[128 * 128];
static int dist(t_pos a, t_pos b) { return abs((int)a.x-b.x)+abs((int)a.y-b.y); }
static int owned(const t_obj *o) { return o->type==OBJ_UNIT && o->hp && o->s_unit.team_id==game.my_team_id; }
int tactics_role(const t_obj *u)
{
    if (evo.hunter_quota>0&&owned(u)&&u->s_unit.properties.damage_unit&&u->s_unit.name&&!strcmp(u->s_unit.name,"V3Hunter")) return ROLE_HUNTER;
    if (u->s_unit.properties.damage_object) return ROLE_MINER;
    if (u->s_unit.properties.damage_unit) return ROLE_GUARD;
    if (u->s_unit.properties.damage_core) return ROLE_ATTACKER;
    return ROLE_CARRIER;
}
unsigned long tactics_cooldown(const t_obj *u, unsigned long cargo)
{
    unsigned long step=u->s_unit.properties.gems_per_cooldown_step;
    unsigned long base=u->s_unit.properties.base_action_cooldown>0?(unsigned long)u->s_unit.properties.base_action_cooldown:0;
    unsigned long cd=base+cargo/(step?step:1);
    return cd?cd:1;
}
unsigned long tactics_handoff_amount(const t_obj *m,const t_obj *c,unsigned long reserved)
{
    unsigned long cap=c->s_unit.properties.max_gems,cargo=c->s_unit.gems,room;
    if (!owned(m)||!owned(c)||tactics_role(c)!=ROLE_CARRIER||m->id==c->id||m->s_unit.action_cooldown>0||
        dist(m->pos,c->pos)!=1||cargo>=cap||reserved>=cap-cargo) return 0;
    room=cap-cargo-reserved;
    return m->s_unit.gems<room?m->s_unit.gems:room;
}
static t_tile_travelability tile(t_pos pos,const t_obj *u)
{
    t_obj *o=core_get_obj_from_pos(pos);
    unsigned long damage=0;
    unsigned int weight=1;
    if (tactics_role(u)!=ROLE_GUARD) weight+=evo.avoid_weight*danger[pos.y*game.grid_size+pos.x];
    if (!o||o->id==u->id) return (t_tile_travelability){weight,CORE_TRAVEL_PASS};
    if (o->type==OBJ_CORE) {
        if (o->s_core.team_id==game.my_team_id) return (t_tile_travelability){0,CORE_TRAVEL_BLOCK};
        damage=u->s_unit.properties.damage_core;
    } else if (o->type==OBJ_UNIT) {
        if (o->s_unit.team_id==game.my_team_id) return (t_tile_travelability){weight+4,CORE_TRAVEL_PASS};
        damage=u->s_unit.properties.damage_unit;
    } else if (o->type==OBJ_GEM_PILE) {
        if (u->s_unit.gems>=u->s_unit.properties.max_gems) return (t_tile_travelability){0,CORE_TRAVEL_BLOCK};
        damage=1; /* Unarmed units can collect loose piles. */
    } else damage=u->s_unit.properties.damage_object;
    if (!damage) return (t_tile_travelability){0,CORE_TRAVEL_BLOCK};
    return (t_tile_travelability){weight+(unsigned int)(o->hp/damage+1),CORE_TRAVEL_ATTACK};
}
static void travel(const t_obj *u,t_pos pos) { core_action_travel(u,pos,tile); }
static t_obj *resource_target(t_obj *u,t_obj *home)
{
    t_obj *best=NULL;
    double best_score=DBL_MAX;
    for (size_t i=0;game.objects[i];i++) {
        t_obj *o=game.objects[i];double score;
        if (!o->hp||(o->type!=OBJ_DEPOSIT&&o->type!=OBJ_GEM_PILE)||!o->s_deposit_gems_pile.gems) continue;
        if (tactics_role(u)==ROLE_CARRIER&&o->type!=OBJ_GEM_PILE) continue;
        if (u->s_unit.gems>=u->s_unit.properties.max_gems&&o->type==OBJ_GEM_PILE) continue;
        score=dist(u->pos,o->pos)+0.25*evo.resource_home*dist(home->pos,o->pos)+(o->type==OBJ_DEPOSIT?o->hp:0);
        for (size_t j=0;j<claim_count;j++) if (claimed[j]==o->id) score+=30;
        for (size_t j=0;game.objects[j];j++) {
            t_obj *e=game.objects[j];
            if (e->type==OBJ_UNIT&&e->hp&&e->s_unit.team_id!=game.my_team_id&&e->s_unit.properties.damage_unit&&dist(e->pos,o->pos)<=4) score+=60;
        }
        if (score<best_score||(score==best_score&&best&&o->id<best->id)) {best=o;best_score=score;}
    }
    if (best&&claim_count<MAX_OBJECTS) claimed[claim_count++]=best->id;
    return best;
}
#include "v3_behaviors.h"
static void create(int role)
{
    if (role==ROLE_HUNTER) core_action_createUnit("V3Hunter","unit_attack","health","health",NULL);
    else if (role==ROLE_GUARD&&evo.defense_mode&&evo.defender_design==1) core_action_createUnit("V3HeavyDefender","unit_attack","health","health","health",NULL);
    else if (role==ROLE_GUARD&&evo.defense_mode&&evo.defender_design==2) core_action_createUnit("V3ArmoredDefender","unit_attack","health","armor","armor","armor",NULL);
    else if (role==ROLE_MINER) core_action_createUnit("TacticalMiner","mining",NULL);
    else if (role==ROLE_GUARD) core_action_createUnit("TacticalGuard","unit_attack","health",NULL);
    else if (role==ROLE_CARRIER) core_action_createUnit("TacticalCarrier","speed","gem_carrying_efficiency",NULL);
    else if(evo.attacker_design==0) core_action_createUnit("EvolutionLight","core_attack",NULL);
    else if(evo.attacker_design==2) core_action_createUnit("EvolutionArmored","core_attack","armor",NULL);
    else core_action_createUnit("TacticalHealthy","core_attack","health",NULL);
}
static void produce(t_obj *home,unsigned long tick,int miners,int guards,int attackers,int carriers,int hunters)
{
    int threats=0;
    for(size_t i=0;game.objects[i];i++) {
        t_obj *o=game.objects[i];
        if(o->type==OBJ_UNIT&&o->hp&&o->s_unit.team_id!=game.my_team_id&&dist(o->pos,home->pos)<=evo.threat_radius) threats++;
    }
    int role=evolution_v3_production(evo,home->s_core.gems,home->s_core.spawn_cooldown,(int)tick,miners,guards,attackers,carriers,hunters,threats);
    if(role!=4)create(role);
}
void tactics_tick(unsigned long tick)
{
    t_obj *home=NULL,*enemy_core=NULL;
    int miners=0,guards=0,attackers=0,carriers=0,hunters=0;
    unsigned long goalie=ULONG_MAX;
    unit_count=0;claim_count=0;
    if (!game.objects||game.grid_size>128) return;
    memset(danger,0,sizeof(danger));
    for (size_t i=0;game.objects[i];i++) {
        t_obj *o=game.objects[i];
        if (o->type==OBJ_CORE) {if (o->s_core.team_id==game.my_team_id) home=o;else enemy_core=o;}
        if (o->type==OBJ_UNIT&&o->hp&&o->s_unit.team_id!=game.my_team_id&&o->s_unit.properties.damage_unit) {
            for (int dy=-1;dy<=1;dy++) for (int dx=-1;dx<=1;dx++) {
                int x=o->pos.x+dx,y=o->pos.y+dy;
                if (abs(dx)+abs(dy)<=1&&x>=0&&y>=0&&x<game.grid_size&&y<game.grid_size) danger[y*game.grid_size+x]++;
            }
        }
        if (owned(o)&&unit_count<MAX_OBJECTS) {
            units[unit_count]=o;incoming[unit_count++]=0;
            if (tactics_role(o)==ROLE_MINER) miners++;
            else if (tactics_role(o)==ROLE_GUARD) {guards++;if (o->id<goalie) goalie=o->id;}
            else if (tactics_role(o)==ROLE_CARRIER) carriers++;
            else if (tactics_role(o)==ROLE_HUNTER) hunters++;
            else attackers++;
        }
    }
    if (!home||!enemy_core||!home->hp||!enemy_core->hp) return;
    produce(home,tick,miners,guards,attackers,carriers,hunters);
    /* Sources push gems, reserving receiver capacity before any actions execute. */
    for (size_t i=0;i<unit_count;i++) {
        t_obj *u=units[i];int handed=0;
        if (tactics_role(u)!=ROLE_MINER||u->s_unit.action_cooldown>0) continue;
        if (u->s_unit.gems&&dist(u->pos,home->pos)==1) {core_action_transferGems(u,home->pos,u->s_unit.gems);continue;}
        for (size_t j=0;(evo.carriers>0)&&j<unit_count;j++) {
            unsigned long amount;
            if (tactics_role(units[j])!=ROLE_CARRIER) continue;
            amount=tactics_handoff_amount(u,units[j],incoming[j]);
            if (!amount) continue;
            incoming[j]+=amount;core_action_transferGems(u,units[j]->pos,amount);handed=1;break;
        }
        if (!handed) {
            t_obj *target=resource_target(u,home);int near=0;
            for (size_t j=0;(evo.carriers>0)&&j<unit_count;j++)
                if (tactics_role(units[j])==ROLE_CARRIER&&dist(u->pos,units[j]->pos)<=6&&
                    units[j]->s_unit.gems+incoming[j]<units[j]->s_unit.properties.max_gems) near=1;
            if (u->s_unit.gems>=(unsigned long)evo.return_load&&!near) travel(u,home->pos);
            else if (target) travel(u,target->pos);
            else if (u->s_unit.gems) travel(u,home->pos);
        }
    }
    for (size_t i=0;i<unit_count;i++) {
        t_obj *u=units[i],*target=NULL;double best=DBL_MAX;int role=tactics_role(u);
        if (role==ROLE_MINER||u->s_unit.action_cooldown>0) continue;
        /* Never forward expected incoming cargo: same-phase transfers are shuffled. */
        if (u->s_unit.gems&&dist(u->pos,home->pos)==1) {core_action_transferGems(u,home->pos,u->s_unit.gems);continue;}
        if (role==ROLE_CARRIER) {
            if (u->s_unit.gems>=(unsigned long)evo.carrier_load||incoming[i]) {travel(u,home->pos);continue;}
            for (size_t j=0;j<unit_count;j++) {
                t_obj *m=units[j];double score;
                if (tactics_role(m)!=ROLE_MINER||!m->s_unit.gems||dist(m->pos,home->pos)<3) continue;
                score=dist(u->pos,m->pos)-(double)m->s_unit.gems/10;
                if (score<best) {best=score;target=m;}
            }
            if (!target) target=resource_target(u,home);
            if (target) travel(u,target->pos);else if (u->s_unit.gems) travel(u,home->pos);
            continue;
        }
        if (role==ROLE_HUNTER) {v3_hunt(u,home,enemy_core,tick);continue;}
        if (role==ROLE_GUARD&&evo.defense_mode) {v3_defend(u,home,enemy_core);continue;}
        if (role==ROLE_ATTACKER&&dist(u->pos,enemy_core->pos)==1) {core_action_attack(u,enemy_core);continue;}
        if (role==ROLE_GUARD) {
            for (size_t j=0;game.objects[j];j++) {
                t_obj *o=game.objects[j];double score;
                if (o->type!=OBJ_UNIT||!o->hp||o->s_unit.team_id==game.my_team_id) continue;
                if (u->id==goalie&&dist(o->pos,home->pos)>evo.guard_radius) continue;
                score=dist(u->pos,o->pos)*3+o->hp;
                if (o->s_unit.properties.damage_core&&dist(o->pos,home->pos)<=14) score-=100*evo.target_bias;
                if (dist(o->pos,home->pos)<=6) score-=120;
                if (dist(u->pos,o->pos)==1) score-=1000;
                for (size_t k=0;k<unit_count;k++)
                    if (tactics_role(units[k])==ROLE_ATTACKER&&dist(units[k]->pos,o->pos)<=3&&o->s_unit.properties.damage_unit) score-=30;
                if (score<best||(score==best&&target&&o->id<target->id)) {best=score;target=o;}
            }
            if (target&&dist(u->pos,target->pos)==1) core_action_attack(u,target);
            else if (target) travel(u,target->pos);
            else if (u->id==goalie) {
                t_pos anchor={(unsigned short)(home->pos.x?home->pos.x-2:2),(unsigned short)(home->pos.y?home->pos.y-2:2)};
                travel(u,anchor);
            } else travel(u,enemy_core->pos);
        } else {
            if(attackers<evo.attack_commit && dist(u->pos,enemy_core->pos)>2)travel(u,home->pos);
            else travel(u,enemy_core->pos);
        }
    }
}
#ifndef TACTICS_TEST
int main(int argc,char **argv)
{
    printf("Evolution V3; carriers=%d; model=%s\n",(evo.carriers>0),EVOLUTION_DIGEST);
    return core_startGame("CORE Evolution",argc,argv,tactics_tick,false);
}
#endif
