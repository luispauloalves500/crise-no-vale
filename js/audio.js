// audio.js — áudio procedural com WebAudio (nenhum arquivo de áudio).
// v5: barramentos (efeitos / ambiente) → filtro "abafar" → compressor → volume mestre;
// camadas de ambiente por área com crossfade, stingers, passos variados e limite de vozes simultâneas.
let actx = null, noiseB = null, brownB = null, master = null, muted = false;
let sfxBus = null, ambBus = null, muffle = null, comp = null, sfxVol = null, ambVol = null;
const VOL = 0.5;                 // volume mestre (M liga/desliga)
// v6: volumes do jogador (0..1) — mestre, efeitos e ambiente; multiplicam a mixagem base
const userVol = { master: 1, sfx: 1, amb: 1 };
const masterLevel = () => (muted ? 0 : VOL * userVol.master);
const MAX_VOICES = 40;           // proteção contra "spam" de som (escopeta + muitos acertos)
let voices = 0;

/** Cria/retoma o AudioContext (precisa de gesto do usuário). */
export function initAudio() {
  if (!actx) {
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return null;
    actx = new C();
    master = actx.createGain(); master.gain.value = masterLevel();
    comp = actx.createDynamicsCompressor(); comp.threshold.value = -14; comp.knee.value = 12; comp.ratio.value = 5; comp.attack.value = 0.004; comp.release.value = 0.2;
    muffle = actx.createBiquadFilter(); muffle.type = 'lowpass'; muffle.frequency.value = 20000; muffle.Q.value = 0.5;
    sfxBus = actx.createGain(); ambBus = actx.createGain(); ambBus.gain.value = 1;
    sfxVol = actx.createGain(); ambVol = actx.createGain(); sfxVol.gain.value = userVol.sfx; ambVol.gain.value = userVol.amb;
    sfxBus.connect(sfxVol).connect(muffle); ambBus.connect(ambVol).connect(muffle); muffle.connect(comp).connect(master).connect(actx.destination);
    const n = actx.sampleRate * 2;
    noiseB = actx.createBuffer(1, n, actx.sampleRate);
    const d = noiseB.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    // ruído "marrom" (grave, contínuo): base para vento/mar/zumbido
    brownB = actx.createBuffer(1, n, actx.sampleRate);
    const b = brownB.getChannelData(0); let last = 0;
    for (let i = 0; i < n; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; b[i] = last * 3.5; }
    buildAmbience();
    applyAmbience(true);
    if (muffled) { muffle.frequency.value = 650; ambBus.gain.value = 0.55; sfxBus.gain.value = 0.6; }
  }
  if (actx.state === 'suspended') actx.resume();
  return actx;
}
const ok = () => actx && actx.state === 'running';
export const audioReady = () => ok();

export function toggleMute() {
  muted = !muted;
  if (master) { const t = actx.currentTime; master.gain.cancelScheduledValues(t); master.gain.setTargetAtTime(masterLevel(), t, 0.03); }
  return muted;
}
/** v6: volumes do jogador (mestre / efeitos / ambiente, 0..1). M continua mutando tudo. */
export function setVolumes(v) {
  for (const k of ['master', 'sfx', 'amb']) if (typeof v[k] === 'number') userVol[k] = Math.max(0, Math.min(1, v[k]));
  if (!actx) return;
  const t = actx.currentTime;
  master.gain.setTargetAtTime(masterLevel(), t, 0.05);
  sfxVol.gain.setTargetAtTime(userVol.sfx, t, 0.05); ambVol.gain.setTargetAtTime(userVol.amb, t, 0.05);
}
export const getVolumes = () => ({ ...userVol });
export const isMuted = () => muted;

// ---------- vozes ----------
function voice(node, stopAt) { voices++; node.onended = () => { voices--; }; node.stop(stopAt); }
function full(prio) { return voices >= (prio ? MAX_VOICES + 12 : MAX_VOICES); }

