// world.js — renderer, cena, luzes, neblina, terreno, ruínas, props, colisão e atmosfera.
import * as THREE from 'three';
import { WORLD, FX, CAMERA } from './config.js';
import { mulberry32, rand, clamp, noiseTex, glowTex } from './utils.js';
import { G } from './state.js';

const rng = mulberry32(WORLD.SEED);
export const BOUND = WORLD.BOUND;
export const GLOW = glowTex();

// ---------- renderer / cena / câmera ----------
export const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
renderer.domElement.id = 'game';
document.body.prepend(renderer.domElement);

export const scene = new THREE.Scene();
scene.background = new THREE.Color(WORLD.FOG_COLOR);
scene.fog = new THREE.FogExp2(WORLD.FOG_COLOR, WORLD.FOG_DENSITY);

export const camera = new THREE.PerspectiveCamera(CAMERA.FOV, innerWidth / innerHeight, 0.1, 200);
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  renderer.setSize(innerWidth, innerHeight);
});

// ---------- luzes (quantidade fixa — nunca adicionar/remover luzes em runtime) ----------
const hemi = new THREE.HemisphereLight(0x7a9a8a, 0x0a0f08, 1.25);
scene.add(hemi);
const moon = new THREE.DirectionalLight(0xa8bce0, 1.2);
moon.position.set(-20, 40, -12); moon.castShadow = true;
moon.shadow.mapSize.set(2048, 2048);
Object.assign(moon.shadow.camera, { left: -36, right: 36, top: 36, bottom: -36, near: 1, far: 100 });
moon.shadow.bias = -0.0008;
scene.add(moon);
const HEMI_BASE = hemi.intensity, MOON_BASE = moon.intensity;

// ---------- materiais ----------
const ground = new THREE.Mesh(new THREE.PlaneGeometry(110, 110),
  new THREE.MeshStandardMaterial({ map: noiseTex('#1d2a17', ['#2d3a1f', '#3a2f1e', '#14200f', '#41472a'], 900, 14), roughness: 1 }));
ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);

const concrete = new THREE.MeshStandardMaterial({ map: noiseTex('#5a5d57', ['#3e443a', '#6c6e66', '#2e4a2a', '#4a4f45'], 700, 1), roughness: 0.95 });
const crateMat = new THREE.MeshStandardMaterial({ map: noiseTex('#5a4326', ['#3b2a16', '#6e5332'], 300, 1), roughness: 0.9 });
const barkMat = new THREE.MeshStandardMaterial({ color: 0x3b2a1c, roughness: 1 });
const leafMats = [0x1f3d1c, 0x24481f, 0x173317, 0x2b4a22].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 1, flatShading: true }));
const rockMat = new THREE.MeshStandardMaterial({ color: 0x4a4d46, roughness: 1, flatShading: true });
const vineMat = new THREE.MeshStandardMaterial({ color: 0x23431d, roughness: 1, flatShading: true });
const stripeMat = new THREE.MeshStandardMaterial({ color: 0xc8a020, roughness: 0.8 });

// ---------- colisores ----------
/** @type {{minX:number,maxX:number,minZ:number,maxZ:number,h:number}[]} */
export const boxes = [];
/** @type {{x:number,z:number,r:number,h:number}[]} */
export const circles = [];

// geometrias compartilhadas (evita centenas de geometrias iguais)
const unitBox = new THREE.BoxGeometry(1, 1, 1);
function boxMesh(mat, w, h, d) { const m = new THREE.Mesh(unitBox, mat); m.scale.set(w, h, d); return m; }

