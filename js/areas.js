import { batchBackgroundTrees } from './tree-batching.mjs';
import { buildContactShadows } from './contact-shadows.js';
// areas.js — definição das ÁREAS conectadas (geometria, clima, portas, itens, inimigos e eventos).
// Cada área é um grupo próprio na cena; só a área atual fica visível e com colisores ativos.
// Coordenadas locais centradas na origem. Norte = -Z, Leste = +X.
import * as THREE from 'three';
import * as W from './world.js';
import { mulberry32, labelTex, mergeGeos } from './utils.js';
import { WORLD } from './config.js';
import { collectLod } from './lod.js';

const { MATS } = W;

/* Formato de cada área:
 *  id, name, sub          nome no HUD e subtítulo do cartão de entrada
 *  map: {x,y}             posição no mapa esquemático (Tab)
 *  bounds                 retângulo jogável
 *  mood                   clima/iluminação
 *  doors: [{id, side, at, to, toDoor, lock?}]   lock = id de trava avaliada pelo diretor
 *  start?                 ponto inicial (só a primeira área)
 *  pickups: [{id, kind, x, z}]                  itens fixos do mapa (somem ao serem pegos)
 *  ambient: [{type, x, z}]                      patrulhas renovadas em cada travessia (chefes e história persistem)
 *  encounters: [{id, on, ...}]                  emboscadas / matilhas roteirizadas (ver director.js)
 *  logs: [{id, x, z, yaw}]                      registros (tablets) com a história — texto em story.js
 *  build(ctx) -> refs                           monta a geometria; refs usados pelo diretor
 */

// Pintura e balizadores estáticos do cais em UM lote (sem luzes/sprites extras).
function quayHelipad(ctx, { x, z, r }) {
  const ring = new THREE.RingGeometry(r, r + 0.3, 40), box = new THREE.BoxGeometry(1, 1, 1);
  const parts = [{ geo: ring, r: [-Math.PI / 2, 0, 0], p: [x, 0.025, z], c: 0xe6bf38 }];
  for (const [dx, w, d] of [[-0.7, 0.3, 2.2], [0.7, 0.3, 2.2], [0, 1.4, 0.3]])
    parts.push({ geo: box, s: [w, 0.02, d], p: [x + dx, 0.03, z], c: 0xe6bf38 });
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4;
    parts.push({ geo: box, s: [0.18, 0.1, 0.18], p: [x + Math.cos(a) * (r + 0.6), 0.05, z + Math.sin(a) * (r + 0.6)], c: 0x60ff90 });
  }
  const geo = mergeGeos(parts); ring.dispose(); box.dispose();
  ctx.group.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true })));
}

// Porta e estribo leves: compartilhados pelas duas aeronaves de resgate, sem novos modelos/texturas.
function rescueHelicopter() {
  const heli = W.helicopter(false), g = heli.group;
  const opening = W.boxMesh(MATS.dark, 0.06, 1.7, 1.5); opening.position.set(1.31, 1.4, 0.25); g.add(opening);
  const door = W.boxMesh(MATS.metal, 0.08, 1.65, 1.45); door.position.set(1.38, 1.4, -1.6); g.add(door);
  const step = W.boxMesh(MATS.post, 0.65, 0.12, 1.3); step.position.set(1.5, 0.25, 0.25); g.add(step);
  heli.boardingDoor = door;
  return heli;
}

/** Barco atracado + sinalizador físico; ativados junto com o ponto E e o radar. */
function extractionSite(ctx, point, final = false) {
  const group = new THREE.Group(); group.name = 'extraction-site'; group.position.set(point.x, 0, point.z); group.visible = false; ctx.group.add(group);
  const boat = new THREE.Group(); boat.position.set(0, .2, 6); group.add(boat);
  const part = (mat,w,h,d,x,y,z) => { const m=W.boxMesh(mat,w,h,d); m.position.set(x,y,z); boat.add(m); return m; };
  part(MATS.metal,4.8,1.1,7.2,0,.2,0); part(MATS.plank,4.4,.15,6.7,0,.85,0);
  part(MATS.concrete,2.7,1.8,2.5,0,1.7,1); part(MATS.metal,3.2,.2,3,0,2.65,1);
  part(MATS.glass,2.2,.7,.1,0,1.9,-.3); part(MATS.hazard,4.9,.22,7.3,0,.55,0);
  const gangway=W.boxMesh(MATS.plank,2.2,.16,4); gangway.position.set(0,.18,2); group.add(gangway);
  const beam=new THREE.Mesh(new THREE.CylinderGeometry(.16,.55,9,12,1,true),new THREE.MeshBasicMaterial({color:0x70ffdc,transparent:true,opacity:.24,depthWrite:false})); beam.position.set(0,4.5,0); group.add(beam);
  const ring=new THREE.Mesh(new THREE.RingGeometry(1.8,2.15,40),new THREE.MeshBasicMaterial({color:0x70ffdc,transparent:true,opacity:.9,side:THREE.DoubleSide})); ring.rotation.x=-Math.PI/2; ring.position.y=.06; group.add(ring);
  const flare=new THREE.Mesh(new THREE.CylinderGeometry(.1,.1,.65,8),MATS.hazard);flare.position.set(2.6,.35,0);group.add(flare);
  const flame=new THREE.Sprite(new THREE.SpriteMaterial({map:W.GLOW,color:0x60ffd0,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false}));flame.scale.set(1.3,2,1);flame.position.set(2.6,1.2,0);group.add(flame);
  const lamp=new THREE.PointLight(0x60ffd0,32,22,2); lamp.position.set(0,2,0); group.add(lamp);
  const sign=new THREE.Mesh(new THREE.PlaneGeometry(4.4,1),new THREE.MeshBasicMaterial({map:labelTex('EMBARQUE  [E]',final?'EVACUAÇÃO FINAL':'BARCO → SETOR ZERO'),side:THREE.DoubleSide,transparent:true})); sign.position.set(0,3.4,0); group.add(sign);
  return {group,boat,beam,ring,lamp,sign};
}
function areaSign(ctx,x,z,title,sub) {
  const sign=new THREE.Mesh(new THREE.PlaneGeometry(4.6,1.2),new THREE.MeshBasicMaterial({map:labelTex(title,sub),side:THREE.DoubleSide})); sign.position.set(x,2.8,z); ctx.group.add(sign);
}

