// player.js — personagem (malha low-poly), movimento, vida, armas e câmera em terceira pessoa.
import * as THREE from 'three';
import { scene, camera, resolve, castWorld, inWater, bounds, GLOW } from './world.js';
import { PLAYER, CAMERA, WEAPONS, COLORS, GRENADE, INVENTORY, PICKUPS } from './config.js';
import { G } from './state.js';
import { keys } from './input.js';
import { sfx, roar } from './audio.js';
import { burst, decal } from './fx.js';
import * as ui from './ui.js';
import { damp, clamp, wrapAngle } from './utils.js';

export const player = { pos: new THREE.Vector3(), r: PLAYER.RADIUS, hp: PLAYER.HP, inv: 0, kx: 0, kz: 0, phase: 0, dead: false, moving: false, running: false, stepT: 0, vx: 0, vz: 0 };
export const events = { onDeath: null };

// ---------- malha ----------
export const pg = new THREE.Group(); scene.add(pg);
const suit = new THREE.MeshStandardMaterial({ color: 0x4b5a3a, roughness: 0.8 });
const vest = new THREE.MeshStandardMaterial({ color: 0x2a2f2a, roughness: 0.7 });
const skinM = new THREE.MeshStandardMaterial({ color: 0xd0a07a, roughness: 0.8 });
const hairM = new THREE.MeshStandardMaterial({ color: 0x5a2a1a, roughness: 0.9 });
const bootM = new THREE.MeshStandardMaterial({ color: 0x1c1712, roughness: 0.9 });
const packM = new THREE.MeshStandardMaterial({ color: 0x3a3a2a, roughness: 0.9 });
const gunM = new THREE.MeshStandardMaterial({ color: 0x151515, metalness: 0.6, roughness: 0.4 });
const woodM = new THREE.MeshStandardMaterial({ color: 0x5a3a20, roughness: 0.8 });
function part(geo, mat, x, y, z, parent = pg) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; parent.add(m); return m; }
const B = (w, h, d) => new THREE.BoxGeometry(w, h, d);

const torso = part(B(0.62, 0.75, 0.36), suit, 0, 1.25, 0);
part(B(0.66, 0.45, 0.4), vest, 0, 1.35, 0);
part(B(0.46, 0.5, 0.2), packM, 0, 1.32, -0.28);        // mochila
part(new THREE.SphereGeometry(0.2, 12, 10), skinM, 0, 1.85, 0);
part(new THREE.SphereGeometry(0.21, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), hairM, 0, 1.9, -0.02);
part(B(0.12, 0.22, 0.12), hairM, 0, 1.72, -0.2);        // rabo de cavalo
const legL = new THREE.Group(), legR = new THREE.Group(); legL.position.set(-0.16, 0.9, 0); legR.position.set(0.16, 0.9, 0); pg.add(legL, legR);
for (const leg of [legL, legR]) { part(B(0.22, 0.88, 0.26), suit, 0, -0.44, 0, leg); part(B(0.24, 0.16, 0.34), bootM, 0, -0.84, 0.04, leg); }
const armR = new THREE.Group(); armR.position.set(0.38, 1.5, 0); pg.add(armR);
part(B(0.16, 0.16, 0.6), suit, 0, -0.08, 0.25, armR);
const armL = new THREE.Group(); armL.position.set(-0.38, 1.5, 0); pg.add(armL);
part(B(0.16, 0.16, 0.6), suit, 0.12, -0.08, 0.25, armL); armL.rotation.y = -0.45;

// armas visíveis (troca de modelo)
const pistolMesh = new THREE.Group(); armR.add(pistolMesh);
part(B(0.1, 0.16, 0.42), gunM, 0, -0.06, 0.68, pistolMesh);
const shotgunMesh = new THREE.Group(); armR.add(shotgunMesh); shotgunMesh.visible = false;
part(B(0.09, 0.09, 0.95), gunM, 0, -0.04, 0.85, shotgunMesh);
part(B(0.12, 0.12, 0.35), woodM, 0, -0.1, 0.62, shotgunMesh);
part(B(0.1, 0.16, 0.3), woodM, 0, -0.14, 0.25, shotgunMesh);

