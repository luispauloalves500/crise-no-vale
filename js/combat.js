// combat.js — disparo, granadas, detecção de acertos, dano/abates, combo e itens (do mapa e drops).
import * as THREE from 'three';
import { scene, camera, castWorld, rayCircle, resolve, GLOW } from './world.js';
import { PICKUPS, SHOTGUN_RES_MAX, SMG_RES_MAX, COMBO, PLAYER, GRENADE, INVENTORY, ARMOR } from './config.js';
import { SETTINGS } from './settings.js';
import { G } from './state.js';
import { player, weapons, arms, bag, curWeapon, startReload, muzzleFlash, gunTip, heal, switchWeapon, hurtPlayer } from './player.js';
import { enemies, enemyEvents, makeNoise } from './enemies.js';
import { sfx, roar } from './audio.js';
import { burst, tracer, decal, explosion, flourish, bloodBurst } from './fx.js';
import * as ui from './ui.js';

const SHOT_H = 1.25; // altura do tiro: passa por cima de caixas e pedras baixas
/** Gancho do diretor: item fixo do mapa coletado (id). */
export const combatEvents = { onWorldPickup: null };

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
      const falloff = w.pellets > 1 ? Math.max(w.falloffMin || 0.45, 1 - Math.max(0, h.t - (w.falloffStart || 4)) / (w.falloffLen || 22)) : 1;
      const prev = dmgBy.get(h.e) || { d: 0, dx: 0, dz: 0 };
      prev.d += w.dmg * falloff; prev.dx += dx; prev.dz += dz; dmgBy.set(h.e, prev);
      burst(v2.x, 1.1 * h.e.cfg.scale, v2.z, 'blood', 4, 3, dx, dz);
    } else if (h.t < w.range) burst(v2.x, v1.y, v2.z, 'spark', 4, 2.5, -dx * 0.5, -dz * 0.5);
  }
  let anyKill = false, anyCrit = false;
  for (const [e, info] of dmgBy) {
    const crit = Math.random() < (G.aiming ? 0.22 : 0.08);
    let dmg = info.d * (crit ? w.crit : 1);
    const weak = e.cfg.boss && e.stun > 0;
    if (weak) dmg *= 1.5; // chefe atordoado (bateu na parede): ponto fraco exposto
    dmg = Math.round(dmg);
    const l = Math.hypot(info.dx, info.dz) || 1;
    if (damageEnemy(e, dmg, info.dx / l, info.dz / l, w.knock)) anyKill = true;
    anyCrit = anyCrit || crit;
    ui.floater(crit || weak ? dmg + '!' : String(dmg), e.pos.x, 1.9 * e.cfg.scale, e.pos.z, (crit ? 'crit' : '') + (weak ? ' weak' : '') + (dmg >= 60 ? ' big' : ''));
  }
  if (dmgBy.size) {
    G.hits++; ui.hitMarker(anyKill, anyCrit); anyKill ? sfx.kill() : anyCrit ? sfx.crit() : sfx.hit();
    if (anyKill || anyCrit) {
      const [e0] = dmgBy.keys(); flourish(e0.pos.x, 1.3 * e0.cfg.scale, e0.pos.z, anyKill);
      hitstop(anyKill ? 0.055 : 0.04);
    }
  }
  // v6: cada arma define clarão, coice, tremor, som, abertura da retícula e barulho
  muzzleFlash(w.flash, w.kick);
  G.shake = Math.max(G.shake, w.shake);
  (sfx[w.id] || sfx.pistol)();
  ui.kickCrosshair(w.xkick);
  makeNoise(player.pos.x, player.pos.z, w.noise); // tiros atraem quem está patrulhando
  if (w.mag === 0 && w.res > 0) autoReloadT = 0.25;
}

