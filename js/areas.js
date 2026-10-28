// areas.js — definição das ÁREAS conectadas (geometria, clima, portas, itens, inimigos e eventos).
// Cada área é um grupo próprio na cena; só a área atual fica visível e com colisores ativos.
// Coordenadas locais centradas na origem. Norte = -Z, Leste = +X.
import * as THREE from 'three';
import * as W from './world.js';
import { mulberry32 } from './utils.js';
import { WORLD } from './config.js';

const { MATS } = W;

/* Formato de cada área:
 *  id, name, sub          nome no HUD e subtítulo do cartão de entrada
 *  map: {x,y}             posição no mapa esquemático (Tab)
 *  bounds                 retângulo jogável
 *  mood                   clima/iluminação
 *  doors: [{id, side, at, to, toDoor, lock?}]   lock = id de trava avaliada pelo diretor
 *  start?                 ponto inicial (só a primeira área)
 *  pickups: [{id, kind, x, z}]                  itens fixos do mapa (somem ao serem pegos)
 *  ambient: [{type, x, z}]                      inimigos de patrulha (mortos continuam mortos)
 *  encounters: [{id, on, ...}]                  emboscadas / matilhas roteirizadas (ver director.js)
 *  build(ctx) -> refs                           monta a geometria; refs usados pelo diretor
 */

