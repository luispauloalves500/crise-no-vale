// gamepad.js — v6: suporte básico a controle (API Gamepad, layout "standard").
// Analógico esquerdo move, direito mira; RT atira, LT mira; A interage, X recarrega, B granada, Y kit médico,
// LB/RB trocam de arma, Start pausa, Select abre o mapa, L3 corre, R3 troca o ombro.
// v10: no Terminal TELLUS — A confirma/compra, B volta, LB/RB abas, direcional navega.
import { G } from './state.js';
import { CAMERA } from './config.js';
import { SETTINGS } from './settings.js';
import { clamp } from './utils.js';

export const pad = { connected: false, id: '', mx: 0, mz: 0, fire: false, aim: false, run: false };
const prev = [];
// v10: Terminal TELLUS — A confirma, B volta, LB/RB trocam de aba, direcional/analógico navegam
const TERM_MAP = { 0: 'Enter', 1: 'Escape', 4: 'TabPrev', 5: 'TabNext', 9: 'Escape', 12: 'ArrowUp', 13: 'ArrowDown', 14: 'ArrowLeft', 15: 'ArrowRight' };
let stickDir = '';
const PLAY_MAP = { 0: 'KeyE', 1: 'KeyG', 2: 'KeyR', 3: 'KeyH', 8: 'Tab', 9: 'Escape', 11: 'KeyV' };
const DZ = 0.18;
const dz = (v) => (Math.abs(v) < DZ ? 0 : (v - Math.sign(v) * DZ) / (1 - DZ));
const LOOK_SPEED = 2.8, AIM_LOOK = 1.5; // rad/s com o analógico no máximo

function reset() { pad.mx = pad.mz = 0; pad.fire = pad.run = false; if (pad.aim) { pad.aim = false; G.aiming = false; } }

/**
 * Lê o primeiro controle conectado (chamado a cada quadro).
 * @param {number} dt
 * @param {{onKey:(code:string)=>void, onWheel:(dir:number)=>void}} h
 */
export function pollGamepad(dt, h) {
  const list = SETTINGS.gamepad && navigator.getGamepads ? navigator.getGamepads() : [];
  let gp = null; for (const g of list) if (g && g.connected) { gp = g; break; }
  if (!gp) { if (pad.connected) { pad.connected = false; reset(); } return; }
  if (!pad.connected) { pad.connected = true; pad.id = gp.id; }
  const ax = (i) => dz(gp.axes[i] || 0);
  const btn = (i) => { const b = gp.buttons[i]; return !!(b && (b.pressed || b.value > 0.5)); };
  const play = G.state === 'play';
  pad.mx = play ? ax(0) : 0; pad.mz = play ? -ax(1) : 0;
  if (play) {
    const lx = ax(2), ly = ax(3), s = (G.aiming ? AIM_LOOK : LOOK_SPEED) * SETTINGS.sens * dt, iy = SETTINGS.invertY ? -1 : 1;
    G.yaw -= lx * Math.abs(lx) * s;
    G.pitch = clamp(G.pitch - ly * Math.abs(ly) * s * 0.7 * iy, CAMERA.PITCH_MIN, CAMERA.PITCH_MAX);
  }
  pad.fire = play && btn(7); pad.run = play && btn(10);
  const aim = play && btn(6); if (aim !== pad.aim) { pad.aim = aim; G.aiming = aim; }
  if (G.state === 'terminal') { // analógico esquerdo como direcional (uma vez por inclinada)
    const x = ax(0), y = ax(1), d = Math.abs(y) > 0.6 ? (y > 0 ? 'ArrowDown' : 'ArrowUp') : Math.abs(x) > 0.6 ? (x > 0 ? 'ArrowRight' : 'ArrowLeft') : '';
    if (d && d !== stickDir) h.onKey(d); stickDir = d;
  } else stickDir = '';
  for (let i = 0; i < gp.buttons.length && i < 17; i++) {
    const now = btn(i), was = prev[i]; prev[i] = now;
    if (!now || was) continue;
    // borda de subida: traduz para as mesmas teclas do teclado
    if (G.state === 'terminal') { if (TERM_MAP[i]) h.onKey(TERM_MAP[i]); }
    else if (G.state === 'story') { if (i === 0) h.onKey('KeyE'); else if (i === 9) h.onKey('Enter'); }
    else if (G.state === 'pause') { if (i === 9 || i === 0) h.onKey('KeyP'); }
    else if (G.state === 'menu' || G.state === 'ended') { if (i === 0 || i === 9) h.onKey('Enter'); }
    else if (play) {
      if (i === 4) h.onWheel(-1); else if (i === 5) h.onWheel(1);
      else if (PLAY_MAP[i]) h.onKey(PLAY_MAP[i]);
    }
  }
}
