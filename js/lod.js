// lod.js — v9: nível de detalhe por distância da câmera (sem THREE.LOD nem geometrias novas).
// Cada área marca seus objetos estáticos com userData.lod = 'small' | 'big' (veja lod() em world.js);
// collectLod() junta esses objetos uma vez por construção e updateLod() reavalia ~6 vezes por segundo:
//   nível 0 (< lodNear)        completo; castShadow conforme o tier de sombra da qualidade
//   nível 1 (lodNear → lodMid) visível, sem sombra
//   nível 2 (lodMid → lodFar)  miudezas ('small') somem; silhuetas ('big') ficam, sem sombra
//   nível 3 (> lodFar)         tudo que tem LOD some (nem cor nem sombra)
// As distâncias vêm da qualidade (PRESETS.lodNear/lodMid/lodFar) e encolhem em neblina densa:
// a FogExp2 já apagou o objeto antes de ele sumir, então não há "pop" visível.
// Os inimigos usam lodLevel() para cortar sombra/dentes/barra e espaçar a IA de quem está longe.
import { scene, camera, tierOn } from './world.js';
import { quality, onQuality } from './quality.js';

const HYST = 2;        // metros de histerese (evita piscar na fronteira)
const RATE = 1 / 6;    // ~6 Hz para os objetos de cenário
const D = { near: 28, mid: 50, far: 80 };     // distâncias efetivas (já com a neblina)
const near2 = [0, 0, 0];                       // limites ao quadrado por nível (0→1, 1→2, 2→3)
let cur = null, acc = 0, dirty = true;
const cam = { x: 0, z: 0 };
export const lodStats = { objects: 0, full: 0, noShadow: 0, hidden: 0, updates: 0, near: 0, mid: 0, far: 0 };

/** Recalcula as distâncias efetivas (qualidade + densidade atual da neblina). */
function refreshDist() {
  const p = quality.p, dens = (scene.fog && scene.fog.density) || 0;
  // exp2: 1,5/dens ≈ 10% de visibilidade; 2,1/dens ≈ 1% (invisível)
  const fogMid = dens > 0 ? 1.5 / dens : Infinity, fogFar = dens > 0 ? 2.1 / dens : Infinity;
  D.near = p.lodNear || 28;
  D.mid = Math.max(D.near + 6, Math.min(p.lodMid || 50, fogMid));
  D.far = Math.max(D.mid + 8, Math.min(p.lodFar || 80, fogFar));
  near2[0] = D.near; near2[1] = D.mid; near2[2] = D.far;
  lodStats.near = Math.round(D.near); lodStats.mid = Math.round(D.mid); lodStats.far = Math.round(D.far);
}

/** Nível (0..3) de um ponto, com histerese a partir do nível anterior (prev = -1 → sem histerese). */
function levelAt(d, prev) {
  let lv = d < near2[0] ? 0 : d < near2[1] ? 1 : d < near2[2] ? 2 : 3;
  if (prev >= 0 && lv !== prev) {
    // só troca se passou da fronteira por mais que HYST metros
    const edge = near2[Math.min(lv, prev)];
    if (Math.abs(d - edge) < HYST) lv = prev;
  }
  return lv;
}
/** Nível de LOD de um ponto do mundo em relação à câmera (usado pelos inimigos). */
export function lodLevel(x, z, prev = -1) { return levelAt(Math.hypot(x - cam.x, z - cam.z), prev); }

/**
 * Junta os objetos com userData.lod de uma área recém-construída (filhos diretos do grupo).
 * Como são estáticos, a matriz é calculada uma vez e matrixAutoUpdate desliga (menos trabalho por quadro).
 */
export function collectLod(ctx) {
  const list = [];
  for (const o of ctx.group.children) {
    const cls = o.userData.lod; if (!cls) continue;
    o.updateMatrix(); o.matrixAutoUpdate = false;
    list.push({ o, x: o.position.x, z: o.position.z, small: cls === 'small', tier: o.userData.shTier || null, cs0: o.castShadow, lv: -1 });
  }
  ctx.lod = list;
  if (ctx === cur) dirty = true;
  return list.length;
}

function apply(E, lv) {
  E.lv = lv;
  const o = E.o, vis = lv < 2 || (lv === 2 && !E.small);
  o.visible = vis;
  o.castShadow = vis && lv === 0 && (E.tier ? tierOn(E.tier) : E.cs0);
}

/** Força a reavaliação completa no próximo updateLod (troca de área ou de qualidade). */
export function forceLod() { dirty = true; }
onQuality(() => { dirty = true; for (const E of (cur && cur.lod) || []) E.lv = -1; });

/**
 * Chamado todo quadro pelo laço principal. Guarda a posição da câmera (barato) e, a ~6 Hz,
 * reavalia os objetos da área atual. ctx = contexto da área ativa (D.area.ctx).
 */
export function updateLod(dt, ctx) {
  cam.x = camera.position.x; cam.z = camera.position.z;
  if (ctx !== cur) { cur = ctx; dirty = true; if (ctx && ctx.lod) for (const E of ctx.lod) E.lv = -1; }
  acc += dt;
  if (!dirty && acc < RATE) return;
  acc = 0; dirty = false;
  if (!cur || !cur.lod) return;
  refreshDist();
  let f = 0, n = 0, h = 0;
  for (const E of cur.lod) {
    const lv = levelAt(Math.hypot(E.x - cam.x, E.z - cam.z), E.lv);
    if (lv !== E.lv) apply(E, lv);
    if (!E.o.visible) h++; else if (E.o.castShadow) f++; else n++;
  }
  lodStats.objects = cur.lod.length; lodStats.full = f; lodStats.noShadow = n; lodStats.hidden = h; lodStats.updates++;
}
