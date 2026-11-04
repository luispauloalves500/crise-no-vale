import test from 'node:test';
import assert from 'node:assert/strict';
import {makeGrassBlades,grassCount} from '../js/grass-design.mjs';
import {showPelletVisual} from '../js/effect-budget.mjs';
import {createParticleBatches} from '../js/particle-batches.mjs';
import {GUN_ASSETS, GUN_SCALE} from '../js/gun-layout.mjs';

test('tufo tem três folhas, raízes no chão e cor escura na base',()=>{
  const g=makeGrassBlades(); assert.equal(g.triangles,3);
  assert.equal(g.positions.length,27); assert.equal(g.colors.length,27);
  for(let i=0;i<3;i++) {
    assert.equal(g.positions[i*9+1],0); assert.equal(g.positions[i*9+4],0);
    assert.ok(g.positions[i*9+7]>0); assert.ok(g.colors[i*9] < g.colors[i*9+6]);
  }
  assert.equal(grassCount(100,0.55),55);assert.equal(grassCount(100,2),100);assert.equal(grassCount(100,-1),0);
});
test('orçamento limita visuais dos chumbos e preserva o tiro único',()=>{
  assert.equal(showPelletVisual(0,1,'baixo'),true);
  assert.deepEqual(Array.from({length:8},(_,i)=>i).filter(i=>showPelletVisual(i,8,'baixo')),[0,3,6]);
  assert.deepEqual(Array.from({length:8},(_,i)=>i).filter(i=>showPelletVisual(i,8,'alto')),[0,2,4,6]);
});
test('partículas visíveis são agrupadas, removidas e limpas sem resíduos',()=>{
  class InstancedMesh {constructor(g,m,c){this.max=c;this.count=0;this.entries=[];this.instanceMatrix={setUsage(){},needsUpdate:false};} setMatrixAt(i,m){this.entries[i]=m;}}
  class Matrix4 {multiplyMatrices(){return this;}}
  class Frustum {setFromProjectionMatrix(){} intersectsSphere(s){return s.center.x>=0;}}
  class Sphere {constructor(){this.center={copy(p){this.x=p.x;}};}}
  const THREE={InstancedMesh,Matrix4,Frustum,Sphere,DynamicDrawUsage:1}, scene={children:[],add(x){this.children.push(x);}};
  const pool=createParticleBatches(THREE,scene,{}, {spark:{},dust:{}},3);
  const p=(kind,x,visible=true)=>({kind,m:{visible,position:{x},scale:{x:1,y:1,z:1},matrix:{x},updateMatrix(){}}});
  const parts=[p('spark',1),p('spark',-1),p('dust',2),p('dust',3,false)],camera={projectionMatrix:{},matrixWorldInverse:{}};
  pool.flush(parts,camera);assert.equal(pool.batches.spark.count,1);assert.equal(pool.batches.dust.count,1);
  parts[0].m.visible=false;pool.flush(parts,camera);assert.equal(pool.batches.spark.count,0);assert.equal(pool.batches.dust.count,1);
  pool.clear();assert.equal(pool.batches.dust.count,0);assert.equal(scene.children.length,2);
});
test('empunhadura estimada da escopeta fica próxima ao soquete da mão',()=>{
  const s=GUN_ASSETS[1], scale=s.length/2.000623, grip=s.gripSource, offset=[0,0.17,-0.48];
  const y=s.pos[1]+offset[1]+(grip[1]-(-0.0004215))*scale;
  const z=s.pos[2]+offset[2]+(grip[0]-0.0004055)*scale;
  assert.ok(Math.hypot(y,z)*GUN_SCALE<0.02,`distância da empunhadura: ${Math.hypot(y,z)*GUN_SCALE}`);
  assert.ok(Math.abs(s.tip-(s.pos[2]+s.length/2))<0.001);
  const muzzleY=s.pos[1]+(0.1913946-(-0.0004215))*scale;
  assert.ok(Math.abs(muzzleY-s.tipY)<0.005,'clarão próximo à altura real do cano');
});