/** v6: congela o mundo por alguns ms (sem acumular; respeita movimento reduzido). */
function hitstop(s) {
  if (SETTINGS.reducedMotion || G.hitstopCd > 0) return;
  G.hitstop = Math.max(G.hitstop, s); G.hitstopCd = 0.22;
}
/** Aplica dano; retorna true se matou. */
export function damageEnemy(e, d, dx, dz, knock) {
  if (e.dead) return false;
  e.hp -= d; e.flashT = 0.1;
  const mass = e.cfg.mass || 1, heavy = e.cfg.shape === 'brute';
  e.kx += dx * knock * 3 / mass; e.kz += dz * knock * 3 / mass;
  if (!heavy) e.stun = Math.max(e.stun, 0.12);
  else if (e.windup > 0 && d >= (e.cfg.boss ? 70 : 40)) { e.windup = 0; e.stun = 0.8; } // tiro forte interrompe a investida
  if (e.hp > 0) return false;
  e.dead = true; e.deadT = 0; e.fallDir = Math.random() < 0.5 ? 1 : -1;
  G.kills++;
  G.combo = G.comboT > 0 ? G.combo + 1 : 1; G.comboT = COMBO.WINDOW;
  const mult = Math.min(G.combo, COMBO.MAX), pts = e.cfg.score * mult;
  G.score += pts;
  ui.floater(`+${pts}${mult > 1 ? ` x${mult}` : ''}`, e.pos.x, 2.4 * e.cfg.scale, e.pos.z, 'kill');
  roar(heavy ? 0.45 : 1.1, 0.25);
  bloodBurst(e.pos.x, 1.2 * e.cfg.scale, e.pos.z, heavy, dx, dz);
  decal(e.pos.x, e.pos.z, heavy ? 1.5 * e.cfg.scale : 1.6);
  if (!e.cfg.boss) {
    const r = Math.random();
    const ammoKind = () => (bag.owned[2] && Math.random() < 0.5 ? 'smgammo' : 'ammo'); // v6: com a submetralhadora, metade das caixas é de pente
    if (r < PICKUPS.DROP_MED) spawnPickup('med', e.pos.x, e.pos.z);
    else if (r < PICKUPS.DROP_MED + PICKUPS.DROP_AMMO) spawnPickup(ammoKind(), e.pos.x, e.pos.z);
    else if (r < PICKUPS.DROP_MED + PICKUPS.DROP_AMMO + 0.04) spawnPickup('grenade', e.pos.x, e.pos.z);
    else if (r < PICKUPS.DROP_MED + PICKUPS.DROP_AMMO + 0.04 + PICKUPS.DROP_SMG && !bag.owned[2] && !pickups.some((p) => p.kind === 'smg'))
      spawnPickup('smg', e.pos.x, e.pos.z); // v6: drop raro
    if (e.cfg.shape === 'brute') {
      spawnPickup('med', e.pos.x + 1, e.pos.z); spawnPickup(ammoKind(), e.pos.x - 1, e.pos.z); G.shake = 0.5;
      if (Math.random() < PICKUPS.DROP_VEST_BRUTE && bag.armor < ARMOR.MAX) spawnPickup('vest', e.pos.x, e.pos.z + 1);
    }
  } else G.shake = 1;
  if (enemyEvents.onKilled) enemyEvents.onKilled(e);
  return true;
}

