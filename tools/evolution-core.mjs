import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {hash} from './strategy-model.mjs';
import {sourceHash,fileHash} from './selfplay-core.mjs';
import {exportHeader,validate,dependencySkip} from './evolution-policy.mjs';
export const ROOT=path.resolve(import.meta.dirname,'..');
export const FLAGS='-Wall -Wextra -Werror -O2 -fsanitize=address';
export const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
export function atomic(file,value){
  fs.mkdirSync(path.dirname(file),{recursive:true});
  const tmp=file+'.tmp',fd=fs.openSync(tmp,'w');
  try{fs.writeFileSync(fd,JSON.stringify(value,null,2)+'\n');fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
  fs.renameSync(tmp,file);
  const dir=fs.openSync(path.dirname(file),'r');try{fs.fsyncSync(dir);}finally{fs.closeSync(dir);}
}
export function save(work,s){
  const file=path.join(work,'checkpoint.json');
  if(fs.existsSync(file))fs.copyFileSync(file,file+'.previous');
  atomic(file,{format:1,checksum:hash(JSON.stringify(s)),state:s});
  atomic(path.join(work,'summary.json'),{version:1,updated:new Date().toISOString(),status:s.status,
    iteration:s.iteration,champion:s.champion,matches_reserved:s.matches,elapsed_seconds:s.elapsed,
    promotions:s.promotions?.length??0,last_error:s.errors?.at(-1)??null});
}
export function load(work){
  const file=path.join(work,'checkpoint.json'),d=read(file);
  if(d.format!==1||d.checksum!==hash(JSON.stringify(d.state))||d.state.version!==1)throw Error('Checkpoint integrity/version failure; inspect checkpoint.json.previous');
  return d.state;
}
export function identity(){
  const files=['tools/evolution.mjs','tools/evolution-core.mjs','tools/evolution-policy.mjs','tools/evolution-probe.c',
    'tools/evaluate.mjs','tools/selfplay-core.mjs','tools/strategy-model.mjs','bots/configs/fake_demo/game.config.json',
    'bots/configs/fake_demo/server.config.json','bots/c/client_lib/core_lib.a','server/server'];
  return {files:Object.fromEntries(files.map(p=>[p,fileHash(path.join(ROOT,p))])),
    source:sourceHash(path.join(ROOT,'bots/c/bot/evolution-bot')),flags:FLAGS,
    compiler:spawnSync('cc',['--version'],{encoding:'utf8'}).stdout};
}
export function compatible(s,id){if(JSON.stringify(s.identity)!==JSON.stringify(id))throw Error('Incompatible code/configuration/compiler/library/engine; preserve run and start a new work directory');}
export function copySource(src,dst){
  fs.mkdirSync(dst,{recursive:true});
  for(const n of ['src','inc','Makefile'])fs.cpSync(path.join(src,n),path.join(dst,n),{recursive:true});
}
export function build(dir,flags=FLAGS){
  const args=['-C',dir,`CLIENT_LIB_DIR=${ROOT}/bots/c/client_lib`,'EXEC=bot','-B',`CFLAGS=${flags}`];
  const r=spawnSync('make',args,{encoding:'utf8',timeout:60000});
  fs.writeFileSync(path.join(dir,'build.log'),(r.stdout??'')+(r.stderr??''));
  if(r.error||r.status!==0)throw Error(`Build failed: ${dir}/build.log`);
  return {command:'make',args,compiler:spawnSync('cc',['--version'],{encoding:'utf8'}).stdout};
}
export function snapshot(work,s,params,label,source){
  if(params)validate(params);
  const src=source??path.join(ROOT,'bots/c/bot/evolution-bot');
  const id=hash(JSON.stringify([sourceHash(src),params,FLAGS,s.identity.files['bots/c/client_lib/core_lib.a']]));
  const dir=path.join(work,'snapshots',id);
  if(s.snapshots[id]){verify(work,s.snapshots[id]);return id;}
  // A killed build is never a cached completed snapshot. Rebuild only its own incomplete directory.
  if(fs.existsSync(dir))fs.rmSync(dir,{recursive:true});
  copySource(src,dir);if(params)exportHeader(path.join(dir,'inc/evolution_params.h'),params);
  atomic(path.join(dir,'model.json'),params??{reference:label});
  const options=build(dir);
  const record={id,label,params,source:sourceHash(dir),binary:fileHash(path.join(dir,'bot')),
    model:fileHash(path.join(dir,'model.json')),build:options};
  atomic(path.join(dir,'snapshot.json'),record);s.snapshots[id]=record;save(work,s);return id;
}
export function verify(work,r){
  const dir=path.join(work,'snapshots',r.id);
  if(sourceHash(dir)!==r.source||fileHash(path.join(dir,'bot'))!==r.binary||fileHash(path.join(dir,'model.json'))!==r.model)throw Error(`Snapshot changed: ${r.id}`);
}
export function size(dir){return fs.readdirSync(dir,{withFileTypes:true}).reduce((n,e)=>n+(e.isDirectory()?size(path.join(dir,e.name)):fs.statSync(path.join(dir,e.name)).size),0);}
export function processIdentity(pid){
  try{const text=fs.readFileSync(`/proc/${pid}/stat`,'utf8').split(') ')[1].split(' ');
    return text[0]==='Z'?null:{pid:Number(pid),start:text[19]};}catch{return null;}
}
export function alive(owner){return !!owner&&processIdentity(owner.pid)?.start===owner.start;}
export function ownedProcesses(work){
  return fs.readdirSync('/proc').filter(n=>/^\d+$/.test(n)&&Number(n)!==process.pid).flatMap(n=>{
    try{return fs.readFileSync(`/proc/${n}/environ`).toString().split('\0').includes(`CORE_EVOLUTION_RUN=${work}`)&&processIdentity(n)?[Number(n)]:[];}catch{return [];}
  });
}
export function recover(work){
  const ownerFile=path.join(work,'owner.json');
  if(fs.existsSync(ownerFile)&&alive(read(ownerFile)))throw Error('Run is already alive');
  const children=ownedProcesses(work);
  if(children.length)throw Error(`Owned orphan processes still alive (${children}); use recover command before resume`);
  for(const name of ['.training-lock','.match-lock']){
    const dir=path.join(ROOT,name),marker=name==='.match-lock'?path.join(ROOT,'.match-lock.evolution-owner.json'):path.join(dir,'evolution-owner.json');
    if(!fs.existsSync(dir))continue;
    if(!fs.existsSync(marker)||read(marker).work!==work)throw Error(`Unowned ${name}; inspect manually`);
    fs.unlinkSync(marker);fs.rmdirSync(dir);
  }
}
export function prune(work,s,keep){
  const protectedDirs=new Set(s.replays.map(p=>path.resolve(work,path.dirname(path.dirname(p)))));
  const dirs=fs.readdirSync(work).filter(n=>n.startsWith('evaluation-')).map(n=>path.join(work,n)).sort((a,b)=>fs.statSync(a).birthtimeMs-fs.statSync(b).birthtimeMs);
  // Remove only large replay payloads in this run; all result/manifests/log evidence stays.
  for(const dir of dirs.slice(0,Math.max(0,dirs.length-keep)))if(!protectedDirs.has(dir)){
    for(const sub of fs.readdirSync(dir,{withFileTypes:true}).filter(e=>e.isDirectory())){
      const replay=path.join(dir,sub.name,'replay_latest.json');if(fs.existsSync(replay))fs.unlinkSync(replay);
    }
  }
}
export function diagnostics(work,s,parent,child){
  const reason=dependencySkip(s.snapshots[parent].params,s.snapshots[child].params);
  if(reason)return {type:'policy dependency reachability',states:0,changed:0,reason};
  const outputs=[];
  for(const id of [parent,child]){
    const dir=path.join(work,'snapshots',id),exe=path.join(dir,'decision-probe');
    if(!fs.existsSync(exe)){
      const r=spawnSync('cc',['-Wall','-Wextra','-Werror','-O2','-I',path.join(ROOT,'bots/c/client_lib/inc'),
        '-I',path.join(dir,'inc'),'-I',path.join(dir,'src'),path.join(ROOT,'tools/evolution-probe.c'),'-o',exe],{encoding:'utf8'});
      if(r.status!==0)throw Error(r.stderr);
    }
    const r=spawnSync(exe,[],{encoding:'utf8'});if(r.status!==0)throw Error('Decision probe failed');outputs.push(r.stdout.trim().split('\n'));
  }
  return {type:'deterministic C synthetic-state action counterfactual, not win attribution',states:outputs[0].length,
    changed:outputs[0].filter((v,i)=>v!==outputs[1][i]).length,digests:outputs.map(o=>hash(o.join('\n')))};
}
