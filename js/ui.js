// ui.js — HUD, menus, radar e textos em português.
import * as THREE from 'three';
import { $, wrapAngle } from './utils.js';
import { G } from './state.js';
import { ENEMY_TYPES, PLAYER, COMBO } from './config.js';

// ---------- textos (PT-BR) ----------
export const STR = {
  start: 'COMEÇAR',
  wave: (n) => `ONDA ${n}`,
  waveClear: 'ÁREA LIMPA',
  waveClearSub: (n) => `Onda ${n} concluída — prepare-se...`,
  nextIn: (s) => `Próxima onda em ${s}`,
  winTitle: 'VOCÊ SOBREVIVEU',
  winBanner: 'Você sobreviveu ao vale!',
  loseTitle: 'VOCÊ FOI DEVORADO',
  status: [['ESTÁVEL', '#4c4'], ['CUIDADO', '#ec4'], ['PERIGO', '#f44']],
  reloading: 'RECARREGANDO...',
  pressR: 'PRESSIONE R',
  noAmmo: 'SEM MUNIÇÃO',
  noShells: 'Sem cartuchos! Troque para a pistola (1)',
  med: (n) => `+${n} Vida (Kit Médico)`,
  ammo: (n) => `+${n} Cartuchos de escopeta`,
  ammoFull: 'Cartuchos no máximo',
  hpFull: 'Vida cheia',
  incoming: (name, dir) => `${name.toUpperCase()} se aproximando pelo ${dir}`,
  dirs: ['NORTE', 'NORDESTE', 'LESTE', 'SUDESTE', 'SUL', 'SUDOESTE', 'OESTE', 'NOROESTE'],
  combo: (n) => `x${n}`,
  muted: (m) => (m ? 'Som desligado' : 'Som ligado'),
  shoulder: (s) => (s > 0 ? 'Câmera: ombro direito' : 'Câmera: ombro esquerdo'),
  best: (n) => (n > 0 ? `Recorde: ${n} pontos` : ''),
  newBest: 'NOVO RECORDE!',
  lockHint: 'Clique na tela para travar o mouse',
};

/** Direção cardeal de um ponto (x,z) visto do centro. Norte = -Z. */
export function cardinal(x, z) {
  const a = Math.atan2(x, -z); // 0 = norte, cresce no sentido horário (leste = +X)
  const i = Math.round(((a + Math.PI * 2) % (Math.PI * 2)) / (Math.PI / 4)) % 8;
  return STR.dirs[i];
}

// ---------- elementos ----------
const el = {};
['hud', 'menu', 'pause', 'end', 'startBtn', 'restartBtn', 'resumeBtn', 'quitBtn', 'loadErr', 'best', 'hpnum', 'hpfill', 'hpghost', 'status',
  'wname', 'ammo', 'pips', 'reloadFill', 'reloadTxt', 'wave', 'enemies', 'score', 'combo', 'cross', 'hitmark', 'dmgDir', 'floaters',
  'banner', 'bTitle', 'bSub', 'announce', 'countdown', 'feed', 'vign', 'flashScreen', 'endTitle', 'endText', 'radar'].forEach((id) => { el[id] = $(id); });
export { el };

export function initUI() {
  el.loadErr.remove();
  el.startBtn.disabled = false; el.startBtn.textContent = STR.start;
  el.best.textContent = STR.best(G.best);
}

// ---------- telas ----------
export function showScreen(name) {
  el.menu.classList.toggle('hidden', name !== 'menu');
  el.pause.classList.toggle('hidden', name !== 'pause');
  el.end.classList.toggle('hidden', name !== 'end');
  el.hud.classList.toggle('on', name === 'hud' || name === 'pause');
  if (name === 'menu') el.best.textContent = STR.best(G.best);
}
export function showEnd(win, stats, newBest) {
  el.endTitle.textContent = win ? STR.winTitle : STR.loseTitle;
  el.endTitle.style.color = win ? '#cfe9a8' : '#ff7a6a';
  const m = Math.floor(stats.elapsed / 60), s = Math.floor(stats.elapsed % 60);
  el.endText.innerHTML =
    `Pontos: <b>${stats.score}</b>${newBest ? ` <span style="color:#ffd060">— ${STR.newBest}</span>` : ''}<br>` +
    `Ondas concluídas: <b>${stats.waves}/${stats.total}</b><br>` +
    `Dinossauros abatidos: <b>${stats.kills}</b><br>` +
    `Precisão: <b>${stats.acc}%</b> • Tempo: <b>${m}:${String(s).padStart(2, '0')}</b>`;
  showScreen('end');
}

