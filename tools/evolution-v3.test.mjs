import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import {spawnSync} from 'node:child_process';
import {schema,initial,validate,upgradeChampion,header,exportHeader,catalog,decide,mutateSearch,dependencySkip} from './evolution-v3-policy.mjs';
import {ROOT,BASELINE,BASELINE_ID,verifyBaseline,copySource,load,save,compatible,diagnostics} from './evolution-v3-core.mjs';
import {identity,parse} from './evolution-v3.mjs';import {fileHash} from './selfplay-core.mjs';import {designProperties} from './strategy-model.mjs';
const dir=()=>fs.mkdtempSync(path.join(ROOT,'logs/evolution-v3-test-'));
const compile=(source,folder,include,output='probe')=>{const exe=path.join(folder,output),r=spawnSync('cc',['-O2','-Wall','-Wextra','-Werror','-I',path.join(ROOT,'bots/c/client_lib/inc'),'-I',path.join(include,'inc'),'-I',path.join(include,'src'),source,'-o',exe],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);return exe;};
const run=exe=>{const r=spawnSync(exe,[],{encoding:'utf8',maxBuffer:10*1024*1024});assert.equal(r.status,0,r.stderr);return r.stdout;};
const prepare=p=>{const d=dir();copySource(path.join(ROOT,'bots/c/bot/evolution-v3-bot'),d);exportHeader(path.join(d,'inc/evolution_params.h'),p);return d;};
test('catalog derives legal repeated-health, armor and hunter properties from active rules',()=>{
 const config=JSON.parse(fs.readFileSync(path.join(ROOT,'bots/configs/fake_demo/game.config.json'))),c=catalog(config);
 assert.deepEqual(Object.values(c).map(x=>[x.cost,x.properties.hp,x.properties.damageReductionPercent]),[[47,8,0],[71,14,0],[137,8,60],[59,11,0]]);
 for(const v of Object.values(c)){assert.equal(v.properties.damageUnit,3);assert.equal(v.properties.baseActionCooldown,3);assert.equal(v.properties.damageCore,0);assert.equal(v.properties.damageObject,0);}
 assert.throws(()=>designProperties(config,['unit_attack','speed']),/Illegal design/);assert.throws(()=>designProperties(config,['unit_attack','unit_attack']),/Illegal design/);
 assert.throws(()=>validate({...initial(),hunter_quota:3}));assert.throws(()=>validate({...initial(),defender_design:3}));
});
test('defenders and hunters obey actual adjacency, reachability, leash, quota affordability and fallback',()=>{
 const p={...initial(),defense_mode:1,hunter_quota:1};const d=prepare(p);const exe=compile(path.join(ROOT,'tools/evolution-v3-scenarios.c'),d,d);assert.match(run(exe),/retreat passed/);
});
test('all new features disabled reproduce immutable champion action traces, including every component and tile callback',()=>{
 const r=verifyBaseline();assert.equal(r.id,BASELINE_ID);const p=upgradeChampion(JSON.parse(fs.readFileSync(path.join(BASELINE,'model.json')))),d=prepare(p);
 const source=path.join(ROOT,'tools/evolution-v3-probe.c');const old=run(compile(source,d,BASELINE,'legacy-probe')),now=run(compile(source,d,d,'disabled-probe'));
 assert.equal(old.trim().split('\n').length,2400);assert.equal(now,old);
 const evidence={worlds:2400,worlds_identical:true,changed:0,baseline_id:BASELINE_ID,baseline_binary:r.binary,legacy_trace_sha256:null};
 // Store the exact trace files for independent comparison.
 fs.writeFileSync(path.join(d,'legacy.trace'),old);fs.writeFileSync(path.join(d,'disabled.trace'),now);evidence.legacy_trace_sha256=fileHash(path.join(d,'legacy.trace'));evidence.disabled_trace_sha256=fileHash(path.join(d,'disabled.trace'));
 if(process.env.EVO_V3_EVIDENCE)fs.writeFileSync(path.join(process.env.EVO_V3_EVIDENCE,'disabled-equivalence.json'),JSON.stringify(evidence,null,2));
});
test('each new active field affects exact C action traces; inactive role parameters skip without compilation',()=>{
 const p={...initial(),defense_mode:1,hunter_quota:1},d=prepare(p),source=path.join(ROOT,'tools/evolution-v3-probe.c');const trace=q=>{exportHeader(path.join(d,'inc/evolution_params.h'),q);return run(compile(source,d,d));};const base=trace(p);
 for(const [key,value] of [['defense_mode',0],['defender_design',1],['hunter_quota',0],['hunter_pursuit',16]]){const changed=trace({...p,[key]:value});assert.notEqual(changed,base,key);assert.deepEqual(changed.trim().split('\n').map(v=>v.split(' ')[0]),base.trim().split('\n').map(v=>v.split(' ')[0]),key+' changed observed worlds');}
 const off=initial();assert.match(dependencySkip(off,{...off,defender_design:2}),/Inactive/);assert.match(dependencySkip(off,{...off,hunter_pursuit:9}),/Inactive/);
 assert.equal(dependencySkip(off,{...off,hunter_quota:1,hunter_pursuit:9}),null);
 const state={snapshots:{a:{params:off},b:{params:{...off,defender_design:1}}}};assert.equal(diagnostics('/nonexistent',state,'a','b').changed,0);
});
test('new production serialization matches JS over 1000 quota, design, affordability and cooldown worlds',()=>{
 const d=dir(),p=initial();fs.writeFileSync(path.join(d,'evolution_params.h'),header(p));const states=Array.from({length:1000},(_,k)=>({bank:k%120,cooldown:k%17===0?1:0,tick:(k%10)*100,miners:k%4,guards:k%8,attackers:k%5,carriers:k%3,hunters:k%3,threats:k%4}));
 const programs=states.map((s,k)=>{const q={...p,defense_mode:k%2,defender_design:k%3,hunter_quota:k%3};return `{t_evolution p=evo;p.defense_mode=${q.defense_mode};p.defender_design=${q.defender_design};p.hunter_quota=${q.hunter_quota};printf("%d\\n",evolution_v3_production(p,${[s.bank,s.cooldown,s.tick,s.miners,s.guards,s.attackers,s.carriers,s.hunters,s.threats].join(',')}));}`;});
 fs.writeFileSync(path.join(d,'driver.c'),'#include <stdio.h>\n#include "evolution_params.h"\nint main(void){'+programs.join('\n')+'return 0;}');
 const result=spawnSync('cc',['-O2','-Wall','-Wextra','-Werror','-I',d,path.join(d,'driver.c'),'-o',path.join(d,'driver')],{encoding:'utf8'});assert.equal(result.status,0,result.stderr);
 assert.deepEqual(run(path.join(d,'driver')).trim().split('\n').map(Number),states.map((s,k)=>decide({...p,defense_mode:k%2,defender_design:k%3,hunter_quota:k%3},s)));
});
test('new-schema RNG, atomic checksums and strict compatibility preserve pending mutations',()=>{
 const d=dir(),s={version:3,rng:73,pending:{params:initial()}},p=initial();for(let i=0;i<7;i++)mutateSearch(p,s);save(d,s);const restored=load(d);for(let i=0;i<40;i++)assert.deepEqual(mutateSearch(p,s),mutateSearch(p,restored));
 assert.throws(()=>compatible({identity:{schema_version:2}},identity()),/Incompatible/);const bytes=fs.readFileSync(path.join(d,'checkpoint.json'));fs.writeFileSync(path.join(d,'checkpoint.json'),'{}');assert.throws(()=>load(d));fs.writeFileSync(path.join(d,'checkpoint.json'),bytes);
 assert.equal(load(d).pending.params.hunter_quota,0);assert.throws(()=>parse(['resume','--work','logs/v3','--from-champion']),/new start/);
});
test('standalone new-schema C export and no-game CLI start/resume retain frozen references and limits',()=>{
 const d=dir(),call=args=>{const r=spawnSync(process.execPath,['tools/evolution-v3.mjs',...args],{cwd:ROOT,encoding:'utf8',maxBuffer:2*1024*1024});assert.equal(r.status,0,r.stderr);return r;};
 call(['start','--work',d,'--from-champion','--seconds','60','--matches','1','--iterations','3','--ticks','100','--wall','1','--seed','11']);const first=load(d);assert.equal(first.version,3);assert.equal(first.matches,0);assert.equal(first.parameter_import.mode,'frozen-v2-upgrade');assert.equal(first.fixed[3],BASELINE_ID);assert.equal(first.protocol.version,3);assert.equal(first.snapshots[first.champion].params.guards,3);
 call(['resume','--work',d,'--seconds','90','--additional-matches','1','--additional-seconds','30']);const second=load(d);assert.equal(second.matches,0);assert.deepEqual(second.pending,first.pending);assert.equal(second.rng,first.rng);
 const out=path.join(d,'export');call(['export','--work',d,'--out',out]);assert.ok(fs.existsSync(path.join(out,'inc/v3_behaviors.h')));assert.deepEqual(JSON.parse(fs.readFileSync(path.join(out,'model.json'))),initial());
 const build=spawnSync('make',['-C',out,`CLIENT_LIB_DIR=${ROOT}/bots/c/client_lib`,'CFLAGS=-Wall -Wextra -Werror -O2 -fsanitize=address'],{encoding:'utf8'});assert.equal(build.status,0,build.stderr);
 const denied=spawnSync(process.execPath,['tools/evolution-v3.mjs','export','--work',d,'--out',out],{cwd:ROOT,encoding:'utf8'});assert.notEqual(denied.status,0);
});

