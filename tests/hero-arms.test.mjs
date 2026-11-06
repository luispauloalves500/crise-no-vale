import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {RELOAD_KEYS,reloadPoseAt} from '../js/hero-arms.mjs';
import {cageReleaseWave,cageGatePose,CAGE_OPEN_SECONDS,normalizeCampaignSave} from '../js/campaign-rules.mjs';

test('recarga procedural tem busca no cinto, pente visível, encaixe, inclinação e retorno suaves',()=>{
 assert.equal(RELOAD_KEYS[0].t,0);assert.equal(RELOAD_KEYS.at(-1).t,1);
 assert.equal(reloadPoseAt(.32).belt,1);assert.equal(reloadPoseAt(.32).magazine,true);
 assert.ok(reloadPoseAt(.7).belt<.01);assert.ok(reloadPoseAt(.7).under<.02);
 assert.ok(reloadPoseAt(.4).tilt>.5);assert.equal(reloadPoseAt(.9).magazine,false);
 assert.equal(reloadPoseAt(0).blend,0);assert.equal(reloadPoseAt(1).blend,0);
 for(let i=0;i<=1000;i++){const a=reloadPoseAt(i/1000),b=reloadPoseAt((i+1)/1000);for(const k of ['belt','under','tilt','blend']){assert.ok(Number.isFinite(a[k]));assert.ok(Math.abs(a[k]-b[k])<.04);}}
});
test('recarga usa progresso normalizado, logo upgrades/durações diferentes não mudam a sequência',()=>{
 for(const duration of [1,1.4,2.2,3])assert.equal(reloadPoseAt((duration-duration*.6)/duration).belt,1);
});
test('correção de ambos os braços roda depois do mixer e também no idle de menu',()=>{
 const src=readFileSync(new URL('../js/player.js',import.meta.url),'utf8');
 assert.ok(src.indexOf('hero.armRig?.apply({')>src.indexOf('hero.mixer.update(player.dead ? 0 : dt)'));
 assert.match(src,/hero.mixer.update\(0\);\s+hero.armRig\?\.apply\(\)/);assert.match(src,/hero.armRig\?\.dispose\(\)/);
});
test('porta só deixa de colidir depois da altura segura, não no começo da animação',()=>{
 assert.ok(CAGE_OPEN_SECONDS>=1);assert.deepEqual(cageGatePose(0,2.4),{y:0,blocking:true});
 assert.equal(cageGatePose(.4,2.4).blocking,true);assert.equal(cageGatePose(1,2.4).blocking,false);
 assert.deepEqual(cageReleaseWave([],'normal'),[]);
});
test('migração de jaulas antigas remove a abertura automática e fila antiga, não itens',()=>{
 const s=normalizeCampaignSave({area:'acampamento',flags:{},enc:['camp-brandt'],st:{acampamento:{taken:['p8med'],pending:[{type:'raptor',t:3}]}}});
 assert.equal(s.enc.includes('camp-brandt'),false);assert.deepEqual(s.st.acampamento.pending,[]);assert.deepEqual(s.st.acampamento.taken,['p8med']);
});

test('save legado posterior ao ninho preserva jaulas abertas e não faz Brandt preso reaparecer',()=>{
 const s=normalizeCampaignSave({v:7,area:'acampamento',flags:{brandt:'caught',nestClear:true},enc:['camp-brandt']});
 assert.equal(s.flags.cagesReleased,true);assert.equal(s.enc.includes('camp-brandt'),true);assert.equal(s.flags.brandt,'caught');
});
