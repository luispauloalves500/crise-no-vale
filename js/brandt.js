// brandt.js — v7: o diretor Otávio Brandt em fuga (Ato 2). Não luta e não é alvo: corre por uma rota,
// some num portão, se esconde no cais do ninho e pode ser preso (tecla E, decidido pelo diretor).
import * as THREE from 'three';
import { scene, GLOW } from './world.js';
import { G } from './state.js';
import { player } from './player.js';
import { lerpAngle } from './utils.js';

export const brandt = { pos: new THREE.Vector3(), yaw: 0, visible: false, state: 'idle', path: null, pi: 0, speed: 5, onDone: null, phase: 0 };

// ---------- malha (terno escuro amarrotado, camisa branca, cabelo grisalho, maleta) ----------
const g = new THREE.Group(); g.visible = false; scene.add(g);
const M = (c, r = 0.85, extra = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: r, ...extra });
const suit = M(0x2a2c34), shirt = M(0xd8d8d0), skin = M(0xc09070), hair = M(0x9a9a98, 0.9), tie = M(0x8a1a18), dark = M(0x1a1410, 0.5, { metalness: 0.3 });
const P = (geo, m, x, y, z, par) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; par.add(o); return o; };
const B = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const body = new THREE.Group(); g.add(body);
P(B(0.6, 0.78, 0.36), suit, 0, 1.26, 0, body); P(B(0.62, 0.3, 0.38), suit, 0, 0.82, 0, body);
P(B(0.2, 0.5, 0.02), shirt, 0, 1.36, 0.185, body); P(B(0.07, 0.42, 0.02), tie, 0, 1.33, 0.2, body);
P(new THREE.SphereGeometry(0.19, 12, 10), skin, 0, 1.84, 0, body);
P(new THREE.SphereGeometry(0.2, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.45), hair, 0, 1.9, -0.03, body);
P(new THREE.CylinderGeometry(0.1, 0.1, 0.06, 10), skin, 0, 1.65, 0, body);
const legs = [-0.14, 0.14].map((x) => { const l = new THREE.Group(); l.position.set(x, 0.85, 0); body.add(l); P(B(0.2, 0.85, 0.22), suit, 0, -0.42, 0, l); return l; });
const arms = [-0.37, 0.37].map((x) => { const a = new THREE.Group(); a.position.set(x, 1.56, 0.02); body.add(a); P(B(0.14, 0.62, 0.14), suit, 0, -0.3, 0, a); P(new THREE.SphereGeometry(0.07, 8, 6), skin, 0, -0.64, 0, a); return a; });
P(B(0.42, 0.3, 0.1), dark, 0, -0.78, 0, arms[1]); // maleta com as últimas amostras
const marker = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW, color: 0xff6a40, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
marker.scale.setScalar(0.75); marker.position.y = 2.5; g.add(marker);

/** Mostra o Brandt parado num ponto. */
export function showBrandt(x, z, yaw = 0) {
  brandt.pos.set(x, 0, z); brandt.yaw = yaw; brandt.visible = true; brandt.state = 'idle'; brandt.path = null; brandt.onDone = null;
  g.visible = true; body.rotation.set(0, 0, 0); body.position.y = 0;
}
export function hideBrandt() { brandt.visible = false; brandt.state = 'idle'; brandt.path = null; brandt.onDone = null; g.visible = false; }
/** Corre pelos pontos [{x,z}] e chama onDone ao chegar (ex.: sumir no portão). */
export function brandtRun(path, speed = 5.5, onDone = null) { brandt.path = path; brandt.pi = 0; brandt.speed = speed; brandt.onDone = onDone; brandt.state = 'run'; }
/** Encolhido no cais tentando ligar o motor. */
export function brandtCower() { brandt.state = 'cower'; brandt.path = null; }
/** Preso: ajoelhado com as mãos na cabeça. */
export function brandtCaught() { brandt.state = 'caught'; brandt.path = null; }

export function updateBrandt(dt) {
  if (!brandt.visible) return;
  marker.material.opacity = brandt.state === 'caught' ? 0.25 : 0.55 + 0.35 * Math.sin(G.time * 6);
  marker.material.color.setHex(brandt.state === 'caught' ? 0x80ffb0 : 0xff6a40);
  let spd = 0;
  if (brandt.state === 'run' && brandt.path) {
    const tg = brandt.path[brandt.pi], dx = tg.x - brandt.pos.x, dz = tg.z - brandt.pos.z, d = Math.hypot(dx, dz);
    if (d < 0.4) {
      if (++brandt.pi >= brandt.path.length) { brandt.path = null; brandt.state = 'idle'; const f = brandt.onDone; brandt.onDone = null; if (f) f(); }
    } else {
      spd = brandt.speed; const k = Math.min(1, spd * dt / d);
      brandt.pos.x += dx * k; brandt.pos.z += dz * k;
      brandt.yaw = lerpAngle(brandt.yaw, Math.atan2(dx, dz), Math.min(1, dt * 10));
    }
  } else if (brandt.state !== 'caught') {
    brandt.yaw = lerpAngle(brandt.yaw, Math.atan2(player.pos.x - brandt.pos.x, player.pos.z - brandt.pos.z), Math.min(1, dt * 3));
  }
  if (spd > 0) brandt.phase += dt * 11;
  const sw = spd > 0 ? Math.sin(brandt.phase) * 0.7 : 0;
  legs[0].rotation.x = sw; legs[1].rotation.x = -sw;
  arms[0].rotation.x = -sw * 0.8; arms[1].rotation.x = sw * 0.5;
  arms[0].rotation.z = arms[1].rotation.z = 0;
  if (brandt.state === 'cower') { // agachado mexendo no motor, olhando para trás
    body.position.y = -0.35; body.rotation.x = 0.35; arms[0].rotation.x = -1.2; arms[1].rotation.x = -0.9 + 0.3 * Math.sin(G.time * 9);
  } else if (brandt.state === 'caught') {
    body.position.y = -0.42; body.rotation.x = 0; legs[0].rotation.x = legs[1].rotation.x = -1.4;
    arms[0].rotation.x = arms[1].rotation.x = -2.9; arms[0].rotation.z = 0.4; arms[1].rotation.z = -0.4;
  } else { body.position.y = 0; body.rotation.x = spd > 0 ? 0.18 : 0; }
  g.position.copy(brandt.pos); g.rotation.y = brandt.yaw;
}
