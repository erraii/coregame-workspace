#!/usr/bin/env node
// Offline CPU evolution. Only local game sockets are used; no HTTP/client services.
import fs from 'node:fs';
import path from 'node:path';
import {spawn,spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {evaluate,assertSameLayouts} from './evaluate.mjs';
import {assertBalanced,promotion,summarize,sourceHash,fileHash} from './selfplay-core.mjs';
import {assertRules} from './strategy-model.mjs';
import {initial,mutateSearch,next,legalDesigns,validate,protocol,searchOpponents,upgradeChampion} from './evolution-v3-policy.mjs';
import {ROOT,BASELINE,verifyBaseline,importBaseline,FLAGS,read,atomic,save,load,identity as baseIdentity,compatible,copySource,build,snapshot,verify,size,processIdentity,alive,ownedProcesses,recover,prune,diagnostics} from './evolution-v3-core.mjs';

export const identity=()=>({...baseIdentity(),runtime:fileHash(path.join(ROOT,'tools/evolution-runtime.mjs'))});
import {invocationLimits,runReport} from './evolution-runtime.mjs';

export function parse(argv){
  const [command,...args]=argv,o={command};
  for(let i=0;i<args.length;i++){
    const k=args[i];if(['--background','--finish-pending','--from-champion'].includes(k)){o[k.slice(2)]=true;continue;}
    if(!['--work','--seconds','--matches','--iterations','--seed','--ticks','--wall','--keep-replays','--disk-mb','--out','--additional-seconds','--additional-matches','--from'].includes(k)||!args[i+1])throw Error(`Invalid option ${k}`);
    const v=args[++i];o[k.slice(2)]=['--work','--out','--from'].includes(k)?v:Number(v);
  }
  if(!o.work)throw Error('Required: --work logs/NAME');o.work=path.resolve(ROOT,o.work);
  if(!o.work.startsWith(path.join(ROOT,'logs')+path.sep))throw Error('Work must be inside workspace logs/');
  for(const [k,v]of Object.entries(o))if(typeof v==='number'&&(!Number.isSafeInteger(v)||v<1))throw Error(`Invalid ${k}`);
  if(!['start','resume','status','stop','recover','export','test','worker'].includes(command))throw Error('Use start/resume/status/stop/recover/export/test');
  if(o['from-champion']&&(command!=='start'||o.from))throw Error('--from-champion requires a new start and cannot combine with --from');
  if(o.from&&command!=='start')throw Error('--from requires a new start');
  if(o['finish-pending']&&command!=='resume')throw Error('finish-pending requires resume');
  return o;
}
const owner=work=>{try{return read(path.join(work,'owner.json'));}catch{return null;}};
function status(work){
  const s=load(work),p=owner(work);
  const r={work,pid:p?.pid,alive:alive(p),state:s.status,iteration:s.iteration,champion:s.champion,
    population:s.population,promotions:s.promotions.length,matches_reserved:s.matches,elapsed_seconds:s.elapsed,
    completed_games:Object.values(s.records).reduce((n,r)=>n+r.rows.length,0),stop_reason:s.stop_reason,protocol:s.protocol,report:path.join(work,'RUN_REPORT.md'),
    limits:s.options,pending:s.pending,errors:s.errors.slice(-5),disk_mb:size(work)/1048576,
    results:path.join(work,'checkpoint.json'),replays:s.replays};console.log(JSON.stringify(r,null,2));return r;
}
async function run(o){
  if(o['from-champion'])verifyBaseline();
  const importPath=o['from-champion']?path.join(BASELINE,'model.json'):o.from?path.resolve(o.from):null;
  const imported=importPath?(o['from-champion']?upgradeChampion(read(importPath)):validate(read(importPath))):null;
  const work=o.work;fs.mkdirSync(work,{recursive:true});
  let s=fs.existsSync(path.join(work,'checkpoint.json'))?load(work):null;
  if(o['finish-pending']&&!s?.pending)throw Error('No saved pending candidate');
  if(s){compatible(s,identity());recover(work);}
  const invocation=invocationLimits(s,o);
  const lock=path.join(ROOT,'.training-lock');fs.mkdirSync(lock);
  const me={...processIdentity(process.pid),work};atomic(path.join(lock,'evolution-owner.json'),me);atomic(path.join(work,'owner.json'),me);
  process.env.CORE_EVOLUTION_RUN=work;
  let stopped=false;const signal=()=>{stopped=true;};process.on('SIGINT',signal);process.on('SIGTERM',signal);
  const deadline=o['additional-seconds']?setTimeout(()=>process.kill(process.pid,'SIGTERM'),o['additional-seconds']*1000):null;deadline?.unref();
  const started=Date.now(),previous=s?.elapsed??0;
  const persist=()=>{s.elapsed=previous+(Date.now()-started)/1000;save(work,s);fs.writeFileSync(path.join(work,'RUN_REPORT.md'),runReport(s));};
  const boundary=(matches=0)=>{
    invocation.check(s.matches,matches);
    if(stopped)throw Error('Graceful stop requested');
    if(fs.existsSync(path.join(work,'stop.request')))throw Error('Graceful stop requested');
    if(s.matches+matches>s.options.matches)throw Error('Match budget reached');
    if(previous+(Date.now()-started)/1000+ (matches?s.options.wall*matches:0)>s.options.seconds)throw Error('Wall budget reserve reached');
    if(size(work)>s.options['disk-mb']*1048576)throw Error('Disk budget reached');
  };
  try{
    if(fs.existsSync(path.join(work,'stop.request')))fs.unlinkSync(path.join(work,'stop.request'));
    if(!s){
      s={version:3,identity:identity(),options:{seconds:3600,matches:1000,iterations:100000,seed:73,ticks:1000,wall:30,'keep-replays':4,'disk-mb':4096},
        rng:o.seed??73,iteration:0,matches:0,elapsed:0,snapshots:{},population:[],champion:null,history:[],fixed:[],
        records:{},promotions:[],decisions:[],errors:[],pending:null,replays:[],tests:[],status:'initializing',namespace:path.basename(work),protocol,initial_parameters:imported??initial(),parameter_import:importPath?{path:importPath,sha256:fileHash(importPath),mode:o['from-champion']?'frozen-v2-upgrade':'v3-parameters'}:null};
    }
    for(const k of Object.keys(s.options))if(o[k]!==undefined){
      if(!['seconds','matches','iterations','keep-replays','disk-mb'].includes(k)&&s.champion&&o[k]!==s.options[k])throw Error(`Cannot change ${k} on resume`);
      if(['seconds','matches','iterations'].includes(k)&&s.champion&&o[k]<s.options[k])throw Error(`Cannot reduce ${k}`);
      s.options[k]=o[k];
    }
    assertRules(read(path.join(ROOT,'bots/configs/fake_demo/game.config.json')),read(path.join(ROOT,'bots/c/bot/evolution-v3-bot/supported_game_config.json')));
    legalDesigns(read(path.join(ROOT,'bots/configs/fake_demo/game.config.json')));
    for(const r of Object.values(s.snapshots))verify(work,r);
    persist();boundary();
    if(!s.champion){
      const baseline=path.join(ROOT,'logs/tactical-carrier-analysis/experiment-glS5Xk/no-carrier');
      if(sourceHash(baseline)!=='17494b2d52934ed5af7f7f98d041f0cdcade9a7b1f7c03a7c0d0345c6fc42976')throw Error('Verified tactical baseline changed');
      s.fixed=[snapshot(work,s,null,'tactical-baseline',baseline),snapshot(work,s,null,'Gridmaster',path.join(ROOT,'bots/c/bot/gridmaster')),
        snapshot(work,s,null,'linear-policy',path.join(ROOT,'bots/c/bot/policy-bot')),importBaseline(work,s)];
      atomic(path.join(work,'protocol.json'),{...s.protocol,limits:s.options,parameter_import:s.parameter_import});
      s.champion=snapshot(work,s,s.initial_parameters,'initial-evolution');s.population=[s.champion];s.history=[s.champion];persist();
    }
    s.status='running';delete s.stop_reason;persist();
    // Every cached pair is committed independently; unfinished pairs consume reservation but never fitness.
    async function panel(id,opponents,seeds,label){
      const result=[];
      for(const opponent of opponents){const rows=[];
        for(const seed of seeds){
          const key=JSON.stringify([id,opponent,seed,s.options.ticks]);
          if(!s.records[key]){
            if((s.failed_pairs?.[key]??0)>=2)throw Error('Pair retry limit reached; preserve this run and investigate before starting a new one');
            if(fs.existsSync(path.join(ROOT,'.match-lock')))throw Error('Another runner holds .match-lock');
            boundary(2);verify(work,s.snapshots[id]);verify(work,s.snapshots[opponent]);
            s.matches+=2;s.active_pair={id,opponent,seed,label};persist();
            const job=evaluate({root:ROOT,a:path.join(work,'snapshots',id),b:path.join(work,'snapshots',opponent),seeds:[seed],
              repeats:1,aTeams:[42,418],maxTicks:s.options.ticks,wallSeconds:s.options.wall,build:false,jobs:1,outputParent:work});
            const marker=path.join(ROOT,'.match-lock.evolution-owner.json');
            if(fs.existsSync(path.join(ROOT,'.match-lock')))atomic(marker,me);
            let r;
            try{r=await job;}finally{
              if(fs.existsSync(marker))fs.unlinkSync(marker);
            }
            if(r.summary.failed){s.failed_pairs??={};s.failed_pairs[key]=(s.failed_pairs[key]??0)+1;persist();throw Error(`Execution failure in ${r.directory}; no fitness`);}
            assertBalanced(r.rows);s.records[key]={rows:r.rows,directory:r.directory};delete s.active_pair;
            if(!s.replays.length)s.replays.push(path.relative(work,path.join(r.directory,'0001/replay_latest.json')));
            persist();prune(work,s,s.options['keep-replays']);
          }
          rows.push(...s.records[key].rows);
        }result.push({opponent,rows});
      }return result;
    }
    async function compare(p,stage){
      const seeds=[0,1].map(i=>`${s.namespace}-${stage}-${s.iteration}-${i}`);
      const a=await panel(p.incumbent,stage==='train'?p.opponents:(p.validation_opponents??p.opponents),seeds,stage),b=await panel(p.candidate,stage==='train'?p.opponents:(p.validation_opponents??p.opponents),seeds,stage);
      for(let i=0;i<a.length;i++)assertSameLayouts(a[i].rows,b[i].rows);
      return {a,b,delta:summarize(b).score-summarize(a).score};
    }
    if(o.test){
      const report=s.tests.length,seeds=[0,1].map(i=>`${s.namespace}-final-${report}-${i}`);
      const frozen=s.champion;const result=await panel(frozen,s.fixed,seeds,'final-report');
      s.tests.push({champion:frozen,seeds,result,summary:summarize(result),note:'Reporting only; selection never reads this result. After consultation these are benchmarks.'});
      atomic(path.join(work,`final-report-${report}.json`),s.tests.at(-1));persist();
    }else while(s.iteration<s.options.iterations && invocation.continue(s.iteration)){
      boundary();
      if(!s.pending){
        const parent=next(s)<0.5?s.champion:s.population[Math.floor(next(s)*s.population.length)];
        const mutation=mutateSearch(s.snapshots[parent].params,s);
        const opponents=searchOpponents(s),validation_opponents=[...new Set([...opponents,...s.fixed])];
        s.pending={parent,params:mutation.params,candidate:null,incumbent:s.champion,opponents,validation_opponents,mutation:mutation.key,mutation_kind:mutation.kind,effect:null};persist();
      }
      const p=s.pending;let gate=null;
      if(!p.candidate){p.candidate=snapshot(work,s,p.params,`candidate-${s.iteration}`);persist();}
      if(!p.effect){p.effect=diagnostics(work,s,p.parent,p.candidate);persist();}
      if(p.effect.changed){
        const train=await compare(p,'train');p.train_delta=train.delta;persist();
        if(train.delta>0){
          const validation=await compare(p,'promotion');gate=promotion(validation.a,validation.b);
          // One extra two-seed panel for borderline non-regressing evidence, never final seeds.
          if(!gate.accepted&&gate.delta>=0&&gate.paired_regressions===0){
            const extra=await compare(p,'promotion-extra');
            const merge=(a,b)=>a.map((r,i)=>({opponent:r.opponent,rows:[...r.rows,...b[i].rows]}));
            gate=promotion(merge(validation.a,extra.a),merge(validation.b,extra.b));
          }
        }
      }
      if(gate?.accepted){
        const previousChampion=s.champion;s.champion=p.candidate;s.history.push(s.champion);
        s.promotions.push({iteration:s.iteration,previous:previousChampion,champion:s.champion,gate});
        const record=Object.entries(s.records).find(([key,r])=>JSON.parse(key)[0]===s.champion&&r.directory&&r.rows.length&&fs.existsSync(path.join(r.directory,'0001/replay_latest.json')))?.[1];
        if(record)s.replays.push(path.relative(work,path.join(record.directory,'0001/replay_latest.json')));
      }
      // A bounded novelty reservoir supplies non-champion parents, even after conservative rejections.
      s.population=[...new Set([s.champion,p.candidate,...s.population])].slice(0,6);
      s.decisions.push({...p,gate});s.pending=null;s.iteration++;persist();prune(work,s,s.options['keep-replays']);
    }
    s.status='idle';s.stop_reason=o['finish-pending']?'Pending candidate resolved':'Iteration target reached';
  }catch(e){if(s){s.status=stopped||/budget|stop requested/.test(e.message)?'paused':'error';s.stop_reason=e.message;s.errors.push({at:new Date().toISOString(),message:e.message});}else throw e;}
  finally{
    if(deadline)clearTimeout(deadline);
    if(s){persist();fs.writeFileSync(path.join(work,'RUN_REPORT.md'),runReport(s));}process.removeListener('SIGINT',signal);process.removeListener('SIGTERM',signal);
    fs.unlinkSync(path.join(lock,'evolution-owner.json'));fs.rmdirSync(lock);
  }
}

export async function main(argv){
  const o=parse(argv),work=o.work;
  if(o.command==='status')return status(work);
  if(o.command==='stop'){
    const p=owner(work);if(!alive(p)){console.log('Run is not alive');return;}
    atomic(path.join(work,'stop.request'),{at:new Date().toISOString()});process.kill(p.pid,'SIGTERM');console.log(`Stop requested for ${p.pid}`);return;
  }
  if(o.command==='recover'){
    if(alive(owner(work)))throw Error('Worker still alive; use stop');
    for(const pid of ownedProcesses(work))process.kill(pid,'SIGTERM');
    await new Promise(r=>setTimeout(r,1000));recover(work);console.log('Owned orphan cleanup complete; resume explicitly');return;
  }
  if(o.command==='export'){
    const s=load(work);compatible(s,identity());verify(work,s.snapshots[s.champion]);
    if(!o.out)throw Error('Required --out new/path');const out=path.resolve(ROOT,o.out);
    if(fs.existsSync(out))throw Error('Export destination exists; never overwrite');
    copySource(path.join(work,'snapshots',s.champion),out);
    atomic(path.join(out,'model.json'),s.snapshots[s.champion].params);
    atomic(path.join(out,'provenance.json'),{champion:s.champion,snapshot:s.snapshots[s.champion],flags:FLAGS});
    console.log(`Exported C source to ${out}; make -C ${out} CLIENT_LIB_DIR=${ROOT}/bots/c/client_lib CFLAGS='${FLAGS}'`);return;
  }
  if(o.command==='start'&&fs.existsSync(path.join(work,'checkpoint.json')))throw Error('Use resume for existing run');
  if(['resume','test'].includes(o.command)&&!fs.existsSync(path.join(work,'checkpoint.json')))throw Error('Checkpoint missing');
  if(o.command==='test')o.test=true;
  if(o.background){
    if(alive(owner(work)))throw Error('Worker already alive');
    fs.mkdirSync(work,{recursive:true});const fd=fs.openSync(path.join(work,'console.log'),'a');
    const args=argv.filter(a=>a!=='--background');
    const child=spawn(process.execPath,[fileURLToPath(import.meta.url),...args],{cwd:ROOT,detached:true,stdio:['ignore',fd,fd],env:{...process.env,CORE_EVOLUTION_RUN:work}});
    fs.closeSync(fd);child.unref();console.log(`Background PID ${child.pid}; log ${work}/console.log`);return;
  }
  await run(o);
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main(process.argv.slice(2)).catch(e=>{console.error(e.stack);process.exitCode=1;});
