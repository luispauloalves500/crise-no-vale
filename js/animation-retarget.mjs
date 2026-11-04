// Converte rotações locais entre poses de repouso; não altera translações nem pesos do rig.
function mul(a,b) {
  const [x,y,z,w]=a,[X,Y,Z,W]=b;
  return [w*X+x*W+y*Z-z*Y,w*Y-x*Z+y*W+z*X,w*Z+x*Y-y*X+z*W,w*W-x*X-y*Y-z*Z];
}
function normalized(q) {
  const n=Math.hypot(...q); return n>1e-8 ? q.map(v=>v/n) : [0,0,0,1];
}
export function retargetQuaternion(sourceRest,targetRest,sample) {
  const s=normalized(sourceRest), t=normalized(targetRest), a=normalized(sample);
  return normalized(mul(mul(t,[-s[0],-s[1],-s[2],s[3]]),a));
}
export function retargetValues(values, sourceRest, targetRest) {
  if(values.length%4!==0) throw new Error('Canal de rotação inválido');
  const out=new Float32Array(values.length);
  for(let i=0;i<values.length;i+=4) out.set(retargetQuaternion(sourceRest,targetRest,Array.from(values.slice(i,i+4))),i);
  return out;
}
/** Substitui apenas rotações compartilhadas; mantém translação/escala e duração coerentes. */
export function adaptWalkClip(base, source, sourcePose, targetPose) {
  if (!base || !source || !(source.duration > 0)) return null;
  const targetNames = new Set(base.tracks.map(t => t.name)), replacements = new Map();
  for (const track of source.tracks) {
    if (!track.name.endsWith('.quaternion') || !targetNames.has(track.name)) continue;
    const name = track.name.slice(0, -'.quaternion'.length), from = sourcePose.get(name), to = targetPose.get(name);
    if (!from || !to || !track.times.length || track.values.length !== track.times.length * 4) continue;
    const copy = track.clone(); copy.values = retargetValues(copy.values, from, to); replacements.set(track.name, copy);
  }
  if (!['Hips','LeftUpLeg','RightUpLeg'].every(bone => [...replacements.keys()].some(n => n.endsWith(bone+'.quaternion')))) return null;
  const walk = base.clone(); walk.name = 'Walking_Woman_JillAdaptada';
  walk.tracks = walk.tracks.map(track => {
    if (replacements.has(track.name)) return replacements.get(track.name);
    const copy = track.clone();
    if (base.duration > 0) for (let i=0; i<copy.times.length; i++) copy.times[i] *= source.duration / base.duration;
    return copy;
  });
  walk.duration = source.duration;
  return walk;
}
