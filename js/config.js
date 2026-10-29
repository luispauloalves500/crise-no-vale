// config.js — constantes de jogo (armas, inimigos, chefe, itens, câmera, cores).
// Ajuste o balanceamento aqui sem mexer na lógica. As ÁREAS ficam em areas.js.

export const WORLD = {
  SEED: 1337,
  DOOR_DEPTH: 1.6,      // profundidade da zona de passagem junto à borda
  DOOR_HALF: 2.2,       // meia-largura da passagem
  FADE: 0.4,            // segundos de escurecimento na troca de área (v4: um pouco mais longo p/ cobrir a construção sob demanda)
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
  WATER_MULT: 0.6,      // lama/água do pântano
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
    pellets: 1, reload: 1.1, knock: 3, kick: 0.035, range: 45, crit: 1.6,
    noise: 15, shake: 0.09, xkick: 9, flash: 0.55 },
  { id: 'shotgun', name: 'ESCOPETA', size: 6,  startRes: 6,        dmg: 15, rate: 0.75, spread: 0.11,  aimSpread: 0.075,
    pellets: 8, reload: 1.8, knock: 6, kick: 0.09,  range: 30, crit: 1.3,
    falloffStart: 5, falloffLen: 22, falloffMin: 0.5,     // v5: um pouco mais forte de perto (antes 4 / 0,45)
    noise: 22, shake: 0.24, xkick: 22, flash: 1, resMax: 36 },
  // v6: terceira arma — submetralhadora automática (segure o botão). Dano baixo por tiro, cadência alta.
  { id: 'smg',     name: 'SUBMETRALHADORA', size: 30, startRes: 0, dmg: 13, rate: 0.085, spread: 0.04, aimSpread: 0.014,
    pellets: 1, reload: 1.5, knock: 1.4, kick: 0.022, range: 38, crit: 1.5,
    noise: 17, shake: 0.06, xkick: 6, flash: 0.45, resMax: 120, auto: true },
];
// v5: raio de "barulho" (acorda inimigos em patrulha). Antes: pistola 18, escopeta 26.
export const NOISE = { PISTOL: 15, SHOTGUN: 22, SMG: 17, GRENADE: 30 };
export const SHOTGUN_RES_MAX = 36;
export const SMG_RES_MAX = 120;
// v6: colete — absorve parte do dano até se esgotar
export const ARMOR = { MAX: 50, VEST: 50, ABSORB: 0.6 };

export const GRENADE = {
  MAX: 5, START: 1, FUSE: 1.4, SPEED: 13, UP: 6.5, GRAV: 18,
  RADIUS: 6, DMG: 150, STUN: 2.2, COOLDOWN: 0.8,   // v5: raio 5,5 → 6 (mais confiável contra matilhas)
};

// v5: escolta da Dra. Lima — menos frágil, mas ainda exige atenção
export const ESCORT = {
  GRIT: 2,          // mordidas que ela aguenta antes de cair (a 1ª só a faz cambalear)
  GRIT_REGEN: 7,    // s sem ser mordida para recuperar 1 ponto de fôlego
  DOWN: 4,          // s caída se ninguém ajudar (E perto dela levanta na hora)
  SAFE: 2.2,        // s ignorada pelos inimigos depois de levantar
};

export const INVENTORY = { MED_MAX: 4, MED_START: 1 };

// Silhuetas e cores distintas por tipo (lidas também no radar e no menu)
// shape: forma do corpo usada por buildDino (raptor | spitter | brute)
export const ENEMY_TYPES = {
  raptor:  { name: 'Raptor',   shape: 'raptor', hp: 55,  speed: 6.6, dmg: 12, r: 0.75, scale: 1.0,  score: 100, aggro: 16,
             color: 0x9a6a30, belly: 0xd8b880, stripe: 0x3a2412, eye: 0xffdd33, radar: '#ffa040' },
  spitter: { name: 'Cuspidor', shape: 'spitter', hp: 45,  speed: 3.6, dmg: 9,  r: 0.75, scale: 1.05, score: 150, aggro: 20,
             color: 0x3f7a35, belly: 0xb8d870, stripe: 0x1d3a18, eye: 0xff5522, frill: 0xff7a20, radar: '#8fff60' },
  brute:   { name: 'Bruto',    shape: 'brute', hp: 300, speed: 2.7, dmg: 28, r: 1.7,  scale: 2.1,  score: 500, aggro: 22,
             color: 0x6a2c28, belly: 0xa88468, stripe: 0x2a1210, eye: 0xff2222, horn: 0xe8dcc0, radar: '#ff3030',
             chargeDmg: 32, chargeSpeed: 14, mass: 6 },
  // chefe: bruto alfa gigante com pisão (onda de choque) e chamado de matilha
  colossus:{ name: 'Colosso',  shape: 'brute', hp: 1600, speed: 3.1, dmg: 34, r: 2.6, scale: 3.2, score: 5000, aggro: 99, boss: true,
             color: 0x3c3a44, belly: 0x8a7a6a, stripe: 0x9a1a10, eye: 0xff8a10, horn: 0xf4e8b0, radar: '#ff00ff',
             chargeDmg: 42, chargeSpeed: 17, mass: 30, stompR: 7.5, stompDmg: 26,
             // v5: avisos mais cedo e janelas de atordoamento mais justas
             stompWind: 1.2, windup: 1.3, wallStun: 3.2, stunGrace: 1.4 },
};

export const PICKUPS = {
  MAX_DROPS: 6,          // drops de inimigos simultâneos (itens do mapa não contam)
  MED_HEAL: 40,
  AMMO_SHELLS: 6,
  DROP_MED: 0.10,
  DROP_AMMO: 0.20,
  AMMO_SMG: 30,          // v6: pente de submetralhadora
  DROP_SMG: 0.03,        // v6: chance rara de um inimigo deixar a submetralhadora (se você ainda não tem)
  DROP_VEST_BRUTE: 0.25, // v6: brutos às vezes deixam um colete
};

export const SCORE = { AREA_FIRST: 200, OBJECTIVE: 500, SAVE_PENALTY: 0 };
export const COMBO = { WINDOW: 2.5, MAX: 4 }; // abates seguidos multiplicam pontos

export const FX = {
  MAX_PARTICLES: 320,
  MAX_TRACERS: 24,
  MAX_DECALS: 40,
  RAIN: 900,
  FIREFLIES: 140,
};

export const COLORS = {
  blood: 0x8a0d0d, spark: 0xffd060, spit: 0x9fff40, dust: 0x6a6a5a, fire: 0xff7a20,
  muzzle: 0xffd27a, tracer: 0xffe9a0, med: 0xff5050, ammo: 0xffd040, grenade: 0x70c0ff,
  smg: 0x60ffb0, smgammo: 0xff9a30, vest: 0x5aa0ff, crate: 0xffffff,
};
