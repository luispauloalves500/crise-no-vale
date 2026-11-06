import { G } from './state.js';
import { camera, bounds } from './world.js';
import { clearInput, unlockPointer, lockPointer } from './input.js';
import { player, pg, animateDoorWalk, animateBoarding, placePlayer } from './player.js';
import { animateCinematicEnemies } from './enemies.js';
import { updateSurvivor } from './npc.js';
import { updateBrandt } from './brandt.js';
import { createTimeline, sceneScript } from './cutscene-timeline.mjs';
let active=null;
const panel=document.createElement('section'); panel.id='cutscene';panel.hidden=true;panel.setAttribute('aria-label','Cena cinematográfica');
panel.innerHTML='<div class="cinema-top"><span id="cinema-title"></span></div><div class="cinema-bottom"><div id="cinema-dialogue" role="status" aria-live="polite"></div><button id="cinema-skip">Pular cena · Esc / Enter</button></div>';
document.body.append(panel);
const title=panel.querySelector('#cinema-title'),dialogue=panel.querySelector('#cinema-dialogue');
panel.querySelector('button').onclick=()=>skipCutscene();
export const cutsceneActive=()=>!!active;
export const currentCutscene=()=>active?{id:active.script.id,time:active.timeline.time,duration:active.script.duration}:null;
export function playCutscene(id,opts={}) {
  if(active||G.state!=='play')return false;
  const script=sceneScript(id,opts.focus||player.pos,opts.flags||{});
  const saved={pos:camera.position.clone(),q:camera.quaternion.clone(),fov:camera.fov,hero:pg.position.clone(),yaw:pg.rotation.y};
  const a=active={script,opts,saved,timeline:null};
  a.timeline=createTimeline(script,()=>finish(a,true));
  clearInput();G.state='cutscene';unlockPointer();panel.hidden=false;title.textContent=script.title;
  return true;
}
function finish(a,complete) {
  if(active!==a)return;
  active=null;panel.hidden=true;clearInput();
  if(a.opts.heroPath)placePlayer(player.pos.x,player.pos.z,a.saved.yaw);
  else animateDoorWalk(0,a.saved.hero,a.saved.yaw,false);
  camera.position.copy(a.saved.pos);camera.quaternion.copy(a.saved.q);camera.fov=a.saved.fov;camera.updateProjectionMatrix();
  G.state='play';
  if(complete)a.opts.onComplete?.();
  if(G.state==='play')lockPointer();
}
export function skipCutscene(){if(!active)return false;active.timeline.skip();return true;}
export function cancelCutscene(){if(active)finish(active,false);}
export function updateCutscene(dt) {
  const a=active;if(!a)return;
  a.timeline.update(dt);if(active!==a)return;
  const t=a.timeline.time;
  // Keep skeletal actors alive, not combat/AI. Scripted NPC paths can continue safely.
  const path=a.opts.heroPath;
  if(path){const k=Math.min(1,t/(a.script.duration*.8));const p={x:path[0].x+(path[1].x-path[0].x)*k,z:path[0].z+(path[1].z-path[0].z)*k,y:(path[1].y||0)*k};p.moving=k<1;animateBoarding(dt,p,Math.atan2(path[1].x-path[0].x,path[1].z-path[0].z),Math.max(0,(k-.7)/.3));}
  else animateDoorWalk(dt,a.saved.hero,a.saved.yaw,false);
  animateCinematicEnemies(dt);updateSurvivor(dt);updateBrandt(dt);a.opts.onUpdate?.(dt,t);
  const s=a.timeline.sample();
  s.pos[0]=Math.max(bounds.minX+.7,Math.min(bounds.maxX-.7,s.pos[0]));
  s.pos[2]=Math.max(bounds.minZ+.7,Math.min(bounds.maxZ-.7,s.pos[2]));
  camera.position.fromArray(s.pos);camera.lookAt(...s.look);camera.fov=s.fov;camera.updateProjectionMatrix();
  const l=a.timeline.subtitle();dialogue.textContent=l?l.who+' — '+l.text:'';
}
