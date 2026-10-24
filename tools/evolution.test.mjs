import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {ROOT,atomic,save,load,compatible,processIdentity,alive,copySource} from './evolution-core.mjs';
import {initial,validate,mutate,header,decide,schema,legalDesigns} from './evolution-policy.mjs';
import {promotion,assertBalanced} from './selfplay-core.mjs';
import {parse} from './evolution.mjs';
const temporary=()=>fs.mkdtempSync(path.join(ROOT,'logs/evolution-test-'));

test('parameter bounds and real component legality reject illegal designs',()=>{
 assert.equal(legalDesigns(JSON.parse(fs.readFileSync(path.join(ROOT,'bots/configs/fake_demo/game.config.json')))).length,6);
 for(const k of Object.keys(schema))assert.throws(()=>validate({...initial(),[k]:schema[k][1]+1}));
});
test('RNG state survives checkpoint and generates identical future mutations',()=>{
 const dir=temporary(),s={version:1,rng:73};let p=initial();
 for(let i=0;i<7;i++)p=mutate(p,s).params;save(dir,s);const restored=load(dir);
 for(let i=0;i<50;i++)assert.deepEqual(mutate(p,s),mutate(p,restored));
 assert.equal(s.rng,restored.rng);
});
test('atomic checkpoints reject corruption and preserve previous recovery copy',()=>{
 const dir=temporary();save(dir,{version:1,rng:1,pending:{params:initial()}});save(dir,{version:1,rng:2});
 assert.equal(load(dir).rng,2);fs.writeFileSync(path.join(dir,'checkpoint.json'),'{}');assert.throws(()=>load(dir));
 assert.equal(JSON.parse(fs.readFileSync(path.join(dir,'checkpoint.json.previous'))).state.rng,1);
 assert.throws(()=>compatible({identity:{a:1}},{a:2}),/Incompatible/);
});
test('exported C production matches JS decisions across affordability, threat and stage states',()=>{
 const dir=temporary();fs.writeFileSync(path.join(dir,'evolution_params.h'),header(initial()));
 const states=Array.from({length:500},(_,k)=>({bank:k%120,cooldown:k%19===0?1:0,tick:(k%9)*100,miners:k%4,guards:k%7,attackers:k%6,carriers:k%3,threats:k%5}));
 fs.writeFileSync(path.join(dir,'driver.c'),'#include <stdio.h>\n#include "evolution_params.h"\nint main(void){\n'+states.map(s=>`printf("%d\\n",evolution_production(evo,${[s.bank,s.cooldown,s.tick,s.miners,s.guards,s.attackers,s.carriers,s.threats].join(',')}));`).join('\n')+'\nreturn 0;}');
 const exe=path.join(dir,'check'),b=spawnSync('cc',['-Wall','-Wextra','-Werror',path.join(dir,'driver.c'),'-o',exe],{encoding:'utf8'});assert.equal(b.status,0,b.stderr);
 const r=spawnSync(exe,[],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);assert.deepEqual(r.stdout.trim().split('\n').map(Number),states.map(s=>decide(initial(),s)));
});
test('every searched parameter affects exact C action decisions on counterfactual worlds',()=>{
 const dir=temporary();copySource(path.join(ROOT,'bots/c/bot/evolution-bot'),dir);
 const run=p=>{
   fs.writeFileSync(path.join(dir,'inc/evolution_params.h'),header(p));const exe=path.join(dir,'probe');
   const b=spawnSync('cc',['-O2','-Wall','-Wextra','-Werror','-I',path.join(ROOT,'bots/c/client_lib/inc'),'-I',path.join(dir,'inc'),'-I',path.join(dir,'src'),path.join(ROOT,'tools/evolution-probe.c'),'-o',exe],{encoding:'utf8'});
   assert.equal(b.status,0,b.stderr);const r=spawnSync(exe,[],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);return r.stdout;
 };
 const p={...initial(),carriers:1},baseline=run(p);
 for(const [k,[lo,hi]] of Object.entries(schema)){
   assert.ok(run({...p,[k]:lo})!==baseline || run({...p,[k]:hi})!==baseline,`${k} disconnected from observed C actions`);
 }
});
test('promotion requires paired multi-map non-regressing evidence; crashes never score',()=>{
 const rows=(outcome,seed)=>[42,418].map((id,i)=>({status:'completed',seed,a_team_id:id,initial_layout_sha256:seed,
   initial_cores:[{team_id:42,x:0,y:0},{team_id:418,x:19,y:19}],outcome_a:outcome,decision:'combat'}));
 const panel=outcome=>['a','b'].map(opponent=>({opponent,rows:[...rows(outcome,'map1'),...rows(outcome,'map2')]}));
 assert.equal(promotion(panel('loss'),panel('win')).accepted,true);
 assert.equal(promotion(panel('win'),panel('win')).accepted,false);
 const bad=panel('win');bad[0].rows[0].seed='wrong';assert.throws(()=>promotion(panel('loss'),bad),/Unpaired/);
 bad[0].rows[0].seed='map1';bad[0].rows[0].status='execution_failure';assert.throws(()=>promotion(panel('loss'),bad),/Failed match/);
 assert.doesNotThrow(()=>assertBalanced(rows('win','map1')));
});
test('liveness checks prevent stale PID reuse and CLI rejects unsafe options',()=>{
 assert.equal(alive(processIdentity(process.pid)),true);assert.equal(alive({pid:process.pid,start:'wrong'}),false);
 assert.throws(()=>parse(['start','--work','/tmp/outside']));assert.throws(()=>parse(['start','--work','logs/x','--matches','0']));
 assert.equal(parse(['resume','--work','logs/x','--matches','500']).matches,500);
});
test('background start/status/stop and extended-budget resume preserve pending search without games',async()=>{
 const work=temporary(),cli=path.join(ROOT,'tools/evolution.mjs');
 const call=args=>{const r=spawnSync(process.execPath,[cli,...args],{cwd:ROOT,encoding:'utf8'});assert.equal(r.status,0,r.stderr);return r.stdout;};
 const wait=async()=>{for(let i=0;i<150;i++){
   try{const s=load(work),owner=JSON.parse(fs.readFileSync(path.join(work,'owner.json')));
     if(!alive(owner)&&['paused','idle','error'].includes(s.status))return s;
   }catch{}
   await new Promise(r=>setTimeout(r,100));
 }throw Error('Background test did not stop');};
 call(['start','--work',work,'--seconds','30','--matches','1','--iterations','3','--ticks','100','--wall','1','--seed','11','--background']);
 const first=await wait();assert.notEqual(first.status,'error');assert.equal(first.options.seconds,30);assert.equal(first.matches,0);
 const state=JSON.parse(call(['status','--work',work]));assert.equal(state.alive,false);
 call(['stop','--work',work]);
 call(['resume','--work',work,'--seconds','60','--iterations','4','--background']);
 // Wait for the newly spawned worker, rather than reading the previous terminal state.
 await new Promise(r=>setTimeout(r,300));
 const second=await wait();assert.notEqual(second.status,'error');assert.equal(second.options.seconds,60);assert.equal(second.matches,0);
 if(first.pending){assert.deepEqual(second.pending,first.pending);assert.equal(second.rng,first.rng);}
});