export const gunTip = new THREE.Object3D(); gunTip.position.set(0, -0.05, 0.98); armR.add(gunTip);
// clarão do disparo: sprite + "estrela" de dois planos + luz forte
const flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW, color: COLORS.muzzle, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
flash.visible = false; gunTip.add(flash);
const starMat = new THREE.MeshBasicMaterial({ map: GLOW, color: 0xffe0a0, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, side: THREE.DoubleSide });
const star = new THREE.Group(); gunTip.add(star); star.visible = false;
for (let i = 0; i < 2; i++) { const p = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 1.6), starMat); p.rotation.x = Math.PI / 2; p.rotation.y = i * Math.PI / 2; p.position.z = 0.6; star.add(p); }
const flashLight = new THREE.PointLight(0xffc060, 0, 12, 2); gunTip.add(flashLight);
// lanterna
const torch = new THREE.SpotLight(0xfff0d0, 70, 34, Math.PI / 7, 0.45, 1.5);
torch.position.set(0.38, 1.45, 0.3); torch.castShadow = true; torch.shadow.mapSize.set(1024, 1024); torch.shadow.bias = -0.0005;
pg.add(torch); const torchT = new THREE.Object3D(); torchT.position.set(0.38, 0.6, 12); pg.add(torchT); torch.target = torchT;

// ---------- armas ----------
export const weapons = WEAPONS.map((w) => ({ ...w, mag: w.size, res: w.startRes }));
export const arms = { cur: 0, cool: 0, reloading: 0, reloadTotal: 1, flashT: 0 };
export const curWeapon = () => weapons[arms.cur];
/** Inventário: armas possuídas, granadas e kits médicos guardados. */
export const bag = { owned: [true, false], grenades: GRENADE.START, meds: INVENTORY.MED_START };

export function switchWeapon(i) {
  if (i === arms.cur || player.dead) return;
  if (!bag.owned[i]) { ui.feed('Você ainda não tem: ' + weapons[i].name, '#a09070'); return; }
  arms.cur = i; arms.reloading = 0; arms.cool = 0.25; sfx.swap(); ui.feed(weapons[i].name, '#d8c27a');
  pistolMesh.visible = i === 0; shotgunMesh.visible = i === 1;
}
export function startReload() {
  const w = curWeapon(); if (arms.reloading > 0 || w.mag >= w.size || w.res <= 0 || player.dead) return;
  arms.reloading = arms.reloadTotal = w.reload; sfx.reloadStart();
}
function updateWeapons(dt) {
  arms.cool -= dt;
  if (arms.reloading > 0) {
    arms.reloading -= dt;
    if (arms.reloading <= 0) {
      const w = curWeapon(), take = Math.min(w.size - w.mag, w.res);
      w.mag += take; if (w.res !== Infinity) w.res -= take; sfx.reloadEnd();
    }
  }
  arms.flashT -= dt;
  flash.visible = star.visible = arms.flashT > 0;
  flashLight.intensity *= Math.exp(-35 * dt);
}
/** Efeito visual do disparo (chamado por combat.js). */
export function muzzleFlash(big) {
  arms.flashT = 0.05;
  flash.material.rotation = Math.random() * 6; flash.scale.setScalar(big ? 2.0 : 1.3);
  star.rotation.z = Math.random() * 3; star.scale.setScalar(big ? 1.5 : 1);
  flashLight.intensity = big ? 90 : 55;
  recoil += big ? 0.09 : 0.04;
}

// ---------- vida ----------
export function hurtPlayer(d, fromX, fromZ, knock) {
  if (player.inv > 0 || G.state !== 'play' || player.dead) return;
  player.hp = Math.max(0, player.hp - d); player.inv = PLAYER.INVULN; G.shake = Math.max(G.shake, 0.45);
  const dx = player.pos.x - fromX, dz = player.pos.z - fromZ, l = Math.hypot(dx, dz) || 1;
  player.kx += dx / l * knock; player.kz += dz / l * knock;
  // direção do atacante relativa à câmera (para o indicador de dano)
  const att = Math.atan2(fromX - player.pos.x, fromZ - player.pos.z);
  ui.damageFrom(wrapAngle(att - G.yaw)); ui.hurtFlash();
  sfx.hurt(); burst(player.pos.x, 1.3, player.pos.z, 'blood', 8, 3); decal(player.pos.x, player.pos.z, 0.8);
  if (player.hp <= 0) { player.dead = true; roar(0.9, 0.4); if (events.onDeath) events.onDeath(); }
}
export function heal(n) { player.hp = Math.min(PLAYER.HP, player.hp + n); }
/** Usa um kit médico do inventário (tecla H). */
export function useMed() {
  if (player.dead) return false;
  if (bag.meds <= 0) { ui.feed('Sem kits médicos', '#a09070'); return false; }
  if (player.hp >= PLAYER.HP) { ui.feed('Vida já está cheia', '#a09070'); return false; }
  bag.meds--; heal(PICKUPS.MED_HEAL); sfx.pickup(); ui.feed('+' + PICKUPS.MED_HEAL + ' VIDA (kit médico)', '#ff7070'); return true;
}
/** Coloca o jogador num ponto (troca de área / carregar jogo). */
export function placePlayer(x, z, yaw) {
  player.pos.set(x, 0, z); player.kx = player.kz = 0; G.yaw = yaw; G.pitch = -0.12;
  pg.position.set(x, 0, z); pg.rotation.y = yaw; snapCamera();
}
export function snapshotBag() {
  return { owned: [...bag.owned], grenades: bag.grenades, meds: bag.meds, hp: player.hp, cur: arms.cur, ammo: weapons.map((w) => ({ mag: w.mag, res: w.res === Infinity ? -1 : w.res })) };
}
export function restoreBag(s) {
  bag.owned = [...s.owned]; bag.grenades = s.grenades; bag.meds = s.meds; player.hp = PLAYER.HP; // terminal restaura a vida
  s.ammo.forEach((a, i) => { weapons[i].mag = a.mag; weapons[i].res = a.res < 0 ? Infinity : a.res; });
  arms.cur = bag.owned[s.cur] ? s.cur : 0; pistolMesh.visible = arms.cur === 0; shotgunMesh.visible = arms.cur === 1;
}

