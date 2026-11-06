// One download/template per species, independent skeleton/mixer, shared GPU assets.
import * as THREE from 'three';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { loadModel } from './model-assets.js';
import { DINO_VISUALS } from './config.js';
import { DINO_CLIPS, dinoKind, dinoMotion } from './dino-animation.mjs';
const templates = new Map();
export const dinoModelStats = { ready:0, failed:0, instances:0 };
function template(kind) {
  if (!templates.has(kind)) templates.set(kind, loadModel(DINO_VISUALS[kind]).then(gltf => {
    for (const name of DINO_CLIPS) if (!gltf.animations.some(c=>c.name===name)) throw new Error('Clipe ausente: '+name);
    gltf.scene.updateMatrixWorld(true);
    const b = new THREE.Box3().setFromObject(gltf.scene);
    dinoModelStats.ready++;
    return { gltf, height:b.max.y-b.min.y, ground:b.min.y };
  }).catch(err => { dinoModelStats.failed++; console.warn('Dinossauro '+kind+': usando fallback procedural.',err); return null; }));
  return templates.get(kind); // Failure stays cached: never storm the server on each spawn.
}
export const preloadDinos = () => DINO_VISUALS.enabled ? Promise.all(['raptor','trex'].map(template)) : Promise.resolve([]);
export function attachDino(P, cfg) {
  if (!DINO_VISUALS.enabled) return;
  const token = P.modelToken = {};
  return template(dinoKind(cfg)).then(t => {
    if (!t || P.modelToken !== token) return;
    const root = clone(t.gltf.scene), holder = new THREE.Group(), mats = [], skeletons = new Set();
    // Original height ~1.7; target ~2*type.scale, matching the combat torso hitbox.
    root.scale.setScalar(2 / t.height); root.position.y = -t.ground * root.scale.x;
    root.traverse(o => {
      if (!o.isMesh) return;
      o.castShadow = o.receiveShadow = true; o.frustumCulled = false;
      if (o.skeleton) skeletons.add(o.skeleton);
      const privateMat = m => { const c=m.clone(); mats.push(c); return c; };
      o.material = Array.isArray(o.material)?o.material.map(privateMat):privateMat(o.material);
      P.shadowMeshes.push(o);
    });
    holder.add(root); P.g.add(holder); P.body.visible = false; P.g.remove(P.body);
    P.mats.push(...mats); P.em0.push(...mats.map(m=>m.emissive?.getHex()||0));
    const mixer = new THREE.AnimationMixer(root), actions = {};
    for (const clip of t.gltf.animations) {
      const a=actions[clip.name]=mixer.clipAction(clip);
      if (['attack','hurt','death'].includes(clip.name)) { a.setLoop(THREE.LoopOnce,1); a.clampWhenFinished=true; }
    }
    P.visual = { root,holder,mixer,actions,mats,skeletons,clip:null,lock:0 };
    resetDino(P); dinoModelStats.instances++;
  });
}
export function resetDino(P) {
  const v=P.visual; if (!v) return;
  v.mixer.stopAllAction(); v.root.traverse(o=>{if(o.isSkinnedMesh)o.skeleton.pose();});
  v.clip=null; v.lock=0; play(v,'idle',1);
}
function play(v,name,rate) {
  if (v.clip !== name) {
    const prev=v.actions[v.clip], next=v.actions[name];
    prev?.fadeOut(.12); next.reset().setEffectiveWeight(1).setEffectiveTimeScale(rate).fadeIn(.12).play();
    v.clip=name;
    v.lock=['attack','hurt'].includes(name)?next.getClip().duration/rate:0;
  }
  v.actions[name].setEffectiveTimeScale(rate);
}
export function animateDino(P,e,dt,speed=0) {
  const v=P.visual; if (!v) return false;
  const m=dinoMotion(e,speed); v.lock=Math.max(0,v.lock-dt);
  // Finish a one-shot bite/flinch even when the AI's damage window already closed.
  if (m.clip==='death' || !v.lock || ['hurt','attack'].includes(m.clip)) play(v,m.clip,m.rate);
  v.mixer.update(dt); return true;
}
export function disposeDino(P) {
  P.modelToken=null;
  const v=P.visual;if(!v)return;
  v.mixer.stopAllAction();v.mixer.uncacheRoot(v.root);v.skeletons.forEach(s=>s.dispose());
  v.holder.removeFromParent();P.visual=null;dinoModelStats.instances--;
  // Material lifetime is owned by disposeParts. Geometry and textures remain cached.
}
