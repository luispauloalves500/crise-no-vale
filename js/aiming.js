// Raycast da câmera + obstrução do cano; mesmo ponto/traçado para HUD, dano e tracer.
import * as THREE from 'three';
import {dinoDimensions,DINO_FLOOR_CLEARANCE} from './dino-dimensions.mjs';
import {rayAABB3D,rayEllipse3D,directionTo,coneDirection} from './aim-math.mjs';
export function createAimSolver({camera,enemies,boxes=[],circles=[],worldRoot=()=>null,reticleNDC=()=>({x:0,y:0})}) {
  const cameraRay=new THREE.Raycaster(),worldRay=new THREE.Raycaster(),cache=new WeakMap();
  function targets(root){
    if(!root)return [];if(!cache.has(root)){const list=[];root.traverse(o=>{if(o.isMesh&&!o.userData.grassChunk&&!o.userData.noBulletHit){const mats=Array.isArray(o.material)?o.material:[o.material];if(mats.some(m=>m&&m.visible!==false&&(!m.transparent||m.depthWrite!==false)&&m.opacity!==0))list.push(o);}});cache.set(root,list);}return cache.get(root);
  }
  const visible=o=>{for(let p=o;p;p=p.parent)if(!p.visible)return false;return true;};
  function cast(origin,direction,max,includeEnemies=true) {
    let t=max,e=null,object=null,kind='range',normal=null;
    const accept=(distance,hitKind,enemy=null,mesh=null,n=null)=>{if(distance<t-1e-6){t=distance;e=enemy;object=mesh;kind=hitKind;normal=n;}};
    for(const b of boxes){
      const box={minX:b.minX,maxX:b.maxX,minY:b.minY??0,maxY:b.h,minZ:b.minZ,maxZ:b.maxZ},distance=rayAABB3D(origin,direction,box,t);
      if(distance<t){const p=new THREE.Vector3().copy(direction).multiplyScalar(distance).add(origin),faces=[['x',box.minX,-1],['x',box.maxX,1],['y',box.minY,-1],['y',box.maxY,1],['z',box.minZ,-1],['z',box.maxZ,1]].sort((a,b)=>Math.abs(p[a[0]]-a[1])-Math.abs(p[b[0]]-b[1])),n=new THREE.Vector3();n[faces[0][0]]=faces[0][2];if(n.dot(direction)>0)n.negate();accept(distance,'world',null,null,n);}
    }
    for(const c of circles){const distance=rayEllipse3D(origin,direction,{x:c.x,z:c.z,rx:c.r,rz:c.r,minY:0,maxY:c.h},t);if(distance<t){const p=new THREE.Vector3().copy(direction).multiplyScalar(distance).add(origin),n=Math.abs(p.y-c.h)<1e-5?new THREE.Vector3(0,1,0):Math.abs(p.y)<1e-5?new THREE.Vector3(0,-1,0):new THREE.Vector3(p.x-c.x,0,p.z-c.z).normalize();if(n.dot(direction)>0)n.negate();accept(distance,'world',null,null,n);}}
    const root=worldRoot();if(root&&visible(root)){
      root.updateWorldMatrix(true,false);root.updateMatrixWorld(true);worldRay.set(origin,direction);worldRay.near=0;worldRay.far=t;
      for(const hit of worldRay.intersectObjects(targets(root).filter(visible),false))if(hit.distance<t){const transform=hit.object.matrixWorld.clone();if(hit.instanceId!==undefined){const instance=new THREE.Matrix4();hit.object.getMatrixAt(hit.instanceId,instance);transform.multiply(instance);}const n=hit.face?hit.face.normal.clone().applyNormalMatrix(new THREE.Matrix3().getNormalMatrix(transform)):direction.clone().negate();if(n.dot(direction)>0)n.negate();accept(hit.distance,'world',null,hit.object,n);break;}
    }
    if(includeEnemies)for(const enemy of enemies){if(enemy.dead||enemy.remove)continue;const dim=dinoDimensions(enemy.cfg),yaw=enemy.yaw||0;
      accept(rayEllipse3D(origin,direction,{x:enemy.pos.x+Math.sin(yaw)*dim.centerZ,z:enemy.pos.z+Math.cos(yaw)*dim.centerZ,rx:Math.max(dim.radius||0,dim.width/2),rz:dim.length/2,minY:(enemy.pos.y||0)+DINO_FLOOR_CLEARANCE,maxY:(enemy.pos.y||0)+DINO_FLOOR_CLEARANCE+dim.height,yaw},t),'enemy',enemy);
    }
    return {t,e,object,kind,normal,point:new THREE.Vector3(origin.x+direction.x*t,origin.y+direction.y*t,origin.z+direction.z*t)};
  }
  function aim(muzzle,range) {
    camera.updateWorldMatrix(true,false);const ndc=reticleNDC();cameraRay.setFromCamera(ndc,camera);
    const far=range+camera.position.distanceTo(muzzle),result=cast(cameraRay.ray.origin,cameraRay.ray.direction,far);
    const direction=new THREE.Vector3().copy(directionTo(muzzle,result.point,cameraRay.ray.direction));
    return {...result,direction,ndc,origin:cameraRay.ray.origin.clone(),cameraDirection:cameraRay.ray.direction.clone()};
  }
  return {cast,aim,shot(muzzle,aim,range,h=0,v=0){
    const d=new THREE.Vector3().copy(coneDirection(aim.direction,h,v)),hit=cast(muzzle,d,range),distance=muzzle.distanceTo(aim.point);
    // Uma superfície já confirmada pela câmera não pode desaparecer numa aresta/seam
    // numérica entre triângulos. Obstruções MAIS PRÓXIMAS do cano sempre prevalecem.
    if(h===0&&v===0&&aim.kind!=='range'&&distance<=range&&hit.t>distance+1e-6)return {...aim,t:distance,point:aim.point.clone(),direction:d};
    return {...hit,direction:d};
  }};
}
