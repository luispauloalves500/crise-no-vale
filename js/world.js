// world.js — renderer, cena, luzes fixas, clima (chuva/neblina/relâmpagos), colisão 2D
// e o "kit" de construção que areas.js usa para montar cada área.
import * as THREE from 'three';
import { FX, CAMERA } from './config.js';
import { rand, clamp, noiseTex, glowTex, texMat, corrugatedTex, rippleTex, beamTex, labelTex, mergeGeos, softSplatTex, mulberry32 } from './utils.js';
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

// Extras fixos (sempre na cena, intensidade 0 quando sem uso):
// 2 holofotes com feixe volumétrico falso (cone aditivo) + clarão pontual (explosões/energia) + brilho do chefe.
const BEAM_TEX = beamTex();
function makeSpot() {
  const l = new THREE.SpotLight(0xffffff, 0, 80, 0.3, 0.6, 1.2);
  l.position.set(0, -50, 0); scene.add(l); scene.add(l.target);
  const geo = new THREE.ConeGeometry(1, 1, 24, 1, true); geo.translate(0, -0.5, 0); geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshBasicMaterial({ map: BEAM_TEX, color: 0xffffff, transparent: true, opacity: 0.09, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const beam = new THREE.Mesh(geo, mat); beam.visible = false; beam.frustumCulled = false; scene.add(beam);
  const head = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW, color: 0xffffff, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }));
  head.scale.setScalar(2.6); head.visible = false; scene.add(head);
  return { l, beam, head, cfg: null, override: null, t: Math.random() * 10 };
}
/** Holofotes da área (cfg vem de mood.spots) ou controlados pelo diretor (override: {pos, target, color, intensity, angle}). */
export const spots = [makeSpot(), makeSpot()];
const flashPL = new THREE.PointLight(0xffa040, 0, 24, 2); flashPL.position.set(0, -50, 0); scene.add(flashPL);
const bossPL = new THREE.PointLight(0xff3010, 0, 12, 2); bossPL.position.set(0, -50, 0); scene.add(bossPL);
let flashI = 0;
/** Clarão de luz real (explosão, energia voltando). */
export function flashAt(x, y, z, color = 0xffa040, intensity = 140) { flashPL.position.set(x, y, z); flashPL.color.setHex(color); flashI = Math.max(flashI, intensity); }
/** Brilho avermelhado que acompanha o chefe (null desliga). */
export function bossGlow(pos, k = 1) {
  if (!pos) { bossPL.intensity = 0; bossPL.position.set(0, -50, 0); return; }
  bossPL.position.set(pos.x, 2.6, pos.z); bossPL.intensity = 18 * k;
}

// ---------- colisores da área atual ----------
/** @type {{minX:number,maxX:number,minZ:number,maxZ:number,h:number}[]} */
export const boxes = [];
/** @type {{x:number,z:number,r:number,h:number}[]} */
export const circles = [];
/** Limites retangulares da área atual (mutável). */
export const bounds = { minX: -25, maxX: 25, minZ: -25, maxZ: 25 };
/** Poças/lama da área atual (desaceleram). */
export const water = [];

// ---------- materiais compartilhados (ruído procedural + relevo barato) ----------
function hazardTex() {
  const cv = document.createElement('canvas'); cv.width = cv.height = 64; const x = cv.getContext('2d');
  x.fillStyle = '#d0a020'; x.fillRect(0, 0, 64, 64); x.fillStyle = '#151515';
  for (let i = -64; i < 128; i += 32) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i + 16, 0); x.lineTo(i + 16 - 64, 64); x.lineTo(i - 64, 64); x.fill(); }
  const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; return t;
}
function screenTex() {
  const cv = document.createElement('canvas'); cv.width = 64; cv.height = 64; const x = cv.getContext('2d');
  x.fillStyle = '#9a9a9a'; x.fillRect(0, 0, 64, 64);
  for (let y = 6; y < 60; y += 6) { x.fillStyle = '#fff'; x.fillRect(5, y, 8 + Math.random() * 46, 2); }
  for (let y = 0; y < 64; y += 2) { x.fillStyle = 'rgba(0,0,0,.25)'; x.fillRect(0, y, 64, 1); }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const RIPPLE = rippleTex();
const rip = (rx, ry) => { const t = RIPPLE.clone(); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry); return t; };
export const SCREEN_TEX = screenTex();
const SPLAT = softSplatTex();

export const MATS = {
  concrete: texMat('#5a5d57', ['#3e443a', '#6c6e66', '#2e4a2a', '#4a4f45'], 700, 1, { roughness: 0.95 }, { streaks: 50 }),
  stone: texMat('#6a6250', ['#4a4434', '#7c7260', '#3a4a2a'], 700, 1, { roughness: 1 }, { bumpScale: 2 }),
  metal: texMat('#4a5258', ['#30383e', '#5c646a', '#6a4a30'], 500, 1, { roughness: 0.55, metalness: 0.55 }, { streaks: 80 }),
  rust: texMat('#6a3a22', ['#4a2a18', '#8a5030', '#3a3a3a'], 500, 1, { roughness: 0.85, metalness: 0.3 }, { streaks: 60, bumpScale: 1.8 }),
  crate: texMat('#5a4326', ['#3b2a16', '#6e5332'], 300, 1, { roughness: 0.9 }, { streaks: 140, grain: 26 }),
  plank: texMat('#4a3620', ['#2e2214', '#5e4630', '#3a2a18'], 600, 3, { roughness: 0.95 }, { streaks: 160 }),
  bark: new THREE.MeshStandardMaterial({ color: 0x3b2a1c, roughness: 1 }),
  rock: texMat('#4a4d46', ['#3a3d36', '#5a5d54', '#2e3a26'], 400, 1, { roughness: 1, flatShading: true }, { bumpScale: 3 }),
  vine: new THREE.MeshStandardMaterial({ color: 0x23431d, roughness: 1, flatShading: true }),
  stripe: new THREE.MeshStandardMaterial({ color: 0xc8a020, roughness: 0.8 }),
  hazard: new THREE.MeshStandardMaterial({ map: hazardTex(), roughness: 0.7 }),
  dark: new THREE.MeshStandardMaterial({ color: 0x151816, roughness: 0.9 }),
  post: new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.5, metalness: 0.6 }),
  glass: new THREE.MeshStandardMaterial({ color: 0x0a1820, roughness: 0.05, metalness: 0.9 }),
  window: new THREE.MeshBasicMaterial({ color: 0x6a8a70 }),
  windowDark: new THREE.MeshBasicMaterial({ color: 0x0d1410 }),
  // janelas que acendem quando a energia volta (laboratório e pátio)
  windowPower: new THREE.MeshBasicMaterial({ color: 0x0d1410 }),
  windowPower2: new THREE.MeshBasicMaterial({ color: 0x0d1410 }),
  water: new THREE.MeshStandardMaterial({ color: 0x0c1a1c, roughness: 0.06, metalness: 0.6, transparent: true, opacity: 0.88, bumpMap: rip(26, 8), bumpScale: 0.8 }),
  mud: new THREE.MeshStandardMaterial({ color: 0x1e2414, roughness: 0.2, metalness: 0.3, transparent: true, opacity: 0.92, bumpMap: rip(2, 2), bumpScale: 0.7 }),
};
MATS.hazard.map.repeat.set(1, 4);
const WET = [MATS.concrete, MATS.stone, MATS.metal, MATS.rust, MATS.crate, MATS.plank, MATS.rock, MATS.hazard];
WET.forEach((m) => { m.userData.baseRough = m.roughness; });
export const leafMats = [0x1f3d1c, 0x24481f, 0x173317, 0x2b4a22].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 1, flatShading: true }));
const gt = (base, cols) => () => noiseTex(base, cols, 1600, 1, 512, { bump: true, grain: 24 });
export const groundTex = {
  jungle: gt('#1d2a17', ['#2d3a1f', '#3a2f1e', '#14200f', '#41472a']),
  mud: gt('#1a1f12', ['#262c18', '#2e2616', '#10160c', '#343a20']),
  paving: gt('#3a3c36', ['#2a2c28', '#4a4c44', '#2a3a24', '#55574f']),
  sand: gt('#3a3426', ['#2e2a1e', '#4a4232', '#262418']),
  stone: gt('#2e2c24', ['#3e3a2e', '#24221c', '#2a3a22']),
};

