// Três lâminas triangulares por tufo: sem texturas ou transparência.
export function makeGrassBlades() {
  const positions=[], colors=[];
  for (let i=0;i<3;i++) {
    const a=i*Math.PI/3, c=Math.cos(a), s=Math.sin(a), width=0.13, lean=0.045*(i-1);
    positions.push(-c*width,0,-s*width,c*width,0,s*width,lean,0.57+0.055*(i%2),0.055);
    colors.push(0.56,0.65,0.49, 0.62,0.69,0.52, 1,1,0.86);
  }
  return {positions:new Float32Array(positions),colors:new Float32Array(colors),triangles:3};
}
export function grassCount(max, density) { return Math.max(0, Math.min(max, Math.round(max*density))); }
