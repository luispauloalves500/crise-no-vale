import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { createTimeline, sampleShot, sceneScript, CUTSCENE_IDS } from '../js/cutscene-timeline.mjs';
const source=readFileSync(new URL('../js/cutscenes.js',import.meta.url),'utf8');
for(const id of CUTSCENE_IDS)test(`cutscene ${id}: câmera finita, legendas, fim natural e skip exatamente uma vez`,()=>{
  const s=sceneScript(id,{x:3,z:-4},{brandt:'caught',act3Choice:'expose'});assert.ok(s.duration>=8);
  for(let t=0;t<s.duration;t+=.1){const p=sampleShot(s.keys,t);assert.ok([...p.pos,...p.look,p.fov].every(Number.isFinite));}
  const done=[];const timeline=createTimeline(s,result=>done.push(result));
  timeline.update(1);assert.ok(timeline.subtitle()?.text);timeline.skip();timeline.skip();timeline.update(100);
  assert.equal(done.length,1);assert.equal(done[0].skipped,true);assert.equal(timeline.ended,true);
  const natural=[];const b=createTimeline(s,r=>natural.push(r));b.update(100);b.skip();assert.equal(natural.length,1);assert.equal(natural[0].skipped,false);
});
function runtime(){
  class V {constructor(x=0,y=0,z=0){Object.assign(this,{x,y,z})}clone(){return new V(this.x,this.y,this.z)}copy(v){Object.assign(this,v);return this}fromArray(a){[this.x,this.y,this.z]=a;return this}}
  const els={title:{},dialogue:{},button:{}};
  const panel={hidden:true,setAttribute(){},querySelector(s){return s==='#cinema-title'?els.title:s==='#cinema-dialogue'?els.dialogue:els.button}};
  const c={bounds:{minX:-30,maxX:30,minZ:-30,maxZ:30},createTimeline,sceneScript,G:{state:'play'},camera:{position:new V(),quaternion:new V(),fov:60,lookAt(){},updateProjectionMatrix(){}},
    player:{pos:new V()},pg:{position:new V(),rotation:{y:0}},clearInput(){c.clears++},clears:0,unlockPointer(){},lockPointer(){},
    animateDoorWalk(){c.hero++},hero:0,animateCinematicEnemies(){c.dinos++},dinos:0,updateSurvivor(){c.npcs++},updateBrandt(){},npcs:0,
    document:{createElement:()=>panel,body:{append(){}}}};
  vm.createContext(c);vm.runInContext(source.replace(/^import .*;\n/gm,'').replaceAll('export ',''),c);return c;
}
test('runtime cinematográfico bloqueia controle, anima atores, restaura câmera e skip/cancel não duplicam eventos',()=>{
  const c=runtime();let done=0;c.camera.position.x=7;
  assert.equal(c.playCutscene('act1',{onComplete:()=>done++}),true);assert.equal(c.G.state,'cutscene');
  assert.equal(c.playCutscene('act2'),false);c.updateCutscene(1);assert.ok(c.hero&&c.dinos&&c.npcs);assert.notEqual(c.camera.position.x,7);
  c.skipCutscene();assert.equal(done,1);assert.equal(c.G.state,'play');assert.equal(c.camera.position.x,7);assert.equal(c.skipCutscene(),false);
  c.playCutscene('act4',{onComplete:()=>done++});c.cancelCutscene();assert.equal(done,1);assert.equal(c.G.state,'play');
});
test('teclas de skip são consumidas antes dos controles de combate e do menu',()=>{
  const main=readFileSync(new URL('../js/main.js',import.meta.url),'utf8');
  assert.match(main,/if\(G.state==='cutscene'\)\{if\(code==='Escape'\|\|code==='Enter'\)skipCutscene\(\);return;\}/);
  assert.match(main,/if\(G.state==='cutscene'\)\{updateCutscene\(dt\);updateFx\(dt\);return;\}/);
});
