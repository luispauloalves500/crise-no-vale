// world.js — renderer, cena, luzes fixas, clima (chuva/neblina/relâmpagos), colisão 2D
// e o "kit" de construção que areas.js usa para montar cada área.
import * as THREE from 'three';
import { FX, CAMERA } from './config.js';
import { rand, clamp, noiseTex, glowTex } from './utils.js';
import { G } from './state.js';

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
scene.background = new THREE.Color(0x0b1611);
scene.fog = new THREE.FogExp2(0x0b1611, 0.03);

export const camera = new THREE.PerspectiveCamera(CAMERA.FOV, innerWidth / innerHeight, 0.1, 200);
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  renderer.setSize(innerWidth, innerHeight);
});

// ---------- luzes (quantidade FIXA — trocar de área só reposiciona/recolore; evita recompilar shaders) ----------
const hemi = new THREE.HemisphereLight(0x7a9a8a, 0x0a0f08, 1.25);
scene.add(hemi);
const moon = new THREE.DirectionalLight(0xa8bce0, 1.2);
moon.position.set(-20, 40, -12); moon.castShadow = true;
moon.shadow.mapSize.set(2048, 2048);
Object.assign(moon.shadow.camera, { left: -38, right: 38, top: 38, bottom: -38, near: 1, far: 110 });
moon.shadow.bias = -0.0008;
scene.add(moon);
const LAMP_POOL = 6;
const lampLights = [];
for (let i = 0; i < LAMP_POOL; i++) { const l = new THREE.PointLight(0xff8a40, 0, 16, 2); l.position.set(0, -50, 0); scene.add(l); lampLights.push(l); }

// ---------- colisores da área atual ----------
/** @type {{minX:number,maxX:number,minZ:number,maxZ:number,h:number}[]} */
export const boxes = [];
/** @type {{x:number,z:number,r:number,h:number}[]} */
export const circles = [];
/** Limites retangulares da área atual (mutável). */
export const bounds = { minX: -25, maxX: 25, minZ: -25, maxZ: 25 };
/** Poças/lama da área atual (desaceleram). */
export const water = [];

// ---------- materiais compartilhados ----------
export const MATS = {
  concrete: new THREE.MeshStandardMaterial({ map: noiseTex('#5a5d57', ['#3e443a', '#6c6e66', '#2e4a2a', '#4a4f45'], 700, 1), roughness: 0.95 }),
  stone: new THREE.MeshStandardMaterial({ map: noiseTex('#6a6250', ['#4a4434', '#7c7260', '#3a4a2a'], 700, 1), roughness: 1 }),
  metal: new THREE.MeshStandardMaterial({ map: noiseTex('#4a5258', ['#30383e', '#5c646a', '#6a4a30'], 500, 1), roughness: 0.6, metalness: 0.5 }),
  rust: new THREE.MeshStandardMaterial({ map: noiseTex('#6a3a22', ['#4a2a18', '#8a5030', '#3a3a3a'], 500, 1), roughness: 0.85, metalness: 0.3 }),
  crate: new THREE.MeshStandardMaterial({ map: noiseTex('#5a4326', ['#3b2a16', '#6e5332'], 300, 1), roughness: 0.9 }),
  plank: new THREE.MeshStandardMaterial({ map: noiseTex('#4a3620', ['#2e2214', '#5e4630', '#3a2a18'], 600, 3), roughness: 0.95 }),
  bark: new THREE.MeshStandardMaterial({ color: 0x3b2a1c, roughness: 1 }),
  rock: new THREE.MeshStandardMaterial({ color: 0x4a4d46, roughness: 1, flatShading: true }),
  vine: new THREE.MeshStandardMaterial({ color: 0x23431d, roughness: 1, flatShading: true }),
  stripe: new THREE.MeshStandardMaterial({ color: 0xc8a020, roughness: 0.8 }),
  dark: new THREE.MeshStandardMaterial({ color: 0x151816, roughness: 0.9 }),
  post: new THREE.MeshStandardMaterial({ color: 0x222222 }),
  window: new THREE.MeshBasicMaterial({ color: 0x6a8a70 }),
  windowDark: new THREE.MeshBasicMaterial({ color: 0x0d1410 }),
  water: new THREE.MeshStandardMaterial({ color: 0x0c1a1c, roughness: 0.08, metalness: 0.6, transparent: true, opacity: 0.88 }),
  mud: new THREE.MeshStandardMaterial({ color: 0x1e2414, roughness: 0.25, metalness: 0.3, transparent: true, opacity: 0.92 }),
};
export const leafMats = [0x1f3d1c, 0x24481f, 0x173317, 0x2b4a22].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 1, flatShading: true }));
export const groundTex = {
  jungle: () => noiseTex('#1d2a17', ['#2d3a1f', '#3a2f1e', '#14200f', '#41472a'], 900, 14),
  mud: () => noiseTex('#1a1f12', ['#262c18', '#2e2616', '#10160c', '#343a20'], 900, 14),
  paving: () => noiseTex('#3a3c36', ['#2a2c28', '#4a4c44', '#2a3a24', '#55574f'], 900, 10),
  sand: () => noiseTex('#3a3426', ['#2e2a1e', '#4a4232', '#262418'], 900, 12),
  stone: () => noiseTex('#2e2c24', ['#3e3a2e', '#24221c', '#2a3a22'], 900, 8),
};

