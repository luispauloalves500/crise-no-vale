import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {discoveredRecords,canSeeRecord,canAccessRecord} from '../js/archive-model.mjs';
const source=readFileSync(new URL('../js/areas.js',import.meta.url),'utf8');
const areaText=source.slice(source.indexOf('export const AREAS = [')+'export const AREAS = '.length,source.indexOf('\nexport const AREA ='));
const areas=vm.runInNewContext(areaText,{Math});
const story=readFileSync(new URL('../js/story.js',import.meta.url),'utf8');
const recordsText=story.slice(story.indexOf('export const LOGS = {')+'export const LOGS = '.length,story.indexOf('\nexport const LOG_IDS ='));
const records=vm.runInNewContext('('+recordsText.trim().replace(/;$/, '')+')'), ids=Object.keys(records);
test('os 13 IDs estão em uma única área correspondente à história',()=>{
  const items=areas.flatMap(a=>a.logs.map(l=>({...l,area:a.id})));
  assert.equal(ids.length,13); assert.equal(items.length,13);
  assert.equal(new Set(items.map(l=>l.id)).size,13);
  for(const l of items) { assert.ok(records[l.id]); assert.equal(records[l.id].area,l.area); assert.ok(records[l.id].pages.length); }
});
test('arquivo mostra somente IDs descobertos e mantém ordem após serialização',()=>{
  const found=new Set(['log7','log2','unknown']);
  const saved=JSON.parse(JSON.stringify({logs:[...found]}));
  const entries=discoveredRecords(ids,records,new Set(saved.logs));
  assert.deepEqual(entries.map(e=>e.id),['log2','log7']);
  assert.equal(entries[0].title,records.log2.title);
  assert.deepEqual(discoveredRecords(ids,records,new Set()),[]);
});
test('uma parede entre personagem e documento impede interação',()=>{
  const from={x:0,z:0}, target={x:0,z:2};
  assert.equal(canSeeRecord(from,target,()=>2),true);
  assert.equal(canSeeRecord(from,target,()=>1),false);
  assert.equal(canSeeRecord(from,target,()=>1.6),true);
  assert.equal(canSeeRecord(from,from,()=>0),true);
  let seen;canSeeRecord(from,target,(x,z,dx,dz,d,h)=>{seen={dx,dz,d,h};return d;});
  assert.deepEqual(seen,{dx:0,dz:1,d:2,h:1});
});

test('gravação da diretoria exige energia e não abre durante bloqueio',()=>{
  assert.equal(canAccessRecord('log5',{power:false},null),false);
  assert.equal(canAccessRecord('log5',{power:true},{t:2}),false);
  assert.equal(canAccessRecord('log5',{power:true},null),true);
  assert.equal(canAccessRecord('log3',{power:false},null),true);
});
