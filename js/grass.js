// Grama enviada pelo usuário: patch pequeno compartilhado, instancing por chunks e vento na GPU.
import * as THREE from 'three';
import {grassCandidates,grassMasks,grassAllowed,grassChunks,grassBudget,planGrass,NATURAL_GRASS_AREAS} from './grass-policy.mjs';
const SHARED=new WeakSet(),fields=new Set(),windTime={value:0},windStrength={value:.065};
const share=(x)=>(SHARED.add(x),x);
export const isGrassResource=x=>SHARED.has(x);
export function aplicarVento(material) {
  material.onBeforeCompile=shader=>{
    shader.uniforms.uGrassTime=windTime;shader.uniforms.uGrassStrength=windStrength;
    shader.vertexShader='uniform float uGrassTime;\nuniform float uGrassStrength;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
      vec3 grassAnchor = vec3(0.0);
      #ifdef USE_INSTANCING
        grassAnchor = instanceMatrix[3].xyz;
      #endif
      vec3 grassWorld = (modelMatrix * vec4(grassAnchor, 1.0)).xyz;
      float grassWeight = pow(clamp(position.y / 0.42, 0.0, 1.0), 2.0);
      float grassPhase = grassWorld.x * 0.71 + grassWorld.z * 0.53 + position.x * 5.1;
      float grassWave = sin(uGrassTime * 1.4 + grassPhase) + sin(uGrassTime * 2.17 + grassPhase * 1.7) * 0.35;
      transformed.x += grassWave * uGrassStrength * grassWeight;
      transformed.z += cos(uGrassTime * 1.13 + grassPhase) * uGrassStrength * 0.45 * grassWeight;
    `);
  };
  material.customProgramCacheKey=()=> 'cnv-grass-wind-v1';
  return material;
}
export function atualizarVento(dt,reducedMotion=false) {
  windTime.value=(windTime.value+Math.max(0,Math.min(.1,Number.isFinite(dt)?dt:0)))%4096;
  windStrength.value=reducedMotion?.013:.065;
}
function material(map=null) {
  return share(aplicarVento(new THREE.MeshLambertMaterial({color:map?0xc4d98a:0x506e31,map,side:THREE.DoubleSide})));
}
// LOD distante e fallback: quatro fitas curvas (12 tri), não cones nem o patch original de 161 mil tri.
function fallbackGeometry() {
  const positions=[];
  for(let i=0;i<4;i++) {
    const a=i*Math.PI/2.1,c=Math.cos(a),s=Math.sin(a),x=Math.sin(i*7)*.12,z=Math.cos(i*5)*.12,h=.32+(i%3)*.05,w=.035;
    const v=[x-c*w,0,z-s*w,x+c*w,0,z+s*w,x+c*w*.7+.02,h*.55,z+s*w*.7,x-c*w*.7+.02,h*.55,z-s*w*.7,x+.065,h,z+.025];
    for(const k of [0,1,2,0,2,3,3,2,4]) positions.push(...v.slice(k*3,k*3+3));
  }
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.computeVertexNormals();geo.computeBoundingSphere();return share(geo);
}
const farGeo=fallbackGeometry(),farMat=material();
let nearGeo=farGeo,nearMat=farMat,status='fallback',loadPromise=null,lastCtx=null,timer=0,lastSignature='';
const triangles=g=>(g.index?.count||g.attributes.position.count)/3;
export function queueGrass(ctx,b,n,color) {
  (ctx.grassRequests||=[]).push({bounds:{...b},points:grassCandidates(ctx.rng,b,n),color});
}
function makeMeshes(field) {
  for(const chunk of field.chunks) {
    if(chunk.near) {chunk.near.dispose();chunk.far.dispose();field.group.remove(chunk.near,chunk.far);}
    for(const [key,geo,mat] of [['near',nearGeo,nearMat],['far',farGeo,farMat]]) {
      const mesh=new THREE.InstancedMesh(geo,mat,chunk.points.length),dummy=new THREE.Object3D(),tint=new THREE.Color();
      mesh.name='grass-'+key+'-'+chunk.key;mesh.castShadow=mesh.receiveShadow=false;mesh.userData.grassChunk=true;
      chunk.points.forEach((p,i)=>{
        dummy.position.set(p.x,.015,p.z);dummy.rotation.set(0,p.yaw,0);dummy.scale.set(p.scale,p.height,p.scale);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);
        tint.setRGB(p.shade,p.shade*.99,p.shade*.88);mesh.setColorAt(i,tint);
      });
      mesh.instanceMatrix.needsUpdate=true;mesh.instanceColor.needsUpdate=true;mesh.computeBoundingSphere();mesh.boundingSphere.radius+=.15;
      mesh.count=0;mesh.visible=false;mesh.updateMatrix();mesh.matrixAutoUpdate=false;chunk[key]=mesh;field.group.add(mesh);
    }
  }
  field.dirty=true;
}
export function finalizeGrass(ctx,area) {
  if(!NATURAL_GRASS_AREAS.has(area.id)) {ctx.grassRequests=[];return null;}
  const masks=grassMasks(ctx,area),points=[];
  for(const request of ctx.grassRequests||[]) for(const p of request.points) {
    if(grassAllowed(p,request.bounds,masks)&&grassAllowed(p,area.bounds,masks)&&!points.some(q=>Math.hypot(q.x-p.x,q.z-p.z)<.9)) points.push(p);
  }
  ctx.grassRequests=[];
  const group=new THREE.Group();group.name='grass-field';group.updateMatrix();group.matrixAutoUpdate=false;ctx.group.add(group);
  const field={areaId:area.id,ctx,group,points,masks,chunks:grassChunks(points),dirty:true,disposed:false};
  ctx.grassField=field;fields.add(field);makeMeshes(field);return field;
}
export function releaseGrass(root) {
  for(const field of fields) if(field.ctx.group===root) {field.disposed=true;fields.delete(field);if(lastCtx===field.ctx)lastCtx=null;}
}
// Única tentativa, sem chuva de requests. Falha/timeout mantém as fitas leves e o mesmo vento.
export function preloadGrass(loader=null) {
  if(!loadPromise) loadPromise=(async()=>{
    try {
      const gltf=await (loader?loader():import('./model-assets.js').then(m=>m.loadModel('./assets/models/grass-patch.glb')));
      gltf.scene.updateMatrixWorld(true);let mesh;gltf.scene.traverse(o=>{if(!mesh&&o.isMesh)mesh=o;});
      if(!mesh?.geometry?.attributes.position||triangles(mesh.geometry)>600) throw new Error('Patch de grama inválido/pesado');
      const geo=mesh.geometry.clone();
      // Meshopt usa atributos normalizados/interleaved: baking em Uint16 corromperia coordenadas negativas.
      for(const name of ['position','normal']) {
        const a=geo.getAttribute(name);if(!a)continue;const values=new Float32Array(a.count*3);
        for(let i=0;i<a.count;i++){values[i*3]=a.getX(i);values[i*3+1]=a.getY(i);values[i*3+2]=a.getZ(i);}
        geo.setAttribute(name,new THREE.BufferAttribute(values,3));
      }
      geo.applyMatrix4(mesh.matrixWorld);geo.computeBoundingSphere();geo.computeBoundingBox();
      const size=geo.boundingBox.getSize(new THREE.Vector3());
      if(!size.toArray().every(Number.isFinite)||size.y<.1||size.y>.5||Math.hypot(size.x,size.z)>.99||geo.boundingBox.min.y<-.01) {geo.dispose();throw new Error('Footprint de grama inválido');}
      nearGeo=share(geo);const source=Array.isArray(mesh.material)?mesh.material[0]:mesh.material;
      if(source.map) share(source.map);nearMat=material(source.map||null);status='ready';
      for(const field of fields) if(!field.disposed) makeMeshes(field);
      return true;
    } catch(error) {status='fallback';console.warn('Grama GLB indisponível; fallback leve mantido.',error);return false;}
  })();
  return loadPromise;
}
export function updateGrass(dt,ctx,camera,preset,difficulty='normal',density=1,force=false) {
  timer+=dt;const field=ctx?.grassField;
  const signature=[preset.id,preset.grass,difficulty,density].join(':');
  if(!force&&ctx===lastCtx&&signature===lastSignature&&!field?.dirty&&timer<1/6)return;
  timer=0;lastCtx=ctx;lastSignature=signature;
  for(const f of fields) if(f!==field) f.group.visible=false;
  if(!field||field.disposed)return;
  field.group.visible=true;field.dirty=false;
  for(const p of planGrass(field.chunks,camera.position||camera,grassBudget(preset,difficulty,density,field.areaId))) {
    const c=p.chunk;c.near.visible=p.lod==='near';c.far.visible=p.lod==='far';c.near.count=p.lod==='near'?p.count:0;c.far.count=p.lod==='far'?p.count:0;
  }
}
export function grassStats(ctx) {
  const f=ctx?.grassField;
  let near=0,far=0,draws=0;
  if(f?.group.visible)for(const c of f.chunks)for(const key of ['near','far'])if(c[key].visible){if(key==='near')near+=c[key].count;else far+=c[key].count;draws++;}
  return {status,area:f?.areaId||null,patches:f?.points.length||0,chunks:f?.chunks.length||0,near,far,triangles:near*triangles(nearGeo)+far*triangles(farGeo),draws,nearTriangles:triangles(nearGeo),farTriangles:triangles(farGeo),fields:fields.size};
}
