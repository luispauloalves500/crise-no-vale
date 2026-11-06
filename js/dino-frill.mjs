// Oscilação secundária por instância. O clipe abre a gola; a mola acrescenta inércia às seis hastes.
export function stepFrillSpring(state,target,dt) {
  const time=Math.min(.12,Math.max(0,dt)),steps=Math.max(1,Math.ceil(time*120)),h=time/steps;
  for(let i=0;i<steps;i++){state.velocity+=(90*(target-state.value)-18*state.velocity)*h;state.value+=state.velocity*h;}
  return state.value;
}
export function createFrillDynamics(root,THREE) {
  const bones=['L','R'].map((side,i)=>({sign:i?1:-1,hinge:root.getObjectByName('Frill_'+side),top:root.getObjectByName('Frill_'+side+'_Top'),bottom:root.getObjectByName('Frill_'+side+'_Bottom')}));
  if(bones.some(b=>!b.hinge||!b.top||!b.bottom))return null;
  const state={value:0,velocity:0},axisY=new THREE.Vector3(0,1,0),axisX=new THREE.Vector3(1,0,0),q=new THREE.Quaternion();let phase=0,lastSpeed=0,lastYaw=null;
  return {state,reset(){state.value=state.velocity=phase=lastSpeed=0;lastYaw=null;},update(e,dt,speed){
    if(e.dead){state.value=state.velocity=0;return;}
    const h=Math.max(1/240,dt),yaw=e.yaw||0,turn=lastYaw===null?0:Math.atan2(Math.sin(yaw-lastYaw),Math.cos(yaw-lastYaw))/h;
    const acceleration=(speed-lastSpeed)/h;lastSpeed=speed;lastYaw=yaw;phase+=Math.min(dt,.12)*(2+Math.min(speed,8)*1.3);
    const target=Math.max(-.18,Math.min(.18,-acceleration*.010+turn*.025)),lag=stepFrillSpring(state,target,dt),wave=Math.sin(phase)*(.012+Math.min(speed,8)*.006);
    for(const b of bones){b.hinge.quaternion.multiply(q.setFromAxisAngle(axisY,b.sign*(lag+wave)));b.top.quaternion.multiply(q.setFromAxisAngle(axisX,lag*.55+wave*1.8));b.bottom.quaternion.multiply(q.setFromAxisAngle(axisX,-lag*.4+wave*1.3));}
  }};
}
