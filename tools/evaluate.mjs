#!/usr/bin/env node
/** Sequential, fixed-seed CORE Game evaluation. Requires Node.js 22. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import net from 'node:net';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

function options(argv) {
  const o = { root: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'),
    a: 'bots/c/bot/my-core-bot', b: 'bots/c/bot/gridmaster',
    seeds: ['eval-001'], repeats: 1, maxTicks: 3000, wallSeconds: 180, jobs: 4, build: true };
  const fields = { '--root': 'root', '--a': 'a', '--b': 'b', '--seeds': 'seeds',
    '--repeats': 'repeats', '--max-ticks': 'maxTicks', '--wall-seconds': 'wallSeconds', '--jobs': 'jobs', '--a-teams': 'aTeams' };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === '--help') { o.help = true; continue; }
    if (k === '--no-build') { o.build = false; continue; }
    if (!fields[k] || i + 1 >= argv.length || argv[i + 1].startsWith('--'))
      throw new Error(`Unknown option or missing value: ${k}`);
    const f = fields[k];
    o[f] = f === 'seeds' ? argv[++i].split(',').map(x => x.trim()) :
      f === 'aTeams' ? argv[++i].split(',').map(Number) : argv[++i];
  }
  for (const f of ['repeats', 'maxTicks', 'wallSeconds', 'jobs']) {
    o[f] = Number(o[f]);
    if (!Number.isSafeInteger(o[f]) || o[f] < 1) throw new Error(`Invalid ${f}`);
  }
  if (!o.seeds.length || o.seeds.some(s => !s)) throw new Error('Seeds must be nonempty strings');
  validateATeams(o.aTeams ?? [42, 418]);
  o.root = path.resolve(o.root);
  o.a = path.resolve(o.root, o.a); o.b = path.resolve(o.root, o.b);
  return o;
}

export function validateATeams(teams) {
  if (!Array.isArray(teams) || !teams.length || teams.some(t => ![42,418].includes(t)) || new Set(teams).size !== teams.length)
    throw new Error('a-teams must be 42, 418, or 42,418');
  return teams;
}

function digest(file) { return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'); }
function json(file, value) { fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n'); }
function git(root, args) {
  const r = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  return r.status === 0 ? r.stdout.trim() : null;
}
function headerFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? headerFiles(p) : /\.(h|hpp)$/.test(e.name) ? [p] : [];
  });
}

// Read numeric death codes from the installed engine instead of guessing values.
export function parseDeathEnum(source) {
  source = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  const blocks = [...source.matchAll(/\{([^{}]*)\}/g)];
  for (const [, body] of blocks) {
    if (!/\bNONE_SURVIVED\b/.test(body) || !/\bTIMEOUT_SENDING_DATA\b/.test(body)) continue;
    const result = {}; let value = -1; let valid = true;
    for (const raw of body.split(',')) {
      if (!raw.trim()) continue;
      const m = raw.trim().match(/^([A-Za-z_]\w*)(?:\s*=\s*(0[xX][0-9a-fA-F]+|\d+))?$/);
      if (!m) { valid = false; break; }
      value = m[2] === undefined ? value + 1 : Number(m[2]);
      if (Object.hasOwn(result, value)) { valid = false; break; }
      result[value] = m[1];
    }
    if (valid) return result;
  }
  return null;
}
function engineDeathCodes(root) {
  for (const file of headerFiles(path.join(root, 'server/inc'))) {
    const codes = parseDeathEnum(fs.readFileSync(file, 'utf8'));
    if (codes) return { file: path.relative(root, file), codes };
  }
  throw new Error('Cannot decode death_reason_t safely. Share the header defining it before evaluating.');
}

export function classify(replay, codes, seed, aTeamId) {
  const fail = reason => ({ status: 'invalid_result', reason });
  if (replay?.misc?.worldGeneratorSeed !== seed) return fail('Replay seed does not match the requested seed');
  const teams = replay?.misc?.team_results;
  if (!Array.isArray(teams) || teams.length !== 2 ||
      teams.some(t => ![42, 418].includes(t.id)) || new Set(teams.map(t => t.id)).size !== 2)
    return fail('Expected exactly team IDs 42 and 418');
  const results = teams.map(t => ({ ...t, death_reason_name: codes[t.death_reason] ?? null }));
  if (results.some(t => !t.death_reason_name)) return fail('Unknown numeric death reason');
  if (results.some(t => /DISCONNECT|CONNECT|SENDING_DATA|ERROR|CRASH|SPAMMED/i.test(t.death_reason_name)))
    return { status: 'execution_failure', reason: 'Connection or client failure', teams: results };
  if (results.some(t => !Number.isInteger(t.place) || ![0, 1].includes(t.place)))
    return fail('Unexpected placement');
  const winners = results.filter(t => t.place === 0);
  if (winners.length !== 1 || results.filter(t => t.place === 1).length !== 1)
    return fail('Ambiguous placement: this engine does not establish a draw here');
  const winner = winners[0]; const loser = results.find(t => t.id !== winner.id);
  if (winner.death_reason_name !== 'NONE_SURVIVED') return fail('Winner has an unexpected death reason');
  let decision = 'combat';
  if (/TIMEOUT.*RANDOM|RANDOM.*TIMEOUT/i.test(loser.death_reason_name)) decision = 'timeout_random';
  else if (/TIMEOUT/i.test(loser.death_reason_name)) decision = 'timeout_tiebreak';
  if (!Number.isSafeInteger(replay.full_tick_amount) || replay.full_tick_amount < 0)
    return fail('Missing or invalid final tick');
  return { status: 'completed', winner_team_id: winner.id,
    outcome_a: winner.id === aTeamId ? 'win' : 'loss', decision,
    final_tick: replay.full_tick_amount, teams: results };
}

async function checkPort() {
  await new Promise((resolve, reject) => {
    const s = net.createServer();
    s.once('error', () => reject(new Error('Port 4444 is occupied. Stop the existing match before evaluation.')));
    s.listen({ host: '0.0.0.0', port: 4444, exclusive: true }, () => s.close(resolve));
  });
}
function launch(exe, args, root, logfile, env) {
  const fd = fs.openSync(logfile, 'w');
  let child;
  try { child = spawn(exe, args, { cwd: root, env, stdio: ['ignore', fd, fd] }); }
  finally { fs.closeSync(fd); }
  const state = { child, done: false, code: null, signal: null, error: null };
  state.finished = new Promise(resolve => {
    child.once('error', error => { state.error = error.message; });
    child.once('close', (code, signal) => {
      Object.assign(state, { done: true, code, signal }); resolve(state);
    });
  });
  return state;
}
async function stop(processes) {
  for (const p of processes) if (!p.done) p.child.kill('SIGTERM');
  let timer;
  try {
    await Promise.race([Promise.all(processes.map(p => p.finished)),
      new Promise(resolve => { timer = setTimeout(resolve, 1500); })]);
  } finally { clearTimeout(timer); }
  for (const p of processes) if (!p.done) p.child.kill('SIGKILL');
  await Promise.all(processes.map(p => p.finished));
}
async function waitLog(state, file, message, deadline) {
  while (true) {
    if (fs.readFileSync(file, 'utf8').includes(message)) return;
    if (state.done) throw new Error(`Server exited before ${message}`);
    if (Date.now() >= deadline) throw new Error(`Startup timed out before ${message}`);
    await new Promise(resolve => setTimeout(resolve, 20));
  }
}

export function initialLayout(replay) {
  const objects = replay?.ticks?.['0']?.objects;
  if (!Array.isArray(objects)) throw new Error('Missing initial replay objects');
  const cores = objects.filter(o => o.type === 0).map(o => ({ team_id: o.teamId, x: o.x, y: o.y }))
    .sort((a, b) => a.team_id - b.team_id);
  if (cores.length !== 2 || cores[0].team_id !== 42 || cores[1].team_id !== 418 ||
      cores.some(o => !Number.isInteger(o.x) || !Number.isInteger(o.y)))
    throw new Error('Invalid initial CORE assignments');
  // Exclude object IDs and dynamic CORE state: tick 0 is recorded after the first turn.
  const normalized = objects.filter(o => o.type !== 1).map(o =>
    o.type === 0 ? { type: o.type, x: o.x, y: o.y, teamId: o.teamId } :
      Object.fromEntries(Object.entries(o).filter(([k]) => k !== 'id').sort(([a], [b]) => a.localeCompare(b))))
    .sort((a, b) => a.y - b.y || a.x - b.x || a.type - b.type);
  return { initial_cores: cores, initial_layout_sha256: crypto.createHash('sha256')
    .update(JSON.stringify(normalized)).digest('hex') };
}

export function assertSameLayouts(reference, rows) {
  const expected = new Map(reference.map(r => [`${r.seed}:${r.a_team_id}`, r.initial_layout_sha256]));
  for (const r of rows) {
    const key = `${r.seed}:${r.a_team_id}`;
    if (!r.initial_layout_sha256 || !expected.has(key) || expected.get(key) !== r.initial_layout_sha256)
      throw new Error(`Initial layout changed or missing for ${key}; comparison rejected`);
  }
}

// Count authoritative unit births, not requests or units still alive at match end.
// Replay object deltas contain full fields at birth and may repeat IDs later.
export function countSuccessfulSpawns(replay, teamId) {
  const counts = { Light: 0, Healthy: 0, Armored: 0, Miner: 0, Guard: 0, Carrier: 0, Other: 0 };
  const seen = new Set();
  const designs = new Map([
    ['core_attack', 'Light'], ['core_attack,health', 'Healthy'],
    ['armor,core_attack', 'Armored'], ['mining', 'Miner'], ['health,unit_attack', 'Guard'], ['gem_carrying_efficiency,speed', 'Carrier']
  ]);
  for (const tick of Object.values(replay.ticks ?? {})) for (const obj of tick.objects ?? []) {
    if (obj.type !== 1 || obj.teamId !== teamId || seen.has(obj.id)) continue;
    if (!Number.isSafeInteger(obj.id) || !Array.isArray(obj.components))
      throw new Error('Missing unit ID or components in spawn record');
    seen.add(obj.id);
    const design = designs.get([...obj.components].sort().join(',')) ?? 'Other';
    counts[design]++;
  }
  return counts;
}

export function simultaneousCoreDeaths(replay) {
  const cores = new Map();
  for (const [,tick] of Object.entries(replay.ticks ?? {}).sort(([a],[b])=>Number(a)-Number(b)))
    for(const obj of tick.objects ?? []) {
      if(obj.type===0)cores.set(obj.id,{...obj});
      else if(cores.has(obj.id))Object.assign(cores.get(obj.id),obj);
    }
  return cores.size===2 && [...cores.values()].every(core=>core.hp===0);
}
function build(o, directory) {
  const log = path.join(directory, 'build.log');
  const fd = fs.openSync(log, 'w');
  try {
    const commands = [ ['-C', 'bots/c/client_lib'],
      ...[...new Set([o.a, o.b])].map(d => ['-C', d, `CLIENT_LIB_DIR=${o.root}/bots/c/client_lib`, 'EXEC=bot']),
      ['-C', 'server', 'dev', `JOBS=${o.jobs}`] ];
    for (const args of commands) {
      console.log(`Building: make ${args.join(' ')}`);
      const r = spawnSync('make', args, { cwd: o.root, stdio: ['ignore', fd, fd] });
      if (r.error || r.status !== 0) throw new Error(`Build failed. Inspect ${log}`);
    }
  } finally { fs.closeSync(fd); }
}

export async function evaluate(o) {
  const aTeams = validateATeams(o.aTeams ?? [42, 418]);
  const lock = path.join(o.root, '.match-lock');
  try { fs.mkdirSync(lock); }
  catch (e) { if (e.code === 'EEXIST') throw new Error('Another runner holds .match-lock. Do not remove it while a match is running.'); throw e; }
  const active = []; let interrupted = false;
  const onSignal = () => { interrupted = true; for (const p of active) if (!p.done) p.child.kill('SIGTERM'); };
  process.on('SIGINT', onSignal); process.on('SIGTERM', onSignal);
  let directory;
  try {
    await checkPort();
    for (const d of [o.a, o.b]) if (!fs.existsSync(path.join(d, 'Makefile')))
      throw new Error(`Missing C bot Makefile: ${d}`);
    const configDir = path.join(o.root, 'bots/configs/fake_demo');
    const gameBase = JSON.parse(fs.readFileSync(path.join(configDir, 'game.config.json')));
    const serverBase = JSON.parse(fs.readFileSync(path.join(configDir, 'server.config.json')));
    const death = engineDeathCodes(o.root);
    fs.mkdirSync(path.join(o.root, 'logs'), { recursive: true });
    const outputParent = o.outputParent ?? path.join(o.root, 'logs');
    fs.mkdirSync(outputParent, { recursive: true });
    directory = fs.mkdtempSync(path.join(outputParent, 'evaluation-'));
    console.log(`Evaluation directory: ${directory}`);
    if (o.build) build(o, directory);
    const serverExe = path.join(o.root, 'server/server');
    for (const file of [serverExe, path.join(o.a, 'bot'), path.join(o.b, 'bot')]) fs.accessSync(file, fs.constants.X_OK);
    json(path.join(directory, 'manifest.json'), {
      created_at: new Date().toISOString(), options: o, git_commit: git(o.root, ['rev-parse', 'HEAD']),
      git_status: git(o.root, ['status', '--short']), node: process.version, death_enum: death,
      game_config_sha256: digest(path.join(configDir, 'game.config.json')),
      server_config_sha256: digest(path.join(configDir, 'server.config.json')),
      binaries: Object.fromEntries([serverExe, path.join(o.a, 'bot'), path.join(o.b, 'bot')].map(p => [p, digest(p)]))
    });
    const rows = []; const layouts = new Map();
    for (const seed of o.seeds) for (let repeat = 0; repeat < o.repeats; repeat++) for (const aTeamId of aTeams) {
      if (interrupted) throw new Error('Evaluation interrupted');
      const n = rows.length + 1;
      const run = path.join(directory, String(n).padStart(4, '0'));
      fs.mkdirSync(run);
      const gameConfig = structuredClone(gameBase); gameConfig.seed = seed;
      const serverConfig = structuredClone(serverBase);
      serverConfig.timeoutTicks = o.maxTicks;
      serverConfig.replayFolderPaths = [run];
      const gc = path.join(run, 'game.config.json'); const sc = path.join(run, 'server.config.json');
      json(gc, gameConfig); json(sc, serverConfig);
      const started = Date.now(); let row; let watchdog;
      try {
        await checkPort();
        const env = { ...process.env, GAME_ID: `evaluation-${n}` };
        const server = launch(serverExe, [sc, gc, path.join(o.root, 'server/data'), '42', '418'],
          o.root, path.join(run, 'server.log'), env);
        active.push(server);
        let deadline = false;
        watchdog = setTimeout(() => { deadline = true; for (const p of active) if (!p.done) p.child.kill('SIGTERM'); }, o.wallSeconds * 1000);
        const startupDeadline = started + o.wallSeconds * 1000;
        await waitLog(server, path.join(run, 'server.log'), 'Server listening on port 4444', startupDeadline);
        const bots = {};
        for (const team of [42, 418]) {
          const name = team === aTeamId ? 'a' : 'b';
          bots[name] = launch(path.join(o[name], 'bot'), [String(team)], o.root, path.join(run, `${name}.log`), env);
          active.push(bots[name]);
          await waitLog(server, path.join(run, 'server.log'), `Accepted team ${team}`, startupDeadline);
        }
        await server.finished;
        clearTimeout(watchdog);
        if (interrupted) throw new Error('Evaluation interrupted');
        if (deadline) row = { status: 'wall_timeout', reason: 'External watchdog stopped the match; no game outcome counted' };
        else if (server.error || server.code !== 0) row = { status: 'server_failure', reason: server.error ?? `Server exit ${server.code} (${server.signal})` };
        else {
          const replay = JSON.parse(fs.readFileSync(path.join(run, 'replay_latest.json'), 'utf8'));
          row = classify(replay, death.codes, seed, aTeamId);
          Object.assign(row, initialLayout(replay));
          row.successful_spawns = {
            a: countSuccessfulSpawns(replay, aTeamId),
            b: countSuccessfulSpawns(replay, aTeamId === 42 ? 418 : 42)
          };
          if (layouts.has(seed) && layouts.get(seed) !== row.initial_layout_sha256)
            Object.assign(row, { status: 'invalid_result', reason: 'Initial layout changed for the same seed' });
          else layouts.set(seed, row.initial_layout_sha256);
          // Keep all game-limit decisions distinct even if enum names vary.
          const log = fs.readFileSync(path.join(run, 'server.log'), 'utf8');
          if (row.status === 'completed' && /due to timeout \(random pick\)/.test(log)) row.decision = 'timeout_random';
          else if (row.status === 'completed' && /Killing core of team .*due to timeout/.test(log)) row.decision = 'timeout_tiebreak';
          else if (row.status === 'completed' && row.decision === 'combat' && simultaneousCoreDeaths(replay)) row.decision = 'combat_random';
          if (row.status === 'completed' && Object.values(bots).some(p => p.error)) row = { status: 'execution_failure', reason: 'Bot launch failed' };
        }
      } catch (e) {
        if (interrupted) throw e;
        row = { status: Date.now() - started >= o.wallSeconds * 1000 ? 'wall_timeout' : 'invalid_result', reason: e.message };
      } finally {
        clearTimeout(watchdog);
        await stop(active);
        if (row) row.processes = active.map(p => ({ pid: p.child.pid ?? null, exit: p.code, signal: p.signal, error: p.error }));
        active.length = 0;
      }
      Object.assign(row, { match: n, seed, repeat: repeat + 1, a_team_id: aTeamId,
        elapsed_seconds: (Date.now() - started) / 1000, folder: path.basename(run) });
      json(path.join(run, 'result.json'), row);
      fs.appendFileSync(path.join(directory, 'results.jsonl'), JSON.stringify(row) + '\n');
      rows.push(row);
      console.log(`[${n}/${o.seeds.length * o.repeats * aTeams.length}] seed=${seed} A=${aTeamId}: ${row.status} ${row.outcome_a ?? ''} ${row.decision ?? row.reason ?? ''}`);
      if (row.successful_spawns) console.log(`  Successful spawns: A=${JSON.stringify(row.successful_spawns.a)} B=${JSON.stringify(row.successful_spawns.b)}`);
    }
    const completed = rows.filter(r => r.status === 'completed');
    const summary = { total: rows.length, completed: completed.length, failed: rows.length - completed.length,
      wins_a: completed.filter(r => r.outcome_a === 'win').length,
      losses_a: completed.filter(r => r.outcome_a === 'loss').length,
      combat_matches: completed.filter(r => r.decision === 'combat').length,
      timeout_tiebreaks: completed.filter(r => r.decision === 'timeout_tiebreak').length,
      random_tiebreaks: completed.filter(r => r.decision === 'timeout_random').length,
      simultaneous_core_tiebreaks: completed.filter(r => r.decision === 'combat_random').length,
      repeat_consistency: o.seeds.flatMap(seed => aTeams.map(team => {
        const group = completed.filter(r => r.seed === seed && r.a_team_id === team);
        return { seed, a_team_id: team, completed: group.length, repeats_checked: o.repeats > 1,
          consistent: group.length === o.repeats && new Set(group.map(r =>
            JSON.stringify([r.winner_team_id, r.decision, r.final_tick, r.initial_layout_sha256]))).size === 1 };
      })),
      note: 'No draws inferred. Game-limit tiebreaks are not combat victories. This run does not train a model.' };
    json(path.join(directory, 'summary.json'), summary);
    console.log(JSON.stringify(summary, null, 2)); console.log(`Saved: ${directory}`);
    return { directory, rows, summary };
  } finally {
    await stop(active);
    process.removeListener('SIGINT', onSignal); process.removeListener('SIGTERM', onSignal);
    fs.rmdirSync(lock);
  }
}

async function main() {
  const o = options(process.argv.slice(2));
  if (o.help) {
    console.log('Usage: node tools/evaluate.mjs [--a DIR] [--b DIR] [--seeds eval-001,eval-002]\n' +
      '  [--repeats 1] [--max-ticks 3000] [--wall-seconds 180] [--jobs 4] [--no-build] [--root DIR]\n' +
      '  [--a-teams 42,418] (default: both; use 42 or 418 for one match)\n' +
      'Uses temporary fake_demo configs and verifies initial layouts.');
    return;
  }
  const r = await evaluate(o); if (r.summary.failed) process.exitCode = 1;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  main().catch(e => { console.error(`ERROR: ${e.message}`); process.exitCode = 1; });
