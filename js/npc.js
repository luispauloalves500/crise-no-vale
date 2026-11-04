import { actorShadow } from './contact-shadows.js';
// npc.js — a sobrevivente (Dra. Lima): espera na cabine, segue o jogador e é derrubada (não morre) por mordidas.
import * as THREE from 'three';
import { scene, resolve, boxes, circles, bounds, GLOW } from './world.js';
import { findEscortPath, ESCORT_RADIUS } from './escort-nav.mjs';
import { G } from './state.js';
import { player } from './player.js';
import { sfx } from './audio.js';
import { burst } from './fx.js';
import * as ui from './ui.js';
import { lerpAngle } from './utils.js';
import { ESCORT } from './config.js';
import { loadModel, limitTextures } from './model-assets.js';

export const survivor = {
  pos: new THREE.Vector3(), yaw: 0, following: false, downT: 0, safeT: 0, grit: 2, gritT: 0, downs: 0, visible: false, phase: 0, home: { x: 0, z: 0 }, goal: null, name: 'Dra. Lima',
  nav: { route: [], index: 0, aim: null, repath: 0, stuck: 0, warn: 0 },
};

// ---------- malha (jaleco branco, cabelo preto, rádio) ----------
const g = new THREE.Group(); g.visible = false; scene.add(g);
actorShadow(g, 1.1, 0.95);
const coat = new THREE.MeshStandardMaterial({ color: 0xd8d8d0, roughness: 0.8 });
const pants = new THREE.MeshStandardMaterial({ color: 0x2a3040, roughness: 0.9 });
const skin = new THREE.MeshStandardMaterial({ color: 0x8a5a3a, roughness: 0.8 });
const hair = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });
const P = (geo, m, x, y, z, par = g) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; par.add(o); return o; };
const B = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const body = new THREE.Group(); g.add(body);
P(B(0.58, 0.8, 0.34), coat, 0, 1.25, 0, body); P(B(0.62, 0.35, 0.38), coat, 0, 0.82, 0, body);
P(new THREE.SphereGeometry(0.19, 12, 10), skin, 0, 1.83, 0, body);
P(new THREE.SphereGeometry(0.2, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.6), hair, 0, 1.88, -0.02, body);
P(B(0.3, 0.3, 0.12), hair, 0, 1.75, -0.16, body);
const legs = [-0.14, 0.14].map((x) => { const l = new THREE.Group(); l.position.set(x, 0.85, 0); body.add(l); P(B(0.2, 0.85, 0.22), pants, 0, -0.42, 0, l); return l; });
// braços articulados (aceno quando espera), óculos, crachá, coque, tablet e barra do jaleco aberta
const arms = [-0.36, 0.36].map((x) => { const a = new THREE.Group(); a.position.set(x, 1.55, 0.02); body.add(a); P(B(0.14, 0.62, 0.14), coat, 0, -0.3, 0, a); P(new THREE.SphereGeometry(0.07, 8, 6), skin, 0, -0.64, 0, a); return a; });
const darkM = new THREE.MeshStandardMaterial({ color: 0x101418, roughness: 0.3, metalness: 0.5 });
const badgeM = new THREE.MeshStandardMaterial({ color: 0xe0f0ff, emissive: 0x2a6a8a, emissiveIntensity: 0.6 });
const shirtM = new THREE.MeshStandardMaterial({ color: 0x5a7a8a, roughness: 0.8 });
P(B(0.2, 0.55, 0.02), shirtM, 0, 1.3, 0.172, body);                 // camisa por baixo do jaleco
for (const x of [-0.18, 0.18]) P(B(0.2, 0.42, 0.04), coat, x, 0.6, 0.15, body).rotation.x = -0.06; // abas do jaleco
P(B(0.3, 0.05, 0.03), darkM, 0, 1.86, 0.18, body);                   // óculos
P(B(0.09, 0.12, 0.02), badgeM, 0.18, 1.42, 0.18, body);              // crachá Tellus
P(new THREE.SphereGeometry(0.09, 8, 6), hair, 0, 1.9, -0.2, body);   // coque
const tablet = P(B(0.22, 0.3, 0.03), darkM, 0, -0.62, 0.1, arms[0]); tablet.rotation.x = -0.4;
P(new THREE.CylinderGeometry(0.1, 0.1, 0.06, 10), skin, 0, 1.64, 0, body); // pescoço
const marker = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW, color: 0x60ff90, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
marker.scale.setScalar(0.7); marker.position.y = 2.45; g.add(marker);

