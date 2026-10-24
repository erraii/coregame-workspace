#!/usr/bin/env node
// Replay the verified tactical source through isolated builds and the existing evaluator.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {evaluate} from './evaluate.mjs';
import {assertBalanced, fileHash, sourceHash} from './selfplay-core.mjs';
import {assertRules} from './strategy-model.mjs';
import {publishReplay} from './friendly.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const seed=process.argv[2];
if(process.argv.length!==3 || !seed || seed.startsWith('-'))throw new Error('Usage: node tools/friendly-verified-tactical.mjs NEW_SEED');
const original=path.join(root,'logs/tactical-carrier-analysis/experiment-glS5Xk');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const write=(p,d)=>fs.writeFileSync(p,JSON.stringify(d,null,2)+'\n',{flag:'wx'});
const expected=read(path.join(original,'summary.json')).snapshots['no-carrier'];
const source=path.join(original,'no-carrier');
if(sourceHash(source)!==expected.source_sha256 || fileHash(path.join(source,'bot'))!==expected.binary_sha256)
  throw new Error('Verified experiment source or executable changed');
assertRules(read(path.join(root,'bots/configs/fake_demo/game.config.json')),
  read(path.join(root,'bots/c/bot/tactical-bot/supported_game_config.json')));
// Preserve every existing bot, snapshot, and log file, including all training records.
const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>{
  const p=path.join(dir,e.name);
  return e.isDirectory()?walk(p):e.isFile()?[p]:[];
});
const before=Object.fromEntries(['bots/c/bot','bots/c/client_lib','preserved','logs'].flatMap(dir=>walk(path.join(root,dir)))
  .map(p=>[path.relative(root,p),fileHash(p)]));
const lock=path.join(root,'.training-lock');
fs.mkdirSync(lock);
let directory;
try {
  if(fs.existsSync(path.join(root,'.match-lock')))throw new Error('Match lock exists');
  directory=fs.mkdtempSync(path.join(root,'logs/friendly-verified-tactical-'));
  console.log(`Friendly run: ${directory}`);
  write(path.join(directory,'preservation-before.json'),before);
  const ours=path.join(directory,'our-bot'),friend=path.join(directory,'friend');
  for(const [src,dst] of [[source,ours],[path.join(root,'bots/c/bot/friend'),friend]]){
    fs.mkdirSync(dst);
    for(const sub of ['src','inc','Makefile'])fs.cpSync(path.join(src,sub),path.join(dst,sub),{recursive:true});
  }
  if(sourceHash(ours)!==expected.source_sha256)throw new Error('Isolated source differs');
  const library=path.join(root,'bots/c/client_lib');
  const flags='-Wall -Wextra -Werror -g -fsanitize=address -DENABLE_CARRIERS=0';
  const builds=[];
  for(const [dir,label] of [[ours,'our'],[friend,'friend']]){
    const args=['-C',dir,`CLIENT_LIB_DIR=${library}`,'EXEC=bot','-B'];
    if(label==='our')args.push(`CFLAGS=${flags}`);
    const fd=fs.openSync(path.join(directory,`${label}-build.log`),'wx');
    let result;
    try{result=spawnSync('make',args,{cwd:root,stdio:['ignore',fd,fd],timeout:120000});}
    finally{fs.closeSync(fd);}
    builds.push({command:'make',args,status:result.status});
    if(result.error || result.status!==0)throw new Error(`Build failed: ${label}`);
  }
  const manifest={seed,carriers:false,verified_experiment:original,expected,
    isolated_source_sha256:sourceHash(ours),isolated_binary_sha256:fileHash(path.join(ours,'bot')),
    historical_binary_identical:fileHash(path.join(ours,'bot'))===expected.binary_sha256,
    strategy_header_sha256:fileHash(path.join(ours,'inc/strategy_params.h')),
    friend_source_sha256:sourceHash(friend),friend_binary_sha256:fileHash(path.join(friend,'bot')),
    client_library_sha256:fileHash(path.join(library,'core_lib.a')),
    engine_sha256:fileHash(path.join(root,'server/server')),
    compiler:spawnSync('cc',['--version'],{encoding:'utf8'}).stdout,builds,
    provenance_note:'Exact verified source/header and build flags; rebuilt binary has its own recorded hash. Debug paths can differ between isolated build directories.'};
  write(path.join(directory,'provenance.json'),manifest);
  const result=await evaluate({root,a:ours,b:friend,seeds:[seed],repeats:1,aTeams:[42,418],
    outputParent:directory,maxTicks:1000,wallSeconds:60,jobs:4,build:false});
  write(path.join(directory,'result.json'),result);
  if(result.summary.failed || result.rows.length!==2)throw new Error('Pair incomplete; inspect saved results');
  assertBalanced(result.rows);
  if(fileHash(path.join(ours,'bot'))!==manifest.isolated_binary_sha256)throw new Error('Played executable changed');
  const changed=Object.entries(before).filter(([p,digest])=>!fs.existsSync(path.join(root,p)) || fileHash(path.join(root,p))!==digest);
  write(path.join(directory,'preservation-after.json'),{checked:Object.keys(before).length,changed});
  if(changed.length)throw new Error('Protected files changed; inspect preservation-after.json');
  const chosen=result.rows.find(r=>r.outcome_a==='win')??result.rows[0];
  const publication=publishReplay(path.join(result.directory,chosen.folder,'replay_latest.json'),root);
  write(path.join(directory,'publication.json'),publication);
  console.log(JSON.stringify({directory,summary:result.summary,rows:result.rows.map(r=>({folder:r.folder,
    outcome:r.outcome_a,decision:r.decision,tick:r.final_tick,team:r.a_team_id,positions:r.initial_cores})),
    preservation_files:Object.keys(before).length,publication},null,2));
} catch(e) {
  if(directory)write(path.join(directory,'failure.json'),{error:e.message});
  throw e;
} finally {
  fs.rmdirSync(lock);
}
