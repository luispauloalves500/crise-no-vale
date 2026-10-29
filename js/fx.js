// fx.js — partículas (sangue/faíscas/poeira/ácido), traçantes e manchas no chão, tudo com pool.
import * as THREE from 'three';
import { scene, GLOW, flashAt } from './world.js';
import { FX, COLORS } from './config.js';
import { rand, RingPool, softSplatTex } from './utils.js';
import { quality } from './quality.js';
import { SETTINGS } from './settings.js';

/** v6: quantidade de partículas conforme a qualidade (Baixo corta) e o modo "movimento reduzido". */
export const fxK = () => (quality.p.fx || 1) * (SETTINGS.reducedMotion ? 0.5 : 1);
/** Floreios pesados só em Médio/Alto e sem movimento reduzido. */
export const fxRich = () => !!quality.p.fxRich && !SETTINGS.reducedMotion;

const pGeo = new THREE.BoxGeometry(0.09, 0.09, 0.09);
const pMats = {
  blood: new THREE.MeshBasicMaterial({ color: COLORS.blood }),
  spark: new THREE.MeshBasicMaterial({ color: COLORS.spark, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }),
  spit: new THREE.MeshBasicMaterial({ color: COLORS.spit }),
  dust: new THREE.MeshBasicMaterial({ color: COLORS.dust }),
  fire: new THREE.MeshBasicMaterial({ color: COLORS.fire, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }),
};

// ---------- partículas ----------
const particles = new RingPool(FX.MAX_PARTICLES, () => {
  const m = new THREE.Mesh(pGeo, pMats.blood); m.visible = false; m.frustumCulled = false; scene.add(m);
  return { m, vx: 0, vy: 0, vz: 0, life: 0, life0: 1, s0: 1, grav: 12, shrink: false };
});
/** Explosão de partículas. kind: blood | spark | spit | dust | fire */
export function burst(x, y, z, kind, n, sp, dirX = 0, dirZ = 0) {
  n = Math.max(1, Math.round(n * fxK()));
  for (let i = 0; i < n; i++) {
    const p = particles.next();
    p.m.material = pMats[kind]; p.m.position.set(x, y, z); p.m.visible = true;
    const s = kind === 'dust' ? rand(1, 2.2) : rand(0.7, 1.4); p.m.scale.setScalar(s);
    p.vx = (rand(-1, 1) + dirX * 1.2) * sp; p.vy = rand(0.5, 1.6) * sp; p.vz = (rand(-1, 1) + dirZ * 1.2) * sp;
    p.grav = kind === 'dust' ? 3 : kind === 'fire' ? -1.5 : 12;
    p.life = p.life0 = rand(0.3, 0.7) * (kind === 'dust' ? 1.6 : 1); p.s0 = s; p.shrink = kind === 'spark' || kind === 'fire'; p.spark = kind === 'spark';
    if (kind === 'spark') p.m.scale.set(s * 0.5, s * 0.5, s * 2.2);
  }
}