// ---------- granadas ----------
const grenades = [];
const grenMat = new THREE.MeshStandardMaterial({ color: 0x3a4a2a, roughness: 0.6, metalness: 0.3 });
const grenGeo = new THREE.SphereGeometry(0.14, 10, 8);
let grenCool = 0;
export function throwGrenade() {
  if (player.dead || grenCool > 0) return;
  if (bag.grenades <= 0) { ui.feed('Sem granadas', '#a09070'); return; }
  bag.grenades--; grenCool = GRENADE.COOLDOWN;
  const fx = Math.sin(G.yaw), fz = Math.cos(G.yaw), up = GRENADE.UP + G.pitch * 8;
  const m = new THREE.Mesh(grenGeo, grenMat); m.castShadow = true;
  const blink = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW, color: 0xff3020, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }));
  blink.scale.setScalar(0.6); m.add(blink);
  const p = new THREE.Vector3(player.pos.x + fx * 0.6, 1.6, player.pos.z + fz * 0.6); m.position.copy(p); scene.add(m);
  grenades.push({ m, blink, p, vx: fx * GRENADE.SPEED + player.vx * 0.4, vy: Math.max(2, up), vz: fz * GRENADE.SPEED + player.vz * 0.4, fuse: GRENADE.FUSE });
  sfx.swap(); ui.feed('Granada!', '#70c0ff');
}
function explode(g) {
  const { x, z } = g.p;
  explosion(x, z, GRENADE.RADIUS); sfx.explosion(); G.shake = Math.max(G.shake, 0.8);
  makeNoise(x, z, NOISE.GRENADE);
  let kills = 0, hits = 0;
  for (const e of enemies) {
    if (e.dead) continue;
    const dx = e.pos.x - x, dz = e.pos.z - z, d = Math.hypot(dx, dz) - e.cfg.r * 0.5;
    if (d > GRENADE.RADIUS) continue;
    if (castWorld(x, z, dx / (d || 1), dz / (d || 1), Math.max(0, d - 0.3), 1.2) < d - 0.6) continue; // cobertura protege
    const k = 1 - Math.max(0, d) / GRENADE.RADIUS, dmg = Math.round(GRENADE.DMG * (0.35 + 0.65 * k));
    e.stun = Math.max(e.stun, GRENADE.STUN * (e.cfg.boss ? 0.5 : 1)); e.windup = 0; e.charge = 0; hits++;
    ui.floater(dmg + '!', e.pos.x, 1.9 * e.cfg.scale, e.pos.z, 'crit big');
    const l = Math.hypot(dx, dz) || 1;
    if (damageEnemy(e, dmg, dx / l, dz / l, 8)) kills++;
  }
  if (hits) { ui.hitMarker(kills > 0, true); G.hits++; }
  G.shots++;
  const pd = Math.hypot(player.pos.x - x, player.pos.z - z);
  if (pd < GRENADE.RADIUS * 0.55) hurtPlayer(18, x, z, 10);
  scene.remove(g.m); g.blink.material.dispose();
}
function updateGrenades(dt) {
  grenCool -= dt;
  for (let i = grenades.length - 1; i >= 0; i--) {
    const g = grenades[i]; g.fuse -= dt;
    g.vy -= GRENADE.GRAV * dt;
    g.p.x += g.vx * dt; g.p.z += g.vz * dt; g.p.y += g.vy * dt;
    if (g.p.y < 0.14) { g.p.y = 0.14; g.vy = -g.vy * 0.35; g.vx *= 0.6; g.vz *= 0.6; if (Math.abs(g.vy) > 1) sfx.tick(); }
    const px = g.p.x, pz = g.p.z;
    if (g.p.y < 2.2 && resolve(g.p, 0.15)) { // ricocheteia em paredes
      const nx = g.p.x - px, nz = g.p.z - pz;
      if (Math.abs(nx) > Math.abs(nz)) g.vx = -g.vx * 0.4; else g.vz = -g.vz * 0.4;
    }
    g.m.position.copy(g.p); g.m.rotation.x += dt * 10;
    g.blink.visible = Math.floor(g.fuse * (g.fuse < 0.5 ? 16 : 6)) % 2 === 0;
    if (g.fuse <= 0) { explode(g); grenades.splice(i, 1); }
  }
}
function clearGrenades() { grenades.forEach((g) => { scene.remove(g.m); g.blink.material.dispose(); }); grenades.length = 0; }

// ---------- itens ----------
export const pickups = [];
const medMat = new THREE.MeshStandardMaterial({ color: 0xeeeeee, emissive: 0x222222 }), redMat = new THREE.MeshBasicMaterial({ color: 0xdd1111 });
const ammoMat = new THREE.MeshStandardMaterial({ color: 0x4a5530 }), bandMat = new THREE.MeshBasicMaterial({ color: 0xe8c040 });
const gunMat = new THREE.MeshStandardMaterial({ color: 0x151515, metalness: 0.6, roughness: 0.4 }), woodMat = new THREE.MeshStandardMaterial({ color: 0x5a3a20 });
const unit = new THREE.BoxGeometry(1, 1, 1);
const vestMat = new THREE.MeshStandardMaterial({ color: 0x2c3a52, roughness: 0.85 }), strapMat = new THREE.MeshStandardMaterial({ color: 0x15181c });
const crateMat = new THREE.MeshStandardMaterial({ color: 0x6a5232, roughness: 0.9 }), crateBand = new THREE.MeshStandardMaterial({ color: 0x2c2c2c, metalness: 0.5 });
const smgAmmoMat = new THREE.MeshStandardMaterial({ color: 0x5a4020 }), smgBand = new THREE.MeshBasicMaterial({ color: 0xff9a30 });
const glowCol = { med: 0xff5050, ammo: 0xffd040, grenade: 0x70c0ff, shotgun: 0xffffff, smg: 0x60ffb0, smgammo: 0xff9a30, vest: 0x5aa0ff, crate: 0xfff0c0 };
const ringMats = Object.fromEntries(Object.entries(glowCol).map(([k, c]) => [k, new THREE.SpriteMaterial({ map: GLOW, color: c, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0.55 })]));
function box(w, h, d, mat, parent, y = 0, z = 0) { const m = new THREE.Mesh(unit, mat); m.scale.set(w, h, d); m.position.set(0, y, z); m.castShadow = true; parent.add(m); }

