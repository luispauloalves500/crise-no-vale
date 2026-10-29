// player.js — personagem (modelo GLB da Marina, com malha low-poly de reserva), movimento, vida, armas e câmera em terceira pessoa.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { scene, camera, resolve, castWorld, inWater, bounds, GLOW } from './world.js';
import { PLAYER, CAMERA, WEAPONS, COLORS, GRENADE, INVENTORY, PICKUPS, ARMOR, UPGRADES } from './config.js';
import { G } from './state.js';
import { keys } from './input.js';
import { pad } from './gamepad.js';
import { SETTINGS, motionK } from './settings.js';
import { sfx, roar } from './audio.js';
import { burst, decal } from './fx.js';
import * as ui from './ui.js';
import { damp, clamp, wrapAngle } from './utils.js';

export const player = { pos: new THREE.Vector3(), r: PLAYER.RADIUS, hp: PLAYER.HP, inv: 0, kx: 0, kz: 0, phase: 0, dead: false, moving: false, running: false, stepT: 0, vx: 0, vz: 0 };
export const events = { onDeath: null };

// ---------- malha ----------
// pg = raiz do personagem (segue player.pos / yaw). body = malha procedural antiga (reserva se o GLB falhar).
export const pg = new THREE.Group(); scene.add(pg);
const body = new THREE.Group(); pg.add(body);
const suit = new THREE.MeshStandardMaterial({ color: 0x4b5a3a, roughness: 0.8 });
const vest = new THREE.MeshStandardMaterial({ color: 0x2a2f2a, roughness: 0.7 });
const skinM = new THREE.MeshStandardMaterial({ color: 0xd0a07a, roughness: 0.8 });
const hairM = new THREE.MeshStandardMaterial({ color: 0x5a2a1a, roughness: 0.9 });
const bootM = new THREE.MeshStandardMaterial({ color: 0x1c1712, roughness: 0.9 });
const packM = new THREE.MeshStandardMaterial({ color: 0x3a3a2a, roughness: 0.9 });
const gunM = new THREE.MeshStandardMaterial({ color: 0x151515, metalness: 0.6, roughness: 0.4 });
const woodM = new THREE.MeshStandardMaterial({ color: 0x5a3a20, roughness: 0.8 });
function part(geo, mat, x, y, z, parent = body) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; parent.add(m); return m; }
const B = (w, h, d) => new THREE.BoxGeometry(w, h, d);

const torso = part(B(0.62, 0.75, 0.36), suit, 0, 1.25, 0);
part(B(0.66, 0.45, 0.4), vest, 0, 1.35, 0);
part(B(0.46, 0.5, 0.2), packM, 0, 1.32, -0.28);        // mochila
part(new THREE.SphereGeometry(0.2, 12, 10), skinM, 0, 1.85, 0);
part(new THREE.SphereGeometry(0.21, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), hairM, 0, 1.9, -0.02);
part(B(0.12, 0.22, 0.12), hairM, 0, 1.72, -0.2);        // rabo de cavalo
const legL = new THREE.Group(), legR = new THREE.Group(); legL.position.set(-0.16, 0.9, 0); legR.position.set(0.16, 0.9, 0); body.add(legL, legR);
for (const leg of [legL, legR]) { part(B(0.22, 0.88, 0.26), suit, 0, -0.44, 0, leg); part(B(0.24, 0.16, 0.34), bootM, 0, -0.84, 0.04, leg); }
const armR = new THREE.Group(); armR.position.set(0.38, 1.5, 0); body.add(armR);
part(B(0.16, 0.16, 0.6), suit, 0, -0.08, 0.25, armR);
const armL = new THREE.Group(); armL.position.set(-0.38, 1.5, 0); body.add(armL);
part(B(0.16, 0.16, 0.6), suit, 0.12, -0.08, 0.25, armL); armL.rotation.y = -0.45;
// detalhes: cinto, bolsos, ombreiras, joelheiras, mãos, rádio e faixa refletiva
const beltM = new THREE.MeshStandardMaterial({ color: 0x1a1612, roughness: 0.6, metalness: 0.2 });
const reflM = new THREE.MeshStandardMaterial({ color: 0x9aa890, emissive: 0x2a3a2a, roughness: 0.4 });
part(B(0.66, 0.1, 0.4), beltM, 0, 0.92, 0);
for (const x of [-0.22, 0.22]) part(B(0.13, 0.15, 0.08), packM, x, 0.9, 0.22);   // bolsos frontais
part(B(0.12, 0.2, 0.14), beltM, 0.36, 0.86, 0.02);                               // coldre
part(B(0.67, 0.05, 0.41), reflM, 0, 1.5, 0);                                     // faixa do colete
part(B(0.08, 0.16, 0.06), gunM, -0.2, 1.48, 0.21);                               // rádio no peito
part(new THREE.CylinderGeometry(0.11, 0.12, 0.1, 10), skinM, 0, 1.66, 0);        // pescoço
part(B(0.3, 0.08, 0.1), beltM, 0, 1.92, 0.12).rotation.x = -0.2;                 // faixa/óculos na testa
for (const leg of [legL, legR]) part(B(0.24, 0.16, 0.08), beltM, 0, -0.5, 0.13, leg);   // joelheiras
for (const [arm, x] of [[armR, 0], [armL, 0.12]]) {
  part(B(0.22, 0.12, 0.24), vest, x, 0.04, 0.02, arm);                             // ombreira
  part(new THREE.SphereGeometry(0.085, 8, 6), skinM, x, -0.08, 0.58, arm);         // mão
}

