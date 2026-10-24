#!/usr/bin/env node
/** Match-based stochastic hill climbing for a small C linear policy. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluate, assertSameLayouts } from './evaluate.mjs';
import { INITIAL, validate, writeHeader, score, randomGenerator, mutate, demoCosts } from './policy-model.mjs';

function args(argv) {
  const o = { root: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'),
    opponent: 'bots/c/bot/gridmaster', iterations: 6, trainSeeds: ['train-001', 'train-002'],
    validationSeeds: ['eval-101', 'eval-102'], maxTicks: 1000, wallSeconds: 120,
    jobs: 4, sigma: 0.6, searchSeed: 42, from: null };
  const names = { '--root': 'root', '--opponent': 'opponent', '--iterations': 'iterations',
    '--train-seeds': 'trainSeeds', '--validation-seeds': 'validationSeeds', '--max-ticks': 'maxTicks',
    '--wall-seconds': 'wallSeconds', '--jobs': 'jobs', '--sigma': 'sigma', '--search-seed': 'searchSeed', '--from': 'from' };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--help') { o.help = true; continue; }
    const field = names[argv[i]];
    if (!field || i + 1 >= argv.length || argv[i + 1].startsWith('--')) throw new Error(`Invalid option: ${argv[i]}`);
    o[field] = field.endsWith('Seeds') ? argv[++i].split(',').map(s => s.trim()) : argv[++i];
  }
  for (const f of ['iterations', 'maxTicks', 'wallSeconds', 'jobs', 'searchSeed']) {
    o[f] = Number(o[f]);
    if (!Number.isSafeInteger(o[f]) || o[f] < (f === 'searchSeed' ? 0 : 1)) throw new Error(`Invalid ${f}`);
  }
  o.sigma = Number(o.sigma);
  if (!Number.isFinite(o.sigma) || o.sigma <= 0) throw new Error('sigma must be positive');
  for (const list of [o.trainSeeds, o.validationSeeds])
    if (!list.length || list.some(s => !s) || new Set(list).size !== list.length) throw new Error('Seed lists must be nonempty and contain no duplicates');
  if (o.trainSeeds.some(s => o.validationSeeds.includes(s))) throw new Error('Training and validation seeds must be disjoint');
  o.root = path.resolve(o.root); o.opponent = path.resolve(o.root, o.opponent);
  if (o.from) o.from = path.resolve(o.root, o.from);
  return o;
}
function json(file, obj) { fs.writeFileSync(file, JSON.stringify(obj, null, 2) + '\n'); }
async function main() {
  const o = args(process.argv.slice(2));
  if (o.help) {
    console.log('Usage: node tools/train.mjs [--iterations 6] [--train-seeds train-001,train-002]\n' +
      '  [--validation-seeds eval-101,eval-102] [--opponent DIR] [--max-ticks 1000]\n' +
      '  [--wall-seconds 120] [--sigma 0.6] [--search-seed 42] [--from MODEL.json] [--jobs 4] [--root DIR]');
    return;
  }
  const lock = path.join(o.root, '.training-lock');
  try { fs.mkdirSync(lock); } catch (e) {
    if (e.code === 'EEXIST') throw new Error('A trainer holds .training-lock. Check for a running trainer before removing a stale lock.'); throw e;
  }
  const bot = path.join(o.root, 'bots/c/bot/policy-bot');
  const headerFile = path.join(bot, 'inc/policy_weights.h');
  let previousHeader; let best = null; let bestScore = null; let work;
  let interrupted = false;
  const signal = () => { interrupted = true; };
  process.on('SIGINT', signal); process.on('SIGTERM', signal);
  try {
    if (fs.existsSync(path.join(o.root, '.match-lock'))) throw new Error('A match runner is active; stop it before training');
    previousHeader = fs.readFileSync(headerFile);
    const config = JSON.parse(fs.readFileSync(path.join(o.root, 'bots/configs/fake_demo/game.config.json')));
    const initial = validate(o.from ? JSON.parse(fs.readFileSync(o.from, 'utf8')) : structuredClone(INITIAL));
    initial.costs = demoCosts(config);
    fs.mkdirSync(path.join(o.root, 'logs'), { recursive: true });
    work = fs.mkdtempSync(path.join(o.root, 'logs/training-'));
    json(path.join(work, 'options.json'), o);
    fs.writeFileSync(path.join(work, 'previous_policy_weights.h'), previousHeader);
    const random = randomGenerator(o.searchSeed);
    const referenceLayouts = new Map();
    const run = async (label, model, seeds) => {
      if (interrupted) throw new Error('Training interrupted');
      validate(model); writeHeader(headerFile, model);
      json(path.join(work, `${label}-policy.json`), model);
      console.log(`\n=== ${label} ===`);
      const result = await evaluate({ root: o.root, a: bot, b: o.opponent, seeds,
        repeats: 1, maxTicks: o.maxTicks, wallSeconds: o.wallSeconds, jobs: o.jobs, build: true });
      if (interrupted) throw new Error('Training interrupted');
      const key = JSON.stringify(seeds);
      if (referenceLayouts.has(key)) assertSameLayouts(referenceLayouts.get(key), result.rows);
      else referenceLayouts.set(key, result.rows);
      const objective = score(result.rows, o.maxTicks);
      const record = { label, score: objective, evaluation: result.directory, summary: result.summary };
      json(path.join(work, `${label}-result.json`), record);
      fs.appendFileSync(path.join(work, 'history.jsonl'), JSON.stringify(record) + '\n');
      console.log(`${label} score=${objective.toFixed(6)}`);
      return { result, objective };
    };
    const first = await run('initial-training', initial, o.trainSeeds);
    best = structuredClone(initial); bestScore = first.objective;
    const saveBest = () => {
      json(path.join(work, 'best_policy.json'), best);
      writeHeader(path.join(work, 'best_policy_weights.h'), best);
      json(path.join(work, 'checkpoint.json'), { score: bestScore, model: 'best_policy.json' });
    };
    saveBest();
    let accepted = 0;
    for (let i = 1; i <= o.iterations; i++) {
      const candidate = mutate(best, random, o.sigma);
      const tested = await run(`candidate-${String(i).padStart(3, '0')}`, candidate, o.trainSeeds);
      if (tested.objective > bestScore + 1e-10) {
        best = candidate; bestScore = tested.objective; accepted++; saveBest();
        console.log('Accepted: better training score.');
      } else console.log('Rejected: training score did not improve.');
    }
    // Holdout results are reported only; they never select a candidate.
    const originalValidation = await run('initial-validation', initial, o.validationSeeds);
    const bestValidation = await run('best-validation', best, o.validationSeeds);
    const portableModel = path.join(bot, 'selected_policy.json');
    json(portableModel, best);
    const summary = {
      initial_training_score: first.objective, best_training_score: bestScore,
      accepted_candidates: accepted, candidates_tested: o.iterations,
      initial_validation_score: originalValidation.objective,
      best_validation_score: bestValidation.objective,
      validation_delta: bestValidation.objective - originalValidation.objective,
      model: path.join(work, 'best_policy.json'),
      portable_model: portableModel,
      exported_header: headerFile,
      policy_scope: 'A 4x8 linear policy selects attacker design or wait; movement remains handwritten.',
      method: 'Stochastic hill climbing from full-match feedback, not gradient-based reinforcement learning.',
      note: 'A training score increase does not establish generalization. No improvement is also a valid result.'
    };
    json(path.join(work, 'summary.json'), summary);
    const example = bestValidation.result.rows.find(r => r.status === 'completed');
    if (example) {
      const source = path.join(bestValidation.result.directory, example.folder, 'replay_latest.json');
      const destination = path.join(o.root, 'visualizer/public/replays');
      fs.mkdirSync(destination, { recursive: true });
      fs.copyFileSync(source, path.join(destination, 'replay_latest.json'));
      summary.published_replay = source;
      json(path.join(work, 'summary.json'), summary);
    }
    console.log('\n=== Training complete ===');
    console.log(JSON.stringify(summary, null, 2));
    console.log('The selected weights are embedded in policy-bot/inc/policy_weights.h.');
    console.log('Refresh the running visualizer to watch one best-policy validation match.');
    console.log(`All training files: ${work}`);
  } finally {
    if (best) writeHeader(headerFile, best);
    else if (previousHeader) fs.writeFileSync(headerFile, previousHeader);
    // Rebuild after the final header write: the last evaluation may have used another candidate.
    // This is done on the next make/evaluation; an interrupted run may leave a different binary.
    process.removeListener('SIGINT', signal); process.removeListener('SIGTERM', signal);
    fs.rmdirSync(lock);
  }
}
main().catch(e => { console.error(`ERROR: ${e.message}`); process.exitCode = 1; });
