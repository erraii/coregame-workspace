import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileHash} from './selfplay-core.mjs';
import {parseFriendly,publishReplay,verifySeal} from './friendly.mjs';

test('friendly modes select current/frozen bots with strict seed and side validation',()=>{
  assert.equal(parseFriendly(['single','--side','418']).side,418);
  assert.equal(parseFriendly(['pair','--bot','first-victory']).bot,'first-victory');
  assert.equal(parseFriendly(['pair','--bot','tactical']).bot,'tactical');
  assert.equal(parseFriendly(['pair','--bot','tactical','--carriers','on']).carriers,'on');
  assert.throws(()=>parseFriendly(['pair','--carriers','on']));
  assert.deepEqual(parseFriendly(['batch','--seeds','a,b']).seeds,['a','b']);
  assert.throws(()=>parseFriendly(['single','--seeds','a,b']));
  assert.throws(()=>parseFriendly(['pair','--bot','unknown']));
  assert.throws(()=>parseFriendly(['batch','--seeds','a,a']));
});
test('publication preserves every previous replay, even when publishing the current file',()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'friendly-publication-'));
  try{
    const destination=path.join(root,'visualizer/public/replays/replay_latest.json');
    fs.mkdirSync(path.dirname(destination),{recursive:true});
    const replay=n=>JSON.stringify({misc:{name:n},ticks:{'0':{objects:[]}},full_tick_amount:1});
    fs.writeFileSync(destination,replay('previous'));
    const source=path.join(root,'new.json');fs.writeFileSync(source,replay('new'));
    const first=publishReplay(source,root);
    assert.equal(fs.readFileSync(first.backup,'utf8'),replay('previous'));
    assert.equal(fs.readFileSync(destination,'utf8'),replay('new'));
    const second=publishReplay(destination,root);
    assert.notEqual(first.backup,second.backup);
    assert.equal(fs.readFileSync(second.backup,'utf8'),replay('new'));
    fs.writeFileSync(source,'{}');
    assert.throws(()=>publishReplay(source,root),/Not a CORE replay/);
    assert.equal(fs.readFileSync(destination,'utf8'),replay('new'));
  }finally{fs.rmSync(root,{recursive:true,force:true});}
});
test('snapshot seal rejects changed source or executable files',()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'friendly-seal-'));
  try{
    const source=path.join(root,'bot');fs.writeFileSync(source,'frozen');
    fs.writeFileSync(path.join(root,'SHA256SUMS'),`${fileHash(source)}  bot\n`);
    assert.equal(verifySeal(root),1);
    fs.writeFileSync(source,'modified');
    assert.throws(()=>verifySeal(root),/Frozen snapshot changed/);
  }finally{fs.rmSync(root,{recursive:true,force:true});}
});
