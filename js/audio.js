// audio.js — efeitos sonoros procedurais com WebAudio (nenhum arquivo de áudio).
let actx = null, noiseB = null, master = null, muted = false;

/** Cria/retoma o AudioContext (precisa de gesto do usuário). */
export function initAudio() {
  if (!actx) {
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return null;
    actx = new C();
    master = actx.createGain(); master.gain.value = muted ? 0 : 0.5; master.connect(actx.destination);
    noiseB = actx.createBuffer(1, actx.sampleRate, actx.sampleRate);
    const d = noiseB.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    // ambiente: vento/chuva grave em loop
    const amb = actx.createBufferSource(); amb.buffer = noiseB; amb.loop = true;
    const f = actx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 320;
    const g = actx.createGain(); g.gain.value = 0.08;
    amb.connect(f).connect(g).connect(master); amb.start();
  }
  if (actx.state === 'suspended') actx.resume();
  return actx;
}
const ok = () => actx && actx.state === 'running';

export function toggleMute() { muted = !muted; if (master) master.gain.value = muted ? 0 : 0.5; return muted; }

export function noise(dur, f0, f1, vol, type = 'lowpass', delay = 0) {
  if (!ok()) return;
  const t = actx.currentTime + delay, s = actx.createBufferSource(); s.buffer = noiseB;
  const f = actx.createBiquadFilter(); f.type = type;
  f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  const g = actx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  s.connect(f).connect(g).connect(master); s.start(t, Math.random() * 0.5); s.stop(t + dur);
}
export function tone(f0, f1, dur, type, vol, delay = 0) {
  if (!ok()) return;
  const t = actx.currentTime + delay, o = actx.createOscillator(); o.type = type;
  o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  const g = actx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(master); o.start(t); o.stop(t + dur);
}
export function roar(p, vol) {
  if (!ok()) return;
  const t = actx.currentTime, o = actx.createOscillator(); o.type = 'sawtooth';
  o.frequency.setValueAtTime(170 * p, t); o.frequency.linearRampToValueAtTime(240 * p, t + 0.15);
  o.frequency.exponentialRampToValueAtTime(55 * p, t + 0.8);
  const f = actx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900 * p;
  const g = actx.createGain(); g.gain.setValueAtTime(0.001, t); g.gain.linearRampToValueAtTime(vol, t + 0.08);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.85);
  o.connect(f).connect(g).connect(master); o.start(t); o.stop(t + 0.9);
  noise(0.6, 1500 * p, 200, vol * 0.6);
}

// ----- efeitos nomeados -----
export const sfx = {
  pistol()  { noise(0.18, 3500, 150, 0.55); tone(180, 60, 0.08, 'square', 0.12); },
  shotgun() { noise(0.45, 2200, 120, 0.9); tone(110, 40, 0.18, 'sawtooth', 0.25); },
  dry()     { tone(900, 800, 0.04, 'square', 0.08); },
  hit()     { tone(160, 90, 0.08, 'square', 0.12); },
  crit()    { tone(1200, 700, 0.07, 'triangle', 0.14); },
  kill()    { tone(700, 1400, 0.09, 'triangle', 0.16); tone(350, 120, 0.2, 'square', 0.08, 0.04); },
  reloadStart() { tone(220, 180, 0.1, 'square', 0.1); },
  reloadEnd()   { tone(300, 600, 0.08, 'square', 0.12); },
  swap()    { tone(500, 300, 0.08, 'square', 0.08); },
  pickup()  { tone(600, 1200, 0.15, 'triangle', 0.2); },
  hurt()    { tone(220, 90, 0.25, 'sawtooth', 0.25); },
  spit()    { tone(500, 160, 0.25, 'sawtooth', 0.12); noise(0.2, 2000, 400, 0.15, 'bandpass'); },
  splat()   { noise(0.15, 1200, 200, 0.2); },
  crash()   { noise(0.4, 600, 80, 0.5); },
  ambush() { tone(220, 220, 0.25, 'square', 0.1); tone(330, 330, 0.25, 'square', 0.1, 0.3); tone(440, 440, 0.4, 'square', 0.12, 0.6); },
  tick()    { tone(880, 880, 0.05, 'square', 0.06); },
  win()     { tone(300, 900, 0.6, 'triangle', 0.25); tone(450, 1350, 0.6, 'triangle', 0.15, 0.2); },
  thunder(delay = 0) { noise(2.2, 400, 40, 0.7, 'lowpass', delay); noise(0.5, 3000, 300, 0.25, 'lowpass', delay); },
  door()    { noise(0.6, 500, 90, 0.35); tone(90, 60, 0.5, 'sawtooth', 0.08, 0.05); },
  locked()  { tone(160, 150, 0.12, 'square', 0.12); tone(120, 110, 0.18, 'square', 0.12, 0.14); },
  save()    { tone(523, 523, 0.12, 'triangle', 0.15); tone(659, 659, 0.12, 'triangle', 0.15, 0.13); tone(784, 784, 0.3, 'triangle', 0.16, 0.26); },
  generator() { tone(40, 120, 2.2, 'sawtooth', 0.18); noise(2.0, 300, 900, 0.12, 'bandpass'); },
  powerOn() { tone(200, 800, 0.6, 'square', 0.12); tone(400, 1600, 0.6, 'triangle', 0.1, 0.1); },
  explosion() { noise(1.4, 1800, 40, 1.0); tone(80, 30, 0.8, 'sine', 0.5); },
  alarm()   { for (let i = 0; i < 3; i++) { tone(880, 660, 0.35, 'square', 0.08, i * 0.45); } },
  bossRoar() { roar(0.32, 0.6); noise(1.6, 600, 40, 0.5, 'lowpass', 0.1); },
  objective() { tone(440, 440, 0.15, 'triangle', 0.14); tone(660, 660, 0.25, 'triangle', 0.14, 0.16); },
  heartbeat() { tone(70, 50, 0.12, 'sine', 0.35); tone(65, 45, 0.12, 'sine', 0.28, 0.18); },
  /** chiado de rádio (início de fala/registro de rádio) */
  radio()   { noise(0.22, 4200, 1800, 0.14, 'bandpass'); tone(1400, 1400, 0.05, 'square', 0.04, 0.2); },
  /** "chop" do rotor (o diretor chama a cada ~0,11 s; vol cai com a distância) */
  heli(vol = 0.3) { noise(0.09, 260, 60, vol * 0.8, 'lowpass'); },
  /** pisada do Colosso / onda de choque */
  stomp()   { tone(60, 28, 0.35, 'sine', 0.45); noise(0.3, 400, 50, 0.3); },
};
