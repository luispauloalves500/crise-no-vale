import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { restoreEncounterMemory } from '../js/encounter-memory.mjs';
import { findEscortPath, segmentClear } from '../js/escort-nav.mjs';
const read = f => readFileSync(new URL('../js/' + f, import.meta.url), 'utf8');
const director = read('director.js'), playerCode = read('player.js'), areaCode = read('areas.js');
const config = vm.runInNewContext(read('config.js').replaceAll('export ', '') + '\n({WEAPONS,PICKUPS,CAMERA,UPGRADES,INVENTORY,GRENADE,PLAYER})');
const run = (code, c) => { vm.createContext(c); vm.runInContext(code.replaceAll('export ', ''), c); return c; };
const areas = vm.runInNewContext(areaCode.slice(areaCode.indexOf('export const AREAS = [') + 'export const AREAS = '.length, areaCode.indexOf('\nexport const AREA =')), { Math });
class V {
  constructor(x=0,y=0,z=0) { this.set(x,y,z); }
  set(x,y,z) { Object.assign(this,{x,y,z}); return this; }
}
const damp = (a,b,k,dt) => b+(a-b)*Math.exp(-k*dt);
const ammoSection = playerCode.slice(playerCode.indexOf('function finiteAmmo('), playerCode.indexOf('export function switchWeapon('));
test('todas as armas iniciam finitas; saves antigos e inválidos viram reservas limitadas', () => {
  for (const w of config.WEAPONS) { assert.ok(Number.isFinite(w.startRes)); assert.ok(Number.isFinite(w.resMax)); }
  assert.equal(config.WEAPONS[0].startRes,72);
  const weapons = config.WEAPONS.map(w=>({...w,mag:w.size,res:Infinity}));
  const c = run(ammoSection, { WEAPONS:config.WEAPONS, weapons, bag:{up:{},meds:1,grenades:1},
    upLevel:()=>0, medMax:()=>4, grenadeMax:()=>5 });
  c.applyUpgrades(); assert.equal(weapons[0].res,72); assert.equal(weapons[1].res,6);
  for (const bad of [-1,Infinity,NaN,null,undefined]) assert.equal(c.finiteAmmo(bad,144,72),72);
  assert.equal(c.finiteAmmo(0,144,72),0); assert.equal(c.finiteAmmo(1000,144,72),144);
  Object.assign(c,{G:{},PLAYER:config.PLAYER,GRENADE:config.GRENADE,INVENTORY:config.INVENTORY, player:{},arms:{},showGun(){}});
  run(playerCode.slice(playerCode.indexOf('export function restoreBag('),playerCode.indexOf('export function resetPlayer(')),c);
  c.restoreBag({owned:[true,true,true],cur:2,ammo:[{mag:99,res:-1},{mag:-3,res:Infinity},{mag:NaN,res:null}]});
  assert.equal(weapons[0].mag,12); assert.equal(weapons[0].res,72);
  assert.equal(weapons[1].mag,6); assert.equal(weapons[1].res,6);
  assert.equal(weapons[2].mag,30); assert.equal(weapons[2].res,0);
  c.restoreBag({ammo:[{mag:0,res:0}]}); assert.equal(weapons[0].res,0);
});
test('a recarga debita a reserva finita e não inventa balas',()=>{
  const w={size:12,mag:1,res:2}, c=run(playerCode.slice(playerCode.indexOf('function updateWeapons('),playerCode.indexOf('/** Efeito visual do disparo')),{
    arms:{cool:0,reloading:.01,flashT:0},curWeapon:()=>w,sfx:{reloadEnd(){}},flash:{},star:{},flashLight:{intensity:0}
  });
  c.updateWeapons(.02);assert.equal(w.mag,3);assert.equal(w.res,0);
});
test('caixas antigas, caixas de suprimentos e drops abastecem a pistola sem exceder o teto',()=>{
  const weapons=config.WEAPONS.map(w=>({...w,mag:0,res:0}));
  const c=run(read('combat.js').slice(read('combat.js').indexOf('function tryCollect('),read('combat.js').indexOf('function updatePickups(')),{
    weapons,bag:{owned:[true,true,false],meds:4,grenades:5},resMax:i=>weapons[i].resMax,
    PICKUPS:config.PICKUPS,PLAYER:config.PLAYER,player:{hp:100},medMax:()=>4,grenadeMax:()=>5,
    ui:{feed(){},STR:{ammo:n=>String(n)}},burst(){},Math
  });
  assert.equal(c.tryCollect({kind:'ammo'}),true);assert.equal(weapons[0].res,24);assert.equal(weapons[1].res,6);
  c.tryCollect({kind:'crate',x:0,z:0});assert.equal(weapons[0].res,60);
  weapons[0].res=140;c.tryCollect({kind:'pistolammo'});assert.equal(weapons[0].res,144);
  assert.equal(c.tryCollect({kind:'pistolammo'}),false);
  assert.match(read('combat.js'),/spawnPickup\('pistolammo', e.pos.x, e.pos.z\)/);
});
test('todas as áreas renovam patrulhas em múltiplos retornos sem duplicar itens ou chefes vencidos',()=>{
  for(const a of areas){
    const state={visited:true,dead:a.ambient.map((_,i)=>i),taken:['already'],living:[],pending:[]};
    const spawned=[],picked=[],F={bossDead:true,nestClear:true,primDead:true};
    const c=run(director.slice(director.indexOf('function spawnAreaContents('),director.indexOf('function setupSurvivor(')),{
      D:{st:{[a.id]:state}},F,restoreEncounterMemory,ENEMY_TYPES:{raptor:{r:.75},spitter:{r:.75},brute:{r:1.7},colossus:{boss:true,r:2.6}},
      player:{pos:{x:0,z:0}},freeSpot:()=>true,rearmPendingWarnings:q=>q,
      spawnEnemy(type,x,z,opts){const e={type,cfg:{},maxHp:55,hp:55,home:{x:x??15,z:z??15}};spawned.push(e);return e;},
      spawnPickup(...args){picked.push(args);}
    });
    for(let i=0;i<3;i++){
      spawned.length=0;picked.length=0;
      c.spawnAreaContents({...a,pickups:[{id:'already',kind:'ammo',x:1,z:1}]},true);
      assert.equal(spawned.length,a.ambient.length,a.id);assert.ok(spawned.length>0,a.id);
      assert.equal(picked.length,0);assert.deepEqual(state.taken,['already']);
      assert.equal(state.visited,true);assert.equal(F.bossDead,true);
    }
  }
});
test('chefe em andamento mantém vida, mas patrulhas voltam inteiras e longe da chegada',()=>{
  const alive={type:'colossus',x:20,z:20,hp:700};
  const s={taken:[],dead:[0],living:[alive],pending:[]}, spawned=[];
  const c=run(director.slice(director.indexOf('function spawnAreaContents('),director.indexOf('function setupSurvivor(')),{
    D:{st:{a:s}},F:{},restoreEncounterMemory,ENEMY_TYPES:{raptor:{r:.75},colossus:{boss:true,r:2.6}},
    player:{pos:{x:1,z:1}},freeSpot:()=>true,rearmPendingWarnings:q=>q,
    spawnEnemy(type,x,z){const e={type,cfg:{boss:type==='colossus'},x,z,maxHp:type==='raptor'?55:1600,home:{x:x??20,z:z??20}};spawned.push(e);return e;},spawnPickup(){}
  });
  c.spawnAreaContents({id:'a',ambient:[{type:'raptor',x:1,z:1}],pickups:[]},true);
  assert.equal(spawned[0].x,undefined);assert.equal(spawned[0].hp,55);assert.equal(spawned[1].hp,700);
});
test('câmera real nasce atrás do spawn nos quatro sentidos, com colisão instantânea e mira zerada',()=>{
  const c=run(playerCode.slice(playerCode.indexOf('const pivot = new THREE.Vector3'),playerCode.indexOf('/** Câmera do menu')),{
    THREE:{Vector3:V},CAMERA:config.CAMERA,G:{yaw:0,pitch:-.12,shoulder:1,aiming:false,shake:0,time:0},
    player:{pos:{x:0,z:0}},bounds:{minX:-10,maxX:10,minZ:-10,maxZ:10},hero:{},camera:{position:new V(999,999,999),fov:90,lookAt(v){this.look={...v}},updateProjectionMatrix(){}},
    castWorld:()=>Infinity, motionK:()=>1,damp,clamp:(x,a,b)=>Math.max(a,Math.min(b,x)),torchT:{position:new V()}
  });
  for(const [x,z,yaw] of [[0,-6.2,0],[0,6.2,Math.PI],[-6.2,0,Math.PI/2],[6.2,0,-Math.PI/2]]){
    c.player.pos={x,z};c.G.yaw=yaw;c.snapCamera();
    const p=c.camera.position,b=c.bounds,fx=Math.sin(yaw),fz=Math.cos(yaw);
    assert.ok((p.x-x)*fx+(p.z-z)*fz<0);assert.ok(p.x>b.minX&&p.x<b.maxX&&p.z>b.minZ&&p.z<b.maxZ);
    assert.ok((c.camera.look.x-p.x)*fx+(c.camera.look.z-p.z)*fz>0);
    assert.equal(c.camera.fov,config.CAMERA.FOV);
  }
  c.castWorld=()=>.5;c.updateCamera(.001);
  assert.ok(Math.hypot(c.camera.position.x-c.player.pos.x,c.camera.position.z-c.player.pos.z)<.3);
  const place=playerCode.slice(playerCode.indexOf('export function placePlayer('),playerCode.indexOf('export function snapshotBag('));
  assert.match(place,/G.aiming = false/);assert.match(place,/snapCamera\(\)/);
});
function boardingHarness() {
  const h=areas.find(a=>a.id==='heliponto').helipad;
  const group={position:new V(),rotation:new V(),visible:false},heli={group,rotor:{rotation:new V()},tailRotor:{rotation:new V()},nav:[],boardingDoor:{position:new V(1.38,1.4,-1.6)}};
  const area={id:'heliponto',helipad:h,bounds:{minX:-24,maxX:24,minZ:-30,maxZ:22},ctx:{boxes:[],circles:[]},refs:{heli}};
  const samples=[],entered=[],phases=new Set(),D={area,heli:{t:0,chopT:0},event:null,trans:null};
  const c=run(director.slice(director.indexOf('function startBoarding('),director.indexOf('/** Atalho de depuração')),{
    D,F:{rescued:true},G:{yaw:0,transitioning:false,shake:0},player:{r:.5,pos:{x:h.x,z:h.z}},pg:{position:new V(h.x,0,h.z),visible:true},
    findEscortPath,clearInput(){},story:{clearSpeech(){}},ui:{feed(){},setFade(){}},spots:[{}],sfx:{heli(){}},castWorld:()=>Infinity,
    animateBoarding(dt,p,yaw,crouch){samples.push({...p,yaw,crouch});c.pg.position.set(p.x,p.y,p.z);c.pg.visible=true;},
    enterArea(id){entered.push(id);c.F.act2=true;},streamAround(){},Math
  });
  return {c,D,heli,samples,entered,phases,h};
}
test('embarque percorre chão, espera pousar, sobe pela porta e chega ao Ato 2 uma única vez',()=>{
  const {c,D,heli,samples,entered,phases,h}=boardingHarness();c.startBoarding();
  for(let i=0;i<1000&&D.trans;i++){
    phases.add(D.trans.phase);
    if(D.trans.phase==='walk-door')assert.equal(D.heli.land,1);
    c.updateBoarding(.05);
  }
  assert.equal(D.trans,null);assert.deepEqual(entered,['margem']);assert.equal(c.F.act1Rescued,true);assert.equal(c.F.rescued,false);assert.equal(c.F.act2,true);
  assert.deepEqual([...phases],['clear-pad','land','walk-door','step-in','takeoff']);
  for(let i=1;i<samples.length;i++){
    assert.ok(Math.hypot(samples[i].x-samples[i-1].x,samples[i].z-samples[i-1].z)<.15,'não há teleporte visível');
    assert.ok(samples[i].y>=0&&samples[i].y<=.551);
  }
  assert.ok(samples.some(p=>p.y>.5&&p.crouch>.9));assert.equal(heli.boardingDoor.position.z,.25);
  assert.ok(heli.group.position.y>=9.9);assert.equal(c.G.transitioning,false);
  assert.ok(samples.some(p=>Math.hypot(p.x-h.x,p.z-h.z)>6),'aguarda fora do rotor antes do pouso');
});
test('percurso de embarque usa navegação com obstáculos e falha sem prender o jogo',()=>{
  const {c,D}=boardingHarness();D.area.ctx.boxes=[{minX:2,maxX:3,minZ:-20,maxZ:-17}];c.startBoarding();
  let from=c.player.pos;for(const p of D.trans.route){assert.ok(segmentClear(from,p,{bounds:D.area.bounds,boxes:D.area.ctx.boxes,circles:[]},.5));from=p;}
  const h2=boardingHarness();h2.c.findEscortPath=()=>[];h2.c.startBoarding();assert.equal(h2.D.trans,null);assert.equal(h2.c.F.rescued,false);assert.equal(h2.c.G.transitioning,false);
});
test('cais separa heliponto do portão norte e agrupa pintura/balizadores em um lote',()=>{
  const a=areas.find(a=>a.id==='porto'), h=a.quayPad;
  assert.ok(h.z>10&&h.x>10);assert.ok(h.r>=5.6);assert.ok(h.x+h.r<a.bounds.maxX&&h.z+h.r<a.bounds.maxZ);
  const meshes=[],parts=[];
  class Geo {dispose(){}}
  const c=run(areaCode.slice(areaCode.indexOf('function quayHelipad('),areaCode.indexOf('// Porta e estribo leves:')),{
    THREE:{RingGeometry:Geo,BoxGeometry:Geo,Mesh:class{constructor(geo,material){Object.assign(this,{geo,material});}},MeshBasicMaterial:class{}},
    mergeGeos:p=>{parts.push(...p);return {}} , Math
  });
  c.quayHelipad({group:{add:m=>meshes.push(m)}},h);assert.equal(meshes.length,1);assert.equal(parts.length,12);
  const pad=areas.find(a=>a.id==='heliponto').helipad;assert.ok(pad.r>=5.6);assert.ok(pad.z-6.6>-30);
  assert.match(areaCode,/W.lamp\(ctx, 0, -28.5/); // poste fora do rotor e da fuselagem
});
