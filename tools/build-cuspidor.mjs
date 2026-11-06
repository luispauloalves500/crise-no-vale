// Autoria de clipes/rig adicional, preservando o mesh/texturas enviados. Não depende de Blender.
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {dedup,prune,resample,textureCompress,meshopt} from '@gltf-transform/functions';
import {MeshoptEncoder,MeshoptDecoder} from 'meshoptimizer';
import {Quaternion,Vector3,Matrix4} from 'three';
import {createHash} from 'node:crypto';
import sharp from 'sharp';import {readFile,stat,writeFile,mkdir} from 'node:fs/promises';
const input=process.argv[2],outdir=process.argv[3];
if(!input||!outdir)throw new Error('Uso: node tools/build-cuspidor.mjs original.glb diretório-de-saída');
await mkdir(outdir,{recursive:true});
await Promise.all([MeshoptEncoder.ready,MeshoptDecoder.ready]);
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.encoder':MeshoptEncoder,'meshopt.decoder':MeshoptDecoder});
const doc=await io.read(input),root=doc.getRoot(),buffer=root.listBuffers()[0],skin=root.listSkins()[0],nodes=new Map(root.listNodes().map(n=>[n.getName(),n]));
if(root.listAnimations().length)throw new Error('Inspecionar clipes embutidos antes de sobrescrever');
const sourceNodes=root.listNodes().length,sourceJoints=skin.listJoints().length;
const parents=new Map(root.listNodes().flatMap(n=>n.listChildren().map(c=>[c,n]))),worldQ=new Map();
const wq=n=>{if(!worldQ.has(n))worldQ.set(n,parents.has(n)?wq(parents.get(n)).clone().multiply(new Quaternion().fromArray(n.getRotation())):new Quaternion().fromArray(n.getRotation()));return worldQ.get(n);};
function nodeAt(name,parent,point,joint=true){
 const node=doc.createNode(name),parentInv=new Matrix4().fromArray(parent.getWorldMatrix()).invert(),local=new Vector3(...point).applyMatrix4(parentInv);
 node.setTranslation(local.toArray()).setRotation(wq(parent).clone().invert().toArray());parent.addChild(node);parents.set(node,parent);nodes.set(name,node);worldQ.set(node,new Quaternion());
 if(joint)skin.addJoint(node);return node;
}
const neck=nodes.get('Bone_037'),head=nodes.get('Bone_035'),frills=[];
for(const [side,sign]of [['L',-1],['R',1]]){
 const hinge=nodeAt('Frill_'+side,neck,[sign*.12,1.2,.84]);
 frills.push({side,sign,hinge,top:nodeAt('Frill_'+side+'_Top',hinge,[sign*.34,1.4,.84]),bottom:nodeAt('Frill_'+side+'_Bottom',hinge,[sign*.34,1.02,.84])});
}
const jaw=nodeAt('Jaw_Bottom',head,[.0046,1.24,.98]),mouth=nodeAt('SpitSocket',head,[.0046,1.245,1.195],false);
const joints=skin.listJoints(),ibm=skin.getInverseBindMatrices(),oldMatrices=ibm.getArray(),matrices=new Float32Array(joints.length*16);matrices.set(oldMatrices);
for(let i=sourceJoints;i<joints.length;i++)matrices.set(new Matrix4().fromArray(joints[i].getWorldMatrix()).invert().toArray(),i*16);
ibm.setArray(matrices);
const smooth=(a,b,x)=>{x=Math.max(0,Math.min(1,(x-a)/(b-a)));return x*x*(3-2*x);};
let frillVertices=0,jawVertices=0;
for(const mesh of root.listMeshes())for(const primitive of mesh.listPrimitives()){
 const pos=primitive.getAttribute('POSITION'),ja=primitive.getAttribute('JOINTS_0'),wa=primitive.getAttribute('WEIGHTS_0'),j=ja.getArray(),w=wa.getArray();
 for(let i=0;i<pos.getCount();i++){
  const [x,y,z]=pos.getElement(i,[]),amount=smooth(.13,.24,Math.abs(x))*smooth(.82,.98,y)*smooth(.70,.78,z)*(1-smooth(.945,1.005,z));
  const jawWeight=(1-amount)*(1-smooth(.12,.17,Math.abs(x)))*smooth(.94,.985,z)*(1-smooth(1.225,1.255,y))*smooth(1.07,1.13,y);
  if(amount<.002&&jawWeight<.002)continue;
  const weights=new Map();for(let k=0;k<4;k++)if(w[i*4+k]>0)weights.set(j[i*4+k],(weights.get(j[i*4+k])||0)+w[i*4+k]*(1-Math.max(amount,jawWeight)));
  if(amount>=jawWeight){
   const f=frills[x<0?0:1],tip=smooth(.22,.46,Math.abs(x))*.42,child=y>1.2?f.top:f.bottom;
   weights.set(joints.indexOf(f.hinge),amount*(1-tip));weights.set(joints.indexOf(child),amount*tip);frillVertices++;
  }else {weights.set(joints.indexOf(jaw),jawWeight);jawVertices++;}
  const list=[...weights].sort((a,b)=>b[1]-a[1]).slice(0,4),sum=list.reduce((s,v)=>s+v[1],0);
  for(let k=0;k<4;k++){j[i*4+k]=list[k]?.[0]||0;w[i*4+k]=(list[k]?.[1]||0)/sum;}
 }
}
const rest=new Map(joints.map(n=>[n,{q:new Quaternion().fromArray(n.getRotation()).normalize(),p:n.getTranslation().slice(),inv:parents.has(n)?wq(parents.get(n)).clone().invert():new Quaternion()}]));
const rig={hips:'Bone_001',chest:'Bone_006',head:'Bone_036',neck:['Bone_006','Bone_005','Bone_004','Bone_003','Bone_002'],tail:['Bone_028','Bone_027','Bone_026','Bone_025','Bone_024','Bone_023','Bone_022','Bone_021','Bone_020','Bone_019'],legs:[['Bone_011','Bone_010','Bone_009','Bone_008'],['Bone_017','Bone_016','Bone_015','Bone_014']],arms:[['Bone_042','Bone_041'],['Bone_047','Bone_046']],mouth:'SpitSocket',frills:frills.flatMap(f=>[f.hinge.getName(),f.top.getName(),f.bottom.getName()])};
const defs=[['idle',2.4],['walk',.86],['run',.56],['attack',.78],['spit',.95],['hurt',.38],['death',1.2]];
function curve(t,keys){for(let i=1;i<keys.length;i++)if(t<=keys[i][0]){const a=keys[i-1],b=keys[i],f=smooth(a[0],b[0],t);return a[1]+(b[1]-a[1])*f;}return keys.at(-1)[1];}
function pose(name,u){
 const angles=new Map(),translation=new Vector3(),phase=u*Math.PI*2,gait=name==='walk'||name==='run',run=name==='run';
 const add=(name,x=0,y=0,z=0)=>{const n=nodes.get(name);if(!n)return;const a=angles.get(n)||[0,0,0];a[0]+=x;a[1]+=y;a[2]+=z;angles.set(n,a);};
 translation.y=gait?(run?.034:.016)*(1-Math.cos(phase*2)):name==='idle'?.004*Math.sin(phase):0;
 if(name==='idle'||gait){rig.tail.forEach((n,i)=>add(n,0,(gait?.032:.016)*Math.sin(phase-i*.4)));rig.neck.forEach((n,i)=>add(n,.006*Math.sin(phase*2-i*.3)));rig.arms.forEach((a,i)=>add(a[0],.025*Math.sin(phase+i*Math.PI)));}
 if(gait){rig.legs.forEach((leg,i)=>{const v=Math.sin(phase+i*Math.PI),s=(run?.56:.34)*v,k=(run?.65:.40)*Math.max(0,-v);add(leg[0],s);add(leg[1],k);add(leg[2],-.66*(s+k));add(leg[3],-.24*(s+k));});}
 let open=0;
 if(name==='attack'||name==='spit'){
  open=curve(u,[[0,0],[.24,1],[.72,1],[1,0]]);const bend=curve(u,[[0,0],[.28,-.12],[.55,.18],[.76,.05],[1,0]]);
  rig.neck.forEach(n=>add(n,bend/rig.neck.length));add(rig.head,bend*.25);translation.z=.045*Math.sin(Math.PI*u)**2;
 }
 add('Jaw_Bottom',-.10+(name==='attack'||name==='spit'?.32*open:0));
 for(const f of frills){add(f.hinge.getName(),0,f.sign*(.58-.53*open));add(f.top.getName(),.012*Math.sin(phase-f.sign*.4));add(f.bottom.getName(),-.01*Math.sin(phase+f.sign*.3));}
 if(name==='hurt'){const h=Math.sin(Math.PI*u);add(rig.chest,-.09*h,0,.055*h);add(rig.head,-.10*h);translation.x=.025*Math.sin(phase*2)*(1-u);}
 if(name==='death'){const d=smooth(0,.88,u);add(rig.hips,0,0,-1.35*d);translation.y=-.63*d;rig.legs.forEach((a,i)=>{add(a[0],(i?-.25:.25)*d);add(a[1],.3*d);});}
 return {angles,translation};
}
for(const [name,duration]of defs){
 const count=41,times=Float32Array.from({length:count},(_,i)=>duration*i/(count-1)),time=doc.createAccessor(name+'-time').setType('SCALAR').setArray(times).setBuffer(buffer);
 const clip=doc.createAnimation(name).setExtras({source:'authored-procedural',loop:!['attack','spit','hurt','death'].includes(name),...(name==='spit'?{releaseTime:.52}: {})});
 for(const [n,r]of rest){
  const values=new Float32Array(count*4);let previous=null;
  for(let i=0;i<count;i++){
   const a=pose(name,i/(count-1)).angles.get(n)||[0,0,0],q=r.q.clone();
   // Existing rig: author in model/world axes; added frill/jaw rigs have identity world rest.
   for(let k=0;k<3;k++)if(a[k]){const axis=new Vector3(k===0?1:0,k===1?1:0,k===2?1:0).applyQuaternion(r.inv);q.premultiply(new Quaternion().setFromAxisAngle(axis,a[k]));}
   q.normalize();if(previous&&q.dot(previous)<0)q.set(-q.x,-q.y,-q.z,-q.w);q.toArray(values,i*4);previous=q;
  }
  const out=doc.createAccessor(name+'-'+n.getName()).setType('VEC4').setArray(values).setBuffer(buffer),sampler=doc.createAnimationSampler().setInput(time).setOutput(out).setInterpolation('LINEAR');clip.addSampler(sampler).addChannel(doc.createAnimationChannel().setTargetNode(n).setTargetPath('rotation').setSampler(sampler));
 }
 const hips=nodes.get(rig.hips),r=rest.get(hips),values=new Float32Array(count*3);
 for(let i=0;i<count;i++)pose(name,i/(count-1)).translation.applyQuaternion(r.inv).add(new Vector3(...r.p)).toArray(values,i*3);
 const out=doc.createAccessor(name+'-hips').setType('VEC3').setArray(values).setBuffer(buffer),sampler=doc.createAnimationSampler().setInput(time).setOutput(out).setInterpolation('LINEAR');clip.addSampler(sampler).addChannel(doc.createAnimationChannel().setTargetNode(hips).setTargetPath('translation').setSampler(sampler));
}
root.listScenes()[0].setExtras({source:'user-provided stylized frilled dinosaur',rig,spitRelease:.52,spitDuration:.95,frillVertices,jawVertices});
await doc.transform(dedup(),prune({keepLeaves:true}),resample(),textureCompress({encoder:sharp,targetFormat:'webp',resize:[1024,1024],quality:85}));
await io.write(outdir+'/cuspidor-preview.glb',doc);
await doc.transform(meshopt({encoder:MeshoptEncoder,level:'high'}));await io.write(outdir+'/cuspidor.glb',doc);
const check=await io.read(outdir+'/cuspidor.glb'),r=check.getRoot();const audit={input,sourceSha256:createHash('sha256').update(await readFile(input)).digest('hex'),outputSha256:createHash('sha256').update(await readFile(outdir+'/cuspidor.glb')).digest('hex'),before:(await stat(input)).size,after:(await stat(outdir+'/cuspidor.glb')).size,sourceNodes,sourceJoints,sourceAnimations:0,nodes:r.listNodes().length,joints:r.listSkins()[0].listJoints().length,vertices:r.listMeshes().flatMap(m=>m.listPrimitives()).reduce((s,p)=>s+p.getAttribute('POSITION').getCount(),0),triangles:r.listMeshes().flatMap(m=>m.listPrimitives()).reduce((s,p)=>s+p.getIndices().getCount()/3,0),frillVertices,jawVertices,animations:r.listAnimations().map(a=>({name:a.getName(),channels:a.listChannels().length,extras:a.getExtras()})),textures:r.listTextures().map(t=>({mime:t.getMimeType(),size:t.getSize()})),extensions:r.listExtensionsUsed().map(e=>e.extensionName),rig};
await writeFile(outdir+'/asset-audit.json',JSON.stringify(audit,null,2));console.log(JSON.stringify(audit,null,2));
