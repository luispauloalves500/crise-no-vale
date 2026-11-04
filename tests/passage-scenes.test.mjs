import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {PASSAGES, passageFor, advancePassage} from '../js/passage-scenes.mjs';
const src=readFileSync(new URL('../js/areas.js',import.meta.url),'utf8');
const literal=src.slice(src.indexOf('export const AREAS = [')+'export const AREAS = '.length,src.indexOf('\nexport const AREA ='));
const areas=vm.runInNewContext(literal,{Math});
test('as cenas usam rotas reais e cobrem as oito ligações principais',()=>{
  assert.equal(Object.keys(PASSAGES).length,8);
  for(const [route, scene] of Object.entries(PASSAGES)) {
    const [from,to]=route.split('>');
    assert.ok(areas.find(a=>a.id===from)?.doors.some(d=>d.to===to), route);
    assert.ok(scene.title && scene.text && scene.hint);
  }
});
test('cena é mostrada na primeira chegada e não é repetida em retorno ou save',()=>{
  const seen=new Set(), scene=passageFor('lab','pantano',false,seen);
  assert.ok(scene); assert.equal(scene.duration,5.5);
  seen.add(scene.key);
  const saved=JSON.parse(JSON.stringify({said:[...seen]}));
  assert.equal(passageFor('lab','pantano',false,new Set(saved.said)),null);
  assert.equal(passageFor('lab','pantano',true,new Set()),null);
  assert.equal(passageFor('pantano','lab',false,new Set()),null);
});
test('tempo de cena tem limite e pode ser pulado sem alterar o tempo',()=>{
  assert.deepEqual(advancePassage(1,0.5,5.5),{time:1.5,done:false});
  assert.deepEqual(advancePassage(5.4,1,5.5),{time:5.5,done:true});
  assert.deepEqual(advancePassage(1,0,5.5,true),{time:1,done:true});
  assert.deepEqual(advancePassage(1,-1,5.5),{time:1,done:false});
});
