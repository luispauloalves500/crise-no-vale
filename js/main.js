// main.js — inicialização, máquina de estados (menu/story/play/pause/over/win) e laço principal.
// A progressão (áreas, portas, eventos, chefe) fica em director.js.
import * as THREE from 'three';
import { renderer, scene, camera, boxes, updateWorld, atmo, bounds } from './world.js';
import { G, saveBest } from './state.js';
import { initInput, lockPointer, unlockPointer, clearInput, keys, mouse } from './input.js';
import { initAudio, sfx, toggleMute, isMuted, setAmbience, setMuffle, ambienceState, setVolumes, getVolumes } from './audio.js';
import { SETTINGS, loadSettings, setSetting, resetSettings, onSettings } from './settings.js';
import { pollGamepad, pad } from './gamepad.js';
import { updateFx, clearFx } from './fx.js';
import { heroReady, heroInfo, selectHero, player, bag, events, resetPlayer, updatePlayer, updateCamera, menuCamera, switchWeapon, startReload, arms, curWeapon, useMed, weapons, medMax, grenadeMax, applyUpgrades } from './player.js';
import { terminalKey, terminalOpen } from './shop.js';
import { openArchive, archiveKey } from './archive.js';
import { enemies, spawnEnemy, updateEnemies, clearEnemies, prewarmEnemies, poolStats } from './enemies.js';
import { fire, throwGrenade, updateCombat, clearPickups, pickups, damageEnemy } from './combat.js';
import { updateSurvivor, hideSurvivor, survivor } from './npc.js';
import { updateBrandt, hideBrandt, brandt } from './brandt.js';
import { AREAS, AREA, buildArea, builtCount, isBuilt } from './areas.js';
import { D, startCampaign, updateDirector, updateHeli, hudData, interact, skipPassage, hasSave, setWinHandler, endStats, currentObjective, debugGoto, debugFlags, warmArea, streamAround, streamStats, ambienceNow } from './director.js';
import { readSave } from './state.js';
import { quality, setQualityMode, autoQualityTick, applyQualityNow, onQuality, MODE_LABEL, PRESETS } from './quality.js';
import { nextFrame, idleBusy } from './idle.js';
import { compileShaderVariants } from './shader-warmup.mjs';
import { updateLod, lodStats, forceLod } from './lod.js';
import * as story from './story.js';
import { initPost, render, toggleBloom, post } from './post.js';
import * as ui from './ui.js';
import { $ } from './utils.js';

// v4: as áreas NÃO são mais construídas todas de uma vez aqui — veja boot() no fim do arquivo.
const loadErr = $('loadErr'); if (loadErr) loadErr.remove(); // módulos carregaram: o aviso de file:// não se aplica

// ---------- estados ----------
let endT = 0;
const setState = (s) => { G.state = s; };

