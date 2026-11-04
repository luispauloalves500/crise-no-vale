import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function loadShadows() {
  class Vector { constructor() { this.x=0;this.y=0;this.z=0; } set(x,y,z) { Object.assign(this,{x,y,z}); } }
  class Object3D { constructor() { this.position=new Vector();this.scale=new Vector(); } updateMatrix() { this.matrix={position:{...this.position},scale:{...this.scale}}; } }
  class Mesh { constructor(geometry,material) { this.geometry=geometry;this.material=material;this.position=new Vector();this.scale=new Vector();this.visible=true; } }
  class InstancedMesh extends Mesh { constructor(g,m,n) { super(g,m);this.count=n;this.matrices=[];this.instanceMatrix={}; } setMatrixAt(i,m) { this.matrices[i]=m; } computeBoundingSphere(){this.bounded=true;} }
  class CanvasTexture { dispose() { this.disposed=true; } }
  class TextureLoader { load(url,onLoad) { globalThis.__shadowTextureCallback=onLoad; } }
  class PlaneGeometry { rotateX() {} }
  class MeshBasicMaterial { constructor(props) { Object.assign(this,props); } }
  globalThis.__shadowThree={Object3D,Mesh,InstancedMesh,CanvasTexture,TextureLoader,PlaneGeometry,MeshBasicMaterial};
  globalThis.document={createElement(){return {getContext(){return {createRadialGradient(){return {addColorStop(){}};},fillRect(){}};}};}};
  let code=await readFile(new URL('../js/contact-shadows.js',import.meta.url),'utf8');
  code=code.replace("import * as THREE from 'three';",'const THREE = globalThis.__shadowThree;').replace("new URL('../assets/efeitos/sombra-contato.webp', import.meta.url).href", "'shadow.webp'");
  return import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
}

test('sombras estáticas usam um lote, limitam dimensões e ignoram entradas inválidas', async()=>{
  const s=await loadShadows();const ctx={group:{children:[],add(o){this.children.push(o);}}};
  assert.equal(s.buildContactShadows(ctx),null);
  s.queueShadow(ctx,1,2,2,3);s.queueShadow(ctx,3,4,100,0.1);s.queueShadow(ctx,NaN,0,1,1);
  const batch=s.buildContactShadows(ctx);assert.equal(batch.count,2);assert.equal(ctx.group.children.length,1);
  assert.deepEqual(batch.matrices[0].position,{x:1,y:0.04,z:2});
  assert.deepEqual(batch.matrices[1].scale,{x:8,y:1,z:0.5});
  assert.equal(batch.bounded,true);assert.equal(ctx.contactShadows.length,0);
});
test('personagens compartilham textura e recebem fallback até a imagem carregar', async()=>{
  const s=await loadShadows(); const parent={children:[],add(o){this.children.push(o);}};
  const a=s.actorShadow(parent,1.2,2),b=s.actorShadow(parent);
  assert.equal(a.material,b.material);assert.equal(a.geometry,b.geometry);
  assert.equal(a.position.y,0.045);assert.equal(a.scale.z,2);
  const fallback=a.material.map;const image={webp:true};globalThis.__shadowTextureCallback(image);
  assert.equal(a.material.map,image);assert.equal(fallback.disposed,true);
});
test('imagem de sombra incluída é WebP e renderizador não usa shadow map',async()=>{
  const img=await readFile(new URL('../assets/efeitos/sombra-contato.webp',import.meta.url));
  assert.equal(img.toString('ascii',0,4),'RIFF');assert.equal(img.toString('ascii',8,12),'WEBP');
  const world=await readFile(new URL('../js/world.js',import.meta.url),'utf8');
  assert.match(world,/renderer\.shadowMap\.enabled\s*=\s*false/);
  assert.match(world,/share\(GLOW, \.\.\.contactShadowResources\)/);
});
