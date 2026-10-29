// enemies.js — construção dos dinossauros (silhuetas distintas), IA (patrulha → alerta → ataque),
// chefe Colosso, spawn por posição/borda da área e cuspe ácido.
import * as THREE from 'three';
import { scene, camera, resolve, castWorld, freeSpot, bounds, GLOW, flashAt, onMaterialsReset } from './world.js';
import { ENEMY_TYPES, COLORS } from './config.js';
import { G } from './state.js';
import { player, hurtPlayer } from './player.js';
import { survivor, hurtSurvivor } from './npc.js';
import { roar, sfx } from './audio.js';
import { burst, decal, shockwave, telegraph, laneHandle, setLane, hideLane } from './fx.js';
import { rand, lerpAngle, noiseTex } from './utils.js';

export const enemies = [];
export const spits = [];
/** Ganchos do diretor: onKilled(e), onBossPhase(e, fase). */
export const enemyEvents = { onKilled: null, onBossPhase: null };

// ---------- construção (geometria compartilhada; materiais por inimigo para o flash de dano) ----------
const unit = new THREE.BoxGeometry(1, 1, 1);
const cone = new THREE.ConeGeometry(1, 1, 5);
const eyeGeo = new THREE.SphereGeometry(1, 6, 5);
const frillGeo = new THREE.CylinderGeometry(0.55, 0.55, 0.04, 14);
const barBg = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.6, depthTest: false });
const barGeo = new THREE.PlaneGeometry(1, 1);
// pele: textura de escamas em cinza (multiplica a cor do tipo) + relevo, compartilhada por todos
const scaleTex = noiseTex('#c4c4c4', ['#7a7a7a', '#ffffff', '#9a9a9a', '#5a5a5a'], 900, 1, 128, { bump: true, grain: 30 });
const ovoid = new THREE.IcosahedronGeometry(1, 1);
const toothGeo = new THREE.ConeGeometry(0.025, 0.09, 4);
const toothM = new THREE.MeshStandardMaterial({ color: 0xe8e0c8, roughness: 0.5 });
const scarM = new THREE.MeshBasicMaterial({ color: 0xff5020 });   // cicatrizes incandescentes do Colosso (V-7)
function ov(sx, sy, sz, mat, x, y, z, parent) {
  const m = new THREE.Mesh(ovoid, mat); m.scale.set(sx, sy, sz); m.position.set(x, y, z); m.castShadow = true; parent.add(m); return m;
}

function bx(w, h, d, mat, x, y, z, parent) {
  const m = new THREE.Mesh(unit, mat); m.scale.set(w, h, d); m.position.set(x, y, z); m.castShadow = true; parent.add(m); return m;
}
function cn(r, h, mat, x, y, z, rx, parent) {
  const m = new THREE.Mesh(cone, mat); m.scale.set(r, h, r); m.position.set(x, y, z); m.rotation.x = rx; m.castShadow = true; parent.add(m); return m;
}