test('finish-pending resolves cached V3 validation after interruption and never samples a second candidate',()=>{
 const d=dir(),call=args=>{const r=spawnSync(process.execPath,['tools/evolution-v3.mjs',...args],{cwd:ROOT,encoding:'utf8'});assert.equal(r.status,0,r.stderr);return r;};
 call(['start','--work',d,'--from-champion','--seconds','60','--matches','1','--iterations','100','--ticks','100','--wall','1','--seed','11']);
 const s=load(d);assert.ok(s.pending?.candidate);s.options.matches=1000;s.matches=32;s.records={};s.decisions=[];s.iteration=0;s.replays=[];
 const pending=s.pending;pending.effect={changed:1};pending.opponents=[s.fixed[0],s.fixed[3]];pending.validation_opponents=pending.opponents;pending.train_delta=1;
 for(const stage of ['train','promotion'])for(const id of [pending.incumbent,pending.candidate])for(const opponent of pending.opponents)for(let i=0;i<2;i++){
  const seed=`${s.namespace}-${stage}-0-${i}`,rows=[42,418].map(a_team_id=>({status:'completed',seed,a_team_id,initial_layout_sha256:seed,initial_cores:[{team_id:42,x:0,y:0},{team_id:418,x:19,y:19}],decision:'combat',outcome_a:(stage==='train')===(id===pending.candidate)?'win':'loss'}));
  s.records[JSON.stringify([id,opponent,seed,100])]={rows,directory:d};
 }
 const key=Object.keys(s.records).find(k=>JSON.parse(k)[0]===pending.candidate&&JSON.parse(k)[2].includes('promotion')),record=s.records[key];delete s.records[key];save(d,s);
 call(['resume','--work',d,'--finish-pending','--additional-matches','1']);const paused=load(d);assert.equal(paused.iteration,0);assert.ok(paused.pending);assert.match(paused.stop_reason,/Invocation match budget/);
 paused.records[key]=record;save(d,paused);call(['resume','--work',d,'--finish-pending','--additional-matches','1']);const done=load(d);assert.equal(done.iteration,1);assert.equal(done.pending,null);assert.equal(done.rng,s.rng);assert.equal(done.decisions.length,1);assert.equal(done.matches,32);assert.equal(done.decisions[0].gate.accepted,false);
});
