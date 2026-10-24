import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync, spawn } from 'node:child_process';
import { INITIAL, validate, header, score, randomGenerator, mutate, demoCosts } from './policy-model.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const row = (outcome_a, decision, final_tick = 200) => ({ status: 'completed', outcome_a, decision, final_tick });
test('random tiebreak outcomes give no win/loss advantage', () => {
  assert.equal(score([row('win', 'timeout_random')], 1000), 0.5);
  assert.equal(score([row('loss', 'timeout_random')], 1000), 0.5);
  assert.equal(score([row('win', 'combat_random')], 1000), 0.5);
  assert.equal(score([row('loss', 'combat_random')], 1000), 0.5);
});
test('failed matches cannot receive a policy fitness', () => {
  assert.throws(() => score([{ status: 'wall_timeout' }], 1000));
  assert.throws(() => score([], 1000));
});
test('combat and timeout outcomes have explicit ordering', () => {
  assert.ok(score([row('win', 'combat')], 1000) > score([row('win', 'timeout_tiebreak')], 1000));
  assert.ok(score([row('loss', 'timeout_tiebreak')], 1000) > score([row('loss', 'combat')], 1000));
});
test('malformed models and missing/changing component definitions are rejected', () => {
  const bad = structuredClone(INITIAL); bad.weights[0][0] = NaN;
  assert.throws(() => validate(bad));
  assert.throws(() => demoCosts({}));
});
test('the search is repeatable for the same random seed', () => {
  assert.deepEqual(mutate(INITIAL, randomGenerator(42), 0.6), mutate(INITIAL, randomGenerator(42), 0.6));
  assert.notDeepEqual(mutate(INITIAL, randomGenerator(42), 0.6), mutate(INITIAL, randomGenerator(43), 0.6));
});
test('exported C inference matches model scores and respects unavailable actions', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'core-policy-test-'));
  try {
    const include = path.join(root, 'bots/c/bot/policy-bot/inc');
    fs.copyFileSync(path.join(include, 'policy.h'), path.join(tmp, 'policy.h'));
    const model = mutate(INITIAL, randomGenerator(73), 0.7);
    fs.writeFileSync(path.join(tmp, 'policy_weights.h'), header(model));
    // Copy so the compiler resolves the generated header from this isolated test.
    fs.copyFileSync(path.join(root, 'bots/c/bot/policy-bot/src/policy.c'), path.join(tmp, 'policy.c'));
    fs.writeFileSync(path.join(tmp, 'driver.c'), `#include <stdio.h>
#include "policy.h"
int main(void) {
  double x[POLICY_FEATURES], scores[POLICY_ACTIONS]; int available[POLICY_ACTIONS]; int i;
  for (i=0;i<POLICY_FEATURES;i++) if (scanf("%lf", &x[i]) != 1) return 2;
  for (i=0;i<POLICY_ACTIONS;i++) if (scanf("%d", &available[i]) != 1) return 2;
  policy_scores(x, scores);
  for (i=0;i<POLICY_ACTIONS;i++) printf("%.17g ", scores[i]);
  printf("%d\\n", policy_choose(x, available)); return 0;
}
`);
    const exe = path.join(tmp, 'policy-check');
    const build = spawnSync('cc', ['-Wall', '-Wextra', '-Werror', '-I', tmp,
      path.join(tmp, 'driver.c'), path.join(tmp, 'policy.c'), '-o', exe], { encoding: 'utf8' });
    assert.equal(build.status, 0, build.stderr);
    const random = randomGenerator(83);
    for (let n = 0; n < 20; n++) {
      const x = Array.from({ length: 8 }, () => random() * 2);
      const available = n === 0 ? [0, 0, 0, 0] : [n % 2, 1, (n + 1) % 2, 1];
      const r = spawnSync(exe, [], { input: [...x, ...available].join(' ') + '\n', encoding: 'utf8' });
      assert.equal(r.status, 0, r.stderr);
      const out = r.stdout.trim().split(/\s+/).map(Number);
      const expected = model.weights.map(w => w.reduce((s, v, i) => s + v * x[i], 0));
      expected.forEach((v, i) => assert.ok(Math.abs(v - out[i]) < 1e-10));
      let best = -1;
      available.forEach((a, i) => { if (a && (best < 0 || expected[i] > expected[best])) best = i; });
      assert.equal(out[4], best);
    }
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});

