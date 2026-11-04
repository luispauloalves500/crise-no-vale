// director.js — progressão por ÁREAS (no lugar das ondas): portas e travas, estado de cada área,
// encontros roteirizados, gerador, escolta, chefe, resgate, objetivos e terminais de save.
import { activateArea, bounds, boxes, castWorld, setDoorLight, setPower, atmo, spots, bossGlow, flashAt, renderer, camera, scene } from './world.js';
import { WORLD, SCORE, PLAYER, EP, ENEMY_TYPES } from './config.js';
import { captureEncounterMemory, restoreEncounterMemory } from './encounter-memory.mjs';
import { canAccessRecord, canSeeRecord } from './archive-model.mjs';
import { G, writeSave, readSave, addEp } from './state.js';
import { normalizeStreak, finishStreak } from './clean-streak.mjs';
import { safeDoorArrival } from './door-safety.mjs';
import { passageFor, advancePassage } from './passage-scenes.mjs';
import { doorPose, doorVectors, DOOR_TIMING, gateVisible } from './door-cinematic.mjs';
import { clearInput } from './input.js';
import { canTriggerRevisit, scheduleRevisit, rearmPendingWarnings } from './revisit-encounters.mjs';
import { AREAS, AREA, doorArrival, buildArea, unloadArea, isBuilt, neighbors, onAreaBuilt } from './areas.js';
import { quality, onQuality } from './quality.js';
import { createShaderWarmup, compileShaderVariants } from './shader-warmup.mjs';
import { post } from './post.js';
import { idle } from './idle.js';
import { player, pg, placePlayer, snapshotBag, restoreBag, resetPlayer, animateDoorWalk } from './player.js';
import { openTerminal } from './shop.js';
import { enemies, spawnEnemy, clearEnemies, enemyEvents, makeNoise } from './enemies.js';
import { spawnPickup, clearPickups, combatEvents, resetCombat } from './combat.js';
import { survivor, resetSurvivor, restoreSurvivor, snapshotSurvivor, hideSurvivor, reviveSurvivor, resumeEscort } from './npc.js';
import { clearFx, burst, decal, shockwave } from './fx.js';
import { sfx } from './audio.js';
import * as ui from './ui.js';
import { damp, rand } from './utils.js';
import * as story from './story.js';
import { brandt, showBrandt, hideBrandt, brandtRun, brandtCower, brandtCaught } from './brandt.js';

// ---------- estado da campanha ----------
const freshArea = () => ({ visited: false, dead: [], taken: [], living: null, pending: [] });
export const D = {
  area: null, flags: {}, st: {}, enc: new Set(), visited: new Set(),
  queue: [],            // spawns pendentes [{t, type, x, z, from}]
  trans: null,          // troca de área em andamento
  event: null,          // gerador / código / resgate { kind, t, dur, ... }
  boss: null, objectives: 0, lockMsgT: 0, mapDirty: true, lastObj: '',
  heli: null,           // animação do helicóptero de resgate { t, landed }
  barkT: 12, wasDown: false, talkI: 0,
  lockdown: null,       // v5: sala da diretoria trancada { t, flashT }
  brandtT: 0,           // v7: segundos até o barco do Brandt ligar (depois da Matriarca)
  fuse: 0,              // v7: pavio das cargas no ninho
  survivorMemory: null, // cópia de estado da doutora entre visitas e saves
};
const F = D.flags;
const CONTROL_SPOT = { x: 19.6, z: -16 };

function resetCampaign() {
  for (const k in F) delete F[k];
  D.st = Object.fromEntries(AREAS.map((a) => [a.id, freshArea()]));
  D.enc = new Set(); D.visited = new Set(); D.queue = []; D.trans = null; G.transitioning = false; ui.hidePassage(); D.event = null; D.boss = null; D.objectives = 0;
  D.heli = null; D.barkT = 12; D.wasDown = false; D.talkI = 0;
  if (D.lockdown) endLockdown(true); D.lockdown = null;
  D.brandtT = 0; D.fuse = 0; D.survivorMemory = null; hideBrandt();
}

// ---------- sala da diretoria (laboratório): porta blindada que abre com a energia ----------
function sideDoor() { return AREA.lab.refs && AREA.lab.refs.sideDoor; }
function setSideDoor(open, instant) {
  const sd = sideDoor(); if (!sd) return; // laboratório não construído: reaplicado em onAreaBuilt
  if (sd.y0 === undefined) sd.y0 = sd.mesh.position.y;
  const list = AREA.lab.ctx.boxes, i = list.indexOf(sd.box);
  if (open && i >= 0) list.splice(i, 1);
  if (!open && i < 0) list.push(sd.box);
  if (D.area === AREA.lab) { const j = boxes.indexOf(sd.box); if (open && j >= 0) boxes.splice(j, 1); if (!open && j < 0) boxes.push(sd.box); }
  sd.open = open; if (instant) sd.mesh.position.y = open ? sd.y0 - 3.3 : sd.y0;
}
function powerLampsOn(snap) {
  AREAS.forEach((a) => ((a.refs && a.refs.powerLamps) || []).forEach((L) => { L.on = true; if (snap && a === D.area) { L.snap = 0.9 + Math.random() * 0.6; L.boost = 1.2; } }));
}

/** Trava da porta: true = bloqueada. */
export function isLocked(areaId, doorId) {
  const d = AREA[areaId].doors.find((x) => x.id === doorId);
  if (!d || !d.lock) return false;
  if (d.lock === 'power') return !F.power;
  if (d.lock === 'heliCode') return !F.heliCode;
  if (d.lock === 'bossLock') return !!F.bossFight;
  // v7 — Ato 2
  if (d.lock === 'act2Gate') return !F.bossDead || !!F.bossFight || !!(D.event && D.event.kind === 'rescue');
  if (d.lock === 'campGate') return !F.campGate;
  if (d.lock === 'nestLock') return !!F.nestFight;
  return false;
}
const LOCK_MSG = {
  power: 'Portão sem energia — ligue o gerador no pântano (oeste)',
  heliCode: 'Portão travado — precisa do código da Dra. Lima',
  bossLock: 'O portão travou! Não há como recuar',
  act2Gate: 'Portão do rio travado — o Colosso ainda guarda o penhasco',
  campGate: 'Portão sul trancado pelo Brandt — quebre a senha no terminal vermelho',
  nestLock: 'A saída desabou atrás de você — derrote a Matriarca!',
};

function objectiveDone(msg) {
  D.objectives++; G.score += SCORE.OBJECTIVE; sfx.objective();
  ui.floater(`+${SCORE.OBJECTIVE} OBJETIVO`, player.pos.x, 2.6, player.pos.z, 'kill');
  ui.floater(`+${addEp(EP.OBJECTIVE)} PE`, player.pos.x, 2.1, player.pos.z, 'ep'); // v10
  if (msg) ui.feed(msg, '#ffe9a0');
  D.mapDirty = true;
}

// ---------- objetivo atual (derivado das flags) ----------
function objective() {
  if (!D.visited.has('lab')) return ['Atravesse as ruínas até o laboratório (norte)', 'lab'];
  if (!F.power) return ['Restaure a energia — gerador no pântano (oeste do laboratório)', 'pantano'];
  if (!D.visited.has('patio')) return ['Volte ao laboratório e passe pelo portão norte', 'patio'];
  if (!F.heliCode && !F.escort) return ['Encontre a sobrevivente no pátio (cabine sudoeste)', 'patio'];
  if (!F.heliCode) return [`Escolte a ${survivor.name} até o terminal de controle (nordeste)`, 'patio'];
  if (!D.visited.has('heliponto')) return ['Siga pelo portão leste do pátio até o heliponto', 'heliponto'];
  if (!F.bossDead) return ['Derrote o Colosso', 'heliponto'];
  if (F.act2) return objectiveAct2();
  if (!D.event || D.event.kind !== 'rescue') return ['Aperte E na marca H para resgate — ou siga pelo portão leste (Ato 2)', 'heliponto'];
  return ['Aguente até o helicóptero chegar!', 'heliponto'];
}
/** v7: cadeia de objetivos do Ato 2 (rio abaixo atrás do Brandt). */
function objectiveAct2() {
  const ev = D.event && D.event.kind;
  if (!D.visited.has('acampamento')) return ['Siga o Brandt rio abaixo até o acampamento Tellus-2', 'acampamento'];
  if (!F.campGate) return ev === 'hack' ? ['Proteja o terminal enquanto a senha é quebrada!', 'acampamento'] : ['Quebre a senha do portão sul no terminal vermelho', 'acampamento'];
  if (!D.visited.has('ninho')) return ['Persiga o Brandt pelo portão sul até o ninho', 'ninho'];
  if (!F.nestClear) return F.nestFight ? ['Derrote a Matriarca — faça-a bater nos pilares de pedra', 'ninho'] : ['Entre na cratera e encontre o Brandt', 'ninho'];
  if (ev === 'rescue') return ['Aguente até o Garça-1 pousar!', 'ninho'];
  if (ev === 'charges') return ['Proteja as cargas enquanto elas armam!', 'ninho'];
  if (D.fuse > 0) return ['Afaste-se do ninho! Detonação em ' + Math.ceil(D.fuse) + ' s', 'ninho'];
  if (!F.brandt) return ['Prenda o Brandt no cais antes que o barco ligue', 'ninho'];
  if (!F.nestDestroyed) return [F.brandt === 'escaped' ? 'Brandt fugiu — plante cargas (opcional) ou aperte E na marca H' : 'Brandt capturado — plante cargas (opcional) ou aperte E na marca H', 'ninho'];
  return ['Aperte E na marca H da clareira para chamar o Garça-1', 'ninho'];
}

