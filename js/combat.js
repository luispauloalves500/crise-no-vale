// combat.js — disparo, detecção de acertos, dano/abates, combo e itens coletáveis.
import * as THREE from 'three';
import { scene, camera, castWorld, rayCircle, freeSpot, GLOW } from './world.js';
import { PICKUPS, SHOTGUN_RES_MAX, COMBO, PLAYER } from './config.js';
import { G } from './state.js';
import { player, weapons, arms, curWeapon, startReload, muzzleFlash, gunTip, heal } from './player.js';
import { enemies } from './enemies.js';
import { sfx, roar } from './audio.js';
import { burst, tracer, decal } from './fx.js';
import * as ui from './ui.js';
import { rand } from './utils.js';

const SHOT_H = 1.25; // altura do tiro: passa por cima de caixas e pedras baixas

/** Raio 2D contra cenário + inimigos vivos. */
export function castAll(ox, oz, dx, dz, max) {
  let best = castWorld(ox, oz, dx, dz, max, SHOT_H), hitE = null;
  for (const e of enemies) {
    if (e.dead) continue;
    const t = rayCircle(ox, oz, dx, dz, e.pos.x, e.pos.z, e.cfg.r);
    if (t < best) { best = t; hitE = e; }
  }
  return { t: best, e: hitE };
}

/** Ponto para onde a retícula (centro da tela) aponta, no plano XZ. */
function aimRay() {
  const fx = Math.sin(G.yaw), fz = Math.cos(G.yaw);
  const cx = camera.position.x, cz = camera.position.z;
  const start = Math.max(0, (player.pos.x - cx) * fx + (player.pos.z - cz) * fz);
  const hit = castAll(cx + fx * start, cz + fz * start, fx, fz, 45);
  return { fx, fz, tx: cx + fx * (start + hit.t), tz: cz + fz * (start + hit.t), e: hit.e };
}

const v1 = new THREE.Vector3(), v2 = new THREE.Vector3();
let autoReloadT = 0;

export function fire() {
  const w = curWeapon();
  if (arms.reloading > 0 || arms.cool > 0 || player.dead) return;
  if (w.mag <= 0) {
    arms.cool = 0.3; sfx.dry();
    if (w.res > 0) startReload(); else ui.feed(ui.STR.noShells, '#f88');
    return;
  }
  w.mag--; arms.cool = w.rate; G.shots++;
  const aim = aimRay();
  let bx = aim.tx - player.pos.x, bz = aim.tz - player.pos.z; const bl = Math.hypot(bx, bz) || 1; bx /= bl; bz /= bl;
  if (bl < 1.5) { bx = aim.fx; bz = aim.fz; }
  const base = Math.atan2(bx, bz);
  gunTip.getWorldPosition(v1);
  const spread = (G.aiming ? w.aimSpread : w.spread) * (player.moving && !G.aiming ? 1.5 : 1);
  const dmgBy = new Map();
  for (let p = 0; p < w.pellets; p++) {
    const a = base + (Math.random() - 0.5) * 2 * spread, dx = Math.sin(a), dz = Math.cos(a);
    const h = castAll(player.pos.x, player.pos.z, dx, dz, w.range);
    v2.set(player.pos.x + dx * h.t, v1.y, player.pos.z + dz * h.t);
    if (p < 3 || Math.random() < 0.4) tracer(v1, v2);
    if (h.e) {
      // escopeta: mais dano de perto
      const falloff = w.pellets > 1 ? Math.max(0.45, 1 - Math.max(0, h.t - 4) / 22) : 1;
      const prev = dmgBy.get(h.e) || { d: 0, dx: 0, dz: 0 };
      prev.d += w.dmg * falloff; prev.dx += dx; prev.dz += dz; dmgBy.set(h.e, prev);
      burst(v2.x, 1.1 * h.e.cfg.scale, v2.z, 'blood', 4, 3, dx, dz);
    } else if (h.t < w.range) burst(v2.x, v1.y, v2.z, 'spark', 4, 2.5, -dx * 0.5, -dz * 0.5);
  }
  let anyKill = false, anyCrit = false;
  for (const [e, info] of dmgBy) {
    const crit = Math.random() < (G.aiming ? 0.22 : 0.08);
    const dmg = Math.round(info.d * (crit ? w.crit : 1));
    const l = Math.hypot(info.dx, info.dz) || 1;
    if (damageEnemy(e, dmg, info.dx / l, info.dz / l, w.knock)) anyKill = true;
    anyCrit = anyCrit || crit;
    ui.floater(String(dmg), e.pos.x, 1.9 * e.cfg.scale, e.pos.z, crit ? 'crit' : '');
  }
  if (dmgBy.size) { G.hits++; ui.hitMarker(anyKill); anyKill ? sfx.kill() : anyCrit ? sfx.crit() : sfx.hit(); }
  muzzleFlash(arms.cur === 1);
  G.shake = Math.max(G.shake, arms.cur ? 0.24 : 0.09);
  arms.cur ? sfx.shotgun() : sfx.pistol();
  ui.kickCrosshair(arms.cur ? 22 : 9);
  if (w.mag === 0 && w.res > 0) autoReloadT = 0.25;
}

