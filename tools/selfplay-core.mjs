import fs from 'node:fs';
import path from 'node:path';
import { hash } from './strategy-model.mjs';

export function saveJSON(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file + '.tmp', JSON.stringify(data, null, 2) + '\n');
  fs.renameSync(file + '.tmp', file);
}
export function readJSON(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
export function sourceFiles(dir) {
  return ['Makefile', ...['src', 'inc'].flatMap(sub => {
    const walk = folder => fs.readdirSync(folder, {withFileTypes:true}).flatMap(e =>
      e.isDirectory() ? walk(path.join(folder,e.name)) : [path.relative(dir,path.join(folder,e.name))]);
    return walk(path.join(dir,sub));
  })].sort();
}
export const fileHash = file => hash(fs.readFileSync(file));
export const sourceHash = dir => hash(JSON.stringify(sourceFiles(dir).map(f => [f,fileHash(path.join(dir,f))])));
export function verifySnapshot(snapshot) {
  if (fileHash(path.join(snapshot.dir,'bot')) !== snapshot.binary_sha256 ||
      sourceHash(snapshot.dir) !== snapshot.source_sha256 ||
      fileHash(path.join(snapshot.dir,'model.json')) !== snapshot.model_file_sha256)
    throw new Error(`Immutable snapshot changed: ${snapshot.id}`);
  return snapshot;
}
export function selectOpponents(fixed, history, iteration, limit = 2) {
  // Always include fixed references and the most recent historical policy; rotate an older one.
  const selected = [...fixed, history.at(-1)];
  if (history.length > 1 && limit > 1) selected.push(history[iteration % (history.length - 1)]);
  return [...new Set(selected.filter(Boolean))];
}
export function assertBalanced(rows) {
  const seeds = [...new Set(rows.map(r => r.seed))];
  for (const seed of seeds) {
    const pair = rows.filter(r => r.seed === seed);
    if (pair.length !== 2 || new Set(pair.map(r => r.a_team_id)).size !== 2)
      throw new Error('Expected two team assignments per seed');
    const positions = pair.map(r => r.initial_cores?.find(c => c.team_id === r.a_team_id))
      .map(c => c ? `${c.x},${c.y}` : null);
    if (positions.includes(null) || new Set(positions).size !== 2 ||
        pair[0].initial_layout_sha256 !== pair[1].initial_layout_sha256)
      throw new Error('Physical positions were not balanced');
  }
}
export function fitness(row) {
  if (row.status !== 'completed') throw new Error('Failed match: fitness rejected');
  if (['timeout_random', 'combat_random'].includes(row.decision)) return 0.5;
  if (!['combat','timeout_tiebreak'].includes(row.decision) || !['win','loss'].includes(row.outcome_a))
    throw new Error('Unknown result');
  return row.decision === 'combat' ? (row.outcome_a === 'win' ? 1 : 0) : (row.outcome_a === 'win' ? 0.75 : 0.25);
}
export function summarize(records) {
  const rows = records.flatMap(r => r.rows);
  if (!rows.length) throw new Error('No matches');
  const scores = rows.map(fitness);
  const perOpponent = Object.fromEntries(records.map(r => [r.opponent, {
    matches:r.rows.length, score:r.rows.reduce((s,row) => s + fitness(row),0)/r.rows.length,
    wins:r.rows.filter(row => row.outcome_a === 'win').length,
    losses:r.rows.filter(row => row.outcome_a === 'loss').length,
    combat_wins:r.rows.filter(row => row.decision === 'combat' && row.outcome_a === 'win').length,
    combat_losses:r.rows.filter(row => row.decision === 'combat' && row.outcome_a === 'loss').length,
    game_limit_tiebreaks:r.rows.filter(row=>row.decision==='timeout_tiebreak').length,
    random_tiebreaks:r.rows.filter(row=>['timeout_random','combat_random'].includes(row.decision)).length,
    failures:0,
    successful_spawns:r.rows.reduce((counts,row)=>{
      for(const [design,count] of Object.entries(row.successful_spawns?.a??{}))counts[design]=(counts[design]??0)+count;
      return counts;
    },{})
  }]));
  return { matches:rows.length, score:scores.reduce((a,b)=>a+b,0)/scores.length,
    wins:rows.filter(r=>r.outcome_a==='win').length, losses:rows.filter(r=>r.outcome_a==='loss').length,
    combat_wins:rows.filter(r=>r.outcome_a==='win' && r.decision==='combat').length,
    combat_losses:rows.filter(r=>r.outcome_a==='loss' && r.decision==='combat').length,
    game_limit_tiebreaks:rows.filter(r=>r.decision==='timeout_tiebreak').length,
    random_tiebreaks:rows.filter(r=>['timeout_random','combat_random'].includes(r.decision)).length,
    failures:rows.filter(r=>r.status!=='completed').length, per_opponent:perOpponent };
}
export function promotion(incumbent, candidate) {
  const a = summarize(incumbent), b = summarize(candidate);
  if (a.matches !== b.matches || incumbent.length !== candidate.length) throw new Error('Unequal promotion panels');
  const paired = candidate.flatMap((record,i) => {
    if (record.opponent !== incumbent[i].opponent) throw new Error('Opponent mismatch');
    const reference = incumbent[i].rows;
    if (record.rows.length !== reference.length) throw new Error('Unequal promotion panels');
    return record.rows.map((row,j) => {
      const prev=reference[j];
      if (row.seed !== prev.seed || row.a_team_id !== prev.a_team_id ||
          row.initial_layout_sha256 !== prev.initial_layout_sha256) throw new Error('Unpaired promotion match');
      return fitness(row)-fitness(prev);
    });
  });
  const gains=paired.filter(x=>x>0).length, regressions=paired.filter(x=>x<0).length;
  const delta=b.score-a.score;
  const mean=paired.reduce((s,x)=>s+x,0)/paired.length;
  const se=paired.length>1 ? Math.sqrt(paired.reduce((s,x)=>s+(x-mean)**2,0)/(paired.length-1)/paired.length) : Infinity;
  const enoughSeeds = new Set(candidate.flatMap(r=>r.rows.map(row=>row.seed))).size >= 2;
  const noOpponentRegression=Object.keys(a.per_opponent).every(k=>b.per_opponent[k]?.score >= a.per_opponent[k].score);
  // Conservative operational gate, not a statistical claim of generalization.
  const accepted=enoughSeeds && candidate.length>=2 && delta>=0.05 && gains>=2 && regressions===0 && noOpponentRegression;
  return { accepted, delta, paired_gains:gains, paired_regressions:regressions,
    approximate_paired_standard_error:se, incumbent:a, candidate:b,
    rule:'At least two opponents and two seeds, delta >= 0.05, >= 2 paired gains, zero paired or per-opponent regressions.' };
}

export function validateResume(state, identity) {
  if (state.version !== 1 || JSON.stringify(state.identity) !== JSON.stringify(identity))
    throw new Error('Resume rejected: source, rules, engine, or client library changed');
  for (const snapshot of Object.values(state.snapshots)) verifySnapshot(snapshot);
  return state;
}

export function canContinueSearch(state, targetIterations) {
  return !state.selection_frozen && !state.finalized && state.iteration<targetIterations;
}