// ---------- troca de área ----------
function rememberAreaThreats(a) {
  if (!a || !D.st[a.id]) return;
  Object.assign(D.st[a.id], captureEncounterMemory(enemies, D.queue));
}
function spawnAreaContents(a) {
  const s = D.st[a.id], memory = restoreEncounterMemory(s, a.ambient);
  for (const m of memory.living) {
    if (!ENEMY_TYPES[m.type] || !Number.isFinite(m.x) || !Number.isFinite(m.z)) continue;
    // Restaura sem rugido/partículas extras: o dinossauro nunca deixou o cenário.
    const e = spawnEnemy(m.type, m.x, m.z, { alert: false, ambientIdx: Number.isInteger(m.ambientIdx) ? m.ambientIdx : undefined });
    e.hp = Math.min(e.maxHp, Math.max(1, Number.isFinite(m.hp) ? m.hp : e.maxHp));
    e.lastHp = e.hp; // HP antigo de save não equivale a um novo disparo
    if (Number.isFinite(m.yaw)) e.yaw = m.yaw;
    if (m.home && Number.isFinite(m.home.x) && Number.isFinite(m.home.z)) e.home = { ...m.home };
    e.alert = !!m.alert; e.alertT = Number.isFinite(m.alertT) ? m.alertT : 0;
    e.lastSeen = m.lastSeen && Number.isFinite(m.lastSeen.x) && Number.isFinite(m.lastSeen.z) ? { ...m.lastSeen } : { ...e.home };
    e.investigate = m.investigate && Number.isFinite(m.investigate.x) && Number.isFinite(m.investigate.z) ? { ...m.investigate } : null;
    e.phaseIdx = Number.isInteger(m.phaseIdx) ? m.phaseIdx : 0;
    if (e.cfg.boss) D.boss = e;
  }
  D.queue = rearmPendingWarnings(memory.pending);
  a.pickups.forEach((p) => { if (!s.taken.includes(p.id)) spawnPickup(p.kind, p.x, p.z, { id: p.id, y: p.kind === 'shotgun' ? 1.15 : p.kind === 'crate' ? 0.32 : 0.6 }); });
}
function setupSurvivor(a) {
  if (a.id !== 'patio') { hideSurvivor(); return; }
  survivor.name = a.survivor.name;
  if (F.heliCode) { resetSurvivor(CONTROL_SPOT.x, CONTROL_SPOT.z, true); return; }
  if (F.escort && D.survivorMemory) {
    restoreSurvivor(D.survivorMemory, a.survivor);
    if (!survivor.goal) resumeEscort();
    return;
  }
  resetSurvivor(a.survivor.x, a.survivor.z, true);
}
function syncGates(a, instant) {
  for (const d of a.doors) {
    const ref = a.refs.doors[d.id]; if (!ref) continue;
    const open = !isLocked(a.id, d.id);
    ref.open = open;
    if (instant) ref.gate.position.y = 0;
    ref.gate.visible = gateVisible(!open); // folha aparece quando bloqueada ou durante a cena
    setDoorLight(ref, open);
  }
}

/** Entra na área `id`. Vindo por uma porta (doorId da área de destino) ou num ponto fixo (at). */
export function enterArea(id, doorId, at) {
  const a = AREA[id], prev = D.area;
  if (prev) {
    rememberAreaThreats(prev);
    if (prev.id === 'patio' && survivor.visible) D.survivorMemory = snapshotSurvivor();
  }
  // streaming: se a área foi descarregada (ou ainda não foi construída), constrói agora — sob a tela preta da transição
  if (!isBuilt(a)) { const ms = buildArea(a); streamStats.syncBuilds++; streamStats.lastSyncMs = Math.round(ms); }
  if (D.event && (D.event.kind !== 'rescue' || prev !== a)) D.event = null; // sair da área cancela gerador/código/resgate
  // v7: saiu do ninho com o Brandt solto → ele foge de barco
  if (prev && prev.id === 'ninho' && prev !== a && F.nestClear && !F.brandt) brandtEscaped(false);
  D.fuse = 0;
  activateArea(a, prev && prev !== a && isBuilt(prev) ? prev : null);
  D.area = a; G.area = id;
  clearEnemies(); clearPickups(); clearFx(); ui.clearFloaters(); D.queue = []; D.boss = null;
  const p = at || (doorId ? doorArrival(a, doorId) : a.start || doorArrival(a, a.doors[0].id));
  placePlayer(p.x, p.z, p.yaw);
  spawnAreaContents(a);
  setupSurvivor(a);
  setupBrandt(a);
  syncGates(a, true);
  const s = D.st[id], first = !s.visited;
  if (first) { s.visited = true; G.score += SCORE.AREA_FIRST; if (prev) addEp(EP.AREA_FIRST); } // v10: área nova = +PE (não conta o cais do início)
  D.visited.add(id);
  ui.banner(a.name, (F.power && a.subPower) || a.sub, 2.8);
  if (F.power) (a.refs.powerLamps || []).forEach((L) => { L.on = true; });
  if (a.refs.heli) { a.refs.heli.group.visible = false; }
  D.heli = null; D.barkT = 10;
  if (D.lockdown) endLockdown(true);
  // falas de chegada (uma vez por campanha)
  const lines = story.LINES['enter_' + id];
  if (lines && !(id === 'lab' && F.power) && !(id === 'patio' && F.heliCode)) setTimeoutGame(first ? 2.2 : 0.8, () => { if (D.area === a) story.say(lines, 'enter_' + id, true); });
  if (id === 'heliponto' && !F.bossDead && !story.S.said.has('card_boss')) { story.S.said.add('card_boss'); setTimeoutGame(0.9, () => cardWhenFree(story.BEATS.boss)); }
  // v7: primeira vez na margem = começa o Ato 2 (o resgate do penhasco deixa de valer)
  if (id === 'margem' && !F.act2) { F.act2 = true; ui.banner('ATO 2 — RIO ABAIXO', a.sub, 3.4); setTimeoutGame(0.6, () => cardWhenFree(story.ACT2_INTRO)); }
  // encontros de entrada
  for (const e of a.encounters) if (e.on === 'enter' && (e.revisitFrom ? canTriggerRevisit(e, { from: prev?.id, first, flags: F, fired: D.enc }) : canFire(e, first))) fireEncounter(e);
  D.mapDirty = true;
}
function canFire(e, first) {
  if (D.enc.has(e.id)) return false;
  if (e.first && !first) return false;
  if (e.flag && !F[e.flag]) return false;
  return true;
}
function fireEncounter(e) {
  D.enc.add(e.id);
  if (e.revisitFrom) { D.queue.push(...scheduleRevisit(e)); return; }
  const base = e.delay || 0;
  if (e.boss && D.area.id === 'ninho') { F.nestFight = true; syncGates(D.area, false); setTimeoutGame(base + 1.5, () => story.say(story.LINES.nest_start, 'nest_start', true)); }
  else if (e.boss) { F.bossFight = true; syncGates(D.area, false); setTimeoutGame(base + 1.5, () => story.say(story.LINES.boss_start, 'boss_start', true)); }
  if (e.msg) setTimeoutGame(base, () => {
    ui.announce(e.msg, e.boss ? '#ff60ff' : '#ff9a80');
    if (e.boss) { sfx.bossRoar(); sfx.stinger('boss'); } else sfx.stinger('ambush');
  });
  if (e.beat && BEAT[e.beat]) BEAT[e.beat](e);
  for (const s of e.spawn || []) D.queue.push({ t: base + (s.delay || 0), type: s.type, x: s.x, z: s.z, from: s.from, boss: e.boss, fx: s.fx });
}

