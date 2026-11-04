// Sombras de contato: uma imagem compartilhada e um lote por área estática.
// São aproximações no chão, não projetam silhuetas em paredes.
import * as THREE from 'three';

const canvas = document.createElement('canvas');
canvas.width = canvas.height = 64;
const ctx = canvas.getContext('2d');
const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
gradient.addColorStop(0, 'rgba(255,255,255,1)');
gradient.addColorStop(1, 'rgba(255,255,255,0)');
ctx.fillStyle = gradient; ctx.fillRect(0, 0, 64, 64);
const fallback = new THREE.CanvasTexture(canvas);
const material = new THREE.MeshBasicMaterial({ map: fallback, color: 0x030604, transparent: true, opacity: 0.43, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 });
new THREE.TextureLoader().load(new URL('../assets/efeitos/sombra-contato.webp', import.meta.url).href, texture => {
  material.map = texture; material.needsUpdate = true; fallback.dispose();
});
const geometry = new THREE.PlaneGeometry(1, 1);
export const contactShadowResources = [geometry, material, fallback];
geometry.rotateX(-Math.PI / 2);

/** Sombra individual acompanha a raiz do personagem e sua visibilidade. */
export function actorShadow(parent, width = 1.2, length = 1.2) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.y = 0.045; mesh.scale.set(width, 1, length);
  mesh.renderOrder = 1; parent.add(mesh); return mesh;
}

/** Acumula apenas objetos apoiados no chão. Não insere um draw call por objeto. */
export function queueShadow(ctx, x, z, width, length) {
  if (![x, z, width, length].every(Number.isFinite) || width <= 0 || length <= 0) return;
  (ctx.contactShadows ||= []).push({ x, z, width: Math.min(8, Math.max(0.5, width)), length: Math.min(8, Math.max(0.5, length)) });
}
export function buildContactShadows(ctx) {
  const entries = ctx.contactShadows || [];
  if (!entries.length) return null;
  const mesh = new THREE.InstancedMesh(geometry, material, entries.length);
  const dummy = new THREE.Object3D();
  entries.forEach((s, i) => {
    dummy.position.set(s.x, 0.04, s.z); dummy.scale.set(s.width, 1, s.length);
    dummy.updateMatrix(); mesh.setMatrixAt(i, dummy.matrix);
  });
  mesh.instanceMatrix.needsUpdate = true; mesh.computeBoundingSphere();
  mesh.renderOrder = 1; ctx.group.add(mesh); ctx.contactShadows = [];
  return mesh;
}
