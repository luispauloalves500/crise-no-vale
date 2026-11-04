import test from 'node:test';
import assert from 'node:assert/strict';
import {createShaderWarmup, compileShaderVariants} from '../js/shader-warmup.mjs';
const tick=()=>new Promise(resolve=>setImmediate(resolve));
test('compila uma área por vez, compartilha requisições e reutiliza resultado',async()=>{
  const calls=[],done=[];
  const w=createShaderWarmup(group=>new Promise(resolve=>{calls.push(group);done.push(resolve)}));
  const a={ctx:{group:'a'}},b={ctx:{group:'b'}};
  const p=w.request(a);assert.equal(w.request(a),p);const q=w.request(b);
  await tick();assert.deepEqual(calls,['a']);assert.equal(w.isBusy(a),true);assert.equal(w.isBusy(b),true);
  done.shift()(true);assert.equal(await p,true);await tick();assert.deepEqual(calls,['a','b']);done.shift()(true);assert.equal(await q,true);
  assert.equal(w.isBusy(a),false);assert.equal(await w.request(a),true);assert.deepEqual(calls,['a','b']);
});
test('mudança de qualidade ou reconstrução invalida o contexto e permite nova compilação',async()=>{
  let count=0;const w=createShaderWarmup(async()=>{count++;return true}),a={ctx:{group:{}}};
  await w.request(a);w.invalidate();await w.request(a);a.ctx={group:{}};await w.request(a);assert.equal(count,3);
});
test('falha não bloqueia a fila e pode ser tentada de novo',async()=>{
  let n=0;const original=console.warn;console.warn=()=>{};
  try {const w=createShaderWarmup(async()=>{if(++n===1)throw Error('gpu');return true}),a={ctx:{group:{}}};
    assert.equal(await w.request(a),false);assert.equal(await w.request(a),true);assert.equal(n,2);
  } finally {console.warn=original;}
});
test('descarte de área antes do início impede compilação de contexto obsoleto',async()=>{
  let release;const called=[];const w=createShaderWarmup(g=>{called.push(g);return new Promise(r=>release=r)});
  const a={ctx:{group:'a'}},b={ctx:{group:'b'}};const p=w.request(a),q=w.request(b);await tick();b.ctx=null;release(true);
  await p;assert.equal(await q,false);assert.deepEqual(called,['a']);assert.equal(w.isBusy(b),false);
});

function fakeRenderer(compile) {
  const initial = {name:'alvo anterior'};
  return {
    initial, target:initial, face:3, level:2,
    getRenderTarget() { return this.target; },
    getActiveCubeFace() { return this.face; },
    getActiveMipmapLevel() { return this.level; },
    setRenderTarget(target, face=0, level=0) { Object.assign(this,{target,face,level}); },
    compileAsync:compile,
  };
}
test('prepara variantes direta e bloom e restaura o alvo enquanto a GPU está pendente',async()=>{
  const calls=[], done=[], bloom={}, group={}, camera={}, scene={};
  const r=fakeRenderer(function(...args) {
    calls.push({target:this.target,args}); return new Promise(resolve=>done.push(resolve));
  });
  const p=compileShaderVariants(r,group,camera,scene,bloom);
  assert.deepEqual(calls,[{target:null,args:[group,camera,scene]}]);
  assert.equal(r.target,r.initial); assert.equal(r.face,3); assert.equal(r.level,2);
  done.shift()(); await tick();
  assert.deepEqual(calls.map(c=>c.target),[null,bloom]);
  assert.equal(r.target,r.initial); assert.equal(r.face,3); assert.equal(r.level,2);
  done.shift()(); assert.equal(await p,true);
});
test('restaura alvo após falha síncrona ou rejeição da GPU e a fila continua',async()=>{
  for (const fail of [()=>{throw Error('compilação')},()=>Promise.reject(Error('GPU'))]) {
    const r=fakeRenderer(fail);
    await assert.rejects(compileShaderVariants(r,{}, {}, {}));
    assert.equal(r.target,r.initial); assert.equal(r.face,3); assert.equal(r.level,2);
    let calls=0;r.compileAsync=()=>{calls++;return Promise.resolve()};
    assert.equal(await compileShaderVariants(r,{}, {}, {}),true);assert.equal(calls,1);
  }
});
test('sem compilação assíncrona mantém renderizador intacto e informa indisponibilidade',async()=>{
  const r=fakeRenderer(undefined);
  assert.equal(await compileShaderVariants(r,{}, {}, {},{}),false);
  assert.equal(r.target,r.initial);assert.equal(r.face,3);assert.equal(r.level,2);
});
