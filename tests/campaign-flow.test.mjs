// Integração do diretor real em Node/VM: sem renderer, IA ou entrada humana.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import * as rules from '../js/campaign-rules.mjs';
import { captureEncounterMemory, restoreEncounterMemory } from '../js/encounter-memory.mjs';
import { normalizeStreak, finishStreak } from '../js/clean-streak.mjs';
import { safeDoorArrival, validateDoorGraph } from '../js/door-safety.mjs';
import { passageFor, advancePassage } from '../js/passage-scenes.mjs';
import { doorPose, doorVectors, DOOR_TIMING, gateVisible } from '../js/door-cinematic.mjs';
import { canTriggerRevisit, scheduleRevisit, rearmPendingWarnings } from '../js/revisit-encounters.mjs';
const read = f => readFileSync(new URL('../js/' + f, import.meta.url), 'utf8');
const areaSource = read('areas.js'), director = read('director.js');
function areaData() {
  return vm.runInNewContext(areaSource.slice(areaSource.indexOf('export const AREAS = [') + 'export const AREAS = '.length, areaSource.indexOf('\nexport const AREA =')), { Math });
}
const config = vm.runInNewContext(read('config.js').replaceAll('export ', '') + '\n({WORLD,SCORE,PLAYER,EP,ENEMY_TYPES,WEAPONS})');
const noop = () => {};
const proxy = new Proxy({}, { get: () => noop });
function harness(difficulty = 'normal') {
  const AREAS = areaData(), AREA = Object.fromEntries(AREAS.map(a => [a.id, a]));
  const storage = {}, idleJobs = [], cards = [], messages = [], wins = [], sounds=[], scenes=[];
  const pos = { x: 0, y: 0, z: 0, set(x,y,z) { Object.assign(this,{x,y,z}); } };
  const G = { state:'play', difficulty, cleanStreak:{kills:0}, yaw:0, ep:0, epTotal:0, time:0, combo:0 };
  const survivor = {name:'Dra. Helena Lima',pos:{x:0,z:0},visible:false,following:false,downT:0};
  const enemies = [], bounds = {}, spots = [{}];
  const ctx = { ...config, ...rules, AREAS, AREA, G, survivor, enemies, spots, bounds, boxes:[], scene:{}, renderer:{}, camera:{}, post:{},
    player:{pos,r:.5,hp:100,inv:0}, pg:{position:pos,rotation:{},visible:true}, weapons:config.WEAPONS.map(w=>({...w,mag:w.size,res:w.startRes})),
    captureEncounterMemory,restoreEncounterMemory,normalizeStreak,finishStreak,safeDoorArrival,passageFor,advancePassage,doorPose,doorVectors,DOOR_TIMING,gateVisible,
    canTriggerRevisit,scheduleRevisit,rearmPendingWarnings,
    cancelCutscene:noop,playCutscene(id,opts){scenes.push(id);opts.onComplete?.();return true;},
    doorArrival: vm.runInNewContext(areaSource.slice(areaSource.indexOf('export function doorArrival(')).replace('export ', '')+';doorArrival',{WORLD:config.WORLD}),
    isBuilt:a=>!!a?.ctx, neighbors:a=>a.doors.map(d=>AREA[d.to]), onAreaBuilt:noop, onQuality:noop, quality:{p:{stream:true}},
    buildArea(a){
      if (ctx.failBuild === a.id) throw new Error('falha sintética');
      if (a.ctx) return 0;
      a.ctx={group:{visible:false},boxes:[],circles:[]};
      const terminals = {pantano:[{kind:'generator',x:-20.5,z:3}], acampamento:[{kind:'hack',x:-1,z:16.8}],captacao:[{kind:'valves',x:0,z:-8.6}],sede:[{kind:'uplink',x:14,z:-18.6}],raiz:[{kind:'originArchive',x:-14,z:-16},{kind:'finalQuarantine',x:14,z:-16}]};
      const doors=Object.fromEntries(a.doors.map(d=>[d.id,{group:{position:{x:d.side==='W'?a.bounds.minX:d.side==='E'?a.bounds.maxX:d.at,z:d.side==='N'?a.bounds.minZ:d.side==='S'?a.bounds.maxZ:d.at}},gate:{position:{y:0}}}]));
      a.refs={doors,terminals:(terminals[a.id]||[]).map(t=>({...t,glow:{material:{opacity:0}}})),logs:[],powerLamps:[]};
      if(a.extraction)a.refs.extraction={group:{visible:false},ring:{rotation:{}},beam:{material:{}},boat:{position:{}}};
      if(a.cages){a.refs.cageGates=a.cages.map(c=>{const w=c.big?5:3.6,h=c.big?3.4:2.4,x=c.x+c.face*w/2,box={minX:x-.2,maxX:x+.2,minZ:c.z-w/2,maxZ:c.z+w/2,h};a.ctx.boxes.push(box);return {mesh:{position:{y:0}},box,h,open:0};});}
      if(['porto','ninho','heliponto'].includes(a.id)) a.refs.heli={group:{visible:false,position:{set:noop},rotation:{set:noop}},rotor:{rotation:{y:0}},tailRotor:{rotation:{x:0}},nav:[]};
      return 1;
    },
    unloadArea(a){a.ctx=a.refs=null;return true;}, idle(fn){idleJobs.push(fn)},
    createShaderWarmup:()=>({request:()=>Promise.resolve(true),isBusy:()=>false,invalidate:noop}), compileShaderVariants:noop,
    activateArea(a){Object.assign(bounds,a.bounds);ctx.boxes.splice(0,ctx.boxes.length,...a.ctx.boxes);a.ctx.group.visible=true;}, freeSpot:()=>true,castWorld:()=>Infinity,
    placePlayer(x,z,yaw){pos.set(x,0,z);G.yaw=yaw;}, clearEnemies(){enemies.length=0},clearPickups:noop,clearFx:noop,resetCombat:noop,clearInput:noop,hideBrandt:noop,
    resetPlayer(){ctx.player.hp=100;ctx.player.dead=false;},snapshotBag:()=>({owned:[true,true,true],ammo:[]}),restoreBag:noop,
    resetSurvivor(x,z){Object.assign(survivor,{visible:true,following:false,downT:0,pos:{x,z}})},hideSurvivor(){survivor.visible=false},snapshotSurvivor:()=>({...survivor}),restoreSurvivor:noop,
    resumeEscort(){survivor.following=true},reviveSurvivor:noop,
    spawnEnemy(type,x=18,z=10,opts={}){const cfg=config.ENEMY_TYPES[type],hp=Math.round(cfg.hp*rules.difficultyProfile(G.difficulty).enemyHP),e={type,cfg,hp,maxHp:hp,pos:{x,z},home:{x,z},...opts};enemies.push(e);return e;},spawnPickup:noop,
    makeNoise:noop,enemyEvents:{},combatEvents:{},addEp(n){G.ep+=n;G.epTotal+=n;return n;},
    readSave:()=>storage.main||null,writeSave(data){storage.main=JSON.parse(JSON.stringify(data));return !ctx.failSave;},readAct3:()=>storage.act3||null,writeAct3(data){storage.act3=JSON.parse(JSON.stringify(data));return !ctx.failSave;},
    story:{S:{logs:new Set(),said:new Set()},LINES:new Proxy({}, {get:()=>[]}),BEATS:new Proxy({}, {get:()=>[]}),ACT2_INTRO:['act2'],ACT3_INTRO:['act3'],
      resetStory:noop,storySave:()=>({}),clearSpeech:noop,say:noop,sayOne:noop,speaking:()=>false,cardOpen:()=>false,
      showCard(pages,cb){cards.push(pages);cb?.();}},
    ui:new Proxy({feed:m=>messages.push(m),announce:m=>messages.push(m)}, {get:(t,k)=>t[k]||noop}),sfx:new Proxy({}, {get:(_,k)=>()=>sounds.push(k)}),setPower:noop,setDoorLight:noop,bossGlow:noop,flashAt:noop,burst:noop,decal:noop,shockwave:noop,
    brandt:{visible:false,pos:{x:19.5,z:6}},showBrandt:noop,brandtRun:noop,brandtCower:noop,brandtCaught:noop,atmo:{},openTerminal:noop,
    animateDoorWalk(dt,p,yaw){pos.set(p.x,0,p.z);G.yaw=yaw},findEscortPath:()=>[],damp:(a,b)=>b,rand:(a,b)=>(a+b)/2,
    canAccessRecord:()=>true,canSeeRecord:()=>true,
    requestAnimationFrame(fn){fn()},setTimeout(fn,ms){if(ms!==2500)fn()},console,
  };
  vm.createContext(ctx);vm.runInContext(director.replace(/^import .*;\n/gm,'').replace(/export /g,'')+'\nglobalThis.D=D;',ctx);
  ctx.setWinHandler(()=>wins.push(ctx.G.area));
  const tick = async (n=1) => {for(let i=0;i<n;i++){if(ctx.D.trans?.sceneActive)ctx.skipPassage();ctx.G.time+=.05;ctx.updateDirector(.05);if(ctx.D.heli)ctx.updateHeli(.05);await Promise.resolve();}};
  const flush = () => {while(idleJobs.length)idleJobs.shift()()};
  const go = async id => {
    const a=ctx.D.area,d=a.doors.find(d=>d.to===id);assert.ok(d,`${a.id} -> ${id}`);
    const p={x:d.side==='W'?a.bounds.minX+3:d.side==='E'?a.bounds.maxX-3:d.at,z:d.side==='N'?a.bounds.minZ+3:d.side==='S'?a.bounds.maxZ-3:d.at};
    pos.set(p.x,0,p.z);ctx.interact();assert.ok(ctx.D.trans,`porta ${a.id}->${id} disponível`);
    for(let i=0;i<240&&ctx.D.trans;i++)await tick();
    assert.equal(ctx.D.area.id,id);assert.equal(ctx.D.trans,null);flush();
    assert.deepEqual(Array.from(AREAS.filter(a=>a.ctx?.group.visible),a=>a.id),[id]);
  };
  const event = async (kind,x,z) => {pos.set(x,0,z);ctx.interact();assert.equal(ctx.D.event?.kind,kind);for(let i=0;i<600&&ctx.D.event;i++)await tick();};
  return {ctx,storage,cards,messages,wins,sounds,tick,go,event,flush,AREAS,AREA,G,pos,scenes};
}