function wall(x, z, w, d, h) {
  const m = boxMesh(concrete, w, h, d); m.position.set(x, h / 2, z);
  m.castShadow = m.receiveShadow = true; scene.add(m);
  boxes.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, h });
  // entulho
  for (let i = 0; i < 3; i++) {
    const s = 0.3 + rng() * 0.4; const r = boxMesh(concrete, s, s * 0.6, s);
    r.position.set(x + (rng() - 0.5) * w + (d > w ? (rng() - 0.5) * 2.4 : 0), s * 0.3, z + (rng() - 0.5) * d + (w > d ? (rng() - 0.5) * 2.4 : 0));
    r.rotation.y = rng() * 3; r.castShadow = true; scene.add(r);
  }
  // trepadeiras no topo de muros altos
  if (h > 2.3 && rng() < 0.7) {
    const v = boxMesh(vineMat, Math.max(w, 0.9) * 1.04, 0.5 + rng() * 0.7, Math.max(d, 0.9) * 1.04);
    v.position.set(x, h - 0.2, z); scene.add(v);
  }
}
function crate(x, z, s) {
  const m = boxMesh(crateMat, s, s, s); m.position.set(x, s / 2, z); m.castShadow = m.receiveShadow = true; scene.add(m);
  boxes.push({ minX: x - s / 2, maxX: x + s / 2, minZ: z - s / 2, maxZ: z + s / 2, h: s });
}
const trunkGeo = new THREE.CylinderGeometry(0.18, 0.32, 3.2, 6); trunkGeo.translate(0, 1.6, 0);
const coneGeo = new THREE.ConeGeometry(1, 1, 7);
function tree(x, z, collide, sc) {
  const g = new THREE.Group();
  const tr = new THREE.Mesh(trunkGeo, barkMat); tr.scale.setScalar(sc); tr.castShadow = true; g.add(tr);
  const h = 3.2 * sc;
  for (let i = 0; i < 3; i++) {
    const c = new THREE.Mesh(coneGeo, leafMats[(i + Math.floor(rng() * 4)) % 4]);
    c.scale.set((1.9 - i * 0.45) * sc, 1.9 * sc, (1.9 - i * 0.45) * sc);
    c.position.y = h * 0.6 + i * 1.05 * sc; c.rotation.y = rng() * 3; c.castShadow = true; g.add(c);
  }
  g.position.set(x, 0, z); scene.add(g);
  if (collide) circles.push({ x, z, r: 0.45 * sc, h: 6 });
}
const rockGeo = new THREE.DodecahedronGeometry(1, 0);
function rock(x, z, s) {
  const m = new THREE.Mesh(rockGeo, rockMat); m.scale.set(s, s * 0.7, s);
  m.position.set(x, s * 0.45, z); m.rotation.set(rng() * 3, rng() * 3, rng() * 3);
  m.castShadow = m.receiveShadow = true; scene.add(m); circles.push({ x, z, r: s * 0.9, h: s * 1.1 });
}

// ruínas da instalação
[[-8, -6, 8, 0.8, 3], [-12, -2, 0.8, 8, 2.4], [6, 8, 0.8, 7, 3], [10, 4.8, 7, 0.8, 1.6], [14, -10, 6, 0.8, 2.8], [-15, 12, 7, 0.8, 2],
  [-3, 16, 0.8, 5, 3.2], [18, 14, 0.8, 6, 2], [-20, -15, 6, 0.8, 2.6], [4, -16, 8, 0.8, 2.2], [20, -2, 0.8, 6, 2.4], [-21, 3, 5, 0.8, 1.8],
].forEach((a) => wall(...a));
[[-5, 5], [5, -5], [12, -2], [-10, 8], [16, 6], [-16, -8]].forEach((p) => wall(p[0], p[1], 1, 1, 4.2));
[[-7, -4.8, 1.2], [-6, -4.6, 1], [8, 10, 1.2], [13, -8.8, 1.1], [-14, 13.2, 1.2], [2, -14.8, 1]].forEach((c) => crate(...c));

