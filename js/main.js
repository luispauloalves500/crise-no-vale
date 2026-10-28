// main.js — inicialização, máquina de estados (menu/play/pause/win/lose) e diretor de ondas.
import * as THREE from 'three';
import { renderer, scene, camera, boxes, updateWorld, atmo } from './world.js';
import { WAVES, INTERMISSION, WAVE_CLEAR_BONUS } from './config.js';
import { G, saveBest } from './state.js';
import { initInput, lockPointer, unlockPointer, clearInput, keys, mouse } from './input.js';
import { initAudio, sfx, toggleMute } from './audio.js';
import { updateFx, clearFx } from './fx.js';
import { player, events, resetPlayer, updatePlayer, updateCamera, menuCamera, switchWeapon, startReload, arms, curWeapon } from './player.js';
import { enemies, spawnEnemy, updateEnemies, clearEnemies, aliveCount } from './enemies.js';
import { fire, updateCombat, spawnPickup, clearPickups, pickups, resetCombat } from './combat.js';
import * as ui from './ui.js';
import { $, rand, shuffle } from './utils.js';

// ---------- diretor de ondas ----------
const dir = { queue: [], spawnT: 0, interT: 0, lastCount: 0, announced: new Set() };

function startWave(i) {
  G.wave = i; const W = WAVES[i];
  dir.queue = shuffle(Object.entries(W.mix).flatMap(([k, n]) => Array(n).fill(k)));
  if (i === WAVES.length - 1) { const b = dir.queue.indexOf('brute'); if (b >= 0) { dir.queue.splice(b, 1); dir.queue.unshift('brute'); } }
  dir.spawnT = 2.2; dir.announced.clear();
  ui.banner(ui.STR.wave(i + 1), W.intro, 3);
  sfx.waveStart();
  spawnPickup('med'); spawnPickup('ammo'); if (i >= 2) spawnPickup('ammo');
}

function updateDirector(dt) {
  const W = WAVES[G.wave], alive = aliveCount();
  if (dir.queue.length && alive < W.maxAlive && dir.interT <= 0) {
    dir.spawnT -= dt;
    if (dir.spawnT <= 0) {
      const type = dir.queue.shift(), e = spawnEnemy(type);
      dir.spawnT = rand(W.gap[0], W.gap[1]);
      // anúncio de spawn: todo bruto e o primeiro cuspidor da onda, com a direção cardeal
      if (type === 'brute' || (type === 'spitter' && !dir.announced.has('spitter'))) {
        dir.announced.add(type);
        ui.announce(ui.STR.incoming(e.cfg.name, ui.cardinal(e.pos.x, e.pos.z)), type === 'brute' ? '#ff7060' : '#a8ff80');
      }
    }
  }
  if (!dir.queue.length && alive === 0 && dir.interT <= 0) {
    if (G.wave >= WAVES.length - 1) { endGame(true); return; }
    dir.interT = INTERMISSION; dir.lastCount = 0;
    G.score += WAVE_CLEAR_BONUS;
    ui.banner(ui.STR.waveClear, ui.STR.waveClearSub(G.wave + 1), 3);
    sfx.waveClear();
  }
  if (dir.interT > 0) {
    dir.interT -= dt;
    const n = Math.ceil(dir.interT);
    if (n <= 3 && n >= 1 && n !== dir.lastCount) { dir.lastCount = n; ui.countdown(n); sfx.tick(); }
    if (dir.interT <= 0) startWave(G.wave + 1);
  }
}

// ---------- estados ----------
let endT = 0;
function setState(s) { G.state = s; }