export const AREAS = [
  // ------------------------------------------------------------------ 1. CAIS
  {
    id: 'porto', save: true, name: 'CAIS DO PORTO', sub: 'Borda da selva — o barco não volta mais',
    map: { x: 2, y: 4 }, bounds: { minX: -22, maxX: 22, minZ: -18, maxZ: 26 },
    quayPad: { x: 13, z: 17, r: 5.8 },
    mood: { fog: 0x0b1620, density: 0.026, sky: 0x7a8faa, groundCol: 0x0a0f10, hemi: 1.2, moonCol: 0xa8c0f0, moon: 1.35,
      rain: 1, lightning: true, fireflies: false, exposure: 1.15,
      // perf: o cais é a 1ª área (shaders frios + modelos carregando) — menos gotas em Baixo/Médio
      rainBudget: { baixo: 0.6, medio: 0.75 } },
    start: { x: 0, z: 12, yaw: Math.PI },
    doors: [{ id: 'N', side: 'N', at: 0, to: 'ruinas', toDoor: 'S' }],
    pickups: [
      { id: 'p1med', kind: 'med', x: -15, z: 6 },
      { id: 'p1ammo', kind: 'ammo', x: 2, z: 9 },
      { id: 'p1gren', kind: 'grenade', x: 16, z: -3 },
    ],
    ambient: [{ type: 'raptor', x: -8, z: -12 }, { type: 'raptor', x: 10, z: -13 }],
    logs: [{ id: 'log1', x: -1.6, z: 10.6, yaw: 0.4 }],
    encounters: [
      { id: 'porto-crates', on: 'zone', zone: { x: 0, z: -2, r: 5 }, msg: 'Algo se mexe entre os contêineres!',
        spawn: [{ type: 'raptor', from: 'E' }, { type: 'raptor', from: 'W', delay: 0.8 }] },
    ],
    build(ctx) {
      const b = this.bounds, shore = 16;
      W.ground(ctx, { ...b, maxZ: shore }, W.groundTex.sand, 30, { puddles: 8, patchCol: 0x1a160c });
      // mar ao sul + píer de tábuas
      const sea = new THREE.Mesh(new THREE.PlaneGeometry(140, 40), MATS.water); sea.rotation.x = -Math.PI / 2; sea.position.set(0, -0.2, shore + 21); ctx.group.add(sea);
      W.solid(ctx, 0, shore - 1, 10, 6, 0.25, MATS.plank, 0, false);
      W.solid(ctx, 0, shore + 8, 4, 16, 0.25, MATS.plank, -0.1, false);
      for (let i = 0; i < 6; i++) W.solid(ctx, (i % 2 ? 1.8 : -1.8), shore + 2 + i * 2.6, 0.3, 0.3, 1.2, MATS.bark, -0.8, false);
      // contêineres enferrujados formando corredores
      [[-12, -4, 6, 2.6, 0x8a4a2a], [-12, -7, 6, 2.6, 0x2a5a6a], [15, -2, 2.6, 6, 0x8a4a2a], [8, -8, 6, 2.6, 0x7a6a24], [-5, 4, 2.6, 5, 0x6a2a24]]
        .forEach(([x, z, w, d, c]) => W.container(ctx, x, z, w, d, 2.6, c));
      W.solid(ctx, -12, -5.5, 6.1, 5.7, 0.2, MATS.rust, 2.6, false);
      [[-3, 8, 1.2], [3.6, 6.5, 1], [18, -11, 1.2], [-16, 10, 1.1], [6, -2, 1], [-18, -12, 1.2]].forEach((c) => W.crate(ctx, ...c));
      // guindaste / galpão
      W.building(ctx, -17, 1, 6, 8, 4.5, MATS.metal, 0.15);
      // barco abandonado no fim do píer (quem trouxe a agente já fugiu — este é o da estação, afundado)
      const hull = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 0.7, 6, 8, 1, false, 0, Math.PI), MATS.rust);
      hull.rotation.set(Math.PI / 2, 0, Math.PI); hull.position.set(5, -0.35, shore + 12); hull.rotation.y = 0.3; ctx.group.add(hull);
      // Guindaste passa para o cais de carga oeste, fora do corredor aéreo.
      W.solid(ctx, -19, 10, 0.5, 0.5, 9, MATS.stripe); W.solid(ctx, -15.5, 10, 7.5, 0.5, 0.5, MATS.stripe, 9, false);
      // Plataforma aberta sobre a água, ligada à terra pela faixa leste; nunca bloqueia o portão norte.
      W.solid(ctx, 13, 17, 16, 16, 0.24, MATS.concrete, -0.24, false);
      quayHelipad(ctx, this.quayPad);
      const heli = rescueHelicopter(); heli.group.visible = false; ctx.group.add(heli.group);
      // Fora dos pisos do píer e da plataforma é água, não chão invisível caminhável.
      ctx.boxes.push(...[
        [-22, -2, 18, 26], [-22, -5, 16, 18], [2, 5, 18, 26], [21, 22, 16, 26], [5, 21, 25, 26],
      ].map(([minX, maxX, minZ, maxZ]) => ({ minX, maxX, minZ, maxZ, h: 0.2 })));
      // cerca do lado norte com o portão das ruínas
      W.perimeter(ctx, b, 2.2, MATS.metal, [{ side: 'N', at: 0, half: 2.4 }, { side: 'S', at: 0, half: 30 }], 0.3);
      W.treeRing(ctx, { ...b, maxZ: b.minZ + 1 }, 40, 2, 14, true);
      for (let i = 0; i < 26; i++) { const s = i % 2 ? -1 : 1; W.tree(ctx, s * (b.maxX + 2 + ctx.rng() * 10), b.minZ + ctx.rng() * (b.maxZ - b.minZ), false, 1 + ctx.rng() * 0.8, true); }
      W.grass(ctx, { ...b, maxX: 5, maxZ: shore - 1 }, 220, 0x3a4a28);
      W.lamp(ctx, -6, 12, 0xffb060); W.lamp(ctx, 7, 10, 0xffa050); W.lamp(ctx, -10, -9.5, 0xff8a40); W.lamp(ctx, 10, -5, 0xff8a40); W.lamp(ctx, 2, -15, 0xff2020, 'pulse', 26);
      return {
        heli, doors: { N: W.doorway(ctx, 'N', 0, b) },
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
    logs: [{ id: 'log2', x: -5, z: 4, yaw: Math.PI / 2 }],
    encounters: [
      { id: 'ruinas-ambush', on: 'enter', first: true, delay: 1.2, msg: 'EMBOSCADA! Raptores no corredor!',
        spawn: [{ type: 'raptor', x: -4, z: 4 }, { type: 'raptor', x: 4, z: 6, delay: 0.5 }, { type: 'raptor', from: 'S', delay: 4 }] },
      { id: 'ruinas-return', on: 'enter', flag: 'power', revisitFrom: 'lab', warning: 'Rugidos na mata — o alarme atraiu predadores às ruínas!',
        spawn: [{ type: 'raptor', from: 'S' }, { type: 'raptor', from: 'S', delay: 0.6 }, { type: 'spitter', from: 'S', delay: 1.5 }] },
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
      // laje rachada do altar: a câmara selada onde acharam o âmbar (brilho âmbar saindo das frestas)
      const slab = W.boxMesh(MATS.stone, 3.4, 0.12, 2.2); slab.position.set(0, 0.06, -4.2); slab.rotation.y = 0.12; ctx.group.add(slab);
      const crack = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.12), new THREE.MeshBasicMaterial({ color: 0xffa030 }));
      crack.rotation.set(-Math.PI / 2, 0, 0.5); crack.position.set(0, 0.13, -4.2); ctx.group.add(crack);
      Object.assign(W.fireLight(ctx, 0, -4.2, -0.3, 8), { color: 0xffa030, mode: 'pulse' });
      [[-2.5, 22, 0.8], [5, 1, 0.9], [-5, -14, 1.1], [3, -27, 0.7]].forEach(([x, z, s]) => W.rock(ctx, x, z, s));
      // raízes/arcos pendurados
      for (let z = -24; z < 26; z += 9) { const a = W.boxMesh(MATS.stone, 16, 0.8, 1.2); a.position.set(0, 6.2, z); a.castShadow = true; ctx.group.add(a); const v = W.boxMesh(MATS.vine, 14, 1.2, 1.4); v.position.set(0, 5.6, z + 0.2); ctx.group.add(v); }
      for (let i = 0; i < 18; i++) { const v = W.boxMesh(MATS.vine, 0.12, 2 + rng() * 3, 0.12); v.position.set(-7 + rng() * 14, 5.5 - rng(), -28 + rng() * 56); ctx.group.add(v); }
      W.treeRing(ctx, b, 30, 2, 8);
      W.grass(ctx, b, 160, 0x3a3a1e);
      // tochas (luzes laranja) + braseiro
      W.lamp(ctx, -6, 24, 0xff7a20, 'flicker', 18, 2.2); W.lamp(ctx, 6, 12, 0xff8a30, 'flicker', 18, 2.2); W.lamp(ctx, 0, -2, 0xffaa40, 'steady', 14, 1.6);
      W.lamp(ctx, -6, -12, 0xff7a20, 'flicker', 18, 2.2);
      return { doors: { S: W.doorway(ctx, 'S', 0, b), N: W.doorway(ctx, 'N', 2, b) }, terminals: [] };
    },
  },

  // ------------------------------------------------------------------ 3. LABORATÓRIO (exterior)
  {
    id: 'lab', save: true, name: 'EXTERIOR DO LABORATÓRIO', sub: 'Estação de pesquisa Vale Verde — sem energia', subPower: 'Estação de pesquisa Vale Verde — energia restabelecida',
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
      { id: 'p3gren', kind: 'grenade', x: -14, z: 15.2 }, // dentro da sala da diretoria
      // v6: submetralhadora caída junto ao anexo leste (atrás do caminhão de suprimentos) e um pente extra
      { id: 'p3smg', kind: 'smg', x: 20, z: -6 },
      { id: 'p3smgammo', kind: 'smgammo', x: 4, z: 8 },
    ],
    ambient: [{ type: 'spitter', x: 12, z: -10 }, { type: 'spitter', x: -12, z: -6 }, { type: 'raptor', x: 16, z: 2 }, { type: 'brute', x: -4, z: -12 }],
    logs: [{ id: 'log3', x: 21.5, z: 17, yaw: -Math.PI / 2 }, { id: 'log5', x: -20.4, z: 15.4, yaw: Math.PI / 2 }],

    encounters: [
      { id: 'lab-return', on: 'enter', flag: 'power', revisitFrom: 'pantano', warning: 'Sirene ativa — rugidos se aproximam pelo complexo!',
        spawn: [{ type: 'raptor', from: 'E' }, { type: 'raptor', from: 'N', delay: 0.8 }, { type: 'spitter', from: 'E', delay: 1.8 }] },
      // v5: "Protocolo da diretoria" — ao entrar na sala do Brandt, a porta blindada bate e o alarme chama a matilha
      // (beat roteirizado em director.js → BEAT.lockdown; os spawns ficam esperando no corredor quando a porta reabre)
      { id: 'lab-lockdown', on: 'zone', flag: 'power', zone: { x: -17, z: 14.4, r: 2 }, beat: 'lockdown',
        spawn: [{ type: 'raptor', x: -15, z: 6, delay: 7.2 }, { type: 'raptor', x: -20, z: 7, delay: 7.6 }, { type: 'spitter', x: -12, z: 3, delay: 8.2 }] },
    ],
    build(ctx) {
      const b = this.bounds;
      W.ground(ctx, b, W.groundTex.paving, 30, { puddles: 12 });
      W.perimeter(ctx, b, 3, MATS.concrete, [{ side: 'S', at: 0, half: 2.4 }, { side: 'W', at: 6, half: 2.4 }, { side: 'N', at: 0, half: 2.4 }], 0.6);
      // fachada do laboratório ao norte
      W.building(ctx, -14, -16, 16, 6, 8, MATS.concrete, 0.55, { power: true }); W.building(ctx, 14, -16, 16, 6, 8, MATS.concrete, 0.55, { power: true });
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(6, 1.2), new THREE.MeshBasicMaterial({ map: labelTex('FUNDAÇÃO TELLUS', 'ESTAÇÃO DE PESQUISA VALE VERDE'), transparent: true }));
      sign.position.set(-14, 6.4, -12.94); ctx.group.add(sign);
      // prédios / anexos
      W.building(ctx, 17, 8, 8, 10, 5, MATS.metal, 0.4, { power: true });
      // sala da diretoria (anexo oeste): porta blindada só abre com energia
      const R = { x0: -22, x1: -12, z0: 11, z1: 17, h: 4 };
      W.solid(ctx, -20.1, R.z0, 3.8, 0.4, R.h); W.solid(ctx, -13.9, R.z0, 3.8, 0.4, R.h); W.solid(ctx, -17, R.z0 - 0.02, 2.4, 0.45, 0.8, MATS.concrete, R.h - 0.8, false);
      W.solid(ctx, -17, R.z1, 10.4, 0.4, R.h); W.solid(ctx, R.x0, 14, 0.4, 6, R.h); W.solid(ctx, R.x1, 14, 0.4, 6, R.h);
      for (const bz of [12.5, 15.5]) { const beam = W.boxMesh(MATS.metal, 10.4, 0.3, 0.3); beam.position.set(-17, R.h - 0.1, bz); ctx.group.add(beam); }
      W.solid(ctx, -17, 16.2, 3, 0.8, 0.9, MATS.plank); W.solid(ctx, -21.4, 13, 0.6, 2.4, 2.2, MATS.metal);
      W.solid(ctx, -12.6, 12.8, 0.6, 1.8, 1.6, MATS.metal);
      const slab = W.solid(ctx, -17, R.z0, 2.4, 0.3, 3.2, MATS.metal); const slabBox = ctx.boxes[ctx.boxes.length - 1];
      const dsign = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.55), new THREE.MeshBasicMaterial({ map: labelTex('DIRETORIA', 'ACESSO RESTRITO — O. BRANDT'), transparent: true }));
      dsign.position.set(-17, 3.6, R.z0 - 0.25); dsign.rotation.y = Math.PI; ctx.group.add(dsign);
      // tanques e tubos
      [[-6, 2], [-9, 4]].forEach(([x, z]) => { const t = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 3.6, 12), MATS.metal); t.position.set(x, 1.8, z); t.castShadow = true; ctx.group.add(t); ctx.circles.push({ x, z, r: 1.4, h: 3.6 }); });
      W.solid(ctx, -7.5, 3, 4, 0.4, 0.4, MATS.rust, 3.2, false);
      W.wall(ctx, 6, -4, 7, 0.8, 1.4); W.wall(ctx, 4, 12, 0.8, 6, 2.6); W.wall(ctx, -10, -6, 6, 0.8, 1.6);
      [[8, -6, 1.1], [9.2, -6.2, 0.9], [-14, -2, 1.2], [12, 16, 1], [-2, 16, 1.2]].forEach((c) => W.crate(ctx, ...c));
      W.grass(ctx, b, 200, 0x2a4020);
      W.treeRing(ctx, { ...b, minZ: b.minZ + 8 }, 50, 2, 12);
      // luzes: sódio + alarme vermelho junto ao portão
      const lamps = [W.lamp(ctx, -8, 10, 0xffb050), W.lamp(ctx, 9, 2, 0xffa040), W.lamp(ctx, -18, 4, 0xffb050), W.lamp(ctx, 4, -11, 0xff2020, 'pulse', 28), W.lamp(ctx, -4, -11, 0xff2020, 'pulse', 28)];
      const roomLamp = W.lamp(ctx, -17, 14, 0xfff0d0, 'steady', 18, 3.4); roomLamp.on = false;
      return {
        sideDoor: { mesh: slab, box: slabBox }, powerLamps: [roomLamp], roomLamp,
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
      { id: 'p4crate', kind: 'crate', x: 20, z: 10 }, // v6: caixa de suprimentos brilhante
    ],
    ambient: [{ type: 'raptor', x: 0, z: 8 }, { type: 'raptor', x: -10, z: -10 }, { type: 'spitter', x: -16, z: 0 }, { type: 'spitter', x: 8, z: -8 }, { type: 'raptor', x: -18, z: 12 }],
    logs: [{ id: 'log4', x: -19.4, z: -2.6, yaw: -Math.PI / 2 }, { id: 'log8', x: 21, z: -15.5, yaw: -Math.PI / 2 }], // v6: log8 na margem leste
    encounters: [
      // v5: "A lama ferve" — perto da poça central, dois raptores saem de dentro da lama (bolhas e ronco avisam antes)
      { id: 'pantano-lama', on: 'zone', zone: { x: -2, z: -2, r: 6.5 }, beat: 'mud', msg: 'A lama está fervendo — tem algo embaixo!',
        spawn: [{ type: 'raptor', x: -3.5, z: -5.5, delay: 1.6, fx: 'mud' }, { type: 'raptor', x: -0.5, z: 2, delay: 2.4, fx: 'mud' }] },
    ],
    build(ctx) {
      const b = this.bounds, rng = ctx.rng;
      ctx.treeStyle = 'swamp';
      W.ground(ctx, b, W.groundTex.mud, 30, { patchCol: 0x0a1006, puddles: 14 });
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
      // v6: caixa RAIZ arrebentada na margem leste, junto ao registro 8 (só visual, sem colisão)
      const raiz = W.boxMesh(MATS.rust, 1.3, 0.7, 0.9); raiz.position.set(22.6, 0.3, -16.6); raiz.rotation.set(0.25, 0.7, 0.15); ctx.group.add(raiz);
      const lid = W.boxMesh(MATS.metal, 1.3, 0.08, 0.9); lid.position.set(23.4, 0.05, -14.6); lid.rotation.y = -0.4; ctx.group.add(lid);
      const term = W.terminal(ctx, -20.5, 3, -Math.PI / 2, 0xffb040);
      return { doors: { E: W.doorway(ctx, 'E', 0, b) }, terminals: [{ id: 'generator', kind: 'generator', ...term, x: -20.5, z: 3 }], powerLamps: lamps, exhaust };
    },
  },

  // ------------------------------------------------------------------ 5. PÁTIO
  {
    id: 'patio', save: true, name: 'PÁTIO DA INSTALAÇÃO', sub: 'Holofotes brancos — alguém pede socorro pelo rádio',
    map: { x: 2, y: 1 }, bounds: { minX: -24, maxX: 24, minZ: -22, maxZ: 22 },
    mood: { fog: 0x101818, density: 0.022, sky: 0xb0c8c8, groundCol: 0x0c100e, hemi: 1.15, moonCol: 0xd8f0ff, moon: 1.3,
      rain: 0.5, lightning: true, fireflies: false, exposure: 1.1, moonPos: [18, 40, 10],
      spots: [{ x: -22.5, h: 9.5, z: -20.5, tx: -4, tz: 0, color: 0xe8fff0, sweep: 10, speed: 0.35 }, { x: 22.5, h: 9.5, z: 20.5, tx: 2, tz: 4, color: 0xd8fff0, sweep: 9, speed: 0.27 }] },
    doors: [{ id: 'S', side: 'S', at: 0, to: 'lab', toDoor: 'N' }, { id: 'E', side: 'E', at: -10, to: 'heliponto', toDoor: 'W', lock: 'heliCode' }],
    pickups: [
      { id: 'p5ammo', kind: 'ammo', x: -18, z: -16 },
      { id: 'p5med', kind: 'med', x: 18, z: 16 },
      { id: 'p5gren', kind: 'grenade', x: -4, z: -18 },
      { id: 'p5ammo2', kind: 'ammo', x: 10, z: 4 },
      // v6: colete no canto do galpão oeste, pente de submetralhadora e caixa de suprimentos
      { id: 'p5vest', kind: 'vest', x: -14, z: -4 },
      { id: 'p5smgammo', kind: 'smgammo', x: -2, z: 15 },
      { id: 'p5crate', kind: 'crate', x: 12, z: -14 },
    ],
    ambient: [{ type: 'raptor', x: 10, z: -10 }, { type: 'raptor', x: -10, z: -4 }, { type: 'spitter', x: 16, z: -18 }, { type: 'raptor', x: 0, z: -14 }],
    survivor: { x: -18, z: 16, name: 'Dra. Lima' },
    logs: [{ id: 'log6', x: 13, z: 19, yaw: Math.PI }],
    controlZone: { x: 18, z: -16, r: 3 },
    encounters: [
      { id: 'escort-1', on: 'flag', flag: 'escort', msg: 'Raptores atrás da Dra. Lima!',
        spawn: [{ type: 'raptor', from: 'N' }, { type: 'raptor', from: 'W', delay: 1 }, { type: 'spitter', from: 'N', delay: 2 }] },
      { id: 'escort-2', on: 'zone', flag: 'escort', zone: { x: 4, z: 0, r: 9 }, msg: 'Um BRUTO arrombou o galpão!',
        spawn: [{ type: 'brute', from: 'E' }, { type: 'raptor', from: 'N', delay: 2 }] },
    ],
    build(ctx) {
      const b = this.bounds;
      W.ground(ctx, b, W.groundTex.paving, 30, { puddles: 12 });
      W.perimeter(ctx, b, 4, MATS.concrete, [{ side: 'S', at: 0, half: 2.4 }, { side: 'E', at: -10, half: 2.4 }], 0.8);
      // galpões
      W.building(ctx, -16, -12, 12, 8, 6, MATS.metal, 0.5, { power: true }); W.building(ctx, 15, 6, 10, 10, 6, MATS.metal, 0.5, { power: true });
      // torres dos holofotes
      for (const [x, z] of [[-22.5, -20.5], [22.5, 20.5]]) { W.solid(ctx, x, z, 0.6, 0.6, 9.2, MATS.metal); const hd = W.boxMesh(MATS.dark, 1.2, 0.8, 1.2); hd.position.set(x, 9.6, z); ctx.group.add(hd); }
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
    id: 'heliponto', name: 'HELIPONTO DO PENHASCO', sub: 'Plataforma de extração sobre o rio — pista livre para o Garça-1',
    map: { x: 3, y: 1 }, bounds: { minX: -24, maxX: 24, minZ: -30, maxZ: 22 },
    mood: { fog: 0x1a0a0c, density: 0.024, sky: 0xa05050, groundCol: 0x0a0404, hemi: 0.95, moonCol: 0xffb0a0, moon: 1.0,
      rain: 1, lightning: true, fireflies: false, exposure: 1.15, moonPos: [-10, 40, 20],
      spots: [{ x: 20, h: 10, z: -20, tx: 0, tz: -8, color: 0xffe0d0, sweep: 9, speed: 0.3 }, { x: -21.5, h: 7.5, z: 19, tx: 0, tz: -4, color: 0xffd8c8, sweep: 8, speed: 0.42 }] },
    // Portão norte para o Ato 2 (trilha do rio) — só abre depois que o Colosso cai
    doors: [{ id: 'W', side: 'W', at: -10, to: 'patio', toDoor: 'E', lock: 'bossLock' }, { id: 'N', side: 'N', at: -10, to: 'margem', toDoor: 'W', lock: 'act2Gate' }],
    pickups: [
      { id: 'p6ammo', kind: 'ammo', x: -18, z: 14 }, { id: 'p6ammo2', kind: 'ammo', x: 18, z: 14 },
      { id: 'p6med', kind: 'med', x: -20, z: 0 }, { id: 'p6gren', kind: 'grenade', x: 20, z: 0 },
      { id: 'p6crate', kind: 'crate', x: -12, z: 15 }, // v6
    ],
    ambient: [{ type: 'raptor', x: -8, z: 12 }, { type: 'raptor', x: 8, z: 12 }],
    logs: [{ id: 'log7', x: 6.6, z: -19.2, yaw: 0.3 }, { id: 'log9', x: -19.5, z: -12, yaw: Math.PI / 2 }], // v6: log9 = rádio de campo da Tellus-2
    helipad: { x: 0, z: -19, r: 5.8 },
    encounters: [
      { id: 'boss', on: 'enter', first: true, delay: 1.5, boss: true, msg: 'O COLOSSO bloqueia o heliponto!', spawn: [{ type: 'colossus', x: 0, z: -8 }] },
    ],
    build(ctx) {
      const b = this.bounds, rng = ctx.rng;
      W.ground(ctx, b, W.groundTex.paving, 8, { puddles: 10 });
      // penhasco ao redor (pedras grandes fora dos limites)
      for (let i = 0; i < 40; i++) {
        const a = rng() * Math.PI * 2, d = 30 + rng() * 8, s = 2 + rng() * 3;
        if (Math.abs(Math.atan2(Math.sin(a + 1.89), Math.cos(a + 1.89))) < 0.3) continue; // trilha livre junto ao portão norte
        W.rock(ctx, Math.cos(a) * d, Math.sin(a) * d, s, false);
      }
      // Passarela externa explica a curva da trilha sobre o rio até a margem.
      W.solid(ctx, -10, -33.5, 4.4, 7.2, 0.2, MATS.plank, -0.2, false);
      W.perimeter(ctx, b, 1.1, MATS.stripe, [{ side: 'W', at: -10, half: 2.4 }, { side: 'N', at: -10, half: 2.4 }], 0.3);
      // Apron de concreto na ponta do penhasco; água abaixo, cauda/rotor livres de carga e portões.
      W.solid(ctx, 0, -19, 18, 18, 0.2, MATS.concrete, -0.2, false);
      W.helipadMark(ctx, this.helipad.x, this.helipad.z, this.helipad.r);
      const river = new THREE.Mesh(new THREE.PlaneGeometry(90, 35), MATS.water);
      river.rotation.x = -Math.PI / 2; river.position.set(0, -1.8, -47.5); ctx.group.add(river);
      // coberturas e destroços para se esconder do Colosso
      W.wall(ctx, -10, 6, 6, 1, 2.6); W.wall(ctx, 10, 6, 6, 1, 2.6); W.wall(ctx, -14, -8, 1, 6, 2.2); W.wall(ctx, 14, -8, 1, 6, 2.2);
      [[-4, 14, 1.2], [5, 16, 1.2], [-18, -18, 1.1], [18, -18, 1.1]].forEach((c) => W.crate(ctx, ...c));
      W.building(ctx, 0, 19.5, 14, 3, 4, MATS.concrete, 0.4);
      // antena com luz vermelha
      W.solid(ctx, 20, -20, 0.5, 0.5, 10, MATS.metal);
      W.solid(ctx, -21.5, 19, 0.5, 0.5, 7.5, MATS.metal);
      // destroços do helicóptero do diretor Brandt (derrubado pelo Colosso) — ainda em chamas
      const wreck = W.helicopter(true); wreck.group.position.set(11.5, -0.4, -21); wreck.group.rotation.y = -0.6; ctx.group.add(wreck.group);
      wreck.group.traverse((o) => { if (o.isMesh) o.castShadow = true; });
      ctx.boxes.push({ minX: 9.4, maxX: 13.6, minZ: -23.4, maxZ: -18.8, h: 2.6 });
      W.fireLight(ctx, 11, -20.2, 1.2, 30);
      // helicóptero de resgate (aparece no fim)
      const heli = rescueHelicopter(); heli.group.visible = false; ctx.group.add(heli.group);
      W.lamp(ctx, -12, -15, 0xff3020, 'pulse', 30, 3); W.lamp(ctx, 12, -15, 0xff3020, 'pulse', 30, 3); W.lamp(ctx, -16, 10, 0xffa060); W.lamp(ctx, 16, 10, 0xffa060);
      W.lamp(ctx, 0, -28.5, 0xfff0c0, 'steady', 18, 3);
      // v6: rádio de campo da equipe Tellus-2 (antena fina + caixa), ao lado do registro 9
      const rbox = W.boxMesh(MATS.dark, 0.7, 0.45, 0.5); rbox.position.set(-21, 0.23, -13.2); ctx.group.add(rbox);
      const ant = W.boxMesh(MATS.metal, 0.04, 1.8, 0.04); ant.position.set(-21.2, 1.3, -13.3); ctx.group.add(ant);
      return { doors: { W: W.doorway(ctx, 'W', -10, b), N: W.doorway(ctx, 'N', -10, b) }, terminals: [], heli, wreck };
    },
  },

  // ================================================================== ATO 2 (v7) — RIO ABAIXO
  // ------------------------------------------------------------------ 7. MARGEM DO RIO
  {
    id: 'margem', save: true, name: 'MARGEM DO RIO', sub: 'A trilha do penhasco desce até a água — pegadas de sapato social na lama',
    map: { x: 3, y: 0 }, bounds: { minX: -24, maxX: 24, minZ: -16, maxZ: 20 },
    mood: { fog: 0x0c1618, density: 0.032, sky: 0x6a8a9a, groundCol: 0x080c0c, hemi: 1.1, moonCol: 0xa8c8e0, moon: 1.15,
      rain: 0.75, lightning: true, fireflies: true, fireflyCol: 0x90ffd0, exposure: 1.22, moonPos: [10, 40, -30] },
    doors: [{ id: 'W', side: 'W', at: -2, to: 'heliponto', toDoor: 'N' }, { id: 'S', side: 'S', at: -8, to: 'acampamento', toDoor: 'N' }],
    pickups: [
      { id: 'p7ammo', kind: 'ammo', x: -14, z: -8 },
      { id: 'p7med', kind: 'med', x: 4, z: 15 },
      { id: 'p7smg', kind: 'smgammo', x: 17, z: 10 },
      { id: 'p7gren', kind: 'grenade', x: 20, z: -5 },
      { id: 'p7crate', kind: 'crate', x: -4, z: -11 },
    ],
    ambient: [{ type: 'raptor', x: 8, z: 5 }, { type: 'raptor', x: 15, z: 14 }, { type: 'spitter', x: 19, z: -9 }],
    logs: [{ id: 'log10', x: 9, z: -9.5, yaw: 0.4 }],
    encounters: [
      // o Brandt aparece por um instante e some na trilha sul (o diretor cuida da corrida)
      { id: 'margem-brandt', on: 'enter', first: true, delay: 0.8, beat: 'brandtGlimpse' },
      // caixas da Tellus-2 na beira d'água: raptores saem da lama do barranco
      { id: 'margem-barranco', on: 'zone', zone: { x: 6, z: -8, r: 6.5 }, beat: 'mud', msg: 'Alguma coisa se mexe no barranco!',
        spawn: [{ type: 'raptor', x: 2, z: -12.5, delay: 1.2, fx: 'mud' }, { type: 'raptor', x: 12, z: -12, delay: 1.9, fx: 'mud' }, { type: 'spitter', from: 'E', delay: 3 }] },
      { id: 'margem-trilha', on: 'zone', zone: { x: -8, z: 11, r: 5 }, msg: 'Emboscada na trilha do acampamento!',
        spawn: [{ type: 'raptor', from: 'S', delay: 0.6 }, { type: 'raptor', from: 'W', delay: 1.4 }] },
    ],
    build(ctx) {
      const b = this.bounds, rng = ctx.rng;
      ctx.treeStyle = 'swamp';
      W.ground(ctx, b, W.groundTex.mud, 24, { patchCol: 0x0a1008, puddles: 12 });
      // o rio: faixa larga de água ao norte (fora dos limites) + remansos de lama na margem
      const river = new THREE.Mesh(new THREE.PlaneGeometry(140, 44), MATS.water); river.rotation.x = -Math.PI / 2; river.position.set(0, 0.02, b.minZ - 22.5); ctx.group.add(river);
      [[-12, -12.5, 10, 4], [16, -12, 8, 5], [-18, 6, 5, 6]].forEach(([x, z, w, d]) => W.pool(ctx, x, z, w, d, MATS.mud));
      // barranco: pedras e troncos ao longo da água
      for (let i = 0; i < 16; i++) W.rock(ctx, b.minX + rng() * 48, b.minZ - 1 - rng() * 3, 0.8 + rng() * 1.6, false);
      W.solid(ctx, -4, -14.5, 7, 0.8, 0.8, MATS.bark); W.solid(ctx, 20, 2, 0.8, 6, 0.8, MATS.bark);
      // lancha da Tellus-2 encalhada, de lado, e caixas RAIZ arrebentadas
      const hull = W.boxMesh(MATS.metal, 2.2, 1.1, 6); hull.position.set(14, 0.4, -15.2); hull.rotation.set(0, 1.25, 0.35); ctx.group.add(hull);
      const cab = W.boxMesh(MATS.dark, 1.6, 0.9, 1.6); cab.position.set(13.6, 1.1, -15.4); cab.rotation.set(0, 1.25, 0.35); ctx.group.add(cab);
      ctx.boxes.push({ minX: 11, maxX: 17, minZ: -16.5, maxZ: -14, h: 1.6 });
      W.fireLight(ctx, 15.2, -14.8, 0.9, 22);
      [[6, -10.5, 0.4], [7.6, -11.4, -0.5], [10.8, -11, 1.1]].forEach(([x, z, r]) => {
        const c = W.boxMesh(MATS.rust, 1.3, 0.7, 0.9); c.position.set(x, 0.3, z); c.rotation.set(0.2, r, 0.12); ctx.group.add(c);
        const lid = W.boxMesh(MATS.metal, 1.3, 0.08, 0.9); lid.position.set(x + 0.8, 0.05, z + 1); lid.rotation.y = r - 0.6; ctx.group.add(lid);
      });
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.6), new THREE.MeshBasicMaterial({ map: labelTex('TELLUS-2', 'RECUPERAÇÃO — LOTE RAIZ'), transparent: true }));
      sign.position.set(8.5, 1.5, -12.6); ctx.group.add(sign);
      // árvores do mangue, deixando corredores livres entre os portões, o barranco e o acampamento
      const keep = [[-20, -2, 6], [-8, 16, 6], [8, -10, 6], [-18, 8, 4], [0, 4, 5], [16, 10, 3], [20, -5, 3], [-14, -8, 3], [4, 15, 3], [-4, -11, 3]];
      for (let i = 0, n = 0; i < 300 && n < 22; i++) {
        const x = b.minX + 3 + rng() * (b.maxX - b.minX - 6), z = b.minZ + 4 + rng() * (b.maxZ - b.minZ - 7);
        if (keep.some(([kx, kz, r]) => Math.hypot(kx - x, kz - z) < r)) continue;
        if (Math.abs(z + 2) < 2.6 && x < -8) continue;           // trilha do portão oeste
        if (Math.abs(x + 8) < 2.6 && z > 4) continue;            // trilha do portão sul
        if (ctx.circles.some((c) => Math.hypot(c.x - x, c.z - z) < 4)) continue;
        W.tree(ctx, x, z, true, 0.9 + rng() * 0.7); n++;
      }
      W.perimeter(ctx, { ...b, minZ: b.minZ - 0.5 }, 0.9, MATS.bark, [{ side: 'W', at: -2, half: 2.4 }, { side: 'S', at: -8, half: 2.4 }], 0.4);
      W.treeRing(ctx, { ...b, minZ: b.minZ + 30 }, 60, 2, 14);
      W.grass(ctx, b, 420, 0x2a4a22);
      W.lamp(ctx, -19, 9.5, 0x60ff90, 'steady', 18, 2.6);
      W.lamp(ctx, 2, 6, 0xffb060, 'flicker', 20, 2.8);
      W.lamp(ctx, -9, 17.5, 0xffb060, 'flicker', 18, 2.6);
      return {
        doors: { W: W.doorway(ctx, 'W', -2, b), S: W.doorway(ctx, 'S', -8, b) },
        terminals: [{ id: 'save-margem', kind: 'save', ...W.terminal(ctx, -21.5, 8, Math.PI / 2), x: -21.5, z: 8 }],
      };
    },
  },

  // ------------------------------------------------------------------ 8. ACAMPAMENTO TELLUS-2
  {
    id: 'acampamento', save: true, name: 'ACAMPAMENTO TELLUS-2', sub: 'Barracas, geradores e jaulas vazias — vazias demais',
    map: { x: 4, y: 0 }, bounds: { minX: -24, maxX: 24, minZ: -20, maxZ: 20 },
    mood: { fog: 0x10160e, density: 0.028, sky: 0x8a9a7a, groundCol: 0x0a0c08, hemi: 1.1, moonCol: 0xc8d8b0, moon: 1.1,
      rain: 0.8, lightning: true, fireflies: false, exposure: 1.15, moonPos: [-16, 40, 12],
      spots: [{ x: -22, h: 8.5, z: -18, tx: 0, tz: 4, color: 0xfff4d8, sweep: 10, speed: 0.33 }] },
    doors: [{ id: 'N', side: 'N', at: -8, to: 'margem', toDoor: 'S' }, { id: 'S', side: 'S', at: 4, to: 'ninho', toDoor: 'N', lock: 'campGate' }],
    pickups: [
      { id: 'p8ammo', kind: 'ammo', x: -10, z: -14 },
      { id: 'p8ammo2', kind: 'ammo', x: 12, z: 0 },
      { id: 'p8med', kind: 'med', x: -6, z: 8 },
      { id: 'p8smg', kind: 'smgammo', x: 10, z: -15 },
      { id: 'p8gren', kind: 'grenade', x: -20, z: -16 },
      { id: 'p8vest', kind: 'vest', x: -14, z: -17 },
      { id: 'p8crate', kind: 'crate', x: 20, z: -2 },
    ],
    ambient: [{ type: 'raptor', x: 4, z: -10 }, { type: 'spitter', x: 18, z: -14 }],
    logs: [{ id: 'log11', x: 0, z: -2.2, yaw: Math.PI }, { id: 'log12', x: 7.5, z: 15.5, yaw: -0.6 }],
    cages: [{ x: -18, z: 12, face: 1 }, { x: 18, z: 12, face: -1 }, { x: -18, z: -12, face: 1, big: true }],
    encounters: [
      // Só abre depois de a jogadora avançar ao corredor central (ou iniciar o hack).
      // cagesReleased é persistente: não há nova leva ao revisitar o cenário.
      { id: 'camp-brandt', on: 'zone', zone: { x: 0, z: 1, r: 5.5 }, cages: true, beat: 'brandtFlee', msg: 'ALARME — o Brandt está liberando as jaulas!' },
    ],
    build(ctx) {
      const b = this.bounds, rng = ctx.rng;
      W.ground(ctx, b, W.groundTex.jungle, 24, { patchCol: 0x14180c, puddles: 10 });
      // barracas piramidais (lona verde-oliva)
      const canvas = new THREE.MeshStandardMaterial({ color: 0x4a5236, roughness: 0.95, flatShading: true });
      const tent = (x, z, s, rot = 0) => {
        const m = new THREE.Mesh(new THREE.ConeGeometry(s, s * 1.15, 4), canvas); m.position.set(x, s * 0.575, z); m.rotation.y = Math.PI / 4 + rot; m.castShadow = m.receiveShadow = true; ctx.group.add(m);
        ctx.boxes.push({ minX: x - s * 0.62, maxX: x + s * 0.62, minZ: z - s * 0.62, maxZ: z + s * 0.62, h: s * 1.1 });
      };
      [[-14, -6, 3.4], [-12, 3, 3], [14, -6, 3.4], [15, 4, 3]].forEach(([x, z, s]) => tent(x, z, s));
      // tenda de comando: lona sobre estrutura + mesa com mapas
      W.solid(ctx, 0, -6, 7, 4.5, 0.2, canvas, 2.6, false);
      [[-3.4, -8.1], [3.4, -8.1], [-3.4, -3.9], [3.4, -3.9]].forEach(([x, z]) => W.solid(ctx, x, z, 0.15, 0.15, 2.6, MATS.post));
      W.solid(ctx, 0, -7, 3, 1.4, 0.85, MATS.plank);
      // geradores (zumbido) e cabos
      [[-7, 13], [9, -12]].forEach(([x, z]) => { W.solid(ctx, x, z, 2.2, 1.3, 1.3, MATS.rust); W.solid(ctx, x + 0.6, z, 0.25, 0.25, 0.8, MATS.dark, 1.3, false); });
      W.solid(ctx, -2, 13, 9, 0.12, 0.05, MATS.dark, 0.02, false);
      // jaulas de transporte: grades nos lados e porta de grade (sobe quando o Brandt abre)
      const gates = [];
      for (const c of this.cages) {
        const w = c.big ? 5 : 3.6, d = c.big ? 5 : 3.6, h = c.big ? 3.4 : 2.4, front = c.x + c.face * w / 2, back = c.x - c.face * w / 2;
        W.solid(ctx, back, c.z, 0.3, d, h, MATS.metal);
        W.solid(ctx, c.x, c.z - d / 2, w, 0.3, h, MATS.metal, 0, true); W.solid(ctx, c.x, c.z + d / 2, w, 0.3, h, MATS.metal, 0, true);
        W.solid(ctx, c.x, c.z, w, d, 0.15, MATS.rust, h, false);
        const gate = new THREE.Group();
        for (let i = 0; i < 7; i++) { const bar = W.boxMesh(MATS.post, 0.08, h, 0.08); bar.position.set(0, h / 2, -d / 2 + (i + 0.5) * d / 7); gate.add(bar); }
        const rail = W.boxMesh(MATS.post, 0.1, 0.12, d); rail.position.y = h * 0.6; gate.add(rail);
        gate.position.set(front, 0, c.z); ctx.group.add(gate);
        ctx.boxes.push({ minX: front - 0.2, maxX: front + 0.2, minZ: c.z - d / 2, maxZ: c.z + d / 2, h });
        gates.push({ mesh: gate, box: ctx.boxes[ctx.boxes.length - 1], h, open: 0 });
      }
      // caixas, tambores e cerca baixa
      [[-4, 4, 1.1], [-2.8, 4.6, 0.8], [6, 8, 1], [20, -16, 1.2], [-21, 4, 1], [8, -16, 0.9]].forEach((c) => W.crate(ctx, ...c));
      [[3, 4], [-9, -12]].forEach(([x, z]) => { const t = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 1.1, 10), MATS.rust); t.position.set(x, 0.55, z); ctx.group.add(t); ctx.circles.push({ x, z, r: 0.5, h: 1.1 }); });
      W.fireLight(ctx, 3, 4, 1.1, 22); // tambor com fogo
      W.wall(ctx, -6, 17, 6, 0.6, 1.2); W.wall(ctx, 14, 17, 8, 0.6, 1.2);
      W.solid(ctx, -22, -18, 0.5, 0.5, 8.5, MATS.metal); // torre do holofote
      const gsign = new THREE.Mesh(new THREE.PlaneGeometry(3, 0.7), new THREE.MeshBasicMaterial({ map: labelTex('TELLUS-2', 'PORTÃO — SÓ PESSOAL AUTORIZADO'), transparent: true }));
      gsign.position.set(0.5, 2.2, 18.6); gsign.rotation.y = Math.PI; ctx.group.add(gsign);
      W.perimeter(ctx, b, 1.6, MATS.metal, [{ side: 'N', at: -8, half: 2.4 }, { side: 'S', at: 4, half: 2.4 }], 0.25);
      W.treeRing(ctx, b, 60, 2, 12);
      W.grass(ctx, b, 260, 0x2c4420);
      const lamps = [W.lamp(ctx, -7, -2, 0xfff0c0, 'steady', 22, 3.4), W.lamp(ctx, 8, 2, 0xfff0c0, 'steady', 22, 3.4), W.lamp(ctx, 2, 12, 0xffd890, 'flicker', 22, 3.2),
        W.lamp(ctx, 7, 18, 0xff2020, 'pulse', 26, 2.6)];
      return {
        doors: { N: W.doorway(ctx, 'N', -8, b), S: W.doorway(ctx, 'S', 4, b) }, cageGates: gates, gateLamp: lamps[3],
        terminals: [
          { id: 'save-camp', kind: 'save', ...W.terminal(ctx, -2, -18.6, 0), x: -2, z: -18.6 },
          { id: 'hack', kind: 'hack', ...W.terminal(ctx, -1, 16.8, Math.PI, 0xff6040), x: -1, z: 16.8 },
        ],
      };
    },
  },

  // ------------------------------------------------------------------ 9. NINHO RAIZ
  {
    id: 'ninho', name: 'NINHO RAIZ', sub: 'Uma cratera de pedra na beira do rio — e dezenas de ovos brilhando',
    map: { x: 4, y: 3 }, bounds: { minX: -22, maxX: 22, minZ: -22, maxZ: 18 },
    mood: { fog: 0x08120c, density: 0.036, sky: 0x4a7a5a, groundCol: 0x040806, hemi: 0.95, moonCol: 0x90d0a0, moon: 0.85,
      rain: 0.25, lightning: false, fireflies: true, fireflyCol: 0x60ff90, exposure: 1.3, moonPos: [0, 40, 10] },
    doors: [{ id: 'N', side: 'N', at: 0, to: 'acampamento', toDoor: 'S', lock: 'nestLock' }],
    pickups: [
      { id: 'p9ammo', kind: 'ammo', x: -18, z: -16 },
      { id: 'p9ammo2', kind: 'ammo', x: 18, z: -16 },
      { id: 'p9med', kind: 'med', x: -18, z: 4 },
      { id: 'p9gren', kind: 'grenade', x: 16, z: -4 },
      { id: 'p9smg', kind: 'smgammo', x: -5, z: -17 },
      { id: 'p9crate', kind: 'crate', x: 12, z: -15 },
    ],
    ambient: [{ type: 'spitter', x: -14, z: 8 }, { type: 'raptor', x: 12, z: -6 }],
    logs: [{ id: 'log13', x: -10, z: -18.8, yaw: 0 }],
    nest: { x: 0, z: 9, r: 3.2 }, dock: { x: 19.5, z: 6 },
    helipad: { x: -13, z: -9, r: 5.8 },
    encounters: [
      { id: 'nest-awaken', on: 'zone', zone: { x: 0, z: -3, r: 7 }, boss: true, delay: 2.4, beat: 'nestAwaken', msg: 'A MATRIARCA defende o ninho!',
        spawn: [{ type: 'matriarca', x: 0, z: 13 }, { type: 'raptor', x: -3, z: 9, delay: 2.5, fx: 'egg' }, { type: 'raptor', x: 3, z: 9, delay: 3.2, fx: 'egg' }] },
    ],
    build(ctx) {
      const b = this.bounds, rng = ctx.rng;
      W.ground(ctx, b, W.groundTex.stone, 10, { patchCol: 0x0c140a, puddles: 6 });
      // paredões da cratera (altos) — abertos para o cais a leste
      W.perimeter(ctx, b, 7, MATS.rock, [{ side: 'N', at: 0, half: 2.4 }, { side: 'E', at: 6, half: 3 }], 1.6);
      for (let i = 0; i < 34; i++) { const a = rng() * Math.PI * 2, d = 27 + rng() * 6, s = 3 + rng() * 3; if (Math.abs(Math.atan2(Math.sin(a), Math.cos(a)) - 0.25) < 0.25) continue; W.rock(ctx, Math.cos(a) * d, Math.sin(a) * d - 2, s, false); }
      // estalactites na borda e pilares de pedra (bater a Matriarca neles atordoa)
      const stal = new THREE.ConeGeometry(0.6, 3.2, 6);
      for (let i = 0; i < 18; i++) { const m = new THREE.Mesh(stal, MATS.rock); const a = rng() * Math.PI * 2; m.position.set(Math.cos(a) * 20, 6.2, Math.sin(a) * 18 - 2); m.rotation.x = Math.PI; ctx.group.add(m); }
      [[-9, 1], [9, 1], [-6, -11], [7, -11], [-13, 11], [13, 12]].forEach(([x, z]) => W.solid(ctx, x, z, 2.2, 2.2, 5.5, MATS.rock));
      // o ninho: monte de lama e galhos + ovos bioluminescentes
      const mound = new THREE.Mesh(new THREE.CylinderGeometry(3.6, 4.4, 0.6, 18), new THREE.MeshStandardMaterial({ color: 0x1e1a10, roughness: 1, flatShading: true }));
      mound.position.set(0, 0.3, 9); mound.receiveShadow = true; ctx.group.add(mound);
      ctx.circles.push({ x: 0, z: 9, r: 2.4, h: 0.6 });
      const eggMat = new THREE.MeshStandardMaterial({ color: 0x9ab890, emissive: 0x30ff70, emissiveIntensity: 0.55, roughness: 0.4 });
      const eggGeo = new THREE.SphereGeometry(0.32, 10, 8), eggs = new THREE.Group();
      for (let i = 0; i < 16; i++) { const a = i * 2.4, r = 0.6 + (i % 5) * 0.55, e = new THREE.Mesh(eggGeo, eggMat); e.scale.set(1, 1.35, 1); e.position.set(Math.cos(a) * r, 0.85, 9 + Math.sin(a) * r); e.rotation.z = (rng() - 0.5) * 0.6; eggs.add(e); }
      ctx.group.add(eggs);
      const eggLight = W.fireLight(ctx, 0, 9, 1.2, 26); eggLight.color = 0x40ff80; eggLight.mode = 'pulse'; eggLight.halo.material.color.setHex(0x40ff80);
      // fungos luminosos nas paredes
      [[-18, -4], [17, -10], [-8, 15]].forEach(([x, z]) => {
        const L = W.fireLight(ctx, x, z, 0.6, 14); L.color = 0x50ffa0; L.mode = 'flicker'; L.halo.material.color.setHex(0x50ffa0);
        for (let k = 0; k < 5; k++) { const f = new THREE.Mesh(eggGeo, eggMat); f.scale.set(0.6, 0.3, 0.6); f.position.set(x + (rng() - 0.5) * 2, 0.1, z + (rng() - 0.5) * 2); ctx.group.add(f); }
      });
      // cais a leste: tábuas, rio e o barco do Brandt
      const river = new THREE.Mesh(new THREE.PlaneGeometry(40, 60), MATS.water); river.rotation.x = -Math.PI / 2; river.position.set(b.maxX + 21, 0.02, 0); ctx.group.add(river);
      W.solid(ctx, 23, 6, 6, 3, 0.35, MATS.plank, 0, false);
      [[20.4, 4.6], [20.4, 7.4], [25.5, 4.6], [25.5, 7.4]].forEach(([x, z]) => W.solid(ctx, x, z, 0.25, 0.25, 0.9, MATS.bark, 0, false));
      const boat = new THREE.Group();
      const bh = W.boxMesh(MATS.metal, 5, 0.9, 2); bh.position.y = 0.3; boat.add(bh);
      const bm = W.boxMesh(MATS.dark, 0.6, 0.8, 0.6); bm.position.set(-2.4, 0.9, 0); boat.add(bm);
      boat.position.set(27.5, 0, 6); ctx.group.add(boat);
      // clareira de extração (sudoeste): marca H improvisada com sinalizadores
      W.helipadMark(ctx, -13, -9, 5.8);
      const heli = rescueHelicopter(); heli.group.visible = false; ctx.group.add(heli.group);
      W.lamp(ctx, 21, 9, 0xffb060, 'flicker', 18, 2.4);
      W.lamp(ctx, -20, -16, 0xff3020, 'pulse', 22, 2.6);
      // ossos e restos da equipe Tellus-2
      [[-4, -16, 1], [5, -17, 0.9], [15, 0, 1]].forEach((c) => W.crate(ctx, ...c));
      W.grass(ctx, b, 120, 0x1e3a1c);
      return { doors: { N: W.doorway(ctx, 'N', 0, b) }, terminals: [], heli, eggs, eggMat, eggLight, boat };
    },
  },
  // ================= v11 — ATO 3: PORTO ANIL =================
  // Áreas novas sempre no FIM da lista: a semente de cada área é SEED + índice*101, então as nove
  // áreas antigas mantêm exatamente o mesmo layout. Entrada do Ato 3 é narrativa (o Garça-1 leva
  // o jogador do ninho até o cais de Porto Anil), por isso a cadeia só tem portas entre si.
  {
    id: 'portoanil', save: true, name: 'PORTO ANIL', sub: 'Cidade costeira sob chuva — sirenes de evacuação ecoando no cais',
    map: { x: 5, y: 3 }, bounds: { minX: -24, maxX: 24, minZ: -24, maxZ: 20 },
    start: { x: 0, z: 14.5, yaw: Math.PI }, extraction: { x: 0, z: 17.2, r: 3.4 },
    mood: { fog: 0x0c1218, density: 0.034, sky: 0x40505e, groundCol: 0x06080a, hemi: 0.9, moonCol: 0x9ab0c8, moon: 0.7,
      rain: 1, lightning: true, fireflies: false, exposure: 1.2, moonPos: [-14, 38, 18] },
    doors: [{ id: 'N', side: 'N', at: 0, to: 'captacao', toDoor: 'S' }],
    pickups: [
      { id: 'p10ammo', kind: 'ammo', x: -19, z: 10 },
      { id: 'p10med', kind: 'med', x: 18, z: -6 },
      { id: 'p10smg', kind: 'smgammo', x: -8, z: -18 },
      { id: 'p10crate', kind: 'crate', x: 19, z: 12 },
    ],
    ambient: [{ type: 'raptor', x: -12, z: -6 }, { type: 'raptor', x: 12, z: -12 }, { type: 'spitter', x: 2, z: -16 }],
    logs: [{ id: 'log14', x: -15.5, z: 5, yaw: Math.PI / 2 }],
    encounters: [
      { id: 'pa-evac', on: 'zone', zone: { x: 0, z: -2, r: 6 }, msg: 'Algo se move entre os ônibus de evacuação!',
        spawn: [{ type: 'raptor', from: 'W' }, { type: 'raptor', from: 'E', delay: 0.8 }, { type: 'spitter', from: 'N', delay: 2 }] },
      { id: 'pa-brute', on: 'zone', zone: { x: 0, z: -15, r: 6 }, msg: 'Um bruto derrubou a barreira da Defesa Civil!',
        spawn: [{ type: 'brute', from: 'N' }, { type: 'raptor', from: 'E', delay: 2.5 }] },
    ],
    build(ctx) {
      const b = this.bounds, rng = ctx.rng;
      W.ground(ctx, b, W.groundTex.paving, 10, { patchCol: 0x101418, puddles: 10 });
      W.perimeter(ctx, b, 4.5, MATS.concrete, [{ side: 'N', at: 0, half: 2.4 }, { side: 'S', at: 0, half: 4 }], 1.2);
      // cais ao sul: mar escuro e píer onde o Garça-1 deixou o jogador
      const sea = new THREE.Mesh(new THREE.PlaneGeometry(90, 40), MATS.water); sea.rotation.x = -Math.PI / 2; sea.position.set(0, 0.02, b.maxZ + 20); ctx.group.add(sea);
      W.solid(ctx, 0, 18.5, 8, 3, 0.3, MATS.plank, 0, false);
      // Eixo do cais: marcações e balizas fora da passagem do jogador.
      for(let z=-19;z<14;z+=4) W.solid(ctx,0,z,.25,1.6,.025,MATS.stripe,0,false);
      for(const x of [-4.2,4.2]) { W.lamp(ctx,x,17.6,0x60dfff,'steady',14,2.4); W.solid(ctx,x,18.6,.25,2,.8,MATS.plank); }
      areaSign(ctx,0,-17,this.id==='setorzero'?'SETOR ZERO':'PORTO ANIL',this.id==='setorzero'?'MATRIZ RAIZ → NORTE':'CAPTAÇÃO ↑ · EMBARQUE ↓ SUL');
      const extraction=extractionSite(ctx,this.extraction,this.id==='setorzero');
      // prédios da orla (fachadas) e ônibus/contêineres da evacuação
      W.building(ctx, -17, -15, 10, 8, 9, MATS.concrete, 0.25);
      W.building(ctx, 17, -17, 9, 7, 11, MATS.concrete, 0.2);
      W.building(ctx, -19, 14, 6, 6, 6, MATS.concrete, 0.4);
      W.container(ctx, -6, 4, 7, 2.6, 2.8, 0x2a4a7a);
      W.container(ctx, 7, 1, 2.6, 7, 2.8, 0x8a8a8a);
      W.container(ctx, 10, -9, 7, 2.6, 2.8, 0x7a2a2a);
      [[-9, -7, 1.2], [4, -6, 1], [14, 9, 1.1], [-3, 12, 0.9]].forEach((c) => W.crate(ctx, ...c));
      // barreira da Defesa Civil (listrada) junto ao portão norte
      [[-4, -19], [4, -19]].forEach(([x, z]) => W.solid(ctx, x, z, 3.5, 0.6, 1.1, MATS.hazard));
      W.lamp(ctx, -10, 10, 0xffc080, 'flicker', 20, 3.2);
      W.lamp(ctx, 10, 4, 0xffc080, 'steady', 18, 3.2);
      W.lamp(ctx, -4, -20, 0xff3020, 'pulse', 24, 3);
      W.lamp(ctx, 4, -20, 0x3060ff, 'pulse', 24, 3);
      W.lamp(ctx, 0, 16, 0xfff0d0, 'steady', 16, 3);
      for (let i = 0; i < 10; i++) W.rock(ctx, (rng()<.5?-1:1)*(7+rng()*15), 19 + rng() * 2, 1 + rng() * 1.4, false);
      return { extraction, doors: { N: W.doorway(ctx, 'N', 0, b) },
        terminals: [{ id: 'save-portoanil', kind: 'save', ...W.terminal(ctx, 6, 14, Math.PI), x: 6, z: 14 }] };
    },
  },
  {
    id: 'captacao', save: true, name: 'CAPTAÇÃO ANIL', sub: 'Estação de água da cidade — tanques, tubulações e névoa química',
    map: { x: 5, y: 2 }, bounds: { minX: -24, maxX: 24, minZ: -22, maxZ: 22 },
    mood: { fog: 0x0e160a, density: 0.042, sky: 0x4a5a3a, groundCol: 0x060804, hemi: 0.85, moonCol: 0xb0d090, moon: 0.65,
      rain: 0.5, lightning: false, fireflies: false, exposure: 1.25, moonPos: [10, 40, -12] },
    doors: [{ id: 'S', side: 'S', at: 0, to: 'portoanil', toDoor: 'N' }, { id: 'N', side: 'N', at: 0, to: 'sede', toDoor: 'S', lock: 'valveLock' }],
    pickups: [
      { id: 'p11ammo', kind: 'ammo', x: 19, z: 16 },
      { id: 'p11gren', kind: 'grenade', x: -19, z: -14 },
      { id: 'p11med', kind: 'med', x: 12, z: -16 },
      { id: 'p11crate', kind: 'crate', x: -20, z: 16 },
    ],
    ambient: [{ type: 'spitter', x: -12, z: -8 }, { type: 'raptor', x: 14, z: 2 }],
    logs: [{ id: 'log15', x: 16.5, z: -8, yaw: -Math.PI / 2 }, { id: 'log17', x: -16, z: 6.5, yaw: Math.PI / 2 }],
    floodZone: { x: 0, z: -10, r: 9 },
    encounters: [
      { id: 'cap-enter', on: 'enter', first: true, delay: 3, msg: 'A névoa química esconde a matilha!',
        spawn: [{ type: 'raptor', from: 'E' }, { type: 'raptor', from: 'W', delay: 1.2 }] },
    ],
    build(ctx) {
      const b = this.bounds, rng = ctx.rng;
      W.ground(ctx, b, W.groundTex.stone, 10, { patchCol: 0x10180a, puddles: 8 });
      W.perimeter(ctx, b, 5, MATS.metal, [{ side: 'N', at: 0, half: 2.4 }, { side: 'S', at: 0, half: 2.4 }], 1);
      // tanques de decantação (cilindros com colisão)
      const tankMat = MATS.rust, tankGeo = new THREE.CylinderGeometry(3.4, 3.4, 5, 20);
      [[-14, -2], [14, 8], [-12, 12]].forEach(([x, z]) => {
        const t = new THREE.Mesh(tankGeo, tankMat); t.position.set(x, 2.5, z); t.castShadow = t.receiveShadow = true; ctx.group.add(t);
        const ring = W.boxMesh(MATS.stripe, 7, 0.25, 7); ring.position.set(x, 4.6, z); ctx.group.add(ring);
        ctx.circles.push({ x, z, r: 3.4, h: 5 });
      });
      // tubulações longas (decorativas) e canal de água contaminada
      const pipeGeo = new THREE.CylinderGeometry(0.45, 0.45, 30, 10);
      [[-6, 3.6], [6, 3.6]].forEach(([x, y]) => { const pp = new THREE.Mesh(pipeGeo, MATS.metal); pp.rotation.x = Math.PI / 2; pp.position.set(x, y, 2); ctx.group.add(pp); });
      // Canal legível com duas travessias secas, sem reduzir a velocidade em uma ponte.
      for(const [z,d] of [[-2.25,1.5],[6,9],[14.25,1.5]])W.pool(ctx,0,z,6,d,MATS.mud);
      for(const z of [0,12]){W.solid(ctx,0,z,8.5,3,.035,MATS.metal,0,false);for(const dz of [-1.45,1.45])W.solid(ctx,0,z+dz,8.5,.1,.045,MATS.hazard,0,false);}
      // Faixas de serviço e identificação do painel, sem novos bloqueios.
      for(const x of [-7.4,7.4]) for(let z=-7;z<17;z+=4) W.solid(ctx,x,z,.2,2,.025,MATS.stripe,0,false);
      areaSign(ctx,0,-18,this.id==='raiz'?'MATRIZ RAIZ — SETOR ZERO':'CAPTAÇÃO ANIL',this.id==='raiz'?'ARQUIVO CENTRAL · CONTENÇÃO':'PAINEL DAS COMPORTAS ↓');
      // comportas (painel de controle ao norte do canal)
      W.solid(ctx, -5, -10, 3, 1.2, 2.4, MATS.metal); W.solid(ctx, 5, -10, 3, 1.2, 2.4, MATS.metal);
      const gate = W.boxMesh(MATS.hazard, 7, 2.6, 0.4); gate.position.set(0, 1.3, -12); ctx.group.add(gate);
      [[18, 0, 1.1], [-19, -6, 1], [9, 17, 1.2]].forEach((c) => W.crate(ctx, ...c));
      W.lamp(ctx, -8, -16, 0xc0ff80, 'flicker', 20, 3.4);
      W.lamp(ctx, 8, 14, 0xc0ff80, 'flicker', 18, 3.4);
      const alarm = W.lamp(ctx, 0, -15, 0xff3020, 'pulse', 26, 3.2);
      for (let i = 0; i < 6; i++) { const L = W.fireLight(ctx, -18 + rng() * 36, -18 + rng() * 36, 0.2, 6); L.color = 0x90ff60; L.mode = 'flicker'; L.halo.material.color.setHex(0x90ff60); }
      return { doors: { S: W.doorway(ctx, 'S', 0, b), N: W.doorway(ctx, 'N', 0, b) }, floodGate: gate, alarm,
        terminals: [
          { id: 'save-captacao', kind: 'save', ...W.terminal(ctx, 20.5, 18, -Math.PI / 2), x: 20.5, z: 18 },
          { id: 'valves', kind: 'valves', ...W.terminal(ctx, 0, -8.6, Math.PI, 0xffb040), x: 0, z: -8.6 },
        ] };
    },
  },
  {
    id: 'sede', name: 'SEDE TELLUS', sub: 'O bunker sob a captação — onde o Conselho guardava o Primórdio',
    map: { x: 5, y: 1 }, bounds: { minX: -22, maxX: 22, minZ: -22, maxZ: 20 },
    mood: { fog: 0x100a0a, density: 0.03, sky: 0x5a4a4a, groundCol: 0x060404, hemi: 0.8, moonCol: 0xffd0b0, moon: 0.55,
      rain: 0, lightning: false, fireflies: false, exposure: 1.3, moonPos: [0, 40, 0] },
    doors: [{ id: 'S', side: 'S', at: 0, to: 'captacao', toDoor: 'N', lock: 'primLock' }],
    pickups: [
      { id: 'p12ammo', kind: 'ammo', x: -18, z: 14 },
      { id: 'p12ammo2', kind: 'ammo', x: 18, z: 14 },
      { id: 'p12med', kind: 'med', x: -18, z: -16 },
      { id: 'p12smg', kind: 'smgammo', x: 18, z: -16 },
      { id: 'p12crate', kind: 'crate', x: 16, z: 4 },
    ],
    ambient: [{ type: 'raptor', x: -9, z: 9 }, { type: 'spitter', x: 9, z: -4 }],
    logs: [{ id: 'log16', x: -19.5, z: 2, yaw: Math.PI / 2 }],
    core: { x: 0, z: -15 }, uplink: { x: 14, z: -18.6 },
    encounters: [
      { id: 'prim-awaken', on: 'zone', zone: { x: 0, z: 4, r: 7 }, boss: true, delay: 2, beat: 'primAwaken', msg: 'O PRIMÓRDIO rompe a contenção!',
        spawn: [{ type: 'primordio', x: 0, z: -12 }, { type: 'raptor', x: -6, z: -14, delay: 3, fx: 'egg' }] },
    ],
    build(ctx) {
      const b = this.bounds;
      W.ground(ctx, b, W.groundTex.paving, 8, { patchCol: 0x140c0a, puddles: 3 });
      W.perimeter(ctx, b, 6, MATS.concrete, [{ side: 'S', at: 0, half: 2.4 }], 1.4);
      // pilares de concreto (bater o Primórdio neles atordoa)
      [[-9, -4], [9, -4], [-9, 8], [9, 8], [0, 12]].forEach(([x, z]) => W.solid(ctx, x, z, 2.2, 2.2, 6, MATS.concrete));
      // câmara de contenção quebrada (núcleo do laboratório) ao norte
      W.solid(ctx, -6, -18, 5, 1, 4, MATS.metal); W.solid(ctx, 6, -18, 5, 1, 4, MATS.metal);
      const glass = W.boxMesh(MATS.glass, 7, 3.6, 0.2); glass.position.set(0, 1.8, -19.4); ctx.group.add(glass);
      const eggMat = new THREE.MeshStandardMaterial({ color: 0xb8c890, emissive: 0xa0ff30, emissiveIntensity: 0.5, roughness: 0.4 });
      const eggGeo = new THREE.SphereGeometry(0.3, 10, 8), eggs = new THREE.Group();
      for (let i = 0; i < 10; i++) { const e = new THREE.Mesh(eggGeo, eggMat); e.scale.set(1, 1.35, 1); e.position.set(-4 + (i % 5) * 2, 0.4, -15.5 - Math.floor(i / 5) * 1.2); eggs.add(e); }
      ctx.group.add(eggs);
      const core = W.fireLight(ctx, 0, -15, 1, 24); core.color = 0xa0ff40; core.mode = 'pulse'; core.halo.material.color.setHex(0xa0ff40);
      // mesas e arquivos do Conselho
      [[-16, 10, 1], [15, -8, 1.1], [-15, -10, 0.9]].forEach((c) => W.crate(ctx, ...c, MATS.metal));
      W.lamp(ctx, -14, 0, 0xffe0c0, 'flicker', 20, 3.6);
      W.lamp(ctx, 14, 0, 0xffe0c0, 'flicker', 20, 3.6);
      W.lamp(ctx, 0, 16, 0xff3020, 'pulse', 22, 3.4);
      return { doors: { S: W.doorway(ctx, 'S', 0, b) }, eggs, eggMat, coreLight: core,
        terminals: [{ id: 'uplink', kind: 'uplink', ...W.terminal(ctx, 14, -18.6, 0, 0x40c0ff), x: 14, z: -18.6 }] };
    },
  },
  // Ato 4: variações independentes do cais/captação, sem portas para o Ato 3.
  {
    id:'setorzero',save:true,name:'SETOR ZERO',sub:'Ilha de contenção — a origem do Projeto RAIZ',map:{x:6,y:3},
    bounds:{minX:-24,maxX:24,minZ:-24,maxZ:20},start:{x:0,z:14.5,yaw:Math.PI},extraction:{x:0,z:17.2,r:3.4},
    mood:{fog:0x172329,density:.024,sky:0x808f91,groundCol:0x0e1718,hemi:1.05,moonCol:0xffdfaa,moon:.85,rain:.2,lightning:false,fireflies:false,exposure:1.35,moonPos:[-14,38,18]},
    doors:[{id:'N',side:'N',at:0,to:'raiz',toDoor:'S'}],
    pickups:[{id:'p13ammo',kind:'ammo',x:-19,z:10},{id:'p13smg',kind:'smgammo',x:18,z:-6},{id:'p13med',kind:'med',x:-8,z:-18},{id:'p13crate',kind:'crate',x:19,z:12}],
    ambient:[{type:'raptor',x:-12,z:-6},{type:'raptor',x:12,z:-12}],logs:[],
    encounters:[{id:'zero-pier',on:'zone',zone:{x:0,z:-3,r:7},msg:'O último posto de contenção foi abandonado!',spawn:[{type:'raptor',from:'W'},{type:'raptor',from:'E',delay:1}]}],
    build(ctx) { const refs=AREAS.find(a=>a.id==='portoanil').build.call(this,ctx); refs.terminals[0].id='save-setorzero'; areaSign(ctx,-12,6,'DEFESA CIVIL','NENHUMA AMOSTRA SAI DA ILHA'); return refs; },
  },
  {
    id:'raiz',save:true,name:'MATRIZ RAIZ',sub:'Arquivo de origem e recinto do Tirano Matriz',map:{x:6,y:2},
    bounds:{minX:-24,maxX:24,minZ:-22,maxZ:22},
    mood:{fog:0x1c1510,density:.028,sky:0x8a7561,groundCol:0x100c08,hemi:1,moonCol:0xffd9a0,moon:.8,rain:0,lightning:false,fireflies:false,exposure:1.35,moonPos:[10,40,-12]},
    doors:[{id:'S',side:'S',at:0,to:'setorzero',toDoor:'N',lock:'originLock'}],logs:[],
    pickups:[{id:'p14ammo',kind:'ammo',x:19,z:16},{id:'p14smg',kind:'smgammo',x:-19,z:-14},{id:'p14med',kind:'med',x:12,z:-16},{id:'p14crate',kind:'crate',x:-20,z:16}],
    ambient:[{type:'raptor',x:14,z:2}],
    encounters:[{id:'zero-awaken',on:'flag',flag:'originKnown',boss:true,delay:2,msg:'O TIRANO MATRIZ rompe a última contenção!',spawn:[{type:'origin',x:0,z:-16}]}],
    build(ctx) {
      const b=this.bounds;
      W.ground(ctx,b,W.groundTex.paving,8,{patchCol:0x20160d,puddles:2});
      W.perimeter(ctx,b,6,MATS.metal,[{side:'S',at:0,half:2.4}],1.2);
      for(const [x,z] of [[-9,-1],[9,-1],[-10,11],[10,11]])W.solid(ctx,x,z,2.4,2.4,5.8,MATS.concrete);
      // Arena própria, sem canal nem porta falsa para outro capítulo.
      for(const x of [-18,18])W.solid(ctx,x,-19,8,2,4.5,MATS.metal);
      const glass=W.boxMesh(MATS.glass,10,4,.2);glass.position.set(0,2,-19);ctx.group.add(glass);
      areaSign(ctx,0,-20,'MATRIZ RAIZ','CONTENÇÃO ORIGINAL · ACESSO RESTRITO');
      for(let z=-17;z<18;z+=4)for(const x of [-6,6])W.solid(ctx,x,z,.2,1.8,.025,MATS.stripe,0,false);
      W.lamp(ctx,-18,0,0x50bfff,'steady',24,4);W.lamp(ctx,18,0,0xffb040,'steady',24,4);
      const alarm=W.lamp(ctx,0,-16,0xff3020,'pulse',35,5);
      const refs={doors:{S:W.doorway(ctx,'S',0,b)},alarm,terminals:[
        {id:'save-raiz',kind:'save',...W.terminal(ctx,20,17,-Math.PI/2),x:20,z:17},
        {id:'origin-archive',kind:'originArchive',...W.terminal(ctx,-14,-16,Math.PI,0x40c0ff),x:-14,z:-16},
        {id:'quarantine',kind:'finalQuarantine',...W.terminal(ctx,14,-16,Math.PI,0xffa040),x:14,z:-16}]};
      return refs;
    },
  },
];