const unitBox = new THREE.BoxGeometry(1, 1, 1);
export function boxMesh(mat, w, h, d) { const m = new THREE.Mesh(unitBox, mat); m.scale.set(w, h, d); return m; }
const glowSprite = (color, scale, opacity = 0.7) => {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW, color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity }));
  s.scale.setScalar(scale); return s;
};

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

// caixa de madeira com quinas reforçadas e travessas em X (geometria única fundida = 1 draw call)
const crateMat = new THREE.MeshStandardMaterial({ map: MATS.crate.map, bumpMap: MATS.crate.bumpMap, bumpScale: 1.2, roughness: 0.9, vertexColors: true });
crateMat.userData.baseRough = 0.9; WET.push(crateMat);
let CRATE_GEO = null;
function crateGeo() {
  if (CRATE_GEO) return CRATE_GEO;
  const B = unitBox, dark = 0x8a7050, P = [{ geo: B, s: [0.94, 0.94, 0.94], p: [0, 0.5, 0] }], t = 0.1;
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) P.push({ geo: B, p: [x * 0.47, 0.5, z * 0.47], s: [t, 1, t], c: dark });
  for (const y of [0.05, 0.95]) {
    for (const z of [-1, 1]) P.push({ geo: B, p: [0, y, z * 0.47], s: [1, t, t], c: dark });
    for (const x of [-1, 1]) P.push({ geo: B, p: [x * 0.47, y, 0], s: [t, t, 1], c: dark });
  }
  for (const [x, z, ry] of [[0, 0.475, 0], [0, -0.475, 0], [0.475, 0, Math.PI / 2], [-0.475, 0, Math.PI / 2]]) P.push({ geo: B, p: [x, 0.5, z], r: [0, ry, Math.PI / 4], s: [1.2, 0.09, 0.04], c: dark });
  return (CRATE_GEO = mergeGeos(P));
}
export function crate(ctx, x, z, s, mat = MATS.crate) {
  if (mat !== MATS.crate) return solid(ctx, x, z, s, s, s, mat);
  const m = new THREE.Mesh(crateGeo(), crateMat); m.scale.setScalar(s); m.position.set(x, 0, z);
  m.castShadow = m.receiveShadow = true; ctx.group.add(m);
  ctx.boxes.push({ minX: x - s / 2, maxX: x + s / 2, minZ: z - s / 2, maxZ: z + s / 2, h: s });
  return m;
}
/** Contêiner de chapa corrugada, com aros e travas na porta. */
const contMats = {};
export function container(ctx, x, z, w, d, h, hex = 0x8a4a2a) {
  const len = Math.max(w, d), key = hex + '_' + len;
  if (!contMats[key]) {
    const t = corrugatedTex('#' + hex.toString(16).padStart(6, '0'), '#5a5a5a', '#e0e0e0', 18);
    t.repeat.set(len / 2.6, 1); t.userData.bump.repeat.copy(t.repeat);
    const m = new THREE.MeshStandardMaterial({ map: t, bumpMap: t.userData.bump, bumpScale: 3, roughness: 0.6, metalness: 0.45 });
    m.userData.baseRough = 0.6; WET.push(m); contMats[key] = m;
  }
  const m = solid(ctx, x, z, w, d, h, contMats[key]);
  const along = w >= d; // portas na ponta do eixo longo
  for (const yy of [0.06, h - 0.06]) { const r = boxMesh(MATS.dark, w + 0.08, 0.12, d + 0.08); r.position.set(x, yy, z); ctx.group.add(r); }
  for (const s of [-1, 1]) for (const k of [-0.25, 0.25]) {
    const rod = boxMesh(MATS.post, along ? 0.06 : 0.07, h - 0.3, along ? 0.07 : 0.06);
    if (along) rod.position.set(x + s * (w / 2 + 0.04), h / 2, z + k * d); else rod.position.set(x + k * w, h / 2, z + s * (d / 2 + 0.04));
    ctx.group.add(rod);
  }
  return m;
}