// ---------- v5: momentos roteirizados ----------
const BEAT = {
  /** Sala do Brandt: porta blindada bate, alarme e gravação do diretor; reabre com a matilha no corredor. */
  lockdown() {
    if (!AREA.lab.refs || !AREA.lab.refs.sideDoor) return;
    setSideDoor(false, false); D.lockdown = { t: 0, dur: 7, flashT: 0 };
    sfx.slam(); sfx.siren(); G.shake = Math.max(G.shake, 0.45);
    burst(-17, 1.6, 11.3, 'dust', 18, 2.5); flashAt(-17, 3, 14, 0xff2010, 120);
    const L = AREA.lab.refs.roomLamp; if (L) { L.color = 0xff2020; L.mode = 'pulse'; L.base = 30; }
    ui.announce('PROTOCOLO DA DIRETORIA — a porta blindada trancou!', '#ff6050');
    story.say(story.LINES.lockdown, 'lockdown', true);
    makeNoise(-17, 12, 60);  // o alarme chama tudo o que estiver no laboratório
  },
  /** Pântano: bolhas e ronco antes dos raptores saírem da lama. */
  mud(e) {
    const z = e.zone; sfx.mudBurst();
    for (let i = 0; i < 3; i++) setTimeoutGame(0.25 + i * 0.45, () => { burst(z.x + rand(-2.5, 2.5), 0.15, z.z + rand(-3, 3), 'dust', 8, 1.6); if (i === 1) sfx.mudBurst(); });
    setTimeoutGame(4.5, () => story.say(story.LINES.mud, 'mud'));
  },
  // ---------- v7: Ato 2 ----------
  /** Margem: o Brandt aparece de terno rasgado e some na trilha do acampamento. */
  brandtGlimpse(e) {
    showBrandt(-1, 3, Math.PI);
    setTimeoutGame((e.delay || 0) + 2.6, () => {
      if (!D.area || D.area.id !== 'margem') return;
      story.say(story.LINES.brandt_glimpse, 'brandt_glimpse', true);
      brandtRun([{ x: -5, z: 9 }, { x: -8, z: 14 }, { x: -8, z: 20.5 }], 5.4, () => { hideBrandt(); D.mapDirty = true; });
    });
  },
  /** Acampamento: o Brandt abre as jaulas e foge pelo portão sul, trancando-o. */
  brandtFlee() {
    showBrandt(-1, 15, Math.PI);
    setTimeoutGame(1.2, () => story.say(story.LINES.brandt_camp, 'brandt_camp', true));
    setTimeoutGame(2.6, () => {
      if (!D.area || D.area.id !== 'acampamento') return;
      openCages(D.area, false); sfx.alarm(); sfx.slam(); makeNoise(0, 10, 60);
      flashAt(0, 3, 14, 0xff3020, 120); G.shake = Math.max(G.shake, 0.3);
      brandtRun([{ x: 4, z: 16.5 }, { x: 4, z: 21 }], 5.6, () => { hideBrandt(); sfx.slam(); ui.feed('O Brandt trancou o portão sul por fora', '#ff8a70'); D.mapDirty = true; });
    });
  },
  /** Ninho: cartão, sinalizador do Brandt (barulho) e a Matriarca desperta. */
  nestAwaken() {
    cardWhenFree(story.BEATS.nest, () => {
      if (!D.area || D.area.id !== 'ninho') return;
      story.say(story.LINES.nest_brandt, 'nest_brandt', true);
      flashAt(brandt.pos.x, 1.4, brandt.pos.z, 0xff3020, 220); burst(brandt.pos.x, 1.2, brandt.pos.z, 'spark', 20, 3); sfx.siren();
      makeNoise(brandt.pos.x, brandt.pos.z, 80);
      brandtRun([{ x: 6, z: 13 }, { x: 14, z: 8.5 }, { x: 19.5, z: 6 }], 5.6, () => brandtCower());
    });
  },
};
// ---------- v7: o Brandt e as jaulas ----------
function setupBrandt(a) {
  hideBrandt();
  if (a.id !== 'ninho') return;
  if (F.brandt === 'caught') { showBrandt(a.dock.x, a.dock.z, -Math.PI / 2); brandtCaught(); }
  else if (!F.brandt && F.nestClear) { showBrandt(a.dock.x, a.dock.z, -Math.PI / 2); brandtCower(); }
  else if (!F.brandt) showBrandt(1.5, 13.6, Math.PI);
  if (a.refs.boat) a.refs.boat.position.x = F.brandt === 'escaped' ? 80 : 27.5;
  if (F.nestDestroyed) nestDestroyedLook(a);
}
function openCages(a, instant) {
  for (const g of (a.refs && a.refs.cageGates) || []) {
    if (g.open) continue; g.open = 1;
    const i = a.ctx.boxes.indexOf(g.box); if (i >= 0) a.ctx.boxes.splice(i, 1);
    if (D.area === a) { const j = boxes.indexOf(g.box); if (j >= 0) boxes.splice(j, 1); }
    if (instant) g.mesh.position.y = g.h + 0.2;
  }
}
function arrestBrandt() {
  F.brandt = 'caught'; brandtCaught(); G.score += 1000;
  objectiveDone('Otávio Brandt está preso');
  ui.banner('BRANDT PRESO', 'Agora chame o Garça-1 na marca H', 3.2);
  ui.floater('+1000 JUSTIÇA', player.pos.x, 2.6, player.pos.z, 'kill');
  story.clearSpeech(); story.say(story.LINES.brandt_caught, 'brandt_caught', true);
}
function brandtEscaped(inArea) {
  F.brandt = 'escaped'; D.mapDirty = true;
  if (inArea) {
    brandtRun([{ x: 23, z: 6 }, { x: 26.5, z: 6 }], 6, () => { hideBrandt(); D.boatGo = true; });
    ui.banner('O BRANDT FUGIU', 'O barco desce o rio com a maleta de amostras', 3);
    story.say(story.LINES.brandt_escaped, 'brandt_escaped', true);
  } else hideBrandt();
}
function nestDestroyedLook(a) {
  if (a.refs.eggs) a.refs.eggs.visible = false;
  if (a.refs.eggLight) { a.refs.eggLight.color = 0xff7a30; a.refs.eggLight.mode = 'fire'; a.refs.eggLight.halo.material.color.setHex(0xff7a30); }
}
function startCharges(it) {
  D.event = { kind: 'charges', t: 0, dur: 9, bursts: [0, 4], bi: 0, x: it.x, z: it.z, range: 9, warnT: 0, waves: CHARGE_WAVES, warn: 'Fique perto das cargas!' };
  sfx.alarm(); makeNoise(it.x, it.z, 50);
  ui.announce('Plantando cargas — as crias vão defender o ninho!', '#ffb070');
  story.say(story.LINES.charges, 'charges', true);
}
function detonateNest() {
  const a = D.area, n = a.nest;
  F.nestDestroyed = true; D.fuse = 0;
  sfx.explosion(); setTimeoutGame(0.35, () => sfx.explosion());
  flashAt(n.x, 2, n.z, 0xffa040, 320); shockwave(n.x, n.z, 9, 0xffa040); shockwave(n.x, n.z, 5, 0xff5020);
  burst(n.x, 1, n.z, 'fire', 40, 6); burst(n.x, 1, n.z, 'dust', 30, 5); decal(n.x, n.z, 5, 0x0a0806);
  G.shake = Math.max(G.shake, 1.1); nestDestroyedLook(a);
  objectiveDone('Ninho RAIZ destruído'); G.score += SCORE.OBJECTIVE;
  ui.banner('NINHO DESTRUÍDO', 'A cratera treme — chame o Garça-1 na marca H!', 3.4);
  story.say(story.LINES.charges_done, 'charges_done', true);
}
function endLockdown(instant) {
  const L = AREA.lab.refs && AREA.lab.refs.roomLamp; if (L) { L.color = 0xfff0d0; L.mode = 'steady'; L.base = 18; }
  D.lockdown = null;
  if (F.power) setSideDoor(true, instant);
}
function updateLockdown(dt) {
  const K = D.lockdown; if (!K) return;
  K.t += dt;
  if ((K.flashT -= dt) <= 0) { K.flashT = 0.9; flashAt(-17, 3.2, 14, 0xff1a10, 70); sfx.siren(); }
  if (K.t >= K.dur) {
    endLockdown(false); sfx.door(); sfx.stinger('ambush');
    ui.announce('A porta está abrindo — tem coisa esperando no corredor!', '#ff9a80');
    story.say(story.LINES.lockdown_open, 'lockdown_open');
  }
}
// temporizador simples sincronizado com o jogo (pausa junto)
const timers = [];
function setTimeoutGame(t, fn) { if (t <= 0) fn(); else timers.push({ t, fn }); }
/** Abre um cartão de história só quando não há troca de área em andamento. */
function cardWhenFree(pages, cb) { if (D.trans || G.state !== 'play') setTimeoutGame(0.3, () => cardWhenFree(pages, cb)); else story.showCard(pages, cb); }

function startTransition(door) {
  const destination = AREA[door.to], ref = D.area.refs.doors[door.id], dir = doorVectors(door.side);
  if (!destination || !ref || !dir || D.trans) return;
  const center = ref.group.position;
  const T = D.trans = {
    t: 0, door, ref, destination, dir, ready: false, error: null,
    from: { x: pg.position.x, z: pg.position.z, yaw: G.yaw },
    end: { x: center.x + dir.x * 0.75, z: center.z + dir.z * 0.75 },
    shot: { x: center.x - dir.x * 6.5 + dir.z * 0.8, y: 2.3, z: center.z - dir.z * 6.5 - dir.x * 0.8,
      tx: center.x, ty: 1.55, tz: center.z },
    scene: passageFor(D.area.id, destination.id, D.st[destination.id].visited, story.S.said),
    sceneActive: false, sceneTime: 0, switched: false, preparing: false, closingSound: false,
  };
  ref.gate.visible = gateVisible(false, true);
  G.transitioning = true; clearInput(); story.clearSpeech(); pg.visible = true;
  player.inv = Math.max(player.inv, WORLD.FADE * 2 + 0.6);
  sfx.doorOpen();
}
// Deixa pelo menos um quadro da abertura aparecer antes de preparar o destino.
// A construção é síncrona no navegador; o pré-carregamento vizinho continua ativo.
function prepareTransition(T) {
  if (T.preparing) return;
  T.preparing = true;
  requestAnimationFrame(() => setTimeout(() => {
    if (D.trans !== T) return;
    try {
      if (!isBuilt(T.destination)) { const ms = buildArea(T.destination); streamStats.syncBuilds++; streamStats.lastSyncMs = Math.round(ms); }
      T.arrival = safeDoorArrival(T.destination, T.door.toDoor, player.r, WORLD.DOOR_DEPTH);
      if (!T.arrival) throw new Error('Nenhum ponto livre próximo à porta de destino');
      // Mesmo se a GPU não concluir em tempo hábil, a porta nunca fica presa.
      let settled = false;
      const finish = () => { if (!settled) { settled = true; if (D.trans === T) T.ready = true; } };
      setTimeout(finish, 2500);
      shaderWarmup.request(T.destination).then(finish, finish);
    } catch (error) { T.error = error; }
  }, 0));
}
function cancelTransition(T) {
  console.error('Não foi possível preparar a passagem:', T.error);
  T.ref.gate.position.y = 0; T.ref.gate.visible = gateVisible(false); pg.position.set(T.from.x, 0, T.from.z); pg.rotation.y = T.from.yaw;
  G.yaw = T.from.yaw; player.moving = false; player.spd = 0;
  clearInput(); D.trans = null; G.transitioning = false; ui.setFade(0);
  ui.feed('Não foi possível abrir a passagem. Tente novamente.', '#ff8a70');
}

