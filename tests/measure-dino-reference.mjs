// Medição reproduzível do procedural histórico; somente CPU, sem texturas/sprites/sombras.
import * as THREE from 'three';
import vm from 'node:vm';import {execFileSync} from 'node:child_process';
import {ENEMY_TYPES} from '../js/config.js';
const source=execFileSync('git',['show','24d7e1e:js/enemies.js'],{encoding:'utf8'}),oldConfig=execFileSync('git',['show','24d7e1e:js/config.js'],{encoding:'utf8'});
const start=source.indexOf('const unit ='),end=source.indexOf('// ---------- pool de inimigos');
const texture=new THREE.Texture();texture.userData.bump=new THREE.Texture();
const context=vm.createContext({THREE,ENEMY_TYPES,scene:new THREE.Scene(),GLOW:texture,noiseTex:()=>texture,actorShadow:()=>new THREE.Object3D()});
vm.runInContext(source.slice(start,end)+'\nthis.build=buildDino;',context);
const report={reference:'24d7e1e',units:'metros; +Z comprimento; somente meshes físicos, pose inicial',types:{}};
for(const [type,cfg] of Object.entries(ENEMY_TYPES)){
 const p=context.build(type);p.g.updateMatrixWorld(true);const box=new THREE.Box3(),v=new THREE.Vector3();
 p.body.traverse(m=>{if(m.isMesh){const pos=m.geometry.attributes.position;for(let i=0;i<pos.count;i++){v.fromBufferAttribute(pos,i).applyMatrix4(m.matrixWorld);box.expandByPoint(v)}}});
 const size=box.getSize(new THREE.Vector3());report.types[type]={width:size.x,height:size.y,length:size.z,minY:box.min.y,maxY:box.max.y,minZ:box.min.z,maxZ:box.max.z,radius:cfg.r,scale:cfg.scale,derived:!oldConfig.includes(type+':')&&!oldConfig.includes(type+': ')};
}
console.log(JSON.stringify(report,null,2));
