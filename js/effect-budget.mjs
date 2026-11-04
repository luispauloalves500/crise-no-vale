/** Orçamento visual por chumbo; não participa do cálculo de acerto ou dano. */
export function showPelletVisual(index,total,qualityId) {
  if (total <= 1) return true;
  const step = qualityId === 'baixo' ? 3 : 2;
  return index % step === 0;
}
