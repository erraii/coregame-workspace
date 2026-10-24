import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {designProperties} from './strategy-model.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const bot=path.join(root,'bots/c/bot/tactical-bot');

test('fast carrier is legal; armed speed designs are not legal under demo rules',()=>{
 const config=JSON.parse(fs.readFileSync(path.join(root,'bots/configs/fake_demo/game.config.json')));
 const c=designProperties(config,['speed','gem_carrying_efficiency']);
 assert.equal(c.cost,52);assert.equal(c.properties.baseActionCooldown,1);
 assert.equal(c.properties.gemsPerCooldownStep,20);
 assert.equal(c.properties.damageCore+c.properties.damageUnit+c.properties.damageObject,0);
 assert.throws(()=>designProperties(config,['speed','mining']),/Illegal/);
});

test('handoff reservation, cooldowns, return routing, and unarmed path masks match engine rules',()=>{
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'core-carrier-test-'));
 try{
 fs.writeFileSync(path.join(tmp,'driver.c'),`#include "tactics.h"
#include <assert.h>
t_game game;
static unsigned long sent,total;static int travels,creates;static t_pos destination;
t_obj *core_get_obj_from_pos(t_pos p) {
 for(size_t i=0;game.objects[i];i++)if(game.objects[i]->pos.x==p.x&&game.objects[i]->pos.y==p.y)return game.objects[i];
 return NULL;
}
void core_action_createUnit(const char *name,char *component,...){(void)name;(void)component;creates++;}
void core_action_transferGems(const t_obj *u,t_pos p,unsigned long amount){
 (void)p;assert(amount<=u->s_unit.gems);sent++;total+=amount;
}
void core_action_attack(const t_obj *u,const t_obj *o){(void)u;(void)o;}
void core_action_travel(const t_obj *u,t_pos p,t_tile_travelability (*cb)(t_pos,const t_obj *)) {
 travels++;destination=p;
 if(tactics_role(u)==ROLE_CARRIER) {
  assert(cb((t_pos){9,9},u).action==CORE_TRAVEL_BLOCK);
  assert(cb((t_pos){8,9},u).action==CORE_TRAVEL_ATTACK);
 }
}
int main(void){
 t_obj home={.type=OBJ_CORE,.id=1,.hp=99,.pos={0,0},.s_core={.team_id=42,.spawn_cooldown=1}};
 t_obj enemy={.type=OBJ_CORE,.id=2,.hp=99,.pos={19,19},.s_core={.team_id=418}};
 t_obj m={.type=OBJ_UNIT,.id=3,.hp=5,.pos={4,4},.s_unit={.team_id=42,.gems=35,.properties={.base_action_cooldown=3,.damage_object=3,.max_gems=100,.gems_per_cooldown_step=10}}};
 t_obj m2=m;m2.id=4;m2.pos=(t_pos){5,5};
 t_obj carrier={.type=OBJ_UNIT,.id=5,.hp=5,.pos={5,4},.s_unit={.team_id=42,.gems=60,.properties={.base_action_cooldown=1,.max_gems=100,.gems_per_cooldown_step=20}}};
 t_obj wall={.type=OBJ_WALL,.id=6,.hp=77,.pos={9,9}};
 t_obj pile={.type=OBJ_GEM_PILE,.id=7,.hp=1,.pos={8,9},.s_deposit_gems_pile={.gems=35}};
 t_obj *objects[]={&home,&enemy,&m,&m2,&carrier,&wall,&pile,NULL};
 game=(t_game){.my_team_id=42,.grid_size=20,.objects=objects};
 assert(tactics_role(&carrier)==ROLE_CARRIER);
 assert(tactics_cooldown(&carrier,0)==1&&tactics_cooldown(&carrier,35)==2&&tactics_cooldown(&m,35)==6);
 assert(tactics_handoff_amount(&m,&carrier,0)==35);
 assert(tactics_handoff_amount(&m2,&carrier,35)==5);
 assert(tactics_handoff_amount(&m2,&carrier,40)==0);
 carrier.s_unit.action_cooldown=4;assert(tactics_handoff_amount(&m,&carrier,0)==35);
 m.s_unit.action_cooldown=1;assert(tactics_handoff_amount(&m,&carrier,0)==0);m.s_unit.action_cooldown=0;
 carrier.s_unit.action_cooldown=0;
 tactics_tick(100);assert(creates==0&&sent==2&&total==40&&travels==1&&destination.x==0&&destination.y==0);
 carrier.s_unit.team_id=418;assert(tactics_handoff_amount(&m,&carrier,0)==0);
 return 0;
}`);
 const exe=path.join(tmp,'check');
 const build=spawnSync('cc',['-Wall','-Wextra','-Werror','-DTACTICS_TEST','-DENABLE_CARRIERS=1','-I',path.join(root,'bots/c/client_lib/inc'),'-I',path.join(bot,'inc'),path.join(tmp,'driver.c'),path.join(bot,'src/main.c'),'-o',exe],{encoding:'utf8'});
 assert.equal(build.status,0,build.stderr);
 const run=spawnSync(exe,[],{encoding:'utf8'});assert.equal(run.status,0,run.stderr);
 }finally{fs.rmSync(tmp,{recursive:true,force:true});}
});
