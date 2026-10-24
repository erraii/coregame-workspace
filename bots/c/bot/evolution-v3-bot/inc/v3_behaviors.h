#ifndef V3_BEHAVIORS_H
#define V3_BEHAVIORS_H
/* Current observed board only. Combat units cannot remove walls/deposits/cores.
 * Reachability is deliberately conservative: occupied cells are not traversed. */
#define V3_CELLS (128*128)
static t_obj *v3_board[V3_CELLS];
static int v3_distance[V3_CELLS],v3_queue[V3_CELLS];
static t_pos v3_home;
static int v3_leash,v3_safe,v3_pursuit_radius;
static t_pos v3_pursuit_origin;
typedef struct { unsigned long id,start,until; t_pos origin; int active; } t_hunt_state;
static t_hunt_state v3_hunts[MAX_OBJECTS];
static int v3_enemy(const t_obj *o) {return o&&o->hp&&o->type==OBJ_UNIT&&o->s_unit.team_id!=game.my_team_id;}
static unsigned long v3_damage(unsigned long damage,int armor)
{
    if (armor<0) armor=0;
    if (armor>100) armor=100;
    unsigned long d=(damage*(unsigned long)(100-armor)+50)/100;
    return damage?(d?d:1):0;
}
static int v3_risk(t_pos pos)
{
    int risk=0;
    for(size_t i=0;game.objects[i];i++) {
        t_obj *e=game.objects[i];int d=dist(pos,e->pos);
        if(v3_enemy(e)&&e->s_unit.properties.damage_unit&&d<=2)
            risk+=(3-d)*(int)e->s_unit.properties.damage_unit;
    }
    return risk;
}
static t_tile_travelability v3_tile(t_pos pos,const t_obj *u)
{
    if(pos.x>=game.grid_size||pos.y>=game.grid_size)return (t_tile_travelability){0,CORE_TRAVEL_BLOCK};
    if(pos.x==u->pos.x&&pos.y==u->pos.y)return (t_tile_travelability){1,CORE_TRAVEL_PASS};
    if(v3_pursuit_radius&&dist(pos,v3_pursuit_origin)>v3_pursuit_radius)return (t_tile_travelability){0,CORE_TRAVEL_BLOCK};
    if(v3_leash&&dist(pos,v3_home)>v3_leash)return (t_tile_travelability){0,CORE_TRAVEL_BLOCK};
    if(v3_board[pos.y*game.grid_size+pos.x]||(v3_safe&&v3_risk(pos)))return (t_tile_travelability){0,CORE_TRAVEL_BLOCK};
    return (t_tile_travelability){1,CORE_TRAVEL_PASS};
}
static void v3_paths(const t_obj *u,const t_obj *home,int leash,int safe)
{
    int n=game.grid_size*game.grid_size,head=0,tail=0;
    v3_home=home->pos;v3_leash=leash;v3_safe=safe;v3_pursuit_radius=safe==2?evo.hunter_pursuit:0;
    memset(v3_board,0,(size_t)n*sizeof(*v3_board));
    for(int i=0;i<n;i++)v3_distance[i]=INT_MAX;
    for(size_t i=0;game.objects[i];i++) {
        t_obj *o=game.objects[i];
        if(o->hp&&o->pos.x<game.grid_size&&o->pos.y<game.grid_size)v3_board[o->pos.y*game.grid_size+o->pos.x]=o;
    }
    int start=u->pos.y*game.grid_size+u->pos.x;
    v3_distance[start]=0;v3_queue[tail++]=start;
    while(head<tail) {
        int at=v3_queue[head++],x=at%game.grid_size,y=at/game.grid_size;
        const int dx[]={-1,1,0,0},dy[]={0,0,-1,1};
        for(int d=0;d<4;d++) {
            int xx=x+dx[d],yy=y+dy[d];
            if(xx<0||yy<0||xx>=game.grid_size||yy>=game.grid_size)continue;
            int next=yy*game.grid_size+xx;t_pos pos={(unsigned short)xx,(unsigned short)yy};
            if(v3_distance[next]!=INT_MAX||v3_tile(pos,u).action==CORE_TRAVEL_BLOCK)continue;
            v3_distance[next]=v3_distance[at]+1;v3_queue[tail++]=next;
        }
    }
}
static int v3_attack_position(const t_obj *target,t_pos *best)
{
    int distance=INT_MAX;const int dx[]={-1,1,0,0},dy[]={0,0,-1,1};
    for(int d=0;d<4;d++) {
        int x=target->pos.x+dx[d],y=target->pos.y+dy[d];
        if(x<0||y<0||x>=game.grid_size||y>=game.grid_size)continue;
        int path=v3_distance[y*game.grid_size+x];
        if(path<distance){distance=path;*best=(t_pos){(unsigned short)x,(unsigned short)y};}
    }
    return distance;
}
static void v3_anchor(const t_obj *u,const t_obj *home,const t_obj *enemy_core)
{
    t_pos best=u->pos;int score=INT_MAX;
    for(int y=0;y<game.grid_size;y++)for(int x=0;x<game.grid_size;x++) {
        t_pos p={(unsigned short)x,(unsigned short)y};
        if(v3_distance[y*game.grid_size+x]==INT_MAX||dist(p,home->pos)>3)continue;
        int s=8*abs(dist(p,home->pos)-2)+dist(p,enemy_core->pos)+v3_distance[y*game.grid_size+x];
        if(s<score){best=p;score=s;}
    }
    if(dist(best,u->pos))core_action_travel(u,best,v3_tile);
}
static t_obj *v3_defense_target(const t_obj *u,const t_obj *home,t_pos *destination)
{
    t_obj *best=NULL;long best_score=LONG_MAX;
    if(!u->s_unit.properties.damage_unit)return NULL;
    for(size_t i=0;game.objects[i];i++) {
        t_obj *e=game.objects[i];t_pos pos;
        if(!v3_enemy(e)||dist(e->pos,home->pos)>evo.guard_radius)continue;
        int path=v3_attack_position(e,&pos);if(path==INT_MAX)continue;
        unsigned long damage=v3_damage(u->s_unit.properties.damage_unit,e->s_unit.properties.damage_reduction_percent);
        long score=4L*path+2L*dist(e->pos,home->pos)+(long)((e->hp+damage-1)/damage);
        if(e->s_unit.properties.damage_core)score-=200;
        if(!best||score<best_score||(score==best_score&&e->id<best->id)){best=e;best_score=score;*destination=pos;}
    }
    return best;
}
static void v3_defend(const t_obj *u,const t_obj *home,const t_obj *enemy_core)
{
    int outside=dist(u->pos,home->pos)>evo.guard_radius;
    v3_paths(u,home,outside?0:evo.guard_radius,0);
    t_pos destination=u->pos;t_obj *target=outside?NULL:v3_defense_target(u,home,&destination);
    if(target&&dist(u->pos,target->pos)==1)core_action_attack(u,target);
    else if(target)core_action_travel(u,destination,v3_tile);
    else v3_anchor(u,home,enemy_core);
}
static int v3_economic(const t_obj *e)
{
    if(!v3_enemy(e))return 0;
    const t_unit_properties p=e->s_unit.properties;
    return p.damage_object>0||(!p.damage_unit&&!p.damage_core&&(e->s_unit.gems>0||p.gems_per_cooldown_step>10||p.max_gems>100));
}
static int v3_retreat(const t_obj *u,const t_obj *home)
{
    int risk=v3_risk(u->pos);if(!risk)return 0;
    t_pos best=u->pos;int best_risk=risk,best_home=dist(u->pos,home->pos);
    const int dx[]={-1,1,0,0},dy[]={0,0,-1,1};
    for(int d=0;d<4;d++) {
        int x=u->pos.x+dx[d],y=u->pos.y+dy[d];
        if(x<0||y<0||x>=game.grid_size||y>=game.grid_size)continue;
        t_pos p={(unsigned short)x,(unsigned short)y};if(core_get_obj_from_pos(p))continue;
        int r=v3_risk(p),h=dist(p,home->pos);
        if(r<best_risk||(r==best_risk&&r<risk&&h<best_home)){best=p;best_risk=r;best_home=h;}
    }
    if(dist(best,u->pos))core_action_move(u,best);
    return 1; /* No favorable escape: wait, never charge the guard. */
}
static t_hunt_state *v3_hunt_state(const t_obj *u)
{
    t_hunt_state *free_slot=NULL;
    for(size_t i=0;i<MAX_OBJECTS;i++) {
        if(v3_hunts[i].id==u->id)return &v3_hunts[i];
        int living=0;
        for(size_t j=0;game.objects[j];j++)if(owned(game.objects[j])&&game.objects[j]->id==v3_hunts[i].id){living=1;break;}
        if(!living&&!free_slot)free_slot=&v3_hunts[i];
    }
    if(!free_slot)return NULL;
    *free_slot=(t_hunt_state){.id=u->id};return free_slot;
}
static void v3_hunter_fallback(const t_obj *u,const t_obj *home,const t_obj *enemy_core)
{
    /* Escort a reachable forward CORE attacker; otherwise perform the existing home-anchor task. */
    v3_paths(u,home,0,1);t_obj *escort=NULL;t_pos destination=u->pos;int advance=-1;
    for(size_t i=0;game.objects[i];i++) {
        t_obj *a=game.objects[i];t_pos p;
        if(!owned(a)||!a->s_unit.properties.damage_core)continue;
        int path=v3_attack_position(a,&p),forward=dist(home->pos,a->pos);
        if(path==INT_MAX||path>evo.hunter_pursuit)continue;
        if(forward>advance){escort=a;destination=p;advance=forward;}
    }
    if(escort){if(dist(u->pos,destination))core_action_travel(u,destination,v3_tile);}
    else v3_anchor(u,home,enemy_core);
}
static void v3_hunt(const t_obj *u,const t_obj *home,const t_obj *enemy_core,unsigned long tick)
{
    if(v3_retreat(u,home))return;
    t_hunt_state *state=v3_hunt_state(u);
    if(!state){v3_hunter_fallback(u,home,enemy_core);return;}
    if(state->active&&(tick-state->start>=60||dist(u->pos,state->origin)>evo.hunter_pursuit)){
        state->active=0;state->until=tick+30;
    }
    if(tick<state->until){v3_hunter_fallback(u,home,enemy_core);return;}
    t_pos origin=state->active?state->origin:u->pos;v3_pursuit_origin=origin;
    v3_paths(u,home,0,2);t_obj *target=NULL;t_pos destination=u->pos;long score=LONG_MAX;
    for(size_t i=0;game.objects[i];i++) {
        t_obj *e=game.objects[i];t_pos p;
        if(!v3_economic(e)||e->s_unit.properties.damage_unit||v3_risk(e->pos)||dist(e->pos,origin)>evo.hunter_pursuit)continue;
        int path=v3_attack_position(e,&p);if(path==INT_MAX||path>evo.hunter_pursuit)continue;
        long value=4L*path+(long)e->hp-(long)(e->s_unit.gems>100?100:e->s_unit.gems)/5-(e->s_unit.properties.damage_object?12:0);
        if(!target||value<score||(value==score&&e->id<target->id)){target=e;destination=p;score=value;}
    }
    if(!target){state->active=0;v3_hunter_fallback(u,home,enemy_core);return;}
    if(!state->active){state->active=1;state->start=tick;state->origin=u->pos;}
    if(dist(u->pos,target->pos)==1)core_action_attack(u,target);
    else core_action_travel(u,destination,v3_tile);
}
#endif
