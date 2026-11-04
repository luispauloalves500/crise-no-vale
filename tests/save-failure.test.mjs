import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
function saveHarness(ok){
 const source=readFileSync(new URL('../js/director.js',import.meta.url),'utf8');
 const code=source.slice(source.indexOf('function saveGame(term)'),source.indexOf('export function hasSave()'));
 let saved,banner=0,indicator=0;const player={hp:23,pos:{x:0,z:0}},G={saves:2,score:5,kills:1,shots:2,hits:1,elapsed:10,cleanStreak:{kills:2},ep:1,epTotal:1};
 const c={player,G,PLAYER:{HP:100},D:{area:{id:'porto',name:'Cais'},st:{},enc:new Set(),objectives:0},F:{},rememberAreaThreats(){},snapshotBag:()=>({hp:player.hp}),snapshotSurvivor(){},story:{storySave:()=>({})},
 writeSave(data){saved=data;return ok},ui:{setHasSave(){indicator++},banner(){banner++}},sfx:{save(){}},burst(){},Math};
 vm.createContext(c);vm.runInContext(code,c);return {c,player,G,get saved(){return saved},get banner(){return banner},get indicator(){return indicator}};
}
test('falha de gravação não anuncia save, não consome tentativa nem restaura vida',()=>{
 const h=saveHarness(false);assert.equal(h.c.saveGame({x:0,z:0,group:{rotation:{y:0}}}),false);
 assert.equal(h.player.hp,23);assert.equal(h.G.saves,2);assert.equal(h.banner,0);assert.equal(h.indicator,0);
});
test('save bem sucedido grava vida e contador restaurados e confirma uma vez',()=>{
 const h=saveHarness(true);assert.equal(h.c.saveGame({x:0,z:0,group:{rotation:{y:0}}}),true);
 assert.equal(h.player.hp,100);assert.equal(h.G.saves,3);assert.equal(h.saved.stats.saves,3);assert.equal(h.saved.bag.hp,100);assert.equal(h.banner,1);assert.equal(h.indicator,1);
});
test('terminal não marca como salvo quando gravação falha e permite tentar de novo',()=>{
 const source=readFileSync(new URL('../js/shop.js',import.meta.url),'utf8');
 const code=source.slice(source.indexOf('function activateMenu(i)'),source.indexOf('function moveTab(d)'));
 let succeed=false,last='';const c={MENU:['save','shop','exit'],T:{saved:false,onSave:()=>succeed},PLAYER:{HP:100},say(m){last=m},sfx:{tick(){}},render(){},closeTerminal(){}};
 vm.createContext(c);vm.runInContext(code,c);c.activateMenu(0);assert.equal(c.T.saved,false);assert.match(last,/Não foi possível salvar/);
 succeed=true;c.activateMenu(0);assert.equal(c.T.saved,true);assert.match(last,/Progresso salvo/);
});
