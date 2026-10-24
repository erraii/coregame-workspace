#!/usr/bin/env node
/** Read-only training-trajectory diagnostics; never reads final-test panels. */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {production} from './strategy-model.mjs';

const read=file=>JSON.parse(fs.readFileSync(file,'utf8'));
const distance=(a,b)=>Math.abs(a.x-b.x)+Math.abs(a.y-b.y);
const living=o=>o.hp>0;
function choose(objects,score) {
  let best=null,bestScore=Infinity;
  for(const o of objects){const value=score(o);if(value<bestScore || value===bestScore && best && o.id<best.id){best=o;bestScore=value;}}
  return best;
}
export function decisions(objects,team,tick,p) {
  const home=objects.find(o=>o.type===0 && o.teamId===team);
  const enemy=objects.find(o=>o.type===0 && o.teamId!==team);
  if(!home?.hp || !enemy?.hp)return null;
  const own=objects.filter(o=>o.type===1 && o.teamId===team && living(o));
  const enemies=objects.filter(o=>o.type===1 && o.teamId!==team && living(o));
  const miners=own.filter(o=>o.properties.damageObject>0),guards=own.filter(o=>o.properties.damageUnit>0);
  const resources=objects.filter(o=>[2,4].includes(o.type) && living(o) && o.gems>0);
  const spawn=production(p,home.gems,home.SpawnCooldown,tick,miners.length,guards.length,resources.length,
    enemies.some(o=>distance(home,o)<=p.threat_radius));
  const minerActions={},guardActions={};
  for(const unit of miners.filter(o=>o.ActionCooldown<=0)){
    const target=choose(resources,o=>distance(unit,o)+0.25*distance(home,o)+(o.type===4?-p.pile_bonus:o.hp));
    const returning=unit.gems>0 && (unit.gems>=p.return_load || unit.gems>=unit.properties.maxGems || !target);
    minerActions[unit.id]=returning?'return':target?`gather:${target.id}`:'fallback';
  }
  for(const unit of guards.filter(o=>o.ActionCooldown<=0)){
    const target=choose(enemies,o=>distance(unit,o)+p.home_weight*distance(home,o));
    guardActions[unit.id]=target?`attack:${target.id}`:'fallback';
  }
  return {spawn,minerActions,guardActions};
}
export function auditCheckpoint(checkpoint) {
  const state=read(checkpoint),records=Object.values(state.records);
  const result={checkpoint,method:'Single-parameter counterfactual decisions on recorded training states; not causal estimates of win improvement.',
    final_test_panels_read:0,candidates:[]};
  for(const decision of state.decisions){
    const previous=state.snapshots[decision.incumbent].model.params;
    const candidate=state.snapshots[decision.candidate].model.params;
    const changes=Object.keys(candidate).filter(k=>candidate[k]!==previous[k]);
    const parameters=Object.fromEntries(changes.map(k=>[k,{from:previous[k],to:candidate[k],states:0,
      production_differences:0,miner_decision_differences:0,guard_target_differences:0}]));
    const panels=records.filter(r=>r.label===`iteration-${decision.iteration}-train-incumbent` ||
      r.label===`iteration-${decision.iteration}-train-candidate`);
    const activity=[];
    for(const record of panels)for(const row of record.rows){
      const replay=read(path.join(record.evaluation,row.folder,'replay_latest.json'));
      const objects=new Map(),history=new Map();let delivered=0,pileAttacks=0,depositAttacks=0,unitAttacks=0;
      for(const [tick,data] of Object.entries(replay.ticks).sort(([a],[b])=>Number(a)-Number(b))){
        for(const update of data.objects??[]){
          history.set(update.id,{...history.get(update.id),...update});
          if(update.state==='dead')objects.delete(update.id);
          else objects.set(update.id,{...objects.get(update.id),...update});
        }
        const values=[...objects.values()];
        const base=decisions(values,row.a_team_id,Number(tick),previous);
        if(base)for(const key of changes){
          const alternate=decisions(values,row.a_team_id,Number(tick),{...previous,[key]:candidate[key]});
          const stats=parameters[key];stats.states++;
          if(base.spawn!==alternate.spawn)stats.production_differences++;
          for(const id of Object.keys(base.minerActions))if(base.minerActions[id]!==alternate.minerActions[id])stats.miner_decision_differences++;
          for(const id of Object.keys(base.guardActions))if(base.guardActions[id]!==alternate.guardActions[id])stats.guard_target_differences++;
        }
        for(const action of data.actions??[]){
          const actor=history.get(action.source_id??action.unit_id);
          if(actor?.teamId!==row.a_team_id)continue;
          const home=values.find(o=>o.type===0 && o.teamId===row.a_team_id);
          if(action.type==='transfer_gems' && action.x===home?.x && action.y===home?.y)delivered+=action.amount;
          if(action.type==='attack'){
            const target=history.get(action.target_id);
            if(target?.type===4)pileAttacks++;
            if(target?.type===2)depositAttacks++;
            if(target?.type===1)unitAttacks++;
          }
        }
      }
      activity.push({subject:record.subject,opponent:record.opponent,seed:row.seed,a_team_id:row.a_team_id,
        successful_spawns:row.successful_spawns.a,gems_delivered:delivered,pile_attacks:pileAttacks,deposit_attacks:depositAttacks,unit_attacks:unitAttacks});
    }
    result.candidates.push({iteration:decision.iteration,incumbent:decision.incumbent,candidate:decision.candidate,
      promoted:decision.promoted,changed_parameters:parameters,activity});
  }
  return result;
}
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const checkpoint=process.argv[2];
  if(!checkpoint)throw new Error('Usage: node tools/audit-strategy.mjs CHECKPOINT.json');
  console.log(JSON.stringify(auditCheckpoint(checkpoint),null,2));
}
