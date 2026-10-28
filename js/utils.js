// utils.js — helpers de matemática, RNG, texturas procedurais e pools.
import * as THREE from 'three';

export const $ = (id) => document.getElementById(id);

export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const rand = (a, b) => a + Math.random() * (b - a);
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
/** Interpolação exponencial independente de framerate. */
export const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));
export function wrapAngle(a) { return ((a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI; }
export const lerpAngle = (a, b, t) => a + wrapAngle(b - a) * t;
export function shuffle(arr) {
  for (let j = arr.length - 1; j > 0; j--) { const r = Math.floor(Math.random() * (j + 1)); [arr[j], arr[r]] = [arr[r], arr[j]]; }
  return arr;
}

/**
 * Textura de ruído em canvas (chão, concreto, madeira), contínua nas bordas (tileable).
 * Camadas: manchas grandes, manchas pequenas, granulado fino e (opcional) escorridos verticais.
 * opts.bump = gera também um mapa de relevo em tons de cinza (t.userData.bump), barato e sem shader extra.
 * opts.streaks = escorridos de sujeira/ferrugem (paredes e metal). opts.grain = intensidade do granulado.
 */
export function noiseTex(base, cols, n, rep, size = 256, opts = {}) {
  const cv = document.createElement('canvas'); cv.width = cv.height = size;
  const x = cv.getContext('2d'); x.fillStyle = base; x.fillRect(0, 0, size, size);
  const blob = (cx, cy, r) => {
    for (const ox of [-size, 0, size]) for (const oy of [-size, 0, size]) {
      if (cx + ox + r < 0 || cx + ox - r > size || cy + oy + r < 0 || cy + oy - r > size) continue;
      x.beginPath(); x.arc(cx + ox, cy + oy, r, 0, 7); x.fill();
    }
  };
  // manchas grandes e suaves (variação de tom)
  for (let i = 0; i < Math.max(6, n / 40); i++) {
    x.fillStyle = cols[i % cols.length]; x.globalAlpha = 0.08 + Math.random() * 0.12;
    blob(Math.random() * size, Math.random() * size, size * (0.08 + Math.random() * 0.14));
  }
  for (let i = 0; i < n; i++) {
    x.fillStyle = cols[i % cols.length]; x.globalAlpha = Math.random() * 0.35;
    blob(Math.random() * size, Math.random() * size, Math.random() * size * 0.05 + 2);
  }
  if (opts.streaks) {
    for (let i = 0; i < opts.streaks; i++) {
      x.fillStyle = cols[i % cols.length]; x.globalAlpha = 0.05 + Math.random() * 0.12;
      const sx = Math.random() * size, w = 1 + Math.random() * 3, h = size * (0.2 + Math.random() * 0.6);
      x.fillRect(sx, Math.random() * size * 0.3, w, h);
    }
  }
  // granulado fino por pixel
  const img = x.getImageData(0, 0, size, size), d = img.data, gr = opts.grain ?? 18;
  for (let i = 0; i < d.length; i += 4) { const v = (Math.random() - 0.5) * gr; d[i] += v; d[i + 1] += v; d[i + 2] += v; }
  x.globalAlpha = 1; x.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep, rep); t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (opts.bump) {
    // relevo: luminância + granulado extra (escuro = fundo, claro = alto)
    const bc = document.createElement('canvas'); bc.width = bc.height = size; const bx = bc.getContext('2d');
    const bi = bx.createImageData(size, size), bd = bi.data;
    for (let i = 0; i < d.length; i += 4) {
      const l = (d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11) * 1.6 + (Math.random() - 0.5) * 40;
      bd[i] = bd[i + 1] = bd[i + 2] = Math.max(0, Math.min(255, l)); bd[i + 3] = 255;
    }
    bx.putImageData(bi, 0, 0);
    const b = new THREE.CanvasTexture(bc); b.wrapS = b.wrapT = THREE.RepeatWrapping; b.repeat.copy(t.repeat);
    t.userData.bump = b;
  }
  return t;
}

/** Material padrão com mapa + relevo gerados do mesmo ruído. */
export function texMat(base, cols, n, rep, params = {}, opts = {}) {
  const t = noiseTex(base, cols, n, rep, opts.size || 256, { bump: true, ...opts });
  return new THREE.MeshStandardMaterial({ map: t, bumpMap: t.userData.bump, bumpScale: opts.bumpScale ?? 1.2, ...params });
}

/** Chapa corrugada (contêineres, galpões): listras verticais + relevo forte. */
export function corrugatedTex(base, dark, light, ribs = 16, size = 256) {
  const cv = document.createElement('canvas'); cv.width = cv.height = size; const x = cv.getContext('2d');
  const bc = document.createElement('canvas'); bc.width = bc.height = size; const bx = bc.getContext('2d');
  const w = size / ribs;
  for (let i = 0; i < ribs; i++) {
    const g = x.createLinearGradient(i * w, 0, (i + 1) * w, 0);
    g.addColorStop(0, dark); g.addColorStop(0.5, light); g.addColorStop(1, dark);
    x.fillStyle = g; x.fillRect(i * w, 0, w, size);
    const gb = bx.createLinearGradient(i * w, 0, (i + 1) * w, 0);
    gb.addColorStop(0, '#000'); gb.addColorStop(0.5, '#fff'); gb.addColorStop(1, '#000');
    bx.fillStyle = gb; bx.fillRect(i * w, 0, w, size);
  }
  x.globalCompositeOperation = 'multiply'; x.fillStyle = base; x.fillRect(0, 0, size, size);
  x.globalCompositeOperation = 'source-over';
  // ferrugem e sujeira escorrida
  for (let i = 0; i < 60; i++) {
    x.globalAlpha = 0.05 + Math.random() * 0.15; x.fillStyle = Math.random() < 0.5 ? '#5a3018' : '#1a1a14';
    const sx = Math.random() * size; x.fillRect(sx, Math.random() * size * 0.4, 1 + Math.random() * 4, size * Math.random() * 0.7);
  }
  for (let i = 0; i < 40; i++) { x.globalAlpha = 0.1 + Math.random() * 0.2; x.fillStyle = '#4a2a14'; x.beginPath(); x.arc(Math.random() * size, Math.random() * size, 2 + Math.random() * 10, 0, 7); x.fill(); }
  const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  const b = new THREE.CanvasTexture(bc); b.wrapS = b.wrapT = THREE.RepeatWrapping;
  t.userData.bump = b; return t;
}

/** Ondulações contínuas (relevo animado de água/lama). */
export function rippleTex(size = 128) {
  const cv = document.createElement('canvas'); cv.width = cv.height = size; const x = cv.getContext('2d');
  x.fillStyle = '#808080'; x.fillRect(0, 0, size, size);
  for (let i = 0; i < 70; i++) {
    const cx = Math.random() * size, cy = Math.random() * size, r = 3 + Math.random() * 16;
    for (const ox of [-size, 0, size]) for (const oy of [-size, 0, size]) {
      x.strokeStyle = Math.random() < 0.5 ? 'rgba(255,255,255,.35)' : 'rgba(0,0,0,.35)'; x.lineWidth = 1 + Math.random() * 2;
      x.beginPath(); x.arc(cx + ox, cy + oy, r, 0, 7); x.stroke();
    }
  }
  const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}

/** Gradiente vertical (feixes de luz volumétricos: claro no topo → transparente embaixo). */
export function beamTex() {
  const cv = document.createElement('canvas'); cv.width = 8; cv.height = 128; const x = cv.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, 128);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,255,255,.45)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 8, 128);
  return new THREE.CanvasTexture(cv);
}