// armas visíveis (troca de modelo). gunRig agrupa armas + ponta do cano; vai para a mão do modelo GLB quando ele carrega.
const gunRig = new THREE.Group(); armR.add(gunRig);
const pistolMesh = new THREE.Group(); gunRig.add(pistolMesh);
part(B(0.1, 0.16, 0.42), gunM, 0, -0.06, 0.68, pistolMesh);
part(B(0.08, 0.06, 0.3), gunM, 0, 0.04, 0.74, pistolMesh);                 // ferrolho
part(B(0.08, 0.2, 0.1), gunM, 0, -0.2, 0.58, pistolMesh).rotation.x = 0.25; // empunhadura
const shotgunMesh = new THREE.Group(); gunRig.add(shotgunMesh); shotgunMesh.visible = false;
part(B(0.09, 0.09, 0.95), gunM, 0, -0.04, 0.85, shotgunMesh);
part(B(0.12, 0.12, 0.35), woodM, 0, -0.1, 0.62, shotgunMesh);
part(B(0.1, 0.16, 0.3), woodM, 0, -0.14, 0.25, shotgunMesh);
part(new THREE.CylinderGeometry(0.035, 0.035, 0.9, 8), gunM, 0, -0.11, 0.85, shotgunMesh).rotation.x = Math.PI / 2; // tubo do carregador
// v6: submetralhadora compacta (corpo curto, pente vertical, coronha dobrável)
const smgMesh = new THREE.Group(); gunRig.add(smgMesh); smgMesh.visible = false;
part(B(0.1, 0.14, 0.55), gunM, 0, -0.05, 0.7, smgMesh);
part(B(0.05, 0.05, 0.22), gunM, 0, -0.03, 1.02, smgMesh);                 // cano
part(B(0.07, 0.26, 0.08), gunM, 0, -0.24, 0.74, smgMesh).rotation.x = 0.12; // pente
part(B(0.08, 0.18, 0.09), gunM, 0, -0.18, 0.52, smgMesh).rotation.x = 0.3;  // empunhadura
part(B(0.04, 0.04, 0.32), gunM, 0, 0.0, 0.3, smgMesh);                   // coronha
const gunMeshes = [pistolMesh, shotgunMesh, smgMesh];
function showGun(i) { gunMeshes.forEach((m, k) => { m.visible = k === i; }); }

export const gunTip = new THREE.Object3D(); gunTip.position.set(0, -0.05, 0.98); gunRig.add(gunTip);
// clarão do disparo: sprite + "estrela" de dois planos + luz forte
const flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW, color: COLORS.muzzle, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
flash.visible = false; gunTip.add(flash);
const starMat = new THREE.MeshBasicMaterial({ map: GLOW, color: 0xffe0a0, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, side: THREE.DoubleSide });
const star = new THREE.Group(); gunTip.add(star); star.visible = false;
for (let i = 0; i < 2; i++) { const p = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 1.6), starMat); p.rotation.x = Math.PI / 2; p.rotation.y = i * Math.PI / 2; p.position.z = 0.6; star.add(p); }
const flashLight = new THREE.PointLight(0xffc060, 0, 12, 2); gunTip.add(flashLight);
// lanterna
const torch = new THREE.SpotLight(0xfff0d0, 70, 34, Math.PI / 7, 0.45, 1.5);
torch.position.set(0.38, 1.45, 0.3); torch.castShadow = true; torch.shadow.mapSize.set(1024, 1024); torch.shadow.bias = -0.0005;
pg.add(torch); const torchT = new THREE.Object3D(); torchT.position.set(0.38, 0.6, 12); pg.add(torchT); torch.target = torchT;