export function skipPassage() {
  const T = D.trans;
  if (G.state !== 'play' || !T?.sceneActive) return false;
  clearInput(); ui.hidePassage(); D.trans = null; G.transitioning = false; ui.setFade(0);
  return true;
}
function updateTransition(dt) {
  const T = D.trans;
  if (T.sceneActive) {
    const progress = advancePassage(T.sceneTime, dt, T.scene.duration);
    T.sceneTime = progress.time;
    if (progress.done) skipPassage();
    return;
  }
  if (T.error) { cancelTransition(T); return; }
  if (T.switched) {
    T.fadeIn = Math.min(1, T.fadeIn + dt / WORLD.FADE);
    ui.setFade(1 - T.fadeIn);
    if (T.fadeIn >= 1) {
      ui.setFade(0);
      if (T.scene) { T.sceneActive = true; story.S.said.add(T.scene.key); ui.showPassage(T.scene); }
      else { D.trans = null; G.transitioning = false; }
    }
    return;
  }
  T.t += dt;
  if (T.t >= 0.12) prepareTransition(T);
  const pose = doorPose(T.t, T.ready);
  T.ref.gate.position.y = pose.gate * 3.45;
  if (!T.closingSound && T.t >= DOOR_TIMING.walkEnd) { T.closingSound = true; sfx.doorClose(); }
  const point = { x: T.from.x + (T.end.x - T.from.x) * pose.travel, z: T.from.z + (T.end.z - T.from.z) * pose.travel };
  animateDoorWalk(dt, point, T.dir.yaw, pose.moving);
  ui.setFade(pose.fade);
  if (!pose.switchArea) return;
  enterArea(T.door.to, T.door.toDoor, T.arrival);
  T.switched = true; T.shot = null; T.fadeIn = 0;
  const result = finishStreak(G.cleanStreak);
  if (result.bonus) { addEp(result.bonus); ui.feed(`Travessia limpa: ${result.kills} abates · +${result.bonus} PE`, '#9fe8ff'); }
  streamAround(D.area);
}

// ---------- streaming de áreas (melhor esforço) ----------
// Mantém a área atual + vizinhas construídas; no preset Alto mantém tudo. As demais são descartadas
// depois da transição e reconstruídas (em fatia ociosa) quando o jogador entra numa área vizinha a elas,
// ou na hora, sob o fade, se ele chegar antes.
export const streamStats = { syncBuilds: 0, bgBuilds: 0, unloads: 0, lastSyncMs: 0 };
const shaderWarmup = createShaderWarmup(group =>
  compileShaderVariants(renderer, group, camera, scene, post.composer?.renderTarget1));
onQuality(() => {
  shaderWarmup.invalidate();
  if (G.state !== 'loading') streamAround(D.area);
});
export function warmArea(a, shaders = true) {
  if (isBuilt(a)) { if (shaders && G.state !== 'loading') shaderWarmup.request(a); return; }
  idle(() => {
    if (!isBuilt(a)) { buildArea(a); streamStats.bgBuilds++; }
    if (shaders && G.state !== 'loading') shaderWarmup.request(a);
  }, 'build-' + a.id);
}
export function streamAround(a) {
  if (!a) return;
  const keep = new Set([a, ...neighbors(a)]);
  for (const n of keep) warmArea(n);
  if (!quality.p.stream) { AREAS.forEach((x) => warmArea(x)); return; }
  for (const x of AREAS) if (!keep.has(x) && isBuilt(x) && !shaderWarmup.isBusy(x)) { unloadArea(x); streamStats.unloads++; }
}
// reconstruiu: reaplica estado da campanha que mora nos objetos 3D
onAreaBuilt((a) => {
  if (a.id === 'lab') setSideDoor(!!F.power, true);
  if (a.refs.powerLamps) a.refs.powerLamps.forEach((L) => { L.on = !!F.power; });
  if (a.refs.heli) a.refs.heli.group.visible = false;
  if (a.refs.cageGates && D.enc.has('camp-brandt')) openCages(a, true);
  if (a.id === 'ninho' && F.nestDestroyed) nestDestroyedLook(a);
  syncGates(a, true);
  D.mapDirty = true;
});

// ---------- portas ----------
function nearDoor(d, margin) {
  const b = bounds, p = player.pos;
  const along = d.side === 'N' || d.side === 'S' ? p.x : p.z;
  if (Math.abs(along - d.at) > WORLD.DOOR_HALF + margin * 0.5) return false;
  const depth = d.side === 'N' ? p.z - b.minZ : d.side === 'S' ? b.maxZ - p.z : d.side === 'W' ? p.x - b.minX : b.maxX - p.x;
  return depth < WORLD.DOOR_DEPTH + margin;
}
function pushBack(d) {
  const k = 1.2;
  if (d.side === 'N') player.pos.z += k; else if (d.side === 'S') player.pos.z -= k; else if (d.side === 'W') player.pos.x += k; else player.pos.x -= k;
}
function checkDoors(dt) {
  D.lockMsgT -= dt;
  // A proximidade nunca inicia uma transição. A borda é bloqueada até E.
  for (const d of D.area.doors) if (nearDoor(d, 0)) { pushBack(d); return; }
}
function doorBlocked(d) {
  if (isLocked(D.area.id, d.id)) return LOCK_MSG[d.lock] || 'Porta bloqueada';
  if (D.event && D.event.kind === 'gen') return 'Termine de ligar o gerador!';
  if (D.event && D.event.kind === 'code') return 'Espere a Dra. Lima terminar o código!';
  return null;
}
function nearbyDoor() { return D.area.doors.find((d) => nearDoor(d, 3)); }


// ---------- eventos por área ----------
function startGenerator(term) {
  D.event = { kind: 'gen', t: 0, dur: 20, bursts: [0, 6, 12], bi: 0, x: term.x, z: term.z, range: 14, warnT: 0 };
  sfx.generator(); sfx.alarm(); makeNoise(term.x, term.z, 60);
  ui.announce('O barulho do gerador atrai a matilha! Proteja-o por 20 s', '#ffb070');
}
const GEN_WAVES = [
  [{ type: 'raptor', from: 'E' }, { type: 'raptor', from: 'N', delay: 0.8 }],
  [{ type: 'spitter', from: 'N' }, { type: 'raptor', from: 'S', delay: 0.6 }, { type: 'raptor', from: 'E', delay: 1.4 }],
  [{ type: 'brute', from: 'E' }, { type: 'raptor', from: 'S', delay: 1 }],
];
const RESCUE_WAVES = [
  [{ type: 'raptor', from: 'S' }, { type: 'raptor', from: 'E', delay: 0.5 }],
  [{ type: 'raptor', from: 'W' }, { type: 'spitter', from: 'S', delay: 0.6 }],
  [{ type: 'raptor', from: 'E' }, { type: 'raptor', from: 'W', delay: 0.4 }, { type: 'raptor', from: 'S', delay: 0.9 }],
];
// v7: ondas do Ato 2
const HACK_WAVES = [
  [{ type: 'raptor', from: 'E' }, { type: 'raptor', from: 'W', delay: 0.8 }],
  [{ type: 'spitter', from: 'E' }, { type: 'raptor', from: 'N', delay: 0.6 }, { type: 'raptor', from: 'W', delay: 1.6 }],
  [{ type: 'raptor', from: 'N' }, { type: 'raptor', from: 'E', delay: 0.5 }, { type: 'spitter', from: 'W', delay: 1.2 }],
];
const CHARGE_WAVES = [
  [{ type: 'raptor', x: -9, z: 15, fx: 'egg' }, { type: 'raptor', x: 9, z: 15, delay: 0.6, fx: 'egg' }],
  [{ type: 'spitter', from: 'E' }, { type: 'raptor', from: 'W', delay: 0.8 }],
];
const RESCUE2_WAVES = [
  [{ type: 'raptor', from: 'E' }, { type: 'raptor', from: 'S', delay: 0.5 }],
  [{ type: 'spitter', from: 'E' }, { type: 'raptor', from: 'S', delay: 0.6 }],
  [{ type: 'raptor', from: 'E' }, { type: 'brute', from: 'S', delay: 0.8 }],
];
const WAVES = { gen: GEN_WAVES, rescue: RESCUE_WAVES, hack: HACK_WAVES, charges: CHARGE_WAVES };
const WARN = { gen: 'Fique perto do gerador!', rescue: 'Volte para o heliponto!', hack: 'Fique perto do terminal!' };
function startHack(term) {
  D.event = { kind: 'hack', t: 0, dur: 18, bursts: [0, 6, 12], bi: 0, x: term.x, z: term.z, range: 12, warnT: 0 };
  sfx.alarm(); sfx.siren(); makeNoise(term.x, term.z, 60);
  const L = D.area.refs.gateLamp; if (L) L.base = 40;
  ui.announce('Quebrando a senha — o alarme do portão chama a matilha! Aguente 18 s', '#ffb070');
  story.say(story.LINES.hack_start, 'hack_start', true);
}
function updateEvent(dt) {
  const E = D.event; if (!E) return;
  if (E.ep0 === undefined) { E.ep0 = G.epTotal; E.dmg0 = G.dmgTaken || 0; } // v10: referência do bônus "sem dano"
  const near = Math.hypot(player.pos.x - E.x, player.pos.z - E.z) < E.range;
  if (near || E.kind === 'code') E.t += dt;
  else if ((E.warnT -= dt) <= 0) { ui.feed(E.warn || WARN[E.kind] || 'Volte!', '#ffb070'); E.warnT = 2; }
  while (E.bursts && E.bi < E.bursts.length && E.t >= E.bursts[E.bi]) {
    const W = (E.waves || WAVES[E.kind])[E.bi++];
    W.forEach((s) => D.queue.push({ ...s, t: s.delay || 0, eventKind: E.kind }));
  }
  if (E.kind === 'rescue') {
    if (!E.s1 && E.t > 4) { E.s1 = true; story.say(story.LINES[E.lines ? E.lines[0] : 'rescue_mid']); }
    if (!E.s2 && E.t > E.dur - 5.5) { E.s2 = true; story.say(story.LINES[E.lines ? E.lines[1] : 'rescue_near']); }
  }
  if (E.t < E.dur) return;
  D.event = null;
  // v10: evento de defesa terminado sem levar dano → +25% do PE ganho nele (mínimo EP.CLEAN_MIN)
  if (E.kind !== 'code' && (G.dmgTaken || 0) === E.dmg0) {
    const b = addEp(Math.max(EP.CLEAN_MIN, (G.epTotal - E.ep0) * EP.CLEAN));
    ui.floater(`+${b} PE SEM DANO`, player.pos.x, 2.9, player.pos.z, 'ep');
    ui.feed(`Sem levar dano — bônus de ${b} PE`, '#9fe8ff');
  }
  if (E.kind === 'gen') {
    F.power = true; setPower(true); setSideDoor(true, true);
    powerLampsOn(true); atmo.powerFlash = 1; ui.powerFlash();
    flashAt(E.x, 2.5, E.z, 0xfff0c0, 220); G.shake = Math.max(G.shake, 0.35);
    sfx.powerOn(); ui.banner('ENERGIA RESTAURADA', 'Portão norte do laboratório e sala da diretoria destravados', 3.2);
    objectiveDone();
    setTimeoutGame(2.2, () => cardWhenFree(story.BEATS.power, () => story.say(story.LINES.power_after, 'power_after')));
  } else if (E.kind === 'code') {
    F.heliCode = true; syncGates(D.area, false);
    ui.banner('CÓDIGO ACEITO', 'Portão leste do pátio liberado — o heliponto está aberto', 3.4);
    objectiveDone();
    setTimeoutGame(1.2, () => cardWhenFree(story.BEATS.code));
  } else if (E.kind === 'hack') {
    F.campGate = true; syncGates(D.area, false);
    const L = D.area.refs.gateLamp; if (L) { L.color = 0x40ff80; L.mode = 'steady'; L.base = 22; }
    ui.banner('SENHA QUEBRADA', 'Portão sul do acampamento aberto — o rastro do Brandt segue para o ninho', 3.4);
    objectiveDone();
    setTimeoutGame(1.4, () => cardWhenFree(story.BEATS.camp_gate, () => story.say(story.LINES.brandt_taunt, 'brandt_taunt', true)));
  } else if (E.kind === 'charges') {
    D.fuse = 6; sfx.alarm();
    ui.announce('Cargas armadas! Afaste-se do ninho — 6 s', '#ff6050');
  } else if (E.kind === 'rescue') {
    if (D.area.id === 'ninho') { F.act2Win = true; if (!F.brandt) F.brandt = 'escaped'; }
    F.rescued = true; G.score += SCORE.OBJECTIVE * 2; D.objectives++;
    if (D.heli) D.heli.landing = true;
    if (onWin) onWin();
  }
}

