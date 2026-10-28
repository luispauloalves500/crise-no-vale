// enemies.js — construção dos dinossauros (silhuetas distintas), IA (patrulha → alerta → ataque),
// chefe Colosso, spawn por posição/borda da área e cuspe ácido.
import * as THREE from 'three';
import { scene, camera, resolve, castWorld, freeSpot, bounds, GLOW } from './world.js';
import { ENEMY_TYPES, COLORS } from './config.js';
import { G } from './state.js';
import { player, hurtPlayer } from './player.js';
import { survivor, hurtSurvivor } from './npc.js';
import { roar, sfx } from './audio.js';
import { burst, decal, shockwave } from './fx.js';
import { rand, lerpAngle } from './utils.js';

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

function bx(w, h, d, mat, x, y, z, parent) {
  const m = new THREE.Mesh(unit, mat); m.scale.set(w, h, d); m.position.set(x, y, z); m.castShadow = true; parent.add(m); return m;
}
function cn(r, h, mat, x, y, z, rx, parent) {
  const m = new THREE.Mesh(cone, mat); m.scale.set(r, h, r); m.position.set(x, y, z); m.rotation.x = rx; m.castShadow = true; parent.add(m); return m;
}

function buildDino(type) {
  const T = ENEMY_TYPES[type], g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const skin = new THREE.MeshStandardMaterial({ color: T.color, roughness: 0.85, flatShading: true });
  const belly = new THREE.MeshStandardMaterial({ color: T.belly, roughness: 0.9, flatShading: true });
  const stripe = new THREE.MeshStandardMaterial({ color: T.stripe, roughness: 0.9, flatShading: true });
  const eyeM = new THREE.MeshBasicMaterial({ color: T.eye });
  const mats = [skin, belly, stripe];
  const big = T.shape === 'brute', raptor = T.shape === 'raptor', spitter = T.shape === 'spitter', boss = !!T.boss;

  // corpo: raptor é baixo e alongado; bruto é volumoso
  const bw = raptor ? 0.52 : big ? 0.8 : 0.6, bh = raptor ? 0.55 : big ? 0.8 : 0.62, bl = raptor ? 1.45 : big ? 1.5 : 1.3;
  bx(bw, bh, bl, skin, 0, 1.25, 0, body); bx(bw * 0.8, 0.3, bl * 0.75, belly, 0, 1.02, 0.05, body);
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
  bx(big ? 0.55 : 0.4, big ? 0.55 : 0.4, 0.9, skin, 0, 0, -0.4, tail);
  const tail2 = new THREE.Group(); tail2.position.set(0, 0.02, -0.85); tail.add(tail2);
  bx(0.24, 0.24, raptor ? 1.4 : 1.0, skin, 0, 0.02, raptor ? -0.7 : -0.5, tail2);
  if (!big) bx(0.26, 0.06, 0.1, stripe, 0, 0.14, -0.3, tail2);
  // pernas
  const legs = [-1, 1].map((s) => {
    const p = new THREE.Group(); p.position.set(s * (bw / 2 - 0.02), 1.05, -0.05); body.add(p);
    bx(big ? 0.3 : 0.2, 0.55, big ? 0.4 : 0.3, skin, 0, -0.25, 0, p);
    const low = new THREE.Group(); low.position.set(0, -0.5, 0); p.add(low);
    bx(0.14, 0.55, 0.16, skin, 0, -0.25, -0.06, low); bx(0.2, 0.08, 0.36, belly, 0, -0.52, 0.08, low);
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
  return { g, body, head, jaw, tail, tail2, legs, frill, mats, eyeM, eyeGlow, bar, barFg: fg };
}

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
  const T = ENEMY_TYPES[type], parts = buildDino(type);
  const alert = opts.alert !== false;
  const e = Object.assign(parts, {
    type, cfg: T, pos: new THREE.Vector3(x, 0, z), home: { x, z }, hp: T.hp, maxHp: T.hp, yaw: Math.atan2(player.pos.x - x, player.pos.z - z),
    atkCd: 1, special: rand(1, 3), stun: 0, flashT: 0, bite: 0, lunge: 0, spitT: 0, windup: 0, charge: 0, cdx: 0, cdz: 0,
    stomp: 0, stompCd: 3, phaseIdx: 0, alert, wanderA: Math.random() * 6.28, ambientIdx: opts.ambientIdx,
    kx: 0, kz: 0, phase: 0, seed: Math.random() * 100, flank: (Math.random() < 0.5 ? -1 : 1) * rand(0.3, 0.8), dead: false, deadT: 0, fallDir: 1, remove: false,
  });
  e.g.position.copy(e.pos); e.g.rotation.y = e.yaw; scene.add(e.g); enemies.push(e);
  if (alert) { burst(x, 0.3, z, 'dust', 10, 2); roar(T.shape === 'brute' ? (T.boss ? 0.35 : 0.55) : T.shape === 'spitter' ? 1.3 : 1.6, T.shape === 'brute' ? 0.35 : 0.12); }
  return e;
}
/** Barulho (tiro/explosão) acorda inimigos em patrulha num raio. */
export function makeNoise(x, z, r) {
  for (const e of enemies) if (!e.dead && !e.alert && Math.hypot(e.pos.x - x, e.pos.z - z) < r) alertEnemy(e);
}
function alertEnemy(e) { if (e.alert) return; e.alert = true; e.special = rand(0.5, 1.5); roar(e.cfg.shape === 'brute' ? 0.55 : 1.5, 0.12); }

function disposeEnemy(e) {
  scene.remove(e.g); scene.remove(e.bar);
  e.mats.forEach((m) => m.dispose()); e.eyeM.dispose(); e.eyeGlow.forEach((s) => s.material.dispose());
}
export function clearEnemies() {
  enemies.forEach(disposeEnemy); enemies.length = 0;
  spits.forEach((s) => { scene.remove(s.m); s.m.material.dispose(); }); spits.length = 0;
}
export const aliveCount = () => enemies.reduce((n, e) => n + (e.dead ? 0 : 1), 0);

// ---------- cuspe ácido ----------
function spit(e, nx, nz, dist) {
  const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW, color: COLORS.spit, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }));
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
      scene.remove(s.m); s.m.material.dispose(); spits.splice(i, 1);
    }
  }
}

