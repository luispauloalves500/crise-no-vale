// state.js — estado de execução compartilhado entre módulos (evita imports circulares).
export const G = {
  state: 'menu',      // menu | play | pause | over | win | ended
  area: 'porto',      // id da área atual
  saves: 0,           // vezes que salvou (entra no ranking)
  score: 0,
  kills: 0,
  shots: 0,
  hits: 0,
  elapsed: 0,
  time: 0,
  shake: 0,
  yaw: Math.PI,       // direção da câmera (o personagem olha para cá)
  pitch: -0.12,
  aiming: false,
  shoulder: 1,        // 1 = ombro direito, -1 = esquerdo
  combo: 0,
  comboT: 0,
  best: 0,
};

try { G.best = Number(localStorage.getItem('crise-no-vale-best')) || 0; } catch (e) { /* sem storage */ }
export function saveBest() {
  if (G.score > G.best) { G.best = G.score; try { localStorage.setItem('crise-no-vale-best', String(G.best)); } catch (e) { /* ignore */ } return true; }
  return false;
}

export const SAVE_KEY = 'crise-no-vale-save';
export function readSave() { try { const s = localStorage.getItem(SAVE_KEY); return s ? JSON.parse(s) : null; } catch (e) { return null; } }
export function writeSave(data) { try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); return true; } catch (e) { return false; } }
export function clearSave() { try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ } }
