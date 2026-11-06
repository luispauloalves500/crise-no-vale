// Dimensões físicas medidas no buildDino de 24d7e1e, sem sprites, barras ou sombras.
export const PROCEDURAL_DINO_BASE = Object.freeze({
  "raptor": {
    "width": 0.76,
    "height": 2.1256423228215393,
    "length": 4.730000000372529,
    "minZ": -3.0549999999999997,
    "maxZ": 1.6750000003725292
  },
  "spitter": {
    "width": 0.84,
    "height": 2.4215290027811576,
    "length": 4.185000000372529,
    "minZ": -2.56,
    "maxZ": 1.6250000003725291
  },
  "brute": {
    "width": 1.16,
    "height": 2.4962121988005777,
    "length": 4.653328030999201,
    "minZ": -2.66,
    "maxZ": 1.9933280309992008
  }
});
export const DINO_FLOOR_CLEARANCE=.012;
export function dinoDimensions(cfg) {
  const b=PROCEDURAL_DINO_BASE[cfg.shape]||PROCEDURAL_DINO_BASE.raptor,s=cfg.scale||1;
  return {width:b.width*s,height:b.height*s,length:b.length*s,minZ:b.minZ*s,maxZ:b.maxZ*s,centerZ:(b.minZ+b.maxZ)*s/2,radius:cfg.r,scale:s};
}
export const dinoBarY=cfg=>dinoDimensions(cfg).height+DINO_FLOOR_CLEARANCE+.35;
export const dinoImpactY=cfg=>dinoDimensions(cfg).height*.55+DINO_FLOOR_CLEARANCE;
// Projétil 2D: elipse orientada cobre cabeça/cauda. Raio de navegação continua o histórico cfg.r.
export function rayDinoHit(ox,oz,dx,dz,e) {
  const d=dinoDimensions(e.cfg),yaw=e.yaw||0,c=Math.cos(yaw),s=Math.sin(yaw);
  const x=ox-e.pos.x-s*d.centerZ,z=oz-e.pos.z-c*d.centerZ;
  const lx=c*x-s*z,lz=s*x+c*z,vx=c*dx-s*dz,vz=s*dx+c*dz;
  const rx=Math.max(d.radius,d.width/2),rz=d.length/2;
  const A=vx*vx/(rx*rx)+vz*vz/(rz*rz),B=lx*vx/(rx*rx)+lz*vz/(rz*rz),C=lx*lx/(rx*rx)+lz*lz/(rz*rz)-1;
  if(C<=0)return 0;const disc=B*B-A*C;if(A<=0||disc<0)return Infinity;
  const t=(-B-Math.sqrt(disc))/A;return t>=0?t:Infinity;
}