// ---------- modelo GLB da Marina (Mixamo) ----------
// Carrega assets/marina.min.glb (meshopt + webp). Se falhar ou demorar demais, a malha procedural continua.
export const HERO = { url: 'assets/marina.min.glb', height: 1.82, timeout: 25000 };
const hero = { ok: false, model: null, mixer: null, act: {}, spine: null, fireW: 0, fireT: -9, fireAct: null, relW: 0, relAct: null, aimW: 0, raiseW: 0, walkW: 0, runW: 0, walkTS: 1, runTS: 1, loco: 0, blend: 0, ph: 0, legYaw: 0, back: false, hips: null, spine0: null, fires: [], reloads: [], err: '' };
// ossos da parte de cima (animados pelos clipes de arma) — retirados dos clipes de locomoção para as camadas não brigarem
const UPPER = /Spine1|Spine2|Neck|Head|Shoulder|Arm|ForeArm|Hand/;
const FIRE_CLIP = { pistol: ['Fire_Pistol_Controlled', 'Fire_Revolver'], shotgun: ['Fire_Shotgun_Heavy_REV4', 'Fire_Shotgun'], smg: ['Fire_SMG_Burst_REV4', 'Fire_SMG'] };
const GRIP_OFS = new THREE.Vector3(0, 0.17, -0.48); // ponto da empunhadura (no espaço do braço antigo) → origem do soquete
const GUN_SCALE = 0.55; // as armas procedurais eram exageradas para o boneco antigo
const RELOAD_CLIP = { pistol: ['Reload_Revolver'], shotgun: ['Reload_Shotgun'], smg: ['Reload_SMG_REV4'] };
function lowerOnly(clip) {
  const c = clip.clone(); c.name = clip.name + '_pernas';
  c.tracks = c.tracks.filter((t) => { const bone = t.name.split('.')[0]; return !(bone.startsWith('mixamorig') && UPPER.test(bone)); });
  return c;
}
// balanço do tronco/braço esquerdo tirado do próprio clipe de locomoção (o braço direito fica com a arma)
const SWING = /Spine1|Spine2|Neck|Head|LeftShoulder|LeftArm|LeftForeArm|LeftHand/;
function swingOnly(clip) {
  const c = clip.clone(); c.name = clip.name + '_balanco';
  c.tracks = c.tracks.filter((t) => { const bone = t.name.split('.')[0]; return bone.startsWith('mixamorig') && SWING.test(bone); });
  return c;
}
// damp assimétrico: sobe com uma taxa e desce com outra
const damp2 = (a, b, up, down, dt) => damp(a, b, b > a ? up : down, dt);
const ease = (x) => x * x * (3 - 2 * x); // smoothstep: começa e termina macio
const phase = (a) => { const d = a.getClip().duration || 1; return ((a.time / d) % 1 + 1) % 1; };
// descarta trilhas malformadas (nº de valores ≠ nº de chaves × tamanho) — travariam o AnimationMixer
const STRIDE = { quaternion: 4, vector: 3 };
function sane(clip) {
  clip.tracks = clip.tracks.filter((t) => { const st = STRIDE[t.ValueTypeName]; return t.times.length > 0 && (!st || t.values.length === t.times.length * st); });
  return clip;
}
function heroAction(clips, names, { lower = false, swing = false, once = false } = {}) {
  for (const n of names) {
    let clip = clips.find((c) => c.name === n); if (!clip) continue; clip = sane(clip);
    const a = hero.mixer.clipAction(lower ? lowerOnly(clip) : swing ? swingOnly(clip) : clip);
    if (once) { a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; }
    a.enabled = true; a.setEffectiveWeight(0); a.play(); a.paused = once; a.w8 = 0; return a;
  }
  return null;
}
function loadGLB(loader, url) {
  return new Promise((res, rej) => loader.load(url, res, undefined, rej));
}
async function loadHeroInner() {
  if (/[?&]heroi=0/.test(location.search)) throw new Error('desligado por ?heroi=0');
  const loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder);
  let gltf;
  try { gltf = await loadGLB(loader, HERO.url); } catch (e) {
    // reserva: cópia em base64 versionada no repositório (o GitHub Pages normalmente já serve o .glb binário)
    const r = await fetch(HERO.url + '.b64'); if (!r.ok) throw e;
    const bin = Uint8Array.from(atob((await r.text()).replace(/\s+/g, '')), (ch) => ch.charCodeAt(0));
    gltf = await new Promise((res, rej) => loader.parse(bin.buffer, '', res, rej));
  }
  const model = gltf.scene;
  model.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false; if (o.material) o.material.side = THREE.FrontSide; } });
  // escala para ~1,8 m e pés no chão (y=0); o modelo já vem Y-up e virado para +Z (mesma frente do jogador)
  model.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(model), h = Math.max(0.01, box.max.y - box.min.y), k = HERO.height / h;
  model.scale.setScalar(k); model.position.y = -box.min.y * k;
  const socket = model.getObjectByName('WeaponSocket_R') || model.getObjectByName('mixamorig:RightHand') || model.getObjectByName('mixamorigRightHand');
  if (!socket) throw new Error('osso da mão direita não encontrado');
  const bone = (n) => model.getObjectByName('mixamorig:' + n) || model.getObjectByName('mixamorig' + n);
  hero.spine = bone('Spine2'); hero.hips = bone('Hips'); hero.spine0 = bone('Spine'); hero.armR = bone('RightArm'); hero.handR = bone('RightHand'); hero.socket = socket;
  hero.mixer = new THREE.AnimationMixer(model);
  const clips = gltf.animations;
  const A = hero.act;
  A.walk = heroAction(clips, ['Walking_Woman', 'Walking'], { lower: true });
  A.run = heroAction(clips, ['Running', 'Walking'], { lower: true });
  A.walkUp = heroAction(clips, ['Walking_Woman', 'Walking'], { swing: true });
  A.runUp = heroAction(clips, ['Running', 'Walking'], { swing: true });
  // v11: o tempo dos clipes de locomoção é dirigido pela fase compartilhada (updateHero), não pelo mixer
  for (const a of [A.walk, A.run, A.walkUp, A.runUp]) if (a) a.timeScale = 0;
  A.idle = heroAction(clips, ['Weapon_Idle']);
  A.aim = heroAction(clips, ['Aim_Pistol']);
  for (const id in FIRE_CLIP) { A['fire_' + id] = heroAction(clips, FIRE_CLIP[id], { once: id !== 'smg' }); A['reload_' + id] = heroAction(clips, RELOAD_CLIP[id], { once: true }); }
  hero.fires = Object.keys(FIRE_CLIP).map((id) => A['fire_' + id]).filter(Boolean).filter((a, i, l) => l.indexOf(a) === i);
  hero.reloads = Object.keys(RELOAD_CLIP).map((id) => A['reload_' + id]).filter(Boolean).filter((a, i, l) => l.indexOf(a) === i);
  if (A.idle) { A.idle.setEffectiveWeight(1); A.idle.timeScale = 0.9; } // respiração um pouco mais lenta e estável
  // armas procedurais vão para o soquete da mão: o cano (+Z antigo) segue o +Y do soquete; a empunhadura fica na palma
  gunRig.removeFromParent(); socket.add(gunRig);
  gunRig.rotation.set(-Math.PI / 2, 0, 0); gunRig.scale.setScalar(GUN_SCALE / k);
  gunRig.position.set(0, 0, 0); for (const c of gunRig.children) c.position.add(GRIP_OFS);
  pg.add(model); body.visible = false;
  hero.model = model; hero.ok = true;
  return true;
}
/** Promessa do carregamento do personagem: resolve true (GLB) ou false (malha antiga), nunca trava. */
export const heroReady = Promise.race([
  loadHeroInner(),
  new Promise((_, rej) => setTimeout(() => rej(new Error('tempo esgotado')), HERO.timeout)),
]).catch((e) => { hero.err = String(e && e.message || e); console.warn('modelo da Marina indisponível, usando malha antiga:', hero.err); return false; });
export const heroInfo = () => ({ ok: hero.ok, err: hero.err, weights: { walk: hero.walkW, run: hero.runW, loco: hero.loco, blend: hero.blend, legYaw: hero.legYaw, phase: hero.ph, aim: hero.aimW, fire: hero.fireW, reload: hero.relW } });
function heroFire() {
  if (!hero.ok) return;
  const id = curWeapon().id, a = hero.act['fire_' + id]; if (!a) return;
  // o clipe anterior não é zerado aqui: cada clipe de tiro tem seu peso (w8) e some sozinho em updateHero
  if (id === 'smg') { if (a.w8 < 0.05) a.reset(); a.paused = false; a.timeScale = 1; hero.fireT = 0.25; } // automática: só renova o tempo; o laço segue sem reiniciar
  else {
    a.timeScale = id === 'shotgun' ? 1.4 : 1.2;
    // tiro em sequência rápida: se o clipe acabou de começar, não volta ao quadro 0 (evita tranco)
    if (!(hero.fireAct === a && a.w8 > 0.5 && a.time < a.getClip().duration * 0.2)) a.reset();
    a.paused = false; hero.fireT = a.getClip().duration / a.timeScale * 0.8;
  }
  hero.fireAct = a;
}
const _q = new THREE.Quaternion(), _qp = new THREE.Quaternion(), _ax = new THREE.Vector3(), _qi = new THREE.Quaternion();
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _t = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0), _q2 = new THREE.Quaternion();
// v11: referências da locomoção (medidas nos clipes do GLB): velocidade natural do andar/corrida (m/s),
// faixa de velocidade da mistura andar→correr, fases (0..1) em que cada pé pisa e defasagem da corrida.
const LOCO = { WALK_REF: 1.35, RUN_REF: 4.6, B0: 3.0, B1: 7.0, STEPS: [0.24, 0.72], RUN_OFS: -0.03 };
// aplica uma rotação dada no espaço do mundo a um osso (convertida para o espaço do pai)
function rotWorld(o, q) {
  o.parent.updateWorldMatrix(true, false); o.parent.getWorldQuaternion(_qp);
  _q.copy(q).premultiply(_qp.clone().invert()).multiply(_qp);
  o.quaternion.premultiply(_q); o.updateWorldMatrix(false, true);
}
function updateHero(dt, mk) {
  if (!hero.ok) return;
  const A = hero.act, w = curWeapon();
  // v11: locomoção por fase compartilhada. Antes o andar (clipe ~1,3 m/s) tocava no máx. 1,5× para 5,2 m/s:
  // pés deslizando, passo lento e corpo "engessado". Agora:
  //  • peso das pernas (loco) responde rápido ao WASD; a mistura andar→correr segue a velocidade REAL (player.spd);
  //  • os dois clipes andam numa única fase (pé esquerdo/direito sempre juntos), com cadência casada com a velocidade;
  //  • de lado o quadril gira para a direção do passo (tronco compensa e continua mirando); de costas o andar inverte.
  const spd = player.dead ? 0 : player.spd || 0, moving = !player.dead && player.moving && spd > 0.25;
  const mvAng = wrapAngle(Math.atan2(player.vx, player.vz) - G.yaw);
  if (moving) hero.back = hero.back ? Math.abs(mvAng) > 1.75 : Math.abs(mvAng) > 1.95; // histerese
  hero.loco = damp2(hero.loco, moving ? 1 : 0, 14, 8, dt);
  const L = ease(clamp(hero.loco, 0, 1));
  if (spd > 0.3) hero.blend = damp(hero.blend, clamp((spd - LOCO.B0) / (LOCO.B1 - LOCO.B0), 0, 1) * (hero.back ? 0.3 : 1), 7, dt);
  const b = hero.blend;
  const dW = A.walk ? A.walk.getClip().duration : 1, dR = A.run ? A.run.getClip().duration : 1;
  const period = (dW / clamp(spd / LOCO.WALK_REF, 0.8, 2.3)) * (1 - b) + (dR / clamp(spd / LOCO.RUN_REF, 0.8, 1.6)) * b;
  const ph0 = hero.ph;
  if (L > 0.02) hero.ph = ((hero.ph + dt / period * (hero.back ? -1 : 1)) % 1 + 1) % 1;
  // passos sincronizados com os pés da animação
  if (moving && L > 0.5) for (const st of LOCO.STEPS) {
    const crossed = hero.back ? (ph0 >= st && hero.ph < st) || (ph0 < hero.ph && (ph0 >= st || hero.ph < st)) : (ph0 < st && hero.ph >= st) || (hero.ph < ph0 && (ph0 < st || hero.ph >= st));
    if (crossed) sfx.step(inWater(player.pos.x, player.pos.z) ? 'water' : player.running ? 'run' : 'walk', G.surface || '');
  }
  const setT = (a, off) => { if (a) a.time = (((hero.ph + off) % 1 + 1) % 1) * a.getClip().duration; };
  setT(A.walk, 0); if (A.run !== A.walk) setT(A.run, LOCO.RUN_OFS);
  hero.walkW = A.run === A.walk ? L : L * (1 - b); hero.runW = A.run === A.walk ? 0 : L * b;
  if (A.walk) A.walk.setEffectiveWeight(hero.walkW);
  if (A.run && A.run !== A.walk) A.run.setEffectiveWeight(hero.runW);
  const walkN = hero.walkW, runN = hero.runW;
  // giro do quadril (strafe): de lado as pernas apontam para onde ela anda
  const legT = moving ? clamp(hero.back ? wrapAngle(mvAng - Math.PI) : mvAng, -0.85, 0.85) : 0;
  hero.legYaw = damp(hero.legYaw, legT, 10, dt);
  // tronco/braços: camadas com pesos normalizados (recarga > tiro > mira/base, soma ~1)
  hero.fireT -= dt;
  let fireSum = 0;
  for (const a of hero.fires) {
    const on = a === hero.fireAct && hero.fireT > 0;
    a.w8 = damp(a.w8, on ? 1 : 0, on ? 22 : 6, dt); if (a.w8 < 0.002) a.w8 = 0; // entrada rápida (sem pop de 1 quadro), volta suave
    fireSum += a.w8;
  }
  const ra = arms.reloading > 0 ? A['reload_' + w.id] : null;
  if (ra) {
    const total = Math.max(0.2, arms.reloadTotal), dur = ra.getClip().duration;
    if (hero.relAct !== ra) { ra.reset(); hero.relAct = ra; }
    // tempo do clipe preso ao progresso da recarga (não escorrega mesmo com quadros irregulares)
    ra.paused = false; ra.timeScale = dur / total; ra.time = clamp(1 - arms.reloading / total, 0, 1) * dur * 0.999;
  } else if (hero.relAct) hero.relAct = null; // o clipe fica parado no último quadro enquanto some
  let relSum = 0;
  for (const a of hero.reloads) {
    // começa a sumir nos últimos 12% da recarga: a volta para a mira/base se mistura com o fim do clipe
    const on = a === hero.relAct && arms.reloading > arms.reloadTotal * 0.12;
    a.w8 = damp(a.w8, on ? 1 : 0, on ? 8 : 5, dt); if (a.w8 < 0.002) a.w8 = 0;
    relSum += a.w8;
  }
  hero.relW = Math.min(1, relSum); hero.fireW = Math.min(1, fireSum);
  const rel = hero.relW, fire = hero.fireW * (1 - rel), rest = Math.max(0, 1 - rel - fire);
  for (const a of hero.reloads) a.setEffectiveWeight(a.w8 / Math.max(1, relSum));
  for (const a of hero.fires) a.setEffectiveWeight(a.w8 / Math.max(1, fireSum) * (1 - rel));
  // mira: entra e sai com suavidade; com a mira as pernas continuam andando por baixo
  hero.aimW = damp2(hero.aimW, G.aiming && !player.dead ? 1 : 0, 10, 7, dt);
  const aim = hero.aimW * rest, base = rest - aim;
  if (A.aim) A.aim.setEffectiveWeight(aim);
  if (A.idle) A.idle.setEffectiveWeight(base);
  // balanço do tronco ao andar/correr por cima da pose base (só ossos do tronco e braço esquerdo).
  // Peso extra acima de 1 nesses ossos: o mixer normaliza, então a respiração do idle cede espaço ao passo.
  // v11: balanço bem mais presente (antes ~25% depois da normalização) e um pouco dele também mirando
  const swingFor = (up, leg, k) => {
    if (!up || !leg) return;
    up.setEffectiveWeight((base + aim * 0.35) * k); up.time = leg.time;
  };
  swingFor(A.walkUp, A.walk, (A.runUp === A.walkUp ? walkN + runN : walkN) * 0.8);
  if (A.runUp !== A.walkUp) swingFor(A.runUp, A.run, runN * 1.1);
  hero.mixer.update(player.dead ? 0 : dt);
  if (!player.dead && Math.abs(hero.legYaw) > 0.003 && hero.hips && hero.spine0) {
    const ly = hero.legYaw * L;
    rotWorld(hero.hips, _q2.setFromAxisAngle(_up, ly));
    rotWorld(hero.spine0, _q2.setFromAxisAngle(_up, -ly * 0.9)); // tronco volta para a mira
  }
  // inclina o tronco com a mira (pitch da câmera) + coice do disparo
  if (hero.spine && !player.dead) {
    const ang = G.pitch * 0.85 + armKick * 0.25 * mk - armSwap * 0.5;
    hero.spine.parent.updateWorldMatrix(true, false); hero.spine.parent.getWorldQuaternion(_qp);
    _ax.set(-Math.cos(G.yaw), 0, Math.sin(G.yaw)); // eixo "direita" do jogador no mundo
    _q.setFromAxisAngle(_ax, ang); // rotação no mundo → espaço do pai do osso
    _q.premultiply(_qp.clone().invert()).multiply(_qp);
    hero.spine.quaternion.premultiply(_q);
  }
  // braço direito levanta a arma para a mira (os clipes de arma do GLB mantêm o braço baixo):
  // ombro→mão e cano (+Y do soquete) giram em direção ao centro da mira, com peso suave
  // entrada rápida, saída mais lenta; a curva smoothstep tira o tranco no começo e no fim do movimento
  const want = !player.dead && (G.aiming || hero.fireT > -0.7) ? 1 : 0;
  hero.raiseW = damp2(hero.raiseW, want, 16, 5, dt);
  const r = ease(clamp(hero.raiseW, 0, 1)) * (1 - hero.relW);
  if (r > 0.01 && hero.armR && hero.handR) {
    _t.set(Math.sin(G.yaw) * Math.cos(G.pitch), Math.sin(G.pitch), Math.cos(G.yaw) * Math.cos(G.pitch));
    hero.armR.updateWorldMatrix(true, true);
    hero.armR.getWorldPosition(_a); hero.socket.getWorldPosition(_b);
    _q.setFromUnitVectors(_b.sub(_a).normalize(), _t); rotWorld(hero.armR, _qi.identity().slerp(_q, r));
    hero.socket.getWorldQuaternion(_qp); _b.set(0, 1, 0).applyQuaternion(_qp);
    _q.setFromUnitVectors(_b, _t); rotWorld(hero.handR, _qi.identity().slerp(_q, r));
  }
}

