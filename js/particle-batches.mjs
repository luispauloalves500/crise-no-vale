// Um lote por material, com partículas fora da câmera descartadas antes do envio à GPU.
export function createParticleBatches(THREE, scene, geometry, materials, capacity) {
  const batches = {};
  for (const [kind, material] of Object.entries(materials)) {
    const mesh = new THREE.InstancedMesh(geometry, material, capacity);
    mesh.count = 0; mesh.frustumCulled = false;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); scene.add(mesh); batches[kind] = mesh;
  }
  const frustum = new THREE.Frustum(), matrix = new THREE.Matrix4(), sphere = new THREE.Sphere();
  const counts = Object.fromEntries(Object.keys(batches).map(kind => [kind, 0]));
  function flush(particles, camera) {
    for (const kind in counts) counts[kind] = 0;
    matrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    frustum.setFromProjectionMatrix(matrix);
    for (const p of particles) {
      const m=p.m, batch=batches[p.kind];
      if (!m.visible || !batch) continue;
      sphere.center.copy(m.position);
      sphere.radius = 0.35 * Math.max(1, Math.abs(m.scale.x), Math.abs(m.scale.y), Math.abs(m.scale.z));
      if (!frustum.intersectsSphere(sphere)) continue;
      m.updateMatrix(); batch.setMatrixAt(counts[p.kind]++, m.matrix);
    }
    for (const kind in batches) {
      const mesh=batches[kind], n=counts[kind];
      mesh.count=n; if (n) mesh.instanceMatrix.needsUpdate = true;
    }
  }
  function clear() { for (const kind in batches) batches[kind].count=0; }
  return { batches, flush, clear };
}