/** Cria item. opts.id = item fixo do mapa (persistente, não conta no limite de drops). */
export function spawnPickup(kind, x, z, opts = {}) {
  if (!opts.id) {
    const drops = pickups.filter((p) => !p.id);
    if (drops.length >= PICKUPS.MAX_DROPS) { const old = drops[0]; scene.remove(old.g); pickups.splice(pickups.indexOf(old), 1); }
  }
  const g = new THREE.Group();
  if (kind === 'med') { box(0.55, 0.38, 0.4, medMat, g); box(0.3, 0.1, 0.42, redMat, g); box(0.1, 0.3, 0.42, redMat, g); }
  else if (kind === 'grenade') { const s = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), grenMat); s.castShadow = true; g.add(s); box(0.08, 0.14, 0.08, bandMat, g, 0.22); }
  else if (kind === 'shotgun') { box(0.09, 0.09, 1.1, gunMat, g); box(0.12, 0.14, 0.4, woodMat, g, -0.04, -0.2); box(0.1, 0.18, 0.32, woodMat, g, -0.08, -0.55); }
  else if (kind === 'smg') { box(0.1, 0.14, 0.6, gunMat, g); box(0.05, 0.05, 0.25, gunMat, g, 0.02, 0.4); box(0.07, 0.3, 0.08, gunMat, g, -0.2, 0.05); box(0.08, 0.2, 0.09, gunMat, g, -0.14, -0.15); box(0.04, 0.04, 0.35, gunMat, g, 0.02, -0.42); }
  else if (kind === 'smgammo') { box(0.45, 0.3, 0.32, smgAmmoMat, g); box(0.47, 0.07, 0.34, smgBand, g, 0.05); }
  else if (kind === 'vest') { box(0.6, 0.7, 0.18, vestMat, g); box(0.62, 0.08, 0.2, strapMat, g, 0.1); box(0.62, 0.08, 0.2, strapMat, g, -0.15); }
  else if (kind === 'crate') { box(0.8, 0.6, 0.6, crateMat, g); box(0.82, 0.08, 0.62, crateBand, g, 0.18); box(0.82, 0.08, 0.62, crateBand, g, -0.18); box(0.3, 0.3, 0.02, redMat, g, 0, 0.31); }
  else { box(0.55, 0.34, 0.38, ammoMat, g); box(0.57, 0.08, 0.4, bandMat, g, 0.06); }
  const ring = new THREE.Sprite(ringMats[kind] || ringMats.ammo); ring.scale.setScalar(kind === 'shotgun' || kind === 'smg' ? 2.4 : kind === 'crate' ? 2.2 : 1.6); g.add(ring);
  const baseY = opts.y ?? (kind === 'crate' ? 0.45 : 0.6);
  g.position.set(x, baseY, z); scene.add(g); pickups.push({ g, ring, kind, x, z, baseY, id: opts.id || null, t: Math.random() * 5, msgT: 0, still: kind === 'crate' });
}
export function clearPickups() { pickups.forEach((p) => scene.remove(p.g)); pickups.length = 0; clearGrenades(); }

