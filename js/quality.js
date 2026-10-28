// quality.js — predefinições de qualidade gráfica (Baixo / Médio / Alto / Auto), salvas no localStorage.
// O módulo só guarda a escolha e avisa os ouvintes; quem aplica cada item é world.js / post.js / areas.js.
const KEY = 'crise-no-vale-quality';

/**
 * shadowSize      resolução do mapa de sombra da lua (única luz que projeta sombra)
 * softShadows     PCFSoft (true) ou BasicShadowMap (false)
 * pixelRatio      teto do devicePixelRatio
 * rain/fireflies  partículas ativas (os buffers são alocados no máximo e cortados com drawRange)
 * bloom           bloom ligado por padrão (a tecla B continua valendo)
 * groundTex       resolução da textura procedural do chão
 * lamps/spots     luzes reais ativas do pool fixo (6 pontuais + 2 holofotes)
 * lampDist        multiplicador do alcance das lâmpadas
 * shadowFar       árvores do anel externo / pedras distantes projetam sombra
 * shadowSmall     entulho e pequenos objetos projetam sombra
 * shadowMid       postes, equipamentos de telhado, terminais e pilares projetam sombra
 * stream          descarrega áreas que não são a atual nem vizinhas
 */
export const PRESETS = {
  baixo: { id: 'baixo', label: 'Baixo', shadowSize: 512, softShadows: false, pixelRatio: 1.0, rain: 250, fireflies: 40, bloom: false, groundTex: 256, lamps: 4, spots: 1, lampDist: 0.75, shadowFar: false, shadowSmall: false, shadowMid: false, stream: true },
  medio: { id: 'medio', label: 'Médio', shadowSize: 1024, softShadows: true, pixelRatio: 1.25, rain: 500, fireflies: 80, bloom: true, groundTex: 512, lamps: 6, spots: 2, lampDist: 1, shadowFar: false, shadowSmall: false, shadowMid: true, stream: true },
  alto: { id: 'alto', label: 'Alto', shadowSize: 2048, softShadows: true, pixelRatio: 1.75, rain: 900, fireflies: 140, bloom: true, groundTex: 512, lamps: 6, spots: 2, lampDist: 1, shadowFar: true, shadowSmall: true, shadowMid: true, stream: false },
};
export const MODES = ['auto', 'baixo', 'medio', 'alto'];
export const MODE_LABEL = { auto: 'Auto', baixo: 'Baixo', medio: 'Médio', alto: 'Alto' };
const ORDER = ['baixo', 'medio', 'alto'];

/** Nome da GPU (quando o navegador expõe), via um contexto WebGL descartável. */
let gpuCache = null;
function gpuName() {
  if (gpuCache !== null) return gpuCache;
  gpuCache = '';
  try {
    const gl = document.createElement('canvas').getContext('webgl');
    if (!gl) return (gpuCache = 'software');
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const name = String(gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER) || '');
    const lose = gl.getExtension('WEBGL_lose_context'); if (lose) lose.loseContext();
    return (gpuCache = name);
  } catch (e) { return ''; }
}
/** Palpite inicial do modo Auto (sem medir nada ainda): memória, núcleos, celular e tamanho de tela. */
export function guessPreset() {
  const nav = typeof navigator !== 'undefined' ? navigator : {};
  const mem = nav.deviceMemory || 8, cores = nav.hardwareConcurrency || 4;
  const mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(nav.userAgent || '');
  const px = (typeof screen !== 'undefined' ? screen.width * screen.height : 1920 * 1080) * Math.min(2, (typeof devicePixelRatio !== 'undefined' ? devicePixelRatio : 1)) ** 2;
  const gpu = gpuName();
  if (mobile || mem <= 2 || cores <= 2 || /swiftshader|llvmpipe|software|basic render/i.test(gpu)) return 'baixo';
  const integrated = /intel|uhd|iris|mali|adreno|powervr|apple gpu/i.test(gpu);
  if (!integrated && mem >= 8 && cores >= 8 && px <= 2560 * 1600 * 1.2) return 'alto';
  return 'medio';
}

let stored = null;
try { stored = localStorage.getItem(KEY); } catch (e) { /* sem storage */ }
const first = !MODES.includes(stored);
export const quality = {
  mode: first ? 'auto' : stored,   // escolha do jogador
  id: 'medio',                     // predefinição efetiva
  firstRun: first,
  autoDowngrades: 0,
  get p() { return PRESETS[this.id]; },
};
quality.id = quality.mode === 'auto' ? guessPreset() : quality.mode;

const listeners = [];
/** fn(preset, reason) — chamado a cada troca efetiva. */
export function onQuality(fn) { listeners.push(fn); }
function emit(reason) { for (const fn of listeners) { try { fn(quality.p, reason); } catch (e) { console.warn('qualidade:', e); } } }

/** Troca o modo escolhido pelo jogador ('auto' | 'baixo' | 'medio' | 'alto') e salva. */
export function setQualityMode(mode) {
  if (!MODES.includes(mode)) return;
  quality.mode = mode; quality.firstRun = false; quality.autoDowngrades = 0; slowT = 0; coolT = 0;
  try { localStorage.setItem(KEY, mode); } catch (e) { /* ignore */ }
  const id = mode === 'auto' ? guessPreset() : mode;
  quality.id = id; emit('user');
}
/** Reaplica a predefinição atual (usado na inicialização). */
export function applyQualityNow() { emit('init'); }

// ---------- modo Auto: desce um nível se o FPS ficar baixo por um tempo ----------
let slowT = 0, coolT = 0;
/** Chamar a cada quadro em jogo. Retorna true se rebaixou. */
export function autoQualityTick(dt, rawDt) {
  if (quality.mode !== 'auto') return false;
  if (coolT > 0) { coolT -= dt; return false; }
  // rawDt: delta real (sem o teto de 0,05) — abaixo de ~36 FPS conta como lento
  slowT = rawDt > 1 / 36 ? slowT + dt : Math.max(0, slowT - dt * 0.5);
  if (slowT > 6) {
    slowT = 0; coolT = 20;
    const i = ORDER.indexOf(quality.id);
    if (i > 0) { quality.id = ORDER[i - 1]; quality.autoDowngrades++; emit('auto'); return true; }
  }
  return false;
}
