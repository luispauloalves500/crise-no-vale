// GLTFLoader/meshopt/WebP e IA reais em CPU. Mundo/áudio/renderizador stubados, sem WebGL.
// node --experimental-vm-modules tests/runtime-spitter.mjs [--failure]
import assert from 'node:assert/strict';import vm from 'node:vm';import {readFile} from 'node:fs/promises';
import * as THREE from 'three';import {loadImage,Image} from '@napi-rs/canvas';
import * as config from '../js/config.js';import * as dims from '../js/dino-dimensions.mjs';import * as action from '../js/spitter-action.mjs';import * as perception from '../js/perception.mjs';import {difficultyProfile} from '../js/campaign-rules.mjs';
globalThis.self=globalThis;globalThis.Image=Image;globalThis.ProgressEvent=class{constructor(type,init={}){Object.assign(this,init)}};
globalThis.createImageBitmap=async b=>loadImage(Buffer.from(await b.arrayBuffer()));
const NR=globalThis.Request,nativeFetch=globalThis.fetch;let reads=0;
globalThis.Request=class extends NR{constructor(url,opts){super(new URL(url,'https://local.test/'),opts)}};
globalThis.fetch=async(input,opts)=>{const url=typeof input==='string'?input:input.url;if(!url.startsWith('https://local.test/'))return nativeFetch(input,opts);reads++;if(process.argv.includes('--failure'))return new Response('',{status:404});return new Response(await readFile(new URL('../'+new URL(url).pathname.slice(1),import.meta.url)));};
const models=await import('../js/dino-models.js'),{posedBounds}=await import('../js/dino-grounding.js');
const scene=new THREE.Scene(),player={pos:new THREE.Vector3(0,0,11),r:.5,vx:0,vz:0,dead:false},G={time:0,difficulty:'normal',shake:0};let sounds=0,blocked=false,mouthAtFire=null;
const noop=()=>{},fx=new Proxy({},{get:()=>noop}),sfx=new Proxy({spit:()=>sounds++},{get:(t,k)=>t[k]||noop});
const sources={
 'three':THREE,'./dino-dimensions.mjs':dims,'./dino-models.js':{...models,dinoMouth:(...args)=>{const result=models.dinoMouth(...args);mouthAtFire=result?.clone();return result;}},'./spitter-action.mjs':action,
 './config.js':config,'./perception.mjs':perception,'./campaign-rules.mjs':{difficultyProfile},'./state.js':{G},
 './contact-shadows.js':{actorShadow:()=>new THREE.Group()},
 './world.js':{scene,camera:new THREE.PerspectiveCamera(),resolve:()=>false,castWorld:()=>blocked?0:1000,freeSpot:()=>true,bounds:{minX:-30,maxX:30,minZ:-30,maxZ:30},GLOW:new THREE.Texture(),flashAt:noop,onMaterialsReset:noop},
 './player.js':{player,hurtPlayer:noop},'./npc.js':{survivor:{following:false},hurtSurvivor:noop},'./audio.js':{roar:noop,sfx},
 './fx.js':Object.fromEntries(['burst','decal','shockwave','telegraph','laneHandle','setLane','hideLane'].map(k=>[k,fx[k]])),
 './utils.js':{rand:(a,b)=>(a+b)/2,lerpAngle:(a,b,t)=>a+Math.atan2(Math.sin(b-a),Math.cos(b-a))*t,noiseTex:()=>{const t=new THREE.Texture();t.userData.bump=new THREE.Texture();return t;}},'./lod.js':{lodLevel:()=>0}
};
const context=vm.createContext({console,Math}),mod=new vm.SourceTextModule(await readFile(new URL('../js/enemies.js',import.meta.url),'utf8'),{context});
await mod.link(async spec=>{const values=sources[spec];assert.ok(values,spec);return new vm.SyntheticModule(Object.keys(values),function(){for(const [k,v]of Object.entries(values))this.setExport(k,v)},{context});});await mod.evaluate();const api=mod.namespace;
const spawn=async()=>{api.clearEnemies();blocked=false;player.dead=false;player.pos.set(0,0,11);const e=api.spawnEnemy('spitter',0,0);await new Promise(r=>setImmediate(r));e.special=0;return e;};
const tick=dt=>{G.time+=dt;api.updateEnemies(dt);};
await models.preloadDinos();
const e=await spawn();const fallback=process.argv.includes('--failure');
let springDeflection=0,openingDisplacement=0;
if(fallback)assert.equal(e.parts.visual,undefined);else{
 const v=e.parts.visual;assert.ok(v);let mesh;v.root.traverse(o=>{if(o.isSkinnedMesh)mesh=o});assert.ok(mesh.material.map?.image.width===1024,'WebP não decodificado');assert.ok(mesh.material.normalMap?.image.width===1024);assert.equal(mesh.skeleton.bones.length,97);
 const index=mesh.skeleton.bones.findIndex(b=>b.name==='Frill_R'),skin=mesh.geometry.attributes.skinIndex,weights=mesh.geometry.attributes.skinWeight;let vertex=-1;
 for(let i=0;i<skin.count&&vertex<0;i++)for(let k=0;k<4;k++)if(skin.getComponent(i,k)===index&&weights.getComponent(i,k)>.5){vertex=i;break;}
 assert.ok(vertex>=0,'gola não tem vértices ponderados');
 const pose=(name,time)=>{v.mixer.stopAllAction();const a=v.actions[name].reset().stopFading().setEffectiveWeight(1).play();a.time=time;v.mixer.update(0);v.ground();v.root.updateMatrixWorld(true);return mesh.getVertexPosition(vertex,new THREE.Vector3()).applyMatrix4(mesh.matrixWorld);};
 const idle=pose('idle',.4),open=pose('spit',.52);openingDisplacement=idle.distanceTo(open);assert.ok(openingDisplacement>.05,'gola não abre de fato');
 pose('idle',.4);const frillSamples=[];
 for(let i=0;i<skin.count;i++)if([0,1,2,3].some(k=>mesh.skeleton.bones[skin.getComponent(i,k)]?.name.startsWith('Frill_')&&weights.getComponent(i,k)>.2))frillSamples.push([i,mesh.getVertexPosition(i,new THREE.Vector3()).applyMatrix4(mesh.matrixWorld)]);
 v.frill.reset();v.frill.update({yaw:0},1/60,0);v.mixer.update(0);v.frill.update({yaw:1},.1,8);v.ground();v.root.updateMatrixWorld(true);
 const secondaryMax=Math.max(...frillSamples.map(([i,p])=>p.distanceTo(mesh.getVertexPosition(i,new THREE.Vector3()).applyMatrix4(mesh.matrixWorld))));springDeflection=secondaryMax;assert.ok(secondaryMax>.005,'inércia não deforma a gola: '+secondaryMax);
 models.resetDino(e.parts);const base=models.dinoMouth(e.parts).clone();
 for(const angle of [0,Math.PI/2,Math.PI,2.3]){e.g.rotation.y=angle;e.g.position.set(14,2,-9);e.g.scale.setScalar(2.1);v.ground();const m=models.dinoMouth(e.parts),expected=new THREE.Vector3(base.x*2,2+(base.y-.012)*2+.012,base.z*2).applyAxisAngle(new THREE.Vector3(0,1,0),angle);expected.x+=14;expected.z-=9;assert.ok(m.distanceTo(expected)<1e-5,'socket perde escala/yaw/piso');}
 e.g.position.set(0,0,0);e.g.rotation.y=0;e.g.scale.setScalar(e.cfg.scale);models.resetDino(e.parts);
 const floorRange=[];for(let i=0;i<360;i++){models.animateDino(e.parts,{cfg:e.cfg,yaw:Math.sin(i/15)},1/60,(Math.sin(i/17)+1)*3);const min=posedBounds(v.root).min.y;assert.ok(min>=0&&min<.025,'gola/apoio secundários');assert.ok(posedBounds(v.root).getSize(new THREE.Vector3()).x<e.cfg.r*2,'gola excede envelope lateral');floorRange.push(min);}
 models.resetDino(e.parts);assert.equal(v.frill.state.value,0);assert.equal(v.frill.state.velocity,0);
}
// Executa a IA de verdade: evento único e pose/mundo já atualizados na emissão.
let before=0;for(let i=0;i<100&&sounds===before;i++){tick(1/60);}
assert.equal(sounds,1);assert.equal(api.spits.length,1);const shot=api.spits[0];
assert.ok(Math.abs(shot.x-shot.vx/60-mouthAtFire.x)<1e-6);assert.ok(Math.abs(shot.y-shot.vy/60-mouthAtFire.y)<1e-6);assert.ok(Math.abs(shot.z-shot.vz/60-mouthAtFire.z)<1e-6);
if(!fallback){assert.equal(e.parts.visual.clip,'spit');assert.ok(Math.abs(e.parts.visual.actions.spit.time-action.SPIT_RELEASE)<1e-6);assert.ok(mouthAtFire.y>1&&mouthAtFire.y<2.7);}
for(let i=0;i<60;i++)tick(1/60);assert.equal(sounds,1,'disparo duplicado na recuperação');
for(const cancel of ['hurt','stun','death','cinematic','occlusion','player-death']){
 const a=await spawn();const initial=sounds;for(let i=0;i<12;i++)tick(1/60);assert.ok(a.spitAction?.time>0);
 if(cancel==='hurt'){a.hp--;a.flashT=.1;}if(cancel==='stun')a.stun=.5;if(cancel==='death')a.dead=true;if(cancel==='player-death')player.dead=true;
 if(cancel==='cinematic')api.animateCinematicEnemies(1/60);if(cancel==='occlusion')blocked=true;
 for(let i=0;i<75;i++)tick(1/60);assert.equal(sounds,initial,cancel+' disparou após interrupção');
}
api.clearEnemies();console.log(JSON.stringify({three:THREE.REVISION,fallback,reads,aiMarkerSeconds:action.SPIT_RELEASE,mouthWorldVerified:true,clipGrounding:!fallback,realFrillSkinDeformation:!fallback,springDeflectionMetres:springDeflection,openingDisplacementMetres:openingDisplacement,secondaryGroundingFrames:fallback?0:360,interruptionCases:6,webGL:false},null,2));