test('invocation limits preserve cumulative options and stop at the saved candidate boundary',async()=>{
 const {invocationLimits}=await import('./evolution-runtime.mjs');let now=0;
 const s={matches:790,iteration:24,options:{matches:1600,seconds:3600,iterations:100,wall:30}},original=structuredClone(s);
 const cap=invocationLimits(s,{'finish-pending':true,'additional-matches':42,'additional-seconds':1500},()=>now);
 assert.equal(cap.continue(24),true);assert.equal(cap.continue(25),false);
 assert.doesNotThrow(()=>cap.check(830,2));assert.throws(()=>cap.check(832,2),/match budget/);
 now=1441000;assert.throws(()=>cap.check(790,2),/wall budget/);assert.deepEqual(s,original);
 const resumed=invocationLimits({...s,matches:800},{'finish-pending':true,'additional-matches':32},()=>now);
 assert.doesNotThrow(()=>resumed.check(830,2));assert.throws(()=>resumed.check(832,2));
});
test('finish-pending refuses fresh/no-pending runs without generating a checkpoint',()=>{
 const dir=temporary();const r=spawnSync(process.execPath,['tools/evolution.mjs','resume','--work',dir,'--finish-pending'],{cwd:ROOT,encoding:'utf8'});
 assert.notEqual(r.status,0);assert.equal(fs.existsSync(path.join(dir,'checkpoint.json')),false);
 assert.throws(()=>parse(['start','--work','logs/x','--finish-pending']),/requires resume/);
});

test('dependency reachability blocks carrier-load panels and joint search retains single mutations',async()=>{
 const {dependencySkip,mutateSearch,searchOpponents}=await import('./evolution-policy.mjs');
 const p=initial();assert.match(dependencySkip(p,{...p,carrier_load:20}),/cannot produce/);
 assert.equal(dependencySkip({...p,carriers:1},{...p,carriers:1,carrier_load:20}),null);
 let state={rng:73},single=0,joint=0;
 for(let i=0;i<500;i++){const m=mutateSearch(p,state),changed=Object.keys(p).filter(k=>p[k]!==m.params[k]);
  if(m.kind==='joint'){joint++;assert.equal(changed.length,2);if(changed.includes('carrier_load'))assert.ok(m.params.carriers>0);}
  else{single++;assert.equal(changed.length,1);}
 }
 assert.ok(single>250&&joint>80);
 const opponents=searchOpponents({fixed:['tactical','weak1','weak2'],champion:'current',history:['old','previous','current'],iteration:2});
 assert.deepEqual(new Set(opponents),new Set(['tactical','current','previous','old']));
 assert.throws(()=>parse(['resume','--work','logs/x','--additional-matches','no']));
});

