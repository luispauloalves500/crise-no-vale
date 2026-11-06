// Uma biblioteca canônica (Jill) e o MESMO retarget/camadas/IK para as duas aparências.
import {retargetCombatClip} from './animation-retarget.mjs';
const poses=new WeakMap(),libraries=new WeakMap();
const key=n=>n.replace(/^mixamorig:?/,'');
export function captureHeroPose(model) {
  if(!poses.has(model)) {
    const pose=new Map();model.traverse(b=>{if(b.isBone)pose.set(b.name,{q:b.quaternion.toArray(),p:b.position.toArray()});});poses.set(model,pose);
  }
  return poses.get(model);
}
const quats=pose=>new Map([...pose].map(([n,p])=>[n,p.q]));
function legLength(pose) {
  const byName=new Map([...pose].map(([n,p])=>[key(n),p]));
  return ['LeftLeg','LeftFoot'].reduce((n,k)=>n+Math.hypot(...(byName.get(k)?.p||[0,0,0])),0)||1;
}
export function retargetHeroClip(source,sourcePose,targetPose) {
  const clip=retargetCombatClip(source,quats(sourcePose),quats(targetPose));
  const target=new Map([...targetPose].map(([n,p])=>[key(n),{name:n,...p}])),from=new Map([...sourcePose].map(([n,p])=>[key(n),p]));
  const ratio=legLength(targetPose)/legLength(sourcePose);
  // Apenas o bob vertical do quadril, proporcional ao rig. Sem copiar comprimentos nem root motion XZ.
  for(const track of source.tracks)if(track.name.endsWith('.position')) {
    const name=key(track.name.slice(0,-9)),s=from.get(name),t=target.get(name);
    if(name!=='Hips'||!s||!t||track.values.length!==track.times.length*3)continue;
    const copy=track.clone();copy.name=t.name+'.position';
    for(let i=0;i<copy.values.length;i+=3)copy.values.set([t.p[0],t.p[1]+(track.values[i+1]-s.p[1])*ratio,t.p[2]],i);
    clip.tracks.push(copy);
  }
  return clip;
}
export function heroAnimationSet(marina,jill,target) {
  const basePose=captureHeroPose(marina.scene),targetPose=captureHeroPose(target);
  if(!jill)return {clips:marina.animations.map(c=>retargetHeroClip(c,basePose,targetPose)),source:'marina-fallback',pipeline:'shared-hero-v2'};
  const sourcePose=captureHeroPose(jill.scene);
  if(!libraries.has(jill.scene)) {
    const names=new Set(jill.animations.map(c=>c.name));
    libraries.set(jill.scene,[...jill.animations.map(c=>c.clone()),...marina.animations.filter(c=>!names.has(c.name)).map(c=>retargetCombatClip(c,quats(basePose),quats(sourcePose)))]);
  }
  return {clips:libraries.get(jill.scene).map(c=>retargetHeroClip(c,sourcePose,targetPose)),source:'jill',pipeline:'shared-hero-v2'};
}
