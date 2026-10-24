// Invocation limits never rewrite cumulative budgets or RNG state.
export function invocationLimits(s,o,clock=Date.now){
 const start=clock(),matches=s?.matches??0,iteration=s?.iteration??0;
 return {
  continue:i=>!o['finish-pending']||i===iteration,
  check:(current,reserve=0)=>{
   if(o['additional-matches']!==undefined&&current-matches+reserve>o['additional-matches'])throw Error('Invocation match budget reached');
   if(o['additional-seconds']!==undefined&&(clock()-start)/1000+reserve*(s?.options.wall??o.wall??30)>o['additional-seconds'])throw Error('Invocation wall budget reached');
  }
 };
}
export function gateFailures(g){
 if(!g)return ['incomplete evidence'];
 const reasons=[];
 if(g.delta<0.05)reasons.push('delta below 0.05');
 if(g.paired_gains<2)reasons.push('fewer than two paired gains');
 if(g.paired_regressions)reasons.push('paired regressions');
 if(Object.entries(g.incumbent.per_opponent).some(([id,a])=>g.candidate.per_opponent[id].score<a.score))reasons.push('opponent-average regression');
 return reasons;
}
export function runReport(s){
 const rows=Object.values(s.records).flatMap(r=>r.rows),ds=s.decisions;
 const reason=d=>!d.effect?.changed?'ineffective/dependency skip':d.train_delta<=0?'training rejection':d.gate?.accepted?'promoted':d.gate?'validation rejection':'insufficient evidence';
 const counts={};for(const d of ds)counts[reason(d)]=(counts[reason(d)]??0)+1;
 let out=`# Local evolution run report\n\nStatus: ${s.status}. Stop: ${s.stop_reason??s.errors.at(-1)?.message??'in progress'}.\n\nChampion: ${s.champion}\n\nCompleted committed games: ${rows.length}; reserved slots: ${s.matches}; finalized candidates: ${ds.length}; evaluated: ${ds.filter(d=>d.effect?.changed).length}; skipped: ${ds.filter(d=>!d.effect?.changed).length}; promotions: ${s.promotions.length}.\n\nRejections/outcomes: ${JSON.stringify(counts)}. Pending: ${s.pending?.candidate??'none'}.\n\nFailures: ${JSON.stringify(s.failed_pairs??{})}; errors: ${JSON.stringify(s.errors)}.\n\n| Iteration | Changes from parent | Result | Train delta | Validation delta |\n|---|---|---|---:|---:|\n`;
 ds.forEach((d,i)=>{const parent=s.snapshots[d.parent].params;out+=`| ${i} | ${Object.keys(d.params).filter(k=>d.params[k]!==parent[k]).map(k=>`${k}: ${parent[k]} → ${d.params[k]}`).join(', ')} | ${reason(d)}${d.gate&&!d.gate.accepted?': '+gateFailures(d.gate).join(', '):d.effect?.reason?': '+d.effect.reason:''} | ${d.train_delta??'—'} | ${d.gate?.delta??'—'} |\n`;});
 out+='\nPer-opponent outcomes (all committed panels, including incumbent controls):\n\n| Opponent | Games | Wins | Losses | Combat | HP | Random |\n|---|---:|---:|---:|---:|---:|---:|\n';
 for(const op of new Set(Object.keys(s.records).map(k=>JSON.parse(k)[1]))){const rr=Object.entries(s.records).filter(([k])=>JSON.parse(k)[1]===op).flatMap(([,r])=>r.rows);out+=`| ${s.snapshots[op].label} | ${rr.length} | ${rr.filter(r=>r.outcome_a==='win').length} | ${rr.filter(r=>r.outcome_a==='loss').length} | ${rr.filter(r=>r.decision==='combat').length} | ${rr.filter(r=>r.decision==='timeout_tiebreak').length} | ${rr.filter(r=>['timeout_random','combat_random'].includes(r.decision)).length} |\n`;}
 return out;
}
