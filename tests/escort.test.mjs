import test from 'node:test';
import assert from 'node:assert/strict';
import {canStand,segmentClear,findEscortPath} from '../js/escort-nav.mjs';
const area={bounds:{minX:0,maxX:24,minZ:0,maxZ:24},boxes:[],circles:[]};
test('rota direta em área livre',()=>{
  assert.deepEqual(findEscortPath({x:3,z:3},{x:15,z:15},area),[{x:15,z:15}]);
});
test('contorna um galpão sem atravessar paredes',()=>{
  const env={...area,boxes:[{minX:10,maxX:12,minZ:1,maxZ:18,h:3}]};
  const from={x:3,z:4},to={x:19,z:4};
  assert.equal(segmentClear(from,to,env),false);
  const path=findEscortPath(from,to,env);assert.ok(path.length>1);
  let p=from;for(const next of path){assert.ok(segmentClear(p,next,env));p=next;}
  assert.ok(Math.hypot(p.x-to.x,p.z-to.z)<1.2);
});
test('contorna fonte e caixas',()=>{
  const env={...area,circles:[{x:9,z:10,r:3,h:1}],boxes:[{minX:13,maxX:15,minZ:9,maxZ:12,h:2}]};
  const from={x:3,z:10},to={x:20,z:10},path=findEscortPath(from,to,env);
  assert.ok(path.length>1);let p=from;for(const next of path){assert.ok(segmentClear(p,next,env));p=next;}
});
test('não atravessa bloqueio completo',()=>{
  const env={...area,boxes:[{minX:11,maxX:13,minZ:0,maxZ:24,h:3}]};
  assert.deepEqual(findEscortPath({x:3,z:4},{x:20,z:4},env),[]);
});
test('alvo dentro de obstáculo não autoriza atravessar parede',()=>{
  const env={...area,boxes:[{minX:10,maxX:12,minZ:1,maxZ:18,h:3}]};
  const path=findEscortPath({x:3,z:4},{x:11,z:4},env);
  let p={x:3,z:4};for(const next of path){assert.ok(segmentClear(p,next,env));p=next;}
  assert.equal(canStand(11,4,env),false);
});