// ---------- traçantes ----------
const trGeo = new THREE.BoxGeometry(0.04, 0.04, 1); trGeo.translate(0, 0, 0.5);
const tracers = new RingPool(FX.MAX_TRACERS, () => {
  const m = new THREE.Mesh(trGeo, new THREE.MeshBasicMaterial({ color: COLORS.tracer, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
  m.visible = false; scene.add(m); return { m, life: 0 };
});
export function tracer(a, b) {
  const t = tracers.next(); t.m.visible = true; t.life = 0.08;
  t.m.position.copy(a); t.m.lookAt(b); t.m.scale.z = Math.max(0.01, a.distanceTo(b));
}

// ---------- manchas no chão ----------
const splat = softSplatTex();
const decalGeo = new THREE.PlaneGeometry(1, 1); decalGeo.rotateX(-Math.PI / 2);
const decals = new RingPool(FX.MAX_DECALS, () => {
  const m = new THREE.Mesh(decalGeo, new THREE.MeshBasicMaterial({ map: splat, color: COLORS.blood, transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
  m.visible = false; m.renderOrder = 1; scene.add(m); return { m, life: 0 };
});
export function decal(x, z, size, color = COLORS.blood) {
  const d = decals.next(); d.m.visible = true; d.life = 14;
  d.m.material.color.setHex(color); d.m.material.opacity = 0.75;
  d.m.position.set(x, 0.015 + Math.random() * 0.01, z); d.m.rotation.y = Math.random() * 6; d.m.scale.setScalar(size);
}

// ---------- ondas de choque (pisão do Colosso / granada) ----------
const ringGeo = new THREE.RingGeometry(0.85, 1, 40); ringGeo.rotateX(-Math.PI / 2);
const rings = new RingPool(6, () => {
  const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xffd0a0, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
  m.visible = false; scene.add(m); return { m, life: 0, max: 0, r: 1 };
});
export function shockwave(x, z, r, color = 0xffd0a0) {
  const w = rings.next(); w.m.visible = true; w.life = w.max = 0.45; w.r = r;
  w.m.material.color.setHex(color); w.m.position.set(x, 0.08, z); w.m.scale.setScalar(0.3);
  burst(x, 0.2, z, 'dust', 26, 5);
}
// ---------- v5: avisos no chão (telegraph) — pisão (disco que enche) e investida (faixa) ----------
const tgEdgeGeo = new THREE.RingGeometry(0.93, 1, 48); tgEdgeGeo.rotateX(-Math.PI / 2);
const tgFillGeo = new THREE.CircleGeometry(1, 40); tgFillGeo.rotateX(-Math.PI / 2);
const tgMat = (c, o) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -3 });
const tgs = new RingPool(3, () => {
  const edge = new THREE.Mesh(tgEdgeGeo, tgMat(0xff5030, 0)), fill = new THREE.Mesh(tgFillGeo, tgMat(0xff3010, 0));
  edge.visible = fill.visible = false; edge.renderOrder = fill.renderOrder = 2; scene.add(edge, fill); return { edge, fill, life: 0, max: 1, r: 1 };
});
/** Aviso circular: a borda aparece já no raio final e o miolo enche até a hora do impacto. */
export function telegraph(x, z, r, dur, color = 0xff5030) {
  const t = tgs.next(); t.life = t.max = dur; t.r = r;
  t.edge.visible = t.fill.visible = true; t.edge.material.color.setHex(color);
  t.edge.position.set(x, 0.05, z); t.fill.position.set(x, 0.045, z); t.edge.scale.setScalar(r); t.fill.scale.setScalar(0.01);
}
const laneGeo = new THREE.PlaneGeometry(1, 1); laneGeo.rotateX(-Math.PI / 2); laneGeo.translate(0, 0, 0.5);
const lanes = new RingPool(3, () => { const m = new THREE.Mesh(laneGeo, tgMat(0xff6020, 0)); m.visible = false; m.renderOrder = 2; scene.add(m); return { m }; });
/** Faixa de investida: pegue um handle com laneHandle(), atualize com setLane() a cada quadro e esconda com hideLane(). */
export const laneHandle = () => lanes.next();
export function setLane(h, x, z, dx, dz, len, w, k) {
  h.m.visible = true; h.m.position.set(x, 0.05, z); h.m.rotation.y = Math.atan2(dx, dz);
  h.m.scale.set(w, 1, len * (0.35 + 0.65 * k)); h.m.material.opacity = 0.12 + 0.3 * k * (0.75 + 0.25 * Math.sin(k * 40));
}
export function hideLane(h) { if (h) h.m.visible = false; }
// ---------- clarão de explosão ----------
const flashes = new RingPool(4, () => {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW, color: 0xffa040, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
  s.visible = false; scene.add(s); return { s, life: 0 };
});
// ---------- fumaça (sprites macios que sobem e crescem) ----------
const smokes = new RingPool(18, () => {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW, color: 0x3a3632, transparent: true, opacity: 0, depthWrite: false }));
  s.visible = false; scene.add(s); return { s, life: 0, max: 1, vy: 0, g: 1 };
});
export function smoke(x, y, z, n = 6, size = 1.5) {
  for (let i = 0; i < n; i++) {
    const p = smokes.next(); p.s.visible = true; p.life = p.max = rand(1.2, 2.2); p.vy = rand(0.6, 1.4); p.g = size * rand(0.8, 1.3);
    p.s.position.set(x + rand(-0.6, 0.6), y + rand(0, 0.5), z + rand(-0.6, 0.6)); p.s.scale.setScalar(p.g);
  }
}
export function explosion(x, z, r) {
  const f = flashes.next(); f.s.visible = true; f.life = 0.35; f.s.position.set(x, 1.2, z); f.s.scale.setScalar(r * 2.6);
  flashAt(x, 1.4, z, 0xffa040, 220); smoke(x, 0.8, z, 8, r * 0.9);
  burst(x, 0.6, z, 'fire', 34, 6); burst(x, 0.4, z, 'spark', 18, 8); shockwave(x, z, r, 0xffa050);
  // v6: poeira levantada em anel e faíscas longas; no Médio/Alto, segunda coluna de fumaça e anel de poeira extra
  burst(x, 0.2, z, 'dust', 16, 4.5); burst(x, 0.9, z, 'spark', 10, 12);
  if (fxRich()) { smoke(x, 1.6, z, 5, r * 0.6); shockwave(x, z, r * 1.35, 0x8a7a60); burst(x, 0.15, z, 'dust', 14, 7); }
  decal(x, z, r * 0.8, 0x111111);
}

/** v6: floreio de crítico/abate — faíscas e um anel rápido no ponto do golpe (leve no Baixo). */
export function flourish(x, y, z, kill) {
  burst(x, y, z, 'spark', kill ? 10 : 6, kill ? 5 : 3.5);
  if (!fxRich()) return;
  if (kill) { shockwave(x, z, 1.8, 0xff5040); flashAt(x, y, z, 0xff6040, 30); }
  else flashAt(x, y, z, 0xffd060, 18);
}
/** v6: jorro de sangue de abate — mais forte, com um spray para cima no Médio/Alto. */
export function bloodBurst(x, y, z, heavy, dx = 0, dz = 0) {
  burst(x, y, z, 'blood', heavy ? 34 : 20, heavy ? 5 : 4.5, dx, dz);
  if (fxRich()) { burst(x, y + 0.3, z, 'blood', heavy ? 16 : 10, 6.5, dx * 0.4, dz * 0.4); decal(x + dx * 1.2, z + dz * 1.2, heavy ? 1.6 : 1.1); }
}

export function updateFx(dt) {
  tgs.forEach((t) => {
    if (!t.edge.visible) return;
    t.life -= dt; const k = 1 - Math.max(0, t.life) / t.max;
    t.fill.scale.setScalar(Math.max(0.01, t.r * k)); t.fill.material.opacity = 0.1 + 0.22 * k;
    t.edge.material.opacity = 0.45 + 0.4 * Math.abs(Math.sin(k * (8 + k * 14)));
    if (t.life <= 0) t.edge.visible = t.fill.visible = false;
  });
  rings.forEach((w) => {
    if (!w.m.visible) return;
    w.life -= dt; const k = 1 - w.life / w.max;
    w.m.scale.setScalar(0.3 + k * w.r); w.m.material.opacity = 0.85 * (1 - k);
    if (w.life <= 0) w.m.visible = false;
  });
  smokes.forEach((p) => {
    if (!p.s.visible) return;
    p.life -= dt; const k = 1 - p.life / p.max;
    p.s.position.y += p.vy * dt; p.s.scale.setScalar(p.g * (1 + k * 1.6));
    p.s.material.opacity = 0.5 * Math.sin(Math.PI * Math.min(1, k * 1.2));
    if (p.life <= 0) p.s.visible = false;
  });
  flashes.forEach((f) => {
    if (!f.s.visible) return;
    f.life -= dt; f.s.material.opacity = Math.max(0, f.life / 0.35);
    if (f.life <= 0) f.s.visible = false;
  });
  particles.forEach((p) => {
    if (!p.m.visible) return;
    p.life -= dt; if (p.life <= 0) { p.m.visible = false; return; }
    p.vy -= p.grav * dt;
    const pos = p.m.position; pos.x += p.vx * dt; pos.y += p.vy * dt; pos.z += p.vz * dt;
    if (pos.y < 0.04) { pos.y = 0.04; p.vx *= 0.6; p.vz *= 0.6; p.vy = 0; }
    if (p.shrink) { const k = Math.max(0.05, p.life / p.life0); if (p.spark) p.m.scale.set(p.s0 * 0.5 * k, p.s0 * 0.5 * k, p.s0 * 2.2 * k); else p.m.scale.setScalar(p.s0 * k); }
    if (p.spark) p.m.lookAt(pos.x + p.vx, pos.y + p.vy, pos.z + p.vz);
  });
  tracers.forEach((t) => {
    if (!t.m.visible) return;
    t.life -= dt; t.m.material.opacity = Math.max(0, t.life / 0.08);
    if (t.life <= 0) t.m.visible = false;
  });
  decals.forEach((d) => {
    if (!d.m.visible) return;
    d.life -= dt; if (d.life < 3) d.m.material.opacity = Math.max(0, 0.75 * d.life / 3);
    if (d.life <= 0) d.m.visible = false;
  });
}
export function clearFx() {
  particles.forEach((p) => { p.m.visible = false; });
  tracers.forEach((t) => { t.m.visible = false; });
  decals.forEach((d) => { d.m.visible = false; });
  rings.forEach((w) => { w.m.visible = false; });
  tgs.forEach((t) => { t.edge.visible = t.fill.visible = false; t.life = 0; });
  lanes.forEach((h) => { h.m.visible = false; });
  flashes.forEach((f) => { f.s.visible = false; });
  smokes.forEach((p) => { p.s.visible = false; });
}