// ---------- árvores (variações fundidas com cor por vértice: 1 draw call por árvore) ----------
const TREE_MAT = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95 });
const LEAF = [0x1f3d1c, 0x24481f, 0x173317, 0x2b4a22, 0x2f5226, 0x355c28];
const cyl = (rt, rb, h, seg = 6) => new THREE.CylinderGeometry(rt, rb, h, seg);
const ICO = new THREE.IcosahedronGeometry(1, 0), CONE = new THREE.ConeGeometry(1, 1, 7);
const tilt = (a, k) => [Math.sin(a) * k, 0, -Math.cos(a) * k];
const TREE_BUILD = {
  broad(r) {
    const P = [], H = 2.7 + r() * 1.0, bark = 0x3b2a1c;
    P.push({ geo: cyl(0.14, 0.3, H, 7), p: [0, H / 2, 0], c: bark });
    for (let i = 0; i < 4; i++) { const a = i * 1.57 + r() * 0.5; P.push({ geo: unitBox, p: [Math.cos(a) * 0.32, 0.12, Math.sin(a) * 0.32], r: [0, -a, 0.5], s: [0.6, 0.22, 0.16], c: 0x30231a }); }
    for (let i = 0; i < 3; i++) { const a = i * 2.1 + r(), L = 1.2 + r() * 0.6; P.push({ geo: cyl(0.04, 0.09, L, 5), p: [Math.cos(a) * L * 0.35, H - 0.4 + r() * 0.4, Math.sin(a) * L * 0.35], r: tilt(a, 0.9), c: bark }); }
    const n = 7 + Math.floor(r() * 3);
    for (let i = 0; i < n; i++) {
      const a = r() * 6.28, d = r() * 1.4, y = H + 0.3 + r() * 1.5 - d * 0.3, s = 0.8 + r() * 0.7;
      P.push({ geo: ICO, p: [Math.cos(a) * d, y, Math.sin(a) * d], r: [r() * 3, r() * 3, r() * 3], s: [s * 1.2, s * 0.8, s * 1.2], c: LEAF[Math.floor(r() * 4) + (y > H + 1.2 ? 2 : 0)], jitter: 0.3 });
    }
    return mergeGeos(P);
  },
  conifer(r) {
    const P = [], H = 2.4 + r() * 0.6;
    P.push({ geo: cyl(0.12, 0.26, H + 2, 6), p: [0, (H + 2) / 2, 0], c: 0x35261a });
    for (let i = 0; i < 4; i++) {
      const rad = 2.0 - i * 0.42;
      P.push({ geo: CONE, p: [0, H * 0.55 + i * 0.95, 0], r: [r() * 0.12, r() * 3, r() * 0.12], s: [rad, 1.7, rad], c: LEAF[(i + Math.floor(r() * 2)) % 4], jitter: 0.25 });
    }
    return mergeGeos(P);
  },
  palm(r) {
    const P = [], bend = 0.12 + r() * 0.14; let x = 0, y = 0;
    for (let i = 0; i < 5; i++) {
      P.push({ geo: cyl(0.15 - i * 0.012, 0.2 - i * 0.012, 1.02, 7), p: [x, y + 0.5, 0], r: [0, 0, -bend * i * 0.3], c: i % 2 ? 0x5a4630 : 0x4a3a26 });
      x += bend * i * 0.3; y += 0.98;
    }
    for (let i = 0; i < 3; i++) P.push({ geo: ICO, p: [x + Math.cos(i * 2.1) * 0.2, y - 0.2, Math.sin(i * 2.1) * 0.2], s: 0.16, c: 0x4a3a1a });
    for (let i = 0; i < 8; i++) {
      const a = i * 0.785 + r() * 0.3, dx = Math.cos(a), dz = Math.sin(a), c = r() < 0.5 ? 0x2f5a24 : 0x3a6a2a;
      P.push({ geo: unitBox, p: [x + dx * 0.7, y + 0.2, dz * 0.7], r: [0, -a, 0.3], s: [1.4, 0.05, 0.45], c, jitter: 0.2 });
      P.push({ geo: unitBox, p: [x + dx * 1.95, y - 0.05, dz * 1.95], r: [0, -a, -0.55], s: [1.3, 0.05, 0.36], c, jitter: 0.2 });
    }
    return mergeGeos(P);
  },
  swamp(r) {
    const P = [], bark = 0x2e2a20, H = 3.4 + r() * 0.8;
    P.push({ geo: cyl(0.16, 0.24, H * 0.55, 6), p: [0, H * 0.27, 0], r: [0.08, 0, 0.06], c: bark });
    P.push({ geo: cyl(0.1, 0.16, H * 0.5, 6), p: [0.12, H * 0.75, 0.05], r: [-0.12, 0, -0.1], c: bark });
    for (let i = 0; i < 5; i++) { const a = i * 1.25 + r() * 0.4; P.push({ geo: cyl(0.05, 0.08, 1.4, 5), p: [Math.cos(a) * 0.45, 0.45, Math.sin(a) * 0.45], r: tilt(a, -0.8), c: 0x2a261c }); }
    const tips = [];
    for (let i = 0; i < 4; i++) {
      const a = i * 1.6 + r(), L = 1.4 + r() * 0.8, by = H * (0.6 + r() * 0.3);
      P.push({ geo: cyl(0.03, 0.07, L, 5), p: [Math.cos(a) * L * 0.4, by + 0.3, Math.sin(a) * L * 0.4], r: tilt(a, 1.0), c: bark });
      tips.push([Math.cos(a) * L * 0.75, by + 0.6, Math.sin(a) * L * 0.75]);
    }
    for (const [tx, ty, tz] of tips) {
      if (r() < 0.7) P.push({ geo: ICO, p: [tx, ty + 0.2, tz], s: [0.7, 0.45, 0.7], c: 0x2a3418, jitter: 0.3 });
      for (let k = 0; k < 2; k++) { const L = 0.8 + r() * 1.0; P.push({ geo: unitBox, p: [tx + (r() - 0.5) * 0.5, ty - L / 2, tz + (r() - 0.5) * 0.5], s: [0.05, L, 0.05], c: 0x5a6a48 }); }
    }
    return mergeGeos(P);
  },
};
const treeCache = {};
function treeVariants(style) {
  if (treeCache[style]) return treeCache[style];
  const r = mulberry32(style.length * 7919 + 13), arr = [];
  for (let i = 0; i < 5; i++) arr.push(TREE_BUILD[style](r));
  return (treeCache[style] = arr);
}
/** Árvore: estilo vem do ctx (ctx.treeStyle) ou mistura folhosa/conífera; palm = coqueiro. */
export function tree(ctx, x, z, collide, sc, palm = false) {
  const rng = ctx.rng, style = palm ? 'palm' : (ctx.treeStyle || (rng() < 0.3 ? 'conifer' : 'broad'));
  const vs = treeVariants(style), m = new THREE.Mesh(vs[Math.floor(rng() * vs.length)], TREE_MAT);
  m.scale.set(sc, sc * (0.9 + rng() * 0.25), sc); m.rotation.y = rng() * 6.28; m.position.set(x, 0, z);
  m.castShadow = true; ctx.group.add(m);
  if (collide) ctx.circles.push({ x, z, r: 0.45 * sc, h: 6 });
}
const rockGeo = new THREE.DodecahedronGeometry(1, 0);
export function rock(ctx, x, z, s, collide = true) {
  const rng = ctx.rng, m = new THREE.Mesh(rockGeo, MATS.rock); m.scale.set(s, s * 0.7, s);
  m.position.set(x, s * 0.45, z); m.rotation.set(rng() * 3, rng() * 3, rng() * 3);
  m.castShadow = m.receiveShadow = true; ctx.group.add(m); if (collide) ctx.circles.push({ x, z, r: s * 0.9, h: s * 1.1 });
}
const FLAT = new THREE.PlaneGeometry(1, 1);
const puddleMat = new THREE.MeshStandardMaterial({ color: 0x05080a, roughness: 0.03, metalness: 0.35, transparent: true, opacity: 0.85, alphaMap: SPLAT, depthWrite: false, bumpMap: rip(1, 1), bumpScale: 0.5, polygonOffset: true, polygonOffsetFactor: -2 });
/** Chão texturizado + manchas de terra/musgo + poças brilhantes (instanciadas: 1 draw call cada). */
export function ground(ctx, b, tex, extra = 30, opts = {}) {
  const w = b.maxX - b.minX + extra * 2, d = b.maxZ - b.minZ + extra * 2;
  const t = tex(); t.repeat.set(w / 10, d / 10);
  const bump = t.userData.bump; if (bump) bump.repeat.copy(t.repeat);
  const mat = new THREE.MeshStandardMaterial({ map: t, bumpMap: bump || null, bumpScale: 1.6, roughness: 1 });
  mat.userData.baseRough = 1; ctx.groundMat = mat;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat);
  m.rotation.x = -Math.PI / 2; m.position.set((b.minX + b.maxX) / 2, 0, (b.minZ + b.maxZ) / 2); m.receiveShadow = true; ctx.group.add(m);
  const rng = ctx.rng, o = new THREE.Object3D();
  const scatter = (n, mat2, y, s0, s1) => {
    const inst = new THREE.InstancedMesh(FLAT, mat2, n);
    for (let i = 0; i < n; i++) {
      o.position.set(b.minX + rng() * (b.maxX - b.minX), y, b.minZ + rng() * (b.maxZ - b.minZ));
      o.rotation.set(-Math.PI / 2, 0, rng() * 6.28); const s = s0 + rng() * (s1 - s0); o.scale.set(s, s * (0.6 + rng() * 0.6), 1);
      o.updateMatrix(); inst.setMatrixAt(i, o.matrix);
    }
    inst.receiveShadow = true; ctx.group.add(inst); return inst;
  };
  const patches = opts.patches ?? 34;
  if (patches) scatter(patches, new THREE.MeshStandardMaterial({ color: opts.patchCol ?? 0x14180c, roughness: 1, transparent: true, opacity: 0.6, alphaMap: SPLAT, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 }), 0.012, 2, 6);
  if (opts.puddles) scatter(opts.puddles, puddleMat, 0.02, 1.2, 3.4);
}
export function grass(ctx, b, n, color = 0x2f5524) {
  const rng = ctx.rng, geo = new THREE.ConeGeometry(0.12, 0.6, 4); geo.translate(0, 0.3, 0);
  const inst = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1 }), n), d = new THREE.Object3D();
  const base = new THREE.Color(color), c = new THREE.Color();
  for (let i = 0; i < n; i++) {
    d.position.set(b.minX - 4 + rng() * (b.maxX - b.minX + 8), 0, b.minZ - 4 + rng() * (b.maxZ - b.minZ + 8));
    d.rotation.set(rng() * 0.4, rng() * 3, rng() * 0.4); d.scale.set(0.6 + rng(), 0.5 + rng() * 1.3, 0.6 + rng()); d.updateMatrix(); inst.setMatrixAt(i, d.matrix);
    c.copy(base).multiplyScalar(0.7 + rng() * 0.6); inst.setColorAt(i, c);
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
  // margem de lama mais escura ao redor da poça
  const rim = new THREE.Mesh(FLAT, new THREE.MeshStandardMaterial({ color: 0x0e1208, roughness: 0.6, transparent: true, opacity: 0.7, alphaMap: SPLAT, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 }));
  rim.rotation.x = -Math.PI / 2; rim.position.set(x, 0.015, z); rim.scale.set(w * 1.5, d * 1.5, 1); ctx.group.add(rim);
  ctx.water.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
}
const postGeo = new THREE.CylinderGeometry(0.06, 0.09, 3, 6), bulbGeo = new THREE.SphereGeometry(0.14, 8, 6);
const lampConeGeo = new THREE.ConeGeometry(1, 1, 16, 1, true); lampConeGeo.translate(0, -0.5, 0);
/** Poste com luz e cone de luz volumétrico. mode: flicker | pulse (alarme) | steady | fire. Máx. 6 luzes reais por área. */
export function lamp(ctx, x, z, color, mode = 'flicker', base = 22, h = 3) {
  const post = new THREE.Mesh(postGeo, MATS.post); post.scale.y = h / 3; post.position.set(x, h / 2, z); post.castShadow = true; ctx.group.add(post);
  const plate = boxMesh(MATS.dark, 0.35, 0.12, 0.35); plate.position.set(x, 0.06, z); ctx.group.add(plate);
  const hood = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.22, 8, 1, true), MATS.post); hood.position.set(x, h + 0.08, z); ctx.group.add(hood);
  const bulbMat = new THREE.MeshBasicMaterial({ color });
  const bulb = new THREE.Mesh(bulbGeo, bulbMat); bulb.position.set(x, h, z); ctx.group.add(bulb);
  const halo = glowSprite(color, 1.9); halo.position.copy(bulb.position); ctx.group.add(halo);
  const cone = new THREE.Mesh(lampConeGeo, new THREE.MeshBasicMaterial({ map: BEAM_TEX, color, transparent: true, opacity: 0.08, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  cone.position.set(x, h - 0.05, z); cone.scale.set(h * 0.75, h, h * 0.75); ctx.group.add(cone);
  const L = { x, y: h - 0.1, z, color, mode, base, halo, cone, bulb, t: ctx.rng() * 10, on: true, snap: 0, boost: 0 };
  ctx.lamps.push(L); return L;
}
/** Fogo (destroços em chamas): só luz/halo, sem poste. */
export function fireLight(ctx, x, z, y = 0.8, base = 26) {
  const halo = glowSprite(0xff7020, 3.2, 0.8); halo.position.set(x, y + 0.4, z); ctx.group.add(halo);
  const L = { x, y: y + 0.6, z, color: 0xff7a30, mode: 'fire', base, halo, cone: null, bulb: null, t: 0, on: true, snap: 0, boost: 0 };
  ctx.lamps.push(L); return L;
}
/** Prédio com janelas, beiral, equipamentos no teto e porta. opts.power: janelas acendem com a energia. */
export function building(ctx, x, z, w, d, h, mat = MATS.concrete, lit = 0.3, opts = {}) {
  solid(ctx, x, z, w, d, h, mat);
  const rng = ctx.rng;
  const ledge = boxMesh(MATS.dark, w + 0.4, 0.3, d + 0.4); ledge.position.set(x, h + 0.15, z); ledge.castShadow = true; ctx.group.add(ledge);
  for (let i = 0; i < 1 + Math.floor(rng() * 2); i++) {
    const u = boxMesh(MATS.metal, 1 + rng() * 1.2, 0.7 + rng() * 0.6, 1 + rng() * 0.8);
    u.position.set(x + (rng() - 0.5) * (w - 2), h + 0.6, z + (rng() - 0.5) * (d - 2)); u.castShadow = true; ctx.group.add(u);
  }
  const winMat = () => {
    if (rng() >= lit) return MATS.windowDark;
    return opts.power ? (rng() < 0.7 ? MATS.windowPower : MATS.windowPower2) : MATS.window;
  };
  for (let fy = 1.6; fy < h - 0.8; fy += 2.2) for (let fx = -w / 2 + 1.2; fx < w / 2 - 0.8; fx += 2) {
    for (const s of [-1, 1]) {
      const win = boxMesh(winMat(), 0.9, 1.1, 0.05);
      win.position.set(x + fx + 0.45, fy, z + s * (d / 2 + 0.03)); ctx.group.add(win);
      const sill = boxMesh(MATS.dark, 1.1, 0.1, 0.16); sill.position.set(x + fx + 0.45, fy - 0.6, z + s * (d / 2 + 0.06)); ctx.group.add(sill);
    }
  }
  if (d >= 5) for (let fy = 1.6; fy < h - 0.8; fy += 2.2) for (let fz = -d / 2 + 1.4; fz < d / 2 - 1; fz += 2.4) for (const s of [-1, 1]) {
    const win = boxMesh(winMat(), 0.05, 1.1, 0.9); win.position.set(x + s * (w / 2 + 0.03), fy, z + fz + 0.45); ctx.group.add(win);
  }
  const door = boxMesh(MATS.dark, 1.3, 2.2, 0.08); door.position.set(x + (rng() - 0.5) * (w - 3), 1.1, z + (opts.doorSide ?? 1) * (d / 2 + 0.04)); ctx.group.add(door);
  const pipe = boxMesh(MATS.post, 0.14, h, 0.14); pipe.position.set(x + w / 2 - 0.3, h / 2, z + d / 2 + 0.1); ctx.group.add(pipe);
}
/** Portal/portão de passagem com pilares listrados, luzes de status e grade. */
export function doorway(ctx, side, at, b, label = 'gate') {
  const g = new THREE.Group(); const span = 4.6, hgt = 3.6;
  const isNS = side === 'N' || side === 'S';
  const edge = side === 'N' ? b.minZ : side === 'S' ? b.maxZ : side === 'W' ? b.minX : b.maxX;
  if (isNS) g.position.set(at, 0, edge); else { g.position.set(edge, 0, at); g.rotation.y = Math.PI / 2; }
  const inward = side === 'N' || side === 'W' ? 1 : -1;
  const pL = boxMesh(MATS.hazard, 0.5, hgt, 0.5); pL.position.set(-span / 2, hgt / 2, 0); pL.castShadow = true;
  const pR = pL.clone(); pR.position.x = span / 2; const top = boxMesh(MATS.metal, span + 0.6, 0.5, 0.55); top.position.y = hgt;
  const stripe = boxMesh(MATS.stripe, span, 0.12, 0.6); stripe.position.y = hgt - 0.35;
  const plate = boxMesh(MATS.post, span, 0.05, 1.4); plate.position.y = 0.025;
  g.add(pL, pR, top, stripe, plate);
  // folha do portão (grade) — desce no chão quando abre
  const gate = new THREE.Group(); gate.position.y = 0;
  for (let i = -5; i <= 5; i++) { const bar = boxMesh(MATS.rust, 0.08, hgt - 0.3, 0.08); bar.position.set(i * 0.4, (hgt - 0.3) / 2, 0); gate.add(bar); }
  for (const y of [0.4, 1.6, 2.9]) { const bar = boxMesh(MATS.rust, span - 0.2, 0.1, 0.1); bar.position.y = y; gate.add(bar); }
  g.add(gate);
  const lightMat = new THREE.SpriteMaterial({ map: GLOW, color: 0xff3030, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
  const light = new THREE.Sprite(lightMat); light.scale.setScalar(1.1); light.position.set(span / 2 + 0.1, hgt - 0.6, 0.38 * inward); g.add(light);
  // painéis de status nos dois pilares (mesma cor da luz)
  const statMat = new THREE.MeshBasicMaterial({ color: 0xff3030 });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const p = boxMesh(statMat, 0.26, 0.26, 0.06); p.position.set(sx * span / 2, hgt - 0.6, sz * 0.28); g.add(p); }
  ctx.group.add(g);
  return { group: g, gate, light, statMat, label, inward };
}
/** Cor da luz de status do portão (verde aberto / vermelho trancado). */
export function setDoorLight(ref, open) {
  const c = open ? 0x40ff70 : 0xff3030; ref.light.material.color.setHex(c); if (ref.statMat) ref.statMat.color.setHex(c);
}
/** Placa com o destino acima do portão (lado de dentro da área). */
export function doorSign(ref, text, sub = '') {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.65), new THREE.MeshBasicMaterial({ map: labelTex(text, sub), transparent: true }));
  m.position.set(0, 4.35, 0.3 * ref.inward); if (ref.inward < 0) m.rotation.y = Math.PI; ref.group.add(m);
}
/** Terminal de computador (salvar / controle). Retorna o material da tela para piscar. */
export function terminal(ctx, x, z, yaw, color = 0x40ff90) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = yaw;
  const base = boxMesh(MATS.metal, 0.9, 1.1, 0.6); base.position.y = 0.55; base.castShadow = true; g.add(base);
  const vent = boxMesh(MATS.dark, 0.7, 0.3, 0.02); vent.position.set(0, 0.35, 0.31); g.add(vent);
  const kb = boxMesh(MATS.dark, 0.8, 0.06, 0.3); kb.position.set(0, 1.12, 0.3); kb.rotation.x = 0.2; g.add(kb);
  const head = boxMesh(MATS.dark, 0.9, 0.7, 0.5); head.position.set(0, 1.5, -0.05); head.rotation.x = -0.25; g.add(head);
  const screenMat = new THREE.MeshBasicMaterial({ color, map: SCREEN_TEX });
  const scr = boxMesh(screenMat, 0.72, 0.5, 0.02); scr.position.set(0, 1.52, 0.2); scr.rotation.x = -0.25; g.add(scr);
  const led = boxMesh(new THREE.MeshBasicMaterial({ color }), 0.06, 0.06, 0.02); led.position.set(0.35, 0.9, 0.31); g.add(led);
  const glow = glowSprite(color, 2.2, 0.6); glow.position.set(0, 1.5, 0.4); g.add(glow);
  ctx.group.add(g); ctx.boxes.push({ minX: x - 0.55, maxX: x + 0.55, minZ: z - 0.55, maxZ: z + 0.55, h: 1.2 });
  return { group: g, screenMat, glow };
}
/** Registro achável (tablet num suporte, tela ciano piscando). */
export function datapad(ctx, x, z, yaw = 0) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = yaw;
  const stand = boxMesh(MATS.metal, 0.55, 0.75, 0.42); stand.position.y = 0.375; stand.castShadow = true; g.add(stand);
  const pad = boxMesh(MATS.dark, 0.5, 0.04, 0.36); pad.position.set(0, 0.8, 0); pad.rotation.x = 0.35; g.add(pad);
  const screenMat = new THREE.MeshBasicMaterial({ color: 0x60e0ff, map: SCREEN_TEX });
  const scr = boxMesh(screenMat, 0.42, 0.01, 0.28); scr.position.set(0, 0.825, 0.01); scr.rotation.x = 0.35; g.add(scr);
  const glow = glowSprite(0x60e0ff, 0.9, 0.6); glow.position.set(0, 0.95, 0); g.add(glow);
  ctx.group.add(g); ctx.boxes.push({ minX: x - 0.35, maxX: x + 0.35, minZ: z - 0.35, maxZ: z + 0.35, h: 0.8 });
  return { group: g, screenMat, glow };
}
/** Marcação de heliponto (anel + H + luzes de borda). */
export function helipadMark(ctx, x, z, r = 3.4) {
  const ring = new THREE.Mesh(new THREE.RingGeometry(r, r + 0.3, 40), MATS.stripe); ring.rotation.x = -Math.PI / 2; ring.position.set(x, 0.025, z); ctx.group.add(ring);
  [[-0.7, 0, 0.3, 2.2], [0.7, 0, 0.3, 2.2], [0, 0, 1.4, 0.3]].forEach(([dx, dz, w, d]) => { const m = boxMesh(MATS.stripe, w, 0.02, d); m.position.set(x + dx, 0.03, z + dz); ctx.group.add(m); });
  const edgeMat = new THREE.MeshBasicMaterial({ color: 0x60ff90 });
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4, px = x + Math.cos(a) * (r + 0.6), pz = z + Math.sin(a) * (r + 0.6);
    const b = boxMesh(edgeMat, 0.18, 0.1, 0.18); b.position.set(px, 0.05, pz); ctx.group.add(b);
    const s = glowSprite(0x60ff90, 0.8, 0.5); s.position.set(px, 0.2, pz); ctx.group.add(s);
  }
}
/** Helicóptero procedural (resgate "Garça-1" ou destroços). */
export function helicopter(wreck = false) {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: wreck ? 0x2a2a26 : 0xd8d8cc, roughness: wreck ? 0.9 : 0.45, metalness: 0.4 });
  const redMat = new THREE.MeshStandardMaterial({ color: wreck ? 0x3a1a10 : 0xc02020, roughness: 0.5 });
  const sph = new THREE.SphereGeometry(1, 16, 12);
  const body = new THREE.Mesh(sph, bodyMat); body.scale.set(1.3, 1.15, 2.5); body.position.y = 1.6; body.castShadow = true; g.add(body);
  const nose = new THREE.Mesh(sph, MATS.glass); nose.scale.set(1.0, 0.75, 1.1); nose.position.set(0, 1.85, 1.6); g.add(nose);
  const band = boxMesh(redMat, 2.64, 0.28, 3.4); band.position.set(0, 1.35, -0.2); g.add(band);
  const boom = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.26, 4.6, 8), bodyMat); boom.rotation.x = Math.PI / 2; boom.position.set(0, 1.95, -4.3); boom.castShadow = true; g.add(boom);
  const fin = boxMesh(redMat, 0.12, 1.4, 0.9); fin.position.set(0, 2.6, -6.5); g.add(fin);
  const stab = boxMesh(bodyMat, 1.8, 0.08, 0.5); stab.position.set(0, 2.0, -6.2); g.add(stab);
  const tailRotor = new THREE.Group(); tailRotor.position.set(0.2, 2.7, -6.6);
  for (let i = 0; i < 2; i++) { const bl = boxMesh(MATS.dark, 0.04, 1.4, 0.14); bl.rotation.x = i * Math.PI / 2; tailRotor.add(bl); }
  g.add(tailRotor);
  for (const sx of [-1, 1]) {
    const skid = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 4.2, 6), MATS.post); skid.rotation.x = Math.PI / 2; skid.position.set(sx * 1.05, 0.1, 0.2); g.add(skid);
    for (const kz of [-0.9, 1.2]) { const st = boxMesh(MATS.post, 0.08, 0.7, 0.08); st.position.set(sx * 0.95, 0.45, kz); st.rotation.z = sx * 0.3; g.add(st); }
  }
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 0.6, 8), MATS.post); mast.position.y = 2.9; g.add(mast);
  const rotor = new THREE.Group(); rotor.position.y = 3.2;
  for (let i = 0; i < 2; i++) { const bl = boxMesh(MATS.dark, 11, 0.06, 0.32); bl.rotation.y = i * Math.PI / 2; rotor.add(bl); }
  g.add(rotor);
  let disc = null, nav = [], beacon = null;
  if (!wreck) {
    disc = new THREE.Mesh(new THREE.CircleGeometry(5.6, 32), new THREE.MeshBasicMaterial({ color: 0x223030, transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide }));
    disc.rotation.x = -Math.PI / 2; disc.position.y = 3.22; g.add(disc);
    nav = [glowSprite(0xff2020, 1.0, 1), glowSprite(0x20ff40, 1.0, 1)];
    nav[0].position.set(-1.35, 1.6, 0); nav[1].position.set(1.35, 1.6, 0); g.add(...nav);
    beacon = glowSprite(0xffffff, 1.6, 1); beacon.position.set(0, 2.9, -1.2); g.add(beacon);
    const lampS = glowSprite(0xfff6d0, 2.2, 0.9); lampS.position.set(0, 0.6, 1.6); g.add(lampS);
  } else {
    rotor.children[0].rotation.z = 0.35; rotor.children[1].rotation.x = -0.25; rotor.rotation.y = 0.4;
    tailRotor.rotation.z = 1.1; boom.rotation.z = 0.25; fin.position.y -= 0.6; fin.rotation.z = 0.4;
    g.rotation.set(0.12, 0, 0.45); g.position.y = -0.4;
  }
  return { group: g, rotor, tailRotor, disc, nav, beacon };
}

