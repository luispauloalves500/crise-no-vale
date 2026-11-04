// Reúne somente árvores decorativas estáticas por geometria e setor.
// Árvores sólidas e grupos animados permanecem individuais.
export function batchBackgroundTrees(THREE, root, cellSize = 24) {
  const groups = new Map();
  for (const tree of root.children) {
    if (!tree.isMesh || !tree.userData.backgroundTree || !tree.geometry || !tree.material) continue;
    let variants = groups.get(tree.geometry);
    if (!variants) groups.set(tree.geometry, variants = new Map());
    const cx = Math.floor(tree.position.x / cellSize), cz = Math.floor(tree.position.z / cellSize);
    const key = `${tree.material.uuid}:${cx}:${cz}`;
    let group = variants.get(key);
    if (!group) variants.set(key, group = { trees: [], x: (cx + 0.5) * cellSize, z: (cz + 0.5) * cellSize });
    group.trees.push(tree);
  }
  let sourceCount = 0, batchCount = 0;
  for (const variants of groups.values()) for (const group of variants.values()) {
    if (group.trees.length < 2) continue;
    const first = group.trees[0];
    const mesh = new THREE.InstancedMesh(first.geometry, first.material, group.trees.length);
    mesh.position.set(group.x, 0, group.z); mesh.userData.lod = 'big'; mesh.userData.shTier = 'far';
    mesh.name = 'arvores-decorativas';
    group.trees.forEach((tree, i) => {
      tree.updateMatrix(); const matrix = tree.matrix.clone();
      matrix.elements[12] -= group.x; matrix.elements[14] -= group.z;
      mesh.setMatrixAt(i, matrix);
    });
    mesh.instanceMatrix.needsUpdate = true; mesh.computeBoundingSphere();
    root.remove(...group.trees); root.add(mesh);
    sourceCount += group.trees.length; batchCount++;
  }
  return { sourceCount, batchCount };
}