function buildDino(type) {
  const T = ENEMY_TYPES[type], g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const skin = new THREE.MeshStandardMaterial({ color: T.color, roughness: 0.62, flatShading: true, map: scaleTex, bumpMap: scaleTex.userData.bump, bumpScale: 2 });
  const belly = new THREE.MeshStandardMaterial({ color: T.belly, roughness: 0.8, flatShading: true, map: scaleTex });
  const stripe = new THREE.MeshStandardMaterial({ color: T.stripe, roughness: 0.9, flatShading: true });
  const eyeM = new THREE.MeshBasicMaterial({ color: T.eye });
  const mats = [skin, belly, stripe];
  const big = T.shape === 'brute', raptor = T.shape === 'raptor', spitter = T.shape === 'spitter', boss = !!T.boss;

  // corpo: raptor é baixo e alongado; bruto é volumoso
  const bw = raptor ? 0.52 : big ? 0.8 : 0.6, bh = raptor ? 0.55 : big ? 0.8 : 0.62, bl = raptor ? 1.45 : big ? 1.5 : 1.3;
  // tronco orgânico (icosaedro esticado) + peito e ancas
  ov(bw * 0.62, bh * 0.62, bl * 0.58, skin, 0, 1.25, 0, body); ov(bw * 0.5, 0.2, bl * 0.42, belly, 0, 1.03, 0.08, body);
  ov(bw * 0.56, bh * 0.5, bl * 0.25, skin, 0, 1.32, 0.42, body); ov(bw * 0.58, bh * 0.55, bl * 0.28, skin, 0, 1.22, -0.4, body);
  // listras nas costas (raptor e cuspidor) / placas dorsais (bruto)
  if (big) { for (let i = 0; i < 5; i++) cn(0.12, 0.38, stripe, 0, 1.72, 0.55 - i * 0.32, -0.25, body); }
  else for (let i = 0; i < 4; i++) bx(bw * 1.02, 0.08, 0.1, stripe, 0, 1.4, 0.45 - i * 0.3, body);

  const neck = bx(raptor ? 0.26 : 0.32, 0.36, spitter ? 0.75 : 0.55, skin, 0, spitter ? 1.65 : 1.55, 0.75, body);
  neck.rotation.x = spitter ? -0.9 : -0.55;
  const head = new THREE.Group(); head.position.set(0, spitter ? 1.98 : 1.78, spitter ? 1.0 : 1.05); body.add(head);
  const hs = big ? 1.45 : 1;
  bx((raptor ? 0.34 : 0.42) * hs, 0.36 * hs, (raptor ? 0.8 : 0.72) * hs, skin, 0, 0.04, 0.2 * hs, head);
  const jaw = new THREE.Group(); jaw.position.set(0, -0.12 * hs, -0.05); head.add(jaw);
  bx(0.34 * hs, 0.12 * hs, 0.62 * hs, belly, 0, -0.04, 0.28 * hs, jaw);
  // dentes (superior e inferior) e narinas
  for (let i = 0; i < 4; i++) for (const sd of [-1, 1]) {
    const z = (0.3 + i * 0.1) * hs, x = sd * 0.15 * hs;
    const up = new THREE.Mesh(toothGeo, toothM); up.scale.setScalar(hs); up.position.set(x, -0.15 * hs, z); up.rotation.x = Math.PI; head.add(up);
    const lo = new THREE.Mesh(toothGeo, toothM); lo.scale.setScalar(hs); lo.position.set(x, 0.04, z - 0.25 * hs); jaw.add(lo);
  }
  ov(0.12 * hs, 0.06 * hs, 0.14 * hs, skin, 0, 0.18 * hs, 0.1 * hs, head);   // arcada sobre os olhos
  // olhos + brilho (visíveis na neblina)
  const eyeGlow = [];
  [-1, 1].forEach((s) => {
    const e = new THREE.Mesh(eyeGeo, eyeM); e.scale.setScalar(0.055 * hs); e.position.set(s * 0.19 * hs, 0.12 * hs, 0.3 * hs); head.add(e);
    const gl = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW, color: T.eye, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.8 }));
    gl.scale.setScalar(0.32 * hs); gl.position.copy(e.position); head.add(gl); eyeGlow.push(gl);
  });

  if (big) {
    const hornM = new THREE.MeshStandardMaterial({ color: T.horn, roughness: 0.6 }); mats.push(hornM);
    [-1, 1].forEach((s) => cn(0.08, 0.4, hornM, s * 0.2 * hs, 0.36 * hs, 0.22 * hs, -0.4, head));
    cn(0.07, 0.3, hornM, 0, 0.3 * hs, 0.62 * hs, 0.3, head); // chifre nasal
    if (boss) { // coroa de espinhos e placas vermelhas: silhueta de chefe
      for (let i = 0; i < 5; i++) cn(0.06, 0.32, hornM, (i - 2) * 0.12 * hs, 0.32 * hs, -0.1 * hs, -0.9, head);
      for (let i = 0; i < 4; i++) bx(0.95, 0.12, 0.2, stripe, 0, 1.62, 0.5 - i * 0.35, body);
      // cicatrizes incandescentes e "escoras" de couro nas costas
      for (let i = 0; i < 5; i++) { const c = bx(0.03, 0.42, 0.05, scarM, (i % 2 ? 1 : -1) * 0.41, 1.3, 0.45 - i * 0.24, body); c.rotation.x = 0.5; c.castShadow = false; }
      bx(0.03, 0.25, 0.04, scarM, 0.19 * hs, 0.15 * hs, 0.3 * hs, head).castShadow = false;
    }
    bx(0.1, 0.1, 0.3, skin, -0.38, 1.1, 0.75, body).rotation.x = 0.6; bx(0.1, 0.1, 0.3, skin, 0.38, 1.1, 0.75, body).rotation.x = 0.6;
  } else {
    bx(0.08, 0.08, 0.42, skin, -0.25, 1.05, 0.7, body).rotation.x = 0.8; bx(0.08, 0.08, 0.42, skin, 0.25, 1.05, 0.7, body).rotation.x = 0.8;
  }
  if (raptor) { // penas/espinhos laranja na cabeça e pescoço
    const quill = new THREE.MeshStandardMaterial({ color: 0xe07020, roughness: 0.8, flatShading: true }); mats.push(quill);
    for (let i = 0; i < 3; i++) cn(0.05, 0.28, quill, 0, 0.26, -0.05 - i * 0.12, -1.0, head);
  }
  let frill = null;
  if (spitter) { // leque + cristas duplas vermelhas (silhueta inconfundível)
    const fm = new THREE.MeshStandardMaterial({ color: T.frill, side: THREE.DoubleSide, roughness: 0.8, emissive: 0x331000 }); mats.push(fm);
    frill = new THREE.Mesh(frillGeo, fm); frill.rotation.x = Math.PI / 2; frill.position.set(0, 0, -0.12); head.add(frill); frill.scale.set(0.5, 1, 0.5);
    [-1, 1].forEach((s) => { const c = bx(0.04, 0.26, 0.55, fm, s * 0.1, 0.3, 0.15, head); c.rotation.z = s * 0.15; });
  }
  // cauda (bem longa no raptor — contrapeso visual)
  const tail = new THREE.Group(); tail.position.set(0, 1.3, -bl / 2); body.add(tail);
  ov(big ? 0.3 : 0.22, big ? 0.3 : 0.22, 0.55, skin, 0, 0, -0.4, tail);
  const tail2 = new THREE.Group(); tail2.position.set(0, 0.02, -0.85); tail.add(tail2);
  ov(0.13, 0.13, raptor ? 0.78 : 0.56, skin, 0, 0.02, raptor ? -0.7 : -0.5, tail2);
  if (!big) bx(0.26, 0.06, 0.1, stripe, 0, 0.14, -0.3, tail2);
  // pernas
  const legs = [-1, 1].map((s) => {
    const p = new THREE.Group(); p.position.set(s * (bw / 2 - 0.02), 1.05, -0.05); body.add(p);
    ov(big ? 0.2 : 0.14, 0.34, big ? 0.26 : 0.2, skin, 0, -0.22, 0, p);   // coxa
    const low = new THREE.Group(); low.position.set(0, -0.5, 0); p.add(low);
    bx(0.14, 0.55, 0.16, skin, 0, -0.25, -0.06, low); bx(0.2, 0.08, 0.36, belly, 0, -0.52, 0.08, low);
    for (const cx of [-0.06, 0.06]) cn(0.025, 0.12, toothM, cx, -0.52, 0.28, 1.5, low);   // garras
    if (raptor) cn(0.04, 0.22, stripe, 0, -0.42, 0.22, 1.2, low); // garra em foice
    return p;
  });
  // barra de vida (aparece ao levar dano)
  const bar = new THREE.Group(); bar.visible = false;
  const bg = new THREE.Mesh(barGeo, barBg); bg.scale.set(1.0, 0.1, 1); bar.add(bg);
  const fgMat = new THREE.MeshBasicMaterial({ color: 0xff4030, depthTest: false }); mats.push(fgMat);
  const fg = new THREE.Mesh(barGeo, fgMat); fg.scale.set(0.96, 0.06, 1); fg.position.z = 0.001; bar.add(fg);
  bg.renderOrder = fg.renderOrder = 10;
  bar.position.y = 2.6 * T.scale; scene.add(bar);

  g.scale.setScalar(T.scale);
  const em0 = mats.map((m) => (m.emissive ? m.emissive.getHex() : 0));
  return { type, g, body, head, jaw, tail, tail2, legs, frill, mats, em0, eyeM, eyeGlow, bar, barFg: fg };
}

