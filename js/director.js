// director.js — progressão por ÁREAS (no lugar das ondas): portas e travas, estado de cada área,
// encontros roteirizados, gerador, escolta, chefe, resgate, objetivos e terminais de save.
import { activateArea, bounds } from './world.js';
import { WORLD, SCORE, PLAYER } from './config.js';
import { G, writeSave, readSave } from './state.js';
import { AREAS, AREA, doorArrival } from './areas.js';
import { player, placePlayer, snapshotBag, restoreBag, resetPlayer } from './player.js';
import { spawnEnemy, clearEnemies, enemyEvents, makeNoise } from './enemies.js';
import { spawnPickup, clearPickups, combatEvents, resetCombat } from './combat.js';
import { survivor, resetSurvivor, hideSurvivor } from './npc.js';
import { clearFx, burst } from './fx.js';
import { sfx } from './audio.js';
import * as ui from './ui.js';
import { damp } from './utils.js';

// ---------- estado da campanha ----------
const freshArea = () => ({ visited: false, dead: [], taken: [] });
export const D = {
  area: null, flags: {}, st: {}, enc: new Set(), visited: new Set(),
  queue: [],            // spawns pendentes [{t, type, x, z, from}]
  trans: null,          // troca de área em andamento
  event: null,          // gerador / código / resgate { kind, t, dur, ... }
  boss: null, objectives: 0, lockMsgT: 0, mapDirty: true, lastObj: '',
};
const F = D.flags;
const CONTROL_SPOT = { x: 19.6, z: -16 };

function resetCampaign() {
  for (const k in F) delete F[k];
  D.st = Object.fromEntries(AREAS.map((a) => [a.id, freshArea()]));
  D.enc = new Set(); D.visited = new Set(); D.queue = []; D.trans = null; D.event = null; D.boss = null; D.objectives = 0;
}

/** Trava da porta: true = bloqueada. */
export function isLocked(areaId, doorId) {
  const d = AREA[areaId].doors.find((x) => x.id === doorId);
  if (!d || !d.lock) return false;
  if (d.lock === 'power') return !F.power;
  if (d.lock === 'heliCode') return !F.heliCode;
  if (d.lock === 'bossLock') return !!F.bossFight;
  return false;
}
const LOCK_MSG = {
  power: 'Portão sem energia — ligue o gerador no pântano (oeste)',
  heliCode: 'Portão travado — precisa do código da Dra. Lima',
  bossLock: 'O portão travou! Não há como recuar',
};

function objectiveDone(msg) {
  D.objectives++; G.score += SCORE.OBJECTIVE; sfx.objective();
  ui.floater(`+${SCORE.OBJECTIVE} OBJETIVO`, player.pos.x, 2.6, player.pos.z, 'kill');
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
  if (!D.event || D.event.kind !== 'rescue') return ['Chegue ao heliponto (marca H) e sinalize o resgate', 'heliponto'];
  return ['Aguente até o helicóptero chegar!', 'heliponto'];
}

// ---------- troca de área ----------
function spawnAreaContents(a) {
  const s = D.st[a.id];
  a.ambient.forEach((m, i) => { if (!s.dead.includes(i)) spawnEnemy(m.type, m.x, m.z, { alert: false, ambientIdx: i }); });
  a.pickups.forEach((p) => { if (!s.taken.includes(p.id)) spawnPickup(p.kind, p.x, p.z, { id: p.id, y: p.kind === 'shotgun' ? 1.15 : 0.6 }); });
}
function setupSurvivor(a) {
  if (a.id !== 'patio') { hideSurvivor(); return; }
  if (F.heliCode) { resetSurvivor(CONTROL_SPOT.x, CONTROL_SPOT.z, true); return; }
  // saiu do pátio no meio da escolta: ela volta para a cabine e a escolta recomeça
  if (F.escort) { F.escort = false; D.enc.delete('escort-1'); D.enc.delete('escort-2'); }
  resetSurvivor(a.survivor.x, a.survivor.z, true); survivor.name = a.survivor.name;
}
function syncGates(a, instant) {
  for (const d of a.doors) {
    const ref = a.refs.doors[d.id]; if (!ref) continue;
    const open = !isLocked(a.id, d.id);
    ref.open = open;
    if (instant) ref.gate.position.y = open ? -3.4 : 0;
    ref.light.material.color.setHex(open ? 0x40ff70 : 0xff3030);
  }
}