export function resetPlayer() {
  Object.assign(player, { hp: PLAYER.HP, inv: 0, kx: 0, kz: 0, dead: false, phase: 0, moving: false });
  player.pos.set(0, 0, 0); pg.rotation.set(0, 0, 0); pg.position.set(0, 0, 0); pg.visible = true;
  weapons.forEach((w) => { w.mag = w.size; w.res = w.startRes; });
  bag.owned = [true, false]; bag.grenades = GRENADE.START; bag.meds = INVENTORY.MED_START;
  arms.cur = 0; arms.cool = 0; arms.reloading = 0; pistolMesh.visible = true; shotgunMesh.visible = false;
  G.yaw = Math.PI; G.pitch = -0.12; G.aiming = false;
  snapCamera();
}

// ---------- atualização ----------
let heartT = 0;
export function updatePlayer(dt) {
  updateWeapons(dt);
  if (player.dead) { player.vx = player.vz = 0; pg.rotation.x = Math.max(pg.rotation.x - dt * 3, -Math.PI / 2); pg.position.y = 0.2 * Math.min(1, -pg.rotation.x); pg.visible = true; return; }
  if (keys.ArrowLeft) G.yaw += dt * 2.4; if (keys.ArrowRight) G.yaw -= dt * 2.4;
  let ix = 0, iz = 0;
  if (keys.KeyW || keys.ArrowUp) iz += 1; if (keys.KeyS || keys.ArrowDown) iz -= 1; if (keys.KeyD) ix += 1; if (keys.KeyA) ix -= 1;
  const fx = Math.sin(G.yaw), fz = Math.cos(G.yaw), rx = -fz, rz = fx;
  let mx = fx * iz + rx * ix, mz = fz * iz + rz * ix; const ml = Math.hypot(mx, mz);
  const run = (keys.ShiftLeft || keys.ShiftRight) && iz > 0 && !G.aiming;
  const sp = (run ? PLAYER.RUN : PLAYER.WALK) * (iz < 0 ? PLAYER.BACK_MULT : 1) * (arms.reloading > 0 ? PLAYER.RELOAD_MULT : 1) * (G.aiming ? PLAYER.AIM_MULT : 1) * (inWater(player.pos.x, player.pos.z) ? PLAYER.WATER_MULT : 1);
  if (ml > 0) { mx /= ml; mz /= ml; }
  player.moving = ml > 0; player.running = run && ml > 0;
  player.vx = mx * sp; player.vz = mz * sp;
  player.pos.x += (mx * sp + player.kx) * dt; player.pos.z += (mz * sp + player.kz) * dt;
  const k = Math.exp(-9 * dt); player.kx *= k; player.kz *= k;
  resolve(player.pos, player.r);
  pg.position.set(player.pos.x, 0, player.pos.z); pg.rotation.y = G.yaw;
  if (ml > 0) player.phase += dt * (run ? 13 : 9);
  const sw = ml > 0 ? Math.sin(player.phase) * 0.6 : 0;
  legL.rotation.x = sw; legR.rotation.x = -sw; torso.position.y = 1.25 + Math.abs(sw) * 0.04;
  armR.rotation.x = -G.pitch * 0.8 - (arms.cool > curWeapon().rate * 0.6 ? 0.25 : 0); armL.rotation.x = armR.rotation.x;
  if (arms.reloading > 0) armR.rotation.x += 0.6;
  // poeira ao correr
  if (run) { player.stepT -= dt; if (player.stepT <= 0) { player.stepT = 0.16; burst(player.pos.x - fx * 0.3, 0.1, player.pos.z - fz * 0.3, 'dust', 2, 0.8); } }
  player.inv -= dt;
  pg.visible = !(player.inv > 0 && Math.floor(G.time * 20) % 2 === 0);
  // batimento cardíaco com pouca vida
  if (player.hp < PLAYER.LOW_HP) { heartT -= dt; if (heartT <= 0) { heartT = 0.6 + player.hp / 60; sfx.heartbeat(); } }
}

