import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {ENEMY_TYPES} from '../js/config.js';
import {dinoDimensions,dinoBarY,dinoImpactY,rayDinoHit} from '../js/dino-dimensions.mjs';
const reference=JSON.parse(readFileSync(new URL('./dino-procedural-reference.json',import.meta.url)));
for(const [type,cfg]of Object.entries(ENEMY_TYPES))test(type+': dimensões e raio iguais ao procedural de referência',()=>{
 const d=dinoDimensions(cfg),old=reference.types[type];for(const k of ['width','height','length','minZ','maxZ'])assert.ok(Math.abs(d[k]-old[k])<1e-10,k);
 assert.equal(cfg.r,old.radius,'não mudar raio de navegação nem bloquear rotas antigas');assert.ok(dinoBarY(cfg)>d.height);assert.ok(dinoImpactY(cfg)>0&&dinoImpactY(cfg)<d.height);
});
test('Tirano Matriz usa mesma fórmula do bruto antigo, pois não existia em 24d7e1e',()=>assert.equal(reference.types.origin.derived,true));
test('projétil alcança cabeça e cauda, não só o antigo círculo no tronco',()=>{
 const cfg=ENEMY_TYPES.raptor,e={cfg,pos:{x:0,z:0},yaw:0},d=dinoDimensions(cfg);
 assert.ok(Math.abs(rayDinoHit(0,10,0,-1,e)-(10-d.maxZ))<1e-8);assert.ok(Math.abs(rayDinoHit(0,-10,0,1,e)-(10+d.minZ))<1e-8);
 assert.equal(rayDinoHit(10,0,1,0,e),Infinity);assert.equal(rayDinoHit(0,0,1,0,e),0);
});
test('hitbox de projétil gira/translada junto da instância',()=>{
 const cfg=ENEMY_TYPES.brute,d=dinoDimensions(cfg),e={cfg,pos:{x:12,z:7},yaw:Math.PI/2};
 assert.ok(Math.abs(rayDinoHit(32,7,-1,0,e)-(20-d.maxZ))<1e-7);assert.equal(rayDinoHit(12,25,1,0,e),Infinity);
});
test('HUD, impactos e cutscene consultam as mesmas dimensões',()=>{
 const read=p=>readFileSync(new URL('../js/'+p,import.meta.url),'utf8');
 assert.match(read('enemies.js'),/dinoBarY\(T\)/);assert.match(read('enemies.js'),/contactShadow.position.y=DINO_FLOOR_CLEARANCE\*\.5\/T.scale/);assert.match(read('aiming.js'),/dinoDimensions\(enemy.cfg\)/);assert.match(read('aiming.js'),/rayEllipse3D/);assert.match(read('combat.js'),/v2.copy\(h.point\)/);
 assert.match(read('cutscene-timeline.mjs'),/dinoDimensions\(ENEMY_TYPES.origin\)/);assert.doesNotMatch(read('dino-models.js'),/o\.skeleton\.pose\(/);
 assert.match(read('dino-grounding.js'),/root.updateMatrixWorld\(true\)/,'atualizar bindMatrixInverse do SkinnedMesh após reparent/escala');
});