/** Inicia a extração apenas por interação explícita com o sinalizador da marca H. */
function startRescue() {
  const a = D.area;
  if (!a || D.trans || D.event || F.rescued) return false;
  const nest = a.id === 'ninho';
  if (nest ? (!F.nestClear || D.fuse > 0) : (a.id !== 'heliponto' || !F.bossDead || F.act2)) return false;
  const h = a.helipad;
  if (!h || Math.hypot(player.pos.x - h.x, player.pos.z - h.z) > h.r) return false;
  D.event = { kind: 'rescue', t: 0, dur: 14, bursts: [1, 5, 9], bi: 0, x: h.x, z: h.z, range: h.r + 3, warnT: 0 };
  if (nest) Object.assign(D.event, { waves: RESCUE2_WAVES, warn: 'Volte para a marca H da clareira!', lines: ['rescue2_mid', 'rescue_near'] });
  sfx.alarm(); ui.announce('Sinalizador acionado! Aguente até o helicóptero chegar', '#ffe070');
  flashAt(h.x, 1, h.z, 0xff3020, 160);
  story.say(story.LINES[nest ? 'rescue2_start' : 'rescue_start'], nest ? 'rescue2_start' : 'rescue_start', true);
  if (a.refs.heli) D.heli = { t: 0, landing: false, chopT: 0 };
  D.mapDirty = true;
  return true;
}

// ---------- interação (tecla E) ----------
function interactables() {
  const out = [], a = D.area;
  if (survivor.visible && survivor.downT > 0) out.push({ kind: 'revive', x: survivor.pos.x, z: survivor.pos.z, near: 3 });
  for (const t of a.refs.terminals) out.push({ kind: t.kind, x: t.x, z: t.z, t });
  if (a.id === 'patio' && survivor.visible && !survivor.following && !F.heliCode) out.push({ kind: 'survivor', x: survivor.pos.x, z: survivor.pos.z });
  if (a.id === 'patio' && survivor.visible && F.heliCode && !D.event) out.push({ kind: 'talk', x: survivor.pos.x, z: survivor.pos.z });
  for (const l of a.refs.logs || []) out.push({ kind: 'log', x: l.x, z: l.z, l });
  // A extração é uma decisão: primeiro interaja com a marca H (o rio continua opcional).
  if (!D.event && !F.rescued && a.helipad && ((a.id === 'heliponto' && F.bossDead && !F.act2) || (a.id === 'ninho' && F.nestClear && D.fuse <= 0))) {
    out.push({ kind: 'rescue', x: a.helipad.x, z: a.helipad.z, near: a.helipad.r });
  }
  // v6: segredo — depois de ler o rádio da Tellus-2 (log9), dá para transmitir as provas no canal aberto
  if (a.id === 'heliponto' && story.S.logs.has('log9') && !F.broadcast) {
    const l = (a.refs.logs || []).find((x) => x.id === 'log9');
    if (l) out.push({ kind: 'broadcast', x: l.x - 1.2, z: l.z - 0.9 });
  }
  // v7: ninho — prender o Brandt e (opcional) plantar cargas nos ovos
  if (a.id === 'ninho' && F.nestClear) {
    if (!F.brandt && brandt.visible && brandt.state !== 'caught') out.push({ kind: 'arrest', x: brandt.pos.x, z: brandt.pos.z, near: 3 });
    if (!F.nestDestroyed && !D.event && !(D.fuse > 0)) out.push({ kind: 'charges', x: a.nest.x, z: a.nest.z - 3.4 });
  }
  return out;
}
function nearestInteract() {
  let best = null, bd = 2.4;
  for (const it of interactables()) {
    const d = Math.hypot(it.x - player.pos.x, it.z - player.pos.z) - (it.near ? it.near - 2.4 : 0); // levantar a Lima tem alcance maior
    if (d >= bd) continue;
    if (it.kind === 'log' && (!canAccessRecord(it.l.id, F, D.lockdown) || !canSeeRecord(player.pos, it, castWorld))) continue;
    bd = d; best = it;
  }
  return best;
}
function promptFor(it) {
  if (!it) return null;
  switch (it.kind) {
    case 'save': return terminalDanger() ? { text: 'Perigo por perto — não dá para usar o terminal', locked: true } : { text: 'Terminal TELLUS — salvar / loja' };
    case 'generator':
      if (F.power) return { text: 'Gerador funcionando', locked: true };
      if (D.event) return { text: 'Gerador ligando...', locked: true };
      return { text: 'Ligar o gerador' };
    case 'control':
      if (F.heliCode) return { text: 'Portão do heliponto liberado', locked: true };
      return { text: `Precisa da ${survivor.name} para o código`, locked: true };
    case 'revive': return { text: `⚠ Levantar a ${survivor.name}`, urgent: true };
    case 'survivor': return { text: `Falar com ${survivor.name}` };
    case 'talk': return { text: `Conversar com ${survivor.name}` };
    case 'log': return { text: `Ler registro: ${story.LOGS[it.l.id].title}${story.S.logs.has(it.l.id) ? ' (lido)' : ''}` };
    case 'broadcast':
      if (!F.bossDead) return { text: '📻 Rádio de campo — o Colosso está perto demais para transmitir', locked: true };
      return { text: '📻 Transmitir provas no canal aberto' };
    case 'hack':
      if (F.campGate) return { text: 'Portão sul liberado', locked: true };
      if (D.event) return { text: 'Quebrando a senha...', locked: true };
      return { text: 'Quebrar a senha do portão sul (o alarme atrai a matilha)' };
    case 'rescue': return { text: D.area.id === 'ninho' ? 'Acionar sinalizador — concluir o Ato 2' : 'Acionar sinalizador — encerrar o Ato 1', urgent: true };
    case 'arrest': return { text: '⛓ Prender Otávio Brandt', urgent: true };
    case 'charges': return { text: '💣 Plantar cargas no ninho (opcional)' };
  }
  return null;
}
export function interact() {
  if (G.state !== 'play' || D.trans || player.dead) return;
  const it = nearestInteract();
  if (!it) {
    const d = nearbyDoor(); if (!d) return;
    const blocked = doorBlocked(d);
    if (blocked) { if (D.lockMsgT <= 0) { ui.feed(blocked, '#ff8a70'); sfx.locked(); D.lockMsgT = 2; } return; }
    if (!AREA[d.to] || !AREA[d.to].doors.some((other) => other.id === d.toDoor && other.to === D.area.id)) { ui.feed('Passagem indisponível', '#ff8a70'); return; }
    startTransition(d); return;
  }
  if (it.kind === 'revive') { reviveSurvivor(true); story.clearSpeech(); story.sayOne('LIMA', REVIVE_LINES[survivor.downs % REVIVE_LINES.length]); return; }
  if (it.kind === 'save') {
    // v10: o terminal abre o menu SALVAR · LOJA · SAIR — mas não com perigo por perto
    if (terminalDanger()) { ui.feed('Perigo por perto — não dá para usar o terminal', '#ff8a70'); sfx.locked(); return; }
    openTerminal({ onSave: () => saveGame(it.t), flags: F, area: D.area.name });
  }
  else if (it.kind === 'generator' && !F.power && !D.event) startGenerator(it);
  else if (it.kind === 'control' && !F.heliCode) ui.feed(`Traga a ${survivor.name} até aqui`, '#ffb070');
  else if (it.kind === 'survivor') {
    resumeEscort(); F.escort = true; D.survivorMemory = null;
    ui.banner(survivor.name.toUpperCase(), 'Escolte-a até o terminal de controle (nordeste)', 3.2);
    story.clearSpeech(); story.say(story.LINES.greet); D.barkT = 14;
    sfx.objective(); D.mapDirty = true;
  } else if (it.kind === 'talk') {
    story.clearSpeech(); story.sayOne('LIMA', story.POST_CODE[D.talkI++ % story.POST_CODE.length]);
  } else if (it.kind === 'log') readLog(it.l.id);
  else if (it.kind === 'broadcast' && F.bossDead) broadcast();
  else if (it.kind === 'rescue') startRescue();
  else if (it.kind === 'hack' && !F.campGate && !D.event) startHack(it);
  else if (it.kind === 'arrest' && !F.brandt) arrestBrandt();
  else if (it.kind === 'charges' && !F.nestDestroyed && !D.event) startCharges(it);
}
/** v6: segredo — transmite as provas; muda o epílogo do final alternativo. */
function broadcast() {
  F.broadcast = true; G.score += 500; D.mapDirty = true;
  sfx.objective(); ui.banner('CANAL ABERTO', 'Provas transmitidas para a costa inteira', 3);
  ui.floater('+500 SEGREDO', player.pos.x, 2.6, player.pos.z, 'kill');
  story.clearSpeech(); story.say(story.LINES.broadcast, 'broadcast', true);
}
const REVIVE_LINES = ['Obrigada... continua!', 'Estou bem, estou bem — vamos!', 'Essa foi perto. Não para!'];
function readLog(id) {
  const first = !story.S.logs.has(id);
  sfx.save();
  story.showCard(story.logPages(id), () => {
    if (!first) return;
    story.S.logs.add(id); G.score += 150; D.mapDirty = true;
    ui.floater('+150 REGISTRO', player.pos.x, 2.6, player.pos.z, 'kill');
    ui.floater(`+${addEp(EP.LOG)} PE`, player.pos.x, 2.1, player.pos.z, 'ep'); // v10
    ui.feed(`Registro arquivado (${story.S.logs.size}/${story.TOTAL_LOGS})`, '#9fe8ff');
    if (story.LINES[id]) story.say(story.LINES[id], 'react_' + id);
  });
}