// faixas de alerta amarelas no chão (marcam o heliponto central — área segura inicial)
{
  const ring = new THREE.Mesh(new THREE.RingGeometry(3.2, 3.5, 40), stripeMat);
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.02; ring.receiveShadow = true; scene.add(ring);
  const h1 = boxMesh(stripeMat, 0.3, 0.02, 2.2); h1.position.set(-0.7, 0.02, 0); scene.add(h1);
  const h2 = boxMesh(stripeMat, 0.3, 0.02, 2.2); h2.position.set(0.7, 0.02, 0); scene.add(h2);
  const h3 = boxMesh(stripeMat, 1.4, 0.02, 0.3); h3.position.set(0, 0.02, 0); scene.add(h3);
}

/** Ponto livre de obstáculos (usado para árvores, pickups e spawns). */
export function freeSpot(x, z, r, avoidCenter = true) {
  if (avoidCenter && Math.hypot(x, z) < 5) return false;
  for (const b of boxes) if (x > b.minX - r - 1 && x < b.maxX + r + 1 && z > b.minZ - r - 1 && z < b.maxZ + r + 1) return false;
  for (const c of circles) if (Math.hypot(x - c.x, z - c.z) < c.r + r + 1.2) return false;
  return Math.abs(x) < BOUND - r && Math.abs(z) < BOUND - r;
}
for (let i = 0, n = 0; i < 400 && n < 32; i++) { const x = (rng() * 2 - 1) * 26, z = (rng() * 2 - 1) * 26; if (freeSpot(x, z, 0.6)) { tree(x, z, true, 0.8 + rng() * 0.6); n++; } }
for (let i = 0, n = 0; i < 300 && n < 16; i++) { const x = (rng() * 2 - 1) * 26, z = (rng() * 2 - 1) * 26; if (freeSpot(x, z, 1)) { rock(x, z, 0.5 + rng() * 0.8); n++; } }
for (let i = 0; i < 110; i++) { const a = rng() * Math.PI * 2, d = 31 + rng() * 14; tree(Math.cos(a) * d, Math.sin(a) * d, false, 1 + rng() * 0.8); }

// tufos de grama (instanciados)
{
  const geo = new THREE.ConeGeometry(0.12, 0.6, 4); geo.translate(0, 0.3, 0);
  const N = 900;
  const inst = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ color: 0x2f5524, roughness: 1 }), N);
  const d = new THREE.Object3D();
  for (let i = 0; i < N; i++) {
    d.position.set((rng() * 2 - 1) * 34, 0, (rng() * 2 - 1) * 34);
    d.rotation.set(rng() * 0.4, rng() * 3, rng() * 0.4); d.scale.setScalar(0.6 + rng()); d.updateMatrix(); inst.setMatrixAt(i, d.matrix);
  }
  scene.add(inst);
}

// ---------- postes com luz (piscam) ----------
const lamps = [];
const postGeo = new THREE.CylinderGeometry(0.06, 0.08, 3, 6), bulbGeo = new THREE.SphereGeometry(0.14, 8, 6);
const postMat = new THREE.MeshStandardMaterial({ color: 0x222222 });
[[-8, -4.6, 0xff8a40], [6, 6.2, 0xffa050], [14, -8.6, 0xff8a40], [-15, 10.6, 0xffb060], [-12, -7, 0xff2020]].forEach(([x, z, c], i) => {
  const post = new THREE.Mesh(postGeo, postMat); post.position.set(x, 1.5, z); scene.add(post);
  const bulb = new THREE.Mesh(bulbGeo, new THREE.MeshBasicMaterial({ color: c })); bulb.position.set(x, 3, z); scene.add(bulb);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW, color: c, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.7 }));
  halo.scale.setScalar(1.8); halo.position.copy(bulb.position); scene.add(halo);
  const l = new THREE.PointLight(c, 1, 16, 2); l.position.set(x, 2.9, z); scene.add(l);
  const base = i === 4 ? 30 : 22;
  lamps.push({ l, halo, base, red: i === 4, t: rng() * 10 });
});

