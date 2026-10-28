// fx.js — partículas (sangue/faíscas/poeira/ácido), traçantes e manchas no chão, tudo com pool.
import * as THREE from 'three';
import { scene } from './world.js';
import { FX, COLORS } from './config.js';
import { rand, RingPool, splatTex } from './utils.js';

const pGeo = new THREE.BoxGeometry(0.09, 0.09, 0.09);
const pMats = {
  blood: new THREE.MeshBasicMaterial({ color: COLORS.blood }),
  spark: new THREE.MeshBasicMaterial({ color: COLORS.spark }),
  spit: new THREE.MeshBasicMaterial({ color: COLORS.spit }),
  dust: new THREE.MeshBasicMaterial({ color: COLORS.dust }),
};

// ---------- partículas ----------
const particles = new RingPool(FX.MAX_PARTICLES, () => {
  const m = new THREE.Mesh(pGeo, pMats.blood); m.visible = false; m.frustumCulled = false; scene.add(m);
  return { m, vx: 0, vy: 0, vz: 0, life: 0, grav: 12 };
});
/** Explosão de partículas. kind: blood | spark | spit | dust */
export function burst(x, y, z, kind, n, sp, dirX = 0, dirZ = 0) {
  for (let i = 0; i < n; i++) {
    const p = particles.next();
    p.m.material = pMats[kind]; p.m.position.set(x, y, z); p.m.visible = true;
    const s = kind === 'dust' ? rand(1, 2.2) : rand(0.7, 1.4); p.m.scale.setScalar(s);
    p.vx = (rand(-1, 1) + dirX * 1.2) * sp; p.vy = rand(0.5, 1.6) * sp; p.vz = (rand(-1, 1) + dirZ * 1.2) * sp;
    p.grav = kind === 'dust' ? 3 : 12;
    p.life = rand(0.3, 0.7) * (kind === 'dust' ? 1.6 : 1);
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
const splat = splatTex();
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

export function updateFx(dt) {
  particles.forEach((p) => {
    if (!p.m.visible) return;
    p.life -= dt; if (p.life <= 0) { p.m.visible = false; return; }
    p.vy -= p.grav * dt;
    const pos = p.m.position; pos.x += p.vx * dt; pos.y += p.vy * dt; pos.z += p.vz * dt;
    if (pos.y < 0.04) { pos.y = 0.04; p.vx *= 0.6; p.vz *= 0.6; p.vy = 0; }
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
}
