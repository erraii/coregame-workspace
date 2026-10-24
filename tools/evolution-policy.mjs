import fs from 'node:fs';
import {hash, designProperties} from './strategy-model.mjs';

// Ordered schema is also the portable C struct layout. Units are documented in LOCAL_EVOLUTION.md.
export const schema={miners:[1,4,2],guards:[1,5,2],carriers:[0,2,0],economy_end:[100,800,400],
  late_miners:[0,3,1],threat_radius:[4,16,12],defense_gain:[0,2,1],
  attack_commit:[0,5,0],avoid_weight:[0,32,16],return_load:[10,100,35],
  carrier_load:[10,100,35],resource_home:[0,4,2],guard_radius:[3,16,12],
  target_bias:[0,3,2],attacker_design:[0,2,1]};
export const initial=()=>Object.fromEntries(Object.entries(schema).map(([k,v])=>[k,v[2]]));
export function validate(p){
  if(JSON.stringify(Object.keys(p).sort())!==JSON.stringify(Object.keys(schema).sort()))throw Error('Parameter schema mismatch');
  for(const [k,[lo,hi]] of Object.entries(schema))if(!Number.isInteger(p[k])||p[k]<lo||p[k]>hi)throw Error(`Invalid parameter ${k}`);
  return p;
}
export function next(state){state.rng=(Math.imul(state.rng,1664525)+1013904223)>>>0;return state.rng/4294967296;}
export function mutate(p,state){
  const q={...p},keys=Object.keys(schema),key=keys[Math.floor(next(state)*keys.length)];
  const [lo,hi]=schema[key],step=['economy_end'].includes(key)?100:['return_load','carrier_load'].includes(key)?15:key==='avoid_weight'?8:1;
  const direction=next(state)<0.5?-1:1;
  q[key]=Math.max(lo,Math.min(hi,p[key]+direction*step));
  if(q[key]===p[key])q[key]=Math.max(lo,Math.min(hi,p[key]-direction*step));
  return {params:validate(q),key};
}
export function decide(p,s){
  let role=0;
  const desired=Math.min(8,p.guards+s.threats*p.defense_gain);
  if(s.threats && s.guards<desired)role=2;
  else if(s.miners<(s.tick<100?1:s.tick<p.economy_end?p.miners:p.late_miners))role=1;
  else if(s.guards<p.guards)role=2;
  else if(s.miners && s.carriers<p.carriers && s.tick<p.economy_end)role=3;
  else if(s.threats>s.guards && s.attackers<p.attack_commit)role=2;
  return s.cooldown||s.bank<[35,47,65][p.attacker_design] && role===0||s.bank<[0,35,47,52][role]?4:role;
}
export function header(p){validate(p);return `#ifndef EVOLUTION_PARAMS_H
#define EVOLUTION_PARAMS_H
typedef struct { int ${Object.keys(schema).join(', ')}; } t_evolution;
static const t_evolution evo = {${Object.keys(schema).map(k=>p[k]).join(',')}};
#define EVOLUTION_DIGEST "${hash(JSON.stringify(p))}"
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
`;}
export function exportHeader(file,p){fs.writeFileSync(file,header(p));}
export function legalDesigns(config){return [['core_attack'],['core_attack','health'],['core_attack','armor'],['mining'],['unit_attack','health'],['speed','gem_carrying_efficiency']].map(d=>designProperties(config,d));}

// Protocol 2: retain single-coordinate search and deliberately explore coupled settings.
export function mutateSearch(p,state){
 if(next(state)>=0.3)return {...mutate(p,state),kind:'single'};
 const groups=[['carriers','carrier_load'],['miners','economy_end'],['guards','defense_gain']];
 const keys=groups[Math.floor(next(state)*groups.length)],q={...p};
 for(const key of keys){
  const [lo,hi]=schema[key],step=key==='economy_end'?100:key==='carrier_load'?15:1;
  const direction=next(state)<0.5?-1:1;
  q[key]=Math.max(lo,Math.min(hi,p[key]+direction*step));
  if(q[key]===p[key])q[key]=Math.max(lo,Math.min(hi,p[key]-direction*step));
 }
 if(keys.includes('carriers')&&q.carriers===0)q.carriers=p.carriers===1?2:1;
 return {params:validate(q),key:keys.join('+'),kind:'joint'};
}
export function dependencySkip(parent,candidate){
 const changed=Object.keys(schema).filter(k=>parent[k]!==candidate[k]);
 return candidate.carriers===0&&changed.length===1&&changed[0]==='carrier_load'
  ?'carrier_load inactive: candidate cannot produce own carriers and worlds start without units':null;
}
export const protocol={version:2,singleProbability:0.7,jointProbability:0.3,
 search:'frozen tactical + current champion + previous champion + rotating older champion',
 validation:'all search opponents plus frozen Gridmaster and linear-policy; two seeds, both physical sides',
 acceptance:'unchanged promotion gate on the entire validation panel; optional one extra two-seed panel',
 budgets:'cumulative seconds/matches/iterations plus independent invocation caps; every pair reserves two slots and two watchdog durations'};
export function searchOpponents(s){
 return [...new Set([s.fixed[0],s.champion,s.history.at(-2),s.history.length>2?s.history[s.iteration%(s.history.length-2)]:null].filter(Boolean))];
}