/** Entra na área `id`. Vindo por uma porta (doorId da área de destino) ou num ponto fixo (at). */
export function enterArea(id, doorId, at) {
  const a = AREA[id], prev = D.area;
  if (D.event && D.event.kind !== 'rescue') D.event = null; // sair da área cancela gerador/código
  activateArea(a, prev && prev !== a ? prev : null);
  D.area = a; G.area = id;
  clearEnemies(); clearPickups(); clearFx(); ui.clearFloaters(); D.queue = []; D.boss = null;
  const p = at || (doorId ? doorArrival(a, doorId) : a.start || doorArrival(a, a.doors[0].id));
  placePlayer(p.x, p.z, p.yaw);
  spawnAreaContents(a);
  setupSurvivor(a);
  syncGates(a, true);
  const s = D.st[id], first = !s.visited;
  if (first) { s.visited = true; G.score += SCORE.AREA_FIRST; }
  D.visited.add(id);
  ui.banner(a.name, a.sub, 2.8);
  if (id === 'pantano' && F.power) a.refs.powerLamps.forEach((L) => { L.on = true; });
  // encontros de entrada
  for (const e of a.encounters) if (e.on === 'enter' && canFire(e, first)) fireEncounter(e);
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
  const base = e.delay || 0;
  if (e.boss) { F.bossFight = true; syncGates(D.area, false); }
  if (e.msg) setTimeoutGame(base, () => { ui.announce(e.msg, e.boss ? '#ff60ff' : '#ff9a80'); e.boss ? sfx.bossRoar() : sfx.ambush(); });
  for (const s of e.spawn) D.queue.push({ t: base + (s.delay || 0), type: s.type, x: s.x, z: s.z, from: s.from, boss: e.boss });
}
// temporizador simples sincronizado com o jogo (pausa junto)
const timers = [];
function setTimeoutGame(t, fn) { if (t <= 0) fn(); else timers.push({ t, fn }); }

function startTransition(door) {
  D.trans = { t: 0, door, switched: false };
  player.inv = Math.max(player.inv, WORLD.FADE * 2 + 0.6);
  sfx.door();
}
function updateTransition(dt) {
  const T = D.trans; T.t += dt;
  const f = WORLD.FADE;
  if (!T.switched && T.t >= f) { T.switched = true; enterArea(T.door.to, T.door.toDoor); }
  ui.setFade(T.t < f ? T.t / f : Math.max(0, 1 - (T.t - f) / f));
  if (T.t >= f * 2) { D.trans = null; ui.setFade(0); }
}

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
  for (const d of D.area.doors) {
    if (!nearDoor(d, 0)) continue;
    if (isLocked(D.area.id, d.id)) {
      pushBack(d); sfx.locked();
      if (D.lockMsgT <= 0) { ui.feed(LOCK_MSG[d.lock], '#ff8a70'); D.lockMsgT = 2; }
      return;
    }
    if (D.event && D.event.kind === 'gen') { pushBack(d); ui.feed('Termine de ligar o gerador!', '#ffb070'); return; }
    startTransition(d); return;
  }
}

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
function updateEvent(dt) {
  const E = D.event; if (!E) return;
  const near = Math.hypot(player.pos.x - E.x, player.pos.z - E.z) < E.range;
  if (near || E.kind === 'code') E.t += dt;
  else if ((E.warnT -= dt) <= 0) { ui.feed(E.kind === 'gen' ? 'Fique perto do gerador!' : 'Volte para o heliponto!', '#ffb070'); E.warnT = 2; }
  while (E.bursts && E.bi < E.bursts.length && E.t >= E.bursts[E.bi]) {
    const W = (E.kind === 'gen' ? GEN_WAVES : RESCUE_WAVES)[E.bi++];
    W.forEach((s) => D.queue.push({ t: s.delay || 0, ...s }));
  }
  if (E.t < E.dur) return;
  D.event = null;
  if (E.kind === 'gen') {
    F.power = true;
    D.area.refs.powerLamps.forEach((L) => { L.on = true; });
    sfx.powerOn(); ui.banner('ENERGIA RESTAURADA', 'O portão norte do laboratório foi destravado', 3.2);
    objectiveDone();
  } else if (E.kind === 'code') {
    F.heliCode = true; syncGates(D.area, false);
    ui.banner('CÓDIGO ACEITO', `${survivor.name}: "Portão do heliponto liberado! Eu fico no terminal."`, 3.4);
    objectiveDone();
  } else if (E.kind === 'rescue') {
    F.rescued = true; G.score += SCORE.OBJECTIVE * 2; D.objectives++;
    if (onWin) onWin();
  }
}

