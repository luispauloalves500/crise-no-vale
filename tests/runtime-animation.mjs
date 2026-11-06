// Auditoria opcional: THREE_ROOT deve apontar para o pacote three@0.160.0. Sem render/visual.
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)), '..');
const threeRoot=resolve(process.env.THREE_ROOT || '/tmp/crise-test-deps/node_modules/three');
const THREE=await import(pathToFileURL(resolve(threeRoot,'build/three.module.js')));
const {GLTFLoader}=await import(pathToFileURL(resolve(threeRoot,'examples/jsm/loaders/GLTFLoader.js')));
const {MeshoptDecoder}=await import(pathToFileURL(resolve(threeRoot,'examples/jsm/libs/meshopt_decoder.module.js')));
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {retargetCombatClip} from '../js/animation-retarget.mjs';
async function rig(file) {
 let b=readFileSync(file);if(file.endsWith('.b64'))b=Buffer.from(b.toString().replace(/\s/g,''),'base64');
 const n=b.readUInt32LE(12),j=JSON.parse(b.subarray(20,20+n));
 for(const node of j.nodes){delete node.mesh;delete node.skin;}
 delete j.meshes;delete j.materials;delete j.images;delete j.textures;
 const bin=b.subarray(20+n+8);let json=Buffer.from(JSON.stringify(j));json=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,32)]);
 const out=Buffer.alloc(12+8+json.length+8+bin.length);out.writeUInt32LE(0x46546c67);out.writeUInt32LE(2,4);out.writeUInt32LE(out.length,8);out.writeUInt32LE(json.length,12);out.writeUInt32LE(0x4e4f534a,16);json.copy(out,20);out.writeUInt32LE(bin.length,20+json.length);out.writeUInt32LE(0x004e4942,24+json.length);bin.copy(out,28+json.length);
 const loader=new GLTFLoader();loader.setMeshoptDecoder(MeshoptDecoder);return new Promise((res,rej)=>loader.parse(out.buffer.slice(out.byteOffset,out.byteOffset+out.length),'',res,rej));
}
assert.equal(THREE.REVISION,'160');
const marina=await rig(resolve(root,'assets/marina.min.glb.b64')), jill=await rig(resolve(root,'assets/personagens/jill.glb'));
const pose=g=>{const m=new Map();g.scene.traverse(o=>{if(o.isBone)m.set(o.name,o.quaternion.toArray())});return m;};
const sourcePose=pose(marina),targetPose=pose(jill);assert.ok(targetPose.size>40);
const combat=marina.animations.filter(c=>/Weapon_Idle|Aim_|Reload_|Fire_/.test(c.name)).map(c=>retargetCombatClip(c,sourcePose,targetPose));
const upper=/Spine1|Spine2|Neck|Head|Shoulder|Arm|ForeArm|Hand/;
let samples=0, maxNormError=0;
for(const name of ['marina','jill']) {
 const model=name==='marina'?marina:jill,cl= name==='marina'?marina.animations:[...jill.animations,...combat];
 const idle=cl.find(c=>c.name==='Weapon_Idle');assert.ok(idle);
 const split=(clip,up)=>{const c=clip.clone();c.name+=up?'_up':'_low';c.tracks=c.tracks.filter(t=>upper.test(t.name)===up);return c;};
 for(const reload of ['Reload_Revolver','Reload_Shotgun','Reload_SMG_REV4']) {
  const mixer=new THREE.AnimationMixer(model.scene),actions={};
  for(const [k,c] of Object.entries({idleLeg:split(idle,false),idleUp:split(idle,true),walk:split(cl.find(c=>c.name==='Walking_Woman'),false),run:split(cl.find(c=>c.name==='Running'),false),aim:split(cl.find(c=>c.name==='Aim_Pistol'),true),reload:split(cl.find(c=>c.name===reload),true)})) actions[k]=mixer.clipAction(c).play().setEffectiveWeight(0);
  for(let i=0;i<=240;i++) {
   const p=i/240,L=Math.sin(Math.PI*p)**2,run=Math.max(0,(p-.25)/.5),rel=p>.45&&p<.75?.9:0,aim=rel?0:.6;
   actions.idleLeg.weight=1-L;actions.walk.weight=L*(1-Math.min(1,run));actions.run.weight=L*Math.min(1,run);
   actions.idleUp.weight=(1-rel)*(1-aim);actions.aim.weight=(1-rel)*aim;actions.reload.weight=rel;mixer.update(1/60);
   model.scene.traverse(o=>{if(o.isBone){const q=o.quaternion.toArray();assert.ok(q.every(Number.isFinite));const err=Math.abs(Math.hypot(...q)-1);maxNormError=Math.max(maxNormError,err);assert.ok(err<1e-5);}});samples++;
  }
  mixer.stopAllAction();mixer.uncacheRoot(model.scene);
 }
}
console.log(JSON.stringify({three:THREE.REVISION,combatClipsRetargeted:combat.length,samples,maxNormError,texturesAndMeshes:false},null,2));
