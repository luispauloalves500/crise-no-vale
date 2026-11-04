// Estado leve dos inimigos entre trocas de área e saves (sem objetos Three.js).
const validPoint = (p) => p && Number.isFinite(p.x) && Number.isFinite(p.z);
const validLiving = (e) => e && typeof e.type === 'string' && validPoint(e.pos || e);
const validPending = (q) => q && (typeof q.type === 'string' || (q.kind === 'revisit-cue' && typeof q.encounterId === 'string')) && Number.isFinite(q.t ?? 0);
const copyPoint = (p) => validPoint(p) ? { x: p.x, z: p.z } : null;

export function captureEncounterMemory(enemies = [], queue = []) {
  return {
    living: enemies.filter((e) => !e.dead && !e.remove && validLiving(e)).map((e) => ({
      type: e.type, x: e.pos.x, z: e.pos.z, yaw: e.yaw,
      hp: e.hp, ambientIdx: Number.isInteger(e.ambientIdx) ? e.ambientIdx : null,
      home: copyPoint(e.home), alert: !!e.alert,
      alertT: Number.isFinite(e.alertT) ? e.alertT : 0,
      lastSeen: copyPoint(e.lastSeen), investigate: e.investigate && validPoint(e.investigate) ?
        { x: e.investigate.x, z: e.investigate.z, t: Math.max(0, e.investigate.t || 0) } : null,
      phaseIdx: Number.isInteger(e.phaseIdx) ? e.phaseIdx : 0,
    })),
    // Ondas ligadas a um evento cancelável (gerador / hack / resgate) não continuam após deixar a área.
    pending: queue.filter((q) => validPending(q) && !q.eventKind).map((q) => ({ ...q })),
  };
}
export function restoreEncounterMemory(state = {}, ambient = []) {
  const living = Array.isArray(state.living)
    ? state.living.filter(validLiving).map((e) => ({ ...e }))
    : ambient.flatMap((e, index) => (state.dead || []).includes(index) ? [] :
      [{ type: e.type, x: e.x, z: e.z, ambientIdx: index, alert: false }]);
  const pending = Array.isArray(state.pending)
    ? state.pending.filter((q) => validPending(q) && !q.eventKind).map((q) => ({ ...q })) : [];
  return { living, pending };
}
