import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {beginSpit,advanceSpit,SPIT_DURATION,SPIT_RELEASE,spitTrajectory} from '../js/spitter-action.mjs';
import {stepFrillSpring} from '../js/dino-frill.mjs';import {dinoMotion} from '../js/dino-animation.mjs';
import {dinoDimensions,dinoBarY} from '../js/dino-dimensions.mjs';
const cfg={shape:'spitter',scale:1.05,r:.75,speed:3.6};
test('cuspe libera uma vez em 520 ms, independentemente do dt',()=>{
 for(const dt of [1/144,1/60,1/30,.12,2]){const a=beginSpit();let events=0;for(let t=0;t<3;t+=dt){const old=a.time,release=advanceSpit(a,dt);if(release){events++;assert.ok(a.time>=SPIT_RELEASE);assert.ok(old<SPIT_RELEASE);}}assert.equal(events,1);assert.equal(a.time,SPIT_DURATION);assert.equal(a.done,true);}
});
test('dano/morte/cutscene cancelam a carga; não há disparo atrasado ao voltar',()=>{
 for(const elapsed of [0,.2,.51]){const a=beginSpit();advanceSpit(a,elapsed);assert.equal(advanceSpit(a,.01,true),false);assert.equal(advanceSpit(a,2),false);assert.equal(a.cancelled,true);}
 const a=beginSpit();advanceSpit(a,SPIT_RELEASE);assert.equal(advanceSpit(a,2),false);const b=beginSpit();assert.equal(b.released,false);
});
test('pose de spit segue o relógio, com marcador exato e prioridades de dano/morte',()=>{
 const e={cfg,spitT:.3,spitAction:{time:.6},spitRelease:true};assert.deepEqual(dinoMotion(e),{clip:'spit',rate:0,time:SPIT_RELEASE});e.spitRelease=false;assert.equal(dinoMotion(e).time,.6);
 e.flashT=.1;assert.equal(dinoMotion(e).clip,'hurt');e.dead=true;assert.equal(dinoMotion(e).clip,'death');
});
test('trajetória começa exatamente na boca e desce continuamente até o torso, sem salto de altura',()=>{
 for(const mouth of [{x:3,y:2,z:4},{x:-8,y:1.8,z:7}]){const target={x:mouth.x+10,y:0,z:mouth.z},s=spitTrajectory(mouth,target);assert.equal(s.x,mouth.x);assert.equal(s.y,mouth.y);assert.equal(s.z,mouth.z);const t=10/12;assert.ok(Math.abs(s.y+s.vy*t-1.15)<1e-8);assert.ok(Math.abs(Math.hypot(s.vx,s.vz)-12)<1e-8);}
});
test('molas da gola são limitadas, independentes e amortecem após aceleração',()=>{
 for(const dt of [.008,.016,.033,.12,1]){const a={value:0,velocity:0},b={value:0,velocity:0};for(let i=0;i<20;i++)stepFrillSpring(a,.12,dt);assert.ok(a.value>0&&a.value<.14);assert.equal(b.value,0);for(let i=0;i<300;i++)stepFrillSpring(a,0,dt);assert.ok(Math.abs(a.value)<1e-5);}
});
test('Cuspidor conserva dimensões/hitbox/barras históricos',()=>{
 const d=dinoDimensions(cfg);assert.ok(Math.abs(d.height-2.5426054529)<1e-8);assert.ok(Math.abs(d.length-4.3942500004)<1e-8);assert.equal(d.radius,.75);assert.ok(dinoBarY(cfg)>d.height);
});
test('gola tem seis ossos novos, mandíbula própria e socket preservados no GLB otimizado',()=>{
 const b=readFileSync(new URL('../assets/models/cuspidor.glb',import.meta.url)),j=JSON.parse(b.subarray(20,20+b.readUInt32LE(12)));const names=new Set(j.nodes.map(n=>n.name));
 for(const side of ['L','R'])for(const suffix of ['','_Top','_Bottom'])assert.ok(names.has('Frill_'+side+suffix));assert.ok(names.has('Jaw_Bottom'));assert.ok(names.has('SpitSocket'));assert.equal(j.skins[0].joints.length,97);
 assert.ok(j.extensionsRequired.includes('EXT_texture_webp'));assert.equal(j.animations.find(a=>a.name==='spit').extras.releaseTime,SPIT_RELEASE);
});