// ---------- pool de inimigos (raptor / cuspidor / bruto). O Colosso é único e não entra no pool ----------
// Reaproveitar o modelo evita recriar dezenas de meshes/materiais (e recompilar shaders) a cada encontro.
const POOL = {}, POOL_MAX = 8;
export const poolStats = { built: 0, reused: 0 };
function resetParts(P) {
  P.g.rotation.set(0, 0, 0); P.g.position.set(0, 0, 0); P.g.visible = true;
  P.body.position.set(0, 0, 0); P.body.rotation.set(0, 0, 0);
  P.legs.forEach((l) => l.rotation.set(0, 0, 0)); P.jaw.rotation.set(0, 0, 0);
  P.tail.rotation.set(0, 0, 0); P.tail2.rotation.set(0, 0, 0);
  if (P.frill) P.frill.scale.set(0.5, 1, 0.5);
  P.mats.forEach((m, i) => { if (m.emissive) m.emissive.setHex(P.em0[i]); });
  P.eyeGlow.forEach((sp) => { sp.material.opacity = 0.8; });
  P.bar.visible = false; P.bar.scale.setScalar(1); P.barFg.scale.x = 0.96; P.barFg.position.x = 0; P.barFg.material.color.setHex(0xff4030);
  return P;
}
function acquireParts(type) {
  const T = ENEMY_TYPES[type], list = POOL[type];
  if (!T.boss && list && list.length) { poolStats.reused++; return resetParts(list.pop()); }
  poolStats.built++; return buildDino(type);
}
function disposeParts(P) { P.mats.forEach((m) => m.dispose()); P.eyeM.dispose(); P.eyeGlow.forEach((sp) => sp.material.dispose()); }
/** Pré-cria modelos no pool durante a carga. Retorna os grupos (para pré-compilar shaders). */
export function prewarmEnemies(counts = { raptor: 4, spitter: 2, brute: 2 }) {
  const groups = [];
  for (const type in counts) {
    if (!ENEMY_TYPES[type] || ENEMY_TYPES[type].boss) continue;
    const list = (POOL[type] ||= []);
    while (list.length < counts[type]) { const P = buildDino(type); poolStats.built++; scene.remove(P.bar); list.push(P); }
    list.forEach((P) => groups.push(P.g, P.bar));
  }
  return groups;
}
onMaterialsReset(() => { for (const t in POOL) for (const P of POOL[t]) { P.mats.forEach((m) => { m.needsUpdate = true; }); P.eyeM.needsUpdate = true; } });