function startGame() {
  initAudio();
  clearEnemies(); clearPickups(); clearFx(); ui.clearFloaters(); ui.clearMessages(); resetCombat();
  resetPlayer();
  Object.assign(G, { score: 0, kills: 0, shots: 0, hits: 0, elapsed: 0, shake: 0 });
  dir.interT = 0;
  ui.showScreen('hud');
  setState('play');
  startWave(0);
  lockPointer();
}
function endGame(win) {
  setState(win ? 'win' : 'over'); endT = win ? 1.8 : 2.2; clearInput();
  if (win) { ui.banner(ui.STR.waveClear, ui.STR.winBanner, 3); sfx.win(); }
}
function showEnd() {
  const win = G.state === 'win'; unlockPointer();
  const newBest = saveBest();
  ui.showEnd(win, {
    score: G.score, kills: G.kills, elapsed: G.elapsed,
    waves: win ? WAVES.length : G.wave, total: WAVES.length,
    acc: G.shots ? Math.round(G.hits / G.shots * 100) : 0,
  }, newBest);
  setState('ended');
}
function setPause(p) {
  if (p && G.state === 'play') { setState('pause'); clearInput(); ui.showScreen('pause'); unlockPointer(); }
  else if (!p && G.state === 'pause') {
    setState('play'); ui.showScreen('hud'); lockPointer();
    setTimeout(() => { if (G.state === 'play' && !mouse.locked && document.pointerLockElement === null) ui.feed(ui.STR.lockHint, '#cde'); }, 400);
  }
}
function toMenu() {
  setState('menu'); clearEnemies(); clearPickups(); clearFx(); ui.clearFloaters(); ui.clearMessages(); resetPlayer();
  ui.showScreen('menu'); unlockPointer();
}
events.onDeath = () => endGame(false);

// ---------- entrada ----------
initInput(renderer.domElement, {
  onKey(code) {
    if (G.state === 'play') {
      if (code === 'KeyR') startReload();
      if (code === 'Digit1') switchWeapon(0);
      if (code === 'Digit2') switchWeapon(1);
      if (code === 'KeyQ') switchWeapon(1 - arms.cur);
      if (code === 'KeyV') { G.shoulder *= -1; ui.feed(ui.STR.shoulder(G.shoulder), '#cde'); }
      if (code === 'KeyP' || code === 'Escape') setPause(true);
    } else if (G.state === 'pause') { if (code === 'KeyP' || code === 'Enter') setPause(false); }
    else if ((G.state === 'ended' || G.state === 'menu') && code === 'Enter') startGame();
    if (code === 'KeyM') ui.feed(ui.STR.muted(toggleMute()), '#cde');
  },
  onCanvasDown() { initAudio(); },
  onLockLost() { if (G.state === 'play') setPause(true); },
  onBlur() { if (G.state === 'play') setPause(true); },
});
$('startBtn').onclick = startGame;
$('restartBtn').onclick = startGame;
$('resumeBtn').onclick = () => setPause(false);
$('quitBtn').onclick = toMenu;
atmo.onThunder = (delay) => sfx.thunder(delay);

// ---------- loop ----------
const clock = new THREE.Clock();
function update(dt) {
  G.time += dt;
  updateWorld(dt);
  if (G.state === 'play' || G.state === 'over' || G.state === 'win') {
    if (G.state === 'play') G.elapsed += dt;
    updatePlayer(dt);
    if (G.state === 'play' && (mouse.down || keys.Space)) fire();
    updateEnemies(dt);
    updateCombat(dt);
    if (G.state === 'play') updateDirector(dt);
    else { endT -= dt; if (endT <= 0) showEnd(); }
  }
  updateFx(dt);
}
function loop() {
  requestAnimationFrame(loop);
  const dt = Math.min(clock.getDelta(), 0.05);
  if (G.state !== 'pause') update(dt);
  if (G.state === 'menu') menuCamera(dt); else if (G.state !== 'pause') updateCamera(dt);
  ui.updateHUD(dt, {
    camera, player, weapon: curWeapon(), reloading: arms.reloading, reloadTotal: arms.reloadTotal,
    wavesTotal: WAVES.length, enemiesLeft: dir.queue.length + aliveCount(), moving: player.moving,
    enemies, pickups, boxes, lightning: atmo.lightning,
  });
  renderer.render(scene, camera);
}

resetPlayer();
ui.initUI();
ui.showScreen('menu');
loop();

// gancho de depuração/testes automatizados
window.__game = {
  get state() { return G.state; }, get wave() { return G.wave; }, get hp() { return player.hp; },
  get enemies() { return enemies.length; }, list: enemies, player, startGame, fire, spawnEnemy, G,
};