export function noise(dur, f0, f1, vol, type = 'lowpass', delay = 0, prio = false, buf = null) {
  if (!ok() || full(prio)) return;
  const t = actx.currentTime + delay, s = actx.createBufferSource(); s.buffer = buf || noiseB;
  const f = actx.createBiquadFilter(); f.type = type;
  f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  const g = actx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  s.connect(f).connect(g).connect(sfxBus); s.start(t, Math.random() * 1.2); voice(s, t + dur);
}
export function tone(f0, f1, dur, type, vol, delay = 0, prio = false) {
  if (!ok() || full(prio)) return;
  const t = actx.currentTime + delay, o = actx.createOscillator(); o.type = type;
  o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  const g = actx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(sfxBus); o.start(t); voice(o, t + dur);
}
/** Tom com ataque suave (para stingers/pads — sem clique). */
function swell(f0, f1, dur, type, vol, delay = 0, att = 0.12, cutoff = 1800) {
  if (!ok() || full(true)) return;
  const t = actx.currentTime + delay, o = actx.createOscillator(); o.type = type;
  o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  const f = actx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = cutoff;
  const g = actx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + att); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(f).connect(g).connect(sfxBus); o.start(t); voice(o, t + dur);
}
export function roar(p, vol) {
  if (!ok() || full(true)) return;
  const t = actx.currentTime, o = actx.createOscillator(); o.type = 'sawtooth';
  o.frequency.setValueAtTime(170 * p, t); o.frequency.linearRampToValueAtTime(240 * p, t + 0.15);
  o.frequency.exponentialRampToValueAtTime(55 * p, t + 0.8);
  const f = actx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900 * p;
  const g = actx.createGain(); g.gain.setValueAtTime(0.001, t); g.gain.linearRampToValueAtTime(vol, t + 0.08);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.85);
  o.connect(f).connect(g).connect(sfxBus); o.start(t); voice(o, t + 0.9);
  noise(0.6, 1500 * p, 200, vol * 0.6);
}

// ---------- limitador por nome (evita repetir o mesmo som no mesmo instante) ----------
const lastT = {};
function gate(name, min) { const now = actx ? actx.currentTime : 0; if (lastT[name] !== undefined && now - lastT[name] < min) return false; lastT[name] = now; return true; }