// ---------- armas ----------
export const weapons = WEAPONS.map((w) => ({ ...w, mag: w.size, res: w.startRes }));
export const arms = { cur: 0, cool: 0, reloading: 0, reloadTotal: 1, flashT: 0 };
export const curWeapon = () => weapons[arms.cur];
/** Inventário: armas possuídas, granadas e kits médicos guardados. */
export const bag = { owned: [true, false, false], grenades: GRENADE.START, meds: INVENTORY.MED_START, armor: 0, up: {} };

// ---------- v10: upgrades da loja ----------
export const upLevel = (k) => Math.min(bag.up[k] | 0, UPGRADES[k] ? UPGRADES[k].prices.length : 0);
/** Limites que crescem com a Bolsa tática. */
export const medMax = () => INVENTORY.MED_MAX + upLevel('bag');
export const grenadeMax = () => GRENADE.MAX + upLevel('bag');
export const resMax = (i) => weapons[i].resMax ?? Infinity;
/**
 * Recalcula os atributos das armas a partir de WEAPONS + bag.up, mantendo mag/res
 * (o pente é cortado se o tamanho diminuir, ex.: salvo antigo sem upgrade).
 */
export function applyUpgrades() {
  WEAPONS.forEach((base, i) => {
    const w = weapons[i], mag = w.mag, res = w.res;
    Object.assign(w, base);
    if (i === 0) { w.dmg += 4 * upLevel('pistolDmg'); w.size += 3 * upLevel('pistolMag'); }
    if (i === 1) {
      const c = upLevel('sgChoke'); w.spread *= 1 - 0.15 * c; w.aimSpread *= 1 - 0.15 * c; w.falloffLen += 5 * c; w.range += 3 * c;
      w.size += 2 * upLevel('sgTube'); w.resMax += 12 * upLevel('bag');
    }
    if (i === 2) {
      w.size += 10 * upLevel('smgMag');
      const st = upLevel('smgStab'); w.spread *= 1 - 0.2 * st; w.aimSpread *= 1 - 0.2 * st; w.kick *= 1 - 0.25 * st; w.xkick *= 1 - 0.25 * st; w.bloom *= 1 - 0.2 * st;
      w.resMax += 30 * upLevel('bag');
    }
    w.mag = Math.min(mag, w.size); w.res = res === Infinity ? Infinity : Math.min(res, w.resMax ?? Infinity);
  });
  bag.meds = Math.min(bag.meds, medMax()); bag.grenades = Math.min(bag.grenades, grenadeMax());
}