// ---------- IA ----------
function updateEnemy(e, dt) {
  const g = e.g, T = e.cfg, t = G.time;
  if (e.dead) {
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
  if (survivor.following && !survivor.downT) {
    const dp = Math.hypot(player.pos.x - e.pos.x, player.pos.z - e.pos.z), ds = Math.hypot(survivor.pos.x - e.pos.x, survivor.pos.z - e.pos.z);
    if (ds < dp * 0.8 && T.shape !== 'spitter') { tgt = survivor; tx = survivor.pos.x; tz = survivor.pos.z; }
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
        shockwave(e.pos.x, e.pos.z, T.stompR); sfx.crash(); G.shake = Math.max(G.shake, 0.7);
        const pd = Math.hypot(player.pos.x - e.pos.x, player.pos.z - e.pos.z);
        if (pd < T.stompR) hurtPlayer(T.stompDmg, e.pos.x, e.pos.z, 14);
      }
    } else if (e.charge > 0) {
      e.charge -= dt; mvx = e.cdx; mvz = e.cdz; spd = T.chargeSpeed; face = Math.atan2(e.cdx, e.cdz);
      if (Math.random() < 0.6) burst(e.pos.x, 0.2, e.pos.z, 'dust', 1, 1.5);
      if (dist < reach + 0.3) { hit(T.chargeDmg, 16); e.charge = 0; e.stun = 0.6; }
    } else if (e.windup > 0) {
      e.windup -= dt; spd = 0; if (e.windup <= 0) { e.charge = 1.1; e.cdx = nx; e.cdz = nz; }
    } else {
      mvx = nx; mvz = nz;
      if (boss && dist < T.stompR - 1 && e.stompCd <= 0) { e.stomp = 0.9; e.stompCd = rand(3.5, 5) / rage; roar(0.4, 0.4); }
      else if (dist < (boss ? 20 : 13) && dist > 4 && e.special <= 0) { e.windup = boss ? 1.0 : 0.85; e.special = rand(5, 7) / rage; roar(0.5, 0.5); G.shake = Math.max(G.shake, 0.25); }
      if (dist < reach + 0.2 && e.atkCd <= 0) { e.atkCd = 1.6; e.bite = 0.35; hit(T.dmg, 10); }
    }
  }
  const ml = Math.hypot(mvx, mvz); if (ml > 0) { mvx /= ml; mvz /= ml; }
  const ox = e.pos.x, oz = e.pos.z;
  e.pos.x += (mvx * spd + e.kx) * dt; e.pos.z += (mvz * spd + e.kz) * dt;
  const k = Math.exp(-7 * dt); e.kx *= k; e.kz *= k;
  if (resolve(e.pos, T.r) && e.charge > 0) {
    e.charge = 0; e.stun = T.boss ? 2.4 : 1.4; G.shake = Math.max(G.shake, 0.35); burst(e.pos.x, 1, e.pos.z, 'dust', 16, 3); sfx.crash();
  }
  e.yaw = lerpAngle(e.yaw, face, Math.min(1, dt * (e.charge > 0 ? 2 : 8)));
  g.rotation.y = e.yaw; g.position.set(e.pos.x, 0, e.pos.z);
  const moved = Math.hypot(e.pos.x - ox, e.pos.z - oz) / Math.max(dt, 1e-4); e.phase += moved * dt * 2.4 / T.scale;
  const sw = Math.sin(e.phase) * Math.min(1, moved / 2) * 0.7; e.legs[0].rotation.x = sw; e.legs[1].rotation.x = -sw;
  e.body.position.y = Math.abs(Math.sin(e.phase)) * 0.06;
  e.body.rotation.x = (e.windup > 0 ? -0.25 : 0) + (e.lunge > 0 ? 0.15 : 0) + (e.stomp > 0 ? -0.35 * Math.min(1, (0.9 - e.stomp) * 3) : 0);
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
