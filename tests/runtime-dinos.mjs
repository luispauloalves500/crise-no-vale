// Integration with the real Three r160 loader, WebP decoder and runtime adapter (CPU, not WebGL).
// npm install --no-save three@0.160.0 @napi-rs/canvas
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import * as THREE from 'three';
import {loadImage,Image} from '@napi-rs/canvas';
import {dinoKind,dinoClips} from '../js/dino-animation.mjs';
import {canSpit} from '../js/enemy-capabilities.mjs';
import {ENEMY_TYPES} from '../js/config.js';
globalThis.self=globalThis;globalThis.Image=Image;
globalThis.ProgressEvent=class{constructor(type,init={}){this.type=type;Object.assign(this,init);}};
globalThis.createImageBitmap=async blob=>loadImage(Buffer.from(await blob.arrayBuffer()));
const NativeRequest=globalThis.Request,nativeFetch=globalThis.fetch;let reads=0;
globalThis.Request=class extends NativeRequest{constructor(url,opts){super(new URL(url,'https://local.test/'),opts)}};
globalThis.fetch=async (input,opts)=>{
 const url=typeof input==='string'?input:input.url;
 if(url.startsWith('https://local.test/')){reads++;if(process.argv.includes('--failure'))return new Response('',{status:404});const bytes=await readFile(new URL('../'+new URL(url).pathname.slice(1),import.meta.url));return new Response(bytes,{headers:{'content-length':String(bytes.length)}});}
 return nativeFetch(input,opts);
};
const {attachDino,animateDino,resetDino,disposeDino,preloadDinos,dinoModelStats}=await import('../js/dino-models.js');
const parts=()=>({g:new THREE.Group(),body:{visible:true},shadowMeshes:[],mats:[],em0:[]});
if(process.argv.includes('--failure')){
 for(const cfg of [ENEMY_TYPES.raptor,ENEMY_TYPES.brute,ENEMY_TYPES.spitter]){const a=parts(),b=parts();await attachDino(a,cfg);await attachDino(b,cfg);assert.equal(a.visual,undefined);assert.equal(a.body.visible,true);}
 assert.equal(reads,3);console.log('Fallback OK: um único 404 por espécie; procedural preservado');
}else{
 await preloadDinos();const report=[];
 for(const [type,cfg] of Object.entries(ENEMY_TYPES)){
  const a=parts(),b=parts();await attachDino(a,cfg);await attachDino(b,cfg);assert.ok(a.visual&&b.visual,type);
  const skin=p=>{let m;p.visual.root.traverse(o=>{if(o.isSkinnedMesh)m=o});return m};const am=skin(a),bm=skin(b);
  assert.notEqual(am.skeleton,bm.skeleton);assert.equal(am.geometry,bm.geometry);assert.notEqual(am.material,bm.material);assert.equal(am.material.map,bm.material.map);assert.ok(am.material.map?.image.width>0,'WebP baseColor não carregado');
  const before=bm.skeleton.bones.map(b=>b.quaternion.toArray());
  const states=[['idle',{},0],['walk',{},1],['run',{},cfg.speed],['attack',{bite:1},0],['hurt',{flashT:1},0],['death',{dead:true},0]];
  if(canSpit(cfg))states.splice(4,0,['spit',{spitT:.4,spitAction:{time:.55}},0]);
  for(const [clip,flags,speed] of states){resetDino(a);for(let i=0;i<24;i++)animateDino(a,{cfg,...flags},.05,speed);assert.equal(a.visual.clip,clip);a.g.updateMatrixWorld(true);am.skeleton.update();for(const bone of am.skeleton.bones)assert.ok(bone.matrixWorld.elements.every(Number.isFinite));}
  assert.deepEqual(bm.skeleton.bones.map(b=>b.quaternion.toArray()),before);
  resetDino(a);assert.equal(a.visual.clip,'idle');assert.equal(a.visual.actions.death.isRunning(),false);
  const late=parts();const pending=attachDino(late,cfg);disposeDino(late);await pending;assert.equal(late.visual,undefined);
  disposeDino(a);disposeDino(b);a.mats.forEach(m=>m.dispose());b.mats.forEach(m=>m.dispose());assert.equal(a.visual,null);
  report.push({type,kind:dinoKind(cfg),clips:dinoClips(dinoKind(cfg)).length,independentSkeletons:true,sharedGeometryAndTextures:true});
 }
 assert.equal(reads,3);assert.equal(dinoModelStats.instances,0);assert.equal(THREE.REVISION,'160');
 console.log(JSON.stringify({three:THREE.REVISION,reads,stats:dinoModelStats,report},null,2));
}
