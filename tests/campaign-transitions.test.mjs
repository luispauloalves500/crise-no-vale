import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { restoreEncounterMemory } from '../js/encounter-memory.mjs';
import { ammoAmount, patrolComposition } from '../js/campaign-rules.mjs';
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
    ammoAmount,G:{difficulty:'normal'},PICKUPS:config.PICKUPS,PLAYER:config.PLAYER,player:{hp:100},medMax:()=>4,grenadeMax:()=>5,
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
      G:{difficulty:'normal'},patrolComposition,D:{st:{[a.id]:state}},F,restoreEncounterMemory,ENEMY_TYPES:{raptor:{r:.75},spitter:{r:.75},brute:{r:1.7},colossus:{boss:true,r:2.6}},
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
    G:{difficulty:'normal'},patrolComposition,D:{st:{a:s}},F:{},restoreEncounterMemory,ENEMY_TYPES:{raptor:{r:.75},colossus:{boss:true,r:2.6}},
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
test('helicóptero do Ato 1 não transporta a heroína para a margem',()=>{
  assert.equal(director.includes('function startBoarding('), false);
  assert.match(director, /a.id === 'porto' && F.heliCode && !F.limaRescued/);
  assert.match(director, /npcBoard/);
  const cliff=areas.find(a=>a.id==='heliponto');
  assert.equal(cliff.doors.find(d=>d.to==='margem').side,'N');
  assert.equal(areas.find(a=>a.id==='porto').doors[0].to,'ruinas');
});
test('final só acontece ao voltar à extração depois da decisão e do Primórdio',()=>{
  const finish=director.slice(director.indexOf('function finishAct3('),director.indexOf('/** Monta o objeto'));
  assert.equal(finish.includes('onWin()'),false);
  assert.match(director,/it.kind === 'finalEvac' && canFinishCampaign\(F\)/);
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