function startGame(fromSave) {
  if (heroBusy) return;
  initAudio();
  if (fromSave && !hasSave()) fromSave = false;
  ui.showScreen('hud'); ui.toggleMap(false); ui.setFade(0);
  setState('play');
  startCampaign(fromSave);
  // novo jogo: introdução (barco, rádio, missão) — clique/Espaço avança, Enter pula
  if (!fromSave) story.showCard(story.INTRO, () => story.say(story.LINES.enter_porto, 'enter_porto'), { full: true, cinematic: true });
  else lockPointer();
}
function endGame(win) {
  if (G.state !== 'play') return;
  if (win) { jillUnlockedSession = true; try { localStorage.setItem('crise-no-vale-jill-unlocked', '1'); } catch (e) { console.warn('Não foi possível salvar desbloqueio:', e); } }
  setState(win ? 'win' : 'over'); endT = win ? 2.4 : 2.2; clearInput(); ui.toggleMap(false);
  if (win) { ui.banner('RESGATE!', D.area && D.area.id === 'ninho' ? 'O Garça-1 pousa na clareira do ninho' : 'O helicóptero pousa no penhasco', 3); sfx.win(); }
}
function showEnd() {
  // vitória: epílogo (muda conforme os registros encontrados) antes da tela de pontos
  if (G.state === 'win' && !story.cardOpen()) { story.clearSpeech(); story.showCard(story.epilogue(D.flags), finishEnd, { full: true }); return; }
  finishEnd();
}
function finishEnd() {
  const win = G.state === 'win'; unlockPointer();
  const newBest = win ? saveBest() : false;
  ui.setHasSave(hasSave());
  ui.showEnd(win, endStats(), newBest);
  setState('ended');
}
function setPause(p) {
  if (p && G.state === 'play') { setState('pause'); clearInput(); ui.setPauseText('Objetivo: ' + currentObjective()); ui.showScreen('pause'); unlockPointer(); }
  else if (!p && G.state === 'pause' && !heroBusy) {
    setState('play'); ui.showScreen('hud'); lockPointer();
    setTimeout(() => { if (G.state === 'play' && !mouse.locked && document.pointerLockElement === null) ui.feed(ui.STR.lockHint, '#cde'); }, 400);
  }
}
function toMenu() {
  G.transitioning = false; D.trans = null; ui.hidePassage();
  setState('menu'); story.clearSpeech(); clearEnemies(); clearPickups(); clearFx(); ui.clearFloaters(); ui.clearMessages(); hideSurvivor(); hideBrandt(); resetPlayer(); ui.setFade(0);
  ui.setHasSave(hasSave()); ui.showScreen('menu'); refreshCharacterButtons(); unlockPointer();
}
events.onDeath = () => endGame(false);
setWinHandler(() => endGame(true));

// ---------- v6: ajustes (sensibilidade, inverter Y, volumes, movimento reduzido, controle) ----------
loadSettings(); setVolumes(SETTINGS);
const padLabel = () => (pad.connected ? '— conectado' : SETTINGS.gamepad ? '— conecte e aperte um botão' : '');
const refreshSettingsUI = () => ui.updateSettingsUI(SETTINGS, padLabel());
onSettings(() => { setVolumes(SETTINGS); refreshSettingsUI(); });
// v9: o ajuste "Movimento reduzido" também desliga as animações CSS do menu/pausa (body.rm).
const syncRm = () => document.body.classList.toggle('rm', !!SETTINGS.reducedMotion);
syncRm(); onSettings(syncRm);
ui.bindSettings((k, v) => setSetting(k, v), () => { resetSettings(); ui.feed('Ajustes restaurados', '#cde'); });
refreshSettingsUI();
addEventListener('gamepadconnected', () => { setTimeout(refreshSettingsUI, 50); if (SETTINGS.gamepad) ui.feed('Controle conectado', '#cde'); });
addEventListener('gamepaddisconnected', () => setTimeout(refreshSettingsUI, 50));
/** Troca para a próxima/anterior arma possuída (Q, roda do mouse, LB/RB). */
function cycleWeapon(dir) {
  const n = bag.owned.length;
  for (let k = 1; k < n; k++) { const i = (arms.cur + dir * k + n * 4) % n; if (bag.owned[i]) { switchWeapon(i); return; } }
}