// ---------- spawn ----------
/** Ponto na borda da área (side N/S/E/W ou qualquer), livre de obstáculos e longe do jogador. */
export function edgePoint(side) {
  let best = null, bestD = -1;
  const b = bounds;
  for (let i = 0; i < 50; i++) {
    const s = side || 'NSEW'[Math.floor(Math.random() * 4)];
    const x = s === 'W' ? b.minX + 1.8 : s === 'E' ? b.maxX - 1.8 : rand(b.minX + 2, b.maxX - 2);
    const z = s === 'N' ? b.minZ + 1.8 : s === 'S' ? b.maxZ - 1.8 : rand(b.minZ + 2, b.maxZ - 2);
    if (!freeSpot(x, z, 1.2)) continue;
    const d = Math.hypot(x - player.pos.x, z - player.pos.z);
    if (d >= 14) return { x, z };
    if (d > bestD) { bestD = d; best = { x, z }; }
  }
  return best || { x: (b.minX + b.maxX) / 2, z: b.minZ + 2 };
}

/**
 * Cria um inimigo. Sem x/z usa a borda `opts.from`.
 * opts: { from, alert, ambientIdx }
 */
export function spawnEnemy(type, x, z, opts = {}) {
  if (x === undefined) ({ x, z } = edgePoint(opts.from));
  const T = ENEMY_TYPES[type], parts = acquireParts(type);
  const alert = opts.alert !== false;
  const e = Object.assign({ parts }, parts, {
    type, cfg: T, pos: new THREE.Vector3(x, 0, z), home: { x, z }, hp: T.hp, maxHp: T.hp, yaw: Math.atan2(player.pos.x - x, player.pos.z - z),
    atkCd: 1, special: rand(1, 3), stun: 0, flashT: 0, bite: 0, lunge: 0, spitT: 0, windup: 0, charge: 0, cdx: 0, cdz: 0,
    stomp: 0, stompCd: 3, phaseIdx: 0, alert, wanderA: Math.random() * 6.28, ambientIdx: opts.ambientIdx,
    kx: 0, kz: 0, phase: 0, seed: Math.random() * 100, flank: (Math.random() < 0.5 ? -1 : 1) * rand(0.3, 0.8), dead: false, deadT: 0, fallDir: 1, remove: false,
  });
  e.g.position.copy(e.pos); e.g.rotation.y = e.yaw; scene.add(e.g); scene.add(e.bar); enemies.push(e);
  if (alert) { burst(x, 0.3, z, 'dust', 10, 2); roar(T.shape === 'brute' ? (T.boss ? 0.35 : 0.55) : T.shape === 'spitter' ? 1.3 : 1.6, T.shape === 'brute' ? 0.35 : 0.12); }
  return e;
}
/** Barulho (tiro/explosão) acorda inimigos em patrulha num raio. */
export function makeNoise(x, z, r) {
  for (const e of enemies) if (!e.dead && !e.alert && Math.hypot(e.pos.x - x, e.pos.z - z) < r) alertEnemy(e);
}
function alertEnemy(e) { if (e.alert) return; e.alert = true; e.special = rand(0.5, 1.5); roar(e.cfg.shape === 'brute' ? 0.55 : 1.5, 0.12); }

