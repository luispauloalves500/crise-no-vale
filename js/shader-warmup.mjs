// O desenho direto e o bloom usam variantes diferentes de cor e tone mapping.
// compileAsync inicia a compilação sincronamente: restaura o alvo ANTES de aguardar
// a GPU, para o loop continuar desenhando normalmente durante a preparação.
export async function compileShaderVariants(renderer, group, camera, scene, bloomTarget = null) {
  if (!renderer.compileAsync) return false;
  for (const target of bloomTarget ? [null, bloomTarget] : [null]) {
    const previous = renderer.getRenderTarget();
    const face = renderer.getActiveCubeFace(), level = renderer.getActiveMipmapLevel();
    let pending;
    try {
      renderer.setRenderTarget(target);
      pending = renderer.compileAsync(group, camera, scene);
    } finally {
      renderer.setRenderTarget(previous, face, level);
    }
    await pending;
  }
  return true;
}

// Uma compilação por vez; mesma área/contexto/qualidade compartilha a promessa.
export function createShaderWarmup(compile) {
  let epoch = 0, tail = Promise.resolve();
  const entries = new WeakMap(), busy = new WeakMap();
  function request(area) {
    const ctx = area?.ctx;
    if (!ctx) return Promise.resolve(false);
    const current = entries.get(area);
    if (current && current.ctx === ctx && current.epoch === epoch) return current.promise;
    const entry = {ctx, epoch, pending:true, promise:null};
    busy.set(area, (busy.get(area) || 0) + 1);
    const work = tail.catch(() => {}).then(async () => {
      if (area.ctx !== ctx || entry.epoch !== epoch) return false;
      try { return (await compile(ctx.group)) !== false; }
      catch (error) { console.warn('Preparação de shaders indisponível:', error); return false; }
    });
    entry.promise = work.then(result => {
      if (!result && entries.get(area) === entry) entries.delete(area);
      return result;
    }).finally(() => { entry.pending = false; busy.set(area, Math.max(0, (busy.get(area) || 1) - 1)); });
    tail = entry.promise; entries.set(area, entry);
    return entry.promise;
  }
  return { request, invalidate() { epoch++; }, isBusy(area) { return (busy.get(area) || 0) > 0; } };
}
