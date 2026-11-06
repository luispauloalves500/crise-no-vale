// Pure animation policy, shared by runtime and regression tests.
import {canSpit} from './enemy-capabilities.mjs';
import {SPIT_RELEASE} from './spitter-action.mjs';
export const DINO_CLIPS = Object.freeze(['idle','walk','run','attack','hurt','death']);
export const dinoClips = kind => kind==='cuspidor' ? [...DINO_CLIPS,'spit'] : DINO_CLIPS;
export const dinoKind = cfg => canSpit(cfg) ? 'cuspidor' : cfg.boss || cfg.shape === 'brute' ? 'trex' : 'raptor';
export function dinoMotion(e, speed = 0) {
  if (e.dead) return { clip:'death', rate:1 };
  if (e.flashT > 0 || e.stun > 0) return { clip:'hurt', rate:1 };
  if (canSpit(e.cfg) && e.spitAction && !e.spitAction.cancelled && (e.spitT>0 || e.spitRelease)) return {clip:'spit',rate:0,time:e.spitRelease?SPIT_RELEASE:e.spitAction.time};
  if (e.bite > 0 || e.spitT > 0 || e.stomp > 0 || e.windup > 0) return { clip:'attack', rate:e.bite > 0 ? 2 : 1 };
  if (speed < .12) return { clip:'idle', rate:1 };
  const run = speed > e.cfg.speed * .65;
  return { clip:run?'run':'walk', rate:Math.max(.35,Math.min(2.5,speed / ((run?3.8:1.5)*e.cfg.scale))) };
}