/** Tira o inimigo da cena: comuns voltam ao pool; o chefe (ou excesso) é descartado. */
function disposeEnemy(e) {
  if (e.released) return; e.released = true;
  scene.remove(e.g); scene.remove(e.bar);
  const P = e.parts, list = (POOL[e.type] ||= []);
  if (!e.cfg.boss && P && list.length < POOL_MAX) list.push(P); else disposeParts(P || e);
}
export function clearEnemies() {
  enemies.forEach(disposeEnemy); enemies.length = 0;
  spits.forEach(releaseSpit); spits.length = 0;
}
export const aliveCount = () => enemies.reduce((n, e) => n + (e.dead ? 0 : 1), 0);

// ---------- cuspe ácido ----------
// sprites de cuspe reaproveitados (material compartilhado — nada é criado/descartado por disparo)
const spitMat = new THREE.SpriteMaterial({ map: GLOW, color: COLORS.spit, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false });
const spitFree = [];
function releaseSpit(s) { scene.remove(s.m); if (spitFree.length < 24) spitFree.push(s.m); }
function spit(e, nx, nz, dist) {
  const m = spitFree.pop() || new THREE.Sprite(spitMat);
  m.scale.setScalar(0.8);
  const hx = e.pos.x + nx * 1.2, hz = e.pos.z + nz * 1.2; m.position.set(hx, 1.8, hz); scene.add(m);
  // mira com antecipação do movimento do jogador
  const lead = Math.min(0.9, dist / 12) * 0.6;
  let tx = player.pos.x + player.vx * lead - hx, tz = player.pos.z + player.vz * lead - hz;
  const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l;
  spits.push({ m, x: hx, z: hz, vx: tx * 12, vz: tz * 12, life: 2.5 }); sfx.spit();
}
function updateSpits(dt) {
  for (let i = spits.length - 1; i >= 0; i--) {
    const s = spits[i]; s.life -= dt; s.x += s.vx * dt; s.z += s.vz * dt;
    s.m.position.set(s.x, 1.6 + Math.sin(s.life * 8) * 0.08, s.z);
    if (Math.random() < 0.5) burst(s.x, 1.6, s.z, 'spit', 1, 0.4);
    let dead = s.life <= 0; const p = { x: s.x, z: s.z }; if (resolve(p, 0.15)) dead = true;
    if (!dead && Math.hypot(s.x - player.pos.x, s.z - player.pos.z) < player.r + 0.35) { hurtPlayer(10, s.x - s.vx, s.z - s.vz, 3); dead = true; }
    if (dead) {
      burst(s.x, 1.5, s.z, 'spit', 8, 2.5); decal(s.x, s.z, 0.9, 0x5a9a20); sfx.splat();
      releaseSpit(s); spits.splice(i, 1);
    }
  }
}