export function switchWeapon(i) {
  if (i === arms.cur || player.dead) return;
  if (!bag.owned[i]) { ui.feed('Você ainda não tem: ' + weapons[i].name, '#a09070'); return; }
  arms.cur = i; arms.reloading = 0; arms.cool = 0.25; sfx.swap(); ui.feed(weapons[i].name, '#d8c27a');
  showGun(i); armSwap = 1;
}
export function startReload() {
  const w = curWeapon(); if (arms.reloading > 0 || w.mag >= w.size || w.res <= 0 || player.dead) return;
  arms.reloading = arms.reloadTotal = w.reload; sfx.reloadStart();
}
function updateWeapons(dt) {
  arms.cool -= dt;
  if (arms.reloading > 0) {
    arms.reloading -= dt;
    if (arms.reloading <= 0) {
      const w = curWeapon(), take = Math.min(w.size - w.mag, w.res);
      w.mag += take; if (w.res !== Infinity) w.res -= take; sfx.reloadEnd();
    }
  }
  arms.flashT -= dt;
  flash.visible = star.visible = arms.flashT > 0;
  flashLight.intensity *= Math.exp(-35 * dt);
}
/** Efeito visual do disparo (chamado por combat.js). s = tamanho do clarão (0..1), kick = coice da arma. */
export function muzzleFlash(s = 0.55, kick = 0.035) {
  arms.flashT = 0.05;
  flash.material.rotation = Math.random() * 6; flash.scale.setScalar(1.1 + s * 0.9);
  star.rotation.z = Math.random() * 3; star.scale.setScalar(0.8 + s * 0.7);
  flashLight.intensity = 40 + s * 50;
  recoil += kick;
  armKick = Math.min(0.7, armKick + kick * 5); // v6: coice visível no braço/arma
  heroFire();
}
let armKick = 0, armSwap = 0;

