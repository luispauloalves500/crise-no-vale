// Medir a malha SKINNED na pose idle; contatos pequenos pré-calculados uma vez por espécie.
import * as THREE from 'three';
import {DINO_FLOOR_CLEARANCE} from './dino-dimensions.mjs';
export const localBonePose=root=>{const pose=[];root.traverse(b=>{if(b.isBone)pose.push([b,b.position.clone(),b.quaternion.clone(),b.scale.clone()]);});return pose;};
export function restoreBonePose(pose) {for(const [b,p,q,s]of pose){b.position.copy(p);b.quaternion.copy(q);b.scale.copy(s);}}
// updateWorldMatrix sozinho NÃO atualiza bindMatrixInverse do SkinnedMesh em r160.
function updateSkin(root){root.updateWorldMatrix(true,false);root.updateMatrixWorld(true);}
function meshes(root){const list=[];root.traverse(m=>{if(m.isSkinnedMesh)list.push(m);});return list;}
export function posedBounds(root) {
  updateSkin(root);const box=new THREE.Box3(),p=new THREE.Vector3();
  root.traverse(m=>{if(!m.isMesh)return;for(let i=0;i<m.geometry.attributes.position.count;i++){m.getVertexPosition(i,p).applyMatrix4(m.matrixWorld);box.expandByPoint(p);}});return box;
}
export function calibrateDino(gltf) {
  const root=gltf.scene,rest=localBonePose(root),skin=meshes(root),contacts=skin.map(()=>new Set()),mixer=new THREE.AnimationMixer(root),p=new THREE.Vector3();
  const idle=gltf.animations.find(c=>c.name==='idle'),a=mixer.clipAction(idle).play();a.time=.4;mixer.update(0);
  const idleBounds=posedBounds(root),motionBounds=new THREE.Box3();
  if(!skin.length||idleBounds.isEmpty()||!idleBounds.getSize(new THREE.Vector3()).toArray().every(n=>Number.isFinite(n)&&n>0))throw new Error('Modelo sem malha skinned/dimensões válidas');
  // Extremidades de apoio de TODAS as animações, inclusive o corpo na queda; sem varrer 14k vértices por frame.
  for(const clip of gltf.animations) {
    mixer.stopAllAction();restoreBonePose(rest);const action=mixer.clipAction(clip).reset().setLoop(THREE.LoopOnce,1);action.clampWhenFinished=true;action.play();
    const steps=Math.max(2,Math.ceil(clip.duration*12));
    for(let t=0;t<=steps;t++) {
      action.time=clip.duration*t/steps;mixer.update(0);updateSkin(root);
      skin.forEach((m,k)=>{
        const lows=[];
        for(let i=0;i<m.geometry.attributes.position.count;i++) {
          m.getVertexPosition(i,p).applyMatrix4(m.matrixWorld);motionBounds.expandByPoint(p);
          if(lows.length<12||p.y<lows.at(-1).y){lows.push({i,y:p.y});lows.sort((a,b)=>a.y-b.y);if(lows.length>12)lows.pop();}
        }
        lows.forEach(({i})=>contacts[k].add(i));
      });
    }
  }
  mixer.stopAllAction();mixer.uncacheRoot(root);restoreBonePose(rest);updateSkin(root);
  return {idleBounds,motionBounds,contacts:contacts.map(s=>[...s])};
}
export function createDinoGrounder(root,holder,parent,indices) {
  const skin=meshes(root),p=new THREE.Vector3(),inverse=new THREE.Matrix4(),scale=new THREE.Vector3();
  return ()=>{
    holder.position.y=0;updateSkin(parent);inverse.copy(parent.matrixWorld).invert();let min=Infinity;
    skin.forEach((m,k)=>{for(const i of indices[k]){m.getVertexPosition(i,p).applyMatrix4(m.matrixWorld).applyMatrix4(inverse);min=Math.min(min,p.y);}});
    parent.getWorldScale(scale);holder.position.y=DINO_FLOOR_CLEARANCE/Math.max(.001,Math.abs(scale.y))-min;
    return min;
  };
}