test('grafo tem uma única fronteira terrestre 1→2 e nenhuma porta física para o Ato 3',()=>{
  const areas=areaData();assert.deepEqual(validateDoorGraph(areas),[]);
  const edges=areas.flatMap(a=>a.doors.filter(d=>rules.actOf(d.to)!==rules.actOf(a.id)).map(d=>a.id+'>'+d.to));
  assert.deepEqual([...edges],['heliponto>margem','margem>heliponto']);
  assert.equal(areas.find(a=>a.id==='porto').doors[0].side,'N');
  assert.equal(areas.find(a=>a.id==='heliponto').doors.find(d=>d.to==='margem').side,'N');
});
test('bloqueios entre atos não dependem da qualidade gráfica ou de flags parciais',()=>{
  assert.equal(rules.canTravel('heliponto','margem',{bossDead:true}),false);
  assert.equal(rules.canTravel('heliponto','margem',{bossDead:true,power:true,heliCode:true}),true);
  assert.equal(rules.canTravel('margem','heliponto',{act2:true,bossDead:true}),false);
  assert.equal(rules.canTravel('porto','portoanil',{}),false);
  assert.equal(rules.canStartAct3({act2Win:true}),false);
  assert.equal(rules.canStartAct3({act2Win:true,nestClear:true}),true);
});
for(const id of ['easy','normal','hard'])test(`dificuldade ${id}: balanceamento finito, ordem de atos idêntica e save persistente`,()=>{
  const profile=rules.difficultyProfile(id);assert.ok(profile.damage>0);assert.ok(profile.enemyHP>0);
  assert.equal(rules.normalizeCampaignSave({area:'porto',difficulty:id}).difficulty,id);
  for(const n of [0,6,24,72]) assert.ok(Number.isFinite(rules.ammoAmount(n,id)));
  assert.equal(rules.canStartAct3({act2Win:true,nestClear:true}),true);
});
test('Fácil < Normal < Difícil em dano, HP e patrulhas; munição faz ordem inversa',()=>{
  const ps=['easy','normal','hard'].map(rules.difficultyProfile);
  for(const k of ['damage','enemyHP','patrols'])assert.ok(ps[0][k]<ps[1][k]&&ps[1][k]<ps[2][k]);
  const patrols=Array.from({length:3},(_,i)=>({type:'raptor',x:i,z:10}));
  assert.deepEqual(['easy','normal','hard'].map(id=>rules.patrolComposition(patrols,id).length),[2,3,4]);
  assert.deepEqual(['easy','normal','hard'].map(id=>rules.ammoAmount(72,id)),[108,72,50]);
});
test('migração remove flags de outro capítulo sem apagar inventário, registros ou itens',()=>{
  const s=rules.normalizeCampaignSave({area:'lab',flags:{act3:true,act2:true,act3Win:true,primDead:true},bag:{ammo:[{res:7}]},story:{logs:['log4']},st:{lab:{taken:['p3med']}}});
  assert.equal(s.flags.act3,false);assert.equal(s.flags.act2,false);assert.equal(s.flags.primDead,undefined);assert.equal(s.difficulty,'normal');
  assert.equal(s.bag.ammo[0].res,7);assert.deepEqual(s.story.logs,['log4']);assert.deepEqual(s.st.lab.taken,['p3med']);
  assert.equal(rules.normalizeCampaignSave({area:'inexistente'}),null);
});
test('checkpoint falso do Ato 3 volta ao ninho; checkpoint v6 legítimo continua compatível',()=>{
  const broken=rules.normalizeCampaignSave({v:6,area:'sede',flags:{act3:true},enc:['nest-awaken']});
  assert.equal(broken.area,'ninho');assert.equal(broken.flags.act3,false);assert.equal(broken.flags.nestClear,false);assert.equal(broken.enc.includes('nest-awaken'),false);
  const good=rules.normalizeCampaignSave({v:6,area:'portoanil',flags:{act3:true,act2Win:true,nestClear:true}});
  assert.equal(good.area,'portoanil');assert.equal(good.flags.act3,true);
});
test('continuar/novo jogo escondem a área antiga mesmo quando D.area foi zerada',()=>{
  const h=harness();h.ctx.startCampaign(false);h.ctx.enterArea('ruinas','S');assert.ok(h.AREA.ruinas.ctx.group.visible);
  h.ctx.startCampaign(false);h.flush();assert.deepEqual(Array.from(h.AREAS.filter(a=>a.ctx?.group.visible),a=>a.id),['porto']);
  h.storage.main={v:7,area:'captacao',flags:{act3:true,act2Win:true,nestClear:true},difficulty:'hard'};
  h.ctx.startCampaign(true);h.flush();assert.equal(h.G.difficulty,'hard');assert.equal(h.ctx.D.area.id,'captacao');
  assert.deepEqual(Array.from(h.AREAS.filter(a=>a.ctx?.group.visible),a=>a.id),['captacao']);
  assert.ok(h.AREAS.filter(a=>a.ctx).every(a=>rules.actOf(a.id)===3));
});
test('tarefas ociosas antigas não reconstroem cenários de outro ato (inclusive Alto)',()=>{
  const h=harness();h.ctx.startCampaign(false);h.ctx.quality.p.stream=false;h.ctx.streamAround(h.ctx.D.area);
  Object.assign(h.ctx.D.flags,{act2:true,power:true,heliCode:true,bossDead:true});h.ctx.D.area=null;h.ctx.enterArea('margem');h.ctx.streamAround(h.ctx.D.area);h.flush();
  assert.ok(h.AREAS.filter(a=>a.ctx).every(a=>rules.actOf(a.id)===2));
});
for(const difficulty of ['easy','normal','hard'])for(const choice of ['expose','destroy'])for(const finalChoice of ['proof','quarantine'])test(`campanha lógica completa 1→4→fim (${difficulty}/${choice}/${finalChoice})`,async()=>{
  const h=harness(difficulty),c=h.ctx;c.startCampaign(false);
  await h.go('ruinas');await h.go('lab');await h.go('pantano');
  await h.event('gen',-20.5,3);assert.equal(c.D.flags.power,true);
  await h.go('lab');await h.go('patio');
  h.pos.set(c.survivor.pos.x,0,c.survivor.pos.z);c.interact();assert.equal(c.D.flags.escort,true);
  c.survivor.pos={x:19.6,z:-16};await h.tick(120);assert.equal(c.D.flags.heliCode,true);
  await h.go('heliponto');await h.tick(80);
  c.enemyEvents.onKilled({type:'colossus',cfg:config.ENEMY_TYPES.colossus,pos:{x:0,z:-8}});
  await h.go('margem');await h.tick(20);assert.equal(c.D.flags.act1Complete,true);assert.equal(c.D.flags.act2,true);assert.equal(c.D.flags.act3,undefined);
  assert.equal(c.debugGoto('porto'),false);
  await h.go('acampamento');await h.event('hack',-1,16.8);await h.go('ninho');
  h.pos.set(0,0,-3);await h.tick(80);assert.equal(c.D.flags.nestFight,true);
  assert.equal(c.startAct3(),false);
  c.enemyEvents.onKilled({type:'matriarca',cfg:config.ENEMY_TYPES.matriarca,pos:{x:0,z:13}});c.D.flags.brandt='caught';
  await h.event('rescue',-13,-9);assert.equal(c.D.flags.act2Win,true);assert.equal(h.wins.length,0);
  await h.tick(60);assert.equal(c.D.heli.land,1);
  assert.equal(c.startAct3(),true);assert.equal(c.startAct3(),false);await h.tick(60);h.flush();
  assert.equal(c.D.area.id,'portoanil');assert.equal(c.D.flags.act3,true);assert.equal(h.storage.main.difficulty,difficulty);
  assert.ok(h.AREAS.filter(a=>a.ctx).every(a=>rules.actOf(a.id)===3));
  await h.go('captacao');assert.equal(c.isLocked('captacao','N'),true);await h.event('flood',0,-8.6);await h.go('sede');
  h.pos.set(0,0,0);await h.tick(80);c.enemyEvents.onKilled({type:'primordio',cfg:config.ENEMY_TYPES.primordio,pos:{x:0,z:-10}});
  if(choice==='expose')await h.event('uplink',14,-18.6);
  else await h.event('core',c.D.area.core.x,c.D.area.core.z+2);
  assert.equal(c.D.flags.act3Resolved,true);assert.equal(c.D.flags.act3Win,undefined);assert.equal(h.wins.length,0);
  await h.go('captacao');await h.go('portoanil');
  assert.equal(c.D.area.refs.extraction.group.visible,true);
  assert.ok(c.hudData().points.some(p=>p.x===0&&p.z===17.2&&p.col==='#70ffdc'));
  h.pos.set(0,0,17.2);c.interact();assert.equal(h.wins.length,0);await h.tick(60);h.flush();
  assert.equal(c.D.flags.act3Win,true);assert.equal(c.D.flags.act4,true);assert.equal(c.D.area.id,'setorzero');
  assert.ok(h.AREAS.filter(a=>a.ctx).every(a=>rules.actOf(a.id)===4));
  assert.equal(c.D.area.refs.extraction.group.visible,false);assert.equal(c.debugGoto('portoanil'),false);
  assert.equal(c.startAct4(),false);assert.equal(c.finishAct4(finalChoice),false);
  await h.go('raiz');await h.event('originScan',-14,-16);await h.tick(60);
  assert.equal(c.D.flags.originKnown,true);assert.equal(c.D.flags.originFight,true);assert.equal(c.isLocked('raiz','S'),true);
  assert.equal(c.terminalDanger(),true);assert.equal(c.finishAct4(finalChoice),false);
  c.enemyEvents.onKilled({type:'origin',cfg:config.ENEMY_TYPES.origin,pos:{x:0,z:-16}});
  assert.equal(c.isLocked('raiz','S'),false);
  h.pos.set(finalChoice==='proof'?-14:14,0,-16);c.interact();assert.equal(c.D.flags.act4Choice,finalChoice);
  assert.equal(c.D.flags.act4Resolved,true);assert.equal(h.wins.length,0);
  await h.go('setorzero');assert.equal(c.D.area.refs.extraction.group.visible,true);
  h.pos.set(0,0,17.2);c.interact();assert.equal(c.D.flags.act4Win,true);assert.deepEqual(h.wins,['setorzero']);c.interact();assert.equal(h.wins.length,1);
  for(const scene of ['act2','cages','act3','extraction','act4','brandt','tyrant','ending-'+finalChoice])assert.ok(h.scenes.includes(scene),scene);

});
test('falha ao construir Ato 3 mantém Ato 2 recuperável e sem conceder vitória',async()=>{
  const h=harness(),c=h.ctx;c.startCampaign(false);Object.assign(c.D.flags,{act2:true,nestClear:true,act2Win:true});c.D.area=null;c.enterArea('ninho');c.D.heli.land=1;c.failBuild='portoanil';
  assert.equal(c.startAct3(),true);await h.tick(2);assert.equal(c.D.area.id,'ninho');assert.equal(c.D.flags.act3,undefined);assert.equal(c.D.trans,null);assert.equal(h.wins.length,0);
  c.failBuild=null;assert.equal(c.startAct3(),true);await h.tick(60);assert.equal(c.D.area.id,'portoanil');
});
test('evacuar Lima no Cais não transporta Marina, não abre outro ato e não duplica NPC',async()=>{
  const h=harness(),c=h.ctx;c.startCampaign(false);Object.assign(c.D.flags,{heliCode:true,power:true});c.enterArea('porto');
  assert.equal(c.survivor.visible,true);assert.equal(c.survivor.pos.x,6);
  h.pos.set(13,0,17);c.interact();assert.equal(c.D.event.kind,'npcRescue');await h.tick(400);
  assert.equal(c.D.event.kind,'npcBoard');c.survivor.pos={x:11.1,z:17.25};await h.tick(100);
  assert.equal(c.D.flags.limaRescued,true);assert.equal(c.D.area.id,'porto');assert.equal(c.D.flags.act2,undefined);assert.equal(h.wins.length,0);assert.equal(c.survivor.visible,false);
  c.enterArea('ruinas','S');c.enterArea('lab','S');c.enterArea('patio','S');assert.equal(c.survivor.visible,false);
});
test('há créditos e quatro desfechos; nenhuma condição exige os 17 registros para terminar',()=>{
  const src=read('story.js');assert.match(src,/FIM — CRISE NO VALE/);assert.match(src,/Créditos/);
  for(const choice of ['expose','destroy'])for(const dirty of [true,false])assert.equal(rules.canFinishCampaign({act3:true,act2Win:true,nestClear:true,valvesClosed:true,primDead:true,act3Choice:choice,contaminated:dirty,act4:true,originKnown:true,originDead:true,act4Resolved:true,act4Choice:'proof'}),true);
  assert.equal(rules.canFinishCampaign({act3:true,act3Choice:'expose'}),false);
});

