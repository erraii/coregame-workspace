#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { evaluate, assertSameLayouts } from './evaluate.mjs';
import { header as policyHeader } from './policy-model.mjs';
import { validateStrategy, loadInitialStrategy, exportStrategy, mutateStrategy, mutationRandom, assertRules, hash, modelHash } from './strategy-model.mjs';
import { publishReplay } from './friendly.mjs';
import { saveJSON, readJSON, sourceHash, fileHash, verifySnapshot, selectOpponents,
  assertBalanced, summarize, promotion, validateResume, canContinueSearch } from './selfplay-core.mjs';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
function options(argv) {
  const o={work:'logs/selfplay-demo',iterations:1,trainSeeds:['sp-train-001','sp-train-002'],
    promotionSeeds:['sp-promote-001','sp-promote-002'],testSeeds:['sp-test-001','sp-test-002'],
    maxTicks:500,wallSeconds:20,budgetSeconds:600,maxMatches:120,searchSeed:42,resume:false,
    from:'bots/c/bot/strategy-bot/selected_strategy.json',historyModels:[],finalReserveSeconds:0};
  const specified=[];
  const names={'--work':'work','--iterations':'iterations','--train-seeds':'trainSeeds',
    '--promotion-seeds':'promotionSeeds','--test-seeds':'testSeeds','--max-ticks':'maxTicks',
    '--wall-seconds':'wallSeconds','--budget-seconds':'budgetSeconds','--max-matches':'maxMatches','--search-seed':'searchSeed',
    '--from':'from','--history-models':'historyModels','--final-reserve-seconds':'finalReserveSeconds'};
  for (let i=0;i<argv.length;i++) {
    if (argv[i]==='--resume') {o.resume=true;continue;}
    if (argv[i]==='--help') {o.help=true;continue;}
    const key=names[argv[i]];
    if (!key || !argv[i+1] || argv[i+1].startsWith('--')) throw new Error(`Invalid option: ${argv[i]}`);
    specified.push(key); const value=argv[++i];
    o[key]=key.endsWith('Seeds') || key==='historyModels' ? value.split(',') : ['work','from'].includes(key) ? value : Number(value);
  }
  for (const k of ['iterations','maxTicks','wallSeconds','budgetSeconds','maxMatches','searchSeed'])
    if (!Number.isSafeInteger(o[k]) || o[k]<(k==='searchSeed'?0:1)) throw new Error(`Invalid ${k}`);
  o.work=path.resolve(ROOT,o.work);
  if(!Number.isSafeInteger(o.finalReserveSeconds) || o.finalReserveSeconds<0)throw new Error('Invalid final reserve');
  return {o,specified};
}