// ---------- ambiente por área (camadas contínuas com crossfade) ----------
// camadas: chuva, vento, insetos, mar, zumbido elétrico (gerador/energia), alarme distante e tensão (drone grave)
const L = {};
const AMB = {
  //          chuva  vento  insetos mar   zumbido alarme tensão
  porto:     { rain: 1.0, wind: 0.8, insects: 0.15, sea: 1.0, hum: 0,    alarm: 0,   tension: 0 },
  ruinas:    { rain: 0.5, wind: 1.0, insects: 0.45, sea: 0,   hum: 0,    alarm: 0,   tension: 0.15 },
  lab:       { rain: 0.8, wind: 0.5, insects: 0.2,  sea: 0,   hum: 0.15, alarm: 0.5, tension: 0.1 },
  pantano:   { rain: 0.55, wind: 0.3, insects: 1.0, sea: 0,   hum: 0,    alarm: 0,   tension: 0.1 },
  patio:     { rain: 0.7, wind: 0.6, insects: 0.25, sea: 0,   hum: 0.35, alarm: 0,   tension: 0.1 },
  heliponto: { rain: 0.9, wind: 1.0, insects: 0,    sea: 0.25, hum: 0,   alarm: 0,   tension: 0.6 },
  // v7 — Ato 2 (+ rio: correnteza; respiração: pulso grave do ninho)
  margem:      { rain: 0.6, wind: 0.5, insects: 0.8, sea: 0.3, hum: 0,   alarm: 0,   tension: 0.15, river: 1.0, breath: 0 },
  acampamento: { rain: 0.7, wind: 0.4, insects: 0.4, sea: 0,   hum: 0.8, alarm: 0.2, tension: 0.25, river: 0.35, breath: 0 },
  ninho:       { rain: 0.3, wind: 0.3, insects: 0.2, sea: 0,   hum: 0,   alarm: 0,   tension: 0.7, river: 0.5, breath: 1.0 },
  menu:      { rain: 0.7, wind: 0.6, insects: 0.1,  sea: 0.5, hum: 0,    alarm: 0,   tension: 0 },
};
const BASE = { rain: 0.06, wind: 0.09, insects: 0.018, sea: 0.08, hum: 0.035, alarm: 0.022, tension: 0.07, river: 0.07, breath: 0.06 };
let ambKey = 'menu', ambMods = {}, ambLast = '';
function loopSrc(buf) { const s = actx.createBufferSource(); s.buffer = buf; s.loop = true; s.start(0, Math.random() * 1.5); return s; }
function lfo(freq, depth, target) { const o = actx.createOscillator(); o.frequency.value = freq; const g = actx.createGain(); g.gain.value = depth; o.connect(g).connect(target); o.start(); return o; }
function buildAmbience() {
  const mk = () => { const g = actx.createGain(); g.gain.value = 0; g.connect(ambBus); return g; };
  // chuva: ruído branco com banda alta + "chiado" grave
  L.rain = mk();
  { const s = loopSrc(noiseB), hp = actx.createBiquadFilter(); hp.type = 'bandpass'; hp.frequency.value = 2600; hp.Q.value = 0.4; s.connect(hp).connect(L.rain);
    const s2 = loopSrc(brownB), lp = actx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420; const g2 = actx.createGain(); g2.gain.value = 0.9; s2.connect(lp).connect(g2).connect(L.rain); }
  // vento: marrom com filtro que "respira"
  L.wind = mk();
  { const s = loopSrc(brownB), f = actx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 380; f.Q.value = 2.5; s.connect(f).connect(L.wind); lfo(0.11, 220, f.frequency);
    const amp = actx.createGain(); amp.gain.value = 0.7; L.wind.disconnect(); L.wind.connect(amp).connect(ambBus); lfo(0.07, 0.3, amp.gain); }
  // mar: ondas lentas
  L.sea = mk();
  { const s = loopSrc(brownB), f = actx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 650; const a = actx.createGain(); a.gain.value = 0.5; s.connect(f).connect(a).connect(L.sea); lfo(0.13, 0.45, a.gain); }
  // insetos: senoide aguda com modulação em rajadas (grilos/cigarras)
  L.insects = mk();
  { [[4300, 23, 0.21], [5100, 31, 0.33]].forEach(([fq, chirp, slow]) => {
      const o = actx.createOscillator(); o.type = 'sine'; o.frequency.value = fq; o.start();
      const a = actx.createGain(); a.gain.value = 0; const b = actx.createGain(); b.gain.value = 0.5;
      o.connect(a).connect(b).connect(L.insects); lfo(chirp, 1, a.gain); lfo(slow, 0.5, b.gain);
    }); }
  // zumbido: 60 Hz + harmônico (energia/gerador)
  L.hum = mk();
  { [60, 120, 180].forEach((fq, i) => { const o = actx.createOscillator(); o.type = i ? 'sine' : 'sawtooth'; o.frequency.value = fq; const g = actx.createGain(); g.gain.value = [0.5, 0.35, 0.15][i];
      const f = actx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 500; o.connect(f).connect(g).connect(L.hum); o.start(); }); }
  // alarme distante: dois tons alternando, muito baixo e abafado
  L.alarm = mk();
  { const o = actx.createOscillator(); o.type = 'square'; o.frequency.value = 740; lfo(0.9, 120, o.frequency); o.start();
    const f = actx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900; const a = actx.createGain(); a.gain.value = 0.5; o.connect(f).connect(a).connect(L.alarm); lfo(0.45, 0.5, a.gain); }
  // tensão: drone grave desafinado + pulso
  L.tension = mk();
  { [55, 55.8, 82.4].forEach((fq, i) => { const o = actx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = fq; const f = actx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 240;
      const g = actx.createGain(); g.gain.value = i === 2 ? 0.25 : 0.5; o.connect(f).connect(g).connect(L.tension); o.start(); });
    const a = actx.createGain(); a.gain.value = 0.75; L.tension.disconnect(); L.tension.connect(a).connect(ambBus); lfo(0.5, 0.25, a.gain); }
  // v7: rio — ruído rosado/marrom contínuo com banda média que oscila (correnteza)
  L.river = mk();
  { const s = loopSrc(brownB), f = actx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 900; f.Q.value = 0.6; s.connect(f).connect(L.river); lfo(0.23, 260, f.frequency);
    const s2 = loopSrc(noiseB), f2 = actx.createBiquadFilter(); f2.type = 'highpass'; f2.frequency.value = 3800; const g2 = actx.createGain(); g2.gain.value = 0.25; s2.connect(f2).connect(g2).connect(L.river); }
  // v7: respiração do ninho — ruído grave que sobe e desce devagar
  L.breath = mk();
  { const s = loopSrc(brownB), f = actx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 260; f.Q.value = 3; s.connect(f);
    const a = actx.createGain(); a.gain.value = 0.5; f.connect(a).connect(L.breath); lfo(0.18, 0.5, a.gain); lfo(0.18, 120, f.frequency); }
}
function applyAmbience(instant) {
  if (!actx || !L.rain) return;
  const P = AMB[ambKey] || AMB.menu, m = ambMods, t = actx.currentTime;
  const target = { ...P };
  if (m.power && ambKey === 'lab') { target.hum = 0.7; target.alarm = 0.15; }
  if (m.power && ambKey === 'pantano') target.hum = 0.9;
  if (m.generator) { target.hum = 1.4; target.alarm = Math.max(target.alarm, 0.6); }
  if (m.lockdown) { target.alarm = 1.6; target.tension = Math.max(target.tension, 0.8); }
  if (m.boss) { target.tension = 1.4; target.wind = Math.max(target.wind, 0.8); }
  if (m.escort) target.tension = Math.max(target.tension, 0.45);
  if (m.hack) { target.alarm = Math.max(target.alarm, 1.4); target.hum = Math.max(target.hum, 1.0); target.tension = Math.max(target.tension, 0.6); }
  if (m.boss && ambKey === 'ninho') { target.breath = 1.6; target.tension = 1.5; }
  if (m.rescue) target.tension = Math.max(target.tension, 0.9);
  for (const k in L) {
    const v = (target[k] || 0) * BASE[k];
    L[k].gain.cancelScheduledValues(t);
    if (instant) L[k].gain.setValueAtTime(v, t); else L[k].gain.setTargetAtTime(v, t, 0.9); // ~2,5 s de crossfade
  }
}
/**
 * Ambiente da área atual (chamar à vontade: só age quando muda).
 * @param {string} key  id da área ou 'menu'
 * @param {object} mods {power, generator, lockdown, boss, escort, rescue}
 */
