import fs from 'node:fs';

export const FEATURES = ['bias', 'bank', 'own_units', 'enemy_units', 'own_core_hp', 'enemy_core_hp', 'enemy_threat', 'ticks'];
export const ACTIONS = ['light', 'healthy', 'armored', 'wait'];
export const INITIAL = {
  version: 1, features: FEATURES, actions: ACTIONS,
  weights: [
    [0.4, -0.1, 0, 0, 0, 0, 0, 0],
    [0.0, 0.3, 0, 0, 0, 0, 0, 0],
    [-0.4, 0.5, 0, 0, 0, 0, 0, 0],
    [-0.8, -0.5, 0, 0, 0, 0, 0, 0]
  ],
  costs: [35, 47, 65, 0]
};
export function validate(model) {
  if (model.version !== 1 || JSON.stringify(model.features) !== JSON.stringify(FEATURES) ||
      JSON.stringify(model.actions) !== JSON.stringify(ACTIONS) || !Array.isArray(model.weights) ||
      model.weights.length !== 4 || model.weights.some(row => !Array.isArray(row) || row.length !== 8 || row.some(x => !Number.isFinite(x))) ||
      !Array.isArray(model.costs) || model.costs.length !== 4 || model.costs.some(x => !Number.isSafeInteger(x) || x < 0))
    throw new Error('Invalid policy: expected finite 4x8 weights, the supported feature/action order, and four nonnegative integer costs');
  return model;
}
export function header(model) {
  validate(model);
  return '#ifndef POLICY_WEIGHTS_H\n#define POLICY_WEIGHTS_H\n\n' +
    '/* Exported inference parameters. Training runs outside this executable. */\n' +
    'static const double policy_weights[POLICY_ACTIONS][POLICY_FEATURES] = {\n' +
    model.weights.map(row => '    {' + row.map(x => x.toPrecision(17)).join(', ') + '}').join(',\n') + '\n};\n' +
    'static const unsigned long policy_costs[POLICY_ACTIONS] = {' + model.costs.map(x => `${x}UL`).join(', ') + '};\n\n#endif\n';
}
export function writeHeader(file, model) { fs.writeFileSync(file, header(model)); }
export function score(rows, maxTicks) {
  if (!rows.length || rows.some(r => r.status !== 'completed')) throw new Error('Evaluation failed; no policy score assigned');
  let total = 0;
  for (const r of rows) {
    if (!['win', 'loss'].includes(r.outcome_a) || !['combat', 'combat_random', 'timeout_random', 'timeout_tiebreak'].includes(r.decision))
      throw new Error('Unknown match outcome');
    if (['timeout_random', 'combat_random'].includes(r.decision)) total += 0.5;
    else if (r.decision === 'timeout_tiebreak') total += r.outcome_a === 'win' ? 0.75 : 0.25;
    else if (r.outcome_a === 'win') total += 1 + 0.01 * Math.max(0, Math.min(1, 1 - r.final_tick / maxTicks));
  }
  return total / rows.length;
}
export function randomGenerator(seed) {
  let s = seed >>> 0;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return (s + 0.5) / 4294967296; };
}
export function mutate(model, random, sigma) {
  const child = structuredClone(validate(model));
  for (const row of child.weights) for (let j = 0; j < row.length; j++) {
    const normal = Math.sqrt(-2 * Math.log(random())) * Math.cos(2 * Math.PI * random());
    row[j] = Math.max(-8, Math.min(8, row[j] + sigma * normal));
  }
  return child;
}
export function demoCosts(config) {
  const c = config.components;
  const defaults = c?.unitDefaultProperties;
  const components = c?.components;
  if (!defaults || !Array.isArray(components) || defaults.baseActionCooldown !== 3 ||
      defaults.damageCore !== 0 || defaults.damageUnit !== 0 || defaults.damageObject !== 0 || c.maxComponentsPerUnit < 2)
    throw new Error('Unsupported game configuration: this first policy targets the supplied fake_demo rules');
  const find = id => { const x = components.find(x => x.id === id); if (!x) throw new Error(`Missing component ${id}`); return x; };
  const core = find('core_attack'), hp = find('health'), armor = find('armor');
  const same = (x, name, modification) => Array.isArray(x.properties) && x.properties.length === 1 && x.properties[0].name === name && x.properties[0].modification === modification;
  if (!same(core, 'damageCore', 3) || !same(hp, 'hp', 3) || !same(armor, 'damageReductionPercent', 20))
    throw new Error('Component definitions changed; review the bot designs before training');
  const costs = [c.unitDefaultCost + core.cost, c.unitDefaultCost + core.cost + hp.cost,
    c.unitDefaultCost + core.cost + armor.cost, 0];
  if (costs.some(x => !Number.isSafeInteger(x) || x < 0)) throw new Error('Invalid component cost');
  return costs;
}
