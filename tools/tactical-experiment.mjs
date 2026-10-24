#!/usr/bin/env node
/** Carrier selection uses our frozen strategy and Gridmaster ONLY.
 * The friend is tested externally AFTER selection is locked; it never selects a variant.
 */
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {evaluate} from './evaluate.mjs';
import {fileHash,sourceHash,assertBalanced,summarize} from './selfplay-core.mjs';
import {assertRules,designProperties} from './strategy-model.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const save=(p,v)=>fs.writeFileSync(p,JSON.stringify(v,null,2)+'\n');
const lock=path.join(root,'.training-lock');fs.mkdirSync(lock);
const start=Date.now();const elapsed=()=> (Date.now()-start)/1000;
let stop=false;const signal=()=>{stop=true;};process.on('SIGINT',signal);process.on('SIGTERM',signal);
let work;
try {
 if(fs.existsSync(path.join(root,'.match-lock')))throw Error('Match already active');
 const config=read(path.join(root,'bots/configs/fake_demo/game.config.json'));
 assertRules(config,read(path.join(root,'bots/c/bot/tactical-bot/supported_game_config.json')));
 if(designProperties(config,['speed','gem_carrying_efficiency']).cost!==52)throw Error('Carrier price changed');
 fs.mkdirSync(path.join(root,'logs/tactical-carrier-analysis'),{recursive:true});
 work=fs.mkdtempSync(path.join(root,'logs/tactical-carrier-analysis/experiment-'));
 console.log('Experiment:',work);
 const snapshots={};
 const flags='-Wall -Wextra -Werror -g -fsanitize=address';
 for(const [name,folder,carrier] of [['carrier','tactical-bot',1],['no-carrier','tactical-bot',0],['friend','friend',null],['baseline','strategy-bot',null],['gridmaster','gridmaster',null]]){
  const dir=path.join(work,name);fs.mkdirSync(dir);
  const source=path.join(root,'bots/c/bot',folder);
  for(const sub of ['src','inc'])fs.cpSync(path.join(source,sub),path.join(dir,sub),{recursive:true});
  fs.copyFileSync(path.join(source,'Makefile'),path.join(dir,'Makefile'));
  const args=['-C',dir,`CLIENT_LIB_DIR=${root}/bots/c/client_lib`,'EXEC=bot','-B'];
  if(carrier!==null)args.push(`CFLAGS=${flags} -DENABLE_CARRIERS=${carrier}`);
  const fd=fs.openSync(path.join(work,name+'-build.log'),'w');let result;
  try{result=spawnSync('make',args,{cwd:root,stdio:['ignore',fd,fd],timeout:120000});}finally{fs.closeSync(fd);}
  if(result.error||result.status!==0)throw Error('Build failed: '+name);
  snapshots[name]={dir,carrier,build_args:args,source_sha256:sourceHash(dir),binary_sha256:fileHash(path.join(dir,'bot'))};
 }
 save(path.join(work,'plan.json'),{max_matches:30,budget_seconds:900,
  reference_seeds:['tactics-reference-001','tactics-reference-002'],reference_opponents:['baseline','gridmaster'],
  external_friend_seeds:['friend-v2-001','friend-v2-002','friend-v2-003','friend-v2-004','friend-v2-005'],
  selection_rule:'Higher combined reference fitness; ties prefer no-carrier. Friend outcomes never select or retune the variant.',snapshots});
 let count=0;
 const panel=async(label,bot,seeds,opponent)=>{
  if(stop||elapsed()>=900)throw Error('Experiment stopped or wall budget exceeded');
  const number=seeds.length*2;if(count+number>30)throw Error('Match budget exceeded');count+=number;
  const result=await evaluate({root,a:snapshots[bot].dir,b:snapshots[opponent].dir,seeds,repeats:1,maxTicks:1000,
   wallSeconds:Math.max(1,Math.min(60,Math.floor((900-elapsed())/(32-count)))),jobs:4,build:false,outputParent:work});
  if(result.summary.failed)throw Error('Evaluation failed: '+result.directory);
  assertBalanced(result.rows);
  const score=summarize([{opponent,rows:result.rows}]);
  const record={label,bot,opponent,evaluation:result.directory,score,rows:result.rows};save(path.join(work,label+'.json'),record);return record;
 };
 const seeds=['tactics-reference-001','tactics-reference-002'];
 const reference={carrier:[], 'no-carrier':[]};
 for(const bot of ['carrier','no-carrier'])for(const opponent of ['baseline','gridmaster'])
  reference[bot].push(await panel(bot+'-vs-'+opponent,bot,seeds,opponent));
 const score=bot=>reference[bot].reduce((s,r)=>s+r.score.score,0)/reference[bot].length;
 const selected=score('carrier')>score('no-carrier')?'carrier':'no-carrier';
 save(path.join(work,'selection.json'),{selected,selection_locked:true,reference_carrier_fitness:score('carrier'),reference_no_carrier_fitness:score('no-carrier'),friend_used_for_selection:false});
 // No condition below can change selected. These outcomes are external tests only.
 const external=await panel('external-friend',selected,['friend-v2-001','friend-v2-002','friend-v2-003','friend-v2-004','friend-v2-005'],'friend');
 const control=await panel('fresh-reference-control',selected,['tactics-control-001','tactics-control-002'],'gridmaster');
 const summary={selected,reference_carrier:reference.carrier.map(r=>r.score),reference_no_carrier:reference['no-carrier'].map(r=>r.score),
  external_friend:external.score,fresh_reference:control.score,total_matches:count,elapsed_seconds:elapsed(),snapshots,
  friend_used_for_selection:false};
 save(path.join(work,'summary.json'),summary);console.log(JSON.stringify(summary,null,2));
} catch(e){if(work)save(path.join(work,'failure.json'),{error:e.message,elapsed_seconds:elapsed()});console.error(e.message);process.exitCode=1;}
finally{process.removeListener('SIGINT',signal);process.removeListener('SIGTERM',signal);fs.rmdirSync(lock);}