// ---------- vida ----------
export function hurtPlayer(d, fromX, fromZ, knock) {
  if (player.inv > 0 || G.state !== 'play' || player.dead) return;
  let soaked = 0;
  if (bag.armor > 0) { // v6: colete absorve parte do golpe
    soaked = Math.min(bag.armor, Math.round(d * ARMOR.ABSORB)); bag.armor -= soaked; d -= soaked;
    burst(player.pos.x, 1.3, player.pos.z, 'spark', 6, 3);
    if (bag.armor <= 0) ui.feed('Colete destruído!', '#7ab0ff');
  }
  G.dmgTaken = (G.dmgTaken || 0) + d; // v10: bônus de evento sem dano
  player.hp = Math.max(0, player.hp - d); player.inv = PLAYER.INVULN; G.shake = Math.max(G.shake, 0.45);
  const dx = player.pos.x - fromX, dz = player.pos.z - fromZ, l = Math.hypot(dx, dz) || 1;
  player.kx += dx / l * knock; player.kz += dz / l * knock;
  // direção do atacante relativa à câmera (para o indicador de dano)
  const att = Math.atan2(fromX - player.pos.x, fromZ - player.pos.z);
  ui.damageFrom(wrapAngle(att - G.yaw), d); ui.hurtFlash(d, soaked);
  sfx.hurt(); burst(player.pos.x, 1.3, player.pos.z, 'blood', 8, 3); decal(player.pos.x, player.pos.z, 0.8);
  if (player.hp <= 0) { player.dead = true; roar(0.9, 0.4); if (events.onDeath) events.onDeath(); }
}
export function heal(n) { player.hp = Math.min(PLAYER.HP, player.hp + n); }
/** Usa um kit médico do inventário (tecla H). */
export function useMed() {
  if (player.dead) return false;
  if (bag.meds <= 0) { ui.feed('Sem kits médicos', '#a09070'); return false; }
  if (player.hp >= PLAYER.HP) { ui.feed('Vida já está cheia', '#a09070'); return false; }
  bag.meds--; heal(PICKUPS.MED_HEAL); sfx.pickup(); ui.feed('+' + PICKUPS.MED_HEAL + ' VIDA (kit médico)', '#ff7070'); return true;
}
/** Coloca o jogador num ponto (troca de área / carregar jogo). */
export function placePlayer(x, z, yaw) {
  player.pos.set(x, 0, z); player.kx = player.kz = 0; G.yaw = yaw; G.pitch = -0.12;
  pg.position.set(x, 0, z); pg.rotation.y = yaw; snapCamera();
}
export function snapshotBag() {
  return { owned: [...bag.owned], grenades: bag.grenades, meds: bag.meds, armor: bag.armor, up: { ...bag.up }, hp: player.hp, cur: arms.cur, ammo: weapons.map((w) => ({ mag: w.mag, res: w.res === Infinity ? -1 : w.res })) };
}
export function restoreBag(s) {
  // v6: salvos antigos (v5) tinham só 2 armas e nenhum colete — completa com padrões
  bag.owned = weapons.map((w, i) => i === 0 || !!(s.owned && s.owned[i]));
  bag.grenades = s.grenades ?? GRENADE.START; bag.meds = s.meds ?? INVENTORY.MED_START; bag.armor = s.armor || 0;
  // v10: upgrades (salvos v1–v3 não têm) — aplicados antes do pente, para o tamanho do pente estar certo
  bag.up = s.up && typeof s.up === 'object' ? { ...s.up } : {};
  weapons.forEach((w) => { w.mag = 0; w.res = 0; });
  applyUpgrades();
  player.hp = PLAYER.HP; // terminal restaura a vida
  weapons.forEach((w, i) => {
    const a = s.ammo && s.ammo[i];
    if (a) { w.mag = Math.min(a.mag, w.size); w.res = a.res < 0 ? Infinity : Math.min(a.res, w.resMax ?? Infinity); }
    else { w.mag = w.size; w.res = w.startRes; }
  });
  arms.cur = bag.owned[s.cur] ? s.cur : 0; showGun(arms.cur);
}

