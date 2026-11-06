// Integration with the real Three r160 loader, WebP decoder and runtime adapter (CPU, not WebGL).
// npm install --no-save three@0.160.0 @napi-rs/canvas
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import * as THREE from 'three';
import {loadImage,Image} from '@napi-rs/canvas';
import {dinoClips,dinoKind} from '../js/dino-animation.mjs';
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
const {attachDino,resetDino,animateDino,disposeDino}=await import('../js/dino-models.js');
const {posedBounds}=await import('../js/dino-grounding.js');
const {dinoDimensions,dinoBarY,dinoImpactY}=await import('../js/dino-dimensions.mjs');
const {sceneScript}=await import('../js/cutscene-timeline.mjs');
const report=[];let samples=0,framingChecks=0;
for(const [type,cfg] of Object.entries(ENEMY_TYPES)) {
 const p={g:new THREE.Group(),body:new THREE.Group(),shadowMeshes:[],mats:[],em0:[]};p.g.scale.setScalar(cfg.scale);await attachDino(p,cfg);const v=p.visual;assert.ok(v,type);
 v.actions.idle.time=.4;v.mixer.update(0);v.ground();const b=posedBounds(v.root),size=b.getSize(new THREE.Vector3()),expected=dinoDimensions(cfg);
 for(const [actual,target]of [[size.x,expected.width],[size.y,expected.height],[size.z,expected.length],[b.min.z,expected.minZ],[b.max.z,expected.maxZ]])assert.ok(Math.abs(actual-target)<1e-4,`${type} dimensão ${actual} / ${target}`);
 assert.ok(dinoBarY(cfg)>b.max.y);assert.ok(dinoImpactY(cfg)>b.min.y&&dinoImpactY(cfg)<b.max.y);assert.ok(v.contacts<512,'contatos demais por frame');
 let minY=Infinity,maxY=-Infinity;
 const check=()=>{const box=posedBounds(v.root);assert.ok(box.min.y>=-.0001,`${type}: afundou ${box.min.y}`);assert.ok(box.min.y<.025,`${type}: flutuou ${box.min.y}`);minY=Math.min(minY,box.min.y);maxY=Math.max(maxY,box.min.y);samples++};
 for(const clip of dinoClips(dinoKind(cfg))) {
  resetDino(p);v.mixer.stopAllAction();const action=v.actions[clip].reset().stopFading().setEffectiveWeight(1).play();
  for(let i=0;i<=60;i++){action.time=action.getClip().duration*i/60;v.mixer.update(0);v.ground();check();}
 }
 resetDino(p);
 for(const [flags,speed]of [[{},0],[{},cfg.speed*.4],[{},cfg.speed],[{bite:1},0],[{flashT:1},0],[{},cfg.speed],[{dead:true},0]])for(let i=0;i<30;i++){animateDino(p,{cfg,...flags},1/60,speed);check();}
 if(canSpit(cfg))for(let i=0;i<=120;i++){animateDino(p,{cfg,spitT:.95-i/120*.95,spitRelease:i===120,spitAction:{time:i/120*.95}},1/120,Math.sin(i/15)*2+2);check();}
 for(let i=0;i<20;i++){resetDino(p);v.actions.idle.time=.4;v.mixer.update(0);v.ground();assert.ok(Math.abs(posedBounds(v.root).getSize(new THREE.Vector3()).y-expected.height)<1e-4,'pool encolheu');}
 if(type==='origin')for(const key of sceneScript('tyrant',{x:0,z:-10}).keys)for(let angle=0;angle<8;angle++) {
  const camera=new THREE.PerspectiveCamera(key.fov,16/9,.1,150);camera.position.fromArray(key.pos);camera.lookAt(...key.look);camera.updateMatrixWorld(true);
  for(const x of [-expected.width/2,expected.width/2])for(const y of [.012,expected.height+.012])for(const z of [expected.minZ,expected.maxZ]) {
   const point=new THREE.Vector3(x,y,z).applyAxisAngle(new THREE.Vector3(0,1,0),angle*Math.PI/4).add(new THREE.Vector3(0,0,-10)).project(camera);
   assert.ok(Math.abs(point.x)<.85&&point.y>-.58&&point.y<.72,'Tirano fora do quadro útil do letterbox');framingChecks++;
  }
 }
 p.g.position.set(14,2,-9);p.g.rotation.y=1.2;animateDino(p,{cfg},.016,0);assert.ok(posedBounds(v.root).min.y>=2,'apoio deve ser relativo ao piso da instância');
 report.push({type,width:size.x,height:size.y,length:size.z,navigationRadius:cfg.r,contactSamples:v.contacts,minimumY:[minY,maxY],resets:20});disposeDino(p);
}
console.log(JSON.stringify({three:THREE.REVISION,samples,framingChecks,webGL:false,measuredSkinnedVertices:true,report},null,2));