// Carrega Lima somente quando ela é necessária; preserva a malha de reserva em caso de erro.
let limaModel = null, limaMixer = null, limaWalk = null, limaLoading = false;
function ensureLimaModel() {
  if (limaModel || limaLoading) return;
  limaLoading = true;
  loadModel('assets/personagens/dra-lima-lod.glb').then(gltf => {
    const model = gltf.scene;
    limitTextures(model); model.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(model), height = box.max.y - box.min.y;
    if (!Number.isFinite(height) || height < 0.01) throw new Error('modelo sem altura válida');
    const scale = 1.8 / height; model.scale.setScalar(scale); model.position.y = -box.min.y * scale;
    model.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false; } });
    for (const child of body.children) child.visible = false;
    body.add(model); limaModel = model;
    const clip = gltf.animations.find(a => a.name === 'Walking') || gltf.animations[0];
    if (clip) { limaMixer = new THREE.AnimationMixer(model); limaWalk = limaMixer.clipAction(clip); limaWalk.play(); limaWalk.paused = true; }
  }).catch(e => console.warn('Modelo da Dra. Lima indisponível; usando reserva:', e))
    .finally(() => { limaLoading = false; });
}
/** Coloca a sobrevivente esperando num ponto (cabine). */
export function resetSurvivor(x, z, show) {
  if (show) ensureLimaModel();
  survivor.home = { x, z }; survivor.pos.set(x, 0, z); survivor.following = false; survivor.downT = 0; survivor.safeT = 0; survivor.grit = ESCORT.GRIT; survivor.gritT = 0; survivor.downs = 0; survivor.goal = null;
  survivor.visible = show; g.visible = show; body.rotation.set(0, 0, 0); body.position.y = 0; survivor.yaw = 0.8;
  survivor.nav = { route: [], index: 0, aim: null, repath: 0, stuck: 0, warn: 0 };
  g.position.copy(survivor.pos); g.rotation.y = survivor.yaw;
}
/** Estado portável para save/load e continuidade ao voltar ao pátio. */
export function snapshotSurvivor() {
  if (!survivor.visible) return null;
  const s = survivor;
  return { x:s.pos.x, z:s.pos.z, yaw:s.yaw, following:s.following,
    downT:s.downT, safeT:s.safeT, grit:s.grit, gritT:s.gritT, downs:s.downs,
    home:{ ...s.home }, goal:s.goal ? {x:s.goal.x,z:s.goal.z} : null };
}
export function restoreSurvivor(saved, fallback) {
  resetSurvivor(fallback.x, fallback.z, true);
  if (!saved || !Number.isFinite(saved.x) || !Number.isFinite(saved.z)) return;
  const s = survivor;
  s.pos.set(saved.x, 0, saved.z); resolve(s.pos, ESCORT_RADIUS);
  s.yaw = Number.isFinite(saved.yaw) ? saved.yaw : s.yaw;
  s.following = !!saved.following;
  s.downT = Math.max(0,Number(saved.downT)||0);
  s.safeT = Math.max(0,Number(saved.safeT)||0);
  s.grit = Math.max(0,Math.min(ESCORT.GRIT,Number.isFinite(saved.grit)?saved.grit:ESCORT.GRIT));
  s.gritT = Math.max(0,Number(saved.gritT)||0);
  s.downs = Math.max(0,saved.downs|0);
  if(saved.home&&Number.isFinite(saved.home.x)&&Number.isFinite(saved.home.z))s.home={...saved.home};
  if(saved.goal&&Number.isFinite(saved.goal.x)&&Number.isFinite(saved.goal.z))s.goal={...saved.goal};
  g.position.copy(s.pos);g.rotation.y=s.yaw;
}
/** Retoma a escolta sem reiniciar encontros nem reposicionar a sobrevivente. */
export function resumeEscort() { survivor.following = true; survivor.goal = null; survivor.nav.repath = 0; }
export function hideSurvivor() { survivor.visible = false; survivor.following = false; g.visible = false; }
/**
 * Mordida. v5: ela aguenta ESCORT.GRIT mordidas (cambaleia) antes de cair; caída, fica ESCORT.DOWN s no chão
 * ou até o jogador apertar E perto dela. Depois de levantar tem ESCORT.SAFE s em que os inimigos a ignoram.
 */
