// state.js — estado de execução compartilhado entre módulos (evita imports circulares).
export const G = {
  state: 'menu',
  hitstop: 0,         // v6: congelamento breve (s) em crítico/abate
  hitstopCd: 0,      // menu | play | pause | story | terminal | over | win | ended
  area: 'porto',      // id da área atual
  saves: 0,           // vezes que salvou (entra no ranking)
  score: 0,           // pontos de ranking (nunca gastos)
  ep: 0,              // v10: Pontos de Extinção — moeda da loja dos terminais
  epTotal: 0,         // v10: PE ganho na campanha inteira (estatística)
  dmgTaken: 0,        // v10: dano total recebido (bônus "sem dano")
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

/** v10: credita Pontos de Extinção (arredonda; nunca negativo). */
export function addEp(n) { n = Math.max(0, Math.round(n)); G.ep += n; G.epTotal += n; return n; }

export const SAVE_KEY = 'crise-no-vale-save';
export function readSave() { try { const s = localStorage.getItem(SAVE_KEY); return s ? JSON.parse(s) : null; } catch (e) { return null; } }
export function writeSave(data) { try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); return true; } catch (e) { return false; } }
export function clearSave() { try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ } }
