// Emboscadas de retorno usam IDs permanentes e aviso antes das aparições.
export const REVISIT_WARNING_SECONDS = 3;
export function canTriggerRevisit(encounter, { from, first, flags, fired }) {
  return !!encounter.revisitFrom && !first && from === encounter.revisitFrom &&
    (!encounter.flag || !!flags[encounter.flag]) && !fired.has(encounter.id);
}
export function scheduleRevisit(encounter) {
  return [
    { kind: 'revisit-cue', encounterId: encounter.id, message: encounter.warning, t: 0 },
    ...encounter.spawn.map(s => ({ ...s, t: REVISIT_WARNING_SECONDS + (s.delay || 0), revisitId: encounter.id, warning: encounter.warning })),
  ];
}
export function rearmPendingWarnings(queue) {
  const result = queue.map(q => ({ ...q }));
  const ids = new Set(result.filter(q => q.revisitId).map(q => q.revisitId));
  for (const id of ids) {
    if (result.some(q => q.kind === 'revisit-cue' && q.encounterId === id)) continue;
    const remaining = result.filter(q => q.revisitId === id);
    for (const q of remaining) q.t = Math.max(REVISIT_WARNING_SECONDS, q.t);
    result.push({ kind: 'revisit-cue', encounterId: id, message: remaining[0].warning || 'Rugidos à distância — algo se aproxima!', t: 0 });
  }
  return result;
}
