import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {reticleToNDC,directionTo,rayAABB3D,rayEllipse3D,coneDirection,pelletOffsets,grenadeArc,advanceBallistic} from '../js/aim-math.mjs';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
test('retícula usa pixels CSS/NDC reais, inclusive fora do centro e canvas deslocado',()=>{
 const v={left:100,top:40,width:1200,height:600};assert.deepEqual(reticleToNDC({left:700,top:340,width:0,height:0},v),{x:0,y:0});
 assert.deepEqual(reticleToNDC({left:1000,top:190,width:0,height:0},v),{x:.5,y:.5});assert.deepEqual(reticleToNDC({left:390,top:480,width:20,height:20},v),{x:-.5,y:-.5});
 assert.deepEqual(reticleToNDC(null,v),{x:0,y:0});assert.deepEqual(reticleToNDC({},v),{x:0,y:0});
});
test('direção sai do cano ao alvo 3D: pitch não desaparece nem se usa a origem do jogador',()=>{
 const o={x:.7,y:1.6,z:1},p={x:8,y:6,z:20},d=directionTo(o,p),t=Math.hypot(p.x-o.x,p.y-o.y,p.z-o.z);near(o.x+d.x*t,p.x);near(o.y+d.y*t,p.y);near(o.z+d.z*t,p.z);assert.ok(d.y>0);near(Math.hypot(d.x,d.y,d.z),1);
});
test('raycast 3D de caixa bloqueia abaixo da cobertura, não no céu e não fora do alcance',()=>{
 const b={minX:-1,maxX:1,minY:0,maxY:1,minZ:5,maxZ:6};near(rayAABB3D({x:0,y:.5,z:0},{x:0,y:0,z:1},b,10),5);
 assert.equal(rayAABB3D({x:0,y:2,z:0},{x:0,y:0,z:1},b,10),Infinity);assert.equal(rayAABB3D({x:0,y:.5,z:0},{x:0,y:0,z:1},b,4),Infinity);
 near(rayAABB3D({x:0,y:2,z:5.5},{x:0,y:-1,z:0},b,10),1);
});
test('volume de inimigo tem limite de altura, permite mirar de cima e gira com o corpo',()=>{
 const b={x:0,z:8,rx:.8,rz:2,minY:.012,maxY:2.5};near(rayEllipse3D({x:0,y:1,z:0},{x:0,y:0,z:1},b,30),6);
 assert.equal(rayEllipse3D({x:0,y:3,z:0},{x:0,y:0,z:1},b,30),Infinity);near(rayEllipse3D({x:0,y:6,z:8},{x:0,y:-1,z:0},b,30),3.5);
 near(rayEllipse3D({x:8,y:1,z:8},{x:-1,y:0,z:0},{...b,yaw:Math.PI/2},30),6);
});
test('cone 3D é centrado na mira e mantém a direção mesmo quase vertical',()=>{
 for(const base of [{x:0,y:0,z:1},directionTo({x:0,y:0,z:0},{x:1,y:3,z:8}),{x:0,y:1,z:0}]){
  const d=coneDirection(base,0,0);near(d.x,base.x);near(d.y,base.y);near(d.z,base.z);
  for(const h of [-.1,.1])for(const v of [-.08,.08])near(Math.hypot(...Object.values(coneDirection(base,h,v))),1);
 }
});
test('escopeta distribui pares opostos no cone; não existe viés horizontal/vertical fora da retícula',()=>{
 const offsets=pelletOffsets(8,.1,()=>.37);near(offsets.reduce((s,p)=>s+p.x,0),0);near(offsets.reduce((s,p)=>s+p.y,0),0);assert.equal(offsets.length,8);assert.ok(offsets.every(p=>Math.hypot(p.x,p.y)<.1));assert.ok(offsets.some(p=>Math.abs(p.y)>.02));
 const dirs=offsets.map(p=>coneDirection({x:0,y:0,z:1},p.x,p.y));near(dirs.reduce((s,p)=>s+p.x,0),0);near(dirs.reduce((s,p)=>s+p.y,0),0);
});
test('pistola/SMG têm dispersão limitada em torno do mesmo eixo 3D',()=>{
 for(let i=0;i<200;i++){const p=pelletOffsets(1,.03)[0];assert.ok(Math.hypot(p.x,p.y)<=.0300001);}
});
test('granada atinge pontos laterais/altos/baixos com integração independente do dt',()=>{
 const origin={x:.4,y:1.6,z:.7};
 for(const target of [{x:7,y:0,z:8},{x:-6,y:3,z:6},{x:2,y:1,z:10}])for(const fps of [30,60,144]){
  const a=grenadeArc(origin,target),p={...origin},v={...a};let elapsed=0;while(elapsed<a.time-1e-9){const dt=Math.min(1/fps,a.time-elapsed);advanceBallistic(p,v,dt,18);elapsed+=dt;}near(p.x,target.x);near(p.y,target.y);near(p.z,target.z);assert.ok(a.time<1.4);
 }
});
test('granada inalcançável preserva o rumo e limita alcance/altura antes do pavio',()=>{
 const a=grenadeArc({x:0,y:1.6,z:0},{x:80,y:80,z:40});assert.equal(a.clamped,true);near(a.target.x/a.target.z,2);assert.ok(a.time<=1.3);assert.ok(a.vy<=13.000001);
});
test('loop avalia câmera antes dos disparos, e tecla de granada só enfileira a ação',()=>{
 const s=readFileSync(new URL('../js/main.js',import.meta.url),'utf8');assert.ok(s.indexOf('updateCamera(cameraDt)')<s.indexOf('mouse.down || keys.Space'));assert.match(s,/code === 'KeyG'\) grenadeRequested=true/);assert.match(s,/!frameCameraReady && G.state/);
});
