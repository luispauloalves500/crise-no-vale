import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

test('cada controle de personagem tem ID exclusivo',()=>{
  const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
  const ids=Array.from(html.matchAll(/\bid="([^"]+)"/g),m=>m[1]);
  assert.equal(new Set(ids).size,ids.length,'IDs duplicados impedem associar botões corretos');
  for (const id of ['heroMarina','heroJill','heroNote','pauseHeroMarina','pauseHeroJill','pauseHeroNote']) assert.ok(ids.includes(id));
});
test('menu e pausa refletem desbloqueio e troca e bloqueiam retorno durante carregamento',async()=>{
  const source=readFileSync(new URL('../js/main.js',import.meta.url),'utf8');
  const section=source.slice(source.indexOf("let selectedCharacter = 'marina'"),source.indexOf("$('startBtn').onclick"));
  const names=['heroMarina','heroJill','heroNote','pauseHeroMarina','pauseHeroJill','pauseHeroNote','startBtn','continueBtn','resumeBtn'];
  const els=Object.fromEntries(names.map(id=>[id,{disabled:false,textContent:'',on:false,classList:{toggle(k,v){els[id].on=v}}}]));
  let resolve,unlocked=false,selected=null;
  const context={$(id){return els[id]},G:{best:0},localStorage:{getItem(){return unlocked?'1':null},setItem(){}},selectHero(choice){selected=choice;return new Promise(r=>resolve=r)}};
  vm.createContext(context);vm.runInContext(section,context);
  context.refreshCharacterButtons();assert.equal(els.heroJill.disabled,true);assert.equal(els.pauseHeroJill.disabled,true);
  unlocked=true;context.refreshCharacterButtons();assert.equal(els.pauseHeroJill.disabled,false);
  const p=els.pauseHeroJill.onclick();assert.equal(selected,'jill');assert.equal(els.resumeBtn.disabled,true);
  resolve(true);await p;assert.equal(els.resumeBtn.disabled,false);assert.equal(els.heroJill.on,true);assert.equal(els.pauseHeroJill.on,true);
  assert.equal(els.heroMarina.on,false);assert.equal(els.pauseHeroMarina.on,false);
});
