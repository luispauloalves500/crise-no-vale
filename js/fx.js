// fx.js — partículas (sangue/faíscas/poeira/ácido), traçantes e manchas no chão, tudo com pool.
import * as THREE from 'three';
import { scene, GLOW, flashAt } from './world.js';
import { FX, COLORS } from './config.js';
import { rand, RingPool, softSplatTex } from './utils.js';

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
  decal(x, z, r * 0.8, 0x111111);
}

export function updateFx(dt) {
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
  flashes.forEach((f) => { f.s.visible = false; });
  smokes.forEach((p) => { p.s.visible = false; });
}
