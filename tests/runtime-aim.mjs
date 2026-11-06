// Projeção/raycast Three r160 reais + combat.js real em VM; sem DOM/WebGL/áudio.
// node --experimental-vm-modules tests/runtime-aim.mjs
import assert from 'node:assert/strict';import vm from 'node:vm';import {readFile,writeFile} from 'node:fs/promises';import * as THREE from 'three';
import {createAimSolver} from '../js/aiming.js';import * as math from '../js/aim-math.mjs';import * as config from '../js/config.js';import * as dimensions from '../js/dino-dimensions.mjs';import * as rules from '../js/campaign-rules.mjs';import * as budget from '../js/effect-budget.mjs';
let projectionCases=0,enemyCases=0,weaponCases=0,grenadeCases=0,maxProjectionError=0;const close=(a,b,tolerance=1e-6)=>assert.ok(Math.abs(a-b)<tolerance,`${a} != ${b}`);
const material=new THREE.MeshBasicMaterial({side:THREE.DoubleSide});
function setup(ndc={x:0,y:0},fov=65,aspect=16/9){const camera=new THREE.PerspectiveCamera(fov,aspect,.1,200);camera.position.set(.75,2.5,-4);camera.lookAt(0,1.4,12);camera.updateMatrixWorld(true);const root=new THREE.Group(),enemies=[],boxes=[],circles=[],muzzle=new THREE.Vector3(-.35,1.5,.8),world={root};const solver=createAimSolver({camera,enemies,boxes,circles,worldRoot:()=>world.root,reticleNDC:()=>ndc});return {camera,root,enemies,boxes,circles,muzzle,solver,world,ndc};}
function wallAtRay(s,distance=22){const ray=new THREE.Raycaster();ray.setFromCamera(s.ndc,s.camera);const p=ray.ray.at(distance,new THREE.Vector3()),wall=new THREE.Mesh(new THREE.PlaneGeometry(100,100),material);wall.position.copy(p);wall.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),ray.ray.direction.clone().negate());s.root.add(wall);return p;}
for(const fov of [46,65])for(const aspect of [16/9,9/16,2.2])for(const ndc of [{x:0,y:0},{x:.38,y:.27},{x:-.42,y:.31},{x:.3,y:-.37},{x:-.23,y:-.26}]){
 const s=setup(ndc,fov,aspect),p=wallAtRay(s),aim=s.solver.aim(s.muzzle,45),shot=s.solver.shot(s.muzzle,aim,45),screen=shot.point.clone().project(s.camera),error=Math.hypot(screen.x-ndc.x,screen.y-ndc.y);
 assert.ok(aim.point.distanceTo(p)<1e-5);assert.ok(shot.point.distanceTo(p)<1e-5,JSON.stringify({fov,aspect,ndc,p:p.toArray(),aim:aim.point.toArray(),shot:shot.point.toArray(),kind:shot.kind,d:shot.direction.toArray()}));assert.ok(error<1e-7,'tiro fora da retícula');maxProjectionError=Math.max(maxProjectionError,error);projectionCases++;
}
// Prova da altura real: mirar no céu NÃO acerta o dino no XZ por baixo da retícula.
{
 const s=setup(),cfg=config.ENEMY_TYPES.raptor,e={cfg,pos:new THREE.Vector3(0,0,12),yaw:.5};s.enemies.push(e);
 assert.equal(s.solver.cast(new THREE.Vector3(0,1.2,0),new THREE.Vector3(0,0,1),40).e,e);
 assert.equal(s.solver.cast(new THREE.Vector3(0,5,0),new THREE.Vector3(0,0,1),40).e,null);
 e.dead=true;assert.equal(s.solver.cast(new THREE.Vector3(0,1.2,0),new THREE.Vector3(0,0,1),40).e,null);enemyCases+=3;
}
// Parede baixa passa por baixo de um tiro alto; cano bloqueado impede atravessar cobertura.
{
 const s=setup();wallAtRay(s);const aim=s.solver.aim(s.muzzle,45),p=s.muzzle.clone().addScaledVector(aim.direction,1);
 s.boxes.push({minX:p.x-.15,maxX:p.x+.15,minY:p.y-.15,h:p.y+.15,minZ:p.z-.15,maxZ:p.z+.15});
 const cameraAim=s.solver.aim(s.muzzle,45);assert.ok(cameraAim.point.distanceTo(aim.point)<1e-6);assert.equal(s.solver.shot(s.muzzle,cameraAim,45).kind,'world');assert.ok(s.solver.shot(s.muzzle,cameraAim,45).t<1.3);projectionCases++;
}
// Só mundo ativo/visível: grass/FX/área oculta não interceptam; porta movida é lida de novo.
{
 const s=setup(),wall=new THREE.Mesh(new THREE.BoxGeometry(8,8,.2),material);wall.position.set(0,1,8);s.root.add(wall);
 const hidden=new THREE.Mesh(new THREE.BoxGeometry(8,8,.2),material);hidden.position.z=2;hidden.visible=false;s.root.add(hidden);
 const grass=hidden.clone();grass.visible=true;grass.userData.grassChunk=true;s.root.add(grass);
 const fx=hidden.clone();fx.visible=true;fx.material=new THREE.MeshBasicMaterial({transparent:true,opacity:.8,depthWrite:false});s.root.add(fx);
 let h=s.solver.cast(new THREE.Vector3(0,1,0),new THREE.Vector3(0,0,1),30);close(h.t,7.9);wall.position.y=20;h=s.solver.cast(new THREE.Vector3(0,1,0),new THREE.Vector3(0,0,1),30);assert.equal(h.kind,'range');projectionCases++;
}
// Alcance é medido a partir do cano, não se estende pelo recuo da câmera.
{
 const s=setup({x:.23,y:.12});wallAtRay(s,35);const aim=s.solver.aim(s.muzzle,12),hit=s.solver.shot(s.muzzle,aim,12);assert.equal(hit.kind,'range');close(hit.t,12);close(hit.point.distanceTo(s.muzzle),12);projectionCases++;
}
// Normais de instâncias consideram também a matriz local (ricochetes em superfícies giradas).
{
 const s=setup(),mesh=new THREE.InstancedMesh(new THREE.BoxGeometry(5,4,.2),material,1),m=new THREE.Matrix4().makeRotationY(.4);m.setPosition(0,1,8);mesh.setMatrixAt(0,m);s.root.add(mesh);
 const h=s.solver.cast(new THREE.Vector3(0,1,0),new THREE.Vector3(0,0,1),30);assert.equal(h.object,mesh);close(h.normal.length(),1);assert.ok(Math.abs(h.normal.x)>.2&&h.normal.z<-.5);projectionCases++;
}
// combat.js de verdade: traço/impacto/dano compartilham o MESMO raio da origem do cano.
const viewport={left:120,top:60,width:1000,height:650},rect={left:0,top:0,width:0,height:0};let s=setup(),selected=0;
const scene=new THREE.Scene(),camera=s.camera,world={root:new THREE.Group()},enemies=[],boxes=[],circles=[],traces=[],impacts=[],explosions=[],gunTip=new THREE.Object3D();gunTip.position.copy(s.muzzle);
const G={state:'play',yaw:1.5,pitch:-.5,aiming:true,shots:0,hits:0,shake:0,combo:0,comboT:0,hitstopCd:0,ep:0},player={pos:new THREE.Vector3(),dead:false,moving:false,running:false,vx:8,vz:-5,r:.5,hp:100};
const weapons=config.WEAPONS.map(w=>({...w,mag:30,res:100,spread:0,aimSpread:0,bloom:0})),arms={cool:0,reloading:0},bag={owned:[true,true,true],grenades:30,armor:0},noop=()=>{};
const ui={STR:{noShells:'sem munição'},feed:noop,floater:noop,hitMarker:noop,kickCrosshair:noop,setCrossEnemy:noop,setCrossGap:noop,getReticleNDC:()=>math.reticleToNDC(rect,viewport)};
const functions=['burst','tracer','decal','explosion','flourish','bloodBurst','impactFx','muzzleFx'];const fx=Object.fromEntries(functions.map(k=>[k,noop]));fx.tracer=(a,b)=>traces.push({from:a.clone(),to:b.clone()});fx.impactFx=(x,y,z,dx,dz,kind)=>impacts.push({point:new THREE.Vector3(x,y,z),kind});fx.explosion=(x,z)=>explosions.push({x,z});
const sound=new Proxy({},{get:()=>noop}),worldValues={scene,camera,renderer:{domElement:{getBoundingClientRect:()=>viewport}},boxes,circles,combatWorld:world,castWorld:()=>Infinity,GLOW:new THREE.Texture()};
const sources={'three':THREE,'./dino-dimensions.mjs':dimensions,'./campaign-rules.mjs':rules,'./world.js':worldValues,'./config.js':config,'./aiming.js':{createAimSolver},'./aim-math.mjs':math,'./quality.js':{quality:{id:'alto'}},'./effect-budget.mjs':budget,'./settings.js':{SETTINGS:{reducedMotion:true}},'./state.js':{G,addEp:()=>0},'./clean-streak.mjs':{recordKill:noop},'./player.js':{player,weapons,arms,bag,curWeapon:()=>weapons[selected],startReload:noop,muzzleFlash:noop,gunTip,heal:noop,switchWeapon:noop,hurtPlayer:noop,medMax:()=>4,grenadeMax:()=>5,resMax:()=>100},'./enemies.js':{enemies,enemyEvents:{},makeNoise:noop},'./audio.js':{sfx:sound,roar:noop},'./fx.js':fx,'./ui.js':ui};
const context=vm.createContext({console,Math,innerHeight:viewport.height}),mod=new vm.SourceTextModule(await readFile(new URL('../js/combat.js',import.meta.url),'utf8')+'\nexport {grenades,updateGrenades};',{context});await mod.link(async spec=>{const values=sources[spec];assert.ok(values,spec);return new vm.SyntheticModule(Object.keys(values),function(){for(const[k,v]of Object.entries(values))this.setExport(k,v)},{context});});await mod.evaluate();const api=mod.namespace;
function setNDC(ndc){rect.left=viewport.left+(ndc.x+1)/2*viewport.width;rect.top=viewport.top+(1-ndc.y)/2*viewport.height;}
function resetWorld(){world.root=new THREE.Group();boxes.length=circles.length=enemies.length=traces.length=impacts.length=0;arms.cool=arms.reloading=0;api.resetCombat();}
for(selected=0;selected<3;selected++)for(const ndc of [{x:0,y:0},{x:.29,y:.22},{x:-.33,y:-.29}]){
 resetWorld();setNDC(ndc);const q={...s,root:world.root,ndc},expected=wallAtRay(q,18);api.fire();const count=Array.from({length:weapons[selected].pellets},(_,i)=>budget.showPelletVisual(i,weapons[selected].pellets,'alto')).filter(Boolean).length;assert.equal(traces.length,count);for(const trace of traces){assert.ok(trace.from.distanceTo(gunTip.position)<1e-8);assert.ok(trace.to.distanceTo(expected)<1e-5);const p=trace.to.clone().project(camera);close(p.x,ndc.x);close(p.y,ndc.y);}assert.equal(impacts.length,count);weaponCases++;
}
for(selected=0;selected<3;selected++)for(const ndc of [{x:.22,y:.12},{x:-.26,y:-.18}]){
 resetWorld();setNDC(ndc);const ray=new THREE.Raycaster();ray.setFromCamera(ndc,camera);const p=ray.ray.at(14,new THREE.Vector3()),cfg=config.ENEMY_TYPES.raptor,dim=dimensions.dinoDimensions(cfg),enemy={cfg,pos:new THREE.Vector3(p.x,p.y-dim.height*.55,p.z-dim.centerZ),yaw:0,hp:10000,dead:false,stun:0,kx:0,kz:0};enemies.push(enemy);
 const aim=api.aimRay(),old=enemy.hp;api.fire();assert.ok(enemy.hp<old);assert.ok(traces.length>0);assert.ok(impacts.some(i=>i.kind==='flesh'));for(const trace of traces){const direction=trace.to.clone().sub(trace.from).normalize();assert.ok(direction.distanceTo(aim.direction)<1e-6);assert.ok(impacts.some(i=>i.point.distanceTo(trace.to)<1e-6));}weaponCases++;enemyCases++;
}
// Cone real de escopeta (com dispersão) permanece centrado até no subconjunto de tracers.
selected=1;resetWorld();setNDC({x:.27,y:.17});wallAtRay({...s,root:world.root,ndc:{x:.27,y:.17}},20);weapons[1].aimSpread=config.WEAPONS[1].aimSpread;
{const aim=api.aimRay();api.fire();const mean=traces.reduce((sum,t)=>sum.add(t.to.clone().sub(t.from).normalize()),new THREE.Vector3()).normalize();assert.ok(mean.distanceTo(aim.direction)<1e-7);assert.ok(traces.some(t=>Math.abs(t.to.clone().project(camera).y-.17)>.01));weaponCases++;}
weapons[1].aimSpread=0;
// Céu não causa dano 2D ao inimigo por baixo da retícula; cobertura do cano prevalece.
selected=0;resetWorld();setNDC({x:0,y:.75});
{const cfg=config.ENEMY_TYPES.raptor,e={cfg,pos:new THREE.Vector3(0,0,12),yaw:0,hp:10000,dead:false,stun:0,kx:0,kz:0};enemies.push(e);api.fire();assert.equal(e.hp,10000);assert.ok(traces[0].to.y>dimensions.dinoDimensions(cfg).height);weaponCases++;}
resetWorld();setNDC({x:0,y:0});
{const ray=new THREE.Raycaster();ray.setFromCamera({x:0,y:0},camera);const p=ray.ray.at(14,new THREE.Vector3()),cfg=config.ENEMY_TYPES.raptor,dim=dimensions.dinoDimensions(cfg),e={cfg,pos:new THREE.Vector3(p.x,p.y-dim.height*.55,p.z-dim.centerZ),yaw:0,hp:10000,dead:false,stun:0,kx:0,kz:0};enemies.push(e);const aim=api.aimRay(),cover=gunTip.position.clone().addScaledVector(aim.direction,1);boxes.push({minX:cover.x-.15,maxX:cover.x+.15,minY:cover.y-.15,h:cover.y+.15,minZ:cover.z-.15,maxZ:cover.z+.15});api.fire();assert.equal(e.hp,10000);assert.ok(traces[0].from.distanceTo(traces[0].to)<1.3);weaponCases++;}
// Granadas fora do centro: arco até o mesmo alvo, sem deriva da velocidade lateral do jogador.
for(const ndc of [{x:.23,y:-.15},{x:-.28,y:.08}]){
 resetWorld();setNDC(ndc);wallAtRay({...s,root:world.root,ndc},13);api.throwGrenade();assert.equal(api.grenades.length,1);const g=api.grenades[0],p=g.p.clone(),velocity={vx:g.vx,vy:g.vy,vz:g.vz};let t=0;while(t<g.time-1e-9){const dt=Math.min(1/60,g.time-t);math.advanceBallistic(p,velocity,dt,config.GRENADE.GRAV);t+=dt;}assert.ok(p.distanceTo(new THREE.Vector3(g.target.x,g.target.y,g.target.z))<1e-6);const aim=api.aimRay(config.GRENADE.SPEED*(config.GRENADE.FUSE-.1));assert.ok(Math.abs(math.directionTo(g.p,g.target).x-math.directionTo(g.p,aim.point).x)<.005);grenadeCases++;
}
// Integração REAL das granadas: paredes e tetos altos bloqueiam o arco, não só o chão 2D.
{
 resetWorld();const wall=new THREE.Mesh(new THREE.BoxGeometry(4,6,.2),material);wall.position.set(0,6,2.1);world.root.add(wall);
 const g={p:new THREE.Vector3(0,4,0),vx:0,vy:0,vz:12,fuse:1.4,m:new THREE.Object3D(),blink:new THREE.Sprite(new THREE.SpriteMaterial())};api.grenades.push(g);
 for(let i=0;i<10;i++)api.updateGrenades(.025);assert.ok(g.vz<0&&g.p.z<2&&g.p.y>3,'parede acima de 2,2 m deve bloquear');grenadeCases++;
}
{
 resetWorld();const roof=new THREE.Mesh(new THREE.BoxGeometry(8,.2,8),material);roof.position.set(0,4.4,1);world.root.add(roof);
 const g={p:new THREE.Vector3(0,3,0),vx:0,vy:9,vz:3,fuse:1.4,m:new THREE.Object3D(),blink:new THREE.Sprite(new THREE.SpriteMaterial())};api.grenades.push(g);
 for(let i=0;i<13;i++){api.updateGrenades(.025);assert.ok(g.p.y<4.3);}assert.ok(g.vy<0,'teto deve inverter a subida');grenadeCases++;
}
const report={three:THREE.REVISION,projectionCases,enemyCases,weaponCases,grenadeCases,maxProjectionError,realCombatModule:true,actualReticleOffsets:true,worldGeometryRaycast:true,muzzleOcclusion:true,webGL:false};console.log(JSON.stringify(report,null,2));if(process.env.AIM_AUDIT_OUTPUT)await writeFile(process.env.AIM_AUDIT_OUTPUT,JSON.stringify(report,null,2)+'\n');