// ---------- mensagens ----------
let feedT = 0, bannerT = 0, cdT = 0;
export function feed(msg, col = '#bfffaf') { el.feed.innerHTML = `<span style="color:${col}">${msg}</span>`; feedT = 1.8; el.feed.style.opacity = 1; }
export function banner(t, s = '', dur = 2.6) { el.bTitle.textContent = t; el.bSub.textContent = s; el.banner.style.opacity = 1; bannerT = dur; }
export function announce(msg, col = '#ffb0a0') {
  const d = document.createElement('div'); d.textContent = msg; d.style.color = col;
  el.announce.appendChild(d);
  while (el.announce.children.length > 3) el.announce.firstChild.remove();
  setTimeout(() => d.remove(), 2600);
}
export function countdown(n) { el.countdown.textContent = n; el.countdown.style.opacity = 1; cdT = 0.8; }
export function clearMessages() {
  el.announce.innerHTML = ''; el.banner.style.opacity = 0; el.feed.style.opacity = 0; el.countdown.style.opacity = 0;
  bannerT = feedT = cdT = 0;
}

// ---------- feedback de combate ----------
let hitT = 0, dirT = 0, spread = 0, vignHit = 0, flashT = 0;
export function hitMarker(kill) { hitT = kill ? 0.3 : 0.15; el.hitmark.classList.toggle('kill', !!kill); }
export function kickCrosshair(px) { spread = Math.min(40, spread + px); }
export function setCrossEnemy(on) { el.cross.classList.toggle('enemy', on); }
/** Ângulo do atacante relativo ao para-frente da câmera (0 = à frente). */
export function damageFrom(relAngle) { el.dmgDir.style.transform = `rotate(${-relAngle}rad)`; el.dmgDir.style.transition = 'none'; el.dmgDir.style.opacity = 1; dirT = 0.6; }
export function hurtFlash() { vignHit = 0.2; }
export function lightningFlash(v) { flashT = v; }

// números de dano flutuantes (pool de divs, projetados do mundo para a tela)
const FL = 28; const floaters = [];
for (let i = 0; i < FL; i++) { const d = document.createElement('div'); d.className = 'fl'; d.style.display = 'none'; el.floaters.appendChild(d); floaters.push({ d, p: new THREE.Vector3(), life: 0, vy: 0 }); }
let flI = 0;
const _v = new THREE.Vector3();
export function floater(text, x, y, z, cls = '') {
  const f = floaters[flI]; flI = (flI + 1) % FL;
  f.d.textContent = text; f.d.className = 'fl ' + cls; f.d.style.display = 'block';
  f.p.set(x + (Math.random() - 0.5) * 0.4, y, z + (Math.random() - 0.5) * 0.4); f.life = cls === 'kill' ? 1.1 : 0.7; f.vy = 1.6;
}
function updateFloaters(dt, camera) {
  const w = innerWidth, h = innerHeight;
  for (const f of floaters) {
    if (f.life <= 0) continue;
    f.life -= dt; f.p.y += f.vy * dt;
    if (f.life <= 0) { f.d.style.display = 'none'; continue; }
    _v.copy(f.p).project(camera);
    if (_v.z > 1) { f.d.style.display = 'none'; continue; }
    f.d.style.display = 'block';
    f.d.style.left = ((_v.x + 1) / 2 * w) + 'px'; f.d.style.top = ((1 - _v.y) / 2 * h) + 'px';
    f.d.style.opacity = Math.min(1, f.life * 3);
  }
}
export function clearFloaters() { for (const f of floaters) { f.life = 0; f.d.style.display = 'none'; } }

// ---------- HUD por frame ----------
let ghostW = 100;
/**
 * @param {number} dt
 * @param {object} d  dados do jogo: player, weapon, reloading, reloadTotal, wavesTotal, enemiesLeft, intermission, enemies, pickups, boxes, camera, lightning
 */