// ---------- câmera em terceira pessoa (atrás / sobre o ombro) ----------
const pivot = new THREE.Vector3(0, CAMERA.HEIGHT, 0);
let camDist = CAMERA.DIST, shoulderCur = CAMERA.SHOULDER, recoil = 0;
const look = new THREE.Vector3();
/** Distância até sair do retângulo da área (a câmera não atravessa o muro de borda). */
function boundRay(ox, oz, dx, dz) {
  let t = Infinity;
  if (dx > 1e-4) t = Math.min(t, (bounds.maxX - ox) / dx); else if (dx < -1e-4) t = Math.min(t, (bounds.minX - ox) / dx);
  if (dz > 1e-4) t = Math.min(t, (bounds.maxZ - oz) / dz); else if (dz < -1e-4) t = Math.min(t, (bounds.minZ - oz) / dz);
  return Math.max(0, t);
}
function snapCamera() { pivot.set(player.pos.x, CAMERA.HEIGHT, player.pos.z); camDist = CAMERA.DIST; recoil = 0; }

export function updateCamera(dt) {
  const fx = Math.sin(G.yaw), fz = Math.cos(G.yaw), rx = -fz, rz = fx;
  // pivô segue o jogador com suavização (sem atrasar a mira, que usa yaw/pitch direto)
  pivot.x = damp(pivot.x, player.pos.x, CAMERA.FOLLOW, dt);
  pivot.z = damp(pivot.z, player.pos.z, CAMERA.FOLLOW, dt);
  // ombro: lado escolhido com V, recolhe se houver parede ao lado
  const wantSh = (G.aiming ? CAMERA.SHOULDER * 0.85 : CAMERA.SHOULDER) * G.shoulder;
  const side = castWorld(pivot.x, pivot.z, rx * Math.sign(wantSh), rz * Math.sign(wantSh), Math.abs(wantSh) + 0.3, 1.8);
  const sh = Math.sign(wantSh) * Math.max(0, Math.min(Math.abs(wantSh), side - 0.3));
  shoulderCur = damp(shoulderCur, sh, 10, dt);
  const hx = pivot.x + rx * shoulderCur, hz = pivot.z + rz * shoulderCur, hy = CAMERA.HEIGHT;
  // distância desejada + colisão com paredes/árvores (entra rápido, sai devagar)
  const pitch = G.pitch + recoil;
  const want = G.aiming ? CAMERA.AIM_DIST : CAMERA.DIST;
  const back = Math.cos(pitch) * want;
  const hit = Math.min(castWorld(hx, hz, -fx, -fz, back + 0.4, 1.8), boundRay(hx, hz, -fx, -fz) + 0.6);
  const target = clamp(hit - 0.35, CAMERA.MIN_DIST, back);
  camDist = target < camDist ? damp(camDist, target, 30, dt) : damp(camDist, target, 5, dt);
  const up = -Math.sin(pitch) * want * (camDist / Math.max(back, 0.01));
  camera.position.set(hx - fx * camDist, Math.max(0.6, hy + up + 0.3), hz - fz * camDist);
  look.set(hx + fx * 10, hy + Math.sin(pitch) * 10.5 + 0.1, hz + fz * 10);
  if (G.shake > 0.005) {
    const s = G.shake * 0.45, t = G.time * 60;
    camera.position.x += Math.sin(t * 1.3) * s * 0.5; camera.position.y += Math.sin(t * 1.7 + 1) * s * 0.5; camera.position.z += Math.sin(t * 1.1 + 2) * s * 0.5;
  }
  camera.lookAt(look);
  // zoom de mira
  const fov = G.aiming ? CAMERA.AIM_FOV : CAMERA.FOV;
  if (Math.abs(camera.fov - fov) > 0.05) { camera.fov = damp(camera.fov, fov, 12, dt); camera.updateProjectionMatrix(); }
  recoil = damp(recoil, 0, 14, dt);
  // lanterna acompanha a inclinação da câmera
  torchT.position.set(0.38, 1.45 + Math.sin(G.pitch) * 12, 12);
  G.shake *= Math.exp(-6 * dt);
}
/** Câmera do menu: órbita lenta ao redor do centro. */
export function menuCamera(dt) {
  G.yaw += dt * 0.15; G.pitch = -0.12;
  updateCamera(dt);
}
