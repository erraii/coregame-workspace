import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseDeathEnum, classify, initialLayout, assertSameLayouts, countSuccessfulSpawns, simultaneousCoreDeaths } from './evaluate.mjs';

test('successful spawn counts use unique unit births, components, and team ownership', () => {
  const unit = (id, components, teamId = 42) => ({ id, type: 1, teamId, components, name: 'any' });
  const light = unit(1, ['core_attack']);
  const r = { ticks: {
    '1': { objects: [light, unit(2, ['health', 'core_attack']), unit(3, ['armor', 'core_attack']),
      unit(4, ['core_attack'], 418), unit(5, ['health']), unit(6, ['mining']), unit(7, ['unit_attack','health']), unit(8, ['speed','gem_carrying_efficiency'])] },
    '2': { objects: [{ id: 1, hp: 0 }, light], actions: [{type:'create',name:'PolicyLight'}] },
    '3': { objects: [] }
  } };
  assert.deepEqual(countSuccessfulSpawns(r, 42), {Light:1,Healthy:1,Armored:1,Miner:1,Guard:1,Carrier:1,Other:1});
  assert.deepEqual(countSuccessfulSpawns(r, 418), {Light:1,Healthy:0,Armored:0,Miner:0,Guard:0,Carrier:0,Other:0});
});

test('simultaneous CORE deaths are recognized from final delta state', () => {
  const r={ticks:{'0':{objects:[{id:1,type:0,hp:99},{id:2,type:0,hp:99}]},
    '2':{objects:[{id:1,hp:0},{id:2,hp:0}]}}};
  assert.equal(simultaneousCoreDeaths(r),true);
  r.ticks['2'].objects[1].hp=1;
  assert.equal(simultaneousCoreDeaths(r),false);
});

test('layout fingerprints ignore IDs and CORE state but detect terrain and side changes', () => {
  const r = { ticks: { '0': { objects: [
    {type:0,teamId:42,x:0,y:0,id:2,hp:99}, {type:0,teamId:418,x:19,y:19,id:4,hp:99},
    {type:3,x:2,y:3,id:6,hp:77}
  ] } } };
  const original = initialLayout(r);
  r.ticks['0'].objects.reverse();
  for (const o of r.ticks['0'].objects) { o.id += 100; if (o.type === 0) o.hp--; }
  assert.deepEqual(initialLayout(r), original);
  const rows = [{ seed:'s', a_team_id:42, ...original }];
  assertSameLayouts(rows, rows);
  r.ticks['0'].objects[0].x++;
  assert.throws(() => assertSameLayouts(rows, [{seed:'s',a_team_id:42,...initialLayout(r)}]), /comparison rejected/);
  assert.throws(() => initialLayout({}), /Missing initial/);
});

const codes = { 0: 'NONE_SURVIVED', 1: 'CORE_DESTROYED', 2: 'TIMEOUT_CORE_HP',
  3: 'TIMEOUT_UNIT_HP', 4: 'TIMEOUT_RANDOM', 5: 'TIMEOUT_SENDING_DATA',
  6: 'DISCONNECTED', 7: 'DID_NOT_CONNECT', 8: 'SPAMMED' };
function replay(reason = 1) {
  return { misc: { worldGeneratorSeed: 'eval-001', team_results: [
    { id: 42, place: 0, death_reason: 0 }, { id: 418, place: 1, death_reason: reason }
  ] }, ticks: { '0': { objects: [{type:0,teamId:42,x:0,y:0},{type:0,teamId:418,x:19,y:19}] } },
  full_tick_amount: 123 };
}