// ---------- vaga-lumes / chuva (globais, ligados por clima) ----------
const FF = FX.FIREFLIES, ffSets = [];
for (let s = 0; s < 2; s++) {
  const n = Math.floor(FF / 2), geo = new THREE.BufferGeometry(), pos = new Float32Array(n * 3), seed = [];
  for (let i = 0; i < n; i++) { pos[i * 3] = (Math.random() * 2 - 1) * 26; pos[i * 3 + 1] = 0.4 + Math.random() * 3.2; pos[i * 3 + 2] = (Math.random() * 2 - 1) * 26; seed.push(Math.random() * 10); }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xc8ff70, size: 0.16, map: GLOW, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  scene.add(pts); ffSets.push({ pts, geo, n, seed, phase: s * Math.PI });
}

const RN = FX.RAIN;
const rainPos = new Float32Array(RN * 6);
const rainGeo = new THREE.BufferGeometry(); rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
const rainVel = new Float32Array(RN);
for (let i = 0; i < RN; i++) {
  const x = (Math.random() * 2 - 1) * 22, y = Math.random() * 14, z = (Math.random() * 2 - 1) * 22;
  rainPos.set([x, y, z, x + 0.05, y + 0.5, z + 0.02], i * 6); rainVel[i] = 17 + Math.random() * 8;
}
const rainMat = new THREE.LineBasicMaterial({ color: 0x9fb8c8, transparent: true, opacity: 0.32, depthWrite: false });
const rain = new THREE.LineSegments(rainGeo, rainMat); rain.frustumCulled = false; scene.add(rain);
// respingos no chão (pool em anel)
const SPL = 180, splPos = new Float32Array(SPL * 3).fill(-50), splAge = new Float32Array(SPL); let splI = 0;
const splGeo = new THREE.BufferGeometry(); splGeo.setAttribute('position', new THREE.BufferAttribute(splPos, 3));
const splash = new THREE.Points(splGeo, new THREE.PointsMaterial({ color: 0xc8dcea, size: 0.1, transparent: true, opacity: 0.6, depthWrite: false }));
splash.frustumCulled = false; scene.add(splash);

