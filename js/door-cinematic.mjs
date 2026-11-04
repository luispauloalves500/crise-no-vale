// Cronologia sem dependência de renderizador: abertura, travessia e fechamento.
export const DOOR_TIMING = Object.freeze({ open: 0.9, walkEnd: 2.6, closeEnd: 3.5, fade: 0.4 });
const clamp01 = n => Math.max(0, Math.min(1, n));
const smooth = n => { const t = clamp01(n); return t * t * (3 - 2 * t); };
export function doorPose(t, ready) {
  const {open, walkEnd, closeEnd, fade} = DOOR_TIMING;
  return {
    gate: t < open ? smooth(t / open) : t < walkEnd ? 1 : 1 - smooth((t - walkEnd) / (closeEnd - walkEnd)),
    travel: smooth((t - open) / (walkEnd - open)),
    moving: t >= open && t < walkEnd,
    fade: ready ? clamp01((t - closeEnd) / fade) : 0,
    switchArea: !!ready && t >= closeEnd + fade,
  };
}
export function doorVectors(side) {
  return ({ N:{x:0,z:-1,yaw:Math.PI}, S:{x:0,z:1,yaw:0}, W:{x:-1,z:0,yaw:-Math.PI/2}, E:{x:1,z:0,yaw:Math.PI/2} })[side] || null;
}

// A folha só ocupa a visão fora da cena quando existe bloqueio narrativo.
export const gateVisible = (locked, transitioning = false) => !!locked || !!transitioning;
