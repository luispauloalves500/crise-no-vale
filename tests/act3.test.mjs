// v11 — Ato 3 (Porto Anil): grafo, travas, registros e finais, sem renderer.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { validateDoorGraph } from '../js/door-safety.mjs';
const src = readFileSync(new URL('../js/areas.js', import.meta.url), 'utf8');
const areas = vm.runInNewContext(src.slice(src.indexOf('export const AREAS = [') + 'export const AREAS = '.length, src.indexOf('\nexport const AREA =')), { Math });
const story = readFileSync(new URL('../js/story.js', import.meta.url), 'utf8');
const logs = vm.runInNewContext('(' + story.slice(story.indexOf('export const LOGS = {') + 'export const LOGS = '.length, story.indexOf('\nexport const LOG_IDS =')).trim().replace(/;$/, '') + ')');
const dir = readFileSync(new URL('../js/director.js', import.meta.url), 'utf8');
const A = (id) => areas.find((a) => a.id === id);

test('Ato 3 fica no fim da lista (sementes antigas não mudam) e forma uma cadeia própria', () => {
  assert.deepEqual([...areas.slice(-3).map((a) => a.id)], ['portoanil', 'captacao', 'sede']);
  assert.deepEqual([...areas.slice(0, 9).map((a) => a.id)], ['porto', 'ruinas', 'lab', 'pantano', 'patio', 'heliponto', 'margem', 'acampamento', 'ninho']);
  assert.deepEqual(validateDoorGraph(areas), []);
  assert.ok(A('portoanil').doors.some((d) => d.to === 'captacao'));
  assert.ok(A('captacao').doors.some((d) => d.to === 'sede' && d.lock === 'valveLock'));
  assert.ok(A('sede').doors.some((d) => d.to === 'captacao' && d.lock === 'primLock'));
  for (const id of ['portoanil', 'captacao', 'sede']) for (const d of A(id).doors) assert.ok(['portoanil', 'captacao', 'sede'].includes(d.to), id);
});
test('travas do Ato 3 têm regra e mensagem no diretor', () => {
  assert.match(dir, /valveLock[^\n]*F\.valvesClosed/);
  assert.match(dir, /primLock[^\n]*F\.primFight/);
  assert.match(dir, /const SAVE_V = 6/);
});
test('registros 14–17 existem, estão nas áreas certas e os ids de pickups seguem únicos', () => {
  const want = { log14: 'portoanil', log15: 'captacao', log16: 'sede', log17: 'captacao' };
  for (const [id, area] of Object.entries(want)) {
    assert.equal(logs[id].area, area);
    assert.ok(A(area).logs.some((l) => l.id === id), id);
  }
  assert.equal(Object.keys(logs).length, 17);
  const pids = areas.flatMap((a) => a.pickups.map((p) => p.id));
  assert.equal(new Set(pids).size, pids.length);
});
test('chefe Primórdio e o encontro do núcleo', () => {
  const enc = A('sede').encounters.find((e) => e.boss);
  assert.ok(enc && enc.spawn.some((s) => s.type === 'primordio'));
  const cfg = readFileSync(new URL('../js/config.js', import.meta.url), 'utf8');
  assert.match(cfg, /primordio:\s*\{/);
});
test('quatro finais do Ato 3 (escolha × contaminação) e Ato 2 preservado', () => {
  const code = story.slice(story.indexOf('export function ending('), story.indexOf('export function logPages(')).replace('export function', 'function');
  const ending = vm.runInNewContext(code + '; ending', { S: { logs: new Set(), said: new Set() }, ACT1_LOGS: [] });
  const ids = new Set();
  for (const c of ['expose', 'destroy']) for (const d of [false, true]) ids.add(ending({ act2Win: true, act3Win: true, act3Choice: c, contaminated: d }).id);
  assert.equal(ids.size, 4);
  assert.equal(ending({ act2Win: true, brandt: 'caught', nestDestroyed: true }).id, 'raiz');
  assert.match(story, /ACT3_LOGS = \['log14', 'log15', 'log16', 'log17'\]/);
  assert.match(story, /if \(F\.act3Win\) return epilogueAct3\(F\)/);
});
