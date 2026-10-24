import fs from 'node:fs';
import crypto from 'node:crypto';
import { randomGenerator } from './policy-model.mjs';

export const BOUNDS = {
  miners: [0, 3], guards: [0, 5], attacker: [0, 2], return_load: [10, 100],
  economy_until: [0, 800], threat_radius: [2, 20], pile_bonus: [0, 30], home_weight: [0, 4]
};
export const INITIAL_STRATEGY = { version: 1, params: {
  miners: 1, guards: 1, attacker: 1, return_load: 35,
  economy_until: 200, threat_radius: 8, pile_bonus: 12, home_weight: 2
} };
export function validateStrategy(model) {
  if (model?.version !== 1 || !model.params ||
      JSON.stringify(Object.keys(model.params).sort()) !== JSON.stringify(Object.keys(BOUNDS).sort()) ||
      Object.entries(BOUNDS).some(([k, [lo, hi]]) => !Number.isInteger(model.params[k]) || model.params[k] < lo || model.params[k] > hi))
    throw new Error('Invalid strategy parameters');
  return model;
}
export const hash = value => crypto.createHash('sha256').update(value).digest('hex');
export const modelHash = model => hash(JSON.stringify({ version: validateStrategy(model).version,
  params: Object.fromEntries(Object.keys(BOUNDS).map(k => [k, model.params[k]])) }));
export function strategyHeader(model) {
  validateStrategy(model);
  return '#ifndef STRATEGY_PARAMS_H\n#define STRATEGY_PARAMS_H\n#include "strategy.h"\n' +
    `#define STRATEGY_MODEL_SHA256 "${modelHash(model)}"\n` +
    'static const t_strategy strategy_params = {' + Object.keys(BOUNDS).map(k => model.params[k]).join(', ') + '};\n#endif\n';
}
export function exportStrategy(file, model) { fs.writeFileSync(file, strategyHeader(model)); }
export function loadInitialStrategy(file) {
  return validateStrategy(JSON.parse(fs.readFileSync(file,'utf8')));
}
export function mutateStrategy(model, iteration, random) {
  const child = structuredClone(validateStrategy(model));
  // A reproducible local neighborhood: vary a production quota and a targeting/economy parameter.
  const keys = Object.keys(BOUNDS);
  const quota = iteration % 2 ? 'miners' : 'guards';
  const changes = [[quota, random() < 0.75 ? 1 : -1],
    [keys[2 + Math.floor(random() * (keys.length - 2))], random() < 0.5 ? -1 : 1]];
  const steps = {return_load:15, economy_until:100, pile_bonus:8, threat_radius:4};
  for (const [key, sign] of changes) {
    const [lo, hi] = BOUNDS[key];
    let value = child.params[key] + sign * (steps[key] ?? 1);
    if (value < lo || value > hi) value = child.params[key] - sign * (steps[key] ?? 1);
    child.params[key] = Math.max(lo, Math.min(hi, value));
  }
  return child;
}

export function mutationRandom(seed, iteration) {
  // Consume a single reproducible stream. Linear reseeding correlated the secondary
  // parameter choices across neighboring iterations and left large coverage gaps.
  const random=randomGenerator(seed);
  for(let i=0;i<iteration*3;i++)random();
  return random;
}
// Reject changed rules, not just changed prices. This policy implements the inspected demo contract.
export function assertRules(actual, expected) {
  const a = structuredClone(actual), b = structuredClone(expected);
  delete a.seed; delete b.seed;
  if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error('Game rules differ from the supported strategy configuration');
  for (const components of [['core_attack'],['core_attack','health'],['core_attack','armor'],['mining'],['unit_attack','health']])
    designProperties(actual,components);
}
export function designProperties(config, components) {
  const rules=config.components;
  if(components.length>rules.maxComponentsPerUnit)throw new Error('Too many components');
  const properties={...rules.unitDefaultProperties},counts={};let cost=rules.unitDefaultCost;
  for(const id of components){
    const component=rules.components.find(c=>c.id===id);
    if(!component)throw new Error('Unknown component');
    counts[id]=(counts[id]??0)+1;cost+=component.cost;
    for(const modifier of component.properties)properties[modifier.name]+=modifier.modification;
  }
  const expression=e=>{
    if(e.type==='const')return e.value;
    if(e.type==='property')return properties[e.property];
    if(e.type==='component_count')return counts[e.component]??0;
    if(e.type==='sum')return expression(e['1'])+expression(e['2']);
    if(e.type==='less_than')return expression(e['1'])<expression(e['2']);
    if(e.type==='greater_than')return expression(e['1'])>expression(e['2']);
    throw new Error('Unsupported legality expression');
  };
  for(const rule of rules.invalidConditions)if(expression(rule.condition))throw new Error(`Illegal design: ${rule.message}`);
  return {properties,cost};
}
export function production(p, bank, cooldown, tick, miners, guards, resources, threatened) {
  if (cooldown) return 5;
  let design = p.attacker;
  if (threatened && guards < p.guards) design = 4;
  else if (resources && tick < p.economy_until && miners < p.miners) design = 3;
  else if (guards < p.guards) design = 4;
  return bank >= [35,47,65,35,47][design] ? design : design <= 2 && bank >= 35 ? 0 : 5;
}
