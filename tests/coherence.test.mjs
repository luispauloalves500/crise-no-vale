import test from 'node:test';
import assert from 'node:assert/strict';
import { canHearNoise, canSeeTarget, sufferedNewHit } from '../js/perception.mjs';
import { captureEncounterMemory, restoreEncounterMemory } from '../js/encounter-memory.mjs';

test('som audível em espaço aberto; paredes abafam ruídos distantes', () => {
  assert.equal(canHearNoise(12, 15, false), true);
  assert.equal(canHearNoise(12, 15, true), false);
  assert.equal(canHearNoise(3, 15, true), true);
  assert.equal(canHearNoise(19, 15, false), false);
});
test('ferimento antigo não reinicia perseguição; novo tiro provoca reação', () => {
  assert.equal(sufferedNewHit(55, 30), true);
  assert.equal(sufferedNewHit(30, 30), false);
  assert.equal(sufferedNewHit(30, 55), false);
});
test('visão precisa de ângulo/linha de visão; inimigo alerta vê perifericamente', () => {
  assert.equal(canSeeTarget(10, 0.8, 16, false), true);
  assert.equal(canSeeTarget(10, -0.9, 16, false), false);
  assert.equal(canSeeTarget(10, -0.9, 16, false, true), true);
  assert.equal(canSeeTarget(10, 0.8, 16, true, true), false);
  assert.equal(canSeeTarget(3, -1, 16, false), true);
});
test('captura sobreviventes feridos e agendamentos, não revive mortos', () => {
  const alive = { type:'raptor', cfg:{}, pos:{x:3,z:5}, home:{x:0,z:0}, hp:21, yaw:1.1,
    alert:true, alertT:4, lastSeen:{x:9,z:9}, ambientIdx:0, investigate:null };
  const dead = { ...alive, dead:true, type:'spitter' };
  const scripted = { ...alive, type:'brute', ambientIdx:undefined, hp:100, pos:{x:-4,z:2} };
  const mem = captureEncounterMemory([alive,dead,scripted],
    [{type:'raptor',from:'N',t:2},{type:'raptor',from:'W',t:1,eventKind:'gen'}]);
  assert.equal(mem.living.length, 2);
  assert.equal(mem.living[0].hp, 21);
  assert.equal(mem.pending.length, 1);
  assert.equal(mem.pending[0].from, 'N');
  const restored = restoreEncounterMemory(mem, [{type:'raptor',x:0,z:0}]);
  assert.equal(restored.living.length, 2);
  assert.equal(restored.living[0].lastSeen.x, 9);
  assert.equal(restored.living[1].type, 'brute');
});
test('área limpa permanece limpa e saves antigos restauram apenas patrulhas não abatidas', () => {
  assert.deepEqual(restoreEncounterMemory({living:[],dead:[]},[{type:'raptor',x:0,z:1}]).living, []);
  const restored = restoreEncounterMemory({visited:true,dead:[0]},[
    {type:'raptor',x:1,z:2},{type:'spitter',x:3,z:4}]);
  assert.equal(restored.living.length, 1);
  assert.equal(restored.living[0].ambientIdx, 1);
  assert.equal(restored.living[0].type, 'spitter');
});
test('posição, alerta e dano sobrevivem a reentradas sem compartilhar objeto mutável', () => {
  const mem = captureEncounterMemory([{
    type:'spitter',pos:{x:2,z:7},home:{x:0,z:0},hp:8,
    alert:false,investigate:{x:8,z:9,t:5}, lastSeen:{x:0,z:0},phaseIdx:0,
  }],[]);
  const a = restoreEncounterMemory(mem,[]);
  a.living[0].x=999;
  const b = restoreEncounterMemory(mem,[]);
  assert.equal(b.living[0].x,2);
  assert.equal(b.living[0].investigate.t,5);
});