// raio visível no horizonte (fita em zigue-zague, sem neblina)
function boltGeo() {
  const segs = []; let x = 0, y = 60;
  while (y > 0) {
    const ny = y - rand(3, 7), nx = x + rand(-3, 3); segs.push([x, y, nx, ny, 1]); x = nx; y = ny;
    if (Math.random() < 0.3) { let bx = x, by = y; const dir = Math.random() < 0.5 ? -1 : 1; for (let k = 0; k < 3; k++) { const nbx = bx + dir * rand(1, 4), nby = by - rand(2, 5); segs.push([bx, by, nbx, nby, 0.5]); bx = nbx; by = nby; } }
  }
  const pos = [];
  for (const [x0, y0, x1, y1, wm] of segs) { const w = 0.45 * wm; pos.push(x0 - w, y0, 0, x0 + w, y0, 0, x1 + w, y1, 0, x0 - w, y0, 0, x1 + w, y1, 0, x1 - w, y1, 0); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); return g;
}
const boltMat = new THREE.MeshBasicMaterial({ color: 0xe0eaff, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side: THREE.DoubleSide });
const bolts = [0, 1, 2].map(() => { const m = new THREE.Mesh(boltGeo(), boltMat); m.visible = false; m.frustumCulled = false; scene.add(m); return m; });
let curBolt = null;