/** Aplica dano; retorna true se matou. */
export function damageEnemy(e, d, dx, dz, knock) {
  if (e.dead) return false;
  e.hp -= d; e.flashT = 0.1;
  const mass = e.type === 'brute' ? 6 : 1;
  e.kx += dx * knock * 3 / mass; e.kz += dz * knock * 3 / mass;
  if (e.type !== 'brute') e.stun = Math.max(e.stun, 0.12);
  else if (e.windup > 0 && d >= 40) { e.windup = 0; e.stun = 0.8; } // tiro forte interrompe a investida do bruto
  if (e.hp > 0) return false;
  e.dead = true; e.deadT = 0; e.fallDir = Math.random() < 0.5 ? 1 : -1;
  G.kills++;
  G.combo = G.comboT > 0 ? G.combo + 1 : 1; G.comboT = COMBO.WINDOW;
  const mult = Math.min(G.combo, COMBO.MAX), pts = e.cfg.score * mult;
  G.score += pts;
  ui.floater(`+${pts}${mult > 1 ? ` x${mult}` : ''}`, e.pos.x, 2.4 * e.cfg.scale, e.pos.z, 'kill');
  roar(e.type === 'brute' ? 0.45 : 1.1, 0.25);
  burst(e.pos.x, 1.2 * e.cfg.scale, e.pos.z, 'blood', e.type === 'brute' ? 30 : 14, 4, dx, dz);
  decal(e.pos.x, e.pos.z, e.type === 'brute' ? 3 : 1.6);
  const r = Math.random();
  if (r < PICKUPS.DROP_MED) spawnPickup('med', e.pos.x, e.pos.z);
  else if (r < PICKUPS.DROP_MED + PICKUPS.DROP_AMMO) spawnPickup('ammo', e.pos.x, e.pos.z);
  if (e.type === 'brute') { spawnPickup('med', e.pos.x + 1, e.pos.z); spawnPickup('ammo', e.pos.x - 1, e.pos.z); G.shake = 0.5; }
  return true;
}

// ---------- itens ----------
export const pickups = [];
const medMat = new THREE.MeshStandardMaterial({ color: 0xeeeeee, emissive: 0x222222 }), redMat = new THREE.MeshBasicMaterial({ color: 0xdd1111 });
const ammoMat = new THREE.MeshStandardMaterial({ color: 0x4a5530 }), bandMat = new THREE.MeshBasicMaterial({ color: 0xe8c040 });
const unit = new THREE.BoxGeometry(1, 1, 1);
const ringMats = { med: new THREE.SpriteMaterial({ map: GLOW, color: 0xff5050, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0.55 }),
  ammo: new THREE.SpriteMaterial({ map: GLOW, color: 0xffd040, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0.55 }) };
function box(w, h, d, mat, parent, y = 0) { const m = new THREE.Mesh(unit, mat); m.scale.set(w, h, d); m.position.y = y; m.castShadow = true; parent.add(m); }

export function spawnPickup(kind, x, z) {
  if (x === undefined) {
    for (let i = 0; i < 60; i++) { x = rand(-24, 24); z = rand(-24, 24); if (freeSpot(x, z, 0.6) && Math.hypot(x - player.pos.x, z - player.pos.z) > 6) break; }
  }
  // limite: remove o item mais antigo (corrige acúmulo infinito de itens entre ondas)
  if (pickups.length >= PICKUPS.MAX) { const old = pickups.shift(); scene.remove(old.g); }
  const g = new THREE.Group();
  if (kind === 'med') { box(0.55, 0.38, 0.4, medMat, g); box(0.3, 0.1, 0.42, redMat, g); box(0.1, 0.3, 0.42, redMat, g); }
  else { box(0.55, 0.34, 0.38, ammoMat, g); box(0.57, 0.08, 0.4, bandMat, g, 0.06); }
  const ring = new THREE.Sprite(ringMats[kind]); ring.scale.setScalar(1.6); g.add(ring);
  g.position.set(x, 0.6, z); scene.add(g); pickups.push({ g, kind, x, z, t: Math.random() * 5, msgT: 0 });
}
export function clearPickups() { pickups.forEach((p) => scene.remove(p.g)); pickups.length = 0; }

function updatePickups(dt) {
  for (let i = pickups.length - 1; i >= 0; i--) {
    const p = pickups[i]; p.t += dt; p.msgT -= dt;
    p.g.rotation.y += dt * 1.5; p.g.position.y = 0.6 + Math.sin(p.t * 3) * 0.12;
    if (player.dead || Math.hypot(p.x - player.pos.x, p.z - player.pos.z) >= 1.3) continue;
    if (p.kind === 'med') {
      if (player.hp >= PLAYER.HP) { if (p.msgT <= 0) { ui.feed(ui.STR.hpFull, '#aaa'); p.msgT = 2; } continue; }
      heal(PICKUPS.MED_HEAL); ui.feed(ui.STR.med(PICKUPS.MED_HEAL), '#ff9a9a');
    } else {
      const sg = weapons[1];
      if (sg.res >= SHOTGUN_RES_MAX) { if (p.msgT <= 0) { ui.feed(ui.STR.ammoFull, '#aaa'); p.msgT = 2; } continue; }
      const add = Math.min(PICKUPS.AMMO_SHELLS, SHOTGUN_RES_MAX - sg.res);
      sg.res += add; ui.feed(ui.STR.ammo(add), '#ffe070');
    }
    sfx.pickup(); burst(p.x, 0.8, p.z, 'spark', 8, 2); scene.remove(p.g); pickups.splice(i, 1);
  }
}

/** Por frame: auto-recarga, combo, retícula sobre inimigo e itens. */
export function updateCombat(dt) {
  if (autoReloadT > 0) { autoReloadT -= dt; if (autoReloadT <= 0 && G.state === 'play') startReload(); }
  if (G.comboT > 0) { G.comboT -= dt; if (G.comboT <= 0) G.combo = 0; }
  ui.setCrossEnemy(G.state === 'play' && !!aimRay().e);
  updatePickups(dt);
}
export function resetCombat() { autoReloadT = 0; G.combo = 0; G.comboT = 0; }