const unitBox = new THREE.BoxGeometry(1, 1, 1);
export function boxMesh(mat, w, h, d) { const m = new THREE.Mesh(unitBox, mat); m.scale.set(w, h, d); return m; }

// ---------- kit de construção (ctx = { group, boxes, circles, lamps, water, rng }) ----------
export function makeCtx(rng) { const group = new THREE.Group(); group.visible = false; scene.add(group); return { group, boxes: [], circles: [], lamps: [], water: [], rng }; }

/** Paralelepípedo sólido (colide e bloqueia tiros se h alto). */
export function solid(ctx, x, z, w, d, h, mat = MATS.concrete, y = 0, collide = true) {
  const m = boxMesh(mat, w, h, d); m.position.set(x, y + h / 2, z); m.castShadow = m.receiveShadow = true; ctx.group.add(m);
  if (collide) ctx.boxes.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, h: y + h });
  return m;
}
/** Muro de ruína com entulho e trepadeira. */
export function wall(ctx, x, z, w, d, h, mat = MATS.concrete) {
  const rng = ctx.rng; solid(ctx, x, z, w, d, h, mat);
  for (let i = 0; i < 3; i++) {
    const s = 0.3 + rng() * 0.4; const r = boxMesh(mat, s, s * 0.6, s);
    r.position.set(x + (rng() - 0.5) * w + (d > w ? (rng() - 0.5) * 2.4 : 0), s * 0.3, z + (rng() - 0.5) * d + (w > d ? (rng() - 0.5) * 2.4 : 0));
    r.rotation.y = rng() * 3; r.castShadow = true; ctx.group.add(r);
  }
  if (h > 2.3 && rng() < 0.7) { const v = boxMesh(MATS.vine, Math.max(w, 0.9) * 1.04, 0.5 + rng() * 0.7, Math.max(d, 0.9) * 1.04); v.position.set(x, h - 0.2, z); ctx.group.add(v); }
}
export function crate(ctx, x, z, s, mat = MATS.crate) { return solid(ctx, x, z, s, s, s, mat); }
const trunkGeo = new THREE.CylinderGeometry(0.18, 0.32, 3.2, 6); trunkGeo.translate(0, 1.6, 0);
const coneGeo = new THREE.ConeGeometry(1, 1, 7);
export function tree(ctx, x, z, collide, sc, palm = false) {
  const rng = ctx.rng, g = new THREE.Group();
  const tr = new THREE.Mesh(trunkGeo, MATS.bark); tr.scale.set(sc, sc * (palm ? 1.5 : 1), sc); tr.castShadow = true; g.add(tr);
  const h = 3.2 * sc * (palm ? 1.5 : 1);
  if (palm) {
    for (let i = 0; i < 6; i++) { const f = boxMesh(leafMats[i % 4], 0.5 * sc, 0.06, 2.4 * sc); f.position.set(0, h, 0); f.rotation.set(0.5, i * 1.05, 0); f.translateZ(1.1 * sc); f.castShadow = true; g.add(f); }
  } else for (let i = 0; i < 3; i++) {
    const c = new THREE.Mesh(coneGeo, leafMats[(i + Math.floor(rng() * 4)) % 4]);
    c.scale.set((1.9 - i * 0.45) * sc, 1.9 * sc, (1.9 - i * 0.45) * sc);
    c.position.y = h * 0.6 + i * 1.05 * sc; c.rotation.y = rng() * 3; c.castShadow = true; g.add(c);
  }
  g.position.set(x, 0, z); ctx.group.add(g);
  if (collide) ctx.circles.push({ x, z, r: 0.45 * sc, h: 6 });
}
const rockGeo = new THREE.DodecahedronGeometry(1, 0);
export function rock(ctx, x, z, s, collide = true) {
  const rng = ctx.rng, m = new THREE.Mesh(rockGeo, MATS.rock); m.scale.set(s, s * 0.7, s);
  m.position.set(x, s * 0.45, z); m.rotation.set(rng() * 3, rng() * 3, rng() * 3);
  m.castShadow = m.receiveShadow = true; ctx.group.add(m); if (collide) ctx.circles.push({ x, z, r: s * 0.9, h: s * 1.1 });
}
export function ground(ctx, b, tex, extra = 30) {
  const w = b.maxX - b.minX + extra * 2, d = b.maxZ - b.minZ + extra * 2;
  const t = tex(); t.repeat.set(w / 8, d / 8);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshStandardMaterial({ map: t, roughness: 1 }));
  m.rotation.x = -Math.PI / 2; m.position.set((b.minX + b.maxX) / 2, 0, (b.minZ + b.maxZ) / 2); m.receiveShadow = true; ctx.group.add(m);
}
export function grass(ctx, b, n, color = 0x2f5524) {
  const rng = ctx.rng, geo = new THREE.ConeGeometry(0.12, 0.6, 4); geo.translate(0, 0.3, 0);
  const inst = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ color, roughness: 1 }), n), d = new THREE.Object3D();
  for (let i = 0; i < n; i++) {
    d.position.set(b.minX - 4 + rng() * (b.maxX - b.minX + 8), 0, b.minZ - 4 + rng() * (b.maxZ - b.minZ + 8));
    d.rotation.set(rng() * 0.4, rng() * 3, rng() * 0.4); d.scale.setScalar(0.6 + rng()); d.updateMatrix(); inst.setMatrixAt(i, d.matrix);
  }
  ctx.group.add(inst);
}
/** Anel de árvores fora dos limites (selva fechada ao redor). */
export function treeRing(ctx, b, n, margin = 3, depth = 12, palm = false) {
  const rng = ctx.rng;
  for (let i = 0; i < n; i++) {
    const side = Math.floor(rng() * 4), off = margin + rng() * depth;
    const x = side < 2 ? b.minX + rng() * (b.maxX - b.minX) : side === 2 ? b.minX - off : b.maxX + off;
    const z = side >= 2 ? b.minZ + rng() * (b.maxZ - b.minZ) : side === 0 ? b.minZ - off : b.maxZ + off;
    tree(ctx, x, z, false, 1 + rng() * 0.9, palm && rng() < 0.5);
  }
}
/** Bordas sólidas visuais (muros altos ao redor), com vãos nas portas. gaps: [{side,at,half}] */
export function perimeter(ctx, b, h, mat, gaps = [], thick = 1) {
  const sides = { N: [b.minX, b.maxX, b.minZ], S: [b.minX, b.maxX, b.maxZ], W: [b.minZ, b.maxZ, b.minX], E: [b.minZ, b.maxZ, b.maxX] };
  for (const [side, [a0, a1, fixed]] of Object.entries(sides)) {
    const gs = gaps.filter((g) => g.side === side).sort((p, q) => p.at - q.at);
    let cur = a0 - thick;
    const segs = [];
    for (const g of gs) { segs.push([cur, g.at - g.half]); cur = g.at + g.half; }
    segs.push([cur, a1 + thick]);
    for (const [s0, s1] of segs) {
      if (s1 - s0 < 0.2) continue; const mid = (s0 + s1) / 2, len = s1 - s0;
      const off = side === 'N' || side === 'W' ? -thick / 2 : thick / 2;
      if (side === 'N' || side === 'S') solid(ctx, mid, fixed + off, len, thick, h, mat, 0, false);
      else solid(ctx, fixed + off, mid, thick, len, h, mat, 0, false);
    }
  }
}
export function pool(ctx, x, z, w, d, mat = MATS.water) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat); m.rotation.x = -Math.PI / 2; m.position.set(x, 0.03, z); m.receiveShadow = true; ctx.group.add(m);
  ctx.water.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
}
const postGeo = new THREE.CylinderGeometry(0.06, 0.08, 3, 6), bulbGeo = new THREE.SphereGeometry(0.14, 8, 6);
/** Poste com luz. mode: flicker | pulse (alarme) | steady. Máx. 6 por área. */
export function lamp(ctx, x, z, color, mode = 'flicker', base = 22, h = 3) {
  const post = new THREE.Mesh(postGeo, MATS.post); post.scale.y = h / 3; post.position.set(x, h / 2, z); ctx.group.add(post);
  const bulb = new THREE.Mesh(bulbGeo, new THREE.MeshBasicMaterial({ color })); bulb.position.set(x, h, z); ctx.group.add(bulb);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW, color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.7 }));
  halo.scale.setScalar(1.8); halo.position.copy(bulb.position); ctx.group.add(halo);
  const L = { x, y: h - 0.1, z, color, mode, base, halo, t: ctx.rng() * 10, on: true };
  ctx.lamps.push(L); return L;
}
/** Prédio simples com janelas (fachada). */
export function building(ctx, x, z, w, d, h, mat = MATS.concrete, lit = 0.3) {
  solid(ctx, x, z, w, d, h, mat);
  const rng = ctx.rng;
  for (let fy = 1.6; fy < h - 0.8; fy += 2.2) for (let fx = -w / 2 + 1.2; fx < w / 2 - 0.8; fx += 2) {
    for (const s of [-1, 1]) {
      const win = boxMesh(rng() < lit ? MATS.window : MATS.windowDark, 0.9, 1.1, 0.05);
      win.position.set(x + fx + 0.45, fy, z + s * (d / 2 + 0.03)); ctx.group.add(win);
    }
  }
}
/** Portal/portão de passagem. Retorna { gate, light } para abrir/fechar e indicar estado. */
export function doorway(ctx, side, at, b, label = 'gate') {
  const g = new THREE.Group(); const span = 4.6, hgt = 3.6;
  const isNS = side === 'N' || side === 'S';
  const edge = side === 'N' ? b.minZ : side === 'S' ? b.maxZ : side === 'W' ? b.minX : b.maxX;
  if (isNS) g.position.set(at, 0, edge); else { g.position.set(edge, 0, at); g.rotation.y = Math.PI / 2; }
  const pL = boxMesh(MATS.metal, 0.45, hgt, 0.45); pL.position.set(-span / 2, hgt / 2, 0); pL.castShadow = true;
  const pR = pL.clone(); pR.position.x = span / 2; const top = boxMesh(MATS.metal, span + 0.45, 0.45, 0.45); top.position.y = hgt;
  const stripe = boxMesh(MATS.stripe, span, 0.12, 0.5); stripe.position.y = hgt - 0.35;
  g.add(pL, pR, top, stripe);
  // folha do portão (grade) — desce no chão quando abre
  const gate = new THREE.Group(); gate.position.y = 0;
  for (let i = -5; i <= 5; i++) { const bar = boxMesh(MATS.rust, 0.08, hgt - 0.3, 0.08); bar.position.set(i * 0.4, (hgt - 0.3) / 2, 0); gate.add(bar); }
  for (const y of [0.4, 1.6, 2.9]) { const bar = boxMesh(MATS.rust, span - 0.2, 0.1, 0.1); bar.position.y = y; gate.add(bar); }
  g.add(gate);
  const lightMat = new THREE.SpriteMaterial({ map: GLOW, color: 0xff3030, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
  const light = new THREE.Sprite(lightMat); light.scale.setScalar(0.9); light.position.set(span / 2 + 0.1, hgt - 0.6, side === 'N' || side === 'W' ? 0.35 : -0.35); g.add(light);
  ctx.group.add(g);
  return { group: g, gate, light, label };
}
/** Terminal de computador (salvar / controle). Retorna o material da tela para piscar. */
export function terminal(ctx, x, z, yaw, color = 0x40ff90) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = yaw;
  const base = boxMesh(MATS.metal, 0.9, 1.1, 0.6); base.position.y = 0.55; base.castShadow = true; g.add(base);
  const head = boxMesh(MATS.dark, 0.9, 0.7, 0.5); head.position.set(0, 1.45, -0.05); head.rotation.x = -0.25; g.add(head);
  const screenMat = new THREE.MeshBasicMaterial({ color });
  const scr = boxMesh(screenMat, 0.72, 0.5, 0.02); scr.position.set(0, 1.47, 0.2); scr.rotation.x = -0.25; g.add(scr);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW, color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.6 }));
  glow.scale.setScalar(2.2); glow.position.set(0, 1.5, 0.4); g.add(glow);
  ctx.group.add(g); ctx.boxes.push({ minX: x - 0.55, maxX: x + 0.55, minZ: z - 0.55, maxZ: z + 0.55, h: 1.2 });
  return { group: g, screenMat, glow };
}
/** Marcação de heliponto (anel + H). */
export function helipadMark(ctx, x, z, r = 3.4) {
  const ring = new THREE.Mesh(new THREE.RingGeometry(r, r + 0.3, 40), MATS.stripe); ring.rotation.x = -Math.PI / 2; ring.position.set(x, 0.025, z); ctx.group.add(ring);
  [[-0.7, 0, 0.3, 2.2], [0.7, 0, 0.3, 2.2], [0, 0, 1.4, 0.3]].forEach(([dx, dz, w, d]) => { const m = boxMesh(MATS.stripe, w, 0.02, d); m.position.set(x + dx, 0.03, z + dz); ctx.group.add(m); });
}