export const AREA = Object.fromEntries(AREAS.map((a) => [a.id, a]));

// ---------- construção sob demanda + streaming ----------
// Cada área usa sua PRÓPRIA semente (WORLD.SEED + índice*101): reconstruir dá exatamente o mesmo layout,
// em qualquer ordem. a.ctx/a.refs ficam null enquanto a área não está construída.
const DIR = { N: 'PORTÃO NORTE', S: 'PORTÃO SUL', W: 'PORTÃO OESTE', E: 'PORTÃO LESTE' };
const builtHooks = [];
/** fn(area) chamado logo após (re)construir uma área — o diretor reaplica estado (energia, porta da diretoria). */
export function onAreaBuilt(fn) { builtHooks.push(fn); }
export const isBuilt = (a) => !!(a && a.ctx);
export const builtCount = () => AREAS.reduce((n, a) => n + (a.ctx ? 1 : 0), 0);
/** Áreas ligadas por portas. */
export const neighbors = (a) => a.doors.map((d) => AREA[d.to]);

/** Constrói uma área (se ainda não existe). Retorna o tempo gasto em ms. */
export function buildArea(a) {
  if (typeof a === 'string') a = AREA[a];
  if (a.ctx) return 0;
  const t0 = performance.now(), i = AREAS.indexOf(a);
  a.ctx = W.makeCtx(mulberry32(WORLD.SEED + i * 101));
  try {
  a.refs = a.build(a.ctx);
  a.refs.logs = (a.logs || []).map((l) => ({ ...l, ...W.datapad(a.ctx, l.x, l.z, l.yaw || 0) }));
  // placas com o destino em cada portão
  a.doors.forEach((d) => { const ref = a.refs.doors[d.id]; if (ref) W.doorSign(ref, '→ ' + AREA[d.to].name, DIR[d.side]); });
  if (a.id === 'porto') {
    a.ctx.treeBatchStats = batchBackgroundTrees(THREE, a.ctx.group);
    // perf: lotes de árvores e instâncias (grama/poças/manchas) nunca se movem — congela a matriz
    // para o renderer não recalcular a cada quadro. (só objetos instanciados; portas/lâmpadas seguem livres)
    for (const o of a.ctx.group.children) if (o.isInstancedMesh) { o.updateMatrix(); o.matrixAutoUpdate = false; }
  }
  buildContactShadows(a.ctx);
  W.applyShadowTiers(a.ctx.group);
  collectLod(a.ctx);   // v9: LOD por distância (js/lod.js)
  a.builds = (a.builds || 0) + 1;
  for (const fn of builtHooks) fn(a);
  return performance.now() - t0;
  } catch (error) {
    // Não deixar uma área parcialmente construída parecer pronta numa nova tentativa.
    if (a.ctx) W.disposeGroup(a.ctx.group);
    a.ctx = null; a.refs = null;
    throw error;
  }
}
/** Descarrega a área (descarta geometria/materiais próprios; recursos compartilhados ficam). */
export function unloadArea(a) {
  if (!a.ctx) return false;
  W.disposeGroup(a.ctx.group);
  a.ctx = null; a.refs = null; a.unloads = (a.unloads || 0) + 1;
  return true;
}
/** Constrói todas as áreas de uma vez (modo antigo / depuração). */
export function buildAreas() { AREAS.forEach((a) => buildArea(a)); }

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
