// post.js — pós-processamento opcional (bloom). Carregado sob demanda dos "addons" do próprio Three.js r160
// (mesma CDN, sem pacote novo). Se falhar ou o FPS cair, volta ao render direto. Tecla B liga/desliga.
import * as THREE from 'three';

const PREF = 'crise-no-vale-bloom';
export const post = { on: false, ready: false, failed: false, composer: null, bloom: null, slowT: 0, onAuto: null };
let pref = true;
try { const v = localStorage.getItem(PREF); if (v !== null) pref = v === '1'; } catch (e) { /* sem storage */ }

export async function initPost(renderer, scene, camera) {
  try {
    const base = 'three/addons/postprocessing/';
    const [{ EffectComposer }, { RenderPass }, { UnrealBloomPass }, { OutputPass }] = await Promise.all([
      import(base + 'EffectComposer.js'), import(base + 'RenderPass.js'), import(base + 'UnrealBloomPass.js'), import(base + 'OutputPass.js'),
    ]);
    const c = new EffectComposer(renderer);
    c.addPass(new RenderPass(scene, camera));
    const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth / 2, innerHeight / 2), 0.5, 0.45, 0.85);
    c.addPass(bloom); c.addPass(new OutputPass());
    c.setSize(innerWidth, innerHeight);
    addEventListener('resize', () => c.setSize(innerWidth, innerHeight));
    Object.assign(post, { composer: c, bloom, ready: true, on: pref });
  } catch (e) { post.failed = true; post.on = false; console.warn('Bloom indisponível:', e && e.message); }
}
/** Liga/desliga; devolve o novo estado (ou null se indisponível). */
export function toggleBloom() {
  if (!post.ready) return null;
  post.on = !post.on; post.slowT = 0;
  try { localStorage.setItem(PREF, post.on ? '1' : '0'); } catch (e) { /* ignore */ }
  return post.on;
}
export function render(renderer, scene, camera, dt) {
  if (post.on && post.composer) {
    // FPS baixo por 4 s seguidos: desliga sozinho (sem gravar a preferência)
    post.slowT = dt > 1 / 28 ? post.slowT + dt : Math.max(0, post.slowT - dt * 2);
    if (post.slowT > 4) { post.on = false; if (post.onAuto) post.onAuto(); }
    else { post.composer.render(dt); return; }
  }
  renderer.render(scene, camera);
}