export function updateHUD(dt, d) {
  updateFloaters(dt, d.camera);
  flashT = Math.max(flashT, d.lightning * 0.35);
  el.flashScreen.style.opacity = flashT.toFixed(3); flashT = Math.max(0, flashT - dt * 2);
  if (G.state === 'menu') return;

  const hp = Math.ceil(d.player.hp);
  el.hpnum.textContent = hp; el.hpfill.style.width = hp + '%';
  if (hp < ghostW) { ghostW = Math.max(hp, ghostW - dt * 40); } else ghostW = hp;
  el.hpghost.style.width = ghostW + '%';
  const st = hp > 60 ? STR.status[0] : hp > 25 ? STR.status[1] : STR.status[2];
  el.hpfill.style.background = st[1]; el.status.textContent = st[0]; el.status.style.color = st[1];
  el.status.style.opacity = st === STR.status[2] ? 0.5 + 0.5 * Math.sin(G.time * 8) : 1;

  const w = d.weapon;
  el.wname.textContent = w.name;
  el.ammo.innerHTML = `${w.mag} <small>/ ${w.res === Infinity ? '∞' : w.res}</small>`;
  el.ammo.style.color = w.mag === 0 ? '#f66' : '#fff';
  const pipKey = w.id + w.mag;
  if (el.pips.dataset.k !== pipKey) {
    el.pips.dataset.k = pipKey;
    el.pips.innerHTML = Array.from({ length: w.size }, (_, i) => `<i class="${i < w.mag ? '' : 'e'}"></i>`).join('');
  }
  el.reloadTxt.textContent = d.reloading > 0 ? STR.reloading : (w.mag === 0 ? (w.res > 0 ? STR.pressR : STR.noAmmo) : '');
  el.reloadFill.style.width = d.reloading > 0 ? (100 * (1 - d.reloading / d.reloadTotal)) + '%' : '0';

  el.wave.textContent = `${G.wave + 1}/${d.wavesTotal}`;
  el.enemies.textContent = d.enemiesLeft;
  el.score.textContent = G.score;
  el.combo.textContent = G.combo > 1 ? STR.combo(Math.min(G.combo, COMBO.MAX)) : '';

  // retícula: abre com recuo e ao andar, fecha mirando
  spread = Math.max(0, spread - dt * 90);
  const base = (G.aiming ? 4 : 9) + (d.moving ? 5 : 0) + spread;
  el.cross.style.setProperty('--g', base.toFixed(1) + 'px');

  if (hitT > 0) { hitT -= dt; el.hitmark.style.opacity = Math.min(1, hitT * 8); } else el.hitmark.style.opacity = 0;
  if (dirT > 0) { dirT -= dt; if (dirT <= 0) { el.dmgDir.style.transition = 'opacity .5s'; el.dmgDir.style.opacity = 0; } }
  if (vignHit > 0) vignHit -= dt;
  const low = d.player.hp < PLAYER.LOW_HP && !d.player.dead;
  el.vign.style.opacity = vignHit > 0 ? 1 : low ? (0.35 + 0.15 * Math.sin(G.time * 5)) : 0;

  if (bannerT > 0) { bannerT -= dt; if (bannerT <= 0) el.banner.style.opacity = 0; }
  if (feedT > 0) { feedT -= dt; if (feedT <= 0) el.feed.style.opacity = 0; }
  if (cdT > 0) { cdT -= dt; el.countdown.style.opacity = Math.min(1, cdT * 2); }

  drawRadar(d);
}

