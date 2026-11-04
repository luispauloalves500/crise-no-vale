// Utilitários puros para validar ligações e localizar uma chegada livre.
export function validateDoorGraph(areas) {
  const byId = new Map(areas.map(a => [a.id, a]));
  const errors = [];
  if (byId.size !== areas.length) errors.push('IDs de área duplicados');
  for (const area of areas) {
    const ids = new Set();
    for (const door of area.doors) {
      if (ids.has(door.id)) errors.push(`${area.id}: porta duplicada ${door.id}`);
      ids.add(door.id);
      const target = byId.get(door.to);
      const back = target?.doors.find(d => d.id === door.toDoor);
      if (!back || back.to !== area.id || back.toDoor !== door.id) errors.push(`${area.id}:${door.id} sem retorno recíproco`);
      if (!['N', 'S', 'E', 'W'].includes(door.side)) errors.push(`${area.id}:${door.id} lado inválido`);
    }
  }
  return errors;
}
export function safeDoorArrival(area, doorId, radius, depth) {
  const d = area.doors.find(d => d.id === doorId);
  if (!d || !area.ctx || !['N', 'S', 'E', 'W'].includes(d.side)) return null;
  const b = area.bounds, boxes = area.ctx.boxes, circles = area.ctx.circles;
  const yaw = { N: 0, S: Math.PI, W: Math.PI / 2, E: -Math.PI / 2 }[d.side];
  for (const inset of [depth + 2.2, depth + 3.2, depth + 4.2, depth + 5.2]) {
    for (const offset of [0, -0.7, 0.7, -1.4, 1.4]) {
      const along = d.at + offset;
      const x = d.side === 'W' ? b.minX + inset : d.side === 'E' ? b.maxX - inset : along;
      const z = d.side === 'N' ? b.minZ + inset : d.side === 'S' ? b.maxZ - inset : along;
      if (x <= b.minX + radius || x >= b.maxX - radius || z <= b.minZ + radius || z >= b.maxZ - radius) continue;
      const blockedBox = boxes.some(q => { const dx = x - Math.max(q.minX, Math.min(x, q.maxX)), dz = z - Math.max(q.minZ, Math.min(z, q.maxZ)); return dx * dx + dz * dz < radius * radius; });
      const blockedCircle = circles.some(q => Math.hypot(x - q.x, z - q.z) < radius + q.r);
      if (!blockedBox && !blockedCircle) return { x, z, yaw };
    }
  }
  return null;
}
