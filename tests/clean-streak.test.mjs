import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeStreak, recordKill, breakStreak, finishStreak } from '../js/clean-streak.mjs';
test('tabela e pagamento único por travessia', () => {
  for (const [kills, bonus] of [[0,0],[1,0],[2,10],[3,25],[4,25],[5,50],[7,50],[8,80]]) {
    const s = normalizeStreak({kills});
    assert.deepEqual(finishStreak(s), {kills, bonus});
    assert.equal(finishStreak(s).bonus, 0);
  }
});
test('golpe quebra sequência e save antigo ou inválido inicia vazio', () => {
  const s = normalizeStreak(); recordKill(s); recordKill(s); breakStreak(s);
  assert.equal(finishStreak(s).bonus, 0);
  assert.equal(normalizeStreak({kills:-1}).kills, 0);
  recordKill(s); assert.equal(normalizeStreak(JSON.parse(JSON.stringify(s))).kills, 1);
});