// ---------- interação (tecla E) ----------
function interactables() {
  const out = [], a = D.area;
  for (const t of a.refs.terminals) out.push({ kind: t.kind, x: t.x, z: t.z, t });
  if (a.id === 'patio' && survivor.visible && !survivor.following && !F.heliCode) out.push({ kind: 'survivor', x: survivor.pos.x, z: survivor.pos.z });
  return out;
}
function nearestInteract() {
  let best = null, bd = 2.4;
  for (const it of interactables()) { const d = Math.hypot(it.x - player.pos.x, it.z - player.pos.z); if (d < bd) { bd = d; best = it; } }
  return best;
}
function promptFor(it) {
  if (!it) return null;
  switch (it.kind) {
    case 'save': return { text: 'Salvar progresso (restaura a vida)' };
    case 'generator':
      if (F.power) return { text: 'Gerador funcionando', locked: true };
      if (D.event) return { text: 'Gerador ligando...', locked: true };
      return { text: 'Ligar o gerador' };
    case 'control':
      if (F.heliCode) return { text: 'Portão do heliponto liberado', locked: true };
      return { text: `Precisa da ${survivor.name} para o código`, locked: true };
    case 'survivor': return { text: `Falar com ${survivor.name}` };
  }
  return null;
}
export function interact() {
  if (G.state !== 'play' || D.trans || player.dead) return;
  const it = nearestInteract(); if (!it) return;
  if (it.kind === 'save') saveGame(it.t);
  else if (it.kind === 'generator' && !F.power && !D.event) startGenerator(it);
  else if (it.kind === 'control' && !F.heliCode) ui.feed(`Traga a ${survivor.name} até aqui`, '#ffb070');
  else if (it.kind === 'survivor') {
    survivor.following = true; F.escort = true;
    ui.banner(survivor.name.toUpperCase(), '"Me leve ao terminal de controle no nordeste — eu tenho o código!"', 3.2);
    sfx.objective(); D.mapDirty = true;
  }
}

// ---------- save / load ----------
function saveGame(term) {
  player.hp = PLAYER.HP; G.saves++;
  const a = D.area;
  const off = 1.6, yaw = term.group.rotation.y;
  const at = { x: term.x + Math.sin(yaw) * off, z: term.z + Math.cos(yaw) * off, yaw: yaw + Math.PI };
  const data = {
    v: 1, area: a.id, at, flags: { ...F, escort: false, bossFight: false }, st: D.st, enc: [...D.enc].filter((x) => !x.startsWith('escort')),
    bag: snapshotBag(), objectives: D.objectives,
    stats: { score: G.score, kills: G.kills, shots: G.shots, hits: G.hits, elapsed: G.elapsed, saves: G.saves },
  };
  writeSave(data); ui.setHasSave(true);
  sfx.save(); burst(player.pos.x, 1.2, player.pos.z, 'spark', 14, 2);
  ui.banner('PROGRESSO SALVO', 'Vida restaurada — ' + a.name, 2.2);
}
export function hasSave() { return !!readSave(); }

