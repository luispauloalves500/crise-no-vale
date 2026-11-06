// Validação CPU real: Three r160/GLTFLoader/Meshopt/WebP, sem navegador/WebGL.
// npm install --no-save three@0.160.0 @napi-rs/canvas
// node --experimental-vm-modules tests/runtime-grass.mjs [--failure]
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {Image,loadImage} from '@napi-rs/canvas';
import {readFileSync} from 'node:fs';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve,dirname} from 'node:path';
import vm from 'node:vm';
import {grassAllowed,grassBudget} from '../js/grass-policy.mjs';
const root=fileURLToPath(new URL('../',import.meta.url)),failure=process.argv.includes('--failure');
globalThis.self=globalThis;globalThis.Image=Image;globalThis.ProgressEvent=class{constructor(type,init={}){Object.assign(this,init)}};
globalThis.createImageBitmap=async b=>loadImage(Buffer.from(await b.arrayBuffer()));
const NativeRequest=globalThis.Request,nativeFetch=globalThis.fetch;let reads=0;
globalThis.Request=class extends NativeRequest{constructor(url,opts){super(new URL(url,'https://local.test/'),opts)}};
globalThis.fetch=async(input,opts)=>{const u=typeof input==='string'?input:input.url;if(u.startsWith('https://local.test/')){reads++;if(failure)return new Response('',{status:404});const bytes=await readFile(resolve(root,new URL(u).pathname.slice(1)));return new Response(bytes,{headers:{'content-length':String(bytes.length)}})}return nativeFetch(input,opts)};
const noop=()=>{},grad={addColorStop:noop};
const draw=new Proxy({getImageData:(x,y,w,h)=>({data:new Uint8ClampedArray(w*h*4)}),createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),createLinearGradient:()=>grad,createRadialGradient:()=>grad,measureText:s=>({width:s.length*10})},{get:(t,k)=>t[k]||noop,set:(t,k,v)=>(t[k]=v,true)});
const doc={body:{prepend:noop},createElement:()=>({width:64,height:64,getContext:k=>k==='2d'?draw:null}),getElementById:()=>({style:{},classList:{add:noop,remove:noop}})};
class Renderer{constructor(){this.info={};this.shadowMap={};this.domElement={}}setPixelRatio(){}setSize(){}}
class TextureLoader{load(){return new THREE.Texture()}}
const context=vm.createContext({console,document:doc,window:{devicePixelRatio:1},innerWidth:800,innerHeight:600,addEventListener:noop,performance,URL,localStorage:{getItem:()=> 'baixo',setItem:noop},navigator:{},setTimeout,clearTimeout});
const modules=new Map(),three=new vm.SyntheticModule(Object.keys(THREE),function(){for(const k of Object.keys(THREE))this.setExport(k,k==='WebGLRenderer'?Renderer:k==='TextureLoader'?TextureLoader:THREE[k])},{context});
async function get(path){if(modules.has(path))return modules.get(path);const m=new vm.SourceTextModule(readFileSync(path,'utf8'),{context,identifier:path,initializeImportMeta:x=>x.url='file://'+path});modules.set(path,m);return m}
const main=await get(resolve(root,'js/areas.js'));await main.link((s,r)=>s==='three'?three:get(resolve(dirname(r.identifier),s)));await main.evaluate();
const {AREAS,buildArea,unloadArea}=main.namespace;
const grass=modules.get(resolve(root,'js/grass.js')).namespace;
for(const a of AREAS)buildArea(a);
assert.equal(grass.grassStats().fields,6);
const port=AREAS.find(a=>a.id==='porto'),camp=AREAS.find(a=>a.id==='acampamento');
const oldChunk=port.ctx.grassField.chunks[0];let oldDisposed=0,sharedDisposed=0;
oldChunk.near.addEventListener('dispose',()=>oldDisposed++);oldChunk.near.geometry.addEventListener('dispose',()=>sharedDisposed++);
const {loadModel}=await import('../js/model-assets.js');
let release;const wait=new Promise(r=>release=r);
const pending=grass.preloadGrass(async()=>{await wait;return loadModel('./assets/models/grass-patch.glb')});
// Um carregamento atrasado nunca ressuscita área descarregada.
const oldCamp=camp.ctx.grassField;unloadArea(camp);assert.equal(oldCamp.disposed,true);release();
const loaded=await pending;assert.equal(loaded,!failure);await grass.preloadGrass();assert.equal(reads,1);assert.equal(camp.ctx,null);assert.equal(grass.grassStats().fields,5);
assert.equal(oldDisposed,failure?0:1);assert.equal(sharedDisposed,0);
buildArea(camp);assert.equal(grass.grassStats().fields,6);
const camera=new THREE.PerspectiveCamera(60,16/9,.1,150),report=[];
for(const a of AREAS){
 const f=a.ctx.grassField;if(!f){report.push({area:a.id,patches:0,maxTriangles:0});continue;}
 for(const p of f.points)assert.ok(grassAllowed(p,a.bounds,f.masks),a.id+':mask');
 for(const c of f.chunks)for(const key of ['near','far']){
   const m=c[key];assert.equal(m.castShadow,false);assert.equal(m.receiveShadow,false);assert.equal(m.matrixAutoUpdate,false);assert.equal(m.frustumCulled,true);assert.ok(m.boundingSphere.radius>0);assert.ok(grass.isGrassResource(m.geometry));assert.ok(grass.isGrassResource(m.material));
   for(let i=0;i<c.points.length;i++){const mat=new THREE.Matrix4();m.getMatrixAt(i,mat);assert.ok(mat.elements.every(Number.isFinite));assert.ok(Math.abs(mat.elements[13]-.015)<1e-6);}
 }
 const totals={};
 for(const [preset,difficulty] of [[{id:'baixo',grass:.55},'easy'],[{id:'medio',grass:.8},'normal'],[{id:'alto',grass:1},'normal']]){
  let maxTriangles=0,maxFrustumTriangles=0,maxDraws=0,maxNear=0,maxFar=0;
  const budget=grassBudget(preset,difficulty,1,a.id);
  for(let ix=0;ix<7;ix++)for(let iz=0;iz<7;iz++){
   camera.position.set(a.bounds.minX+2+(a.bounds.maxX-a.bounds.minX-4)*ix/6,4,a.bounds.minZ+2+(a.bounds.maxZ-a.bounds.minZ-4)*iz/6);
   grass.updateGrass(0,a.ctx,camera,preset,difficulty,1,true);const s=grass.grassStats(a.ctx);
   assert.ok(s.near<=budget.near&&s.far<=budget.far);maxTriangles=Math.max(maxTriangles,s.triangles);maxDraws=Math.max(maxDraws,s.draws);maxNear=Math.max(maxNear,s.near);maxFar=Math.max(maxFar,s.far);
   a.ctx.group.updateMatrixWorld(true);
   for(let i=0;i<8;i++){
    const angle=i*Math.PI/4;camera.lookAt(camera.position.x+Math.sin(angle)*12,1.4,camera.position.z+Math.cos(angle)*12);camera.updateMatrixWorld(true);
    const frustum=new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));let tris=0;
    for(const c of f.chunks)for(const key of ['near','far']){const m=c[key];if(m.visible&&frustum.intersectsObject(m))tris+=m.count*(m.geometry.index?.count||m.geometry.attributes.position.count)/3;}
    maxFrustumTriangles=Math.max(maxFrustumTriangles,tris);
   }
  }
  totals[preset.id+'_'+difficulty]={maxTriangles,maxFrustumTriangles,maxDraws,maxNear,maxFar};
 }
 grass.updateGrass(0,a.ctx,camera,{id:'alto',grass:1},'normal',0,true);assert.equal(grass.grassStats(a.ctx).triangles,0);
 report.push({area:a.id,patches:f.points.length,chunks:f.chunks.length,totals});
}
const near=port.ctx.grassField.chunks[0].near,far=port.ctx.grassField.chunks[0].far;
if(!failure){assert.equal(grass.grassStats(port.ctx).nearTriangles,511);assert.equal(near.material.map.image.width,512);assert.equal(near.material.map.image.height,512);assert.ok(near.geometry.boundingBox.min.x<0);assert.ok(near.geometry.boundingBox.min.y>=-.001);}
assert.equal(grass.grassStats(port.ctx).farTriangles,12);
const shader=()=>({uniforms:{},vertexShader:'#include <begin_vertex>'}),a=shader(),b=shader();near.material.onBeforeCompile(a);far.material.onBeforeCompile(b);
assert.equal(a.uniforms.uGrassTime,b.uniforms.uGrassTime);assert.equal(a.uniforms.uGrassStrength,b.uniforms.uGrassStrength);assert.ok(a.vertexShader.includes('instanceMatrix[3]'));assert.ok(a.vertexShader.includes('clamp(position.y / 0.42'));
const t=a.uniforms.uGrassTime.value;grass.atualizarVento(.05);assert.ok(a.uniforms.uGrassTime.value>t);grass.atualizarVento(.05,true);assert.equal(a.uniforms.uGrassStrength.value,.013);
const geometry=near.geometry,material=near.material;let gd=0,md=0;geometry.addEventListener('dispose',()=>gd++);material.addEventListener('dispose',()=>md++);
unloadArea(port);assert.equal(gd,0);assert.equal(md,0);buildArea(port);assert.equal(port.ctx.grassField.chunks[0].near.geometry,geometry);assert.equal(port.ctx.grassField.chunks[0].near.material,material);
console.log(JSON.stringify({three:THREE.REVISION,loaded,fetches:reads,webGL:false,shaderCompiled:false,placementMasks:true,streaming:true,sharedResources:true,report},null,2));
