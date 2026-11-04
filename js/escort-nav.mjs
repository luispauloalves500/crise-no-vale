// Navegação 2D leve para a Dra. Lima. Colisores compartilhados com world.js.
export const ESCORT_RADIUS = 0.42, GRID_STEP = 1.25;
export function canStand(x,z,env,r=ESCORT_RADIUS) {
  if(!env?.bounds || !Number.isFinite(x) || !Number.isFinite(z)) return false;
  const b=env.bounds;
  if(x<=b.minX+r || x>=b.maxX-r || z<=b.minZ+r || z>=b.maxZ-r) return false;
  for(const o of env.boxes||[]) if(x>=o.minX-r && x<=o.maxX+r && z>=o.minZ-r && z<=o.maxZ+r) return false;
  for(const c of env.circles||[]) if((x-c.x)**2+(z-c.z)**2<=(c.r+r)**2) return false;
  return true;
}
export function segmentClear(a,b,env,r=ESCORT_RADIUS){
  const d=Math.hypot(b.x-a.x,b.z-a.z), n=Math.max(1,Math.ceil(d/0.36));
  for(let i=0;i<=n;i++){const f=i/n;if(!canStand(a.x+(b.x-a.x)*f,a.z+(b.z-a.z)*f,env,r))return false;}
  return true;
}
export function findEscortPath(from,to,env,r=ESCORT_RADIUS){
  if(!env?.bounds||!from||!to) return [];
  if(segmentClear(from,to,env,r))return [{x:to.x,z:to.z}];
  const b=env.bounds,nx=Math.ceil((b.maxX-b.minX)/GRID_STEP),nz=Math.ceil((b.maxZ-b.minZ)/GRID_STEP),size=nx*nz;
  if(size<1||size>3200)return [];
  const sx=(b.maxX-b.minX)/nx,sz=(b.maxZ-b.minZ)/nz;
  const at=i=>({x:b.minX+(i%nx+0.5)*sx,z:b.minZ+(Math.floor(i/nx)+0.5)*sz});
  const walk=new Uint8Array(size);
  for(let i=0;i<size;i++){const p=at(i);walk[i]=canStand(p.x,p.z,env,r)?1:0;}
  function nearest(p){
    const x=Math.max(0,Math.min(nx-1,Math.floor((p.x-b.minX)/sx)));
    const z=Math.max(0,Math.min(nz-1,Math.floor((p.z-b.minZ)/sz)));
    let best=-1,d2=Infinity;
    for(let dz=-4;dz<=4;dz++)for(let dx=-4;dx<=4;dx++){
      let xx=x+dx,zz=z+dz;
      if(xx<0||xx>=nx||zz<0||zz>=nz)continue;
      const id=zz*nx+xx;if(!walk[id])continue;
      const v=at(id),dist=(v.x-p.x)**2+(v.z-p.z)**2;
      if(dist<d2){d2=dist;best=id;}
    }
    return best;
  }
  const s=nearest(from),goal=nearest(to);
  if(s<0||goal<0)return [];
  const g=new Float64Array(size).fill(Infinity),f=new Float64Array(size).fill(Infinity),parent=new Int32Array(size).fill(-1);
  const closed=new Uint8Array(size),open=[s],end=at(goal);g[s]=0;f[s]=Math.hypot(at(s).x-end.x,at(s).z-end.z);
  const dirs=[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
  let done=false,steps=0;
  while(open.length&&steps++<size){
    let k=0;for(let i=1;i<open.length;i++)if(f[open[i]]<f[open[k]])k=i;
    const cur=open.splice(k,1)[0];if(closed[cur])continue;
    if(cur===goal){done=true;break;}closed[cur]=1;
    const x=cur%nx,z=Math.floor(cur/nx);
    for(const [dx,dz] of dirs){
      const xx=x+dx,zz=z+dz;if(xx<0||xx>=nx||zz<0||zz>=nz)continue;
      const id=zz*nx+xx;if(closed[id]||!walk[id])continue;
      if(dx&&dz&&(!walk[z*nx+xx]||!walk[zz*nx+x]))continue;
      const ng=g[cur]+Math.hypot(dx*sx,dz*sz);if(ng>=g[id])continue;
      g[id]=ng;parent[id]=cur;const p=at(id);f[id]=ng+Math.hypot(end.x-p.x,end.z-p.z);open.push(id);
    }
  }
  if(!done)return [];
  const cells=[];for(let id=goal;id>=0;id=parent[id])cells.push(at(id));cells.reverse();
  if(canStand(to.x,to.z,env,r))cells.push({x:to.x,z:to.z});
  const route=[];let prev={x:from.x,z:from.z},i=0;
  while(i<cells.length&&route.length<60){
    let far=-1;for(let j=cells.length-1;j>=i;j--)if(segmentClear(prev,cells[j],env,r)){far=j;break;}
    if(far<0)return [];
    const point=cells[far];route.push(point);prev=point;i=far+1;
  }
  return route;
}