export function resetPlayer() {
  Object.assign(player, { hp: PLAYER.HP, inv: 0, kx: 0, kz: 0, dead: false, phase: 0, moving: false });
  player.pos.set(0, 0, 0); pg.rotation.set(0, 0, 0); pg.position.set(0, 0, 0); pg.visible = true;
  bag.owned = [true, false, false]; bag.grenades = GRENADE.START; bag.meds = INVENTORY.MED_START; bag.armor = 0; bag.up = {};
  applyUpgrades(); // v10: volta aos atributos base
  weapons.forEach((w) => { w.mag = w.size; w.res = w.startRes; });
  arms.cur = 0; arms.cool = 0; arms.reloading = 0; showGun(0); armKick = armSwap = 0;
  G.yaw = Math.PI; G.pitch = -0.12; G.aiming = false;
  snapCamera();
}

// ---------- atualização ----------
let heartT = 0;
export function updatePlayer(dt) {
  updateWeapons(dt);
  if (player.dead) { player.vx = player.vz = 0; pg.rotation.x = Math.max(pg.rotation.x - dt * 3, -Math.PI / 2); pg.position.y = 0.2 * Math.min(1, -pg.rotation.x); pg.visible = true; return; }
  if (keys.ArrowLeft) G.yaw += dt * 2.4; if (keys.ArrowRight) G.yaw -= dt * 2.4;
  let ix = 0, iz = 0;
  if (keys.KeyW || keys.ArrowUp) iz += 1; if (keys.KeyS || keys.ArrowDown) iz -= 1; if (keys.KeyD) ix += 1; if (keys.KeyA) ix -= 1;
  if (pad.connected) { ix = clamp(ix + pad.mx, -1, 1); iz = clamp(iz + pad.mz, -1, 1); } // v6: analógico esquerdo
  const fx = Math.sin(G.yaw), fz = Math.cos(G.yaw), rx = -fz, rz = fx;
  let mx = fx * iz + rx * ix, mz = fz * iz + rz * ix; const ml = Math.hypot(mx, mz);
  const run = (keys.ShiftLeft || keys.ShiftRight || pad.run) && iz > 0 && !G.aiming;
  const sp = (run ? PLAYER.RUN : PLAYER.WALK) * (iz < 0 ? PLAYER.BACK_MULT : 1) * (arms.reloading > 0 ? PLAYER.RELOAD_MULT : 1) * (G.aiming ? PLAYER.AIM_MULT : 1) * (inWater(player.pos.x, player.pos.z) ? PLAYER.WATER_MULT : 1);
  if (ml > 1) { mx /= ml; mz /= ml; } // analógico: meio curso = meia velocidade
  player.moving = ml > 0.05; player.running = run && ml > 0;
  player.vx = mx * sp; player.vz = mz * sp;
  const ox = player.pos.x, oz = player.pos.z;
  player.pos.x += mx * sp * dt; player.pos.z += mz * sp * dt;
  resolve(player.pos, player.r);
  // v11: velocidade real andada (parede/encosto reduzem) — usada pela animação; o empurrão (kx/kz) não conta
  if (dt > 0) player.spd = damp(player.spd || 0, Math.min(Math.hypot(player.pos.x - ox, player.pos.z - oz) / dt, sp * Math.min(ml, 1)), 14, dt);
  player.pos.x += player.kx * dt; player.pos.z += player.kz * dt;
  const k = Math.exp(-9 * dt); player.kx *= k; player.kz *= k;
  resolve(player.pos, player.r);
  pg.position.set(player.pos.x, 0, player.pos.z); pg.rotation.y = G.yaw;
  if (ml > 0) {
    const ph0 = player.phase; player.phase += dt * (run ? 13 : 9);
    // v5: passos — um som por pisada (cruzamento de fase), com variação por terreno/corrida
    if (!hero.ok && Math.floor(ph0 / Math.PI) !== Math.floor(player.phase / Math.PI)) sfx.step(inWater(player.pos.x, player.pos.z) ? 'water' : run ? 'run' : 'walk', G.surface || '');
  }
  const sw = ml > 0 ? Math.sin(player.phase) * 0.6 : 0;
  legL.rotation.x = sw; legR.rotation.x = -sw; torso.position.y = 1.25 + Math.abs(sw) * 0.04;
  // v6: coice (sobe e recua), troca de arma (abaixa e volta) e recarga animada (abaixa, inclina, bate o pente)
  const mk = motionK();
  armKick = damp(armKick, 0, 16, dt); armSwap = damp(armSwap, 0, 7, dt);
  armR.rotation.x = -G.pitch * 0.8 - armKick * mk + armSwap * 0.9; armR.rotation.z = 0; armR.position.z = -armKick * 0.25 * mk;
  if (arms.reloading > 0) {
    const t = 1 - arms.reloading / arms.reloadTotal, dip = Math.sin(Math.min(1, t * 1.15) * Math.PI);
    armR.rotation.x += 0.75 * dip; armR.rotation.z = -0.35 * dip;
    if (t > 0.55 && t < 0.7) armR.rotation.x -= 0.12 * Math.sin((t - 0.55) / 0.15 * Math.PI); // tranco do pente
  }
  armL.rotation.x = armR.rotation.x;
  updateHero(dt, mk);
  // poeira ao correr
  if (run) { player.stepT -= dt; if (player.stepT <= 0) { player.stepT = 0.16; burst(player.pos.x - fx * 0.3, 0.1, player.pos.z - fz * 0.3, 'dust', 2, 0.8); } }
  player.inv -= dt;
  pg.visible = !(player.inv > 0 && Math.floor(G.time * 20) % 2 === 0);
  // batimento cardíaco com pouca vida
  if (player.hp < PLAYER.LOW_HP) { heartT -= dt; if (heartT <= 0) { heartT = 0.6 + player.hp / 60; sfx.heartbeat(); } }
}