export const AREAS = [
  // ------------------------------------------------------------------ 1. CAIS
  {
    id: 'porto', name: 'CAIS DO PORTO', sub: 'Borda da selva — o barco não volta mais',
    map: { x: 2, y: 4 }, bounds: { minX: -22, maxX: 22, minZ: -18, maxZ: 16 },
    mood: { fog: 0x0b1620, density: 0.026, sky: 0x7a8faa, groundCol: 0x0a0f10, hemi: 1.2, moonCol: 0xa8c0f0, moon: 1.35,
      rain: 1, lightning: true, fireflies: false, exposure: 1.15 },
    start: { x: 0, z: 12, yaw: Math.PI },
    doors: [{ id: 'N', side: 'N', at: 0, to: 'ruinas', toDoor: 'S' }],
    pickups: [
      { id: 'p1med', kind: 'med', x: -15, z: 6 },
      { id: 'p1gren', kind: 'grenade', x: 16, z: -3 },
    ],
    ambient: [{ type: 'raptor', x: -8, z: -12 }, { type: 'raptor', x: 10, z: -13 }],
    encounters: [
      { id: 'porto-crates', on: 'zone', zone: { x: 0, z: -2, r: 5 }, msg: 'Algo se mexe entre os contêineres!',
        spawn: [{ type: 'raptor', from: 'E' }, { type: 'raptor', from: 'W', delay: 0.8 }] },
    ],
    build(ctx) {
      const b = this.bounds;
      W.ground(ctx, b, W.groundTex.sand);
      // mar ao sul + píer de tábuas
      const sea = new THREE.Mesh(new THREE.PlaneGeometry(140, 40), MATS.water); sea.rotation.x = -Math.PI / 2; sea.position.set(0, -0.2, b.maxZ + 21); ctx.group.add(sea);
      W.solid(ctx, 0, b.maxZ - 1, 10, 6, 0.25, MATS.plank, 0, false);
      W.solid(ctx, 0, b.maxZ + 8, 4, 16, 0.25, MATS.plank, -0.1, false);
      for (let i = 0; i < 6; i++) W.solid(ctx, (i % 2 ? 1.8 : -1.8), b.maxZ + 2 + i * 2.6, 0.3, 0.3, 1.2, MATS.bark, -0.8, false);
      // contêineres enferrujados formando corredores
      [[-12, -4, 6, 2.6, MATS.rust], [-12, -7, 6, 2.6, MATS.metal], [12, 2, 2.6, 6, MATS.rust], [8, -8, 6, 2.6, MATS.metal], [-5, 4, 2.6, 5, MATS.rust], [17, -12, 6, 2.6, MATS.rust]]
        .forEach(([x, z, w, d, m]) => W.solid(ctx, x, z, w, d, 2.6, m));
      W.solid(ctx, -12, -5.5, 6, 5.6, 0.2, MATS.rust, 2.6, false);
      [[-3, 8, 1.2], [3.6, 6.5, 1], [14, 8, 1.2], [-16, 10, 1.1], [6, -2, 1], [-18, -12, 1.2]].forEach((c) => W.crate(ctx, ...c));
      // guindaste / galpão
      W.building(ctx, -17, 1, 6, 8, 4.5, MATS.metal, 0.15);
      W.solid(ctx, 17, 10, 0.5, 0.5, 9, MATS.stripe); W.solid(ctx, 13.5, 10, 7.5, 0.5, 0.5, MATS.stripe, 9, false);
      // cerca do lado norte com o portão das ruínas
      W.perimeter(ctx, b, 2.2, MATS.metal, [{ side: 'N', at: 0, half: 2.4 }, { side: 'S', at: 0, half: 30 }], 0.3);
      W.treeRing(ctx, { ...b, maxZ: b.minZ + 1 }, 40, 2, 14, true);
      for (let i = 0; i < 26; i++) { const s = i % 2 ? -1 : 1; W.tree(ctx, s * (b.maxX + 2 + ctx.rng() * 10), b.minZ + ctx.rng() * (b.maxZ - b.minZ), false, 1 + ctx.rng() * 0.8, true); }
      W.grass(ctx, b, 300, 0x3a4a28);
      W.lamp(ctx, -6, 12, 0xffb060); W.lamp(ctx, 7, 10, 0xffa050); W.lamp(ctx, -10, -9.5, 0xff8a40); W.lamp(ctx, 10, -5, 0xff8a40); W.lamp(ctx, 2, -15, 0xff2020, 'pulse', 26);
      return {
        doors: { N: W.doorway(ctx, 'N', 0, b) },
        terminals: [{ id: 'save-porto', kind: 'save', ...W.terminal(ctx, 5, 13, Math.PI), x: 5, z: 13 }],
      };
    },
  },

  // ------------------------------------------------------------------ 2. RUÍNAS
  {
    id: 'ruinas', name: 'CORREDOR DAS RUÍNAS', sub: 'Pedras antigas engolidas pelas raízes',
    map: { x: 2, y: 3 }, bounds: { minX: -8, maxX: 8, minZ: -30, maxZ: 30 },
    mood: { fog: 0x1a120a, density: 0.034, sky: 0xc08a50, groundCol: 0x120c06, hemi: 0.85, moonCol: 0xffc080, moon: 0.55,
      rain: 0.35, lightning: false, fireflies: true, fireflyCol: 0xffc060, exposure: 1.2, moonPos: [8, 40, -4] },
    doors: [{ id: 'S', side: 'S', at: 0, to: 'porto', toDoor: 'N' }, { id: 'N', side: 'N', at: 2, to: 'lab', toDoor: 'S' }],
    pickups: [
      { id: 'p2shotgun', kind: 'shotgun', x: 0, z: -2 },
      { id: 'p2ammo', kind: 'ammo', x: -6, z: 14 },
      { id: 'p2ammo2', kind: 'ammo', x: 6, z: -20 },
    ],
    ambient: [{ type: 'spitter', x: -5, z: -18 }, { type: 'raptor', x: 4, z: -24 }],
    encounters: [
      { id: 'ruinas-ambush', on: 'enter', first: true, delay: 1.2, msg: 'EMBOSCADA! Raptores no corredor!',
        spawn: [{ type: 'raptor', x: -4, z: 4 }, { type: 'raptor', x: 4, z: 6, delay: 0.5 }, { type: 'raptor', from: 'S', delay: 4 }] },
      { id: 'ruinas-return', on: 'enter', flag: 'power', msg: 'A matilha voltou para as ruínas!',
        spawn: [{ type: 'raptor', from: 'N' }, { type: 'raptor', from: 'N', delay: 0.6 }, { type: 'spitter', x: 5, z: -10, delay: 1.5 }] },
    ],
    build(ctx) {
      const b = this.bounds, rng = ctx.rng;
      W.ground(ctx, b, W.groundTex.stone, 16);
      W.perimeter(ctx, b, 6.5, MATS.stone, [{ side: 'S', at: 0, half: 2.4 }, { side: 'N', at: 2, half: 2.4 }], 1.2);
      // colunas e muros quebrados formando chicanes
      for (let z = -26; z <= 26; z += 6.5) { W.solid(ctx, -6.6, z, 1.1, 1.1, 5.5, MATS.stone); W.solid(ctx, 6.6, z + 3, 1.1, 1.1, 5.5, MATS.stone); }
      W.wall(ctx, -3.5, 18, 7, 0.9, 2.2, MATS.stone); W.wall(ctx, 3.8, 9, 6.5, 0.9, 1.6, MATS.stone);
      W.wall(ctx, -4, -9, 6, 0.9, 2.6, MATS.stone); W.wall(ctx, 4, -15, 6, 0.9, 1.4, MATS.stone);
      W.wall(ctx, -3, -23, 5, 0.9, 2.2, MATS.stone);
      // altar com a escopeta
      W.solid(ctx, 0, -2, 2.4, 1.4, 0.6, MATS.stone, 0, false);
      [[-2.5, 22, 0.8], [5, 1, 0.9], [-5, -14, 1.1], [3, -27, 0.7]].forEach(([x, z, s]) => W.rock(ctx, x, z, s));
      // raízes/arcos pendurados
      for (let z = -24; z < 26; z += 9) { const a = W.boxMesh(MATS.stone, 16, 0.8, 1.2); a.position.set(0, 6.2, z); a.castShadow = true; ctx.group.add(a); const v = W.boxMesh(MATS.vine, 14, 1.2, 1.4); v.position.set(0, 5.6, z + 0.2); ctx.group.add(v); }
      for (let i = 0; i < 18; i++) { const v = W.boxMesh(MATS.vine, 0.12, 2 + rng() * 3, 0.12); v.position.set(-7 + rng() * 14, 5.5 - rng(), -28 + rng() * 56); ctx.group.add(v); }
      W.treeRing(ctx, b, 30, 2, 8);
      W.grass(ctx, b, 160, 0x3a3a1e);
      // tochas (luzes laranja) + braseiro
      W.lamp(ctx, -6, 24, 0xff7a20, 'flicker', 18, 2.2); W.lamp(ctx, 6, 12, 0xff8a30, 'flicker', 18, 2.2); W.lamp(ctx, 0, -2, 0xffaa40, 'steady', 14, 1.6);
      W.lamp(ctx, -6, -12, 0xff7a20, 'flicker', 18, 2.2); W.lamp(ctx, 6, -24, 0xff8a30, 'flicker', 18, 2.2);
      return { doors: { S: W.doorway(ctx, 'S', 0, b), N: W.doorway(ctx, 'N', 2, b) }, terminals: [] };
    },
  },

  // ------------------------------------------------------------------ 3. LABORATÓRIO (exterior)
  {
    id: 'lab', name: 'EXTERIOR DO LABORATÓRIO', sub: 'Estação de pesquisa Vale Verde — sem energia',
    map: { x: 2, y: 2 }, bounds: { minX: -24, maxX: 24, minZ: -20, maxZ: 22 },
    mood: { fog: 0x0d1418, density: 0.028, sky: 0x8a9aa0, groundCol: 0x0c0c0a, hemi: 1.0, moonCol: 0xb0c4d8, moon: 1.0,
      rain: 0.9, lightning: true, fireflies: false, exposure: 1.1 },
    doors: [
      { id: 'S', side: 'S', at: 0, to: 'ruinas', toDoor: 'N' },
      { id: 'W', side: 'W', at: 6, to: 'pantano', toDoor: 'E' },
      { id: 'N', side: 'N', at: 0, to: 'patio', toDoor: 'S', lock: 'power' },
    ],
    pickups: [
      { id: 'p3med', kind: 'med', x: 18, z: 14 },
      { id: 'p3ammo', kind: 'ammo', x: -18, z: -12 },
    ],
    ambient: [{ type: 'spitter', x: 12, z: -10 }, { type: 'spitter', x: -12, z: -6 }, { type: 'raptor', x: 16, z: 2 }, { type: 'brute', x: -4, z: -12 }],
    encounters: [
      { id: 'lab-return', on: 'enter', flag: 'power', msg: 'Os alarmes atraíram uma matilha!',
        spawn: [{ type: 'raptor', from: 'W' }, { type: 'raptor', from: 'E', delay: 0.4 }, { type: 'raptor', from: 'N', delay: 1.2 }, { type: 'spitter', from: 'E', delay: 2 }, { type: 'raptor', from: 'W', delay: 3 }] },
    ],
    build(ctx) {
      const b = this.bounds;
      W.ground(ctx, b, W.groundTex.paving);
      W.perimeter(ctx, b, 3, MATS.concrete, [{ side: 'S', at: 0, half: 2.4 }, { side: 'W', at: 6, half: 2.4 }, { side: 'N', at: 0, half: 2.4 }], 0.6);
      // fachada do laboratório ao norte
      W.building(ctx, -14, -16, 16, 6, 8, MATS.concrete, 0.05); W.building(ctx, 14, -16, 16, 6, 8, MATS.concrete, 0.05);
      // prédios / anexos
      W.building(ctx, 17, 8, 8, 10, 5, MATS.metal, 0.1);
      W.building(ctx, -17, 14, 10, 6, 4, MATS.concrete, 0.1);
      // tanques e tubos
      [[-6, 2], [-9, 4]].forEach(([x, z]) => { const t = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 3.6, 12), MATS.metal); t.position.set(x, 1.8, z); t.castShadow = true; ctx.group.add(t); ctx.circles.push({ x, z, r: 1.4, h: 3.6 }); });
      W.solid(ctx, -7.5, 3, 4, 0.4, 0.4, MATS.rust, 3.2, false);
      W.wall(ctx, 6, -4, 7, 0.8, 1.4); W.wall(ctx, 4, 12, 0.8, 6, 2.6); W.wall(ctx, -10, -6, 6, 0.8, 1.6);
      [[8, -6, 1.1], [9.2, -6.2, 0.9], [-14, -2, 1.2], [12, 16, 1], [-2, 16, 1.2]].forEach((c) => W.crate(ctx, ...c));
      W.grass(ctx, b, 200, 0x2a4020);
      W.treeRing(ctx, { ...b, minZ: b.minZ + 8 }, 50, 2, 12);
      // luzes: sódio + alarme vermelho junto ao portão
      const lamps = [W.lamp(ctx, -8, 10, 0xffb050), W.lamp(ctx, 9, 2, 0xffa040), W.lamp(ctx, -18, 4, 0xffb050), W.lamp(ctx, 4, -11, 0xff2020, 'pulse', 28), W.lamp(ctx, -4, -11, 0xff2020, 'pulse', 28)];
      return {
        doors: { S: W.doorway(ctx, 'S', 0, b), W: W.doorway(ctx, 'W', 6, b), N: W.doorway(ctx, 'N', 0, b) },
        terminals: [{ id: 'save-lab', kind: 'save', ...W.terminal(ctx, 6, 18, Math.PI), x: 6, z: 18 }],
        alarmLamps: lamps.slice(3),
      };
    },
  },

  // ------------------------------------------------------------------ 4. PÂNTANO
  {
    id: 'pantano', name: 'TRILHA DO PÂNTANO', sub: 'Lama até os joelhos — o gerador fica no fim da trilha',
    map: { x: 1, y: 2 }, bounds: { minX: -26, maxX: 26, minZ: -18, maxZ: 18 },
    mood: { fog: 0x0e1a0c, density: 0.045, sky: 0x6a8a50, groundCol: 0x080c04, hemi: 1.05, moonCol: 0x9ac080, moon: 0.7,
      rain: 0.6, lightning: false, fireflies: true, fireflyCol: 0xc8ff70, exposure: 1.25 },
    doors: [{ id: 'E', side: 'E', at: 0, to: 'lab', toDoor: 'W' }],
    pickups: [
      { id: 'p4ammo', kind: 'ammo', x: 4, z: -12 },
      { id: 'p4ammo2', kind: 'ammo', x: -14, z: 12 },
      { id: 'p4med', kind: 'med', x: -6, z: -6 },
      { id: 'p4gren', kind: 'grenade', x: 12, z: 12 },
    ],
    ambient: [{ type: 'raptor', x: 0, z: 8 }, { type: 'raptor', x: -10, z: -10 }, { type: 'spitter', x: -16, z: 0 }, { type: 'spitter', x: 8, z: -8 }, { type: 'raptor', x: -18, z: 12 }],
    encounters: [],
    build(ctx) {
      const b = this.bounds, rng = ctx.rng;
      W.ground(ctx, b, W.groundTex.mud);
      // poças (lentas) e água parada
      [[10, 4, 8, 6], [-2, -2, 7, 9], [-14, -10, 9, 5], [-8, 12, 10, 4], [16, -12, 6, 6]].forEach(([x, z, w, d]) => W.pool(ctx, x, z, w, d, MATS.mud));
      // árvores mortas e troncos caídos
      for (let i = 0, n = 0; i < 300 && n < 26; i++) {
        const x = b.minX + 3 + rng() * (b.maxX - b.minX - 6), z = b.minZ + 3 + rng() * (b.maxZ - b.minZ - 6);
        if (Math.abs(z) < 3 && x > 14) continue; // corredor livre até a porta
        if (Math.hypot(x + 21, z) < 6) continue;  // área do gerador
        if (ctx.circles.some((c) => Math.hypot(c.x - x, c.z - z) < 4)) continue;
        W.tree(ctx, x, z, true, 0.9 + rng() * 0.7); n++;
      }
      W.solid(ctx, 4, 12, 6, 0.7, 0.7, MATS.bark); W.solid(ctx, -10, 4, 0.7, 6, 0.7, MATS.bark);
      for (let i = 0; i < 10; i++) W.rock(ctx, b.minX + 4 + rng() * 44, b.minZ + 3 + rng() * 30, 0.4 + rng() * 0.7);
      // galpão do gerador (oeste)
      W.solid(ctx, -24, -4, 3, 0.4, 3.2, MATS.metal); W.solid(ctx, -24, 4, 3, 0.4, 3.2, MATS.metal);
      W.solid(ctx, -25.2, 0, 0.4, 8.4, 3.2, MATS.metal, 0, false); W.solid(ctx, -23.5, 0, 4, 8.6, 0.25, MATS.rust, 3.2, false);
      W.solid(ctx, -22.6, 0, 1.6, 2.2, 1.5, MATS.rust); // o gerador
      const exhaust = W.solid(ctx, -22.8, 0.6, 0.3, 0.3, 1.2, MATS.dark, 1.5, false);
      W.perimeter(ctx, b, 1.2, MATS.bark, [{ side: 'E', at: 0, half: 2.4 }], 0.5);
      W.treeRing(ctx, b, 70, 2, 14);
      W.grass(ctx, b, 520, 0x2a4a1c);
      // lâmpadas apagadas até restaurar a energia
      const lamps = [W.lamp(ctx, -20, -4.5, 0x90ffb0, 'steady', 26), W.lamp(ctx, -8, -12, 0xc0ffa0), W.lamp(ctx, 6, 6, 0xc0ffa0), W.lamp(ctx, 18, -4, 0xc0ffa0)];
      lamps.forEach((L) => { L.on = false; });
      const term = W.terminal(ctx, -20.5, 3, -Math.PI / 2, 0xffb040);
      return { doors: { E: W.doorway(ctx, 'E', 0, b) }, terminals: [{ id: 'generator', kind: 'generator', ...term, x: -20.5, z: 3 }], powerLamps: lamps, exhaust };
    },
  },

  // ------------------------------------------------------------------ 5. PÁTIO
  {
    id: 'patio', name: 'PÁTIO DA INSTALAÇÃO', sub: 'Holofotes brancos — alguém pede socorro pelo rádio',
    map: { x: 2, y: 1 }, bounds: { minX: -24, maxX: 24, minZ: -22, maxZ: 22 },
    mood: { fog: 0x101818, density: 0.022, sky: 0xb0c8c8, groundCol: 0x0c100e, hemi: 1.15, moonCol: 0xd8f0ff, moon: 1.3,
      rain: 0.5, lightning: true, fireflies: false, exposure: 1.1, moonPos: [18, 40, 10] },
    doors: [{ id: 'S', side: 'S', at: 0, to: 'lab', toDoor: 'N' }, { id: 'E', side: 'E', at: -10, to: 'heliponto', toDoor: 'W', lock: 'heliCode' }],
    pickups: [
      { id: 'p5ammo', kind: 'ammo', x: -18, z: -16 },
      { id: 'p5med', kind: 'med', x: 18, z: 16 },
      { id: 'p5gren', kind: 'grenade', x: -4, z: -18 },
      { id: 'p5ammo2', kind: 'ammo', x: 10, z: 4 },
    ],
    ambient: [{ type: 'raptor', x: 10, z: -10 }, { type: 'raptor', x: -10, z: -4 }, { type: 'spitter', x: 16, z: -18 }, { type: 'raptor', x: 0, z: -14 }],
    survivor: { x: -18, z: 16, name: 'Dra. Lima' },
    controlZone: { x: 18, z: -16, r: 3 },
    encounters: [
      { id: 'escort-1', on: 'flag', flag: 'escort', msg: 'Raptores atrás da Dra. Lima!',
        spawn: [{ type: 'raptor', from: 'N' }, { type: 'raptor', from: 'W', delay: 1 }, { type: 'spitter', from: 'N', delay: 2 }] },
      { id: 'escort-2', on: 'zone', flag: 'escort', zone: { x: 4, z: 0, r: 9 }, msg: 'Um BRUTO arrombou o galpão!',
        spawn: [{ type: 'brute', from: 'E' }, { type: 'raptor', from: 'N', delay: 2 }] },
    ],
    build(ctx) {
      const b = this.bounds;
      W.ground(ctx, b, W.groundTex.paving);
      W.perimeter(ctx, b, 4, MATS.concrete, [{ side: 'S', at: 0, half: 2.4 }, { side: 'E', at: -10, half: 2.4 }], 0.8);
      // galpões
      W.building(ctx, -16, -12, 12, 8, 6, MATS.metal, 0.2); W.building(ctx, 15, 6, 10, 10, 6, MATS.metal, 0.2);
      // cabine da guarda (sudoeste) onde está a sobrevivente
      W.solid(ctx, -21, 13, 0.4, 6, 2.8, MATS.concrete); W.solid(ctx, -18, 10.2, 6, 0.4, 2.8, MATS.concrete);
      W.solid(ctx, -18.5, 14, 4, 6.4, 0.2, MATS.metal, 2.8, false);
      // fonte/estátua central quebrada
      const f = new THREE.Mesh(new THREE.CylinderGeometry(3, 3.2, 0.8, 16), MATS.stone); f.position.set(0, 0.4, 2); f.castShadow = f.receiveShadow = true; ctx.group.add(f);
      ctx.circles.push({ x: 0, z: 2, r: 3.1, h: 0.8 });
      W.solid(ctx, 0, 2, 0.9, 0.9, 3.2, MATS.stone); W.rock(ctx, 1.4, 2.6, 0.5, false);
      W.wall(ctx, -6, 12, 6, 0.8, 1.4); W.wall(ctx, 8, -6, 0.8, 6, 1.6); W.wall(ctx, -8, -2, 0.8, 5, 2.4);
      [[-10, 16, 1.2], [6, 14, 1], [14, -6, 1.2], [-2, -10, 1.1], [20, -4, 1]].forEach((c) => W.crate(ctx, ...c));
      W.helipadMark(ctx, 18, -16, 2.6);
      W.grass(ctx, b, 140, 0x2a3a22);
      W.treeRing(ctx, b, 40, 2, 10);
      // holofotes brancos/verdes
      W.lamp(ctx, -12, 4, 0xe0fff0, 'steady', 24, 4); W.lamp(ctx, 10, -12, 0xe0fff0, 'flicker', 24, 4); W.lamp(ctx, 8, 16, 0xd0ffe0, 'steady', 22, 4);
      W.lamp(ctx, -20, 11.5, 0xffd090, 'flicker', 14, 2.6); W.lamp(ctx, 20, -12, 0x30ff60, 'pulse', 20, 3);
      return {
        doors: { S: W.doorway(ctx, 'S', 0, b), E: W.doorway(ctx, 'E', -10, b) },
        terminals: [
          { id: 'save-patio', kind: 'save', ...W.terminal(ctx, -5, 19, Math.PI), x: -5, z: 19 },
          { id: 'control', kind: 'control', ...W.terminal(ctx, 21, -16, -Math.PI / 2, 0x40c0ff), x: 21, z: -16 },
        ],
      };
    },
  },

  // ------------------------------------------------------------------ 6. HELIPONTO
  {
    id: 'heliponto', name: 'HELIPONTO DO PENHASCO', sub: 'Ponto de extração — algo enorme guarda a pista',
    map: { x: 3, y: 1 }, bounds: { minX: -24, maxX: 24, minZ: -24, maxZ: 22 },
    mood: { fog: 0x1a0a0c, density: 0.024, sky: 0xa05050, groundCol: 0x0a0404, hemi: 0.95, moonCol: 0xffb0a0, moon: 1.0,
      rain: 1, lightning: true, fireflies: false, exposure: 1.15, moonPos: [-10, 40, 20] },
    doors: [{ id: 'W', side: 'W', at: -10, to: 'patio', toDoor: 'E', lock: 'bossLock' }],
    pickups: [
      { id: 'p6ammo', kind: 'ammo', x: -18, z: 14 }, { id: 'p6ammo2', kind: 'ammo', x: 18, z: 14 },
      { id: 'p6med', kind: 'med', x: -20, z: 0 }, { id: 'p6gren', kind: 'grenade', x: 20, z: 0 },
    ],
    ambient: [],
    helipad: { x: 0, z: -15, r: 4 },
    encounters: [
      { id: 'boss', on: 'enter', first: true, delay: 1.5, boss: true, msg: 'O COLOSSO bloqueia o heliponto!', spawn: [{ type: 'colossus', x: 0, z: -8 }] },
    ],
    build(ctx) {
      const b = this.bounds, rng = ctx.rng;
      W.ground(ctx, b, W.groundTex.paving, 8);
      // penhasco ao redor (pedras grandes fora dos limites)
      for (let i = 0; i < 40; i++) { const a = rng() * Math.PI * 2, d = 30 + rng() * 8; W.rock(ctx, Math.cos(a) * d, Math.sin(a) * d, 2 + rng() * 3, false); }
      W.perimeter(ctx, b, 1.1, MATS.stripe, [{ side: 'W', at: -10, half: 2.4 }], 0.3);
      W.helipadMark(ctx, 0, -15, 4);
      // coberturas e destroços para se esconder do Colosso
      W.wall(ctx, -10, 6, 6, 1, 2.6); W.wall(ctx, 10, 6, 6, 1, 2.6); W.wall(ctx, -14, -8, 1, 6, 2.2); W.wall(ctx, 14, -8, 1, 6, 2.2);
      [[-4, 14, 1.2], [5, 16, 1.2], [-18, -18, 1.1], [18, -18, 1.1]].forEach((c) => W.crate(ctx, ...c));
      W.building(ctx, 0, 19.5, 14, 3, 4, MATS.concrete, 0.4);
      // antena com luz vermelha
      W.solid(ctx, 20, -20, 0.5, 0.5, 10, MATS.metal);
      W.lamp(ctx, -12, -15, 0xff3020, 'pulse', 30, 3); W.lamp(ctx, 12, -15, 0xff3020, 'pulse', 30, 3); W.lamp(ctx, -16, 10, 0xffa060); W.lamp(ctx, 16, 10, 0xffa060);
      W.lamp(ctx, 0, -20, 0xfff0c0, 'steady', 18, 3);
      return { doors: { W: W.doorway(ctx, 'W', -10, b) }, terminals: [] };
    },
  },
];

export const AREA = Object.fromEntries(AREAS.map((a) => [a.id, a]));

/** Constrói a geometria de todas as áreas (uma vez, na carga). */
export function buildAreas() {
  AREAS.forEach((a, i) => { a.ctx = W.makeCtx(mulberry32(WORLD.SEED + i * 101)); a.refs = a.build(a.ctx); });
}

/** Posição de chegada junto a uma porta (um pouco para dentro da área) e yaw olhando para dentro. */
export function doorArrival(area, doorId) {
  const d = area.doors.find((x) => x.id === doorId), b = area.bounds, inset = WORLD.DOOR_DEPTH + 2.2;
  switch (d.side) {
    case 'N': return { x: d.at, z: b.minZ + inset, yaw: 0 };
    case 'S': return { x: d.at, z: b.maxZ - inset, yaw: Math.PI };
    case 'W': return { x: b.minX + inset, z: d.at, yaw: Math.PI / 2 };
    default:  return { x: b.maxX - inset, z: d.at, yaw: -Math.PI / 2 };
  }
}
