#!/usr/bin/env node
/** Friendly matches only: isolate builds, preserve snapshots, reuse the evaluator. */
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {evaluate} from './evaluate.mjs';
import {assertBalanced, fileHash, sourceHash} from './selfplay-core.mjs';
import {assertRules} from './strategy-model.mjs';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const FROZEN=path.join(ROOT,'preserved/first-victory-20261024');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const write=(p,value)=>fs.writeFileSync(p,JSON.stringify(value,null,2)+'\n');

export function verifySeal(directory) {
  const lines=fs.readFileSync(path.join(directory,'SHA256SUMS'),'utf8').trim().split('\n');
  for(const line of lines){
    const match=line.match(/^([a-f0-9]{64})  (.+)$/);
    if(!match)throw new Error('Invalid snapshot seal');
    const file=path.resolve(directory,match[2]);
    if(!file.startsWith(path.resolve(directory)+path.sep) || fileHash(file)!==match[1])
      throw new Error(`Frozen snapshot changed: ${match[2]}`);
  }
  return lines.length;
}

export function publishReplay(source, root=ROOT) {
  const replay=read(source);
  if(!replay.ticks || !replay.misc || !Number.isInteger(replay.full_tick_amount))throw new Error('Not a CORE replay');
  const destination=path.join(root,'visualizer/public/replays/replay_latest.json');
  fs.mkdirSync(path.dirname(destination),{recursive:true});
  fs.mkdirSync(path.join(root,'logs'),{recursive:true});
  const directory=fs.mkdtempSync(path.join(root,'logs/replay-publication-'));
  const backup=fs.existsSync(destination)?path.join(directory,'previous-replay.json'):null;
  if(backup)fs.copyFileSync(destination,backup,fs.constants.COPYFILE_EXCL);
  // Write a separate temporary file, then atomically replace the published file.
  const temporary=path.join(path.dirname(destination),`.friendly-${path.basename(directory)}.json`);
  try{fs.copyFileSync(source,temporary,fs.constants.COPYFILE_EXCL);fs.renameSync(temporary,destination);}
  finally{if(fs.existsSync(temporary))fs.unlinkSync(temporary);}
  const result={source:path.resolve(source),source_sha256:fileHash(source),destination,backup,
    backup_sha256:backup?fileHash(backup):null};
  write(path.join(directory,'publication.json'),result);return result;
}

export function parseFriendly(argv) {
  const [mode,...args]=argv;
  if(!['single','pair','batch'].includes(mode))throw new Error('Use single, pair, batch, or publish REPLAY.json');
  const o={mode,bot:'current',seeds:['friendly-001'],side:42,maxTicks:1000,wallSeconds:60,carriers:'auto'};
  const names={'--bot':'bot','--seeds':'seeds','--side':'side','--max-ticks':'maxTicks','--wall-seconds':'wallSeconds','--carriers':'carriers'};
  for(let i=0;i<args.length;i++){
    const key=names[args[i]],value=args[++i];
    if(!key || !value || value.startsWith('--'))throw new Error('Unknown option or missing value');
    o[key]=key==='seeds'?value.split(','):['bot','carriers'].includes(key)?value:Number(value);
  }
  if(!['current','first-victory','tactical'].includes(o.bot))throw new Error('bot must be current, first-victory, or tactical');
  if(!['auto','on','off'].includes(o.carriers) || o.carriers!=='auto' && o.bot!=='tactical')throw new Error('carriers must be auto/on/off and is configurable only for tactical');
  if(![42,418].includes(o.side))throw new Error('side is our team ID: 42 or 418');
  if(!o.seeds.length || o.seeds.some(s=>!s || s!==s.trim()) || new Set(o.seeds).size!==o.seeds.length)
    throw new Error('Use nonempty unique seeds');
  if(mode!=='batch' && o.seeds.length!==1)throw new Error('single and pair require one seed');
  for(const key of ['maxTicks','wallSeconds'])if(!Number.isSafeInteger(o[key]) || o[key]<1)throw new Error(`Invalid ${key}`);
  return o;
}

function copySource(source,destination) {
  fs.mkdirSync(destination,{recursive:true});
  for(const sub of ['src','inc'])fs.cpSync(path.join(source,sub),path.join(destination,sub),{recursive:true});
  fs.copyFileSync(path.join(source,'Makefile'),path.join(destination,'Makefile'));
  // Read-only snapshot inputs become writable only in the disposable working copy.
  for(const sub of ['src','inc']){
    const walk=dir=>{fs.chmodSync(dir,0o755);for(const e of fs.readdirSync(dir,{withFileTypes:true})){
      const p=path.join(dir,e.name);if(e.isDirectory())walk(p);else fs.chmodSync(p,0o644);
    }};walk(path.join(destination,sub));
  }
  fs.chmodSync(path.join(destination,'Makefile'),0o644);
}

