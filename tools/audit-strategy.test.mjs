import test from 'node:test';
import assert from 'node:assert/strict';
import {decisions} from './audit-strategy.mjs';
import {INITIAL_STRATEGY} from './strategy-model.mjs';

function state() {
  return [
    {id:1,type:0,teamId:42,hp:99,x:0,y:0,gems:300,SpawnCooldown:0},
    {id:2,type:0,teamId:418,hp:99,x:19,y:19,gems:300,SpawnCooldown:0},
    {id:3,type:1,teamId:42,hp:5,x:1,y:0,gems:35,ActionCooldown:0,properties:{damageObject:3,damageUnit:0,maxGems:100}},
    {id:4,type:1,teamId:42,hp:8,x:8,y:0,gems:0,ActionCooldown:0,properties:{damageObject:0,damageUnit:3,maxGems:100}},
    {id:10,type:1,teamId:418,hp:5,x:9,y:0},
    {id:11,type:1,teamId:418,hp:5,x:2,y:0},
    {id:20,type:4,hp:1,x:3,y:0,gems:35},
    {id:21,type:4,hp:1,x:4,y:0,gems:35}
  ];
}
test('trajectory audit detects targeting and return changes and respects cooldown masks',()=>{
  const objects=state(),p=INITIAL_STRATEGY.params;
  const base=decisions(objects,42,10,p);
  assert.equal(base.minerActions[3],'return');
  assert.equal(decisions(objects,42,10,{...p,return_load:50}).minerActions[3],'gather:20');
  assert.equal(decisions(objects,42,10,{...p,return_load:20}).minerActions[3],base.minerActions[3]);
  assert.equal(base.guardActions[4],'attack:11');
  assert.equal(decisions(objects,42,10,{...p,home_weight:0}).guardActions[4],'attack:10');
  objects[0].SpawnCooldown=1;
  assert.equal(decisions(objects,42,10,{...p,guards:3}).spawn,5);
});
test('pile preference is inert when comparing only intact loose piles',()=>{
  const p={...INITIAL_STRATEGY.params,return_load:50};
  assert.deepEqual(decisions(state(),42,10,p),decisions(state(),42,10,{...p,pile_bonus:0}));
});