// ---------- clima / área atual ----------
export const atmo = { lightning: 0, nextBolt: rand(8, 16), onThunder: null, mood: null, haze: 0, powerFlash: 0 };
let curLamps = [];
let HEMI_BASE = 1.25, MOON_BASE = 1.2;
const baseFog = new THREE.Color(0x0b1611), HAZE_COL = new THREE.Color(0x3a0508), BOLT_COL = new THREE.Color(0x6a7a9a);

/** Janelas ligadas à energia (laboratório/pátio). */
export function setPower(on) {
  MATS.windowPower.color.setHex(on ? 0xffd27a : 0x0d1410);
  MATS.windowPower2.color.setHex(on ? 0xbfe8ff : 0x0d1410);
}

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
  const M = area.mood; atmo.mood = M; atmo.haze = 0;
  baseFog.setHex(M.fog);
  scene.background.setHex(M.fog); scene.fog.color.setHex(M.fog); scene.fog.density = M.density;
  hemi.color.setHex(M.sky); hemi.groundColor.setHex(M.groundCol); HEMI_BASE = hemi.intensity = M.hemi;
  moon.color.setHex(M.moonCol); MOON_BASE = moon.intensity = M.moon;
  if (M.moonPos) moon.position.set(...M.moonPos); else moon.position.set(-20, 40, -12);
  renderer.toneMappingExposure = M.exposure ?? 1.15;
  rain.visible = splash.visible = M.rain > 0; rainMat.opacity = 0.34 * (M.rain || 0);
  // brilho molhado: chuva deixa as superfícies menos ásperas (reflexo especular das lâmpadas)
  const wet = Math.min(1, M.rain || 0);
  WET.forEach((m) => { m.roughness = m.userData.baseRough * (1 - 0.42 * wet); });
  if (area.ctx.groundMat) area.ctx.groundMat.roughness = 1 - 0.5 * wet;
  ffSets.forEach((f) => { f.pts.visible = !!M.fireflies; f.pts.material.color.setHex(M.fireflyCol ?? 0xc8ff70); });
  curLamps = area.ctx.lamps;
  lampLights.forEach((l, i) => {
    const L = curLamps[i];
    if (L) { l.color.setHex(L.color); l.position.set(L.x, L.y, L.z); l.distance = L.dist || 16; }
    else { l.intensity = 0; l.position.set(0, -50, 0); }
  });
  spots.forEach((S, i) => { S.cfg = (M.spots || [])[i] || null; S.override = null; });
  bossGlow(null);
  atmo.lightning = 0; atmo.nextBolt = rand(6, 14);
}

