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

/** Textura de ruído em canvas (chão, concreto, madeira). */
export function noiseTex(base, cols, n, rep, size = 256) {
  const cv = document.createElement('canvas'); cv.width = cv.height = size;
  const x = cv.getContext('2d'); x.fillStyle = base; x.fillRect(0, 0, size, size);
  for (let i = 0; i < n; i++) {
    x.fillStyle = cols[i % cols.length]; x.globalAlpha = Math.random() * 0.35;
    x.beginPath(); x.arc(Math.random() * size, Math.random() * size, Math.random() * size * 0.05 + 2, 0, 7); x.fill();
  }
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep, rep); t.colorSpace = THREE.SRGBColorSpace;
  return t;
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

/** Pool simples em anel: reaproveita objetos em vez de criar/destruir a cada tiro. */
export class RingPool {
  constructor(size, factory) { this.items = Array.from({ length: size }, factory); this.i = 0; }
  next() { const it = this.items[this.i]; this.i = (this.i + 1) % this.items.length; return it; }
  forEach(fn) { this.items.forEach(fn); }
}