export function setAmbience(key, mods = {}) {
  const sig = key + '|' + Object.keys(mods).filter((k) => mods[k]).sort().join(',');
  if (sig === ambLast) return; ambLast = sig; ambKey = key; ambMods = mods;
  applyAmbience(false);
}
export const ambienceState = () => ambLast;

// ---------- abafar (cartões de história / pausa) ----------
let muffled = false;
/** Abafa a mistura (passa-baixa + ambiente mais baixo) enquanto um cartão ou a pausa estão abertos. */
export function setMuffle(on) {
  if (on === muffled) return; muffled = on;
  if (!actx) return;
  const t = actx.currentTime;
  muffle.frequency.cancelScheduledValues(t); muffle.frequency.setTargetAtTime(on ? 650 : 20000, t, on ? 0.12 : 0.25);
  ambBus.gain.cancelScheduledValues(t); ambBus.gain.setTargetAtTime(on ? 0.55 : 1, t, 0.2);
  sfxBus.gain.cancelScheduledValues(t); sfxBus.gain.setTargetAtTime(on ? 0.6 : 1, t, 0.2);
}
export const isMuffled = () => muffled;

// ----- efeitos nomeados -----
export const sfx = {
  pistol()  { noise(0.18, 3500, 150, 0.55, 'lowpass', 0, true); tone(180, 60, 0.08, 'square', 0.12, 0, true); },
  shotgun() { noise(0.45, 2200, 120, 0.9, 'lowpass', 0, true); tone(110, 40, 0.18, 'sawtooth', 0.25, 0, true); },
  smg()     { noise(0.09, 4200, 300, 0.38, 'lowpass', 0, true); tone(240 + Math.random() * 30, 90, 0.05, 'square', 0.08, 0, true); }, // v6: rajada curta e seca
  dry()     { tone(900, 800, 0.04, 'square', 0.08); },
  hit()     { if (gate('hit', 0.045)) tone(160 + Math.random() * 30, 90, 0.08, 'square', 0.12); },
  crit()    { if (gate('crit', 0.06)) { tone(1200, 700, 0.07, 'triangle', 0.14); tone(2400, 1800, 0.05, 'sine', 0.05, 0.01); } },
  kill()    { if (gate('kill', 0.08)) { tone(700, 1400, 0.09, 'triangle', 0.16); tone(350, 120, 0.2, 'square', 0.08, 0.04); } },
  reloadStart() { tone(220, 180, 0.1, 'square', 0.1); },
  reloadEnd()   { tone(300, 600, 0.08, 'square', 0.12); },
  swap()    { tone(500, 300, 0.08, 'square', 0.08); },
  pickup()  { tone(600, 1200, 0.15, 'triangle', 0.2); },
  hurt()    { if (gate('hurt', 0.12)) tone(220, 90, 0.25, 'sawtooth', 0.25, 0, true); },
  spit()    { if (gate('spit', 0.1)) { tone(500, 160, 0.25, 'sawtooth', 0.12); noise(0.2, 2000, 400, 0.15, 'bandpass'); } },
  splat()   { if (gate('splat', 0.06)) noise(0.15, 1200, 200, 0.2); },
  crash()   { if (gate('crash', 0.1)) noise(0.4, 600, 80, 0.5, 'lowpass', 0, true); },
  ambush()  { tone(220, 220, 0.25, 'square', 0.1); tone(330, 330, 0.25, 'square', 0.1, 0.3); tone(440, 440, 0.4, 'square', 0.12, 0.6); },
  tick()    { tone(880, 880, 0.05, 'square', 0.06); },
  win()     { tone(300, 900, 0.6, 'triangle', 0.25); tone(450, 1350, 0.6, 'triangle', 0.15, 0.2); },
  thunder(delay = 0) { noise(2.2, 400, 40, 0.7, 'lowpass', delay, true, brownB); noise(0.5, 3000, 300, 0.25, 'lowpass', delay); },
  door()    { noise(0.6, 500, 90, 0.35); tone(90, 60, 0.5, 'sawtooth', 0.08, 0.05); },
  locked()  { if (gate('locked', 0.35)) { tone(160, 150, 0.12, 'square', 0.12); tone(120, 110, 0.18, 'square', 0.12, 0.14); } },
  save()    { tone(523, 523, 0.12, 'triangle', 0.15); tone(659, 659, 0.12, 'triangle', 0.15, 0.13); tone(784, 784, 0.3, 'triangle', 0.16, 0.26); },
  generator() { tone(40, 120, 2.2, 'sawtooth', 0.18, 0, true); noise(2.0, 300, 900, 0.12, 'bandpass'); },
  powerOn() { tone(200, 800, 0.6, 'square', 0.12); tone(400, 1600, 0.6, 'triangle', 0.1, 0.1); },
  explosion() { noise(1.4, 1800, 40, 1.0, 'lowpass', 0, true); tone(80, 30, 0.8, 'sine', 0.5, 0, true); },
  alarm()   { if (gate('alarm', 1)) for (let i = 0; i < 3; i++) { tone(880, 660, 0.35, 'square', 0.08, i * 0.45); } },
  bossRoar() { roar(0.32, 0.6); noise(1.6, 600, 40, 0.5, 'lowpass', 0.1, true); },
  objective() { tone(440, 440, 0.15, 'triangle', 0.14); tone(660, 660, 0.25, 'triangle', 0.14, 0.16); },
  heartbeat() { tone(70, 50, 0.12, 'sine', 0.35); tone(65, 45, 0.12, 'sine', 0.28, 0.18); },
  /** chiado de rádio (início de fala/registro de rádio) */
  radio()   { if (gate('radio', 0.3)) { noise(0.22, 4200, 1800, 0.14, 'bandpass'); tone(1400, 1400, 0.05, 'square', 0.04, 0.2); } },
  /** "chop" do rotor (o diretor chama a cada ~0,11 s; vol cai com a distância) */
  heli(vol = 0.3) { noise(0.09, 260, 60, vol * 0.8, 'lowpass'); },
  /** pisada do Colosso / onda de choque */
  stomp()   { tone(60, 28, 0.35, 'sine', 0.45, 0, true); noise(0.3, 400, 50, 0.3, 'lowpass', 0, false, brownB); },

  // ---------- v5 ----------
  /** Stinger discreto: 'ambush' (acorde menor dissonante subindo) ou 'boss' (impacto grave + cluster). Nunca mais de 1 a cada 3 s. */
  stinger(kind = 'ambush') {
    if (!ok() || !gate('stinger', 3)) return;
    if (kind === 'boss') {
      tone(48, 30, 2.2, 'sine', 0.5, 0, true); noise(1.8, 900, 40, 0.35, 'lowpass', 0, true, brownB);
      [[73.4, 0.09], [77.8, 0.08], [110, 0.06], [146.8, 0.04]].forEach(([f, v], i) => swell(f, f * 0.98, 3.2, 'sawtooth', v, 0.05 + i * 0.04, 0.4, 700));
    } else {
      noise(0.5, 300, 2400, 0.12, 'bandpass', 0, true);            // "puxada" de ar
      [[196, 0.07], [233.1, 0.06], [277.2, 0.05]].forEach(([f, v], i) => swell(f, f * 1.03, 1.3, 'sawtooth', v, 0.02 + i * 0.03, 0.06, 1500));
      tone(98, 60, 0.5, 'sine', 0.25, 0, true);
    }
  },
  /** aviso antes do pisão do Colosso (grave subindo) */
  stompWarn() { if (gate('stompWarn', 0.6)) { swell(40, 90, 0.9, 'sawtooth', 0.12, 0, 0.5, 260); noise(0.9, 120, 500, 0.14, 'lowpass', 0, true, brownB); } },
  /** aviso de investida (bufo + raspar de patas) */
  chargeWarn() { if (gate('chargeWarn', 0.6)) { noise(0.35, 900, 200, 0.22, 'bandpass', 0, true); noise(0.3, 600, 120, 0.18, 'lowpass', 0.4, true, brownB); tone(140, 70, 0.6, 'sawtooth', 0.08, 0.05, true); } },
  /** passo do Colosso/bruto a distância (vol 0..1) */
  thud(vol = 0.3) { if (gate('thud', 0.18)) { tone(55, 32, 0.22, 'sine', 0.3 * vol, 0, false); noise(0.16, 300, 60, 0.18 * vol, 'lowpass', 0, false, brownB); } },
  /** passos da Rocha: kind = walk | run | water; surface = id da área (pedra, lama, concreto...) */
  step(kind = 'walk', surface = '') {
    if (!ok() || !gate('step', 0.17)) return;
    const r = 0.85 + Math.random() * 0.3, v = kind === 'run' ? 0.1 : 0.06;
    if (kind === 'water') {
      noise(0.22, 1600 * r, 300, v * 1.6, 'bandpass'); noise(0.12, 600 * r, 200, v, 'lowpass', 0.03, false, brownB);
    } else if (surface === 'pantano' || surface === 'margem') {
      noise(0.16, 700 * r, 150, v * 1.2, 'lowpass', 0, false, brownB); noise(0.08, 2200 * r, 900, v * 0.4, 'bandpass', 0.02);
    } else if (surface === 'ruinas' || surface === 'ninho') {
      noise(0.07, 2600 * r, 700, v * 1.1, 'bandpass'); tone(180 * r, 120, 0.05, 'triangle', v * 0.3);
    } else if (surface === 'porto') {
      noise(0.09, 1300 * r, 250, v * 1.1, 'bandpass'); tone(110 * r, 70, 0.07, 'sine', v * 0.6); // tábuas/areia molhada
    } else {
      noise(0.08, 1900 * r, 400, v, 'bandpass'); tone(90 * r, 60, 0.05, 'sine', v * 0.5);
    }
  },
  /** jorro de lama (criatura saindo do pântano) */
  mudBurst() { if (gate('mud', 0.25)) { noise(0.7, 500, 80, 0.45, 'lowpass', 0, true, brownB); noise(0.35, 1800, 300, 0.2, 'bandpass', 0.05); } },
  /** porta blindada batendo */
  slam() { noise(0.5, 900, 60, 0.7, 'lowpass', 0, true); tone(70, 40, 0.6, 'square', 0.15, 0, true); tone(1200, 900, 0.15, 'square', 0.05, 0.02); },
  /** sirene curta da diretoria */
  siren() { if (gate('siren', 1.2)) for (let i = 0; i < 2; i++) { tone(620, 980, 0.5, 'sawtooth', 0.06, i * 0.55); } },
  /** levantar a sobrevivente */
  revive() { tone(392, 523, 0.18, 'triangle', 0.14); tone(523, 784, 0.25, 'triangle', 0.12, 0.12); },
};