function updateSpots(dt) {
  for (const S of spots) {
    const o = S.override, c = S.cfg;
    if (!o && !c) { S.l.intensity = 0; S.beam.visible = S.head.visible = false; continue; }
    S.t += dt;
    let px, py, pz, tx, tz, col, inten, ang;
    if (o) { px = o.pos.x; py = o.pos.y; pz = o.pos.z; tx = o.target.x; tz = o.target.z; col = o.color ?? 0xffffff; inten = o.intensity ?? 90; ang = o.angle ?? 0.26; }
    else {
      const a = S.t * (c.speed ?? 0.4), sw = c.sweep ?? 6;
      px = c.x; py = c.h; pz = c.z; tx = c.tx + Math.sin(a) * sw; tz = c.tz + Math.cos(a * 0.73) * sw * 0.6;
      col = c.color; inten = c.intensity ?? 80; ang = c.angle ?? 0.3;
    }
    S.l.position.set(px, py, pz); S.l.target.position.set(tx, 0, tz); S.l.color.setHex(col); S.l.intensity = inten; S.l.angle = ang;
    S.beam.visible = S.head.visible = true; S.beam.position.set(px, py, pz); S.beam.lookAt(tx, 0, tz);
    const len = Math.hypot(tx - px, py, tz - pz), r = Math.tan(ang) * len; S.beam.scale.set(r, r, len);
    S.beam.material.color.setHex(col); S.head.position.set(px, py, pz); S.head.material.color.setHex(col);
  }
}