/** v10: terminal travado em evento, troca de área, chefe, sala trancada, pavio ou inimigo em alerta a < EP.DANGER_R. */
function terminalDanger() {
  if (D.event || D.trans || D.boss || F.bossFight || F.nestFight || D.lockdown || D.fuse > 0 || D.queue.length) return true;
  for (const e of enemies) if (!e.dead && (e.alert || e.investigate) && Math.hypot(e.pos.x - player.pos.x, e.pos.z - player.pos.z) < EP.DANGER_R) return true;
  return false;
}

// ---------- save / load ----------
function saveGame(term) {
  const a = D.area;
  rememberAreaThreats(a); // incluir posição, vida e busca dos inimigos no save
  const off = 1.6, yaw = term.group.rotation.y;
  const at = { x: term.x + Math.sin(yaw) * off, z: term.z + Math.cos(yaw) * off, yaw: yaw + Math.PI };
  const data = {
    // v6: v2 = 3 armas + colete (saves v1 são migrados em restoreBag)
    // v7: v3 — corrige o save v2, que perdia flags/estado das áreas/encontros (estavam dentro de um comentário)
    // v10: v4 — Pontos de Extinção (ep/epTotal) e upgrades da loja (bag.up)
    v: 5, cleanStreak: { ...G.cleanStreak }, area: a.id, at, ep: G.ep, epTotal: G.epTotal,
    flags: { ...F, escort: !!F.escort, bossFight: false, nestFight: false },
    survivor: a.id === 'patio' ? snapshotSurvivor() : D.survivorMemory,
    st: D.st, enc: [...D.enc],
    bag: { ...snapshotBag(), hp: PLAYER.HP }, objectives: D.objectives, story: story.storySave(),
    stats: { score: G.score, kills: G.kills, shots: G.shots, hits: G.hits, elapsed: G.elapsed, saves: G.saves + 1 },
  };
  if (!writeSave(data)) return false;
  player.hp = PLAYER.HP; G.saves++; ui.setHasSave(true);
  sfx.save(); burst(player.pos.x, 1.2, player.pos.z, 'spark', 14, 2);
  ui.banner('PROGRESSO SALVO', 'Vida restaurada — ' + a.name, 2.2);
  return true;
}
export function hasSave() { return !!readSave(); }

/** Novo jogo (cais) ou continuar do último terminal. */
export function startCampaign(fromSave) {
  const s = fromSave ? readSave() : null;
  clearEnemies(); clearPickups(); clearFx(); resetCombat(); ui.clearFloaters(); ui.clearMessages(); timers.length = 0;
  resetPlayer(); resetCampaign(); D.area = null; G.cleanStreak = normalizeStreak(s && s.cleanStreak);
  Object.assign(G, { score: 0, kills: 0, shots: 0, hits: 0, elapsed: 0, shake: 0, saves: 0, ep: 0, epTotal: 0, dmgTaken: 0 });
  AREAS.forEach((a) => { if (a.refs && a.refs.powerLamps) a.refs.powerLamps.forEach((L) => { L.on = false; }); });
  story.resetStory(s && s.story);
  if (s && !AREA[s.area]) { console.warn('save com área desconhecida — ignorado'); return startCampaign(false); }
  if (s) {
    Object.assign(F, s.flags || {});
    D.survivorMemory = s.survivor || null;
    for (const id in s.st || {}) if (D.st[id]) Object.assign(D.st[id], s.st[id]);
    (s.enc || []).forEach((x) => D.enc.add(x));
    // v7: migração de saves v1/v2 (sem flags): deduz o progresso pela área do terminal
    if (!s.v || s.v < 3) {
      if (s.area === 'patio' || s.area === 'heliponto') { F.power = true; D.st.lab.visited = D.st.pantano.visited = D.st.patio.visited = true; }
      if (s.area === 'heliponto' || (D.st.heliponto && D.st.heliponto.visited)) F.heliCode = true;
      if (s.area === 'patio') D.enc.add('lockdown');
    }
    AREAS.forEach((a) => { if (D.st[a.id].visited) D.visited.add(a.id); });
    restoreBag(s.bag || {}); D.objectives = s.objectives || 0; // v10: restoreBag aplica os upgrades antes do pente
    Object.assign(G, s.stats);
    G.ep = Math.max(0, s.ep | 0); G.epTotal = Math.max(G.ep, s.epTotal | 0); // saves v1–v3: começam com 0 PE
    setPower(!!F.power); setSideDoor(!!F.power, true);
    enterArea(s.area, null, s.at);
    ui.banner('JOGO CARREGADO', AREA[s.area].name, 2.2);
  } else { setPower(false); setSideDoor(false, true); enterArea('porto'); }
  streamAround(D.area);
}