test('engine death codes support comments and explicit numeric values', () => {
  assert.deepEqual(parseDeathEnum('enum class D : int { NONE_SURVIVED = 0, /* x */ CORE_DESTROYED, TIMEOUT_SENDING_DATA = 0x05, // x\n DISCONNECTED, };'),
    { 0: 'NONE_SURVIVED', 1: 'CORE_DESTROYED', 5: 'TIMEOUT_SENDING_DATA', 6: 'DISCONNECTED' });
});
test('unsupported enum expressions fail closed', () => {
  assert.equal(parseDeathEnum('enum D { NONE_SURVIVED=0, TIMEOUT_SENDING_DATA=(1 << 2) };'), null);
});
test('side mapping follows bot identity rather than numeric team ID', () => {
  assert.equal(classify(replay(), codes, 'eval-001', 42).outcome_a, 'win');
  assert.equal(classify(replay(), codes, 'eval-001', 418).outcome_a, 'loss');
});
test('game tiebreaks remain distinct from combat', () => {
  assert.equal(classify(replay(2), codes, 'eval-001', 42).decision, 'timeout_tiebreak');
  assert.equal(classify(replay(4), codes, 'eval-001', 42).decision, 'timeout_random');
});
test('disconnects, wrong seeds, ambiguous places, and unknown codes are not wins', () => {
  assert.equal(classify(replay(6), codes, 'eval-001', 42).status, 'execution_failure');
  assert.equal(classify(replay(8), codes, 'eval-001', 42).status, 'execution_failure');
  assert.equal(classify(replay(), codes, 'other-seed', 42).status, 'invalid_result');
  const r = replay(); r.misc.team_results[1].place = 0;
  assert.equal(classify(r, codes, 'eval-001', 42).status, 'invalid_result');
  assert.equal(classify(replay(999), codes, 'eval-001', 42).status, 'invalid_result');
});

const cli = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'evaluate.mjs');
function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'core-eval-test-'));
  for (const dir of ['server/inc', 'server/data', 'bots/configs/fake_demo', 'bots/a', 'bots/b'])
    fs.mkdirSync(path.join(root, dir), { recursive: true });
  fs.writeFileSync(path.join(root, 'server/inc/ReplayEncoder.h'),
    'enum class death_reason_t { NONE_SURVIVED, CORE_DESTROYED, TIMEOUT_CORE_HP, TIMEOUT_UNIT_HP, TIMEOUT_RANDOM, TIMEOUT_SENDING_DATA, DISCONNECTED, DID_NOT_CONNECT };');
  fs.writeFileSync(path.join(root, 'bots/configs/fake_demo/game.config.json'), JSON.stringify({ seed: '', other: 'preserved' }));
  fs.writeFileSync(path.join(root, 'bots/configs/fake_demo/server.config.json'), JSON.stringify({ timeoutTicks: 30000, replayFolderPaths: ['old'] }));
  for (const bot of ['a', 'b']) {
    fs.writeFileSync(path.join(root, `bots/${bot}/Makefile`), '');
    fs.writeFileSync(path.join(root, `bots/${bot}/bot`), '#!/usr/bin/env node\nconst s = require("node:net").connect(4444, "127.0.0.1", () => s.write(process.argv[2]));\n', { mode: 0o755 });
  }
  fs.writeFileSync(path.join(root, 'server/server'), `#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
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

if (process.env.MOCK_MODE === 'hang') { setInterval(() => {}, 1000); }
else if (process.env.MOCK_MODE === 'missing') { process.exit(0); }
else {
  const replay = { misc: { worldGeneratorSeed: gc.seed, team_results: [
    { id: 42, place: 0, death_reason: 0 }, { id: 418, place: 1, death_reason: 1 }
  ] }, ticks: { '0': { objects: [{type:0,teamId:42,x:0,y:0},{type:0,teamId:418,x:19,y:19}] } }, full_tick_amount: 123 };
  if (process.env.MOCK_MODE === 'layout' && path.basename(sc.replayFolderPaths[0]) === '0002')
    replay.ticks['0'].objects.forEach(o => { o.teamId = o.teamId === 42 ? 418 : 42; });
  fs.writeFileSync(path.join(sc.replayFolderPaths[0], 'replay_latest.json'), JSON.stringify(replay));
}
}
`, { mode: 0o755 });
  return root;
}
function invoke(root, mode = 'normal', wall = 5, extra = []) {
  return new Promise((resolve, reject) => {
    const p = spawn(process.execPath, [cli, '--root', root, '--a', 'bots/a', '--b', 'bots/b',
      '--no-build', '--wall-seconds', String(wall), ...extra], { env: { ...process.env, MOCK_MODE: mode } });
    let output = '';
    p.stdout.on('data', d => output += d); p.stderr.on('data', d => output += d);
    p.on('error', reject); p.on('close', code => resolve({ code, output }));
  });
}
function readRun(root) {
  const dir = path.join(root, 'logs', fs.readdirSync(path.join(root, 'logs')).find(n => n.startsWith('evaluation-')));
  return { dir, summary: JSON.parse(fs.readFileSync(path.join(dir, 'summary.json'))),
    rows: fs.readFileSync(path.join(dir, 'results.jsonl'), 'utf8').trim().split('\n').map(s => JSON.parse(s)) };
}
function assertStopped(rows) {
  for (const row of rows) for (const p of row.processes) {
    if (p.pid) assert.throws(() => process.kill(p.pid, 0), { code: 'ESRCH' });
  }
}

