// input.js — teclado, mouse e pointer lock.
import { G } from './state.js';
import { CAMERA } from './config.js';
import { clamp } from './utils.js';

export const keys = {};
export const mouse = { down: false, right: false, locked: false };
let canvas = null;
let handlers = {};

/** Pede pointer lock; falhas (ex.: logo após Esc no Chrome) são ignoradas — clicar na tela tenta de novo. */
export function lockPointer() {
  if (!canvas || !canvas.requestPointerLock || document.pointerLockElement) return;
  try { const r = canvas.requestPointerLock(); if (r && r.catch) r.catch(() => {}); } catch (e) { /* ignore */ }
}
export function unlockPointer() { if (document.pointerLockElement) document.exitPointerLock(); }

export function clearInput() { for (const k in keys) keys[k] = false; mouse.down = false; mouse.right = false; G.aiming = false; }

/**
 * @param {HTMLCanvasElement} cvs
 * @param {{onKey?:(code:string)=>void, onCanvasDown?:()=>void, onLockLost?:()=>void, onBlur?:()=>void}} h
 */
export function initInput(cvs, h) {
  canvas = cvs; handlers = h;
  addEventListener('keydown', (e) => {
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    const first = !keys[e.code];
    keys[e.code] = true;
    if (first && handlers.onKey) handlers.onKey(e.code);
  });
  addEventListener('keyup', (e) => { keys[e.code] = false; });

  canvas.addEventListener('mousedown', (e) => {
    if (handlers.onCanvasDown) handlers.onCanvasDown();
    if (G.state !== 'play') return;
    if (!document.pointerLockElement) lockPointer();
    if (e.button === 0) mouse.down = true;
    if (e.button === 2) { mouse.right = true; G.aiming = true; }
  });
  addEventListener('mouseup', (e) => {
    if (e.button === 0) mouse.down = false;
    if (e.button === 2) { mouse.right = false; G.aiming = false; }
  });
  addEventListener('mousemove', (e) => {
    if (G.state !== 'play') return;
    // com pointer lock usa movementX/Y; sem lock ainda funciona enquanto o cursor se move na janela
    const s = G.aiming ? CAMERA.AIM_SENS : CAMERA.SENS;
    G.yaw -= (e.movementX || 0) * s;
    G.pitch = clamp(G.pitch - (e.movementY || 0) * s, CAMERA.PITCH_MIN, CAMERA.PITCH_MAX);
  });
  document.addEventListener('pointerlockchange', () => {
    mouse.locked = !!document.pointerLockElement;
    if (!mouse.locked && handlers.onLockLost) handlers.onLockLost();
  });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  addEventListener('blur', () => { clearInput(); if (handlers.onBlur) handlers.onBlur(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) { clearInput(); if (handlers.onBlur) handlers.onBlur(); } });
}