// ---------- IA ----------
function updateEnemy(e, dt) {
  const g = e.g, T = e.cfg, t = G.time;
  if (e.dead) {
    if (e.lane) { hideLane(e.lane); e.lane = null; }
    e.deadT += dt; e.bar.visible = false;
    const k = Math.min(1, e.deadT * 3);
    g.rotation.z = k * Math.PI / 2 * e.fallDir;
    g.position.y = k * 0.25 * T.scale - (e.deadT > 1.8 ? (e.deadT - 1.8) * 0.7 : 0);
    e.mats.forEach((m) => m.emissive && m.emissive.setHex(0));
    e.eyeGlow.forEach((s) => { s.material.opacity = Math.max(0, 0.8 - e.deadT); });
    if (e.deadT > 3.5) { disposeEnemy(e); e.remove = true; }
    return;
  }
  // alvo: jogador ou a sobrevivente escoltada, o que estiver mais perto
  let tgt = player, tx = player.pos.x, tz = player.pos.z;
  // v5: ela só vira alvo se estiver bem mais perto que o jogador e não acabou de levantar
  if (survivor.following && !survivor.downT && !(survivor.safeT > 0)) {
    const dp = Math.hypot(player.pos.x - e.pos.x, player.pos.z - e.pos.z), ds = Math.hypot(survivor.pos.x - e.pos.x, survivor.pos.z - e.pos.z);
    if (ds < dp * 0.6 && T.shape !== 'spitter') { tgt = survivor; tx = survivor.pos.x; tz = survivor.pos.z; }
  }
  const dx = tx - e.pos.x, dz = tz - e.pos.z, dist = Math.hypot(dx, dz) || 0.001, nx = dx / dist, nz = dz / dist;
  const hit = (dmg, knock) => (tgt === player ? hurtPlayer(dmg, e.pos.x, e.pos.z, knock) : hurtSurvivor(e));
  e.atkCd -= dt; e.flashT -= dt; e.stun -= dt; e.special -= dt; e.bite -= dt; e.stompCd -= dt;
  let mvx = 0, mvz = 0, spd = T.speed, face = Math.atan2(dx, dz);
  const reach = T.r + player.r + 0.45;
  // patrulha: anda devagar perto de casa até ver/ouvir o jogador
  if (!e.alert) {
    const pd = Math.hypot(player.pos.x - e.pos.x, player.pos.z - e.pos.z);
    const sees = pd < T.aggro && castWorld(e.pos.x, e.pos.z, (player.pos.x - e.pos.x) / pd, (player.pos.z - e.pos.z) / pd, pd, 1.5) >= pd - 0.5;
    if (sees || pd < 6 || e.hp < e.maxHp) alertEnemy(e);
  }
  if (!e.alert && !player.dead) {
    const hx = e.home.x - e.pos.x, hz = e.home.z - e.pos.z;
    if (Math.random() < dt * 0.4) e.wanderA += rand(-1.5, 1.5);
    mvx = Math.sin(e.wanderA) + hx * 0.15; mvz = Math.cos(e.wanderA) + hz * 0.15; spd *= 0.22; face = Math.atan2(mvx, mvz);
  }
  else if (player.dead) { mvx = Math.sin(e.seed + t * 0.3); mvz = Math.cos(e.seed + t * 0.3); spd *= 0.25; face = Math.atan2(mvx, mvz); }
  else if (e.stun > 0) { spd = 0; }
  else if (e.type === 'raptor') {
    // aproxima em arco (flanqueia) e zigue-zague, depois dá o bote
    const arc = dist > 6 ? e.flank : 0, zig = dist > 4 ? Math.sin(t * 3 + e.seed) * 0.45 : 0;
    mvx = nx - nz * (arc + zig); mvz = nz + nx * (arc + zig);
    if (e.lunge > 0) { e.lunge -= dt; spd *= 2.3; }
    else if (dist < 6.5 && e.special <= 0) { e.lunge = 0.45; e.special = rand(2.2, 3.5); roar(1.8, 0.12); }
    if (dist < reach && e.atkCd <= 0) { e.atkCd = 0.9; e.bite = 0.25; hit(T.dmg, 7); }
  } else if (e.type === 'spitter') {
    const strafe = Math.sin(t * 0.6 + e.seed) > 0 ? 1 : -1, f = dist > 12 ? 1 : dist < 7 ? -1 : 0;
    mvx = nx * f - nz * strafe * 0.6; mvz = nz * f + nx * strafe * 0.6;
    if (dist < 18 && e.special <= 0 && e.spitT <= 0) { e.special = rand(2.2, 3.4); e.spitT = 0.55; }
    if (e.spitT > 0) {
      e.spitT -= dt; spd *= 0.15;
      if (e.spitT <= 0 && castWorld(e.pos.x, e.pos.z, nx, nz, dist, 1.5) >= dist - 0.5) spit(e, nx, nz, dist);
    }
    if (dist < reach && e.atkCd <= 0) { e.atkCd = 1.2; e.bite = 0.25; hit(T.dmg, 5); }
  } else {
    const boss = !!T.boss, rage = boss && e.hp < e.maxHp * 0.34 ? 1.3 : 1;
    // fases do chefe: ruge e chama a matilha em 66% e 33% de vida
    if (boss) {
      const ph = e.hp < e.maxHp * 0.34 ? 2 : e.hp < e.maxHp * 0.67 ? 1 : 0;
      if (ph > e.phaseIdx) { e.phaseIdx = ph; roar(0.3, 0.6); G.shake = Math.max(G.shake, 0.6); if (enemyEvents.onBossPhase) enemyEvents.onBossPhase(e, ph); }
    }
    spd *= rage;
    if (e.stomp > 0) {
      // pisão: agacha, depois onda de choque em anel
      e.stomp -= dt; spd = 0;
      if (e.stomp <= 0) {
        shockwave(e.pos.x, e.pos.z, T.stompR); shockwave(e.pos.x, e.pos.z, T.stompR * 0.55, 0xff7040); sfx.crash(); if (sfx.stomp) sfx.stomp();
        flashAt(e.pos.x, 0.6, e.pos.z, 0xff8040, 60); decal(e.pos.x, e.pos.z, 3.2, 0x14100a); G.shake = Math.max(G.shake, 0.7);
        const pd = Math.hypot(player.pos.x - e.pos.x, player.pos.z - e.pos.z);
        if (pd < T.stompR) hurtPlayer(T.stompDmg, e.pos.x, e.pos.z, 14);
      }
    } else if (e.charge > 0) {
      e.charge -= dt; mvx = e.cdx; mvz = e.cdz; spd = T.chargeSpeed; face = Math.atan2(e.cdx, e.cdz);
      if (Math.random() < 0.6) burst(e.pos.x, 0.2, e.pos.z, 'dust', 1, 1.5);
      if (dist < reach + 0.3) { hit(T.chargeDmg, 16); e.charge = 0; e.stun = 0.6; }
    } else if (e.windup > 0) {
      e.windup -= dt; spd = 0;
      // v5: faixa no chão mostra a direção (e até onde vai) a investida
      if (!e.lane) e.lane = laneHandle();
      const len = Math.min((T.chargeSpeed || 14) * 1.1, castWorld(e.pos.x, e.pos.z, nx, nz, 40, 1.5));
      setLane(e.lane, e.pos.x, e.pos.z, nx, nz, len, T.r * 1.6, 1 - Math.max(0, e.windup) / (e.windup0 || 1));
      if (e.windup <= 0) { e.charge = 1.1; e.cdx = nx; e.cdz = nz; }
    } else {
      mvx = nx; mvz = nz;
      if (boss && dist < T.stompR - 1 && e.stompCd <= 0) {
        // v5: pisão com aviso mais longo (anel vermelho que enche no chão + ronco grave)
        e.stomp = e.stomp0 = T.stompWind || 0.9; e.stompCd = rand(3.8, 5.2) / rage; roar(0.4, 0.4);
        telegraph(e.pos.x, e.pos.z, T.stompR, e.stomp); sfx.stompWarn();
      }
      else if (dist < (boss ? 20 : 13) && dist > 4 && e.special <= 0) {
        e.windup = e.windup0 = T.windup || (boss ? 1.0 : 0.9); e.special = rand(5, 7) / rage; roar(0.5, 0.5); sfx.chargeWarn(); G.shake = Math.max(G.shake, 0.25);
      }
      if (dist < reach + 0.2 && e.atkCd <= 0) { e.atkCd = 1.6; e.bite = 0.35; hit(T.dmg, 10); }
    }
  }
  const ml = Math.hypot(mvx, mvz); if (ml > 0) { mvx /= ml; mvz /= ml; }
  const ox = e.pos.x, oz = e.pos.z;
  e.pos.x += (mvx * spd + e.kx) * dt; e.pos.z += (mvz * spd + e.kz) * dt;
  const k = Math.exp(-7 * dt); e.kx *= k; e.kz *= k;
  if (resolve(e.pos, T.r) && e.charge > 0) {
    e.charge = 0; e.stun = T.wallStun || (T.boss ? 2.4 : 1.4);
    // v5: carência depois do atordoamento — ele não emenda pisão/investida assim que acorda
    if (T.stunGrace) { e.stompCd = Math.max(e.stompCd, e.stun + T.stunGrace); e.special = Math.max(e.special, e.stun + T.stunGrace + 1); }
    burst(e.pos.x, 2.4 * T.scale, e.pos.z, 'spark', 12, 2.5); G.shake = Math.max(G.shake, 0.35); burst(e.pos.x, 1, e.pos.z, 'dust', 16, 3); sfx.crash();
  }
  e.yaw = lerpAngle(e.yaw, face, Math.min(1, dt * (e.charge > 0 ? 2 : 8)));
  g.rotation.y = e.yaw; g.position.set(e.pos.x, 0, e.pos.z);
  const moved = Math.hypot(e.pos.x - ox, e.pos.z - oz) / Math.max(dt, 1e-4); e.phase += moved * dt * 2.4 / T.scale;
  const sw = Math.sin(e.phase) * Math.min(1, moved / 2) * 0.7; e.legs[0].rotation.x = sw; e.legs[1].rotation.x = -sw;
  e.body.position.y = Math.abs(Math.sin(e.phase)) * 0.06;
  if (e.lane && !(e.windup > 0)) { hideLane(e.lane); e.lane = null; }
  // v5: passos pesados do Colosso/bruto (som que cai com a distância)
  if (T.shape === 'brute' && moved > 0.6) {
    const up = Math.sin(e.phase) > 0;
    if (up !== e.stepUp) { e.stepUp = up; const pd = Math.hypot(player.pos.x - e.pos.x, player.pos.z - e.pos.z); sfx.thud(Math.min(1, (T.boss ? 16 : 9) / (pd + 6))); }
  }
  e.body.rotation.x = (e.windup > 0 ? -0.25 : 0) + (e.lunge > 0 ? 0.15 : 0) + (e.stomp > 0 ? -0.35 * Math.min(1, ((e.stomp0 || 0.9) - e.stomp) * 3) : 0);
  e.jaw.rotation.x = (e.bite > 0 || e.spitT > 0 || e.windup > 0 || e.stomp > 0) ? 0.65 : 0.06 + Math.sin(t * 2 + e.seed) * 0.04;
  e.tail.rotation.y = Math.sin(t * 2.5 + e.seed) * 0.25; e.tail2.rotation.y = Math.sin(t * 2.5 + e.seed + 1) * 0.35;
  if (e.frill) { const s = e.spitT > 0 ? 1 : 0.5; e.frill.scale.x += (s - e.frill.scale.x) * Math.min(1, dt * 12); e.frill.scale.z = e.frill.scale.x; }
  const fl = e.flashT > 0 ? 0xaa2020 : ((e.windup > 0 || e.stomp > 0) && Math.floor(t * 16) % 2 ? 0x663300 : (T.boss && e.stun > 0 ? 0x223355 : 0));
  e.mats.forEach((m) => m.emissive && m.emissive.setHex(fl));
  // barra de vida
  if (e.hp < e.maxHp && !T.boss) {
    e.bar.visible = true; e.bar.position.set(e.pos.x, 2.6 * T.scale + (e.type === 'spitter' ? 0.3 : 0), e.pos.z);
    e.bar.quaternion.copy(camera.quaternion);
    const f = Math.max(0, e.hp / e.maxHp); e.barFg.scale.x = 0.96 * f; e.barFg.position.x = -0.48 * (1 - f);
    e.barFg.material.color.setHex(f > 0.5 ? 0xffb030 : 0xff3020);
    e.bar.scale.setScalar(T.shape === 'brute' ? 1.6 : 1);
  }
}

export function updateEnemies(dt) {
  for (const e of enemies) updateEnemy(e, dt);
  for (let i = enemies.length - 1; i >= 0; i--) if (enemies[i].remove) enemies.splice(i, 1);
  // separação entre inimigos
  for (let i = 0; i < enemies.length; i++) for (let j = i + 1; j < enemies.length; j++) {
    const a = enemies[i], b = enemies[j]; if (a.dead || b.dead) continue;
    const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z, d = Math.hypot(dx, dz), m = a.cfg.r + b.cfg.r;
    if (d < m && d > 1e-4) { const p = (m - d) / 2, ux = dx / d, uz = dz / d; a.pos.x -= ux * p; a.pos.z -= uz * p; b.pos.x += ux * p; b.pos.z += uz * p; }
  }
  updateSpits(dt);
}