function tryCollect(p) {
  const full = (msg) => { if (p.msgT <= 0) { ui.feed(msg, '#aaa'); p.msgT = 2; } return false; };
  switch (p.kind) {
    case 'med':
      if (bag.meds < INVENTORY.MED_MAX) { bag.meds++; ui.feed(`+1 Kit médico (${bag.meds}/${INVENTORY.MED_MAX}) — H para usar`, '#ff9a9a'); }
      else if (player.hp < PLAYER.HP) { heal(PICKUPS.MED_HEAL); ui.feed(`+${PICKUPS.MED_HEAL} Vida`, '#ff9a9a'); }
      else return full('Kits médicos no máximo');
      break;
    case 'grenade':
      if (bag.grenades >= GRENADE.MAX) return full('Granadas no máximo');
      bag.grenades++; ui.feed(`+1 Granada (${bag.grenades}/${GRENADE.MAX}) — G para arremessar`, '#90d0ff');
      break;
    case 'shotgun':
      bag.owned[1] = true; weapons[1].mag = weapons[1].size; weapons[1].res = Math.max(weapons[1].res, 6);
      switchWeapon(1); ui.banner('ESCOPETA', 'Arma nova! Tecla 2 ou Q para alternar', 2.6); sfx.reloadEnd();
      break;
    case 'smg':
      bag.owned[2] = true; weapons[2].mag = weapons[2].size; weapons[2].res = Math.max(weapons[2].res, 30);
      switchWeapon(2); ui.banner('SUBMETRALHADORA', 'Arma nova! Automática — segure para disparar. Tecla 3, Q ou roda', 3); sfx.reloadEnd();
      break;
    case 'smgammo': {
      const sm = weapons[2];
      if (sm.res >= SMG_RES_MAX) return full('Balas de submetralhadora no máximo');
      const add = Math.min(PICKUPS.AMMO_SMG, SMG_RES_MAX - sm.res);
      sm.res += add; ui.feed(ui.STR.smgAmmo(add) + (bag.owned[2] ? '' : ' (ache a submetralhadora!)'), '#ffb060');
      break;
    }
    case 'vest':
      if (bag.armor >= ARMOR.MAX) return full('Colete já está inteiro');
      bag.armor = Math.min(ARMOR.MAX, bag.armor + ARMOR.VEST); ui.feed(`Colete vestido (${bag.armor}) — absorve parte do dano`, '#8fb8ff');
      break;
    case 'crate': {
      // v6: caixa de suprimentos brilhante — abre com munição para o que você tem e um kit médico
      const got = [];
      const sg = weapons[1], sm = weapons[2];
      if (bag.owned[1] && sg.res < SHOTGUN_RES_MAX) { const a = Math.min(8, SHOTGUN_RES_MAX - sg.res); sg.res += a; got.push(`+${a} cartuchos`); }
      if (bag.owned[2] && sm.res < SMG_RES_MAX) { const a = Math.min(45, SMG_RES_MAX - sm.res); sm.res += a; got.push(`+${a} balas`); }
      if (!bag.owned[1] && !bag.owned[2] && sg.res < SHOTGUN_RES_MAX) { const a = Math.min(6, SHOTGUN_RES_MAX - sg.res); sg.res += a; got.push(`+${a} cartuchos`); }
      if (bag.meds < INVENTORY.MED_MAX) { bag.meds++; got.push('+1 kit médico'); } else if (player.hp < PLAYER.HP) { heal(PICKUPS.MED_HEAL); got.push(`+${PICKUPS.MED_HEAL} vida`); }
      if (bag.grenades < GRENADE.MAX && Math.random() < 0.5) { bag.grenades++; got.push('+1 granada'); }
      if (!got.length) return full('Caixa de suprimentos: nada que você precise agora');
      ui.feed('Caixa de suprimentos: ' + got.join(', '), '#fff0c0');
      burst(p.x, 0.9, p.z, 'dust', 8, 2);
      break;
    }
    default: {
      const sg = weapons[1];
      if (sg.res >= SHOTGUN_RES_MAX) return full(ui.STR.ammoFull);
      const add = Math.min(PICKUPS.AMMO_SHELLS, SHOTGUN_RES_MAX - sg.res);
      sg.res += add; ui.feed(ui.STR.ammo(add) + (bag.owned[1] ? '' : ' (ache a escopeta!)'), '#ffe070');
    }
  }
  return true;
}
function updatePickups(dt) {
  for (let i = pickups.length - 1; i >= 0; i--) {
    const p = pickups[i]; p.t += dt; p.msgT -= dt;
    if (p.still) { p.ring.material.opacity = 0.4 + 0.25 * Math.sin(p.t * 4); } // caixa não gira: só pulsa o brilho
    else { p.g.rotation.y += dt * 1.5; p.g.position.y = p.baseY + Math.sin(p.t * 3) * 0.12; }
    if (player.dead || Math.hypot(p.x - player.pos.x, p.z - player.pos.z) >= 1.3) continue;
    if (!tryCollect(p)) continue;
    sfx.pickup(); burst(p.x, 0.8, p.z, 'spark', 8, 2); scene.remove(p.g); pickups.splice(i, 1);
    if (p.id && combatEvents.onWorldPickup) combatEvents.onWorldPickup(p.id);
  }
}

/** Por frame: auto-recarga, combo, retícula sobre inimigo, granadas e itens. */
export function updateCombat(dt) {
  if (autoReloadT > 0) { autoReloadT -= dt; if (autoReloadT <= 0 && G.state === 'play') startReload(); }
  if (G.comboT > 0) { G.comboT -= dt; if (G.comboT <= 0) G.combo = 0; }
  ui.setCrossEnemy(G.state === 'play' && !!aimRay().e);
  updateGrenades(dt);
  updatePickups(dt);
}
export function resetCombat() { autoReloadT = 0; grenCool = 0; G.combo = 0; G.comboT = 0; clearGrenades(); }
