// shop.js — v10: Terminal TELLUS (SALVAR · LOJA · SAIR) nos terminais verdes, no espírito de Dino Crisis 2.
// A loja vende munição, cura, armas e upgrades com Pontos de Extinção (G.ep). O jogo congela em G.state='terminal'.
// Comprar não salva: as compras só ficam gravadas no próximo SALVAR (morrer volta ao último save, PE incluído).
import { SHOP, SHOP_TABS, UPGRADES, ARMOR, PLAYER } from './config.js';
import { G } from './state.js';
import { player, weapons, bag, applyUpgrades, upLevel, medMax, grenadeMax, resMax, switchWeapon } from './player.js';
import { clearInput, lockPointer, unlockPointer, mouse } from './input.js';
import { sfx } from './audio.js';
import * as ui from './ui.js';

const $ = (id) => document.getElementById(id);
const root = $('terminal'), body = $('termBody'), epEl = $('termEp'), msgEl = $('termMsg'), keysEl = $('termKeys'), areaEl = $('termArea');
const WNAME = ['pistola', 'escopeta', 'submetralhadora'];
const MENU = ['save', 'shop', 'exit'];

let T = null; // { view:'menu'|'shop', sel, tab, row, onSave, flags, area, saved, msg, msgCol }
export const terminalOpen = () => !!T;

/**
 * Abre o terminal. opts: { onSave(): void, flags: flags da campanha, area: nome da área }
 */
export function openTerminal(opts) {
  T = { view: 'menu', sel: 0, tab: 0, row: 0, onSave: opts.onSave, flags: opts.flags || {}, area: opts.area || '', saved: false, msg: '', msgCol: '' };
  G.state = 'terminal'; clearInput(); unlockPointer(); // estado antes do unlock: onLockLost não pausa
  root.classList.remove('hidden');
  sfx.terminal && sfx.terminal();
  render();
}
export function closeTerminal() {
  if (!T) return;
  T = null; root.classList.add('hidden');
  G.state = 'play'; clearInput(); lockPointer();
  setTimeout(() => { if (G.state === 'play' && !mouse.locked && document.pointerLockElement === null) ui.feed(ui.STR.lockHint, '#cde'); }, 400);
}

// ---------- catálogo ----------
const tabItems = (t) => SHOP.filter((it) => it.tab === SHOP_TABS[t].id);
/** Situação de um item: preço, quanto tem, máximo, e por que não dá para comprar. */
function status(it) {
  const act2 = !!T.flags.act2;
  let have = 0, max = 1, price = it.price, lock = '';
  switch (it.kind) {
    case 'res':
      have = weapons[it.w].res; max = resMax(it.w);
      if (!bag.owned[it.w]) lock = `Precisa da ${WNAME[it.w]}`;
      break;
    case 'med': have = bag.meds; max = medMax(); break;
    case 'vest': have = bag.armor; max = ARMOR.MAX; break;
    case 'grenade': have = bag.grenades; max = grenadeMax(); break;
    case 'weapon': have = bag.owned[it.w] ? 1 : 0; max = 1; break;
    case 'up': {
      const U = UPGRADES[it.up]; have = upLevel(it.up); max = U.prices.length; price = U.prices[Math.min(have, max - 1)];
      if (U.w !== undefined && !bag.owned[U.w]) lock = `Precisa da ${WNAME[U.w]}`;
      else if (have < max && U.act[have] === 2 && !act2) lock = 'Disponível no Ato 2';
      break;
    }
  }
  const full = have >= max;
  return { have, max, price, lock: full ? '' : lock, full, ok: !full && !lock && G.ep >= price };
}
function haveLabel(it, s) {
  if (it.kind === 'weapon') return s.have ? 'possui' : 'não possui';
  if (it.kind === 'up') return `nível ${s.have}/${s.max}`;
  return `possui ${s.have}/${s.max}`;
}

function buy(it) {
  const s = status(it);
  if (s.full) return say(it.kind === 'weapon' ? 'Você já tem essa arma' : 'Já está no máximo', '#ffd070', true);
  if (s.lock) return say(s.lock, '#ffb070', true);
  if (G.ep < s.price) return say(`PE insuficiente — faltam ${s.price - G.ep}`, '#ff8a70', true);
  G.ep -= s.price;
  switch (it.kind) {
    case 'res': { const w = weapons[it.w]; w.res = Math.min(resMax(it.w), w.res + it.n); break; }
    case 'med': bag.meds++; break;
    case 'vest': bag.armor = Math.min(ARMOR.MAX, bag.armor + ARMOR.VEST); break;
    case 'grenade': bag.grenades++; break;
    case 'weapon': {
      const w = weapons[it.w]; bag.owned[it.w] = true; w.mag = w.size;
      w.res = Math.min(resMax(it.w), Math.max(w.res, it.w === 1 ? 6 : w.size));
      switchWeapon(it.w);
      break;
    }
    case 'up': bag.up[it.up] = upLevel(it.up) + 1; applyUpgrades(); break;
  }
  if (sfx.shopBuy) sfx.shopBuy(); else sfx.pickup();
  say(`Comprado: ${it.name} (−${s.price} PE)`, '#9fffb0');
}
function say(msg, col, deny) {
  T.msg = msg; T.msgCol = col;
  if (deny) { if (sfx.shopDeny) sfx.shopDeny(); else sfx.locked(); }
  render();
}

