// settings.js — v6: ajustes do jogador (sensibilidade, inverter Y, volumes, movimento reduzido, controle).
// Persistidos em localStorage 'crise-no-vale-settings' e carregados no boot.
const KEY = 'crise-no-vale-settings';
const DEFAULTS = { sens: 1, invertY: false, master: 1, sfx: 1, amb: 1, reducedMotion: false, gamepad: true };
export const SETTINGS = { ...DEFAULTS };
const listeners = [];

export function loadSettings() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (s && typeof s === 'object') for (const k of Object.keys(DEFAULTS)) if (typeof s[k] === typeof DEFAULTS[k]) SETTINGS[k] = s[k];
  } catch (e) { /* armazenamento indisponível */ }
  SETTINGS.sens = Math.min(3, Math.max(0.2, SETTINGS.sens));
  for (const k of ['master', 'sfx', 'amb']) SETTINGS[k] = Math.min(1, Math.max(0, SETTINGS[k]));
  return SETTINGS;
}
export function saveSettings() { try { localStorage.setItem(KEY, JSON.stringify(SETTINGS)); } catch (e) { /* ignora */ } }
/** Altera um ajuste, salva e avisa os ouvintes (áudio, UI…). */
export function setSetting(k, v) {
  if (!(k in DEFAULTS)) return;
  SETTINGS[k] = v; saveSettings();
  for (const fn of listeners) fn(k, v);
}
export function onSettings(fn) { listeners.push(fn); }
export function resetSettings() { Object.assign(SETTINGS, DEFAULTS); saveSettings(); for (const fn of listeners) fn('*', null); }
/** Multiplicador de "movimento" (tremor, recuo da câmera) — reduzido para acessibilidade. */
export const motionK = () => (SETTINGS.reducedMotion ? 0.3 : 1);