export function hurtSurvivor(e) {
  if (survivor.downT > 0 || survivor.safeT > 0) return;
  const dx = survivor.pos.x - e.pos.x, dz = survivor.pos.z - e.pos.z, l = Math.hypot(dx, dz) || 1;
  burst(survivor.pos.x, 1.2, survivor.pos.z, 'blood', 5, 2.5);
  survivor.gritT = ESCORT.GRIT_REGEN;
  if (survivor.grit > 1) {
    survivor.grit--; survivor.safeT = 0.6; sfx.hurt();
    ui.feed(survivor.name + ' foi mordida! Proteja-a', '#ffb070');
    survivor.pos.x += dx / l * 0.5; survivor.pos.z += dz / l * 0.5; resolve(survivor.pos, 0.4);
    return;
  }
  survivor.grit = 0; survivor.downT = ESCORT.DOWN; survivor.downs++; sfx.hurt();
  ui.feed(survivor.name + ' caiu! Aperte E perto dela', '#ff8060'); G.shake = Math.max(G.shake, 0.15);
  survivor.pos.x += dx / l * 0.8; survivor.pos.z += dz / l * 0.8; resolve(survivor.pos, 0.4);
}
/** Levantar a Dra. Lima (tecla E perto dela). */
export function reviveSurvivor(byPlayer = true) {
  if (survivor.downT <= 0) return;
  survivor.downT = 0; survivor.grit = ESCORT.GRIT; survivor.safeT = ESCORT.SAFE;
  if (byPlayer) { sfx.revive(); burst(survivor.pos.x, 1.0, survivor.pos.z, 'spark', 10, 1.6); }
  ui.feed(survivor.name + (byPlayer ? ' de pé — vamos!' : ' levantou sozinha'), '#a0ffb0');
}

