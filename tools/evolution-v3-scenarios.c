#define TACTICS_TEST
#include "main.c"
#include <assert.h>
t_game game;
static t_obj objects[64];static t_obj *pointers[65];static int count,action;static unsigned long target_id;static t_pos destination;
static t_obj *add(t_obj_type type,int x,int y,unsigned long team,unsigned long du,unsigned long dc,unsigned long dm)
{
 t_obj *o=&objects[count];*o=(t_obj){.type=type,.id=(unsigned long)(count+1),.hp=8,.pos={(unsigned short)x,(unsigned short)y}};
 if(type==OBJ_CORE){o->hp=99;o->s_core.team_id=team;}
 if(type==OBJ_UNIT)o->s_unit=(typeof(o->s_unit)){.team_id=team,.properties={.hp=8,.damage_unit=du,.damage_core=dc,.damage_object=dm,.max_gems=100,.base_action_cooldown=3,.gems_per_cooldown_step=10}};
 pointers[count++]=o;pointers[count]=NULL;return o;
}
static void setup(void)
{
 memset(objects,0,sizeof(objects));memset(pointers,0,sizeof(pointers));memset(v3_hunts,0,sizeof(v3_hunts));count=0;action=0;target_id=0;
 game=(t_game){.objects=pointers,.grid_size=20,.my_team_id=42};add(OBJ_CORE,0,0,42,0,0,0);add(OBJ_CORE,19,19,418,0,0,0);
}
t_obj *core_get_obj_from_pos(t_pos p){for(int i=0;i<count;i++)if(objects[i].pos.x==p.x&&objects[i].pos.y==p.y)return &objects[i];return NULL;}
void core_action_createUnit(const char *n,char *c,...){(void)n;(void)c;action=1;}
void core_action_attack(const t_obj *u,const t_obj *target){assert(dist(u->pos,target->pos)==1);assert(u->s_unit.properties.damage_unit>0);action=2;target_id=target->id;}
void core_action_travel(const t_obj *u,t_pos p,t_tile_travelability (*cb)(t_pos,const t_obj *)){
 assert(cb(p,u).action!=CORE_TRAVEL_BLOCK);assert(v3_distance[p.y*game.grid_size+p.x]!=INT_MAX);action=3;destination=p;
}
void core_action_move(const t_obj *u,t_pos p){assert(dist(u->pos,p)==1);assert(!core_get_obj_from_pos(p));action=4;destination=p;}
void core_action_transferGems(const t_obj *u,t_pos p,unsigned long n){(void)u;(void)p;(void)n;action=5;}
int main(void)
{
 t_evolution p=evo;p.defense_mode=1;p.guards=1;p.carriers=0;p.hunter_quota=0;
 const int costs[]={47,71,137};
 for(int d=0;d<3;d++){p.defender_design=d;assert(evolution_v3_production(p,costs[d]-1,0,100,2,0,0,0,0,0)==4);assert(evolution_v3_production(p,costs[d],0,100,2,0,0,0,0,0)==ROLE_GUARD);}
 p.hunter_quota=1;assert(evolution_v3_production(p,58,0,100,2,1,0,0,0,0)==4);assert(evolution_v3_production(p,59,0,100,2,1,0,0,0,0)==ROLE_HUNTER);assert(evolution_v3_production(p,300,1,100,2,1,0,0,0,0)==4);
 assert(v3_damage(3,20)==2&&v3_damage(3,60)==1&&v3_damage(3,100)==1&&v3_damage(0,20)==0);
 setup();t_obj *u=add(OBJ_UNIT,2,2,42,3,0,0),*threat=add(OBJ_UNIT,5,2,418,0,3,0);add(OBJ_UNIT,2,3,418,0,0,3);
 v3_defend(u,&objects[0],&objects[1]);assert(action==3&&dist(destination,threat->pos)==1&&dist(destination,objects[0].pos)<=evo.guard_radius);assert(v3_tile((t_pos){19,18},u).action==CORE_TRAVEL_BLOCK);
 setup();u=add(OBJ_UNIT,2,2,42,3,0,0);threat=add(OBJ_UNIT,5,2,418,0,3,0);add(OBJ_WALL,4,2,0,0,0,0);add(OBJ_WALL,6,2,0,0,0,0);add(OBJ_WALL,5,1,0,0,0,0);add(OBJ_WALL,5,3,0,0,0,0);t_obj *reachable=add(OBJ_UNIT,2,3,418,3,0,0);
 v3_defend(u,&objects[0],&objects[1]);assert(action==2&&target_id==reachable->id); /* enclosed CORE attacker cannot monopolize selection */
 setup();u=add(OBJ_UNIT,2,2,42,3,0,0);add(OBJ_UNIT,18,17,418,0,3,0);v3_defend(u,&objects[0],&objects[1]);assert(action==3&&dist(destination,objects[0].pos)<=3);
 setup();u=add(OBJ_UNIT,17,1,42,3,0,0);v3_defend(u,&objects[0],&objects[1]);assert(action==3&&dist(destination,objects[0].pos)<=3);
 setup();u=add(OBJ_UNIT,2,2,42,3,0,0);threat=add(OBJ_UNIT,3,2,418,0,3,0);v3_defend(u,&objects[0],&objects[1]);assert(action==2&&target_id==threat->id);
 setup();u=add(OBJ_UNIT,2,2,42,3,0,0);u->s_unit.name="V3Hunter";assert(tactics_role(u)==ROLE_HUNTER);t_obj *miner=add(OBJ_UNIT,4,2,418,0,0,3);miner->s_unit.name="totally-unrelated";
 assert(v3_economic(miner));v3_hunt(u,&objects[0],&objects[1],100);assert(action==3&&dist(destination,miner->pos)==1);assert(v3_tile((t_pos){(unsigned short)(u->pos.x+evo.hunter_pursuit+1),u->pos.y},u).action==CORE_TRAVEL_BLOCK);
 action=0;v3_hunt(u,&objects[0],&objects[1],160);t_hunt_state *state=v3_hunt_state(u);assert(!state->active&&state->until==190);assert(action!=2);
 setup();u=add(OBJ_UNIT,2,2,42,3,0,0);miner=add(OBJ_UNIT,3,2,418,0,0,3);v3_hunt(u,&objects[0],&objects[1],0);assert(action==2&&target_id==miner->id);
 setup();u=add(OBJ_UNIT,2,2,42,3,0,0);t_obj *carrier=add(OBJ_UNIT,4,2,418,0,0,0);carrier->s_unit.properties.gems_per_cooldown_step=20;assert(v3_economic(carrier));v3_hunt(u,&objects[0],&objects[1],0);assert(action==3&&dist(destination,carrier->pos)==1);
 setup();u=add(OBJ_UNIT,2,2,42,3,0,0);t_obj *fake=add(OBJ_UNIT,4,2,418,0,3,0);fake->s_unit.name="TacticalMiner";assert(!v3_economic(fake));
 setup();u=add(OBJ_UNIT,2,2,42,3,0,0);add(OBJ_UNIT,17,17,418,0,0,3);t_obj *escort=add(OBJ_UNIT,6,2,42,0,3,0);v3_hunt(u,&objects[0],&objects[1],0);assert(action==3&&dist(destination,escort->pos)==1);
 setup();u=add(OBJ_UNIT,2,2,42,3,0,0);add(OBJ_UNIT,17,17,418,0,0,3);v3_hunt(u,&objects[0],&objects[1],0);assert(action==3&&dist(destination,objects[0].pos)<=3);
 setup();u=add(OBJ_UNIT,2,2,42,3,0,0);miner=add(OBJ_UNIT,4,2,418,0,0,3);add(OBJ_UNIT,5,2,418,3,0,0);v3_hunt(u,&objects[0],&objects[1],0);assert(action!=2&&dist(destination,miner->pos)!=1);
 setup();u=add(OBJ_UNIT,2,2,42,3,0,0);threat=add(OBJ_UNIT,3,2,418,3,0,0);v3_hunt(u,&objects[0],&objects[1],0);assert(action==4&&dist(destination,threat->pos)>1);
 puts("affordability, interception, unreachable targets, leash, retarget, economic properties, pursuit timeout, escort, home fallback and retreat passed");return 0;
}