// ---------- vaga-lumes / chuva (globais, ligados por clima) ----------
const ffGeo = new THREE.BufferGeometry(); const FF = FX.FIREFLIES; const ffPos = new Float32Array(FF * 3); const ffSeed = [];
for (let i = 0; i < FF; i++) { ffPos[i * 3] = (Math.random() * 2 - 1) * 26; ffPos[i * 3 + 1] = 0.5 + Math.random() * 3; ffPos[i * 3 + 2] = (Math.random() * 2 - 1) * 26; ffSeed.push(Math.random() * 10); }
ffGeo.setAttribute('position', new THREE.BufferAttribute(ffPos, 3));
const fireflies = new THREE.Points(ffGeo, new THREE.PointsMaterial({ color: 0xc8ff70, size: 0.12, map: GLOW, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
scene.add(fireflies);

const RN = FX.RAIN;
const rainPos = new Float32Array(RN * 6);
const rainGeo = new THREE.BufferGeometry(); rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
const rainVel = new Float32Array(RN);
for (let i = 0; i < RN; i++) {
  const x = (Math.random() * 2 - 1) * 22, y = Math.random() * 14, z = (Math.random() * 2 - 1) * 22;
  rainPos.set([x, y, z, x + 0.05, y + 0.45, z + 0.02], i * 6); rainVel[i] = 16 + Math.random() * 8;
}
const rainMat = new THREE.LineBasicMaterial({ color: 0x8fa8b8, transparent: true, opacity: 0.32, depthWrite: false });
const rain = new THREE.LineSegments(rainGeo, rainMat); rain.frustumCulled = false; scene.add(rain);

// ---------- clima / área atual ----------
export const atmo = { lightning: 0, nextBolt: rand(8, 16), onThunder: null, mood: null };
let curLamps = [];
let HEMI_BASE = 1.25, MOON_BASE = 1.2;

/**
 * Ativa a área: mostra o grupo, troca colisores, limites, luzes e clima.
 * @param {{ctx:object, bounds:object, mood:object}} area
 */
export function activateArea(area, prev) {
  if (prev) prev.ctx.group.visible = false;
  area.ctx.group.visible = true;
  boxes.length = 0; boxes.push(...area.ctx.boxes);
  circles.length = 0; circles.push(...area.ctx.circles);
  water.length = 0; water.push(...area.ctx.water);
  Object.assign(bounds, area.bounds);
  const M = area.mood; atmo.mood = M;
  scene.background.setHex(M.fog); scene.fog.color.setHex(M.fog); scene.fog.density = M.density;
  hemi.color.setHex(M.sky); hemi.groundColor.setHex(M.groundCol); HEMI_BASE = hemi.intensity = M.hemi;
  moon.color.setHex(M.moonCol); MOON_BASE = moon.intensity = M.moon;
  if (M.moonPos) moon.position.set(...M.moonPos); else moon.position.set(-20, 40, -12);
  renderer.toneMappingExposure = M.exposure ?? 1.15;
  rain.visible = M.rain > 0; rainMat.opacity = 0.32 * (M.rain || 0);
  fireflies.visible = !!M.fireflies; fireflies.material.color.setHex(M.fireflyCol ?? 0xc8ff70);
  curLamps = area.ctx.lamps;
  lampLights.forEach((l, i) => {
    const L = curLamps[i];
    if (L) { l.color.setHex(L.color); l.position.set(L.x, L.y, L.z); l.distance = L.dist || 16; }
    else { l.intensity = 0; l.position.set(0, -50, 0); }
  });
  atmo.lightning = 0; atmo.nextBolt = rand(6, 14);
}

/** Anima luzes, vaga-lumes, chuva e relâmpagos da área atual. */
export function updateWorld(dt) {
  curLamps.forEach((L, i) => {
    const l = lampLights[i]; if (!l) return;
    L.t += dt; let k = 0.8 + Math.random() * 0.2;
    if (!L.on) k = 0;
    else if (L.mode === 'pulse') k = 0.5 + 0.5 * Math.sin(L.t * 4);
    else if (L.mode === 'steady') k = 1;
    else if (Math.sin(L.t * 1.7) > 0.97) k = Math.random() < 0.5 ? 0 : k;
    l.intensity = L.base * k; L.halo.material.opacity = 0.7 * k;
  });
  if (fireflies.visible) {
    const fp = ffGeo.attributes.position.array, t = G.time;
    for (let i = 0; i < FF; i++) { fp[i * 3 + 1] += Math.sin(t * 1.3 + ffSeed[i]) * dt * 0.3; fp[i * 3] += Math.cos(t * 0.7 + ffSeed[i]) * dt * 0.2; }
    ffGeo.attributes.position.needsUpdate = true;
    fireflies.material.opacity = 0.6 + 0.4 * Math.sin(t * 3);
  }
  if (rain.visible) {
    const cx = camera.position.x, cz = camera.position.z;
    for (let i = 0; i < RN; i++) {
      const o = i * 6; let y = rainPos[o + 1] - rainVel[i] * dt;
      let x = rainPos[o], z = rainPos[o + 2];
      if (y < 0 || Math.abs(x - cx) > 22 || Math.abs(z - cz) > 22) { y = 10 + Math.random() * 4; x = cx + (Math.random() * 2 - 1) * 22; z = cz + (Math.random() * 2 - 1) * 22; }
      rainPos[o] = x; rainPos[o + 1] = y; rainPos[o + 2] = z; rainPos[o + 3] = x + 0.05; rainPos[o + 4] = y + 0.45; rainPos[o + 5] = z + 0.02;
    }
    rainGeo.attributes.position.needsUpdate = true;
  }
  // relâmpago: pico de luz + trovão atrasado (só em áreas abertas com tempestade)
  if (atmo.mood && atmo.mood.lightning) {
    atmo.nextBolt -= dt;
    if (atmo.nextBolt <= 0) { atmo.nextBolt = rand(12, 26); atmo.lightning = 1; if (atmo.onThunder) atmo.onThunder(rand(0.4, 1.6)); }
  }
  if (atmo.lightning > 0) atmo.lightning = Math.max(0, atmo.lightning - dt * 3.2);
  const flick = atmo.lightning > 0 ? atmo.lightning * (0.6 + 0.4 * Math.sin(atmo.lightning * 40)) : 0;
  hemi.intensity = HEMI_BASE + flick * 4;
  moon.intensity = MOON_BASE + flick * 3;
}

// ---------- colisão 2D (XZ) ----------
export function inWater(x, z) { for (const w of water) if (x > w.minX && x < w.maxX && z > w.minZ && z < w.maxZ) return true; return false; }

/** Ponto livre de obstáculos dentro dos limites. */
export function freeSpot(x, z, r) {
  for (const b of boxes) if (x > b.minX - r - 0.6 && x < b.maxX + r + 0.6 && z > b.minZ - r - 0.6 && z < b.maxZ + r + 0.6) return false;
  for (const c of circles) if (Math.hypot(x - c.x, z - c.z) < c.r + r + 0.8) return false;
  return x > bounds.minX + r && x < bounds.maxX - r && z > bounds.minZ + r && z < bounds.maxZ - r;
}

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
  if (p.x < bounds.minX + r) { p.x = bounds.minX + r; hit = true; }
  if (p.x > bounds.maxX - r) { p.x = bounds.maxX - r; hit = true; }
  if (p.z < bounds.minZ + r) { p.z = bounds.minZ + r; hit = true; }
  if (p.z > bounds.maxZ - r) { p.z = bounds.maxZ - r; hit = true; }
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
 *  minH ignora obstáculos mais baixos que essa altura (tiros passam por cima de caixas/pedras).
 *  Os limites da área também contam (paredes/selva fechada). */
export function castWorld(ox, oz, dx, dz, max, minH = 0) {
  let best = max;
  for (const b of boxes) { if (b.h < minH) continue; const t = rayBox(ox, oz, dx, dz, b); if (t < best) best = t; }
  for (const c of circles) { if (c.h < minH) continue; const t = rayCircle(ox, oz, dx, dz, c.x, c.z, c.r); if (t < best) best = t; }
  return best;
}
