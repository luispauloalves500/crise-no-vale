// Percepção testável dos dinossauros, sem dependências de Three.js.
export const AI_MEMORY_SECONDS = 5.5;
export const AI_INVESTIGATE_SECONDS = 8;
export function sufferedNewHit(lastHp, currentHp) {
  return Number.isFinite(lastHp) && Number.isFinite(currentHp) && currentHp < lastHp;
}
export function canHearNoise(distance, radius, obstructed = false) {
  return Number.isFinite(distance) && distance >= 0 && Number.isFinite(radius) &&
    distance <= radius * (obstructed ? 0.6 : 1);
}
export function canSeeTarget(distance, facingDot, radius, obstructed = false, onAlert = false) {
  return Number.isFinite(distance) && distance >= 0 && Number.isFinite(radius) &&
    distance < radius && !obstructed && (onAlert || distance < 3.5 || facingDot > 0.05);
}
