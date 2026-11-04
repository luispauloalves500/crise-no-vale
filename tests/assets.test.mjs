import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const models = [
  ['assets/personagens/jill.glb', true, ['Walking','Running']],
  ['assets/personagens/dra-lima.glb', true, ['Walking','Running']],
  ['assets/armas/glock.glb', false, [], 4],
  ['assets/armas/escopeta.glb', false, []],
  ['assets/armas/mp5.glb', false, [], 3],
  // versões simplificadas (LOD) que o jogo carrega de fato
  ['assets/personagens/dra-lima-lod.glb', true, ['Walking','Running']],
  ['assets/armas/glock-lod.glb', false, []],
  ['assets/armas/mp5-lod.glb', false, []],
];
for (const [path, rig, clips, parts] of models) test(`${path}: GLB íntegro e conteúdo disponível`, () => {
  const bytes = parts ? Buffer.concat(Array.from({length:parts}, (_, i) => readFileSync(new URL('../'+path+'.part'+String(i).padStart(2,'0'), import.meta.url)))) : readFileSync(new URL('../'+path,import.meta.url));
  assert.equal(bytes.readUInt32LE(0), 0x46546c67); assert.equal(bytes.readUInt32LE(4), 2); assert.equal(bytes.readUInt32LE(8), bytes.length);
  const size=bytes.readUInt32LE(12), data=JSON.parse(bytes.subarray(20,20+size).toString('utf8'));
  const bin=20+size; assert.equal(bytes.readUInt32LE(bin+4),0x004e4942);
  const binSize=bytes.readUInt32LE(bin); assert.equal(bin+8+binSize,bytes.length);
  for(const v of data.bufferViews) assert.ok((v.byteOffset||0)+v.byteLength<=binSize);
  assert.ok(data.meshes?.length); assert.ok(data.images?.every(image=>image.bufferView !== undefined && !image.uri));
  if(rig) { assert.ok(data.skins?.length); assert.ok(data.nodes.some(n=>n.name==='mixamorig:RightHand')); }
  for(const name of clips) assert.ok(data.animations.some(a=>a.name===name));
});

function readGLB(path, parts=0) {
  const bytes=parts ? Buffer.concat(Array.from({length:parts},(_,i)=>readFileSync(new URL('../'+path+'.part'+String(i).padStart(2,'0'),import.meta.url)))) : readFileSync(new URL('../'+path,import.meta.url));
  const size=bytes.readUInt32LE(12);
  return {data:JSON.parse(bytes.subarray(20,20+size)),bin:bytes.subarray(28+size),bytes:bytes.length};
}
function values(glb,index) {
  const a=glb.data.accessors[index],v=glb.data.bufferViews[a.bufferView];
  const components={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT4:16}[a.type];
  assert.equal(a.componentType,5126); // matrizes e animações desses GLBs usam Float32
  return Array.from({length:a.count*components},(_,i)=>glb.bin.readFloatLE((v.byteOffset||0)+(a.byteOffset||0)+Math.floor(i/components)*(v.byteStride||components*4)+(i%components)*4));
}
test('LODs reduzem triângulos e download e mantêm dimensões próximas dos originais',()=>{
  for(const [base,lod,parts,budget] of [
    ['assets/armas/glock.glb','assets/armas/glock-lod.glb',4,60000],
    ['assets/armas/mp5.glb','assets/armas/mp5-lod.glb',3,42000],
    ['assets/personagens/dra-lima.glb','assets/personagens/dra-lima-lod.glb',0,38000],
  ]) {
    const original=readGLB(base,parts),small=readGLB(lod);
    const triangles=g=>g.data.meshes.flatMap(m=>m.primitives).reduce((n,p)=>n+g.data.accessors[p.indices??p.attributes.POSITION].count/3,0);
    assert.ok(triangles(small)<=budget,lod);assert.ok(triangles(small)<triangles(original)*0.2,lod);
    assert.ok(small.bytes<original.bytes*0.25,lod);
    const bounds=g=>g.data.meshes.flatMap(m=>m.primitives).map(p=>g.data.accessors[p.attributes.POSITION]);
    const a=bounds(original),b=bounds(small);assert.equal(a.length,b.length);
    for(let i=0;i<a.length;i++) for(const edge of ['min','max']) for(let axis=0;axis<3;axis++) {
      const tolerance=(a[i].max[axis]-a[i].min[axis])*0.01;
      assert.ok(Math.abs(a[i][edge][axis]-b[i][edge][axis])<=tolerance,`${lod}: ${edge} ${axis}`);
    }
  }
});
test('Lima otimizada preserva hierarquia, repouso, matrizes de bind e canais de animação',()=>{
  const a=readGLB('assets/personagens/dra-lima.glb'),b=readGLB('assets/personagens/dra-lima-lod.glb');
  assert.equal(a.data.nodes.length,b.data.nodes.length);
  for(let i=0;i<a.data.nodes.length;i++) {
    const x=a.data.nodes[i],y=b.data.nodes[i];
    assert.equal(x.name,y.name);assert.deepEqual(x.children,y.children);
    for(const [key,fallback] of [['translation',[0,0,0]],['rotation',[0,0,0,1]],['scale',[1,1,1]]])
      (x[key]||fallback).forEach((n,j)=>assert.ok(Math.abs(n-(y[key]||fallback)[j])<1e-5,`${x.name}: ${key}`));
  }
  assert.deepEqual(a.data.skins[0].joints,b.data.skins[0].joints);
  assert.deepEqual(values(a,a.data.skins[0].inverseBindMatrices),values(b,b.data.skins[0].inverseBindMatrices));
  for(const original of a.data.animations) {
    const small=b.data.animations.find(c=>c.name===original.name);assert.ok(small);
    assert.equal(original.channels.length,small.channels.length);
    original.channels.forEach((channel,i)=>{
      assert.deepEqual(channel.target,small.channels[i].target);
      const x=original.samplers[channel.sampler],y=small.samplers[small.channels[i].sampler];
      assert.equal(x.interpolation,y.interpolation);
      assert.deepEqual(values(a,x.input),values(b,y.input));
      assert.deepEqual(values(a,x.output),values(b,y.output));
    });
  }
});