/** Texto em textura (placas de portão). */
export function labelTex(text, sub = '', fg = '#e8f0c8', bg = 'rgba(10,20,12,.9)') {
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 64; const x = cv.getContext('2d');
  x.fillStyle = bg; x.fillRect(0, 0, 256, 64);
  x.strokeStyle = '#c8a020'; x.lineWidth = 3; x.strokeRect(3, 3, 250, 58);
  let fs = 22; x.font = `bold ${fs}px Trebuchet MS, sans-serif`;
  while (x.measureText(text).width > 236 && fs > 10) { fs--; x.font = `bold ${fs}px Trebuchet MS, sans-serif`; }
  x.fillStyle = fg; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText(text, 128, sub ? 25 : 32);
  if (sub) { x.font = '13px Trebuchet MS, sans-serif'; x.fillStyle = '#9fb79a'; x.fillText(sub, 128, 48); }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}

/**
 * Funde várias geometrias numa só (1 draw call) com cor por vértice.
 * parts: [{ geo, p:[x,y,z], r:[x,y,z], s:[x,y,z]|number, c: hex }]
 */
const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color();
export function mergeGeos(parts) {
  const pos = [], nor = [], uv = [], col = [];
  for (const pt of parts) {
    const g = pt.geo.index ? pt.geo.toNonIndexed() : pt.geo.clone();
    const sc = pt.s === undefined ? 1 : pt.s;
    _s.set(...(typeof sc === 'number' ? [sc, sc, sc] : sc));
    _m4.compose(_v.set(...(pt.p || [0, 0, 0])), _q.setFromEuler(_e.set(...(pt.r || [0, 0, 0]))), _s);
    g.applyMatrix4(_m4);
    const P = g.attributes.position, N = g.attributes.normal, U = g.attributes.uv;
    _c.set(pt.c ?? 0xffffff);
    let j = 1;
    for (let i = 0; i < P.count; i++) {
      pos.push(P.getX(i), P.getY(i), P.getZ(i));
      nor.push(N.getX(i), N.getY(i), N.getZ(i));
      if (U) uv.push(U.getX(i), U.getY(i)); else uv.push(0, 0);
      if (i % 3 === 0) j = pt.jitter ? 1 + (Math.random() - 0.5) * pt.jitter : 1; // variação por face (visual "low-poly")
      col.push(_c.r * j, _c.g * j, _c.b * j);
    }
    g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  out.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  out.computeBoundingSphere();
  return out;
}

/** Gradiente radial branco → transparente (halos, clarão, vaga-lumes). */
export function glowTex() {
  const cv = document.createElement('canvas'); cv.width = cv.height = 64; const x = cv.getContext('2d');
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.3, 'rgba(255,255,255,.6)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(cv);
}

/** Mancha irregular (decalque de sangue/ácido no chão). */
export function splatTex() {
  const cv = document.createElement('canvas'); cv.width = cv.height = 64; const x = cv.getContext('2d');
  x.fillStyle = '#fff';
  for (let i = 0; i < 14; i++) {
    const a = Math.random() * 7, d = Math.random() * 18;
    x.globalAlpha = 0.5 + Math.random() * 0.5;
    x.beginPath(); x.arc(32 + Math.cos(a) * d, 32 + Math.sin(a) * d, 4 + Math.random() * 9, 0, 7); x.fill();
  }
  return new THREE.CanvasTexture(cv);
}

/** Mancha suave em escala de cinza (alphaMap: lê o canal verde) — manchas de chão e poças. */
export function softSplatTex() {
  const cv = document.createElement('canvas'); cv.width = cv.height = 128; const x = cv.getContext('2d');
  x.fillStyle = '#000'; x.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 26; i++) {
    const a = Math.random() * 7, d = Math.random() * 30, r = 10 + Math.random() * 20;
    const g = x.createRadialGradient(64 + Math.cos(a) * d, 64 + Math.sin(a) * d, 0, 64 + Math.cos(a) * d, 64 + Math.sin(a) * d, r);
    g.addColorStop(0, 'rgba(255,255,255,.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  }
  return new THREE.CanvasTexture(cv);
}

/** Pool simples em anel: reaproveita objetos em vez de criar/destruir a cada tiro. */
export class RingPool {
  constructor(size, factory) { this.items = Array.from({ length: size }, factory); this.i = 0; }
  next() { const it = this.items[this.i]; this.i = (this.i + 1) % this.items.length; return it; }
  forEach(fn) { this.items.forEach(fn); }
}