for(const id of ['easy','normal','hard'])test(`dano recebido real aplica a dificuldade ${id} antes do colete`,()=>{
  const source=read('player.js');const code=source.slice(source.indexOf('export function hurtPlayer('),source.indexOf('export function heal(')).replace('export ','');
  const c={G:{state:'play',difficulty:id,cleanStreak:{kills:0},dmgTaken:0,shake:0,yaw:0},player:{hp:100,inv:0,dead:false,pos:{x:0,z:0},kx:0,kz:0},bag:{armor:0},PLAYER:config.PLAYER,difficultyProfile:rules.difficultyProfile,
    ui:proxy,sfx:proxy,burst:noop,decal:noop,wrapAngle:x=>x,events:{},roar:noop,breakStreak:noop,Math};
  vm.createContext(c);vm.runInContext(code,c);c.hurtPlayer(20,1,0,0);
  assert.equal(c.player.hp,100-20*rules.difficultyProfile(id).damage);
});
test('recarga é dirigida uma só vez por quadro e idle/mira não disputam as pernas',()=>{
  const code=read('player.js');assert.match(code,/A.idleLegs = heroAction/);assert.match(code,/ra.timeScale = 0/);assert.match(code,/A.aim = heroAction[^\n]*upper: true/);
  assert.match(code,/heroAnimationSet\(defaultHeroGLTF,jillReference,model\)/);
  assert.match(read('hero-animation.mjs'),/retargetCombatClip\(c,/);
});

test('save misturado do Ato 1 não dá a Matriarca por morta nem mantém seus gatilhos consumidos',()=>{
  const s=rules.normalizeCampaignSave({area:'lab',flags:{act2Win:true,nestClear:true,campGate:true,brandt:'caught'},st:{ninho:{visited:true},lab:{taken:['x']}}});
  assert.equal(s.flags.nestClear,undefined);assert.equal(s.flags.campGate,undefined);assert.equal(s.st.ninho,undefined);
  const h=harness();h.storage.main={...s,enc:['nest-awaken','prim-awaken']};h.ctx.startCampaign(true);
  assert.equal(h.ctx.D.enc.has('nest-awaken'),false);assert.equal(h.ctx.D.enc.has('prim-awaken'),false);
});

for(const difficulty of ['easy','normal','hard'])test(`jaulas ${difficulty}: fechadas na chegada, gatilho visível, colisão até abrir e leva dimensionada`,async()=>{
  const h=harness(difficulty),c=h.ctx;c.startCampaign(false);c.D.flags.act2=true;c.D.area=null;c.enterArea('acampamento');
  const a=c.D.area,gates=a.refs.cageGates;await h.tick(160);
  assert.ok(gates.every(g=>g.open===0&&g.mesh.position.y===0&&c.boxes.includes(g.box)&&a.ctx.boxes.includes(g.box)));
  assert.equal(c.D.flags.cagesReleased,undefined);
  h.pos.set(0,0,1);await h.tick();assert.equal(c.D.flags.cagesReleased,true);assert.ok(h.sounds.includes('alarm'));
  await h.tick(8);assert.ok(gates.every(g=>g.mesh.position.y>0&&g.mesh.position.y<g.h&&c.boxes.includes(g.box)));
  await h.tick(40);assert.ok(gates.every(g=>g.mesh.position.y===g.h+.2&&!c.boxes.includes(g.box)&&!a.ctx.boxes.includes(g.box)));
  const released=c.enemies.filter(e=>e.cageRelease);assert.equal(released.length,{easy:2,normal:3,hard:4}[difficulty]);
  assert.ok(released.every(e=>e.cageExit&&Math.abs(e.cageExit.x-e.pos.x)>3));
  assert.ok(released.every(e=>e.maxHp===Math.round(config.ENEMY_TYPES[e.type].hp*rules.difficultyProfile(difficulty).enemyHP)));
});
test('jaulas persistem abertas; só sobreviventes feridos voltam, sem duplicar a leva no retorno/save',async()=>{
  const h=harness(),c=h.ctx;c.startCampaign(false);c.D.flags.act2=true;c.D.area=null;c.enterArea('acampamento');h.pos.set(0,0,1);await h.tick(60);
  const released=c.enemies.filter(e=>e.cageRelease);released[0].hp=17;released[1].dead=true;
  await h.go('margem');await h.go('acampamento');
  const survivors=c.enemies.filter(e=>e.cageRelease);assert.equal(survivors.length,2);assert.ok(survivors.some(e=>e.hp===17));
  assert.ok(c.D.area.refs.cageGates.every(g=>g.open===1&&!c.boxes.includes(g.box)));assert.equal(c.D.queue.filter(q=>q.cageRelease).length,0);
  const save=c.buildSave('acampamento',{x:-8,z:-18,yaw:0},c.D.flags);h.storage.main=JSON.parse(JSON.stringify(save));c.startCampaign(true);
  assert.equal(c.D.flags.cagesReleased,true);assert.ok(c.D.area.refs.cageGates.every(g=>g.open===1));
  c.startCampaign(false);c.D.flags.act2=true;c.D.area=null;c.enterArea('acampamento');assert.ok(c.D.area.refs.cageGates.every(g=>g.open===0&&c.boxes.includes(g.box)));
});
test('hack também libera jaulas se a jogadora contornar o gatilho; save legado não as abre na chegada',async()=>{
  const h=harness(),c=h.ctx;h.storage.main={v:7,area:'acampamento',flags:{act2:true},enc:['camp-brandt','camp-jaula']};c.startCampaign(true);
  assert.ok(c.D.area.refs.cageGates.every(g=>g.open===0));assert.equal(c.D.enc.has('camp-brandt'),false);
  h.pos.set(-1,0,16.8);c.interact();assert.equal(c.D.flags.cagesReleased,true);assert.equal(c.D.event.kind,'hack');
});

test('falha de construção do Ato 4 preserva Porto Anil; tentar novamente não pula nem concede vitória',async()=>{
 const h=harness(),c=h.ctx;h.storage.main={v:7,area:'portoanil',flags:{act3:true,act2Win:true,nestClear:true,valvesClosed:true,primDead:true,act3Choice:'expose'}};c.startCampaign(true);
 assert.equal(c.D.area.refs.extraction.group.visible,true);c.failBuild='setorzero';assert.equal(c.startAct4(),true);await h.tick(2);
 assert.equal(c.D.area.id,'portoanil');assert.equal(c.D.flags.act4,false);assert.equal(h.wins.length,0);
 c.failBuild=null;assert.equal(c.startAct4(),true);await h.tick(60);h.flush();assert.equal(c.D.area.id,'setorzero');
});
test('save da ilha: pré-leitura, chefe abatido e ambas escolhas retomam sem misturar atos',()=>{
 for(const choice of [undefined,'proof','quarantine']){
  const h=harness(),c=h.ctx;h.storage.main={v:8,area:'raiz',flags:{act4:true,act3:true,act2Win:true,nestClear:true,valvesClosed:true,primDead:true,act3Choice:'destroy',act3Resolved:true,originKnown:!!choice,originDead:!!choice,act4Resolved:!!choice,act4Choice:choice}};
  c.startCampaign(true);h.flush();assert.equal(c.D.area.id,'raiz');assert.equal(c.D.flags.originDead,!!choice);assert.equal(c.D.flags.act4Choice,choice);
  assert.ok(h.AREAS.filter(a=>a.ctx).every(a=>rules.actOf(a.id)===4));assert.equal(h.wins.length,0);
 }
});
test('save adulterado: não pula Atos 2/3, não prende escolha inválida nem suprime cenas futuras',()=>{
 const bad=rules.normalizeCampaignSave({v:8,area:'raiz',flags:{act4:true,act3:true,act2Win:true,nestClear:true,cinematics:{act4:true,tyrant:true}}});
 assert.equal(bad.area,'portoanil');assert.equal(bad.flags.act4,false);assert.equal(bad.flags.cinematics.tyrant,undefined);
 const choice=rules.normalizeCampaignSave({v:7,area:'portoanil',flags:{act3:true,act2Win:true,nestClear:true,act3Choice:'hacked',primDead:true,valvesClosed:true}});
 assert.equal(choice.flags.act3Choice,undefined);assert.equal(choice.flags.act3Resolved,false);
});
