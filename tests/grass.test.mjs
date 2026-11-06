import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {grassCandidates,grassMasks,grassAllowed,grassChunks,grassBudget,planGrass,NATURAL_GRASS_AREAS,GRASS_RADIUS} from '../js/grass-policy.mjs';
const b={minX:-20,maxX:20,minZ:-20,maxZ:20};
const preset=id=>({id,grass:id==='alto'?1:id==='medio'?.8:.55});
test('grama consome os mesmos 9 sorteios por tufo, inclusive nos mapas pavimentados',()=>{
 let calls=0;const a=grassCandidates(()=>{calls++;return .5},b,12);assert.equal(calls,108);assert.equal(a.length,12);
 assert.deepEqual(a,grassCandidates(()=>.5,b,12));
});
test('footprint inteiro fica dentro do chão, não somente a origem',()=>{
 assert.ok(grassAllowed({x:0,z:0},b,[]));assert.equal(grassAllowed({x:19.5,z:0},b,[]),false);
});
for(const [name,mask] of [['piso',{minX:0,maxX:4,minZ:0,maxZ:4}],['água',{minX:0,maxX:4,minZ:0,maxZ:4}],['interior',{minX:0,maxX:4,minZ:0,maxZ:4}],['rocha',{x:0,z:0,r:2}]]) test('footprint e vento respeitam '+name,()=>{
 assert.equal(grassAllowed({x:-.5,z:0},b,[mask]),false);assert.equal(grassAllowed({x:-4,z:0},b,[mask]),true);
});
test('só os seis mapas naturais recebem campo; laboratório, pátio e novos atos ficam sem grama',()=>{
 assert.equal(NATURAL_GRASS_AREAS.size,6);for(const a of ['lab','patio','heliponto','portoanil','captacao','sede','setorzero','raiz'])assert.equal(NATURAL_GRASS_AREAS.has(a),false);
});
test('tendas, jaulas e corredores são excluídos mesmo quando não têm collider de piso',()=>{
 const area={id:'acampamento',bounds:b,cages:[{x:8,z:9,big:true}],doors:[]};const masks=grassMasks({},area);
 for(const p of [{x:0,z:-6},{x:0,z:12},{x:-14,z:-6},{x:8,z:9}])assert.equal(grassAllowed(p,b,masks),false);
});
test('heliponto, ninho, portas e terminais ficam desobstruídos',()=>{
 const area={id:'ninho',bounds:b,doors:[{side:'N',at:0}],refs:{terminals:[{x:10,z:0}]}};const masks=grassMasks({},area);
 for(const p of [{x:0,z:9},{x:-13,z:-9},{x:0,z:-18},{x:10,z:0}])assert.equal(grassAllowed(p,b,masks),false);
});
test('grade usa chunks estáveis, inclusive coordenadas negativas',()=>{
 const p=[{x:-1,z:-1},{x:-2,z:-3},{x:1,z:1}];const c=grassChunks(p);assert.equal(c.length,2);assert.equal(c[0].points.length,2);assert.equal(c[0].key,'-1:-1');
});
for(const id of ['baixo','medio','alto']) test('densidade zero desliga todos os LODs em '+id,()=>{
 const budget=grassBudget(preset(id),'normal',0);const plan=planGrass(grassChunks([{x:0,z:0}]),{x:0,z:0},budget);assert.equal(plan[0].count,0);
});
test('Fácil reduz densidade e orçamento; hardware fraco usa menos que Médio/Alto',()=>{
 const high=grassBudget(preset('alto')),easy=grassBudget(preset('alto'),'easy'),low=grassBudget(preset('baixo')),mid=grassBudget(preset('medio'));
 assert.ok(easy.density<high.density&&easy.near<high.near&&easy.far<high.far);assert.ok(low.near<mid.near&&mid.near<high.near);assert.ok(low.cutoff<mid.cutoff&&mid.cutoff<high.cutoff);
});
test('porto tem limite menor, preservando a otimização anterior',()=>{
 const regular=grassBudget(preset('alto')),port=grassBudget(preset('alto'),'normal',1,'porto');assert.equal(port.near,16);assert.equal(port.far,80);assert.ok(port.near<regular.near);
});
test('slider inválido é limitado; densidades menores não aumentam orçamento',()=>{
 const base=grassBudget(preset('alto'));assert.deepEqual(grassBudget(preset('alto'),'normal',5),base);assert.equal(grassBudget(preset('alto'),'normal',-2).near,0);assert.deepEqual(grassBudget(preset('alto'),'normal',NaN),base);
});
test('limites são por mapa, não por chunk; um único LOD por chunk',()=>{
 const chunks=grassChunks(Array.from({length:1000},(_,i)=>({x:(i%20)-10,z:Math.floor(i/20)-25})));const budget=grassBudget(preset('alto'));const plan=planGrass(chunks,{x:0,z:0},budget);
 assert.ok(plan.filter(p=>p.lod==='near').reduce((s,p)=>s+p.count,0)<=budget.near);assert.ok(plan.filter(p=>p.lod==='far').reduce((s,p)=>s+p.count,0)<=budget.far);
 for(const p of plan)assert.ok(['hidden','near','far'].includes(p.lod));
});
test('fora da distância de corte nenhum chunk desenha',()=>{
 const plan=planGrass(grassChunks([{x:0,z:0}]),{x:200,z:200},grassBudget(preset('alto')));assert.equal(plan[0].count,0);assert.equal(plan[0].lod,'hidden');
});
test('asset GLB é pequeno, Meshopt + WebP, sem repetir 161 mil triângulos',()=>{
 const bytes=readFileSync(new URL('../assets/models/grass-patch.glb',import.meta.url));assert.equal(bytes.readUInt32LE(0),0x46546c67);assert.equal(bytes.length,bytes.readUInt32LE(8));assert.ok(bytes.length<65000);
 const json=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)));assert.ok(json.extensionsRequired.includes('EXT_meshopt_compression'));assert.ok(json.extensionsRequired.includes('EXT_texture_webp'));
 const prim=json.meshes[0].primitives[0];const count=json.accessors[prim.indices].count/3;assert.equal(count,511);assert.equal(json.images.length,1);assert.equal(json.images[0].mimeType,'image/webp');assert.ok(!json.skins&&!json.animations);assert.ok(GRASS_RADIUS>=.7);
});
test('densidade migra saves de ajustes sem chave antiga e limita valores persistidos',async()=>{
 const {SETTINGS,loadSettings,setSetting,resetSettings}=await import('../js/settings.js');globalThis.localStorage={getItem:()=>'{"sens":1.2}',setItem(){}};loadSettings();assert.equal(SETTINGS.grassDensity,1);setSetting('grassDensity',2);assert.equal(SETTINGS.grassDensity,1);setSetting('grassDensity',-.5);assert.equal(SETTINGS.grassDensity,0);setSetting('grassDensity',NaN);assert.equal(SETTINGS.grassDensity,1);resetSettings();delete globalThis.localStorage;
});
