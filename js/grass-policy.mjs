// Política pura: footprint inteiro (+ vento), sem mudar a sequência RNG dos mapas antigos.
export const GRASS_RADIUS = .72;
export const GRASS_CHUNK = 10;
export const NATURAL_GRASS_AREAS = new Set(['porto','ruinas','pantano','margem','acampamento','ninho']);
export function grassCandidates(rng,b,n) {
  const points=[];
  for(let i=0;i<n;i++) {
    const x=b.minX-4+rng()*(b.maxX-b.minX+8),z=b.minZ-4+rng()*(b.maxZ-b.minZ+8);
    const rx=rng(),ry=rng(),rz=rng(),sx=rng(),sy=rng(),sz=rng(),shade=rng(); // exatamente 9 sorteios/tufo
    points.push({x,z,yaw:ry*6.283185,scale:.75+sx*.45,height:.8+sy*.4,shade:.8+shade*.3,rx,rz,sz});
  }
  return points;
}
const rect=(x,z,w,d)=>({minX:x-w/2,maxX:x+w/2,minZ:z-d/2,maxZ:z+d/2});
export function grassMasks(ctx,area) {
  const masks=[...(ctx.boxes||[]),...(ctx.water||[]),...(ctx.grassNoGo||[]),...(ctx.circles||[])];
  for(const p of [...(area.refs?.terminals||[]),...(area.logs||[]),...(area.pickups||[])]) masks.push({x:p.x,z:p.z,r:1.25});
  for(const d of area.doors||[]) {
    const b=area.bounds,ns=d.side==='N'||d.side==='S';
    masks.push(rect(ns?d.at:(d.side==='W'?b.minX:b.maxX),ns?(d.side==='N'?b.minZ:b.maxZ):d.at,ns?5:7,ns?7:5));
  }
  for(const p of [area.helipad,area.quayPad,area.extraction].filter(Boolean)) masks.push({x:p.x,z:p.z,r:p.r||5.8});
  if(area.id==='ruinas') masks.push(rect(0,0,4,65)); // caminho de pedra central, vegetação só nas bordas
  if(area.id==='acampamento') {
    masks.push(rect(0,-6,7,4.5),rect(0,1,4,42)); // interior da tenda e eixo de circulação
    for(const [x,z,r] of [[-14,-6,3.4],[-12,3,3],[14,-6,3.4],[15,4,3]]) masks.push({x,z,r});
    for(const c of area.cages||[]) masks.push(rect(c.x,c.z,c.big?5:3.6,c.big?5:3.6));
  }
  if(area.id==='ninho') masks.push({x:0,z:9,r:4.4},{x:-13,z:-9,r:5.8});
  return masks;
}
export function grassAllowed(p,b,masks,r=GRASS_RADIUS) {
  if(p.x-r<b.minX||p.x+r>b.maxX||p.z-r<b.minZ||p.z+r>b.maxZ) return false;
  return !masks.some(m=>Number.isFinite(m.minX)
    ? p.x+r>=m.minX&&p.x-r<=m.maxX&&p.z+r>=m.minZ&&p.z-r<=m.maxZ
    : Math.hypot(p.x-m.x,p.z-m.z)<=(m.r||0)+r);
}
export function grassChunks(points) {
  const chunks=new Map();
  for(const p of points) {
    const ix=Math.floor(p.x/GRASS_CHUNK),iz=Math.floor(p.z/GRASS_CHUNK),key=ix+':'+iz;
    if(!chunks.has(key)) chunks.set(key,{key,x:(ix+.5)*GRASS_CHUNK,z:(iz+.5)*GRASS_CHUNK,points:[]});
    chunks.get(key).points.push(p);
  }
  return [...chunks.values()];
}
export function grassBudget(preset={},difficulty='normal',density=1,areaId='') {
  const id=preset.id||'medio',p=id==='baixo'?[8,40,6,16]:id==='alto'?[32,128,12,32]:[20,80,9,24];
  const factor=Math.max(0,Math.min(1,Number.isFinite(density)?density:1))*(preset.grass??1)*(difficulty==='easy'?.65:1);
  return {density:factor,near:Math.floor((areaId==='porto'?Math.min(p[0],16):p[0])*factor),far:Math.floor((areaId==='porto'?Math.min(p[1],80):p[1])*factor),nearDistance:p[2],cutoff:p[3]};
}
// Um LOD por chunk, limites GLOBAIS por mapa (não por chunk) e sem tufo duplicado.
export function planGrass(chunks,camera,budget) {
  let near=budget.near,far=budget.far;
  return chunks.map(c=>({chunk:c,distance:Math.hypot(camera.x-c.x,camera.z-c.z)})).sort((a,b)=>a.distance-b.distance).map(o=>{
    const c=o.chunk,n=Math.floor(c.points.length*budget.density);
    if(o.distance>budget.cutoff||!n) return {...o,lod:'hidden',count:0};
    const detailed=o.distance<=budget.nearDistance&&near>0,lod=detailed?'near':'far',count=Math.min(n,detailed?near:far);
    if(detailed) near-=count;else far-=count;
    return {...o,lod:count?lod:'hidden',count};
  });
}