function activateMenu(i) {
  const k = MENU[i];
  if (k === 'save') {
    if (T.saved) return say('Progresso já salvo neste acesso', '#cde', true);
    T.onSave(); T.saved = true;
    say(`Progresso salvo — vida restaurada (${PLAYER.HP})`, '#9fffb0');
  } else if (k === 'shop') { T.view = 'shop'; T.row = 0; T.msg = ''; sfx.tick(); render(); }
  else closeTerminal();
}
function moveTab(d) { T.tab = (T.tab + d + SHOP_TABS.length) % SHOP_TABS.length; T.row = 0; T.msg = ''; sfx.tick(); render(); }

// ---------- entrada (teclado; o controle chega traduzido pelo gamepad.js) ----------
export function terminalKey(code) {
  if (!T) return;
  const up = code === 'ArrowUp' || code === 'KeyW', down = code === 'ArrowDown' || code === 'KeyS';
  const ok = code === 'Enter' || code === 'Space' || code === 'NumpadEnter' || code === 'KeyE';
  const back = code === 'Escape' || code === 'Backspace';
  if (T.view === 'menu') {
    if (up || down) { T.sel = (T.sel + (down ? 1 : -1) + MENU.length) % MENU.length; sfx.tick(); render(); }
    else if (ok) activateMenu(T.sel);
    else if (back) closeTerminal();
    return;
  }
  const list = tabItems(T.tab);
  if (up || down) { T.row = (T.row + (down ? 1 : -1) + list.length) % list.length; sfx.tick(); render(); }
  else if (code === 'ArrowLeft' || code === 'KeyA' || code === 'TabPrev' || code === 'KeyQ') moveTab(-1);
  else if (code === 'ArrowRight' || code === 'KeyD' || code === 'TabNext' || code === 'Tab') moveTab(1);
  else if (ok) buy(list[T.row]);
  else if (back) { T.view = 'menu'; T.sel = 1; T.msg = ''; sfx.tick(); render(); }
}

// mouse: clique escolhe/compra; passar por cima seleciona
body.addEventListener('click', (e) => {
  if (!T) return;
  const b = e.target.closest('[data-m],[data-t],[data-r]'); if (!b) return;
  if (b.dataset.m !== undefined) { T.sel = +b.dataset.m; activateMenu(T.sel); }
  else if (b.dataset.t !== undefined) { T.tab = +b.dataset.t; T.row = 0; T.msg = ''; sfx.tick(); render(); }
  else { T.row = +b.dataset.r; buy(tabItems(T.tab)[T.row]); }
});
body.addEventListener('mousemove', (e) => {
  if (!T) return;
  const b = e.target.closest('[data-m],[data-r]'); if (!b) return;
  if (b.dataset.m !== undefined && T.sel !== +b.dataset.m) { T.sel = +b.dataset.m; render(); }
  else if (b.dataset.r !== undefined && T.row !== +b.dataset.r) { T.row = +b.dataset.r; render(); }
});
$('termBack').addEventListener('mousedown', (e) => e.preventDefault()); // sem foco: Enter/Espaço não “clicam” o botão de novo
$('termBack').addEventListener('click', () => { if (!T) return; if (T.view === 'shop') terminalKey('Escape'); else closeTerminal(); });

// ---------- desenho ----------
function render() {
  if (!T) return;
  areaEl.textContent = T.area;
  epEl.textContent = G.ep;
  msgEl.textContent = T.msg; msgEl.style.color = T.msgCol || '';
  const stats = `Vida <b>${Math.ceil(player.hp)}</b> · Kits <b>${bag.meds}/${medMax()}</b> · Granadas <b>${bag.grenades}/${grenadeMax()}</b>${bag.armor > 0 ? ` · Colete <b>${bag.armor}</b>` : ''}`;
  if (T.view === 'menu') {
    const label = { save: T.saved ? 'SALVO ✓' : 'SALVAR', shop: 'LOJA', exit: 'SAIR' };
    const hint = { save: 'Grava o progresso e restaura a vida', shop: 'Gaste Pontos de Extinção (PE)', exit: 'Voltar ao jogo' };
    body.innerHTML = `<div class="term-stats">${stats}</div><div class="term-menu">` +
      MENU.map((k, i) => `<div class="tm${i === T.sel ? ' sel' : ''}${k === 'save' && T.saved ? ' done' : ''}" data-m="${i}"><b>${label[k]}</b><small>${hint[k]}</small></div>`).join('') + '</div>';
    keysEl.textContent = '↑↓ escolher · Enter confirmar · Esc sair';
    $('termBack').textContent = 'SAIR';
    return;
  }
  const list = tabItems(T.tab);
  T.row = Math.min(T.row, list.length - 1);
  const tabs = SHOP_TABS.map((t, i) => `<span class="tt${i === T.tab ? ' sel' : ''}" data-t="${i}">${t.name}</span>`).join('');
  const rows = list.map((it, i) => {
    const s = status(it);
    const cls = ['trow', i === T.row ? 'sel' : '', s.full ? 'max' : (!s.ok ? 'dis' : '')].join(' ');
    const right = s.full ? '<span class="tp">MÁX</span>' : `<span class="tp">${s.price} PE</span>`;
    const note = s.lock ? `<em>${s.lock}</em>` : '';
    return `<div class="${cls}" data-r="${i}"><span class="tn">${it.name}<small>${it.desc}${note ? ' — ' + note : ''}</small></span><span class="th">${haveLabel(it, s)}</span>${right}</div>`;
  }).join('');
  body.innerHTML = `<div class="term-stats">${stats}</div><div class="term-tabs">${tabs}</div><div class="term-list">${rows}</div>` +
    '<div class="term-note">As compras só ficam gravadas quando você salva.</div>';
  keysEl.textContent = '←→/LB RB abas · ↑↓ item · Enter comprar · Esc voltar';
  $('termBack').textContent = 'VOLTAR';
}
