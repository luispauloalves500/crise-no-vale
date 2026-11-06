// O relógio da IA também posiciona o mixer: nunca há um segundo temporizador de disparo.
export const SPIT_DURATION=.95, SPIT_RELEASE=.52;
export const beginSpit=()=>({time:0,released:false,done:false,cancelled:false});
export function advanceSpit(action,dt,cancel=false) {
  if (!action || action.done) return false;
  if (cancel) { action.cancelled=action.done=true; return false; }
  action.time=Math.min(SPIT_DURATION,action.time+Math.max(0,Number.isFinite(dt)?dt:0));
  const release=!action.released&&action.time>=SPIT_RELEASE;
  if (release) action.released=true;
  action.done=action.time>=SPIT_DURATION;return release;
}
export function spitTrajectory(mouth,target,velocity={x:0,z:0}) {
  const dist=Math.hypot(target.x-mouth.x,target.z-mouth.z),lead=Math.min(.5,dist/12);
  let dx=target.x+(velocity.x||0)*lead-mouth.x,dz=target.z+(velocity.z||0)*lead-mouth.z;
  const length=Math.hypot(dx,dz)||1,flight=Math.max(.15,length/12);
  return {x:mouth.x,y:mouth.y,z:mouth.z,vx:dx/length*12,vy:((target.y||0)+1.15-mouth.y)/flight,vz:dz/length*12,life:2.5};
}