export function updateSurvivor(dt) {
  if (!survivor.visible) return;
  marker.material.opacity = survivor.following ? 0.35 + 0.25 * Math.sin(G.time * 5) : 0.9;
  marker.material.color.setHex(survivor.downT > 0 ? 0xff5040 : survivor.grit < ESCORT.GRIT ? 0xffc040 : 0x60ff90);
  if (survivor.downT > 0) {
    // caída: marcador vermelho grande piscando (fácil de achar no meio da luta)
    marker.material.opacity = 0.55 + 0.45 * Math.sin(G.time * 10); marker.scale.setScalar(1.1);
    survivor.downT -= dt;
    body.rotation.x = Math.max(body.rotation.x - dt * 6, -1.35); body.position.y = 0.15;
    if (survivor.downT <= 0) { survivor.downT = 0.001; reviveSurvivor(false); }
    g.position.copy(survivor.pos); return;
  }
  marker.scale.setScalar(0.7);
  if (survivor.safeT > 0) survivor.safeT -= dt;
  if (survivor.grit < ESCORT.GRIT && (survivor.gritT -= dt) <= 0) { survivor.grit++; survivor.gritT = ESCORT.GRIT_REGEN; }
  body.rotation.x += (0 - body.rotation.x) * Math.min(1, dt * 8); body.position.y = 0;
  let mvx = 0, mvz = 0, spd = 0;
  const tgt = survivor.goal || (survivor.following ? player.pos : null);
  const nav = survivor.nav;
  if (tgt) {
    const dx = tgt.x - survivor.pos.x, dz = tgt.z - survivor.pos.z;
    const d = Math.hypot(dx, dz), stop = survivor.goal ? 0.3 : ESCORT.FOLLOW_STOP;
    nav.repath -= dt;
    const movedTarget = !nav.aim || Math.hypot(tgt.x-nav.aim.x,tgt.z-nav.aim.z) > 1.8;
    if (d > stop && (nav.repath <= 0 || nav.stuck > 1.2) &&
        (movedTarget || nav.route.length === 0 || nav.index >= nav.route.length || nav.stuck > 1.2)) {
      nav.route = findEscortPath(survivor.pos,tgt,{bounds,boxes,circles});
      nav.index = 0; nav.aim = {x:tgt.x,z:tgt.z}; nav.repath = ESCORT.REPATH; nav.stuck = 0;
    } else if (nav.repath <= 0) nav.repath = ESCORT.REPATH;
    while (nav.index < nav.route.length &&
      Math.hypot(nav.route[nav.index].x-survivor.pos.x,nav.route[nav.index].z-survivor.pos.z) < 0.72) nav.index++;
    const waypoint = nav.route[nav.index];
    if (d > stop && waypoint) {
      const wx=waypoint.x-survivor.pos.x,wz=waypoint.z-survivor.pos.z,wd=Math.hypot(wx,wz);
      if (wd > 0.001) {
        mvx = wx / wd; mvz = wz / wd;
        spd = Math.min(ESCORT.FOLLOW_MAX, 1.6 + Math.max(0,d-stop)*0.68);
        spd = Math.min(spd,wd/Math.max(dt,0.001));
      }
    }
    if (spd > 0.05) survivor.yaw = lerpAngle(survivor.yaw,Math.atan2(mvx,mvz),Math.min(1,dt*7));
    else if (d < 5) survivor.yaw = lerpAngle(survivor.yaw,Math.atan2(dx,dz),Math.min(1,dt*3));
    if (d > stop + 5 && !nav.route.length && (nav.warn-=dt) <= 0) {
      ui.feed('Dra. Lima: não encontro passagem. Volte até mim!', '#ffcf80'); nav.warn=10;
    }
  } else {
    nav.route=[];nav.index=0;nav.aim=null;nav.stuck=0;
    survivor.yaw=lerpAngle(survivor.yaw,Math.atan2(player.pos.x-survivor.pos.x,player.pos.z-survivor.pos.z),Math.min(1,dt*3));
  }
  const ox=survivor.pos.x,oz=survivor.pos.z;
  survivor.pos.x += mvx*spd*dt; survivor.pos.z += mvz*spd*dt;
  resolve(survivor.pos,ESCORT_RADIUS);
  const traveled=Math.hypot(survivor.pos.x-ox,survivor.pos.z-oz);
  nav.stuck = spd > 1 && traveled < dt*0.25 ? nav.stuck+dt : Math.max(0,nav.stuck-dt*2);
  if(nav.stuck>1.2)nav.repath=0;
  // Movimento dos membros segue os metros reais percorridos e para quando bloqueada.
  const gait=Math.min(1,traveled/Math.max(0.001,dt*3.2));
  if (limaMixer && limaWalk) { limaWalk.paused = gait < 0.08; limaWalk.timeScale = Math.max(0.6, gait * 1.2); limaMixer.update(dt); }
  if(traveled>0.001)survivor.phase+=traveled*2.8;
  const sw=Math.sin(survivor.phase)*0.63*gait;
  legs[0].rotation.x=sw;legs[1].rotation.x=-sw;
  body.rotation.z=-Math.sin(survivor.phase)*0.035*gait;
  const near=!survivor.following&&!survivor.goal&&Math.hypot(player.pos.x-survivor.pos.x,player.pos.z-survivor.pos.z)<9;
  arms[1].rotation.x=near?-1.7-Math.sin(G.time*4)*0.2:-Math.sin(survivor.phase)*0.4*gait;
  arms[1].rotation.z=near?0.18*Math.sin(G.time*4):0;
  arms[0].rotation.x=Math.sin(survivor.phase)*0.3*gait-0.3;
  g.position.copy(survivor.pos); g.rotation.y = survivor.yaw;
}
