/* Counterfactual action traces from the exact exported C policy on synthetic worlds. */
#define TACTICS_TEST
#include "main.c"
t_game game;
static unsigned long trace;
static void mix(unsigned long n) { trace=(trace^n)*16777619UL; }
t_obj *core_get_obj_from_pos(t_pos p) {
    for(size_t i=0;game.objects[i];i++)if(game.objects[i]->pos.x==p.x&&game.objects[i]->pos.y==p.y)return game.objects[i];
    return NULL;
}
void core_action_createUnit(const char *n,char *c,...) {
    if(n)while(*n)mix((unsigned char)*n++);
    va_list args;va_start(args,c);
    for(char *component=c;component;component=va_arg(args,char *)){
        mix(17);while(*component)mix((unsigned char)*component++);
    }
    va_end(args);
}
void core_action_move(const t_obj *u,t_pos p){mix(4);mix(u->id);mix(p.x);mix(p.y);}
void core_action_attack(const t_obj *u,const t_obj *o){mix(1);mix(u->id);mix(o->id);}
void core_action_transferGems(const t_obj *u,t_pos p,unsigned long a){mix(2);mix(u->id);mix(p.x);mix(p.y);mix(a);}
void core_action_travel(const t_obj *u,t_pos p,t_tile_travelability (*cb)(t_pos,const t_obj *)) {
    mix(3);mix(u->id);mix(p.x);mix(p.y);
    for(int y=0;y<20;y++)for(int x=0;x<20;x++){t_tile_travelability t=cb((t_pos){x,y},u);mix(t.weight);mix(t.action);}
}
int main(void){
    for(int k=0;k<2400;k++) {
        t_obj objects[64]={0};t_obj *ptr[65]={0};int n=0;
        objects[n++]=(t_obj){.type=OBJ_CORE,.id=1,.hp=99,.pos={0,0},.s_core={.team_id=42,.gems=20+(k%17)*15}};
        objects[n++]=(t_obj){.type=OBJ_CORE,.id=2,.hp=99,.pos={19,19},.s_core={.team_id=418}};
        for(int j=0;j<2;j++)objects[n++]=(t_obj){.type=OBJ_GEM_PILE,.id=3+j,.hp=1,.pos={2+j*8,2+j*8},.s_deposit_gems_pile={.gems=35}};
        int counts[]={k%5,(k/5)%5,(k/25)%6,(k/150)%3};
        for(int role=0;role<4;role++)for(int j=0;j<counts[role];j++) {
            t_obj u={.type=OBJ_UNIT,.id=10+n,.hp=8,.pos={2+(j*3+role+k)%14,2+(j+role)%14},.s_unit={.team_id=42,.gems=(k%11)*10,.properties={.max_gems=100,.gems_per_cooldown_step=10,.base_action_cooldown=3}}};
            if(role==0)u.s_unit.properties.damage_core=3;
            if(role==1)u.s_unit.properties.damage_object=3;
            if(role==2)u.s_unit.properties.damage_unit=3;
            objects[n++]=u;
        }
        for(int j=0;j<4;j++)objects[n++]=(t_obj){.type=OBJ_UNIT,.id=100+j,.hp=5+j*3,.pos={2+(k+j*5)%16,2+(k/3+j)%16},.s_unit={.team_id=418,.gems=(k%5)*10,.name="not-a-role-label",.properties={.damage_unit=j==1?3:0,.damage_core=j==0?3:0,.damage_object=j==2?3:0,.gems_per_cooldown_step=j==3?20:10,.max_gems=100,.base_action_cooldown=3}}};
        objects[n++]=(t_obj){.type=OBJ_UNIT,.id=200,.hp=11,.pos={2+k%14,2+(k/5)%14},.s_unit={.team_id=42,.name="V3Hunter",.properties={.damage_unit=3,.max_gems=100,.gems_per_cooldown_step=10,.base_action_cooldown=3}}};
#ifdef EVOLUTION_V3
        memset(v3_hunts,0,sizeof(v3_hunts));
#endif
        for(int j=0;j<n;j++)ptr[j]=&objects[j];
        game=(t_game){.my_team_id=42,.grid_size=20,.objects=ptr};trace=2166136261UL;
        mix((unsigned long)((k%10)*100));mix(game.my_team_id);mix(game.grid_size);
        for(int j=0;j<n;j++) {
            t_obj *o=&objects[j];mix(o->id);mix(o->type);mix(o->hp);mix(o->pos.x);mix(o->pos.y);
            if(o->type==OBJ_CORE){mix(o->s_core.team_id);mix(o->s_core.gems);mix(o->s_core.spawn_cooldown);}
            else if(o->type==OBJ_UNIT){
                mix(o->s_unit.team_id);mix(o->s_unit.gems);mix((unsigned long)o->s_unit.action_cooldown);
                if(o->s_unit.name)for(const char *name=o->s_unit.name;*name;name++)mix((unsigned char)*name);
                const t_unit_properties p=o->s_unit.properties;
                const unsigned long values[]={p.hp,(unsigned long)p.base_action_cooldown,p.gems_per_cooldown_step,p.max_gems,(unsigned long)p.damage_reduction_percent,p.damage_core,p.damage_unit,p.damage_object,p.post_spawn_core_cooldown};
                for(size_t z=0;z<sizeof(values)/sizeof(*values);z++)mix(values[z]);
            } else if(o->type==OBJ_GEM_PILE||o->type==OBJ_DEPOSIT)mix(o->s_deposit_gems_pile.gems);
        }
        unsigned long world=trace;trace=2166136261UL;
        tactics_tick((k%10)*100);printf("%lu %lu\n",world,trace);
    }
    return 0;
}