async function main(argv) {
  if(argv[0]==='--help' || !argv.length){
    console.log('node tools/friendly.mjs single|pair|batch [--bot current|first-victory|tactical] [--seeds friendly-001,friendly-002]\n'+
      '  [--carriers auto|on|off] (tactical only) [--side 42|418] (single only) [--max-ticks 1000] [--wall-seconds 60]\n'+
      'node tools/friendly.mjs publish PATH/TO/replay_latest.json');return;
  }
  if(argv[0]==='publish'){
    if(argv.length!==2)throw new Error('publish requires one replay path');
    console.log(JSON.stringify(publishReplay(path.resolve(argv[1])),null,2));return;
  }
  const o=parseFriendly(argv);
  const lock=path.join(ROOT,'.training-lock');
  try{fs.mkdirSync(lock);}catch(e){if(e.code==='EEXIST')throw new Error('A trainer or friendly wrapper is active');throw e;}
  let directory;
  let interrupted=false;
  const onSignal=()=>{interrupted=true;};
  process.on('SIGINT',onSignal);process.on('SIGTERM',onSignal);
  try{
    if(fs.existsSync(path.join(ROOT,'.match-lock')))throw new Error('A match is active');
    if(o.bot==='first-victory'){
      verifySeal(FROZEN);
      const historical=read(path.join(FROZEN,'evidence/manifest.json'));
      if(fileHash(path.join(ROOT,'server/server'))!==historical.binaries[path.join(ROOT,'server/server')])
        throw new Error('Engine differs from the recorded winning engine');
      for(const [name,key] of [['game','game_config_sha256'],['server','server_config_sha256']])
        if(fileHash(path.join(ROOT,`bots/configs/fake_demo/${name}.config.json`))!==historical[key])
          throw new Error('Game/server base configuration differs from the victory');
    }
    fs.mkdirSync(path.join(ROOT,'logs'),{recursive:true});
    directory=fs.mkdtempSync(path.join(ROOT,'logs/friendly-run-'));
    console.log(`Friendly run: ${directory}`);
    const ours=path.join(directory,'our-bot'),friend=path.join(directory,'friend');
    const source=o.bot==='first-victory'?path.join(FROZEN,'our-bot'):path.join(ROOT,'bots/c/bot',o.bot==='tactical'?'tactical-bot':'strategy-bot');
    if(o.bot==='tactical')assertRules(read(path.join(ROOT,'bots/configs/fake_demo/game.config.json')),read(path.join(source,'supported_game_config.json')));
    copySource(source,ours);copySource(path.join(ROOT,'bots/c/bot/friend'),friend);
    const library=path.join(ROOT,'bots/c/client_lib');
    const libraryHash=fileHash(path.join(library,'core_lib.a'));
    const build=(dir,label)=>{
      if(interrupted)throw new Error('Friendly match interrupted');
      const fd=fs.openSync(path.join(directory,`${label}-build.log`),'w');
      let result;
      const args=['-C',dir,`CLIENT_LIB_DIR=${library}`,'EXEC=bot','-B'];
      if(label==='our' && o.bot==='tactical' && o.carriers!=='auto')args.push(`CFLAGS=-Wall -Wextra -Werror -g -fsanitize=address -DENABLE_CARRIERS=${o.carriers==='on'?1:0}`);
      try{result=spawnSync('make',args,
        {cwd:ROOT,stdio:['ignore',fd,fd],timeout:120000});}finally{fs.closeSync(fd);}
      if(result.error || result.status!==0)throw new Error(`Build failed: ${directory}/${label}-build.log`);
      if(interrupted)throw new Error('Friendly match interrupted');
    };
    if(o.bot!=='first-victory')build(ours,'our');
    else fs.copyFileSync(path.join(FROZEN,'our-bot/bot'),path.join(ours,'bot'));
    build(friend,'friend');
    if(fileHash(path.join(library,'core_lib.a'))!==libraryHash)throw new Error('Shared library changed unexpectedly');
    write(path.join(directory,'friendly-manifest.json'),{options:o,frozen_snapshot:o.bot==='first-victory'?FROZEN:null,
      our_source_sha256:sourceHash(ours),friend_source_sha256:sourceHash(friend),
      our_binary_sha256:fileHash(path.join(ours,'bot')),friend_binary_sha256:fileHash(path.join(friend,'bot')),
      client_library_sha256:libraryHash});
    const result=await evaluate({root:ROOT,a:ours,b:friend,seeds:o.seeds,repeats:1,
      aTeams:o.mode==='single'?[o.side]:[42,418],outputParent:directory,
      maxTicks:o.maxTicks,wallSeconds:o.wallSeconds,jobs:4,build:false});
    if(result.summary.failed)throw new Error(`Evaluation failed; inspect ${result.directory}`);
    if(o.mode!=='single')assertBalanced(result.rows);
    write(path.join(directory,'friendly-result.json'),{evaluation:result.directory,summary:result.summary,rows:result.rows});
    console.log(`Replays: ${result.directory}/0001/replay_latest.json`);
    if(result.rows.length>1)console.log(`         ${result.directory}/0002/replay_latest.json`);
    console.log('Publish any replay with: node tools/friendly.mjs publish PATH/TO/replay_latest.json');
  }catch(e){if(directory)write(path.join(directory,'failure.json'),{error:e.message});throw e;}
  finally{process.removeListener('SIGINT',onSignal);process.removeListener('SIGTERM',onSignal);fs.rmdirSync(lock);}
}
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url))
  main(process.argv.slice(2)).catch(e=>{console.error(`ERROR: ${e.message}`);process.exitCode=1;});
