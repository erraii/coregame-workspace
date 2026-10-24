import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {INITIAL_STRATEGY,BOUNDS,strategyHeader,modelHash,validateStrategy,mutateStrategy,
  production,assertRules,designProperties,mutationRandom,loadInitialStrategy} from './strategy-model.mjs';
import {randomGenerator} from './policy-model.mjs';
import {readJSON,saveJSON,sourceHash,fileHash,verifySnapshot,selectOpponents,
  assertBalanced,fitness,promotion,validateResume,canContinueSearch} from './selfplay-core.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const bot=path.join(root,'bots/c/bot/strategy-bot');
const config=readJSON(path.join(root,'bots/configs/fake_demo/game.config.json'));

test('resume after an early budget stop never restarts search once final selection is frozen',()=>{
  assert.equal(canContinueSearch({iteration:4},6),true);
  assert.equal(canContinueSearch({iteration:4,selection_frozen:true},6),false);
  assert.equal(canContinueSearch({iteration:4,finalized:true},6),false);
  assert.equal(canContinueSearch({iteration:6},6),false);
});

test('demo designs are legal, combined attacks and speed attackers are not',()=>{
  assertRules(config,readJSON(path.join(bot,'supported_game_config.json')));
  for(const [parts,cost] of [[['core_attack'],35],[['core_attack','health'],47],
    [['core_attack','armor'],65],[['mining'],35],[['unit_attack','health'],47]])
    assert.equal(designProperties(config,parts).cost,cost);
  assert.throws(()=>designProperties(config,['core_attack','mining']),/Illegal/);
  assert.throws(()=>designProperties(config,['speed','unit_attack']),/Illegal/);
  const changed=structuredClone(config);changed.idleIncome++;
  assert.throws(()=>assertRules(changed,config),/rules differ/);
});
test('strategy validation, reproducible mutations, and canonical export',()=>{
  const changed=mutateStrategy(INITIAL_STRATEGY,0,randomGenerator(42));
  assert.notDeepEqual(changed,INITIAL_STRATEGY);
  assert.deepEqual(changed,mutateStrategy(INITIAL_STRATEGY,0,randomGenerator(42)));
  const bad=structuredClone(INITIAL_STRATEGY);bad.params.attacker=3;
  assert.throws(()=>validateStrategy(bad));
  assert.ok(strategyHeader(changed).includes(modelHash(changed)));
});
test('fresh runs load the requested incumbent rather than resetting its parameters',()=>{
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'core-incumbent-'));
  try {
    const selected=structuredClone(INITIAL_STRATEGY);selected.params.miners=3;selected.params.return_load=50;
    const file=path.join(tmp,'selected.json');saveJSON(file,selected);
    assert.deepEqual(loadInitialStrategy(file),selected);
    fs.writeFileSync(file,'{}');assert.throws(()=>loadInitialStrategy(file));
  } finally {fs.rmSync(tmp,{recursive:true,force:true});}
});
test('mutation stream covers all eight parameters in the declared six-candidate plan and resumes exactly',()=>{
  const changes=Array.from({length:6},(_,i)=>{
    const child=mutateStrategy(INITIAL_STRATEGY,i,mutationRandom(14,i));
    return Object.keys(BOUNDS).filter(k=>child.params[k]!==INITIAL_STRATEGY.params[k]);
  });
  assert.equal(new Set(changes.flat()).size,8);
  const uninterrupted=randomGenerator(14);
  for(let i=0;i<4*3;i++)uninterrupted();
  const resumed=mutationRandom(14,4);
  assert.deepEqual([resumed(),resumed(),resumed()],[uninterrupted(),uninterrupted(),uninterrupted()]);
});
test('compiled C production and targeting agree with exported parameter model',()=>{
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'core-strategy-parity-'));
  try{
    const model=mutateStrategy(INITIAL_STRATEGY,0,randomGenerator(42));
    fs.writeFileSync(path.join(tmp,'strategy_params.h'),strategyHeader(model));
    fs.writeFileSync(path.join(tmp,'driver.c'),`#include <stdio.h>
#include "strategy.h"
#include "strategy_params.h"
int main(void) {
 unsigned long bank,cd,tick;int miners,guards,resources,threatened;
 while(scanf("%lu %lu %lu %d %d %d %d",&bank,&cd,&tick,&miners,&guards,&resources,&threatened)==7)
 printf("%d %.17g %.17g\\n",strategy_production(strategy_params,bank,cd,tick,miners,guards,resources,threatened),
 strategy_resource_score(strategy_params,5,8,1,1),strategy_guard_score(strategy_params,7,4));
 return 0;
}`);
    const exe=path.join(tmp,'check');
    const result=spawnSync('cc',['-Wall','-Wextra','-Werror','-I',path.join(bot,'inc'),'-I',tmp,
      path.join(tmp,'driver.c'),path.join(bot,'src/strategy.c'),'-o',exe],{encoding:'utf8'});
    assert.equal(result.status,0,result.stderr);
    const cases=[];
    for(const bank of [0,34,35,46,47,64,65,300])for(const cd of [0,1])for(const tick of [0,100,900])
      for(const miners of [0,3])for(const guards of [0,5])for(const resources of [0,1])for(const threat of [0,1])
        cases.push([bank,cd,tick,miners,guards,resources,threat]);
    const checked=spawnSync(exe,[],{input:cases.map(c=>c.join(' ')).join('\n')+'\n',encoding:'utf8'});
    assert.equal(checked.status,0,checked.stderr);
    const lines=checked.stdout.trim().split('\n');assert.equal(lines.length,cases.length);
    lines.forEach((line,i)=>{
      const [action,resource,guard]=line.split(' ').map(Number);
      assert.equal(action,production(model.params,...cases[i]));
      assert.equal(resource,5+0.25*8-model.params.pile_bonus);
      assert.equal(guard,7+model.params.home_weight*4);
    });
    assert.equal(production(INITIAL_STRATEGY.params,300,1,0,0,0,1,1),5);
    assert.equal(production(INITIAL_STRATEGY.params,34,0,0,0,0,1,0),5);
  }finally{fs.rmSync(tmp,{recursive:true,force:true});}
});
test('C executor mines, returns cargo, selects threats, and does not act on cooldown',()=>{
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'core-strategy-executor-'));
  try{
    fs.writeFileSync(path.join(tmp,'strategy_params.h'),strategyHeader(INITIAL_STRATEGY));
    fs.copyFileSync(path.join(bot,'src/main.c'),path.join(tmp,'main.c'));
    fs.writeFileSync(path.join(tmp,'driver.c'),`#include "core_lib.h"
#include "strategy.h"
t_game game;
static int transfers,travels,creates;static t_pos destination;
void core_action_createUnit(const char *name,char *component,...) {(void)name;(void)component;creates++;}
void core_action_transferGems(const t_obj *src,t_pos pos,unsigned long amount) {
 if(src->s_unit.gems!=amount)exit(2);
 transfers++;destination=pos;
}
void core_action_travel(const t_obj *unit,t_pos pos,t_tile_travelability (*cb)(t_pos,const t_obj *)) {
 (void)unit;(void)cb;travels++;destination=pos;
}
int main(void) {
 t_obj home={.type=OBJ_CORE,.hp=99,.pos={0,0},.s_core={.team_id=42,.gems=300,.spawn_cooldown=1}};
 t_obj enemy={.type=OBJ_CORE,.hp=99,.pos={19,19},.s_core={.team_id=418}};
 t_obj miner={.type=OBJ_UNIT,.hp=5,.pos={1,0},.s_unit={.team_id=42,.properties={.damage_object=3,.max_gems=100}}};
 t_obj pile={.type=OBJ_GEM_PILE,.hp=1,.id=4,.pos={3,0},.s_deposit_gems_pile={.gems=35}};
 t_obj threat={.type=OBJ_UNIT,.hp=5,.pos={2,0},.s_unit={.team_id=418}};
 t_obj *objects[]={&home,&enemy,&miner,&pile,&threat,NULL};
 game=(t_game){.my_team_id=42,.grid_size=20,.objects=objects};
 strategy_tick(1);if(creates || travels!=1 || destination.x!=3)return 3;
 miner.s_unit.gems=35;strategy_tick(2);if(transfers!=1 || destination.x!=0)return 4;
 miner.s_unit.action_cooldown=2;strategy_tick(3);if(travels!=1 || transfers!=1)return 5;
 miner.s_unit.action_cooldown=0;miner.s_unit.properties.damage_object=0;miner.s_unit.properties.damage_unit=3;
 strategy_tick(4);if(travels!=2 || destination.x!=2)return 6;
 return 0;
}`);
    const exe=path.join(tmp,'check');
    const result=spawnSync('cc',['-Wall','-Wextra','-Werror','-DSTRATEGY_TEST',
      '-I',path.join(root,'bots/c/client_lib/inc'),'-I',tmp,'-I',path.join(bot,'inc'),path.join(tmp,'driver.c'),
      path.join(tmp,'main.c'),path.join(bot,'src/strategy.c'),'-o',exe],{encoding:'utf8'});
    assert.equal(result.status,0,result.stderr);
    const run=spawnSync(exe,[],{encoding:'utf8'});assert.equal(run.status,0,run.stderr);
  }finally{fs.rmSync(tmp,{recursive:true,force:true});}
});

