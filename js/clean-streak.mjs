// Sequência de abates desde o último golpe ou travessia concluída.
export function normalizeStreak(value) {
  return { kills: Number.isSafeInteger(value?.kills) && value.kills > 0 ? value.kills : 0 };
}
export function recordKill(streak) { streak.kills++; }
export function breakStreak(streak) { streak.kills = 0; }
export function finishStreak(streak) {
  const kills = streak.kills;
  const bonus = kills >= 8 ? 80 : kills >= 5 ? 50 : kills >= 3 ? 25 : kills >= 2 ? 10 : 0;
  streak.kills = 0;
  return { kills, bonus };
}
