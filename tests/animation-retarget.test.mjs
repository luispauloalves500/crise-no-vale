import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {retargetQuaternion,retargetValues,adaptWalkClip} from '../js/animation-retarget.mjs';
import {GUN_ASSETS,GUN_SCALE} from '../js/gun-layout.mjs';
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`);
function jsonGLB(bytes) { const len=bytes.readUInt32LE(12); return JSON.parse(bytes.subarray(20,20+len)); }
test('retarget preserva a pose de repouso da personagem de destino',()=>{
  const s=[0,Math.sin(0.2),0,Math.cos(0.2)],t=[Math.sin(0.35),0,0,Math.cos(0.35)];
  retargetQuaternion(s,t,s).forEach((v,i)=>close(v,t[i]));
});
test('retarget conserva rotação normalizada e rejeita dados incompletos',()=>{
  const q=retargetValues(new Float32Array([0,0,0,1,0,0.70710678,0,0.70710678]),[0,0,0,1],[0,0,0,1]);
  close(q[3],1);close(q[5],Math.SQRT1_2);close(q[7],Math.SQRT1_2);
  assert.throws(()=>retargetValues(new Float32Array([0,0,0]),[0,0,0,1],[0,0,0,1]));
});
test('GLBs reais têm animação feminina e ossos essenciais compartilhados',()=>{
  const a=jsonGLB(Buffer.from(readFileSync(new URL('../assets/marina.min.glb.b64',import.meta.url),'utf8').replace(/\s/g,''),'base64'));
  const b=jsonGLB(readFileSync(new URL('../assets/personagens/jill.glb',import.meta.url)));
  const walk=x=>x.animations.find(c=>c.name==='Walking_Woman');
  assert.ok(walk(a));assert.ok(walk(b));
  const names=x=>new Set(walk(x).channels.filter(c=>c.target.path==='rotation').map(c=>x.nodes[c.target.node].name));
  const na=names(a),nb=names(b);
  for(const name of ['mixamorig:Hips','mixamorig:LeftUpLeg','mixamorig:RightUpLeg','mixamorig:LeftLeg','mixamorig:RightLeg','mixamorig:LeftFoot','mixamorig:RightFoot']) {assert.ok(na.has(name),name);assert.ok(nb.has(name),name);}
});
test('escopeta corrigida tem comprimento proporcional e clarão na ponta',()=>{
  const sg=GUN_ASSETS[1];close(sg.length*GUN_SCALE,0.869);
  close(sg.tip,sg.pos[2]+sg.length/2);
  assert.ok(sg.length*GUN_SCALE>GUN_ASSETS[0].length*GUN_SCALE*3);
});

test('clipe adaptado mantém translação do destino e rejeita rig incompatível',()=>{
  const track=(name,values,times=[0,1])=>({name,values:new Float32Array(values),times:new Float32Array(times),clone(){return track(this.name,this.values,this.times);}});
  const q=[0,0,0,1,0,0,0,1];
  const names=['mixamorigHips','mixamorigLeftUpLeg','mixamorigRightUpLeg'];
  const clip=(tracks,duration)=>({name:'walk',tracks,duration,clone(){return clip(this.tracks.map(t=>t.clone()),this.duration);}});
  const base=clip([...names.map(n=>track(n+'.quaternion',q)),track('mixamorigHips.position',[0,1,0,0,1.1,0])],1);
  const source=clip(names.map(n=>track(n+'.quaternion',q,[0,2])),2);
  const poses=new Map(names.map(n=>[n,[0,0,0,1]]));
  const result=adaptWalkClip(base,source,poses,poses);
  assert.equal(result.duration,2);
  const pos=result.tracks.find(t=>t.name.endsWith('.position'));
  assert.equal(pos.times[1],2); assert.ok(Math.abs(pos.values[4]-1.1)<1e-6);
  assert.equal(base.tracks.at(-1).times[1],1);
  assert.equal(adaptWalkClip(base,source,new Map(),poses),null);
});
