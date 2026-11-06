import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import { dinoClips, dinoKind, dinoMotion } from '../js/dino-animation.mjs';
for(const kind of ['raptor','trex','cuspidor'])test(`${kind}.glb: arquivo otimizado autocontido, skin e animações necessárias`,()=>{
  const raw=readFileSync(new URL(`../assets/models/${kind}.glb`,import.meta.url));
  assert.equal(raw.readUInt32LE(0),0x46546c67);assert.equal(raw.readUInt32LE(4),2);assert.equal(raw.readUInt32LE(8),raw.length);assert.ok(raw.length<(kind==='cuspidor'?1.3:1)*1024*1024);
  const json=JSON.parse(raw.subarray(20,20+raw.readUInt32LE(12)).toString());
  assert.deepEqual(json.animations.map(a=>a.name).sort(),[...dinoClips(kind)].sort());assert.equal(json.skins.length,1);
  assert.ok(json.extensionsRequired.includes('EXT_meshopt_compression'));assert.ok(json.images.every(i=>i.bufferView!==undefined));
  assert.ok(json.animations.every(a=>a.channels.length>10&&a.channels.every(c=>json.nodes[c.target.node])));
});
test('política visual: raptor comum, cuspidor dedicado; T-rex bruto e todos os chefes',()=>{
  assert.equal(dinoKind({shape:'raptor'}),'raptor');assert.equal(dinoKind({shape:'spitter'}),'cuspidor');
  assert.equal(dinoKind({shape:'brute'}),'trex');assert.equal(dinoKind({boss:true}),'trex');
});
test('IA dirige clipes por deslocamento real e prioridade morte > dano > ataque > locomoção',()=>{
  const e={cfg:{speed:5,scale:1}};
  assert.equal(dinoMotion(e).clip,'idle');assert.equal(dinoMotion(e,1).clip,'walk');assert.equal(dinoMotion(e,5).clip,'run');
  e.bite=.2;assert.equal(dinoMotion(e,5).clip,'attack');e.flashT=.1;assert.equal(dinoMotion(e).clip,'hurt');e.dead=true;assert.equal(dinoMotion(e).clip,'death');
  for(const speed of [0,.1,1,5,25])assert.ok(Number.isFinite(dinoMotion({cfg:e.cfg},speed).rate));
});
