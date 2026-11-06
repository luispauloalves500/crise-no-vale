// Pure animation policy, shared by runtime and regression tests.
export const DINO_CLIPS = Object.freeze(['idle','walk','run','attack','hurt','death']);
export const dinoKind = cfg => cfg.boss || cfg.shape === 'brute' ? 'trex' : 'raptor';
export function dinoMotion(e, speed = 0) {
  if (e.dead) return { clip:'death', rate:1 };
  if (e.flashT > 0 || e.stun > 0) return { clip:'hurt', rate:1 };
  if (e.bite > 0 || e.spitT > 0 || e.stomp > 0 || e.windup > 0) return { clip:'attack', rate:e.bite > 0 ? 2 : 1 };
  if (speed < .12) return { clip:'idle', rate:1 };
  const run = speed > e.cfg.speed * .65;
  return { clip:run?'run':'walk', rate:Math.max(.35,Math.min(2.5,speed / ((run?3.8:1.5)*e.cfg.scale))) };
}
