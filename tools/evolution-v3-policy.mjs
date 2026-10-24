import fs from 'node:fs';
import {hash,designProperties} from './strategy-model.mjs';
import {schema as legacySchema,validate as validateLegacy,next,decide as legacyDecide} from './evolution-policy.mjs';
export {next};
export const schema={...legacySchema,guards:[1,5,3],carriers:[0,2,1],carrier_load:[10,100,50],
 defense_mode:[0,1,0],defender_design:[0,2,0],hunter_quota:[0,2,0],hunter_pursuit:[4,16,8]};
export const initial=()=>Object.fromEntries(Object.entries(schema).map(([k,v])=>[k,v[2]]));
export const legacy=p=>Object.fromEntries(Object.keys(legacySchema).map(k=>[k,p[k]]));
export function validate(p){
 if(!p||JSON.stringify(Object.keys(p).sort())!==JSON.stringify(Object.keys(schema).sort()))throw Error('V3 parameter schema mismatch');
 for(const [k,[lo,hi]] of Object.entries(schema))if(!Number.isInteger(p[k])||p[k]<lo||p[k]>hi)throw Error(`Invalid V3 parameter ${k}`);
 return p;
}
export function upgradeChampion(p){validateLegacy(p);return validate({...p,defense_mode:0,defender_design:0,hunter_quota:0,hunter_pursuit:8});}
export const DEFENDER_COSTS=[47,71,137];
export const HUNTER_COST=59;
export const designs={guard:['unit_attack','health'],high_hp:['unit_attack','health','health','health'],armored:['unit_attack','health','armor','armor','armor'],hunter:['unit_attack','health','health']};
export const catalog=config=>Object.fromEntries(Object.entries(designs).map(([name,components])=>[name,{components,...designProperties(config,components)}]));
export function legalDesigns(config){return [...Object.values(catalog(config)),...['core_attack','mining'].map(c=>designProperties(config,[c])),designProperties(config,['core_attack','health']),designProperties(config,['core_attack','armor']),designProperties(config,['speed','gem_carrying_efficiency'])];}
function step(p,key,state){
 const [lo,hi]=schema[key],amount=key==='economy_end'?100:['return_load','carrier_load'].includes(key)?15:key==='avoid_weight'?8:1,sign=next(state)<.5?-1:1;
 let value=Math.max(lo,Math.min(hi,p[key]+sign*amount));if(value===p[key])value=Math.max(lo,Math.min(hi,p[key]-sign*amount));return value;
}
export function mutateSearch(p,state){
 const q={...p};let keys,kind;
 if(next(state)<.3){const groups=[['defense_mode','defender_design'],['hunter_quota','hunter_pursuit'],['carriers','carrier_load'],['guards','defense_gain'],['miners','economy_end']];keys=groups[Math.floor(next(state)*groups.length)];kind='joint';}
 else {keys=[Object.keys(schema)[Math.floor(next(state)*Object.keys(schema).length)]];kind='single';}
 for(const key of keys)q[key]=step(p,key,state);
 if(kind==='joint'&&keys.includes('defense_mode'))q.defense_mode=1;
 if(kind==='joint'&&keys.includes('hunter_quota')&&q.hunter_quota===0)q.hunter_quota=1;
 if(kind==='joint'&&keys.includes('carriers')&&q.carriers===0)q.carriers=1;
 return {params:validate(q),key:keys.join('+'),kind};
}
export function dependencySkip(parent,candidate){
 const changed=Object.keys(schema).filter(k=>parent[k]!==candidate[k]);
 const inactive={carrier_load:candidate.carriers===0,defender_design:candidate.defense_mode===0,hunter_pursuit:candidate.hunter_quota===0};
 if(changed.length&&changed.every(k=>inactive[k]))return 'Inactive role dependencies: '+changed.join(', ');
 return null;
}
export function decide(p,s){
 if(!p.defense_mode&&!p.hunter_quota)return legacyDecide(p,s);
 let role=0;const desired=Math.min(8,p.guards+s.threats*p.defense_gain);
 if(s.threats&&s.guards<desired)role=2;
 else if(s.miners<(s.tick<100?1:s.tick<p.economy_end?p.miners:p.late_miners))role=1;
 else if(s.guards<p.guards)role=2;
 else if(s.miners&&s.carriers<p.carriers&&s.tick<p.economy_end)role=3;
 else if(s.threats>s.guards&&s.attackers<p.attack_commit)role=2;
 else if((s.hunters??0)<p.hunter_quota)role=5;
 const cost=role===0?[35,47,65][p.attacker_design]:role===2&&p.defense_mode?DEFENDER_COSTS[p.defender_design]:[0,35,47,52,0,59][role];
 return s.cooldown||s.bank<cost?4:role;
}
export function header(p){validate(p);return `#ifndef EVOLUTION_PARAMS_H
#define EVOLUTION_PARAMS_H
#define EVOLUTION_V3 1
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
 const int attacks[]={35,47,65},guards_cost[]={${DEFENDER_COSTS.join(',')}},specialist[]={0,35,47,52,0,59};
 int cost=role==0?attacks[p.attacker_design]:role==2&&p.defense_mode?guards_cost[p.defender_design]:specialist[role];
 return cooldown||bank<(unsigned long)cost?4:role;
}
#endif
`;}
export function exportHeader(file,p){fs.writeFileSync(file,header(p));}
export const protocol={version:3,schema_version:3,singleProbability:.7,jointProbability:.3,
 behavior:'optional leashed intercepting defenders, three legal guard designs, bounded economic hunters; disabled features retain V2 action behavior',
 search:'frozen tactical + immutable V2 champion + current/previous/rotating historical champions',
 validation:'all search opponents plus fixed Gridmaster and linear-policy; two distinct stage seeds and both physical sides',
 acceptance:'unchanged positive-training and promotion gates; at most one conditional extra two-seed validation panel',
 budgets:'cumulative seconds/matches/iterations plus invocation caps; paired reservations; no benchmark seeds imported'};
export function searchOpponents(s){return [...new Set([s.fixed[0],s.fixed[3],s.champion,s.history.at(-2),s.history.length>2?s.history[s.iteration%(s.history.length-2)]:null].filter(Boolean))];}
