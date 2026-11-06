import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {retargetHeroClip,heroAnimationSet} from '../js/hero-animation.mjs';
function track(name,values){return{name,times:new Float32Array([0,1]),values:new Float32Array(values),clone(){return track(this.name,Array.from(this.values))}}}
function clip(name,tracks){return{name,duration:1,tracks,clone(){return clip(this.name,this.tracks.map(t=>t.clone()))}}}
const p=(q=[0,0,0,1],x=0,y=1)=>({q,p:[x,y,0]});
const source=new Map([['mixamorig:Hips',p()],['mixamorig:LeftLeg',p(undefined,0,-1)],['mixamorig:LeftFoot',p(undefined,0,-1)],['mixamorig:LeftArm',p()]]);
const target=new Map([['mixamorigHips',p(undefined,0,2)],['mixamorigLeftLeg',p(undefined,0,-2)],['mixamorigLeftFoot',p(undefined,0,-2)],['mixamorigLeftArm',p([0,0,Math.SQRT1_2,Math.SQRT1_2])]]);
const model=pose=>({traverse(fn){for(const [name,v]of pose)fn({isBone:true,name,quaternion:{toArray:()=>v.q.slice()},position:{toArray:()=>v.p.slice()}})}});
test('retarget de Jill adapta nomes/repouso e escala bob do quadril, sem deslocamento XZ',()=>{
 const c=clip('Running',[track('mixamorig:Hips.position',[0,1,0,3,1.1,4]),track('mixamorig:LeftArm.quaternion',[0,0,0,1,0,0,0,1])]);
 const out=retargetHeroClip(c,source,target),hip=out.tracks.find(t=>t.name==='mixamorigHips.position');
 assert.deepEqual(Array.from(hip.values).filter((_,i)=>i%3!==1),[0,0,0,0]);assert.ok(Math.abs(hip.values[4]-2.2)<1e-6);
 assert.ok(out.tracks.some(t=>t.name==='mixamorigLeftArm.quaternion'));assert.deepEqual(Array.from(c.tracks[0].values),[0,1,0,3,Math.fround(1.1),4]);
});
test('Marina/Regina e Jill recebem os mesmos nomes/durações de clipes canônicos',()=>{
 const base={scene:model(target),animations:[clip('Weapon_Idle',[track('mixamorigLeftArm.quaternion',[0,0,0,1,0,0,0,1])]),clip('Running',[])]};
 const jill={scene:model(source),animations:[clip('Walking_Woman',[]),clip('Running',[])]};
 const a=heroAnimationSet(base,jill,base.scene),b=heroAnimationSet(base,jill,jill.scene);
 assert.equal(a.source,'jill');assert.equal(a.pipeline,b.pipeline);assert.deepEqual(a.clips.map(c=>[c.name,c.duration]),b.clips.map(c=>[c.name,c.duration]));assert.ok(a.clips.some(c=>c.name==='Weapon_Idle'));
});
test('IK e recarga não estão mais restritas à escolha Jill; não há patch assíncrono só de caminhada',()=>{
 const s=readFileSync(new URL('../js/player.js',import.meta.url),'utf8');assert.match(s,/hero.armRig = createHeroArmRig\(THREE, model, pg, socket\)/);
 assert.doesNotMatch(s,/hero.armRig = choice === 'jill'/);assert.doesNotMatch(s,/installJillWalk/);assert.match(s,/heroAnimationSet\(defaultHeroGLTF,jillReference,model\)/);
});
