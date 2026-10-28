// config.js — constantes de jogo (ondas, dano, velocidades, cores).
// Ajuste o balanceamento aqui sem mexer na lógica.

export const WORLD = {
  BOUND: 29,            // meia-largura da arena jogável
  FOG_COLOR: 0x0b1611,
  FOG_DENSITY: 0.030,
  SEED: 1337,
};

export const PLAYER = {
  HP: 100,
  RADIUS: 0.5,
  WALK: 5.2,
  RUN: 8.2,
  BACK_MULT: 0.75,      // andar de costas é mais lento
  AIM_MULT: 0.6,        // mirando (botão direito) anda mais devagar
  RELOAD_MULT: 0.85,
  INVULN: 0.55,         // segundos de invulnerabilidade após dano
  LOW_HP: 30,
};

export const CAMERA = {
  FOV: 65,
  AIM_FOV: 46,
  DIST: 4.6,
  AIM_DIST: 2.7,
  SHOULDER: 0.75,
  HEIGHT: 2.0,
  FOLLOW: 14,           // rigidez do seguimento (maior = mais grudado)
  MIN_DIST: 0.7,
  SENS: 0.0026,
  AIM_SENS: 0.0016,
  PITCH_MIN: -0.55,
  PITCH_MAX: 0.35,
};

export const WEAPONS = [
  { id: 'pistol',  name: 'PISTOLA',  size: 12, startRes: Infinity, dmg: 24, rate: 0.2,  spread: 0.018, aimSpread: 0.006,
    pellets: 1, reload: 1.1, knock: 3, kick: 0.035, range: 45, crit: 1.6 },
  { id: 'shotgun', name: 'ESCOPETA', size: 6,  startRes: 12,       dmg: 15, rate: 0.75, spread: 0.11,  aimSpread: 0.075,
    pellets: 8, reload: 1.8, knock: 6, kick: 0.09,  range: 30, crit: 1.3 },
];
export const SHOTGUN_RES_MAX = 36;

// Silhuetas e cores distintas por tipo (lidas também no radar e no menu)
export const ENEMY_TYPES = {
  raptor:  { name: 'Raptor',   hp: 55,  speed: 6.6, dmg: 12, r: 0.75, scale: 1.0,  score: 100,
             color: 0x9a6a30, belly: 0xd8b880, stripe: 0x3a2412, eye: 0xffdd33, radar: '#ffa040' },
  spitter: { name: 'Cuspidor', hp: 45,  speed: 3.6, dmg: 9,  r: 0.75, scale: 1.05, score: 150,
             color: 0x3f7a35, belly: 0xb8d870, stripe: 0x1d3a18, eye: 0xff5522, frill: 0xff7a20, radar: '#8fff60' },
  brute:   { name: 'Bruto',    hp: 300, speed: 2.7, dmg: 28, r: 1.7,  scale: 2.1,  score: 500,
             color: 0x6a2c28, belly: 0xa88468, stripe: 0x2a1210, eye: 0xff2222, horn: 0xe8dcc0, radar: '#ff3030',
             chargeDmg: 32, chargeSpeed: 14 },
};

// Ritmo das ondas: composição, limite de vivos simultâneos e intervalo entre spawns.
export const WAVES = [
  { mix: { raptor: 4 },                        maxAlive: 4, gap: [1.4, 2.4], intro: 'Raptores farejaram você' },
  { mix: { raptor: 6, spitter: 2 },            maxAlive: 5, gap: [1.2, 2.2], intro: 'Cuspidores nas ruínas — cuidado com o ácido' },
  { mix: { raptor: 7, spitter: 3, brute: 1 },  maxAlive: 6, gap: [1.0, 2.0], intro: 'Algo grande está vindo...' },
  { mix: { raptor: 8, spitter: 4, brute: 2 },  maxAlive: 7, gap: [0.9, 1.8], intro: 'A matilha está furiosa' },
  { mix: { raptor: 10, spitter: 5, brute: 3 }, maxAlive: 8, gap: [0.8, 1.6], intro: 'Último ataque — sobreviva!' },
];
export const INTERMISSION = 6;     // segundos entre ondas (com contagem regressiva)
export const WAVE_CLEAR_BONUS = 250;

export const PICKUPS = {
  MAX: 8,
  MED_HEAL: 35,
  AMMO_SHELLS: 6,
  DROP_MED: 0.18,
  DROP_AMMO: 0.22,
};

export const COMBO = { WINDOW: 2.5, MAX: 4 }; // abates seguidos multiplicam pontos

export const FX = {
  MAX_PARTICLES: 260,
  MAX_TRACERS: 24,
  MAX_DECALS: 40,
  RAIN: 900,
  FIREFLIES: 140,
};

export const COLORS = {
  blood: 0x8a0d0d, spark: 0xffd060, spit: 0x9fff40, dust: 0x6a6a5a,
  muzzle: 0xffd27a, tracer: 0xffe9a0, med: 0xff5050, ammo: 0xffd040,
};
