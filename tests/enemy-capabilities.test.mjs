import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync} from 'node:fs';
import {canSpit,enemyConfig,abilityOverrides} from '../js/enemy-capabilities.mjs';import {dinoKind,dinoMotion} from '../js/dino-animation.mjs';import {ENEMY_TYPES} from '../js/config.js';import {captureEncounterMemory,restoreEncounterMemory} from '../js/encounter-memory.mjs';import {cageReleaseWave} from '../js/campaign-rules.mjs';
const variants=[{spit:true},{acid:true},{acid:{cd:3,n:3}},{ranged:true},{variant:'raptor-acid'},{attackMode:'spit'},{abilities:['spit']},{abilities:{acid:true}},{attacks:[{type:'ranged'}]}];
for(const variant of variants)test('nenhum cuspidor pode renderizar raptor: '+JSON.stringify(variant),()=>{
 for(const type of Object.keys(ENEMY_TYPES)){const cfg=enemyConfig(ENEMY_TYPES[type],variant);assert.equal(canSpit(cfg),true);assert.equal(dinoKind(cfg),'cuspidor');assert.equal(dinoMotion({cfg,spitT:.5,spitAction:{time:.45}}).clip,'spit');}
});
test('raptor corpo a corpo continua raptor; todos os cuspidores reais incluem Primórdio',()=>{
 assert.equal(dinoKind(ENEMY_TYPES.raptor),'raptor');assert.equal(canSpit(ENEMY_TYPES.raptor),false);assert.deepEqual(Object.entries(ENEMY_TYPES).filter(([,c])=>canSpit(c)).map(([t])=>t),['spitter','primordio']);for(const c of [ENEMY_TYPES.spitter,ENEMY_TYPES.primordio])assert.equal(dinoKind(c),'cuspidor');assert.equal(dinoKind(ENEMY_TYPES.origin),'trex');
});
test('flags de variante sobrevivem a memória, saves, restauração de patrulhas e fila',()=>{
 const enemy={type:'raptor',cfg:enemyConfig(ENEMY_TYPES.raptor,{ranged:true}),abilityOverrides:{ranged:true,variant:'acid'},pos:{x:1,z:2},hp:12};
 const saved=JSON.parse(JSON.stringify(captureEncounterMemory([enemy],[{type:'raptor',spit:true,t:1}]))),restored=restoreEncounterMemory(saved);assert.equal(dinoKind(enemyConfig(ENEMY_TYPES.raptor,restored.living[0])),'cuspidor');assert.equal(restored.pending[0].spit,true);
 const patrol=restoreEncounterMemory({},[{type:'raptor',x:1,z:2,spit:true}]).living[0];assert.equal(patrol.spit,true);assert.equal(canSpit(enemyConfig(ENEMY_TYPES.raptor,patrol)),true);
 // Executa o construtor REAL da fila de encontros (antes ele descartava flags de s).
 const source=readFileSync(new URL('../js/director.js',import.meta.url),'utf8'),fragment=source.slice(source.indexOf('function fireEncounter(e)'),source.indexOf('// ---------- v5: momentos roteirizados'));
 const c={D:{enc:new Set(),queue:[],area:{id:'porto',cages:[]}},F:{},G:{difficulty:'normal'},cageReleaseWave};vm.createContext(c);vm.runInContext(fragment,c);
 for(const variant of variants){c.D.queue.length=0;c.fireEncounter({id:'variant',spawn:[{type:'raptor',...variant}]});assert.equal(dinoKind(enemyConfig(ENEMY_TYPES.raptor,c.D.queue[0])),'cuspidor');
  c.D.queue.length=0;c.F.cagesReleased=false;c.D.area.cages=[{x:0,z:0,face:1,...variant}];c.fireEncounter({id:'cage',cages:true});assert.equal(dinoKind(enemyConfig(ENEMY_TYPES.raptor,c.D.queue[0])),'cuspidor');}
 const cage=cageReleaseWave([{type:'spitter',x:0,z:0,face:1}],'normal')[0];assert.equal(cage.type,'spitter');

});
test('configuração da variante não altera o raptor global nem compartilha a flag de ácido',()=>{
 const a=enemyConfig(ENEMY_TYPES.raptor,{acid:{n:3}}),b=enemyConfig(ENEMY_TYPES.raptor);a.acid.n=8;assert.equal(b.acid,undefined);assert.equal(ENEMY_TYPES.raptor.acid,undefined);
});
test('auditoria de todas as patrulhas/emboscadas/jaulas declaradas e filas roteirizadas',()=>{
 const read=f=>readFileSync(new URL('../js/'+f,import.meta.url),'utf8'),s=read('areas.js'),areas=vm.runInNewContext(s.slice(s.indexOf('export const AREAS = [')+'export const AREAS = '.length,s.indexOf('\nexport const AREA =')),{Math});let total=0,spitters=0;
 function audit(obj){if(!obj||typeof obj!=='object')return;if(obj.type&&ENEMY_TYPES[obj.type]){total++;const cfg=enemyConfig(ENEMY_TYPES[obj.type],obj);if(canSpit(cfg)){spitters++;assert.equal(dinoKind(cfg),'cuspidor');}else if(obj.type==='raptor')assert.equal(dinoKind(cfg),'raptor');}for(const value of Object.values(obj))if(value&&typeof value==='object')if(Array.isArray(value))value.forEach(audit);else audit(value);}
 for(const a of areas){audit(a.ambient);audit(a.encounters);if(a.cages)for(const d of ['easy','normal','hard'])audit(cageReleaseWave(a.cages,d));}
 const types=[...read('director.js').matchAll(/type:\s*['"]([a-z]+)['"]/g)].map(m=>m[1]).filter(t=>ENEMY_TYPES[t]);for(const type of types)audit({type});assert.ok(total>60&&spitters>15);assert.ok(!read('cutscenes.js').includes('assets/models/raptor'),'cutscene não deve carregar um modelo de raptor à parte');
});
