// Carregamento sob demanda e limite de textura para modelos GLB locais.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
const cache = new Map();
export function loadModel(url, partCount = 0) {
  if (!cache.has(url)) {
    const loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder);
    const promise = partCount ? (async () => {
      const buffers = await Promise.all(Array.from({length:partCount}, async (_, i) => {
        const response = await fetch(url + '.part' + String(i).padStart(2, '0'));
        if (!response.ok) throw new Error('Falha ao carregar parte do modelo: ' + response.status);
        return new Uint8Array(await response.arrayBuffer());
      }));
      const all = new Uint8Array(buffers.reduce((n, b) => n + b.length, 0));
      let offset = 0; for (const b of buffers) { all.set(b, offset); offset += b.length; }
      return new Promise((resolve, reject) => loader.parse(all.buffer, '', resolve, reject));
    })() : new Promise((resolve, reject) => loader.load(url, resolve, undefined, reject));
    cache.set(url, promise); promise.catch(() => cache.delete(url));
  }
  return cache.get(url);
}
export function limitTextures(root, maxSize = 1024) {
  const seen = new Set();
  root.traverse(o => {
    for (const material of (Array.isArray(o.material) ? o.material : [o.material])) {
      if (!material) continue;
      for (const value of Object.values(material)) {
        if (!value?.isTexture || seen.has(value)) continue;
        seen.add(value);
        const img = value.image, w = img?.width, h = img?.height;
        if (!w || !h || Math.max(w,h) <= maxSize) continue;
        try {
          const scale = maxSize / Math.max(w,h), canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round(w*scale)); canvas.height = Math.max(1, Math.round(h*scale));
          const ctx = canvas.getContext('2d'); if (!ctx) continue;
          ctx.drawImage(img,0,0,canvas.width,canvas.height); value.image = canvas; value.needsUpdate = true;
        } catch (err) { console.warn('Textura mantida no tamanho original:', err); }
      }
    }
  });
}
export function fitWeapon(model, length, rotationY = -Math.PI / 2) {
  model.updateMatrixWorld(true);
  const b = new THREE.Box3().setFromObject(model), size = b.getSize(new THREE.Vector3());
  if (!Number.isFinite(size.x) || size.x <= 0) throw new Error('Arma sem dimensões válidas');
  // Os três modelos enviados usam eixo X para o comprimento.
  const holder = new THREE.Group(), center = b.getCenter(new THREE.Vector3());
  model.position.sub(center); holder.add(model); holder.rotation.y = rotationY;
  holder.scale.setScalar(length / size.x); return holder;
}
