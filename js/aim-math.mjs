// Matemática pura compartilhada por retícula, balística e testes (sem DOM/WebGL).
const EPS=1e-9;
export function reticleToNDC(rect,viewport) {
  if(!rect||!viewport||viewport.width<=0||viewport.height<=0)return {x:0,y:0};
  const x=rect.left+(rect.width||0)/2,y=rect.top+(rect.height||0)/2;
  return Number.isFinite(x+y)?{x:2*(x-viewport.left)/viewport.width-1,y:1-2*(y-viewport.top)/viewport.height}:{x:0,y:0};
}
export function directionTo(origin,target,fallback={x:0,y:0,z:1}) {
  const x=target.x-origin.x,y=target.y-origin.y,z=target.z-origin.z,l=Math.hypot(x,y,z);
  return l>EPS?{x:x/l,y:y/l,z:z/l}:{...fallback};
}
export function rayAABB3D(o,d,b,max=Infinity) {
  let lo=0,hi=max;
  for(const axis of ['x','y','z']){const min=b['min'+axis.toUpperCase()],max=b['max'+axis.toUpperCase()];
    if(Math.abs(d[axis])<EPS){if(o[axis]<min||o[axis]>max)return Infinity;continue;}
    let a=(min-o[axis])/d[axis],c=(max-o[axis])/d[axis];if(a>c)[a,c]=[c,a];lo=Math.max(lo,a);hi=Math.min(hi,c);if(hi<lo)return Infinity;
  }return lo<=max?lo:Infinity;
}
// Cilindro elíptico finito: dx/dz NÃO são normalizados separadamente (distância é 3D).
export function rayEllipse3D(o,d,{x,z,rx,rz,minY,maxY,yaw=0},max=Infinity) {
  const c=Math.cos(yaw),s=Math.sin(yaw),px=c*(o.x-x)-s*(o.z-z),pz=s*(o.x-x)+c*(o.z-z),vx=c*d.x-s*d.z,vz=s*d.x+c*d.z;
  const A=vx*vx/(rx*rx)+vz*vz/(rz*rz),B=px*vx/(rx*rx)+pz*vz/(rz*rz),C=px*px/(rx*rx)+pz*pz/(rz*rz)-1;
  let lo=0,hi=max;
  if(A<EPS){if(C>0)return Infinity;}else{const disc=B*B-A*C;if(disc<0)return Infinity;const q=Math.sqrt(disc);lo=Math.max(lo,(-B-q)/A);hi=Math.min(hi,(-B+q)/A);}
  if(Math.abs(d.y)<EPS){if(o.y<minY||o.y>maxY)return Infinity;}else{let a=(minY-o.y)/d.y,b=(maxY-o.y)/d.y;if(a>b)[a,b]=[b,a];lo=Math.max(lo,a);hi=Math.min(hi,b);}
  return hi>=lo&&hi>=0&&lo<=max?lo:Infinity;
}
export function coneDirection(base,horizontal,vertical) {
  let rx=-base.z,rz=base.x,l=Math.hypot(rx,rz);if(l<EPS){rx=1;rz=0;l=1;}rx/=l;rz/=l;
  const up={x:-rz*base.y,y:rz*base.x-rx*base.z,z:rx*base.y};
  const h=Math.tan(horizontal),v=Math.tan(vertical),x=base.x+rx*h+up.x*v,y=base.y+up.y*v,z=base.z+rz*h+up.z*v;
  const size=Math.hypot(x,y,z);return {x:x/size,y:y/size,z:z/size};
}
export function pelletOffsets(count,spread,random=Math.random) {
  if(count<=1){let x=random()+random()-1,y=random()+random()-1,l=Math.hypot(x,y);if(l>1){x/=l;y/=l;}return [{x:x*spread,y:y*spread}];}
  const points=new Array(count),pairs=Math.floor(count/2),rotation=random()*Math.PI*2;
  for(let i=0;i<pairs;i++){const r=Math.sqrt((i+.5)/pairs)*spread,a=rotation+i*2.399963229728653,point={x:Math.cos(a)*r,y:Math.sin(a)*r};points[i]=point;points[i+pairs]={x:-point.x,y:-point.y};}
  if(count%2)points[count-1]={x:0,y:0};return points;
}
// Arco para o ponto mirado. Mantém a velocidade horizontal e atinge o alvo antes do pavio.
// Alvos além do alcance são limitados NA MESMA direção; não se soma velocidade lateral do jogador.
export function grenadeArc(origin,target,{speed=13,gravity=18,fuse=1.4,clearance=.1}={}) {
  const dx=target.x-origin.x,dz=target.z-origin.z,d=Math.hypot(dx,dz),maxTime=Math.max(.1,fuse-clearance),distance=Math.min(d,speed*maxTime);
  const time=Math.max(.12,Math.min(maxTime,distance/speed)),k=d>EPS?distance/d:0,end={x:origin.x+dx*k,y:target.y,z:origin.z+dz*k};
  // Um alvo alto demais para um arco curto é limitado verticalmente, não explode fora da tela.
  const upLimit=13,endY=Math.min(end.y,origin.y+upLimit*time-.5*gravity*time*time);end.y=endY;
  return {vx:(end.x-origin.x)/time,vy:(end.y-origin.y+.5*gravity*time*time)/time,vz:(end.z-origin.z)/time,time,target:end,clamped:distance<d-EPS||endY<target.y-EPS};
}
export function advanceBallistic(p,v,dt,gravity) {p.x+=v.vx*dt;p.z+=v.vz*dt;p.y+=v.vy*dt-.5*gravity*dt*dt;v.vy-=gravity*dt;}