/** Anima luzes, vaga-lumes, chuva, relâmpagos, água, holofotes e névoa da área atual. */
export function updateWorld(dt) {
  curLamps.forEach((L, i) => {
    L.t += dt; let k = 0.8 + Math.random() * 0.2;
    if (!L.on) k = 0;
    else if (L.mode === 'pulse') k = 0.5 + 0.5 * Math.sin(L.t * 4);
    else if (L.mode === 'steady') k = 1;
    else if (L.mode === 'fire') k = 0.65 + 0.25 * Math.sin(L.t * 9) + Math.random() * 0.3;
    else if (Math.sin(L.t * 1.7) > 0.97) k = Math.random() < 0.5 ? 0 : k;
    if (L.on && L.snap > 0) { L.snap -= dt; k = Math.random() < 0.45 ? 0 : 1.6; } // lâmpadas "estalando" ao ligar
    if (L.boost > 0) { L.boost = Math.max(0, L.boost - dt * 1.4); k *= 1 + L.boost; }
    L.halo.material.opacity = Math.min(1, 0.7 * k); L.halo.material.color.setHex(L.color);
    if (L.cone) { L.cone.material.opacity = 0.075 * Math.min(k, 1.6); L.cone.material.color.setHex(L.color); }
    if (L.bulb) L.bulb.material.color.setHex(k > 0.05 ? L.color : 0x111111);
    const l = lampLights[i]; if (!l) return;
    l.color.setHex(L.color); l.intensity = L.base * k;
  });
  for (const f of ffSets) {
    if (!f.pts.visible) continue;
    const fp = f.geo.attributes.position.array, t = G.time;
    for (let i = 0; i < f.n; i++) { fp[i * 3 + 1] += Math.sin(t * 1.3 + f.seed[i]) * dt * 0.3; fp[i * 3] += Math.cos(t * 0.7 + f.seed[i]) * dt * 0.2; }
    f.geo.attributes.position.needsUpdate = true;
    f.pts.material.opacity = Math.max(0, 0.5 + 0.5 * Math.sin(t * 2.3 + f.phase));
  }
  if (rain.visible) {
    const cx = camera.position.x, cz = camera.position.z;
    for (let i = 0; i < RN; i++) {
      const o = i * 6; let y = rainPos[o + 1] - rainVel[i] * dt;
      let x = rainPos[o], z = rainPos[o + 2];
      if (y < 0 || Math.abs(x - cx) > 22 || Math.abs(z - cz) > 22) {
        if (y < 0 && Math.random() < 0.35 && Math.abs(x - cx) < 14 && Math.abs(z - cz) < 14) {
          splPos[splI * 3] = x; splPos[splI * 3 + 1] = 0.05; splPos[splI * 3 + 2] = z; splAge[splI] = 0.12; splI = (splI + 1) % SPL;
        }
        y = 10 + Math.random() * 4; x = cx + (Math.random() * 2 - 1) * 22; z = cz + (Math.random() * 2 - 1) * 22;
      }
      rainPos[o] = x; rainPos[o + 1] = y; rainPos[o + 2] = z; rainPos[o + 3] = x + 0.05; rainPos[o + 4] = y + 0.5; rainPos[o + 5] = z + 0.02;
    }
    rainGeo.attributes.position.needsUpdate = true;
    for (let i = 0; i < SPL; i++) if (splAge[i] > 0) { splAge[i] -= dt; if (splAge[i] <= 0) splPos[i * 3 + 1] = -50; else splPos[i * 3 + 1] += dt * 0.6; }
    splGeo.attributes.position.needsUpdate = true;
  }
  // água/lama: ondulação rolando
  MATS.water.bumpMap.offset.x += dt * 0.02; MATS.water.bumpMap.offset.y += dt * 0.012;
  MATS.mud.bumpMap.offset.y += dt * 0.006; puddleMat.bumpMap.offset.x += dt * 0.05;
  // relâmpago: pico de luz + raio visível + trovão atrasado (só em áreas abertas com tempestade)
  if (atmo.mood && atmo.mood.lightning) {
    atmo.nextBolt -= dt;
    if (atmo.nextBolt <= 0) {
      atmo.nextBolt = rand(12, 26); atmo.lightning = 1; if (atmo.onThunder) atmo.onThunder(rand(0.4, 1.6));
      curBolt = bolts[Math.floor(Math.random() * bolts.length)];
      const a = Math.random() * Math.PI * 2, d = rand(60, 85);
      curBolt.position.set(camera.position.x + Math.cos(a) * d, -2, camera.position.z + Math.sin(a) * d);
      curBolt.rotation.y = Math.atan2(camera.position.x - curBolt.position.x, camera.position.z - curBolt.position.z);
    }
  }
  if (atmo.lightning > 0) atmo.lightning = Math.max(0, atmo.lightning - dt * 3.2);
  bolts.forEach((b) => { b.visible = b === curBolt && atmo.lightning > 0.25; });
  boltMat.opacity = Math.min(1, atmo.lightning * 1.4);
  const flick = atmo.lightning > 0 ? atmo.lightning * (0.6 + 0.4 * Math.sin(atmo.lightning * 40)) : 0;
  if (atmo.powerFlash > 0) atmo.powerFlash = Math.max(0, atmo.powerFlash - dt * 1.2);
  hemi.intensity = HEMI_BASE + flick * 4 + atmo.powerFlash * 2.5;
  moon.intensity = MOON_BASE + flick * 3;
  // névoa: tingida de vermelho na arena do chefe; clareia com o relâmpago
  if (atmo.mood) {
    const hz = atmo.haze;
    scene.fog.color.copy(baseFog).lerp(HAZE_COL, hz * 0.6);
    scene.fog.density = atmo.mood.density + hz * 0.012;
    scene.background.copy(scene.fog.color).lerp(BOLT_COL, flick * 0.35);
  }
  flashPL.intensity = flashI; flashI *= Math.exp(-dt * 7); if (flashI < 0.5) flashI = 0;
  updateSpots(dt);
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