test('single-team option runs exactly one match and rejects invalid team lists', async () => {
  const root=fixture();
  try {
    const result=await invoke(root,'normal',5,['--a-teams','418']);
    assert.equal(result.code,0,result.output);
    const run=readRun(root);
    assert.equal(run.summary.total,1);assert.equal(run.rows[0].a_team_id,418);
    assertStopped(run.rows);
    const invalid=await invoke(root,'normal',5,['--a-teams','42,42']);
    assert.equal(invalid.code,1);assert.match(invalid.output,/a-teams must/);
  } finally {fs.rmSync(root,{recursive:true,force:true});}
});

test('CLI creates isolated replays, swaps slots, preserves configs, and cleans processes', async () => {
  const root = fixture();
  try {
    const original = fs.readFileSync(path.join(root, 'bots/configs/fake_demo/game.config.json'), 'utf8');
    const r = await invoke(root); assert.equal(r.code, 0, r.output);
    const run = readRun(root);
    assert.equal(run.summary.wins_a, 1); assert.equal(run.summary.losses_a, 1);
    assert.equal(run.summary.failed, 0);
    assert.deepEqual(run.rows.map(r => r.a_team_id), [42, 418]);
    assert.equal(fs.readFileSync(path.join(root, 'bots/configs/fake_demo/game.config.json'), 'utf8'), original);
    assert.ok(!fs.existsSync(path.join(root, '.match-lock')));
    for (const row of run.rows) assert.ok(fs.existsSync(path.join(run.dir, row.folder, 'replay_latest.json')));
    assertStopped(run.rows);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
test('missing new replays cannot reuse an old result', async () => {
  const root = fixture();
  try {
    fs.mkdirSync(path.join(root, 'replays'));
    fs.writeFileSync(path.join(root, 'replays/replay_latest.json'), JSON.stringify(replay()));
    const r = await invoke(root, 'missing'); assert.equal(r.code, 1, r.output);
    const run = readRun(root); assert.equal(run.summary.completed, 0); assert.equal(run.summary.failed, 2);
    assertStopped(run.rows);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
test('changed physical sides invalidate the comparison', async () => {
  const root = fixture();
  try {
    const r = await invoke(root, 'layout'); assert.equal(r.code, 1, r.output);
    const run = readRun(root);
    assert.equal(run.rows[0].status, 'completed');
    assert.equal(run.rows[1].status, 'invalid_result');
    assert.match(run.rows[1].reason, /Initial layout changed/);
    assertStopped(run.rows);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
test('external wall timeout is a failure, not a loss or draw', async () => {
  const root = fixture();
  try {
    const r = await invoke(root, 'hang', 1); assert.equal(r.code, 1, r.output);
    const run = readRun(root); assert.equal(run.summary.completed, 0); assert.equal(run.summary.wins_a, 0);
    assert.ok(run.rows.every(r => r.status === 'wall_timeout'));
    assertStopped(run.rows);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
test('an existing runner lock is preserved', async () => {
  const root = fixture();
  try {
    fs.mkdirSync(path.join(root, '.match-lock'));
    const r = await invoke(root); assert.equal(r.code, 1, r.output);
    assert.ok(fs.existsSync(path.join(root, '.match-lock')));
    assert.ok(!fs.existsSync(path.join(root, 'logs')));
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