// ---------- câmera em terceira pessoa (atrás / sobre o ombro) ----------
const pivot = new THREE.Vector3(0, CAMERA.HEIGHT, 0);
let camDist = CAMERA.DIST, shoulderCur = CAMERA.SHOULDER, recoil = 0;
const look = new THREE.Vector3();
/** Distância até sair do retângulo da área (a câmera não atravessa o muro de borda). */
function boundRay(ox, oz, dx, dz) {
  let t = Infinity;
  if (dx > 1e-4) t = Math.min(t, (bounds.maxX - ox) / dx); else if (dx < -1e-4) t = Math.min(t, (bounds.minX - ox) / dx);
  if (dz > 1e-4) t = Math.min(t, (bounds.maxZ - oz) / dz); else if (dz < -1e-4) t = Math.min(t, (bounds.minZ - oz) / dz);
  return Math.max(0, t);
}
function snapCamera() { pivot.set(player.pos.x, CAMERA.HEIGHT, player.pos.z); camDist = CAMERA.DIST; recoil = 0; }

export function updateCamera(dt) {
  const fx = Math.sin(G.yaw), fz = Math.cos(G.yaw), rx = -fz, rz = fx;
  // pivô segue o jogador com suavização (sem atrasar a mira, que usa yaw/pitch direto)
  pivot.x = damp(pivot.x, player.pos.x, CAMERA.FOLLOW, dt);
  pivot.z = damp(pivot.z, player.pos.z, CAMERA.FOLLOW, dt);
  // ombro: lado escolhido com V, recolhe se houver parede ao lado
  const wantSh = (G.aiming ? CAMERA.SHOULDER * 0.85 : CAMERA.SHOULDER) * G.shoulder;
  const side = castWorld(pivot.x, pivot.z, rx * Math.sign(wantSh), rz * Math.sign(wantSh), Math.abs(wantSh) + 0.3, 1.8);
  const sh = Math.sign(wantSh) * Math.max(0, Math.min(Math.abs(wantSh), side - 0.3));
  shoulderCur = damp(shoulderCur, sh, 10, dt);
  const hx = pivot.x + rx * shoulderCur, hz = pivot.z + rz * shoulderCur, hy = CAMERA.HEIGHT;
  // distância desejada + colisão com paredes/árvores (entra rápido, sai devagar)
  const mk = motionK(); // v6: movimento reduzido corta tremor e recuo da câmera
  const pitch = G.pitch + recoil * mk;
  const want = G.aiming ? CAMERA.AIM_DIST : CAMERA.DIST;
  const back = Math.cos(pitch) * want;
  const hit = Math.min(castWorld(hx, hz, -fx, -fz, back + 0.4, 1.8), boundRay(hx, hz, -fx, -fz) + 0.6);
  const target = clamp(hit - 0.35, CAMERA.MIN_DIST, back);
  camDist = target < camDist ? damp(camDist, target, 30, dt) : damp(camDist, target, 5, dt);
  const up = -Math.sin(pitch) * want * (camDist / Math.max(back, 0.01));
  camera.position.set(hx - fx * camDist, Math.max(0.6, hy + up + 0.3), hz - fz * camDist);
  look.set(hx + fx * 10, hy + Math.sin(pitch) * 10.5 + 0.1, hz + fz * 10);
  if (G.shake > 0.005) {
    const s = G.shake * 0.45 * mk, t = G.time * 60;
    camera.position.x += Math.sin(t * 1.3) * s * 0.5; camera.position.y += Math.sin(t * 1.7 + 1) * s * 0.5; camera.position.z += Math.sin(t * 1.1 + 2) * s * 0.5;
  }
  camera.lookAt(look);
  // zoom de mira
  // v11: "soco" de FOV no disparo (abre e volta rápido), escalado pelo movimento reduzido
  G.fovKick = damp(G.fovKick || 0, 0, 18, dt);
  hero.fovBase = damp(hero.fovBase || CAMERA.FOV, G.aiming ? CAMERA.AIM_FOV : CAMERA.FOV, 12, dt);
  const fov = hero.fovBase + G.fovKick * mk;
  if (Math.abs(camera.fov - fov) > 0.01) { camera.fov = fov; camera.updateProjectionMatrix(); }
  recoil = damp(recoil, 0, 14, dt);
  // lanterna acompanha a inclinação da câmera
  torchT.position.set(0.38, 1.45 + Math.sin(G.pitch) * 12, 12);
  G.shake *= Math.exp(-6 * dt);
}
/** Câmera do menu: órbita lenta ao redor do centro. */
// v9: no menu a Marina respira no idle, mas o mixer roda a ~15 Hz (economiza o esqueleto inteiro a cada quadro)
let menuAnimT = 0;
export function menuCamera(dt) {
  G.yaw += dt * 0.15; G.pitch = -0.12;
  if (G.state === 'menu' && hero.ok && !player.dead) { menuAnimT += dt; if (menuAnimT >= 1 / 15) { hero.mixer.update(Math.min(menuAnimT, 0.2)); menuAnimT = 0; } }
  updateCamera(dt);
}
