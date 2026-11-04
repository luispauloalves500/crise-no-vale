import test from 'node:test';
import assert from 'node:assert/strict';
import { canTriggerRevisit, scheduleRevisit, rearmPendingWarnings, REVISIT_WARNING_SECONDS } from '../js/revisit-encounters.mjs';
import { captureEncounterMemory, restoreEncounterMemory } from '../js/encounter-memory.mjs';
const encounter = { id:'lab-return', flag:'power', revisitFrom:'pantano', warning:'Sirene', spawn:[{type:'raptor',from:'E'},{type:'spitter',from:'N',delay:1}] };
const context = { from:'pantano', first:false, flags:{power:true}, fired:new Set() };
test('emboscada exige energia, direção de retorno e ID ainda não usado', () => {
  assert.equal(canTriggerRevisit(encounter, context), true);
  assert.equal(canTriggerRevisit(encounter, {...context, first:true}), false);
  assert.equal(canTriggerRevisit(encounter, {...context, from:'patio'}), false);
  assert.equal(canTriggerRevisit(encounter, {...context, flags:{power:false}}), false);
  assert.equal(canTriggerRevisit(encounter, {...context, fired:new Set(['lab-return'])}), false);
});
test('aviso e fila sobrevivem à saída; após aviso anterior há novo prazo seguro', () => {
  const queue = scheduleRevisit(encounter);
  assert.equal(queue[0].kind, 'revisit-cue');
  assert.ok(queue.slice(1).every(q => q.t >= REVISIT_WARNING_SECONDS));
  const memory = JSON.parse(JSON.stringify(captureEncounterMemory([], queue)));
  const restored = restoreEncounterMemory(memory, []);
  assert.equal(restored.pending.length, 3);
  assert.equal(rearmPendingWarnings(restored.pending).filter(q => q.kind === 'revisit-cue').length, 1);
  const afterWarning = queue.slice(1).map(q => ({...q, t:0.1}));
  const resumed = rearmPendingWarnings(afterWarning);
  assert.equal(resumed.filter(q => q.kind === 'revisit-cue').length, 1);
  assert.ok(resumed.filter(q => q.revisitId).every(q => q.t >= REVISIT_WARNING_SECONDS));
  assert.deepEqual(rearmPendingWarnings([]), []);
});

test('encontros reais mantêm IDs únicos, previsão e limite finito de inimigos', async () => {
  const { readFileSync } = await import('node:fs');
  const vm = await import('node:vm');
  const src = readFileSync(new URL('../js/areas.js', import.meta.url), 'utf8');
  const literal = src.slice(src.indexOf('export const AREAS = [') + 'export const AREAS = '.length, src.indexOf('\nexport const AREA ='));
  const areas = vm.runInNewContext(literal, { Math });
  const encounters = areas.flatMap(a => a.encounters.filter(e => e.revisitFrom).map(e => ({area:a.id,...e})));
  assert.equal(encounters.length, 2);
  assert.equal(new Set(encounters.map(e => e.id)).size, 2);
  for (const e of encounters) {
    assert.equal(e.flag, 'power'); assert.ok(e.warning); assert.ok(e.spawn.length > 0 && e.spawn.length <= 3);
    assert.ok(areas.find(a => a.id === e.area).doors.some(d => d.to === e.revisitFrom));
    const state = {from:e.revisitFrom, first:false, flags:{power:true}, fired:new Set()};
    assert.equal(canTriggerRevisit(e, state), true);
    const saved = JSON.parse(JSON.stringify({enc:[e.id]}));
    assert.equal(canTriggerRevisit(e, {...state, fired:new Set(saved.enc)}), false);
  }
});
