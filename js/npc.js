// npc.js — a sobrevivente (Dra. Lima): espera na cabine, segue o jogador e é derrubada (não morre) por mordidas.
import * as THREE from 'three';
import { scene, resolve, GLOW } from './world.js';
import { G } from './state.js';
import { player } from './player.js';
import { sfx } from './audio.js';
import { burst } from './fx.js';
import * as ui from './ui.js';
import { lerpAngle } from './utils.js';

export const survivor = {
  pos: new THREE.Vector3(), yaw: 0, following: false, downT: 0, visible: false, phase: 0, home: { x: 0, z: 0 }, goal: null, name: 'Dra. Lima',
};

// ---------- malha (jaleco branco, cabelo preto, rádio) ----------
const g = new THREE.Group(); g.visible = false; scene.add(g);
const coat = new THREE.MeshStandardMaterial({ color: 0xd8d8d0, roughness: 0.8 });
const pants = new THREE.MeshStandardMaterial({ color: 0x2a3040, roughness: 0.9 });
const skin = new THREE.MeshStandardMaterial({ color: 0x8a5a3a, roughness: 0.8 });
const hair = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });
const P = (geo, m, x, y, z, par = g) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; par.add(o); return o; };
const B = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const body = new THREE.Group(); g.add(body);
P(B(0.58, 0.8, 0.34), coat, 0, 1.25, 0, body); P(B(0.62, 0.35, 0.38), coat, 0, 0.82, 0, body);
P(new THREE.SphereGeometry(0.19, 12, 10), skin, 0, 1.83, 0, body);
P(new THREE.SphereGeometry(0.2, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.6), hair, 0, 1.88, -0.02, body);
P(B(0.3, 0.3, 0.12), hair, 0, 1.75, -0.16, body);
const legs = [-0.14, 0.14].map((x) => { const l = new THREE.Group(); l.position.set(x, 0.85, 0); body.add(l); P(B(0.2, 0.85, 0.22), pants, 0, -0.42, 0, l); return l; });
// braços articulados (aceno quando espera), óculos, crachá, coque, tablet e barra do jaleco aberta
const arms = [-0.36, 0.36].map((x) => { const a = new THREE.Group(); a.position.set(x, 1.55, 0.02); body.add(a); P(B(0.14, 0.62, 0.14), coat, 0, -0.3, 0, a); P(new THREE.SphereGeometry(0.07, 8, 6), skin, 0, -0.64, 0, a); return a; });
const darkM = new THREE.MeshStandardMaterial({ color: 0x101418, roughness: 0.3, metalness: 0.5 });
const badgeM = new THREE.MeshStandardMaterial({ color: 0xe0f0ff, emissive: 0x2a6a8a, emissiveIntensity: 0.6 });
const shirtM = new THREE.MeshStandardMaterial({ color: 0x5a7a8a, roughness: 0.8 });
P(B(0.2, 0.55, 0.02), shirtM, 0, 1.3, 0.172, body);                 // camisa por baixo do jaleco
for (const x of [-0.18, 0.18]) P(B(0.2, 0.42, 0.04), coat, x, 0.6, 0.15, body).rotation.x = -0.06; // abas do jaleco
P(B(0.3, 0.05, 0.03), darkM, 0, 1.86, 0.18, body);                   // óculos
P(B(0.09, 0.12, 0.02), badgeM, 0.18, 1.42, 0.18, body);              // crachá Tellus
P(new THREE.SphereGeometry(0.09, 8, 6), hair, 0, 1.9, -0.2, body);   // coque
const tablet = P(B(0.22, 0.3, 0.03), darkM, 0, -0.62, 0.1, arms[0]); tablet.rotation.x = -0.4;
P(new THREE.CylinderGeometry(0.1, 0.1, 0.06, 10), skin, 0, 1.64, 0, body); // pescoço
const marker = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW, color: 0x60ff90, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
marker.scale.setScalar(0.7); marker.position.y = 2.45; g.add(marker);