// ---------- entrada ----------
const inputHandlers = {
  onKey(code) {
    if (G.state === 'archive') { archiveKey(code); return; }
    if (G.state === 'terminal') { terminalKey(code); if (code === 'KeyM') ui.feed(ui.STR.muted(toggleMute()), '#cde'); return; } // v10: Terminal TELLUS
    if (G.state === 'story') {
      if (code === 'Space' || code === 'KeyE') story.advanceCard();
      else if (code === 'Enter' || code === 'Escape') story.skipCard();
      return;
    }
    if (code === 'KeyB') { ui.feed(ui.STR.bloom(toggleBloom()), '#cde'); return; }
    if (G.state === 'loading') return;
    if (G.state === 'play') {
      if (D.trans) {
        if (code === 'KeyE' || code === 'Space' || code === 'Enter') skipPassage();
        else if (code === 'KeyP' || code === 'Escape') setPause(true);
        return;
      }
      if (code === 'KeyR') startReload();
      if (code === 'Digit1') switchWeapon(0);
      if (code === 'Digit2') { if (bag.owned[1]) switchWeapon(1); else ui.feed('Você ainda não tem a escopeta', '#a09070'); }
      if (code === 'Digit3') { if (bag.owned[2]) switchWeapon(2); else ui.feed('Você ainda não tem a submetralhadora', '#a09070'); }
      if (code === 'KeyQ') cycleWeapon(1);
      if (code === 'KeyE') { if (ui.mapOpen()) ui.toggleMap(false); else interact(); }
      if (code === 'KeyJ') { if (ui.mapOpen()) ui.toggleMap(false); openArchive(); }
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
  onWheel(dir) { if (G.state === 'play' && !D.trans) cycleWeapon(dir); },
};
initInput(renderer.domElement, inputHandlers);
$('passageSkip').onclick = () => skipPassage();
let selectedCharacter = 'marina', heroBusy = false, jillUnlockedSession = false;
function isJillUnlocked() { try { return jillUnlockedSession || G.best > 0 || localStorage.getItem('crise-no-vale-jill-unlocked') === '1'; } catch (e) { return jillUnlockedSession || G.best > 0; } }
const characterSelectors = [
  { marina: $('heroMarina'), jill: $('heroJill'), note: $('heroNote') },
  { marina: $('pauseHeroMarina'), jill: $('pauseHeroJill'), note: $('pauseHeroNote') },
];
function refreshCharacterButtons() {
  const unlocked = isJillUnlocked();
  for (const group of characterSelectors) {
    group.marina.disabled = heroBusy; group.jill.disabled = heroBusy || !unlocked;
    group.marina.classList.toggle('on', selectedCharacter === 'marina');
    group.jill.classList.toggle('on', selectedCharacter === 'jill');
    group.jill.textContent = unlocked ? 'Jill' : 'Jill — bloqueada';
    group.note.textContent = heroBusy ? 'Carregando personagem…' : unlocked ? 'Escolha Marina ou Jill.' : 'Conclua um final para desbloquear Jill.';
  }
  $('startBtn').disabled = heroBusy; $('continueBtn').disabled = heroBusy; $('resumeBtn').disabled = heroBusy;
}
async function chooseCharacter(choice) {
  if (heroBusy || (choice === 'jill' && !isJillUnlocked())) return;
  heroBusy = true; refreshCharacterButtons();
  const ok = await selectHero(choice);
  if (ok) { selectedCharacter = choice; try { localStorage.setItem('crise-no-vale-personagem', choice); } catch (e) {} }
  heroBusy = false; refreshCharacterButtons();
  if (!ok) for (const group of characterSelectors) group.note.textContent = 'Não foi possível carregar esse personagem. Tente novamente.';
}
for (const group of characterSelectors) {
  group.marina.onclick = () => chooseCharacter('marina');
  group.jill.onclick = () => chooseCharacter('jill');
}
$('startBtn').onclick = () => startGame(false);
$('continueBtn').onclick = () => startGame(true);
$('restartBtn').onclick = () => startGame(false);
$('continueEndBtn').onclick = () => startGame(true);
$('resumeBtn').onclick = () => setPause(false);
$('story').addEventListener('mousedown', (e) => { if (e.button === 0) story.advanceCard(); });
$('quitBtn').onclick = toMenu;
atmo.onThunder = (delay) => sfx.thunder(delay);

// ---------- loop ----------
const clock = new THREE.Clock();
function update(dt) {
  G.time += dt;
  updateWorld(dt);
  if (!D.trans) story.updateStory(dt);
  if (G.state === 'play' || G.state === 'over' || G.state === 'win') {
    if (G.state === 'play' && !D.trans) G.elapsed += dt;
    // Durante o fade nenhum ator ou projétil continua avançando fora da tela.
    if (!D.trans) {
      updatePlayer(dt);
      if (G.state === 'play' && (mouse.down || keys.Space || pad.fire)) fire();
      updateEnemies(dt);
      updateSurvivor(dt);
      updateBrandt(dt);
      updateCombat(dt);
      updateHeli(dt);
    }
    if (G.state === 'play') updateDirector(dt);
    else { endT -= dt; if (endT <= 0) showEnd(); }
  }
  updateFx(dt);
}
const EMPTY = { area: null };
function loop() {
  requestAnimationFrame(loop);
  const raw = clock.getDelta(), dt = Math.min(raw, 0.05);
  pollGamepad(dt, inputHandlers);
  if (G.state === 'play' && !D.trans && autoQualityTick(dt, raw)) ui.feed(ui.STR.qualityAuto(quality.p.label), '#fc8');
  // v6: hitstop — 40–60 ms em câmera quase parada no mundo (crítico/abate); câmera e HUD seguem no dt normal
  let udt = dt;
  if (G.hitstopCd > 0) G.hitstopCd -= dt;
  if (G.hitstop > 0) { G.hitstop -= dt; if (G.state === 'play') udt = dt * 0.06; }
  if (G.state !== 'pause') update(udt);
  // v5: áudio — ambiente por área com crossfade; abafa durante pausa e cartões de história
  G.surface = D.area ? D.area.id : '';
  const inGame = G.state !== 'menu' && G.state !== 'loading' && D.area;
  if (inGame) { const [k, m] = ambienceNow(); setAmbience(k, m); } else setAmbience('menu');
  setMuffle(G.state === 'pause' || G.state === 'story' || G.state === 'terminal' || G.state === 'archive');
  if (G.state === 'menu' || story.cinematic()) menuCamera(dt); else if (G.state !== 'pause') updateCamera(dt);
  // Plano fixo da travessia enquadra a abertura, a passagem e o fechamento.
  if (G.state === 'play' && D.trans?.shot) {
    const s = D.trans.shot;
    camera.position.set(s.x, s.y, s.z); camera.lookAt(s.tx, s.ty, s.tz);
  }
  // Pequeno enquadramento, sem geometrias ou luzes adicionais.
  if (G.state === 'play' && D.trans?.sceneActive && !SETTINGS.reducedMotion) {
    const t = D.trans.sceneTime / D.trans.scene.duration;
    camera.fov -= 2.5 * Math.sin(Math.PI * t); camera.updateProjectionMatrix();
  }
  // v9: LOD por distância da câmera (cenário a ~6 Hz; inimigos leem o nível em updateEnemies)
  updateLod(dt, D.area ? D.area.ctx : null);
  const h = D.area ? hudData() : EMPTY;
  ui.updateHUD(dt, {
    camera, player, weapon: curWeapon(), weapons, cur: arms.cur, reloading: arms.reloading, reloadTotal: arms.reloadTotal, moving: player.moving,
    enemies, pickups, boxes, lightning: atmo.lightning, haze: atmo.haze, bag, medMax: medMax(), grenadeMax: grenadeMax(), ...h,
  });
  renderer.info.reset();
  render(renderer, scene, camera, dt);
}

// ---------- qualidade gráfica ----------
function refreshQualityUI() { ui.updateQualityUI(quality.mode, quality.id, quality.p.label); }
ui.bindQuality((mode) => {
  setQualityMode(mode); refreshQualityUI();
  document.querySelectorAll('.qsel.first').forEach((q) => { q.classList.remove('first'); q.querySelector('span').textContent = 'QUALIDADE GRÁFICA'; });
  ui.feed(ui.STR.quality(MODE_LABEL[mode] + (mode === 'auto' ? ' → ' + quality.p.label : '')), '#cde');
});
// a predefinição Auto pode baixar sozinha — mantém os botões em dia
onQuality(() => refreshQualityUI());

// ---------- carregamento progressivo ----------
// 1) cais (área inicial) → 2) modelos de inimigos no pool → 3) pré-compilação de shaders → menu.
// As demais áreas são construídas em segundo plano, uma por fatia ociosa (idle.js).
async function compileShaders(extra) {
  const tmp = [];
  for (const o of extra) if (!o.parent) { scene.add(o); tmp.push({ o, v: o.visible }); o.visible = true; o.position.y = -40; }
  try {
    if (renderer.compileAsync) await compileShaderVariants(renderer, scene, camera, scene, post.composer?.renderTarget1);
    else renderer.compile(scene, camera);
  } catch (e) { console.warn('pré-compilação de shaders falhou (segue sem):', e && e.message); }
  for (const { o, v } of tmp) { scene.remove(o); o.visible = v; o.position.y = 0; }
}
async function boot() {
  G.state = 'loading';
  const steps = 5; let n = 0;
  const step = async (txt) => { ui.setLoading(n++ / steps, txt); await nextFrame(); };
  applyQualityNow(); refreshQualityUI();
  if (quality.firstRun) document.querySelectorAll('#menu .quality-select').forEach((q) => { q.classList.add('first'); q.querySelector('span').textContent = `PRIMEIRA VEZ? ESCOLHA A QUALIDADE (AUTO DETECTOU: ${quality.p.label.toUpperCase()})`; });
  await step(`Carregando… qualidade ${quality.p.label}${quality.mode === 'auto' ? ' (auto)' : ''}`);
  await step('Carregando… 1/' + AREAS.length + ' ' + AREA.porto.name.toLowerCase());
  buildArea(AREA.porto);
  await step('Carregando… personagem (Marina)');
  const heroOk = await heroReady; // nunca trava: em falha/tempo esgotado volta à malha antiga
  if (!heroOk) ui.setLoading(n / steps, 'Modelo da Marina indisponível — usando personagem simples');
  await step('Carregando… criaturas');
  const warm = prewarmEnemies();
  // tela de menu: mostra o cais ao fundo
  startCampaign(false); clearEnemies(); hideSurvivor();
  await step('Carregando… preparando shaders');
  await initPost(renderer, scene, camera);
  await compileShaders(warm);
  ui.setLoading(1, 'Pronto!');
  G.state = 'menu';
  ui.initUI(hasSave());
  ui.showScreen('menu'); refreshCharacterButtons();
  try { if (isJillUnlocked() && localStorage.getItem('crise-no-vale-personagem') === 'jill') chooseCharacter('jill'); } catch (e) {}
  post.onAuto = () => ui.feed(ui.STR.bloomAuto, '#cde');
  loop();
  ui.hideLoading();
  streamAround(D.area); // inicia shaders dos vizinhos após compilar a área inicial
  // continuar: deixa a área do save pronta em segundo plano
  const sv = readSave(); if (sv && AREA[sv.area]) warmArea(AREA[sv.area]);
  bgStatus();
}
// linha discreta no menu: quantas áreas já estão prontas
function bgStatus() {
  const t = setInterval(() => {
    if (G.state !== 'menu') { ui.setBgStatus(''); return; }
    ui.setBgStatus(idleBusy() ? `Preparando áreas em segundo plano… ${builtCount()}/${AREAS.length}` : `Áreas prontas: ${builtCount()}/${AREAS.length}`);
  }, 300);
  return t;
}
boot().catch((e) => { console.error(e); ui.loadingError('Falha ao carregar: ' + (e && e.message ? e.message : e)); });

// gancho de depuração/testes automatizados
window.__game = {
  get state() { return G.state; }, get hp() { return player.hp; }, get area() { return D.area && D.area.id; },
  get enemies() { return enemies.length; }, get objective() { return currentObjective(); },
  get flags() { return D.flags; }, D, list: enemies, damageEnemy, player, bag, survivor, G, startGame, fire, spawnEnemy, interact, throwGrenade,
  goto: (id) => debugGoto(id), setFlags: debugFlags, brandt, story, post,
  // v10: loja — __game.G.ep = 9999 para testar; terminalOpen() diz se o Terminal TELLUS está aberto
  terminalOpen, terminalKey, applyUpgrades, weapons,
  // v5: áudio
  get ambience() { return ambienceState(); }, get muted() { return isMuted(); }, toggleMute,
  // v6: ajustes, controle e armas
  SETTINGS, setSetting, getVolumes, pad, cycleWeapon, switchWeapon, arms,
  hero: heroInfo, // v8: modelo GLB da Marina
  // v4: desempenho
  quality, setQuality: (m) => { setQualityMode(m); refreshQualityUI(); }, PRESETS, poolStats, streamStats, bounds, hudStats: ui.hudStats,
  // v9: LOD
  lodStats, forceLod,
  areas: () => AREAS.map((a) => ({ id: a.id, built: isBuilt(a), builds: a.builds || 0, unloads: a.unloads || 0 })),
  renderInfo: () => ({ calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, programs: renderer.info.programs.length, geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures, pixelRatio: renderer.getPixelRatio(), shadowMap: renderer.shadowMap.type }),
};