// ---------- radar ----------
const rctx = el.radar.getContext('2d');
const RANGE = 26;
function drawRadar(d) {
  const c = rctx, S = el.radar.width, H = S / 2, R = H - 3, sc = R / RANGE;
  const px = d.player.pos.x, pz = d.player.pos.z;
  const fx = Math.sin(G.yaw), fz = Math.cos(G.yaw), rx = -fz, rz = fx;
  // mundo → radar (para cima = para onde a câmera olha)
  const toR = (x, z) => { const dx = x - px, dz = z - pz; return [H + (dx * rx + dz * rz) * sc, H - (dx * fx + dz * fz) * sc]; };
  c.clearRect(0, 0, S, S);
  c.save(); c.beginPath(); c.arc(H, H, R, 0, 7); c.clip();
  c.fillStyle = 'rgba(8,24,12,.5)'; c.fillRect(0, 0, S, S);
  // ruínas como retângulos
  c.fillStyle = 'rgba(160,190,160,.28)';
  for (const b of d.boxes) {
    const a = toR(b.minX, b.minZ), bb = toR(b.maxX, b.minZ), cc = toR(b.maxX, b.maxZ), dd = toR(b.minX, b.maxZ);
    c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(bb[0], bb[1]); c.lineTo(cc[0], cc[1]); c.lineTo(dd[0], dd[1]); c.closePath(); c.fill();
  }
  // limite da arena
  c.strokeStyle = 'rgba(255,200,80,.35)'; c.lineWidth = 1; c.beginPath();
  [[-29, -29], [29, -29], [29, 29], [-29, 29]].forEach(([x, z], i) => { const p = toR(x, z); i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]); });
  c.closePath(); c.stroke();
  // anéis e varredura
  c.strokeStyle = 'rgba(120,200,120,.22)';
  [0.33, 0.66].forEach((k) => { c.beginPath(); c.arc(H, H, R * k, 0, 7); c.stroke(); });
  const sweep = (G.time * 2) % (Math.PI * 2);
  const grd = c.createConicGradient ? c.createConicGradient(sweep, H, H) : null;
  if (grd) { grd.addColorStop(0, 'rgba(120,255,120,.18)'); grd.addColorStop(0.12, 'rgba(120,255,120,0)'); grd.addColorStop(1, 'rgba(120,255,120,0)'); c.fillStyle = grd; c.fillRect(0, 0, S, S); }
  // cone de visão
  c.fillStyle = 'rgba(255,255,220,.06)'; c.beginPath(); c.moveTo(H, H); c.arc(H, H, R, -Math.PI / 2 - 0.5, -Math.PI / 2 + 0.5); c.fill();
  // pickups
  for (const p of d.pickups) {
    const [x, y] = toR(p.x, p.z); c.fillStyle = p.kind === 'med' ? '#ff6666' : '#eecc44';
    c.fillRect(x - 2.5, y - 2.5, 5, 5);
  }
  c.restore();
  // inimigos (fora do alcance viram setas na borda)
  for (const e of d.enemies) {
    if (e.dead) continue;
    let [x, y] = toR(e.pos.x, e.pos.z); const T = ENEMY_TYPES[e.type];
    const dx = x - H, dy = y - H, dist = Math.hypot(dx, dy);
    c.fillStyle = T.radar;
    if (dist > R - 4) {
      const a = Math.atan2(dy, dx); x = H + Math.cos(a) * (R - 4); y = H + Math.sin(a) * (R - 4);
      c.save(); c.translate(x, y); c.rotate(a); c.beginPath(); c.moveTo(5, 0); c.lineTo(-3, -4); c.lineTo(-3, 4); c.fill(); c.restore();
    } else {
      const sz = e.type === 'brute' ? 5.5 : 3.4, pulse = e.flashT > 0 ? 1.6 : 1;
      c.globalAlpha = 0.6 + 0.4 * Math.abs(Math.sin(G.time * 4 + e.seed)); c.beginPath(); c.arc(x, y, sz * pulse, 0, 7); c.fill(); c.globalAlpha = 1;
    }
  }
  // borda e jogador
  c.strokeStyle = 'rgba(140,220,140,.45)'; c.beginPath(); c.arc(H, H, R, 0, 7); c.stroke();
  c.fillStyle = '#fff'; c.beginPath(); c.moveTo(H, H - 7); c.lineTo(H - 4.5, H + 4); c.lineTo(H + 4.5, H + 4); c.fill();
  // indicador de norte (-Z)
  const na = wrapAngle(Math.atan2(-rz, -fz)); // rotação do norte no radar
  const nx = H + Math.sin(na) * (R - 9), ny = H - Math.cos(na) * (R - 9);
  c.fillStyle = '#ffd060'; c.font = 'bold 10px Trebuchet MS'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('N', nx, ny);
}