const row=(seed,team,outcome='loss')=>({seed,a_team_id:team,status:'completed',decision:'combat',outcome_a:outcome,
  initial_layout_sha256:seed,initial_cores:[{team_id:42,x:0,y:0},{team_id:418,x:19,y:19}]});
const panel=(win=false)=>['reference','history'].map(opponent=>({opponent,rows:['p1','p2'].flatMap(s=>
  [row(s,42,win?'win':'loss'),row(s,418,'loss')])}));
test('opponent sample keeps references and rotates immutable history',()=>{
  assert.deepEqual(selectOpponents(['baseline','grid'],['first','second','latest'],0),['baseline','grid','latest','first']);
  assert.deepEqual(selectOpponents(['baseline','grid'],['first','second','latest'],1),['baseline','grid','latest','second']);
});
test('promotion requires paired gains on multiple opponents/seeds without regressions',()=>{
  assert.equal(promotion(panel(),panel(true)).accepted,true);
  assert.equal(promotion(panel(),panel()).accepted,false);
  const candidate=panel(true),incumbent=panel();
  incumbent[0].rows[1].outcome_a='win';
  assert.equal(promotion(incumbent,candidate).accepted,false);
  candidate[0].rows[0].initial_layout_sha256='changed';
  assert.throws(()=>promotion(incumbent,candidate),/Unpaired/);
});
test('fitness rejects failures and neutralizes random decisions; physical balance is checked',()=>{
  assert.equal(fitness({...row('x',42),decision:'timeout_random'}),0.5);
  assert.equal(fitness({...row('x',42),decision:'combat_random'}),0.5);
  assert.equal(fitness({...row('x',42,'win'),decision:'timeout_tiebreak'}),0.75);
  assert.throws(()=>fitness({status:'wall_timeout'}),/fitness rejected/);
  assertBalanced([row('x',42),row('x',418)]);
  assert.throws(()=>assertBalanced([row('x',42),row('x',42)]),/assignments/);
});
test('atomic checkpoints resume with immutable snapshots and reject changed inputs',()=>{
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'core-selfplay-resume-'));
  try{
    fs.mkdirSync(path.join(tmp,'src'));fs.mkdirSync(path.join(tmp,'inc'));
    fs.writeFileSync(path.join(tmp,'src/a.c'),'source');fs.writeFileSync(path.join(tmp,'Makefile'),'all:');
    fs.writeFileSync(path.join(tmp,'bot'),'executable');saveJSON(path.join(tmp,'model.json'),INITIAL_STRATEGY);
    const snapshot={id:'frozen',dir:tmp,model:INITIAL_STRATEGY,source_sha256:sourceHash(tmp),binary_sha256:fileHash(path.join(tmp,'bot')),
      model_file_sha256:fileHash(path.join(tmp,'model.json'))};
    const identity={engine:'fixed',rules:'fixed'};
    const state={version:1,identity,snapshots:{frozen:snapshot},iteration:2,incumbent:'frozen',matches_reserved:8};
    saveJSON(path.join(tmp,'checkpoint.json'),state);
    const resumed=validateResume(readJSON(path.join(tmp,'checkpoint.json')),identity);
    assert.equal(resumed.iteration,2);assert.equal(resumed.matches_reserved,8);
    assert.deepEqual(resumed.snapshots.frozen.model,INITIAL_STRATEGY);
    assert.throws(()=>validateResume(resumed,{engine:'changed'}),/Resume rejected/);
    fs.appendFileSync(path.join(tmp,'bot'),'changed');
    assert.throws(()=>verifySnapshot(snapshot),/Immutable snapshot/);
  }finally{fs.rmSync(tmp,{recursive:true,force:true});}
});