/** Coloca a sobrevivente esperando num ponto (cabine). */
export function resetSurvivor(x, z, show) {
  survivor.home = { x, z }; survivor.pos.set(x, 0, z); survivor.following = false; survivor.downT = 0; survivor.goal = null;
  survivor.visible = show; g.visible = show; body.rotation.set(0, 0, 0); survivor.yaw = 0.8;
}
export function hideSurvivor() { survivor.visible = false; survivor.following = false; g.visible = false; }
/** Mordida: derruba por ~2 s (ela não morre, mas a escolta atrasa). */
export function hurtSurvivor(e) {
  if (survivor.downT > 0) return;
  survivor.downT = 2.2; sfx.hurt(); burst(survivor.pos.x, 1.2, survivor.pos.z, 'blood', 6, 2.5);
  ui.feed(survivor.name + ' foi derrubada!', '#ff8060'); G.shake = Math.max(G.shake, 0.15);
  const dx = survivor.pos.x - e.pos.x, dz = survivor.pos.z - e.pos.z, l = Math.hypot(dx, dz) || 1;
  survivor.pos.x += dx / l * 0.8; survivor.pos.z += dz / l * 0.8; resolve(survivor.pos, 0.4);
}

export function updateSurvivor(dt) {
  if (!survivor.visible) return;
  marker.material.opacity = survivor.following ? 0.35 + 0.25 * Math.sin(G.time * 5) : 0.9;
  marker.material.color.setHex(survivor.downT > 0 ? 0xff5040 : 0x60ff90);
  if (survivor.downT > 0) {
    survivor.downT -= dt;
    body.rotation.x = Math.max(body.rotation.x - dt * 6, -1.35); body.position.y = 0.15;
    if (survivor.downT <= 0) { survivor.downT = 0; ui.feed(survivor.name + ' levantou', '#a0ffb0'); }
    g.position.copy(survivor.pos); return;
  }
  body.rotation.x += (0 - body.rotation.x) * Math.min(1, dt * 8); body.position.y = 0;
  let mvx = 0, mvz = 0, spd = 0;
  const tgt = survivor.goal || (survivor.following ? player.pos : null);
  if (tgt) {
    const dx = tgt.x - survivor.pos.x, dz = tgt.z - survivor.pos.z, d = Math.hypot(dx, dz);
    const stop = survivor.goal ? 0.3 : 2.2;
    if (d > stop) { mvx = dx / d; mvz = dz / d; spd = Math.min(5.2, 2 + (d - stop) * 1.6); }
    if (d > 0.5) survivor.yaw = lerpAngle(survivor.yaw, Math.atan2(dx, dz), Math.min(1, dt * 8));
  } else {
    // esperando: acena virada para o jogador
    survivor.yaw = lerpAngle(survivor.yaw, Math.atan2(player.pos.x - survivor.pos.x, player.pos.z - survivor.pos.z), Math.min(1, dt * 3));
  }
  // braços: balançam ao andar, acenam quando o jogador está perto e ela espera
  const near = !survivor.following && Math.hypot(player.pos.x - survivor.pos.x, player.pos.z - survivor.pos.z) < 9;
  arms[1].rotation.x = near ? -2.6 : spd > 0 ? -Math.sin(survivor.phase) * 0.5 : 0;
  arms[1].rotation.z = near ? 0.3 * Math.sin(G.time * 8) : 0;
  arms[0].rotation.x = spd > 0 ? Math.sin(survivor.phase) * 0.4 : -0.5;
  survivor.pos.x += mvx * spd * dt; survivor.pos.z += mvz * spd * dt; resolve(survivor.pos, 0.4);
  if (spd > 0) survivor.phase += dt * 9;
  const sw = spd > 0 ? Math.sin(survivor.phase) * 0.55 : 0; legs[0].rotation.x = sw; legs[1].rotation.x = -sw;
  g.position.copy(survivor.pos); g.rotation.y = survivor.yaw;
}