async function main() {
  let {o,specified}=options(process.argv.slice(2));
  if (o.help) {console.log('Usage: node tools/selfplay.mjs [--work logs/selfplay-demo] [--resume]\n'+
    '[--iterations 1] [--train-seeds sp-train-001,sp-train-002]\n'+
    '[--promotion-seeds sp-promote-001,sp-promote-002] [--test-seeds sp-test-001,sp-test-002]\n'+
    '[--max-ticks 500] [--wall-seconds 20] [--budget-seconds 600] [--max-matches 120] [--search-seed 42]\n'+
    '[--from MODEL.json] [--history-models MODEL.json,MODEL.json] [--final-reserve-seconds 180]');return;}
  const checkpoint=path.join(o.work,'checkpoint.json');
  let state;
  if (o.resume) {
    state=readJSON(checkpoint);
    if(state.selection_frozen && specified.includes('iterations') && o.iterations!==state.options.iterations)
      throw new Error('Selection frozen: cannot extend training after final testing starts');
    for (const key of specified.filter(k=>k!=='work')) {
      if (['iterations','budgetSeconds','maxMatches'].includes(key)) {
        if(o[key]<state.options[key]) throw new Error(`Cannot reduce ${key} on resume`);
        state.options[key]=o[key];
      } else if(JSON.stringify(o[key])!==JSON.stringify(state.options[key])) throw new Error(`Cannot change ${key} on resume`);
    }
    o={...state.options,work:o.work,resume:true};
    if(state.finalized) throw new Error('Run already finalized: final test results cannot be used for further training. Start a fresh work directory.');
  } else if(fs.existsSync(checkpoint)) throw new Error('Checkpoint exists; use --resume');
  const lists=[o.trainSeeds,o.promotionSeeds,o.testSeeds];
  if(lists.some((a,i)=>a.length<(i===0?1:2) || a.some(s=>!s.trim() || s!==s.trim())) ||
    new Set(lists.flat()).size!==lists.flat().length) throw new Error('Seed sets must be nonempty and disjoint; promotion/test require >=2 seeds');
  const lock=path.join(ROOT,'.training-lock');
  fs.mkdirSync(lock);
  const started=Date.now(); let interrupted=false;
  const signal=()=>{interrupted=true;};
  process.on('SIGINT',signal);process.on('SIGTERM',signal);
  const previousElapsed=state?.elapsed_seconds??0;
  const elapsed=()=>previousElapsed+(Date.now()-started)/1000;
  const persist=()=>{if(state){state.elapsed_seconds=elapsed();saveJSON(checkpoint,state);}};
  const budget=()=>{if(interrupted)throw new Error('Self-play interrupted');
    if(elapsed()>=o.budgetSeconds)throw new Error('Session wall budget exhausted; checkpoint saved');};
  const make=(dir,args=[])=>{
    budget();fs.mkdirSync(o.work,{recursive:true});
    const fd=fs.openSync(path.join(o.work,'build.log'),'a');
    let result;
    try{result=spawnSync('make',['-C',dir,...args],{cwd:ROOT,stdio:['ignore',fd,fd],
      timeout:Math.max(1,Math.min(120000,(o.budgetSeconds-elapsed())*1000))});}finally{fs.closeSync(fd);}
    if(result.error || result.status!==0)throw new Error(`Build failed: inspect ${o.work}/build.log`);
  };
  try {
    if(fs.existsSync(path.join(ROOT,'.match-lock')))throw new Error('A match is active');
    const strategy=path.join(ROOT,'bots/c/bot/strategy-bot');
    assertRules(readJSON(path.join(ROOT,'bots/configs/fake_demo/game.config.json')),
      readJSON(path.join(strategy,'supported_game_config.json')));
    make('bots/c/client_lib');make('server',['dev','JOBS=4']);
    // Generated selected header is excluded from the implementation identity.
    const codeIdentity=dir=>{
      const items=[];
      for(const sub of ['src','inc']) for(const name of fs.readdirSync(path.join(dir,sub)).sort())
        if(name!=='strategy_params.h')items.push([`${sub}/${name}`,fileHash(path.join(dir,sub,name))]);
      items.push(['Makefile',fileHash(path.join(dir,'Makefile'))]);return hash(JSON.stringify(items));
    };
    const identity={strategy:codeIdentity(strategy),baseline:sourceHash(path.join(ROOT,'bots/c/bot/policy-bot')),
      gridmaster:sourceHash(path.join(ROOT,'bots/c/bot/gridmaster')),
      tools:hash(['selfplay.mjs','selfplay-core.mjs','strategy-model.mjs','evaluate.mjs','policy-model.mjs','friendly.mjs'].map(f=>fileHash(path.join(ROOT,'tools',f))).join('')),
      game:fileHash(path.join(ROOT,'bots/configs/fake_demo/game.config.json')),
      server_config:fileHash(path.join(ROOT,'bots/configs/fake_demo/server.config.json')),
      engine:fileHash(path.join(ROOT,'server/server')),client:fileHash(path.join(ROOT,'bots/c/client_lib/core_lib.a'))};
    if(state)validateResume(state,identity);
    else state={version:1,options:o,identity,iteration:0,incumbent:null,fixed:[],history:[],snapshots:{},records:{},
      decisions:[],matches_reserved:0,elapsed_seconds:0,finalized:false};
    const snapshot=(kind,dir,model)=>{
      const id=hash(JSON.stringify([kind,kind==='strategy'?codeIdentity(dir):sourceHash(dir),model,identity.client]));
      if(state.snapshots[id])return verifySnapshot(state.snapshots[id]);
      const dest=path.join(o.work,'snapshots',id);fs.mkdirSync(dest,{recursive:true});
      for(const sub of ['src','inc'])fs.cpSync(path.join(dir,sub),path.join(dest,sub),{recursive:true});
      fs.copyFileSync(path.join(dir,'Makefile'),path.join(dest,'Makefile'));
      if(kind==='strategy')exportStrategy(path.join(dest,'inc/strategy_params.h'),model);
      saveJSON(path.join(dest,'model.json'),model);
      make(dest,[`CLIENT_LIB_DIR=${ROOT}/bots/c/client_lib`,'EXEC=bot']);
      const result={id,kind,dir:dest,model,source_sha256:sourceHash(dest),binary_sha256:fileHash(path.join(dest,'bot')),
        model_file_sha256:fileHash(path.join(dest,'model.json'))};
      saveJSON(path.join(dest,'snapshot.json'),result);state.snapshots[id]=result;persist();return result;
    };
    if(!state.incumbent){
      const baselineDir=path.join(ROOT,'bots/c/bot/policy-bot');
      const baselineModel=readJSON(path.join(baselineDir,'selected_policy.json'));
      if(fs.readFileSync(path.join(baselineDir,'inc/policy_weights.h'),'utf8')!==policyHeader(baselineModel))
        throw new Error('Baseline JSON and embedded policy header disagree; restore a consistent baseline before self-play');
      const baseline=snapshot('baseline',baselineDir,baselineModel);
      const grid=snapshot('gridmaster',path.join(ROOT,'bots/c/bot/gridmaster'),{reference:'Gridmaster'});
      const initialModel=loadInitialStrategy(path.resolve(ROOT,o.from));
      const initial=snapshot('strategy',strategy,initialModel);
      const historical=o.historyModels.map(file=>snapshot('strategy',strategy,validateStrategy(readJSON(path.resolve(ROOT,file)))));
      state.fixed=[baseline.id,grid.id];state.history=[...new Set([...historical.map(s=>s.id),initial.id])];
      state.incumbent=initial.id;state.initial=initial.id;persist();
    }
    console.log(`Self-play workspace: ${o.work}; ${state.matches_reserved}/${o.maxMatches} matches reserved`);
    const panel=async(label,subjectId,opponents,seeds)=>{
      const records=[];
      for(const opponentId of opponents){
        budget();const key=hash(JSON.stringify([label,subjectId,opponentId,seeds]));
        const subject=verifySnapshot(state.snapshots[subjectId]),opponent=verifySnapshot(state.snapshots[opponentId]);
        if(state.records[key]){records.push(state.records[key]);continue;}
        const count=seeds.length*2;
        if(state.matches_reserved+count>o.maxMatches)throw new Error('Match budget exhausted; checkpoint saved');
        // Reserve the complete evaluation before launching. Failed attempts consume this budget too.
        state.matches_reserved+=count;persist();
        const remaining=o.budgetSeconds-elapsed();
        if(remaining<count)throw new Error('Insufficient wall budget for this panel');
        console.log(`${label}: ${subject.kind}:${subject.id.slice(0,8)} vs ${opponent.kind}:${opponent.id.slice(0,8)}`);
        const result=await evaluate({root:ROOT,a:subject.dir,b:opponent.dir,seeds,repeats:1,
          maxTicks:o.maxTicks,wallSeconds:Math.max(1,Math.min(o.wallSeconds,Math.floor(remaining/count))),jobs:4,build:false});
        if(result.summary.failed){
          state.failed_evaluation=result.directory;
          state.failures??=[];
          state.failures.push({label,subject:subjectId,opponent:opponentId,evaluation:result.directory,summary:result.summary});
          persist();throw new Error('Evaluation failed; no fitness assigned; inspect '+result.directory);
        }
        assertBalanced(result.rows);
        const record={label,subject:subjectId,opponent:opponentId,subject_binary:subject.binary_sha256,
          opponent_binary:opponent.binary_sha256,evaluation:result.directory,rows:result.rows,summary:result.summary};
        // A seed's terrain and team ownership must match across every policy and opponent.
        for(const old of Object.values(state.records)) {
          const common=result.rows.filter(row=>old.rows.some(prev=>prev.seed===row.seed && prev.a_team_id===row.a_team_id));
          if(common.length)assertSameLayouts(old.rows,common);
        }
        state.records[key]=record;persist();records.push(record);
      }
      return records;
    };
    for(let iteration=state.iteration;canContinueSearch(state,o.iterations);iteration++){
      const incumbent=state.incumbent;
      const opponents=selectOpponents(state.fixed,state.history,iteration);
      const measured=Object.values(state.records).flatMap(r=>r.rows);
      const secondsPerMatch=measured.length?measured.reduce((sum,r)=>sum+r.elapsed_seconds,0)/measured.length:3.125;
      const worstIterationMatches=opponents.length*(o.trainSeeds.length+o.promotionSeeds.length)*4;
      if(o.finalReserveSeconds && o.budgetSeconds-elapsed()<o.finalReserveSeconds+worstIterationMatches*secondsPerMatch*1.35){
        state.training_stopped_early={iteration,reason:'Reserve final testing before starting another complete candidate comparison',seconds_per_match:secondsPerMatch};
        persist();break;
      }
      const random=mutationRandom(o.searchSeed,iteration);
      const model=mutateStrategy(state.snapshots[incumbent].model,iteration,random);
      validateStrategy(model);const candidate=snapshot('strategy',strategy,model);
      const incTrain=await panel(`iteration-${iteration}-train-incumbent`,incumbent,opponents,o.trainSeeds);
      const candTrain=await panel(`iteration-${iteration}-train-candidate`,candidate.id,opponents,o.trainSeeds);
      const trainDelta=summarize(candTrain).score-summarize(incTrain).score;
      const decision={iteration,incumbent,candidate:candidate.id,opponents,training_delta:trainDelta,promoted:false,
        changed_parameters:Object.keys(model.params).filter(k=>model.params[k]!==state.snapshots[incumbent].model.params[k]),
        incumbent_training:summarize(incTrain),candidate_training:summarize(candTrain)};
      if(trainDelta>1e-12){
        const incPromotion=await panel(`iteration-${iteration}-promotion-incumbent`,incumbent,opponents,o.promotionSeeds);
        const candPromotion=await panel(`iteration-${iteration}-promotion-candidate`,candidate.id,opponents,o.promotionSeeds);
        decision.promotion=promotion(incPromotion,candPromotion);
        if(decision.promotion.accepted){state.incumbent=candidate.id;state.history.push(candidate.id);decision.promoted=true;}
      }
      state.decisions.push(decision);state.iteration=iteration+1;persist();
      console.log(`Iteration ${iteration}: train delta=${trainDelta.toFixed(4)}, promoted=${decision.promoted}`);
    }
    // Freeze selection before exposing any final test results. A finalized run cannot be extended.
    state.selection_frozen=true;persist();
    const finalOpponents=selectOpponents(state.fixed,state.history,state.iteration);
    // Exclude the selected policy itself; retain the initial strategy as historical control.
    const opponents=[...new Set([...finalOpponents.filter(id=>id!==state.incumbent),state.initial])];
    const initialTest=await panel('final-test-initial',state.initial,opponents,o.testSeeds);
    const selectedTest=await panel('final-test-selected',state.incumbent,opponents,o.testSeeds);
    const selected=verifySnapshot(state.snapshots[state.incumbent]);
    exportStrategy(path.join(strategy,'inc/strategy_params.h'),selected.model);
    saveJSON(path.join(strategy,'selected_strategy.json'),selected.model);
    make(strategy,[`CLIENT_LIB_DIR=${ROOT}/bots/c/client_lib`,'EXEC=bot']);
    // The exact parameter digest must be embedded in the freshly compiled executable.
    if(!fs.readFileSync(path.join(strategy,'bot')).includes(Buffer.from(modelHash(selected.model))))
      throw new Error('Exported model fingerprint missing from compiled bot');
    const example=selectedTest[0];const row=example.rows.find(r=>r.status==='completed');
    const replay=path.join(example.evaluation,row.folder,'replay_latest.json');
    const publication=publishReplay(replay);
    state.finalized=true;
    delete state.last_error;
    const summary={selected:state.incumbent,selected_model:selected.model,decisions:state.decisions,
      initial_test:summarize(initialTest),selected_test:summarize(selectedTest),matches_reserved:state.matches_reserved,
      elapsed_seconds:elapsed(),published_replay:replay,replay_publication:publication,identity:state.identity,
      training_stopped_early:state.training_stopped_early??null,
      note:'Evolutionary parameter search. Final test never selects policies. Small paired panels do not prove generalization.'};
    saveJSON(path.join(o.work,'summary.json'),summary);persist();console.log(JSON.stringify(summary,null,2));
  }catch(error){if(state){state.last_error=error.message;persist();}throw error;}
  finally{persist();process.removeListener('SIGINT',signal);process.removeListener('SIGTERM',signal);fs.rmdirSync(lock);}
}

if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url))
  main().catch(error=>{console.error(`ERROR: ${error.message}`);process.exitCode=1;});
