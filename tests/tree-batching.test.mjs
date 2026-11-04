import test from 'node:test';
import assert from 'node:assert/strict';
import {batchBackgroundTrees} from '../js/tree-batching.mjs';
class Matrix { constructor(x=0,z=0){this.elements=Array(16).fill(0);this.elements[12]=x;this.elements[14]=z;} clone(){const m=new Matrix();m.elements=this.elements.slice();return m;} }
class Batch {constructor(geometry,material,count){Object.assign(this,{geometry,material,count,userData:{},position:{set(x,y,z){Object.assign(this,{x,y,z})}},instanceMatrix:{},matrices:[]});} setMatrixAt(i,m){this.matrices[i]=m;} computeBoundingSphere(){this.bounded=true;} }
function tree(x,z,g,m,decorative=true){return {isMesh:true,position:{x,z},geometry:g,material:m,userData:{backgroundTree:decorative},updateMatrix(){this.matrix=new Matrix(x,z)}}}
test('árvores decorativas usam instâncias por setor sem alterar posição ou árvores sólidas',()=>{
  const geo={},material={uuid:'folha'},a=tree(2,3,geo,material),b=tree(5,6,geo,material),solid=tree(8,9,geo,material,false),far=tree(50,50,geo,material);
  const root={children:[a,b,solid,far],remove(...list){this.children=this.children.filter(c=>!list.includes(c))},add(o){this.children.push(o)}};
  const result=batchBackgroundTrees({InstancedMesh:Batch},root,24);
  assert.deepEqual(result,{sourceCount:2,batchCount:1});assert.ok(root.children.includes(solid));assert.ok(root.children.includes(far));
  const batch=root.children.find(x=>x instanceof Batch);assert.equal(batch.count,2);assert.equal(batch.bounded,true);
  assert.equal(batch.position.x+batch.matrices[0].elements[12],2);assert.equal(batch.position.z+batch.matrices[1].elements[14],6);
  assert.equal(batch.geometry,geo);assert.equal(batch.material,material);assert.equal(batch.userData.lod,'big');
});
