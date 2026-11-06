// Correção final de pose em espaço do corpo, depois do AnimationMixer.
// Os rigs não têm o mesmo repouso: Marina já está em A-pose, Jill em T-pose.
// Aplicar só targetBind * inverse(sourceBind) preservava justamente o T da Jill.
export const RELOAD_KEYS = Object.freeze([
  {t:0,belt:0,under:0,tilt:0},
  {t:.12,belt:.45,under:.07,tilt:.30},
  {t:.26,belt:1,under:0,tilt:.55},
  {t:.40,belt:1,under:0,tilt:.55},
  {t:.60,belt:.05,under:.16,tilt:.55},
  {t:.70,belt:0,under:.015,tilt:.50},
  {t:.80,belt:0,under:0,tilt:.30},
  {t:.92,belt:0,under:0,tilt:.08},
  {t:1,belt:0,under:0,tilt:0},
]);
const clamp = (v,a=0,b=1) => Math.min(b,Math.max(a,v));
const smooth = x => {x=clamp(x);return x*x*(3-2*x);};
export function reloadPoseAt(progress) {
  const t=clamp(Number.isFinite(progress)?progress:0);
  const i=Math.max(1,RELOAD_KEYS.findIndex(k=>k.t>=t)),a=RELOAD_KEYS[i-1],b=RELOAD_KEYS[i];
  const f=smooth((t-a.t)/(b.t-a.t));
  return {t,belt:a.belt+(b.belt-a.belt)*f,under:a.under+(b.under-a.under)*f,tilt:a.tilt+(b.tilt-a.tilt)*f,
    blend:smooth(t/.10)*smooth((1-t)/.10),magazine:t>=.28&&t<.72};
}
export function createHeroArmRig(THREE,model,root=model,socket=null) {
  const bone=n=>model.getObjectByName('mixamorig:'+n)||model.getObjectByName('mixamorig'+n);
  const names=['LeftShoulder','LeftArm','LeftForeArm','LeftHand','RightShoulder','RightArm','RightForeArm','RightHand','Hips','Spine2'];
  const bones=Object.fromEntries(names.map(n=>[n,bone(n)]));
  if(Object.values(bones).some(b=>!b))return null;
  const rest=new Map(names.slice(0,8).map(n=>[n,bones[n].quaternion.clone()]));
  const fingers=[];model.traverse(b=>{if(b.isBone&&/LeftHand(?:Index|Middle|Ring|Pinky|Thumb)[123]$/.test(b.name))fingers.push([b,b.quaternion.clone()]);});
  const v=()=>new THREE.Vector3(),q=()=>new THREE.Quaternion();
  const pos=b=>b.getWorldPosition(v());model.updateWorldMatrix(true,true);
  const length=side=>pos(bones[side+'Arm']).distanceTo(pos(bones[side+'ForeArm']))+pos(bones[side+'ForeArm']).distanceTo(pos(bones[side+'Hand']));
  const lengths={Left:length('Left'),Right:length('Right')};
  // Pente pequeno, na mão e não no chão; dimensões independentes da escala do GLB.
  const scale=bones.LeftHand.getWorldScale(v()).x||1;
  const magazine=new THREE.Mesh(new THREE.BoxGeometry(.034/scale,.085/scale,.022/scale),new THREE.MeshStandardMaterial({color:0x252b30,metalness:.65,roughness:.4}));
  magazine.name='PenteDaRecarga';magazine.position.set(0,.035/scale,0);magazine.visible=false;bones.LeftHand.add(magazine);
  function rotateWorld(b,delta) {
    b.parent.updateWorldMatrix(true,false);
    const parent=b.parent.getWorldQuaternion(q()),world=b.getWorldQuaternion(q());
    b.quaternion.copy(parent.invert().multiply(delta.clone().multiply(world))).normalize();
    b.updateWorldMatrix(false,true);
  }
  function align(b,child,target) {
    const p=pos(b),from=pos(child).sub(p).normalize(),to=target.clone().sub(p).normalize();
    rotateWorld(b,q().setFromUnitVectors(from,to));
  }
  function solve(side,target,pole) {
    const arm=bones[side+'Arm'],fore=bones[side+'ForeArm'],hand=bones[side+'Hand'];
    const s=pos(arm),e=pos(fore),w=pos(hand),a=s.distanceTo(e),b=e.distanceTo(w);
    const direction=target.clone().sub(s),d=clamp(direction.length(),Math.abs(a-b)+.001,(a+b)*.985);direction.normalize();
    const end=s.clone().addScaledVector(direction,d);
    const p=pole.clone().addScaledVector(direction,-pole.dot(direction)).normalize();
    const cos=clamp((a*a+d*d-b*b)/(2*a*d),-1,1);
    const elbow=s.clone().addScaledVector(direction,a*cos).addScaledVector(p,a*Math.sqrt(Math.max(0,1-cos*cos)));
    align(arm,fore,elbow);align(fore,hand,end);
  }
  function orient(hand,direction,roll=0) {
    const axis=v().set(0,1,0).applyQuaternion(hand.getWorldQuaternion(q()));
    rotateWorld(hand,q().setFromUnitVectors(axis,direction.clone().normalize()));
    if(roll)rotateWorld(hand,q().setFromAxisAngle(direction.clone().normalize(),roll));
  }
  function apply({aim=0,moving=0,run=0,phase=0,pitch=0,reload=null,kick=0}={}) {
    aim=clamp(aim);run=clamp(run);moving=clamp(moving);
    for(const [name,rotation] of rest)bones[name].quaternion.copy(rotation);
    // Uma clavícula neutra levemente rodada; os braços recebem IK independente.
    bones.LeftShoulder.quaternion.multiply(q().setFromAxisAngle(v().set(0,0,1),.035));
    bones.RightShoulder.quaternion.multiply(q().setFromAxisAngle(v().set(0,0,1),-.035));
    model.updateWorldMatrix(true,true);
    const up=pos(bones.Spine2).sub(pos(bones.Hips)).normalize();
    const left=pos(bones.LeftArm).sub(pos(bones.RightArm)).normalize();
    const forward=v().set(0,0,1).applyQuaternion(root.getWorldQuaternion(q()));
    const aimDir=forward.clone().multiplyScalar(Math.cos(pitch)).addScaledVector(up,Math.sin(pitch)).normalize();
    const down=up.clone().negate(),hip=pos(bones.Hips),S=pos(bones.RightArm),u=lengths.Right;
    const reloading=Number.isFinite(reload),key=reloading?reloadPoseAt(reload):{blend:0,tilt:0};
    const ready=S.clone().addScaledVector(forward,u*.62).addScaledVector(down,u*.50).addScaledVector(left,-u*.03);
    const aiming=S.clone().addScaledVector(aimDir,u*.96).addScaledVector(down,u*.08);
    const targetR=ready.lerp(aiming,aim);
    const reloadR=S.clone().addScaledVector(forward,u*.60).addScaledVector(down,u*.36).addScaledVector(left,u*.12);
    targetR.lerp(reloadR,key.blend);solve('Right',targetR,down.clone().addScaledVector(left,-.35));
    orient(bones.RightHand,aimDir,key.tilt-kick*.12);
    const l=lengths.Left,SL=pos(bones.LeftArm),swing=Math.sin(phase*Math.PI*2)*moving*(1-run);
    const relaxed=SL.clone().addScaledVector(down,l*(.86-.38*run)).addScaledVector(forward,l*(.10+.34*run+swing*.11)).addScaledVector(left,l*.035);
    const anchor=socket?pos(socket):pos(bones.RightHand).addScaledVector(forward,l*.17);
    const support=anchor.addScaledVector(forward,-l*.09).addScaledVector(down,l*.12).addScaledVector(left,l*.025);
    const targetL=relaxed.lerp(support,aim);
    if(reloading){
      const belt=hip.clone().addScaledVector(left,l*.26).addScaledVector(forward,l*.12).addScaledVector(down,l*.035);
      const reloadL=support.clone().addScaledVector(down,l*key.under).lerp(belt,key.belt);
      targetL.lerp(reloadL,key.blend);
    }
    solve('Left',targetL,down.clone().addScaledVector(left,.40).addScaledVector(forward,-.10));
    const fingerDir=down.clone().lerp(forward,Math.max(aim,key.blend*(1-(key.belt||0))));
    orient(bones.LeftHand,fingerDir,-.10-(key.tilt||0)*.30);
    for(const [b,r] of fingers)b.quaternion.copy(r).multiply(q().setFromAxisAngle(v().set(0,0,1),reloading && key.magazine ? .38 : .12));
    magazine.visible=!!(reloading&&key.magazine);
    // Pente vertical acompanha a inclinação da arma, não o eixo dos dedos.
    if(magazine.visible){
      const world=q().setFromUnitVectors(v().set(0,1,0),up);
      world.premultiply(q().setFromAxisAngle(aimDir,key.tilt));
      magazine.quaternion.copy(bones.LeftHand.getWorldQuaternion(q()).invert().multiply(world));
    }
    model.updateWorldMatrix(true,true);
    return {left:pos(bones.LeftHand).toArray(),right:pos(bones.RightHand).toArray(),belt:hip.clone().addScaledVector(left,l*.26).toArray(),tilt:key.tilt||0,magazine:magazine.visible};
  }
  return {apply,bones,lengths,magazine,dispose(){magazine.removeFromParent();magazine.geometry.dispose();magazine.material.dispose();}};
}
