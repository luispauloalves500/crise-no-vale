import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { validateDoorGraph, safeDoorArrival } from '../js/door-safety.mjs';

// Lê as definições efetivas de áreas sem iniciar renderer ou executar build().
const src = readFileSync(new URL('../js/areas.js', import.meta.url), 'utf8');
const literal = src.slice(src.indexOf('export const AREAS = [') + 'export const AREAS = '.length, src.indexOf('\nexport const AREA ='));
const areas = vm.runInNewContext(literal, { Math });
test('as nove áreas possuem conexões recíprocas sem IDs de porta repetidos', () => {
  assert.equal(areas.length, 9);
  assert.deepEqual(validateDoorGraph(areas), []);
  const broken = [{ id:'a', doors:[{id:'N',side:'N',to:'b',toDoor:'S'}] }, { id:'b', doors:[] }];
  assert.equal(validateDoorGraph(broken).length, 1);
});
test('todos os pontos nominais chegam dentro dos limites e olham para dentro', () => {
  for (const area of areas) for (const door of area.doors) {
    const p = safeDoorArrival({ ...area, ctx:{boxes:[], circles:[]} }, door.id, 0.5, 1.6);
    assert.ok(p, `${area.id}:${door.id}`);
    const b = area.bounds;
    assert.ok(p.x > b.minX && p.x < b.maxX && p.z > b.minZ && p.z < b.maxZ);
    assert.equal(p.yaw, { N:0, S:Math.PI, W:Math.PI/2, E:-Math.PI/2 }[door.side]);
  }
});
test('procura alternativa livre e recusa chegada completamente obstruída', () => {
  const a = { bounds:{minX:-10,maxX:10,minZ:-10,maxZ:10}, doors:[{id:'N',side:'N',at:0}], ctx:{boxes:[{minX:-0.4,maxX:0.4,minZ:-7,maxZ:-5}],circles:[]} };
  const p = safeDoorArrival(a, 'N', 0.5, 1.6); assert.ok(p); assert.notEqual(p.x, 0);
  a.ctx.boxes = [{minX:-10,maxX:10,minZ:-10,maxZ:10}];
  assert.equal(safeDoorArrival(a, 'N', 0.5, 1.6), null);
  assert.equal(safeDoorArrival(a, 'missing', 0.5, 1.6), null);
});