// ---------- ganchos de combate ----------
let onWin = null;
export function setWinHandler(fn) { onWin = fn; }
enemyEvents.onKilled = (e) => {
  if (e.ambientIdx !== undefined && D.area) { const s = D.st[D.area.id]; if (!s.dead.includes(e.ambientIdx)) s.dead.push(e.ambientIdx); }
  if (e.type === 'matriarca') {
    F.nestFight = false; F.nestClear = true; D.boss = null; syncGates(D.area, false);
    sfx.bossRoar(); ui.banner('MATRIARCA ABATIDA', 'O Brandt está ligando o barco no cais — prenda-o!', 3.6);
    objectiveDone(); G.score += SCORE.OBJECTIVE;
    bossGlow(null); flashAt(e.pos.x, 2, e.pos.z, 0x40ff80, 260); G.shake = Math.max(G.shake, 0.9);
    D.brandtT = 40; D.brandtWarn = 0;
    if (brandt.visible && brandt.state !== 'run') brandtCower();
    setTimeoutGame(1.4, () => story.say(story.LINES.nest_clear, 'nest_clear', true));
  } else if (e.cfg.boss) {
    F.bossFight = false; F.bossDead = true; D.boss = null; syncGates(D.area, false);
    // a matilha foge quando o alfa cai
    sfx.bossRoar(); ui.banner('COLOSSO ABATIDO', 'Aperte E na marca H para resgate, ou siga pelo portão leste!', 4.2);
    objectiveDone(); G.score += SCORE.OBJECTIVE;
    bossGlow(null); flashAt(e.pos.x, 2, e.pos.z, 0xff6020, 260); G.shake = Math.max(G.shake, 0.9);
    setTimeoutGame(1.4, () => story.say(story.LINES.boss_dead, 'boss_dead', true));
    // v5: rádio interceptado — a equipe da Tellus já está no vale procurando as caixas do RAIZ
    setTimeoutGame(10, () => { if (!F.rescued) story.say(story.LINES.intercept, 'intercept'); });
    // v7: a Dra. Lima oferece o Ato 2 (rio abaixo atrás do Brandt)
    setTimeoutGame(24, () => { if (!F.rescued && !F.act2 && !(D.event && D.event.kind === 'rescue')) { story.say(story.LINES.act2_offer, 'act2_offer'); D.mapDirty = true; } });
  }
};
enemyEvents.onBossPhase = (e, ph) => {
  if (e.type === 'matriarca') {
    ui.announce(ph === 1 ? 'A Matriarca chama as crias dos ovos!' : 'A Matriarca está FURIOSA!', '#60ff90');
    D.queue.push({ t: 0.6, type: 'raptor', x: -3.2, z: 9, fx: 'egg' }, { t: 1.2, type: 'raptor', x: 3.2, z: 9, fx: 'egg' });
    if (ph === 2) D.queue.push({ t: 2, type: 'spitter', from: 'E' }, { t: 2.6, type: 'raptor', x: 0, z: 12.5, fx: 'egg' });
    story.say(story.LINES[ph === 1 ? 'nest_phase1' : 'nest_phase2'], 'nest_phase' + ph);
    return;
  }
  ui.announce(ph === 1 ? 'O Colosso chama a matilha!' : 'O Colosso está FURIOSO!', '#ff60ff');
  D.queue.push({ t: 0.5, type: 'raptor', from: 'E' }, { t: 1.1, type: 'raptor', from: 'S' });
  if (ph === 2) D.queue.push({ t: 2, type: 'spitter', from: 'N' });
  story.say(story.LINES[ph === 1 ? 'boss_phase1' : 'boss_phase2'], 'boss_phase' + ph);
};
combatEvents.onWorldPickup = (id) => { if (D.area) D.st[D.area.id].taken.push(id); D.mapDirty = true; };

// ---------- atualização por quadro ----------
export function updateDirector(dt) {
  if (D.trans) { updateTransition(dt); return; }
  for (let i = timers.length - 1; i >= 0; i--) { timers[i].t -= dt; if (timers[i].t <= 0) { const f = timers[i].fn; timers.splice(i, 1); f(); } }
  const a = D.area;
  const nest = a && a.id === 'ninho'; // utilizado no controle de Brandt, ovos e barco
  // fila de spawns
  for (let i = D.queue.length - 1; i >= 0; i--) {
    const q = D.queue[i]; q.t -= dt; if (q.t > 0) continue;
    D.queue.splice(i, 1);
    if (q.kind === 'revisit-cue') { ui.announce(q.message, '#ffb070'); sfx.siren(); sfx.stinger('ambush'); continue; }
    const e = q.x !== undefined ? spawnEnemy(q.type, q.x, q.z) : spawnEnemy(q.type, undefined, undefined, { from: q.from });
    if (q.fx === 'egg') { burst(e.pos.x, 0.8, e.pos.z, 'spit', 18, 3); shockwave(e.pos.x, e.pos.z, 1.8, 0x40ff80); sfx.mudBurst(); }
    if (q.fx === 'mud') { burst(e.pos.x, 0.3, e.pos.z, 'dust', 26, 4.5); decal(e.pos.x, e.pos.z, 2.6, 0x1a1408); shockwave(e.pos.x, e.pos.z, 2.2, 0x8a7a50); sfx.mudBurst(); G.shake = Math.max(G.shake, 0.3); }
    if (e.cfg.boss) {
      D.boss = e; G.shake = 0.8;
      if (e.type === 'matriarca') ui.banner('A MATRIARCA', 'Guardiã do ninho — faça-a bater nos pilares de pedra', 3.6);
      else ui.banner('O COLOSSO', 'Atraia-o contra as paredes: atordoado, ele fica vulnerável', 3.6);
    }
  }
  // encontros por zona / por flag
  for (const e of a.encounters) {
    if (D.enc.has(e.id)) continue;
    if (e.on === 'zone' && (!e.flag || F[e.flag]) && Math.hypot(player.pos.x - e.zone.x, player.pos.z - e.zone.z) < e.zone.r) fireEncounter(e);
    else if (e.on === 'flag' && F[e.flag]) fireEncounter(e);
  }
  checkDoors(dt);
  if (D.trans) return;
  // streaming: chegando perto de um portão cuja área foi descarregada → reconstrói em segundo plano
  if ((D.streamT = (D.streamT || 0) - dt) <= 0) {
    D.streamT = 0.5;
    for (const d of a.doors) if (!isBuilt(AREA[d.to]) && nearDoor(d, 12)) warmArea(AREA[d.to]);
  }
  // portões animados
  for (const d of a.doors) {
    const ref = a.refs.doors[d.id], open = !isLocked(a.id, d.id);
    if (ref.open !== open) { ref.open = open; setDoorLight(ref, open); if (open) sfx.door(); }
    ref.gate.position.y = damp(ref.gate.position.y, 0, 3, dt);
    ref.gate.visible = gateVisible(!open);
  }
  // escolta: chegou ao terminal de controle
  if (a.id === 'patio' && F.escort && !F.heliCode && !D.event && survivor.following) {
    const z = a.controlZone;
    if (survivor.downT <= 0 && Math.hypot(survivor.pos.x - z.x, survivor.pos.z - z.z) < z.r + 0.8) {
      survivor.following = false; survivor.goal = { ...CONTROL_SPOT };
      D.event = { kind: 'code', t: 0, dur: 4, x: z.x, z: z.z, range: 99 };
      ui.feed(`${survivor.name} está digitando o código...`, '#a0ffb0');
      story.clearSpeech(); story.say(story.LINES.code_start);
    }
  }
  // O jogador decide quando chamar o Garça-1 pela tecla E na marca H.
  // Entrar na pista não encerra mais a missão por acidente.
  // v7: Brandt ligando o barco (contagem) / pavio das cargas / barco indo embora
  if (nest && F.nestClear && !F.brandt && D.brandtT > 0) {
    D.brandtT -= dt;
    const w = D.brandtT < 10 ? 2 : D.brandtT < 20 ? 1 : 0;
    if (w > (D.brandtWarn || 0)) { D.brandtWarn = w; sfx.alarm(); ui.announce(w === 2 ? 'O motor pegou! 10 s para o Brandt fugir!' : 'O Brandt está quase ligando o barco — 20 s!', '#ff8a70'); }
    if (D.brandtT <= 0) brandtEscaped(true);
  }
  if (D.fuse > 0) {
    D.fuse -= dt;
    if (Math.floor(D.fuse * 2) !== Math.floor((D.fuse + dt) * 2)) sfx.locked();
    if (D.fuse <= 0) detonateNest();
  }
  if (nest && D.boatGo && a.refs.boat) { const bt = a.refs.boat; if (bt.position.x < 80) { bt.position.x += dt * 7; bt.position.z += dt * 2.5; } }
  if (a.refs.cageGates) for (const g of a.refs.cageGates) if (g.open) g.mesh.position.y = damp(g.mesh.position.y, g.h + 0.2, 2.2, dt);
  if (nest && a.refs.eggMat && !F.nestDestroyed) a.refs.eggMat.emissiveIntensity = 0.45 + 0.3 * Math.sin(G.time * (F.nestFight ? 5 : 1.8));
  updateEvent(dt);
  updateLockdown(dt);
  // terminais piscando
  for (const t of a.refs.terminals) t.glow.material.opacity = 0.45 + 0.25 * Math.sin(G.time * 3 + t.x);
  // tablets de registro: não lidos pulsam em ciano; lidos ficam apagados
  for (const l of a.refs.logs || []) {
    const read = story.S.logs.has(l.id);
    l.glow.material.opacity = read ? 0.08 : 0.35 + 0.25 * Math.sin(G.time * 4 + l.x);
    l.screenMat.color.setHex(read ? 0x2a4a58 : 0x60e0ff);
  }
  // porta da diretoria descendo
  const sd = a.refs.sideDoor;
  if (sd && sd.y0 !== undefined) { const ty = sd.open ? sd.y0 - 3.3 : sd.y0; sd.mesh.position.y = damp(sd.mesh.position.y, ty, 2.5, dt); }
  // arena do chefe: névoa vermelha + brilho que segue o Colosso
  atmo.haze = damp(atmo.haze, (F.bossFight && a.id === 'heliponto') || (F.nestFight && a.id === 'ninho') ? 1 : 0, 1.2, dt);
  if (D.boss && !D.boss.dead) bossGlow(D.boss.pos, 0.8 + 0.4 * Math.sin(G.time * 6) + (D.boss.stun > 0 ? 0.8 : 0)); else if (!D.boss) bossGlow(null);
  // escolta: falas da Dra. Lima
  if (F.escort && !F.heliCode && survivor.following) {
    if ((D.barkT -= dt) <= 0 && !story.speaking()) { D.barkT = rand(13, 19); story.sayOne('LIMA', story.BARKS[Math.floor(Math.random() * story.BARKS.length)]); }
    const down = survivor.downT > 0;
    if (down && !D.wasDown) {
      story.say(story.LINES.lima_down, null, true);
      if (!F.limaTip) { F.limaTip = true; ui.announce(`${survivor.name} caiu! Chegue perto e aperte E para levantá-la`, '#ffb070'); }
    }
    D.wasDown = down;
  }
  const [txt] = objective(); if (txt !== D.lastObj) { D.lastObj = txt; D.mapDirty = true; }
}

const METER_LBL = { gen: 'ENERGIA', code: 'CÓDIGO DO PORTÃO', rescue: 'RESGATE A CAMINHO', hack: 'SENHA DO PORTÃO', charges: 'CARGAS NO NINHO' };
/** Dados do HUD vindos do diretor. */
export function hudData() {
  const a = D.area, [obj, target] = objective();
  const it = D.trans ? null : nearestInteract();
  let prompt = promptFor(it);
  if (!prompt && !D.trans) { const d = nearbyDoor(); if (d) { const reason = doorBlocked(d); prompt = reason ? { text: '🔒 ' + reason, locked: true } : { text: 'Atravessar para ' + AREA[d.to].name }; } }
  const markers = {}; AREAS.forEach((x) => { if (x.save) markers[x.id] = 'save'; });
  markers[target] = '★ ' + (markers[target] ? 'objetivo • save' : 'objetivo');
  const points = a.refs.terminals.map((t) => ({ x: t.x, z: t.z, col: t.kind === 'save' ? '#40ff90' : t.kind === 'generator' ? '#ffb040' : t.kind === 'hack' ? '#ff6040' : '#40c0ff' }));
  for (const d of a.doors) {
    const b = a.bounds, x = d.side === 'W' ? b.minX : d.side === 'E' ? b.maxX : d.at, z = d.side === 'N' ? b.minZ : d.side === 'S' ? b.maxZ : d.at;
    points.push({ x, z, col: isLocked(a.id, d.id) ? '#ff4040' : '#e0e0e0' });
  }
  if (survivor.visible) points.push({ x: survivor.pos.x, z: survivor.pos.z, col: '#60ff90' });
  if (a.helipad && (a.id === 'ninho' ? F.nestClear : F.bossDead && !F.act2)) points.push({ x: a.helipad.x, z: a.helipad.z, col: '#ffe070' });
  if (brandt.visible) points.push({ x: brandt.pos.x, z: brandt.pos.z, col: '#ff6a40' });
  if (a.nest && !F.nestDestroyed) points.push({ x: a.nest.x, z: a.nest.z, col: '#40ff80' });
  for (const l of a.refs.logs || []) if (!story.S.logs.has(l.id)) points.push({ x: l.x, z: l.z, col: '#60e0ff' });
  let sub = '';
  if (F.power && !story.S.logs.has('log5') && !F.bossDead && !F.bossFight) sub = 'Opcional: sala da diretoria (laboratório, oeste)';
  if (D.lockdown) sub = 'Trancado! A porta reabre em ' + Math.max(0, Math.ceil(D.lockdown.dur - D.lockdown.t)) + ' s — prepare-se';
  if (survivor.visible && survivor.downT > 0) sub = `⚠ ${survivor.name} caída — chegue perto e aperte E`;
  else if (a.id !== target && !D.trans) { const w = pathHint(a.id, target); if (w) sub = sub || w; }
  if (a.id === 'ninho' && F.nestClear && !F.brandt && D.brandtT > 0) sub = `⛓ Brandt no cais (leste) — o barco liga em ${Math.ceil(D.brandtT)} s`;
  if (F.bossDead && !F.act2 && !F.rescued && a.id === 'heliponto' && !D.event) sub = sub || 'Escolha: E na marca H encerra o Ato 1; portão leste inicia o Ato 2';
  const E = D.event;
  const dirty = D.mapDirty; D.mapDirty = false;
  return {
    area: a, objective: obj, prompt, boss: D.boss && !D.boss.dead ? D.boss : null,
    meter: E ? { label: METER_LBL[E.kind] + ' ' + Math.floor(100 * Math.min(1, E.t / E.dur)) + '%', k: Math.min(1, E.t / E.dur) } : null,
    visited: D.visited, isLocked, markers, points, mapDirty: dirty, sub,
    logs: story.S.logs.size, logsTotal: F.act2 ? story.TOTAL_LOGS : story.ACT1_LOGS.length,
  };
}
export const currentObjective = () => objective()[0];

/** v5: dica de caminho — próxima porta rumo à área do objetivo (busca em largura no grafo de portas). */
const SIDE_PT = { N: 'norte', S: 'sul', E: 'leste', W: 'oeste' };
function pathHint(from, to) {
  if (!AREA[to]) return '';
  const prev = { [from]: null }, q = [from];
  while (q.length) { const c = q.shift(); if (c === to) break; for (const d of AREA[c].doors) if (!(d.to in prev)) { prev[d.to] = { c, d }; q.push(d.to); } }
  if (!(to in prev)) return '';
  let n = to; while (prev[n] && prev[n].c !== from) n = prev[n].c;
  const door = prev[n] && prev[n].d; if (!door) return '';
  return `Caminho: portão ${SIDE_PT[door.side]} → ${AREA[door.to].name.toLowerCase()}`;
}
/** v5: estado sonoro da área atual (camadas de ambiente). */
export function ambienceNow() {
  const a = D.area; if (!a) return ['menu', {}];
  return [a.id, {
    power: !!F.power, generator: !!(D.event && D.event.kind === 'gen'), lockdown: !!D.lockdown,
    boss: !!((F.bossFight || F.nestFight) && D.boss && !D.boss.dead), escort: !!(F.escort && !F.heliCode && a.id === 'patio'),
    rescue: !!(D.event && D.event.kind === 'rescue'), hack: !!(D.event && (D.event.kind === 'hack' || D.event.kind === 'charges')),
  }];
}

/** Classificação final por tempo, precisão e quantidade de saves. */
export function rank() {
  let s = 0;
  s += G.elapsed < 900 ? 2 : G.elapsed < 1500 ? 1 : 0;
  const acc = G.shots ? G.hits / G.shots : 0; s += acc >= 0.55 ? 2 : acc >= 0.35 ? 1 : 0;
  s += G.saves <= 2 ? 2 : G.saves <= 5 ? 1 : 0;
  return s >= 6 ? 'S' : s >= 5 ? 'A' : s >= 3 ? 'B' : s >= 1 ? 'C' : 'D';
}
export function endStats() {
  return {
    elapsed: G.elapsed, area: D.area ? D.area.name : '', score: G.score, visited: D.visited.size,
    total: F.act2Win ? AREAS.length : AREAS.filter((a) => !['margem', 'acampamento', 'ninho'].includes(a.id)).length,
    objectives: D.objectives, kills: G.kills, saves: G.saves, acc: G.shots ? Math.round(G.hits / G.shots * 100) : 0, rank: rank(),
    logs: F.act2Win ? story.S.logs.size : story.ACT1_LOGS.filter((id) => story.S.logs.has(id)).length,
    logsTotal: F.act2Win ? story.TOTAL_LOGS : story.ACT1_LOGS.length, ending: story.ending(F), epTotal: G.epTotal,
  };
}
/** Helicóptero de resgate: chega durante o evento e pousa na vitória (roda também no estado 'win'). */
export function updateHeli(dt) {
  const H = D.heli, a = D.area; if (!H || !a || !a.refs.heli) return;
  const R = a.refs.heli, E = D.event, pad = a.helipad;
  H.t += dt;
  const k = E && E.kind === 'rescue' ? E.t / E.dur : 1;
  if (k < 0.3 && !H.landing) { R.group.visible = false; spots[0].override = null; return; }
  R.group.visible = true;
  const u = Math.min(1, (k - 0.3) / 0.7), e = 1 - Math.pow(1 - u, 2.2);
  const x = -18 + (pad.x + 18) * e, z = -70 + (pad.z + 70) * e;
  let y = 26 - 18 * e + Math.sin(H.t * 1.3) * 0.25;
  if (H.landing) { H.land = Math.min(1, (H.land || 0) + dt * 0.45); y = 8 - 7.6 * H.land; }
  R.group.position.set(x, y, z); R.group.rotation.set(H.landing ? 0 : 0.12 * (1 - e) - 0.05, 0.35 * (1 - e) + Math.PI * 0.08, Math.sin(H.t * 0.9) * 0.04);
  R.rotor.rotation.y += dt * 28; R.tailRotor.rotation.x += dt * 34;
  if (R.beacon) R.beacon.material.opacity = Math.sin(H.t * 9) > 0.6 ? 1 : 0.1;
  R.nav.forEach((n, i) => { n.material.opacity = Math.sin(H.t * 5 + i * 3) > 0 ? 1 : 0.25; });
  spots[0].override = { pos: { x, y: y + 0.4, z: z + 1.6 }, target: { x: pad.x + Math.sin(H.t * 0.8) * 2.5, z: pad.z + Math.cos(H.t * 0.6) * 2.5 }, color: 0xfff6d8, intensity: 160, angle: 0.32 };
  if ((H.chopT -= dt) <= 0) { H.chopT = 0.11; const d = Math.hypot(x - player.pos.x, y, z - player.pos.z); if (sfx.heli) sfx.heli(Math.min(0.5, 6 / (d + 4))); }
  if (y < 9) G.shake = Math.max(G.shake, 0.06);
}
/** Atalho de depuração: vai direto para uma área. */
export function debugGoto(id) { enterArea(id); streamAround(D.area); }
/** v7: helpers de teste — liga flags (ex.: {bossDead:true}) e prende/solta o Brandt. */
export function debugFlags(o) { Object.assign(F, o); if (D.area) syncGates(D.area, false); D.mapDirty = true; return { ...F }; }
