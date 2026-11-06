// Auditoria CPU da geometria real. Não abre navegador nem substitui revisão visual.
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const threeRoot=process.env.THREE_ROOT || '/tmp/crise-test-deps/node_modules/three';
const THREE=await import(pathToFileURL(threeRoot+'/build/three.module.js'));
import vm from 'node:vm';import {readFileSync} from 'node:fs';import {resolve,dirname} from 'node:path';
import {safeDoorArrival} from '../js/door-safety.mjs';
import {cageReleaseWave} from '../js/campaign-rules.mjs';
import {findEscortPath,canStand,segmentClear} from '../js/escort-nav.mjs';
const noop=()=>{}, grad={addColorStop:noop};
const draw=new Proxy({getImageData:(x,y,w,h)=>({data:new Uint8ClampedArray(w*h*4)}),createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),createLinearGradient:()=>grad,createRadialGradient:()=>grad,measureText:s=>({width:s.length*10})},{get:(t,k)=>t[k]||noop,set:(t,k,v)=>(t[k]=v,true)});
const doc={body:{prepend:noop},createElement:()=>({width:64,height:64,getContext:k=>k==='2d'?draw:null}),getElementById:()=>({style:{},classList:{add:noop,remove:noop}})};
class Renderer {constructor(){this.info={};this.shadowMap={};this.domElement={}}setPixelRatio(){}setSize(){}}
class TexLoader {load(){return new THREE.Texture()}}
const context=vm.createContext({console,document:doc,window:{devicePixelRatio:1},innerWidth:800,innerHeight:600,addEventListener:noop,performance,URL,localStorage:{getItem:()=> 'baixo',setItem:noop},navigator:{},setTimeout,clearTimeout});
const modules=new Map();
const three=new vm.SyntheticModule(Object.keys(THREE),function(){for(const k of Object.keys(THREE))this.setExport(k,k==='WebGLRenderer'?Renderer:k==='TextureLoader'?TexLoader:THREE[k])},{context});
async function get(path){if(modules.has(path))return modules.get(path);const mod=new vm.SourceTextModule(readFileSync(path,'utf8'),{context,identifier:path,initializeImportMeta:m=>m.url='file://'+path});modules.set(path,mod);return mod;}
const main=await get(resolve(root,'js/areas.js'));await main.link(async(spec,ref)=>spec==='three'?three:get(resolve(dirname(ref.identifier),spec)));await main.evaluate();
const {AREAS,buildArea}=main.namespace,fail=[],report=[];
let routes=0;
for(const a of AREAS){
 buildArea(a);
 // A diretoria só é acessível depois da energia: simula sua folha já aberta.
 if(a.refs.sideDoor)a.ctx.boxes.splice(a.ctx.boxes.indexOf(a.refs.sideDoor.box),1);
 const env={bounds:a.bounds,boxes:a.ctx.boxes,circles:a.ctx.circles},arrival=[];
 for(const d of a.doors){const p=safeDoorArrival(a,d.id,.5,1.6);if(!p||!canStand(p.x,p.z,env,.5))fail.push(a.id+':'+d.id);arrival.push([d.id,p]);}
 const start=a.start||arrival[0][1];
 const targets=[...arrival.map(([id,p])=>({...p,id:'porta-'+id})),...(a.refs.terminals||[]),...(a.logs||[]),...(a.encounters||[]).filter(e=>e.zone).map(e=>({...e.zone,id:e.id})),a.core&&{...a.core,id:'nucleo'},a.helipad&&{...a.helipad,id:'helipad'},a.quayPad&&{...a.quayPad,id:'resgate'}].filter(Boolean);
 for(const t of targets){
   let path=[];
   for(const r of [0,1,1.8]){for(let i=0;i<16;i++){const q={x:t.x+Math.cos(i*Math.PI/8)*r,z:t.z+Math.sin(i*Math.PI/8)*r};if(canStand(q.x,q.z,env,.5)){path=findEscortPath(start,q,env,.5);if(path.length)break;}}if(path.length)break;}
   if(!path.length)fail.push(a.id+':rota-'+(t.id||t.kind));else{routes++;let prev=start;for(const p of path){if(!segmentClear(prev,p,env,.5))fail.push(a.id+':colisao-rota');prev=p;}}
 }
 report.push({area:a.id,boxes:a.ctx.boxes.length,circles:a.ctx.circles.length,arrivals:arrival});
}
const cliff=AREAS.find(a=>a.id==='heliponto');const north=safeDoorArrival(cliff,'N',.5,1.6);
const start={x:-18,z:-10};if(!findEscortPath(start,north,{bounds:cliff.bounds,boxes:cliff.ctx.boxes,circles:cliff.ctx.circles},.5).length)fail.push('rota-norte-heliponto');
const port=AREAS.find(a=>a.id==='porto');if(!findEscortPath({x:6,z:17},{x:11.1,z:17.25},{bounds:port.bounds,boxes:port.ctx.boxes,circles:port.ctx.circles},.48).length)fail.push('embarque-lima');
const camp=AREAS.find(a=>a.id==='acampamento');
let cageRoutes=0;
for(const difficulty of ['easy','normal','hard'])for(const spawn of cageReleaseWave(camp.cages,difficulty)){
 const env={bounds:camp.bounds,boxes:camp.ctx.boxes,circles:camp.ctx.circles},r=spawn.type==='brute'?1.1:.6;
 if(segmentClear(spawn,spawn.cageExit,env,r))fail.push('jaula-inicial-sem-colisao');
 const open={...env,boxes:env.boxes.filter(b=>!camp.refs.cageGates.some(g=>g.box===b))};
 if(!segmentClear(spawn,spawn.cageExit,open,r))fail.push('dino-preso-na-jaula-'+difficulty);else cageRoutes++;
}
if(THREE.REVISION!=='160')fail.push('versao-three');
console.log(JSON.stringify({three:THREE.REVISION,renderer:'stub sem WebGL',routes,cageRoutes,report,fail},null,2));if(fail.length)process.exitCode=1;
