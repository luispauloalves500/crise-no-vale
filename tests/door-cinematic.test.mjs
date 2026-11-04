import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {doorPose, doorVectors, DOOR_TIMING, gateVisible} from '../js/door-cinematic.mjs';
import {GUN_ASSETS} from '../js/gun-layout.mjs';

test('porta abre, personagem atravessa, porta fecha e só troca quando destino estiver pronto',()=>{
  assert.equal(gateVisible(false),false);assert.equal(gateVisible(true),true);assert.equal(gateVisible(false,true),true);
  assert.deepEqual(doorPose(0,false),{gate:0,travel:0,moving:false,fade:0,switchArea:false});
  assert.equal(doorPose(DOOR_TIMING.open,false).gate,1);
  const middle=doorPose(1.7,false);assert.ok(middle.moving && middle.travel>0 && middle.travel<1);
  assert.equal(doorPose(DOOR_TIMING.walkEnd,false).travel,1);
  assert.equal(doorPose(DOOR_TIMING.closeEnd,false).gate,0);
  assert.equal(doorPose(20,false).switchArea,false);assert.equal(doorPose(20,false).fade,0);
  assert.equal(doorPose(DOOR_TIMING.closeEnd+DOOR_TIMING.fade,true).switchArea,true);
  for(const [side,v] of Object.entries({N:[0,-1],S:[0,1],W:[-1,0],E:[1,0]})){
    const d=doorVectors(side);assert.deepEqual([d.x,d.z],v);assert.ok(Math.abs(Math.sin(d.yaw)-d.x)<1e-9);assert.ok(Math.abs(Math.cos(d.yaw)-d.z)<1e-9);
  }
});
function harness({fail=false,slow=false}={}) {
  const code=readFileSync(new URL('../js/director.js',import.meta.url),'utf8');
  const section=code.slice(code.indexOf('function startTransition(door)'),code.indexOf('// ---------- streaming de áreas')).replace('export function skipPassage()', 'function skipPassage()');
  let prepared=false,enters=0,bonuses=0,callbacks=[],timeouts=[],feed=[];
  const ref={group:{position:{x:0,z:-20}},gate:{position:{y:0}}};
  const dest={id:'ruinas'},door={id:'N',side:'N',to:'ruinas',toDoor:'S'};
  const pg={position:{x:0,z:-16,set(x,y,z){Object.assign(this,{x,y,z})}},rotation:{y:0},visible:true};
  const D={area:{id:'porto',refs:{doors:{N:ref}}},st:{ruinas:{visited:false}},trans:null};
  const c={D,AREA:{ruinas:dest},player:{r:.5,inv:0},pg,G:{state:'play',yaw:0,transitioning:false,cleanStreak:{}},WORLD:{FADE:.4,DOOR_DEPTH:1.6},doorPose,doorVectors,DOOR_TIMING,gateVisible,
    story:{S:{said:new Set()},clearSpeech(){}},passageFor:()=>null,advancePassage:()=>{},clearInput(){},
    sfx:{doorOpen(){},doorClose(){}}, ui:{setFade(){},feed(t){feed.push(t)},hidePassage(){},showPassage(){}},
    requestAnimationFrame(fn){callbacks.push(fn)},setTimeout(fn,delay){if (delay===2500) timeouts.push(fn); else fn()},isBuilt(){return prepared},buildArea(){prepared=true;return 1},streamStats:{syncBuilds:0},
    shaderWarmup:{request(){return slow ? new Promise(()=>{}) : Promise.resolve(true)}}, safeDoorArrival(){return fail?null:{x:0,z:16,yaw:Math.PI}}, animateDoorWalk(dt,p,yaw){pg.position.set(p.x,0,p.z);pg.rotation.y=yaw},
    enterArea(){enters++;D.area=dest},finishStreak(){return {bonus:100,kills:3}},addEp(){bonuses++},streamAround(){},console:{error(){}}};
  vm.createContext(c);vm.runInContext(section,c);
  return {c,D,ref,door,runJobs(){for(const f of callbacks.splice(0))f()},runTimeout(){for(const f of timeouts.splice(0))f()},get enters(){return enters},get bonuses(){return bonuses},feed};
}
test('diretor prepara após começar, troca e paga sequência uma única vez',async()=>{
  const h=harness();h.c.startTransition(h.door);assert.ok(h.D.trans);assert.equal(h.ref.gate.visible,true);assert.equal(h.enters,0);
  h.c.updateTransition(.2);assert.ok(h.ref.gate.position.y>0);assert.equal(h.D.trans.ready,false);
  h.runJobs();await Promise.resolve();assert.equal(h.D.trans.ready,true);
  for(let i=0;i<100&&h.D.trans;i++)h.c.updateTransition(.05);
  assert.equal(h.enters,1);assert.equal(h.bonuses,1);assert.equal(h.D.trans,null);assert.equal(h.c.G.transitioning,false);
});
test('compilação lenta não impede passagem após limite de espera',()=>{
  const h=harness({slow:true});h.c.startTransition(h.door);h.c.updateTransition(.2);h.runJobs();
  for(let i=0;i<90;i++)h.c.updateTransition(.05);
  assert.equal(h.enters,0);assert.equal(h.D.trans.ready,false);h.runTimeout();
  for(let i=0;i<20&&h.D.trans;i++)h.c.updateTransition(.05);
  assert.equal(h.enters,1);assert.equal(h.bonuses,1);
});
test('destino inacessível cancela, fecha portão e restaura personagem',()=>{
  const h=harness({fail:true});h.c.startTransition(h.door);h.c.updateTransition(.2);h.runJobs();h.c.updateTransition(.05);
  assert.equal(h.D.trans,null);assert.equal(h.ref.gate.position.y,0);assert.equal(h.ref.gate.visible,false);assert.equal(h.c.pg.position.z,-16);assert.equal(h.enters,0);assert.ok(h.feed.length);
});
test('Glock usa cano negativo X e empunhadura próxima do soquete',()=>{
  const s=GUN_ASSETS[0], centerX=(-.950776994+.948599994)/2,centerY=(-.72637397+.724687994)/2,scale=s.length/(.948599994+.950776994);
  const y=s.pos[1]+.17+(s.gripSource[1]-centerY)*scale;
  const z=s.pos[2]-.48-(s.gripSource[0]-centerX)*scale;
  assert.equal(s.rotationY,Math.PI/2);assert.ok(Math.hypot(y,z)*.55<.003);
  assert.ok(Math.abs(s.tip-(s.pos[2]+s.length/2))<.002);
});
