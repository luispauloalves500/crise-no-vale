// idle.js — fila de tarefas pesadas executadas UMA por fatia ociosa (requestIdleCallback; fallback rAF).
// Usado para construir áreas em segundo plano sem travar vários quadros seguidos.
const queue = [];
let pending = false;
const ric = typeof window !== 'undefined' && window.requestIdleCallback ? window.requestIdleCallback.bind(window) : null;

function pump() {
  if (pending || !queue.length) return;
  pending = true;
  const run = () => {
    pending = false;
    const job = queue.shift();
    if (job) { try { job.fn(); } catch (e) { console.error('tarefa em segundo plano falhou:', e); } }
    pump();
  };
  // timeout: garante progresso mesmo se o navegador nunca ficar ocioso (ex.: aba em segundo plano)
  if (ric) ric(run, { timeout: 600 });
  else requestAnimationFrame(() => setTimeout(run, 0));
}
/** Agenda fn para uma fatia ociosa. key evita duplicatas na fila. */
export function idle(fn, key) {
  if (key && queue.some((j) => j.key === key)) return;
  queue.push({ fn, key }); pump();
}
export const idleBusy = () => pending || queue.length > 0;
/** Promessa resolvida no próximo quadro (deixa a tela de carga redesenhar). */
export const nextFrame = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