/** Novo jogo (cais) ou continuar do último terminal. */
export function startCampaign(fromSave) {
  const s = fromSave ? readSave() : null;
  clearEnemies(); clearPickups(); clearFx(); resetCombat(); ui.clearFloaters(); ui.clearMessages(); timers.length = 0;
  resetPlayer(); resetCampaign(); D.area = null;
  Object.assign(G, { score: 0, kills: 0, shots: 0, hits: 0, elapsed: 0, shake: 0, saves: 0 });
  AREAS.forEach((a) => { if (a.refs.powerLamps) a.refs.powerLamps.forEach((L) => { L.on = false; }); });
  if (s) {
    Object.assign(F, s.flags);
    for (const id in s.st) if (D.st[id]) Object.assign(D.st[id], s.st[id]);
    s.enc.forEach((x) => D.enc.add(x));
    AREAS.forEach((a) => { if (D.st[a.id].visited) D.visited.add(a.id); });
    restoreBag(s.bag); D.objectives = s.objectives || 0;
    Object.assign(G, s.stats);
    enterArea(s.area, null, s.at);
    ui.banner('JOGO CARREGADO', AREA[s.area].name, 2.2);
  } else enterArea('porto');
}

// ---------- ganchos de combate ----------
let onWin = null;
export function setWinHandler(fn) { onWin = fn; }
enemyEvents.onKilled = (e) => {
  if (e.ambientIdx !== undefined && D.area) { const s = D.st[D.area.id]; if (!s.dead.includes(e.ambientIdx)) s.dead.push(e.ambientIdx); }
  if (e.cfg.boss) {
    F.bossFight = false; F.bossDead = true; D.boss = null; syncGates(D.area, false);
    // a matilha foge quando o alfa cai
    sfx.bossRoar(); ui.banner('COLOSSO ABATIDO', 'Corra para o heliponto e chame o resgate!', 3.4);
    objectiveDone(); G.score += SCORE.OBJECTIVE;
  }
};
enemyEvents.onBossPhase = (e, ph) => {
  ui.announce(ph === 1 ? 'O Colosso chama a matilha!' : 'O Colosso está FURIOSO!', '#ff60ff');
  D.queue.push({ t: 0.5, type: 'raptor', from: 'E' }, { t: 1.1, type: 'raptor', from: 'S' });
  if (ph === 2) D.queue.push({ t: 2, type: 'spitter', from: 'N' });
};
combatEvents.onWorldPickup = (id) => { if (D.area) D.st[D.area.id].taken.push(id); D.mapDirty = true; };

// ---------- atualização por quadro ----------
export function updateDirector(dt) {
  for (let i = timers.length - 1; i >= 0; i--) { timers[i].t -= dt; if (timers[i].t <= 0) { const f = timers[i].fn; timers.splice(i, 1); f(); } }
  if (D.trans) { updateTransition(dt); return; }
  const a = D.area;
  // fila de spawns
  for (let i = D.queue.length - 1; i >= 0; i--) {
    const q = D.queue[i]; q.t -= dt; if (q.t > 0) continue;
    D.queue.splice(i, 1);
    const e = q.x !== undefined ? spawnEnemy(q.type, q.x, q.z) : spawnEnemy(q.type, undefined, undefined, { from: q.from });
    if (e.cfg.boss) { D.boss = e; G.shake = 0.8; ui.banner('O COLOSSO', 'Atire quando ele bater numa parede — fica atordoado e vulnerável', 3.6); }
  }
  // encontros por zona / por flag
  for (const e of a.encounters) {
    if (D.enc.has(e.id)) continue;
    if (e.on === 'zone' && (!e.flag || F[e.flag]) && Math.hypot(player.pos.x - e.zone.x, player.pos.z - e.zone.z) < e.zone.r) fireEncounter(e);
    else if (e.on === 'flag' && F[e.flag]) fireEncounter(e);
  }
  checkDoors(dt);
  if (D.trans) return;
  // portões animados
  for (const d of a.doors) {
    const ref = a.refs.doors[d.id], open = !isLocked(a.id, d.id);
    if (ref.open !== open) { ref.open = open; ref.light.material.color.setHex(open ? 0x40ff70 : 0xff3030); if (open) sfx.door(); }
    ref.gate.position.y = damp(ref.gate.position.y, open ? -3.4 : 0, 3, dt);
  }
  // escolta: chegou ao terminal de controle
  if (a.id === 'patio' && F.escort && !F.heliCode && !D.event && survivor.following) {
    const z = a.controlZone;
    if (Math.hypot(survivor.pos.x - z.x, survivor.pos.z - z.z) < z.r + 0.8) {
      survivor.following = false; survivor.goal = { ...CONTROL_SPOT };
      D.event = { kind: 'code', t: 0, dur: 4, x: z.x, z: z.z, range: 99 };
      ui.feed(`${survivor.name} está digitando o código...`, '#a0ffb0');
    }
  }
  // resgate: subir no heliponto depois do chefe
  if (a.id === 'heliponto' && F.bossDead && !D.event && !F.rescued) {
    const h = a.helipad;
    if (Math.hypot(player.pos.x - h.x, player.pos.z - h.z) < h.r) {
      D.event = { kind: 'rescue', t: 0, dur: 14, bursts: [1, 5, 9], bi: 0, x: h.x, z: h.z, range: h.r + 3, warnT: 0 };
      sfx.alarm(); ui.announce('Sinalizador aceso! Aguente até o helicóptero chegar', '#ffe070');
    }
  }
  updateEvent(dt);
  // terminais piscando
  for (const t of a.refs.terminals) t.glow.material.opacity = 0.45 + 0.25 * Math.sin(G.time * 3 + t.x);
  const [txt] = objective(); if (txt !== D.lastObj) { D.lastObj = txt; D.mapDirty = true; }
}

const METER_LBL = { gen: 'ENERGIA', code: 'CÓDIGO DO PORTÃO', rescue: 'RESGATE A CAMINHO' };
/** Dados do HUD vindos do diretor. */
export function hudData() {
  const a = D.area, [obj, target] = objective();
  const it = D.trans ? null : nearestInteract();
  let prompt = promptFor(it);
  if (!prompt && !D.trans) for (const d of a.doors) if (isLocked(a.id, d.id) && nearDoor(d, 3)) { prompt = { text: '🔒 ' + LOCK_MSG[d.lock], locked: true }; break; }
  const markers = {}; AREAS.forEach((x) => { if (x.refs.terminals.some((t) => t.kind === 'save')) markers[x.id] = 'save'; });
  markers[target] = '★ ' + (markers[target] ? 'objetivo • save' : 'objetivo');
  const points = a.refs.terminals.map((t) => ({ x: t.x, z: t.z, col: t.kind === 'save' ? '#40ff90' : t.kind === 'generator' ? '#ffb040' : '#40c0ff' }));
  for (const d of a.doors) {
    const b = a.bounds, x = d.side === 'W' ? b.minX : d.side === 'E' ? b.maxX : d.at, z = d.side === 'N' ? b.minZ : d.side === 'S' ? b.maxZ : d.at;
    points.push({ x, z, col: isLocked(a.id, d.id) ? '#ff4040' : '#e0e0e0' });
  }
  if (survivor.visible) points.push({ x: survivor.pos.x, z: survivor.pos.z, col: '#60ff90' });
  if (a.helipad && F.bossDead) points.push({ x: a.helipad.x, z: a.helipad.z, col: '#ffe070' });
  const E = D.event;
  const dirty = D.mapDirty; D.mapDirty = false;
  return {
    area: a, objective: obj, prompt, boss: D.boss && !D.boss.dead ? D.boss : null,
    meter: E ? { label: METER_LBL[E.kind] + ' ' + Math.floor(100 * Math.min(1, E.t / E.dur)) + '%', k: Math.min(1, E.t / E.dur) } : null,
    visited: D.visited, isLocked, markers, points, mapDirty: dirty,
  };
}
export const currentObjective = () => objective()[0];

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
    elapsed: G.elapsed, area: D.area ? D.area.name : '', score: G.score, visited: D.visited.size, total: AREAS.length,
    objectives: D.objectives, kills: G.kills, saves: G.saves, acc: G.shots ? Math.round(G.hits / G.shots * 100) : 0, rank: rank(),
  };
}
/** Atalho de depuração: vai direto para uma área. */
export function debugGoto(id) { enterArea(id); }
