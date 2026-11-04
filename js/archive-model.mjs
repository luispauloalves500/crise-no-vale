// Os IDs e a ordem dos documentos são os mesmos usados pelo save e pelos finais.
export function discoveredRecords(ids, records, found) {
  return ids.filter(id => found.has(id) && records[id]).map(id => ({id, title:records[id].title, who:records[id].who, area:records[id].area}));
}
export function canAccessRecord(id, flags, lockdown) {
  return id !== 'log5' || (!!flags.power && !lockdown);
}
export function canSeeRecord(from, target, cast) {
  const dx=target.x-from.x, dz=target.z-from.z, d=Math.hypot(dx,dz);
  if (d < 0.001) return true;
  // A margem tolera o colisor do próprio suporte, sem permitir atravessar paredes próximas.
  return cast(from.x,from.z,dx/d,dz/d,d,1.0) >= Math.max(0,d-0.5);
}