// ---------- vaga-lumes ----------
const ffGeo = new THREE.BufferGeometry(); const FF = FX.FIREFLIES; const ffPos = new Float32Array(FF * 3); const ffSeed = [];
for (let i = 0; i < FF; i++) { ffPos[i * 3] = (rng() * 2 - 1) * 30; ffPos[i * 3 + 1] = 0.5 + rng() * 3; ffPos[i * 3 + 2] = (rng() * 2 - 1) * 30; ffSeed.push(rng() * 10); }
ffGeo.setAttribute('position', new THREE.BufferAttribute(ffPos, 3));
const fireflies = new THREE.Points(ffGeo, new THREE.PointsMaterial({ color: 0xc8ff70, size: 0.12, map: GLOW, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
scene.add(fireflies);

// ---------- chuva (segmentos de linha reaproveitados em torno da câmera) ----------
const RN = FX.RAIN;
const rainPos = new Float32Array(RN * 6);
const rainGeo = new THREE.BufferGeometry(); rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
const rainVel = new Float32Array(RN);
for (let i = 0; i < RN; i++) {
  const x = (Math.random() * 2 - 1) * 22, y = Math.random() * 14, z = (Math.random() * 2 - 1) * 22;
  rainPos.set([x, y, z, x + 0.05, y + 0.45, z + 0.02], i * 6); rainVel[i] = 16 + Math.random() * 8;
}
const rain = new THREE.LineSegments(rainGeo, new THREE.LineBasicMaterial({ color: 0x8fa8b8, transparent: true, opacity: 0.32, depthWrite: false }));
rain.frustumCulled = false;
scene.add(rain);

// ---------- atmosfera: relâmpagos ----------
export const atmo = { lightning: 0, nextBolt: rand(8, 16), onThunder: null };

/** Anima luzes, vaga-lumes, chuva e relâmpagos. */
export function updateWorld(dt) {
  for (const L of lamps) {
    L.t += dt; let i = L.base * (0.8 + Math.random() * 0.2);
    if (L.red) i = L.base * (0.5 + 0.5 * Math.sin(L.t * 4)); else if (Math.sin(L.t * 1.7) > 0.97) i = Math.random() < 0.5 ? 0 : i;
    L.l.intensity = i; L.halo.material.opacity = 0.7 * i / L.base;
  }
  const fp = ffGeo.attributes.position.array, t = G.time;
  for (let i = 0; i < FF; i++) { fp[i * 3 + 1] += Math.sin(t * 1.3 + ffSeed[i]) * dt * 0.3; fp[i * 3] += Math.cos(t * 0.7 + ffSeed[i]) * dt * 0.2; }
  ffGeo.attributes.position.needsUpdate = true;
  fireflies.material.opacity = 0.6 + 0.4 * Math.sin(t * 3);

  // chuva segue a câmera (cobre só a área visível — barato)
  const cx = camera.position.x, cz = camera.position.z;
  for (let i = 0; i < RN; i++) {
    const o = i * 6; let y = rainPos[o + 1] - rainVel[i] * dt;
    let x = rainPos[o], z = rainPos[o + 2];
    if (y < 0 || Math.abs(x - cx) > 22 || Math.abs(z - cz) > 22) {
      y = 10 + Math.random() * 4; x = cx + (Math.random() * 2 - 1) * 22; z = cz + (Math.random() * 2 - 1) * 22;
    }
    rainPos[o] = x; rainPos[o + 1] = y; rainPos[o + 2] = z;
    rainPos[o + 3] = x + 0.05; rainPos[o + 4] = y + 0.45; rainPos[o + 5] = z + 0.02;
  }
  rainGeo.attributes.position.needsUpdate = true;

  // relâmpago: pico de luz + trovão atrasado
  atmo.nextBolt -= dt;
  if (atmo.nextBolt <= 0) {
    atmo.nextBolt = rand(12, 26); atmo.lightning = 1;
    if (atmo.onThunder) atmo.onThunder(rand(0.4, 1.6));
  }
  if (atmo.lightning > 0) atmo.lightning = Math.max(0, atmo.lightning - dt * 3.2);
  const flick = atmo.lightning > 0 ? atmo.lightning * (0.6 + 0.4 * Math.sin(atmo.lightning * 40)) : 0;
  hemi.intensity = HEMI_BASE + flick * 4;
  moon.intensity = MOON_BASE + flick * 3;
}

// ---------- colisão 2D (XZ) ----------
/** Empurra p para fora de obstáculos; retorna true se colidiu. */
export function resolve(p, r) {
  let hit = false;
  for (const c of circles) {
    const dx = p.x - c.x, dz = p.z - c.z, d = Math.hypot(dx, dz), m = r + c.r;
    if (d < m && d > 1e-4) { p.x = c.x + dx / d * m; p.z = c.z + dz / d * m; hit = true; }
  }
  for (const b of boxes) {
    const cx = clamp(p.x, b.minX, b.maxX), cz = clamp(p.z, b.minZ, b.maxZ);
    const dx = p.x - cx, dz = p.z - cz, d = Math.hypot(dx, dz);
    if (d < r) {
      hit = true;
      if (d > 1e-4) { p.x = cx + dx / d * r; p.z = cz + dz / d * r; }
      else {
        const l = p.x - b.minX, ri = b.maxX - p.x, t = p.z - b.minZ, bo = b.maxZ - p.z, m = Math.min(l, ri, t, bo);
        if (m === l) p.x = b.minX - r; else if (m === ri) p.x = b.maxX + r; else if (m === t) p.z = b.minZ - r; else p.z = b.maxZ + r;
      }
    }
  }
  if (Math.abs(p.x) > BOUND) { p.x = Math.sign(p.x) * BOUND; hit = true; }
  if (Math.abs(p.z) > BOUND) { p.z = Math.sign(p.z) * BOUND; hit = true; }
  return hit;
}

export function rayCircle(ox, oz, dx, dz, cx, cz, r) {
  const fx = ox - cx, fz = oz - cz, b = fx * dx + fz * dz, c = fx * fx + fz * fz - r * r;
  if (c < 0) return 0;
  const disc = b * b - c; if (disc < 0) return Infinity;
  const t = -b - Math.sqrt(disc); return t >= 0 ? t : Infinity;
}
export function rayBox(ox, oz, dx, dz, b) {
  let t0 = -Infinity, t1 = Infinity;
  if (Math.abs(dx) < 1e-9) { if (ox < b.minX || ox > b.maxX) return Infinity; }
  else { let a = (b.minX - ox) / dx, c = (b.maxX - ox) / dx; if (a > c) [a, c] = [c, a]; t0 = Math.max(t0, a); t1 = Math.min(t1, c); }
  if (Math.abs(dz) < 1e-9) { if (oz < b.minZ || oz > b.maxZ) return Infinity; }
  else { let a = (b.minZ - oz) / dz, c = (b.maxZ - oz) / dz; if (a > c) [a, c] = [c, a]; t0 = Math.max(t0, a); t1 = Math.min(t1, c); }
  if (t1 < t0 || t1 < 0) return Infinity;
  return Math.max(t0, 0);
}
/** Distância até o primeiro obstáculo do cenário ao longo do raio (ou max).
 *  minH ignora obstáculos mais baixos que essa altura (ex.: tiros passam por cima de caixas/pedras). */
export function castWorld(ox, oz, dx, dz, max, minH = 0) {
  let best = max;
  for (const b of boxes) { if (b.h < minH) continue; const t = rayBox(ox, oz, dx, dz, b); if (t < best) best = t; }
  for (const c of circles) { if (c.h < minH) continue; const t = rayCircle(ox, oz, dx, dz, c.x, c.z, c.r); if (t < best) best = t; }
  return best;
}