function fixture() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'core-train-test-'));
  for (const dir of ['server/inc', 'server/data', 'bots/configs/fake_demo', 'bots/c/client_lib', 'bots/c/bot/policy-bot/inc', 'bots/c/bot/gridmaster'])
    fs.mkdirSync(path.join(tmp, dir), { recursive: true });
  const c = { unitDefaultCost: 20, maxComponentsPerUnit: 5,
    unitDefaultProperties: { baseActionCooldown: 3, damageCore: 0, damageUnit: 0, damageObject: 0 },
    components: [
      { id: 'core_attack', cost: 15, properties: [{ name: 'damageCore', modification: 3 }] },
      { id: 'health', cost: 12, properties: [{ name: 'hp', modification: 3 }] },
      { id: 'armor', cost: 30, properties: [{ name: 'damageReductionPercent', modification: 20 }] }
    ] };
  fs.writeFileSync(path.join(tmp, 'bots/configs/fake_demo/game.config.json'), JSON.stringify({ components: c, seed: '' }));
  fs.writeFileSync(path.join(tmp, 'bots/configs/fake_demo/server.config.json'), JSON.stringify({ timeoutTicks: 30000, replayFolderPaths: [] }));
  fs.writeFileSync(path.join(tmp, 'server/inc/ReplayEncoder.h'), 'enum D { NONE_SURVIVED, CORE_DESTROYED, TIMEOUT_SENDING_DATA, DISCONNECTED, DID_NOT_CONNECT };');
  for (const dir of ['server', 'bots/c/client_lib', 'bots/c/bot/policy-bot', 'bots/c/bot/gridmaster'])
    fs.writeFileSync(path.join(tmp, dir, 'Makefile'), 'all:\n\t@true\ndev: all\n.PHONY: all dev\n');
  for (const name of ['policy-bot', 'gridmaster'])
    fs.writeFileSync(path.join(tmp, 'bots/c/bot', name, 'bot'), '#!/usr/bin/env node\nconst s = require("node:net").connect(4444, "127.0.0.1", () => s.write(process.argv[2]));\n', { mode: 0o755 });
  fs.writeFileSync(path.join(tmp, 'bots/c/bot/policy-bot/inc/policy_weights.h'), header(INITIAL));
  fs.writeFileSync(path.join(tmp, 'server/server'), `#!/usr/bin/env node
const fs = require('node:fs'); const path = require('node:path');
const sc = JSON.parse(fs.readFileSync(process.argv[2]));
const gc = JSON.parse(fs.readFileSync(process.argv[3]));
const sockets = [];
const server = require('node:net').createServer(socket => {
  sockets.push(socket);
  socket.once('data', data => {
    console.log('Accepted team ' + data.toString());
    if (sockets.length === 2) setTimeout(() => { sockets.forEach(s => s.destroy()); server.close(); finish(); }, 80);
  });
});
server.listen(4444, '0.0.0.0', () => console.log('Server listening on port 4444'));
function finish() {

if (!process.env.MOCK_MISSING) fs.writeFileSync(path.join(sc.replayFolderPaths[0], 'replay_latest.json'), JSON.stringify({
  misc: { worldGeneratorSeed: gc.seed, team_results: [{id:42,place:0,death_reason:0},{id:418,place:1,death_reason:1}] },
  ticks: { '0': { objects: [{type:0,teamId:42,x:0,y:0},{type:0,teamId:418,x:19,y:19}] } },
  full_tick_amount: 123
}));
}
`, { mode: 0o755 });
  return tmp;
}
function invoke(tmp, missing = false, overlap = false) {
  return new Promise((resolve, reject) => {
    const p = spawn(process.execPath, [path.join(root, 'tools/train.mjs'), '--root', tmp,
      '--iterations', '2', '--train-seeds', 'train-001', '--validation-seeds', overlap ? 'train-001' : 'eval-101'],
      { env: { ...process.env, ...(missing ? { MOCK_MISSING: '1' } : {}) } });
    let output = '';
    p.stdout.on('data', x => output += x); p.stderr.on('data', x => output += x);
    p.on('error', reject); p.on('close', code => resolve({ code, output }));
  });
}
test('trainer completes search and holdouts, checkpoints policy, and publishes the right replay', async () => {
  const tmp = fixture();
  try {
    const r = await invoke(tmp); assert.equal(r.code, 0, r.output);
    const work = path.join(tmp, 'logs', fs.readdirSync(path.join(tmp, 'logs')).find(n => n.startsWith('training-')));
    const summary = JSON.parse(fs.readFileSync(path.join(work, 'summary.json')));
    assert.equal(summary.candidates_tested, 2); assert.equal(summary.accepted_candidates, 0);
    assert.equal(summary.validation_delta, 0);
    const history = fs.readFileSync(path.join(work, 'history.jsonl'), 'utf8').trim().split('\n').map(s => JSON.parse(s));
    assert.equal(history.length, 5);
    assert.deepEqual(history.map(h => h.label), ['initial-training', 'candidate-001', 'candidate-002', 'initial-validation', 'best-validation']);
    const replay = JSON.parse(fs.readFileSync(path.join(tmp, 'visualizer/public/replays/replay_latest.json')));
    assert.equal(replay.misc.worldGeneratorSeed, 'eval-101');
    assert.equal(fs.readFileSync(path.join(tmp, 'bots/c/bot/policy-bot/inc/policy_weights.h'), 'utf8'), fs.readFileSync(path.join(work, 'best_policy_weights.h'), 'utf8'));
    assert.ok(!fs.existsSync(path.join(tmp, '.match-lock'))); assert.ok(!fs.existsSync(path.join(tmp, '.training-lock')));
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});
test('failed initial evaluation restores the previous policy header', async () => {
  const tmp = fixture();
  try {
    const h = path.join(tmp, 'bots/c/bot/policy-bot/inc/policy_weights.h');
    const before = fs.readFileSync(h, 'utf8');
    const r = await invoke(tmp, true); assert.equal(r.code, 1, r.output);
    assert.equal(fs.readFileSync(h, 'utf8'), before);
    assert.ok(!fs.existsSync(path.join(tmp, '.training-lock')));
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});
test('a better candidate is checkpointed and exported instead of the initial policy', async () => {
  const tmp = fixture();
  try {
    const server = path.join(tmp, 'server/server');
    let source = fs.readFileSync(server, 'utf8');
    source = source.replace('full_tick_amount: 123', `full_tick_amount: (() => {
      const h = fs.readFileSync(path.join(__dirname, '../bots/c/bot/policy-bot/inc/policy_weights.h'), 'utf8');
      return h.includes('0.40000000000000002, -0.10000000000000001') ? 900 : 100;
    })()`);
    fs.writeFileSync(server, source);
    const r = await invoke(tmp); assert.equal(r.code, 0, r.output);
    const work = path.join(tmp, 'logs', fs.readdirSync(path.join(tmp, 'logs')).find(n => n.startsWith('training-')));
    const summary = JSON.parse(fs.readFileSync(path.join(work, 'summary.json')));
    assert.ok(summary.accepted_candidates >= 1);
    assert.ok(summary.best_training_score > summary.initial_training_score);
    const selected = JSON.parse(fs.readFileSync(path.join(work, 'best_policy.json')));
    assert.notDeepEqual(selected.weights, INITIAL.weights);
    assert.equal(fs.readFileSync(path.join(tmp, 'bots/c/bot/policy-bot/inc/policy_weights.h'), 'utf8'), header(selected));
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});

test('training and validation overlap is rejected before running games', async () => {
  const tmp = fixture();
  try {
    const r = await invoke(tmp, false, true); assert.equal(r.code, 1, r.output);
    assert.match(r.output, /must be disjoint/);
    assert.ok(!fs.existsSync(path.join(tmp, 'logs')));
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});

test('trainer rejects changed layouts across candidate evaluations', async () => {
  const tmp = fixture();
  try {
    const server = path.join(tmp, 'server/server');
    const source = fs.readFileSync(server, 'utf8').replace('x:0,y:0', `x:(
      fs.readFileSync(path.join(__dirname, '../bots/c/bot/policy-bot/inc/policy_weights.h'), 'utf8')
        .includes('0.40000000000000002, -0.10000000000000001') ? 0 : 1),y:0`);
    fs.writeFileSync(server, source);
    const r = await invoke(tmp); assert.equal(r.code, 1, r.output);
    assert.match(r.output, /comparison rejected/);
    assert.ok(!fs.existsSync(path.join(tmp, '.match-lock')));
    assert.ok(!fs.existsSync(path.join(tmp, '.training-lock')));
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});