test('finish-pending resumes a budget interruption and finalizes cached evidence without another candidate',async()=>{
 const {snapshot}=await import('./evolution-core.mjs');
 const dir=temporary();
 const init=spawnSync(process.execPath,['tools/evolution.mjs','start','--work',dir,'--seconds','300','--matches','1','--iterations','100','--ticks','100','--wall','1','--seed','11'],{cwd:ROOT,encoding:'utf8'});
 assert.equal(init.status,0,init.stderr);
 const s=load(dir);s.iteration=24;s.decisions=[];s.promotions=[];s.errors=[];s.status='paused';s.records={};s.replays=[];s.options.matches=1000;s.matches=48;
 const candidate=snapshot(dir,s,{...initial(),late_miners:2},'fixture-candidate');
 const pending={parent:s.champion,incumbent:s.champion,candidate,params:{...initial(),late_miners:2},mutation:'late_miners',train_delta:1,effect:{changed:106},opponents:[s.fixed[0],s.champion]};
 s.pending=pending;
 for(const stage of ['train','promotion','promotion-extra'])for(const id of [s.champion,candidate])for(const opponent of pending.opponents)for(let seedIndex=0;seedIndex<2;seedIndex++){
  const seed=`${s.namespace}-${stage}-24-${seedIndex}`;
  const rows=[42,418].map(a_team_id=>({status:'completed',seed,a_team_id,initial_layout_sha256:seed,
   initial_cores:[{team_id:42,x:0,y:0},{team_id:418,x:19,y:19}],decision:'combat',outcome_a:stage==='train'&&id===s.champion?'loss':'win'}));
  s.records[JSON.stringify([id,opponent,seed,s.options.ticks])]={rows,directory:dir};
 }
 const missing=Object.keys(s.records).find(k=>{const [id,,seed]=JSON.parse(k);return id===pending.candidate&&seed.includes('promotion-extra-24');});
 const record=s.records[missing];delete s.records[missing];save(dir,s);
 const call=()=>spawnSync(process.execPath,['tools/evolution.mjs','resume','--work',dir,'--finish-pending','--additional-matches','1','--additional-seconds','60'],{cwd:ROOT,encoding:'utf8'});
 let r=call();assert.equal(r.status,0,r.stderr);let paused=load(dir);assert.equal(paused.status,'paused');assert.match(paused.stop_reason,/Invocation match budget/);
 assert.equal(paused.iteration,24);assert.equal(paused.matches,s.matches);assert.deepEqual(paused.pending,pending);
 paused.records[missing]=record;save(dir,paused);r=call();assert.equal(r.status,0,r.stderr);
 const done=load(dir);assert.equal(done.iteration,25);assert.equal(done.pending,null);assert.equal(done.decisions.length,1);assert.equal(done.matches,s.matches);assert.equal(done.rng,s.rng);
 assert.equal(done.decisions[0].gate.accepted,false);assert.equal(done.decisions[0].gate.delta,0);assert.equal(done.decisions[0].gate.candidate.matches,16);assert.equal(done.stop_reason,'Pending candidate resolved');
 const report=fs.readFileSync(path.join(dir,'RUN_REPORT.md'),'utf8');assert.ok(report.includes('\n\n'));assert.match(report,/Per-opponent outcomes/);
});

test('weak-reference regressions veto promotion even when aggregate gains pass',async()=>{
 const {gateFailures}=await import('./evolution-runtime.mjs');
 const rows=(score,seed)=>[42,418].map(a_team_id=>({status:'completed',seed,a_team_id,initial_layout_sha256:seed,outcome_a:score?'win':'loss',decision:'combat'}));
 const panel=(tactical,weak)=>[{opponent:'tactical',rows:[...rows(tactical,'a'),...rows(tactical,'b')]},{opponent:'weak',rows:[...rows(weak,'a'),...rows(weak,'b')]}];
 const g=promotion(panel(0,1),panel(1,0));assert.equal(g.accepted,false);assert.ok(gateFailures(g).includes('opponent-average regression'));
 assert.throws(()=>parse(['resume','--work','logs/x','--from','model.json']),/new start/);
});
