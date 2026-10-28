// main.js — inicialização, máquina de estados (menu/play/pause/over/win) e laço principal.
// A progressão (áreas, portas, eventos, chefe) fica em director.js.
import * as THREE from 'three';
import { renderer, scene, camera, boxes, updateWorld, atmo } from './world.js';
import { G, saveBest } from './state.js';
import { initInput, lockPointer, unlockPointer, clearInput, keys, mouse } from './input.js';
import { initAudio, sfx, toggleMute } from './audio.js';
import { updateFx, clearFx } from './fx.js';
import { player, bag, events, resetPlayer, updatePlayer, updateCamera, menuCamera, switchWeapon, startReload, arms, curWeapon, useMed } from './player.js';
import { enemies, spawnEnemy, updateEnemies, clearEnemies } from './enemies.js';
import { fire, throwGrenade, updateCombat, clearPickups, pickups, damageEnemy } from './combat.js';
import { updateSurvivor, hideSurvivor, survivor } from './npc.js';
import { buildAreas } from './areas.js';
import { D, startCampaign, updateDirector, hudData, interact, hasSave, setWinHandler, endStats, currentObjective, debugGoto } from './director.js';
import * as ui from './ui.js';
import { $ } from './utils.js';

buildAreas();

// ---------- estados ----------
let endT = 0;
const setState = (s) => { G.state = s; };

function startGame(fromSave) {
  initAudio();
  if (fromSave && !hasSave()) fromSave = false;
  ui.showScreen('hud'); ui.toggleMap(false); ui.setFade(0);
  setState('play');
  startCampaign(fromSave);
  lockPointer();
}
function endGame(win) {
  if (G.state !== 'play') return;
  setState(win ? 'win' : 'over'); endT = win ? 2.4 : 2.2; clearInput(); ui.toggleMap(false);
  if (win) { ui.banner('RESGATE!', 'O helicóptero pousa no penhasco', 3); sfx.win(); }
}
function showEnd() {
  const win = G.state === 'win'; unlockPointer();
  const newBest = win ? saveBest() : false;
  ui.setHasSave(hasSave());
  ui.showEnd(win, endStats(), newBest);
  setState('ended');
}
function setPause(p) {
  if (p && G.state === 'play') { setState('pause'); clearInput(); ui.setPauseText('Objetivo: ' + currentObjective()); ui.showScreen('pause'); unlockPointer(); }
  else if (!p && G.state === 'pause') {
    setState('play'); ui.showScreen('hud'); lockPointer();
    setTimeout(() => { if (G.state === 'play' && !mouse.locked && document.pointerLockElement === null) ui.feed(ui.STR.lockHint, '#cde'); }, 400);
  }
}
function toMenu() {
  setState('menu'); clearEnemies(); clearPickups(); clearFx(); ui.clearFloaters(); ui.clearMessages(); hideSurvivor(); resetPlayer(); ui.setFade(0);
  ui.setHasSave(hasSave()); ui.showScreen('menu'); unlockPointer();
}
events.onDeath = () => endGame(false);
setWinHandler(() => endGame(true));

// ---------- entrada ----------
initInput(renderer.domElement, {
  onKey(code) {
    if (G.state === 'play') {
      if (code === 'KeyR') startReload();
      if (code === 'Digit1') switchWeapon(0);
      if (code === 'Digit2') { if (bag.owned[1]) switchWeapon(1); else ui.feed('Você ainda não tem a escopeta', '#a09070'); }
      if (code === 'KeyQ') { if (bag.owned[1]) switchWeapon(1 - arms.cur); }
      if (code === 'KeyE') interact();
      if (code === 'KeyG') throwGrenade();
      if (code === 'KeyH') useMed();
      if (code === 'Tab') ui.toggleMap(!ui.mapOpen());
      if (code === 'KeyV') { G.shoulder *= -1; ui.feed(ui.STR.shoulder(G.shoulder), '#cde'); }
      if (code === 'KeyP' || code === 'Escape') { if (ui.mapOpen()) ui.toggleMap(false); else setPause(true); }
    } else if (G.state === 'pause') { if (code === 'KeyP' || code === 'Enter') setPause(false); }
    else if ((G.state === 'ended' || G.state === 'menu') && code === 'Enter') startGame(false);
    if (code === 'KeyM') ui.feed(ui.STR.muted(toggleMute()), '#cde');
  },
  onCanvasDown() { initAudio(); },
  onLockLost() { if (G.state === 'play' && !ui.mapOpen()) setPause(true); },
  onBlur() { if (G.state === 'play') setPause(true); },
});
$('startBtn').onclick = () => startGame(false);
$('continueBtn').onclick = () => startGame(true);
$('restartBtn').onclick = () => startGame(false);
$('continueEndBtn').onclick = () => startGame(true);
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
    if (G.state === 'play' && (mouse.down || keys.Space) && !D.trans) fire();
    updateEnemies(dt);
    updateSurvivor(dt);
    updateCombat(dt);
    if (G.state === 'play') updateDirector(dt);
    else { endT -= dt; if (endT <= 0) showEnd(); }
  }
  updateFx(dt);
}
const EMPTY = { area: null };
function loop() {
  requestAnimationFrame(loop);
  const dt = Math.min(clock.getDelta(), 0.05);
  if (G.state !== 'pause') update(dt);
  if (G.state === 'menu') menuCamera(dt); else if (G.state !== 'pause') updateCamera(dt);
  const h = D.area ? hudData() : EMPTY;
  ui.updateHUD(dt, {
    camera, player, weapon: curWeapon(), reloading: arms.reloading, reloadTotal: arms.reloadTotal, moving: player.moving,
    enemies, pickups, boxes, lightning: atmo.lightning, bag, ...h,
  });
  renderer.render(scene, camera);
}

// tela de menu: mostra o cais ao fundo
startCampaign(false); clearEnemies(); hideSurvivor(); G.state = 'menu';
ui.initUI(hasSave());
ui.showScreen('menu');
loop();

// gancho de depuração/testes automatizados
window.__game = {
  get state() { return G.state; }, get hp() { return player.hp; }, get area() { return D.area && D.area.id; },
  get enemies() { return enemies.length; }, get objective() { return currentObjective(); },
  get flags() { return D.flags; }, D, list: enemies, damageEnemy, player, bag, survivor, G, startGame, fire, spawnEnemy, interact, throwGrenade,
  goto: (id) => debugGoto(id),
};
