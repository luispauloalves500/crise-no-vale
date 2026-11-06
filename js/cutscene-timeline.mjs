// Renderer-independent timeline. Skip and natural completion have identical outcomes.
export function sampleShot(keys, time) {
  if (!keys.length) throw new Error('Cutscene sem câmera');
  let a=keys[0], b=keys[keys.length-1];
  for(let i=1;i<keys.length;i++) if(time<=keys[i].t){a=keys[i-1];b=keys[i];break;}
  const k=Math.max(0,Math.min(1,(time-a.t)/Math.max(.001,b.t-a.t))), u=k*k*(3-2*k);
  const mix=(x,y)=>x+(y-x)*u;
  return {pos:a.pos.map((x,i)=>mix(x,b.pos[i])),look:a.look.map((x,i)=>mix(x,b.look[i])),fov:mix(a.fov||48,b.fov||48)};
}
export function createTimeline(scene, done=()=>{}) {
  let time=0,ended=false;
  const finish=skipped=>{if(ended)return;ended=true;time=scene.duration;done({skipped});};
  return {
    get time(){return time;},get ended(){return ended;},
    update(dt){if(!ended){time=Math.min(scene.duration,time+Math.max(0,dt));if(time>=scene.duration)finish(false);}return time;},
    skip(){finish(true);},
    sample(){return sampleShot(scene.keys,time);},
    subtitle(){return (scene.lines||[]).find(l=>time>=l.start&&time<l.end)||null;},
  };
}
export const CUTSCENE_IDS=Object.freeze(['opening','act1','act2','act3','act4','lima','cages','brandt','tyrant','extraction','ending-proof','ending-quarantine']);
export function sceneScript(id, focus={x:0,z:0}, flags={}) {
  if(!CUTSCENE_IDS.includes(id)) throw new Error('Cena desconhecida: '+id);
  const scripts={
    opening:['CRISE NO VALE','LIMA|Vale Verde chamando… as cercas caíram. Estamos presos.','ROCHA|Aqui Rocha. Estou no cais. Vou encontrar você.'],
    act1:['ATO 1 — VALE VERDE','ROCHA|Ruínas, laboratório, gerador. Preciso devolver a energia à estação.','LIMA|Siga os portões. A plataforma é para resgate, não é a saída do vale.'],
    act2:['ATO 2 — RIO ABAIXO','LIMA|A contenção lacrou a estação. Brandt fugiu pela margem.','ROCHA|Vou atrás dele. Ninguém vai apagar o que aconteceu aqui.'],
    act3:['ATO 3 — PORTO ANIL','PILOTO|Porto Anil. Pouco combustível; a Defesa Civil assume sua extração.','LIMA|Feche as comportas. O Conselho esconde uma sede sob a captação.'],
    act4:['ATO 4 — SETOR ZERO','LIMA|O manifesto aponta esta ilha. Porto Anil era apenas o entreposto.','ROCHA|Então vamos à origem. Acabamos com o RAIZ aqui.'],
    lima:['RESGATE — GARÇA-1','PILOTO|Área segura. Doutora, aproxime-se pela lateral.','LIMA|Obrigada, Rocha. Continuo pelo rádio. Você segue pelo portão.'],
    cages:['TELLUS-2 — CONTENÇÃO LIBERADA','BRANDT|Vocês queriam respostas? Perguntem a eles!','ROCHA|As jaulas! Ele soltou a matilha para cobrir a fuga.'],
    brandt:['ARQUIVO RAIZ — ORDEM ORIGINAL','LIMA|V-7 foi liberado de propósito. A tempestade foi o álibi.','ROCHA|Esta autorização tem meu nome… mas a assinatura foi enxertada.',flags.brandt==='caught'?'BRANDT|Eu falsifiquei a ordem. O Conselho mandou eliminar as testemunhas.':'LIMA|O arquivo original é assinado por Brandt. A fraude contra você está provada.'],
    tyrant:['TIRANO MATRIZ','LIMA|O arquivo acionou a contenção. O reprodutor original está solto!','ROCHA|Use os obstáculos… sem matriz, sem novos estoques.'],
    extraction:['EMBARQUE — SETOR ZERO','PILOTO|Lancha pronta. Vamos contornar a costa até a ilha.','LIMA|Não é o fim ainda. O arquivo de origem está lá.'],
    'ending-proof':['A VERDADE SOB CUSTÓDIA','LIMA|Arquivo integral transmitido. Todo estoque viável foi neutralizado.','ROCHA|Sem amostras a bordo. Só a verdade volta conosco.'],
    'ending-quarantine':['QUARENTENA DEFINITIVA','LIMA|Esterilização completa. Servidores e estoques destruídos.',flags.act3Choice==='expose'?'ROCHA|O Conselho já foi exposto. Essas provas não podem ser apagadas.':'ROCHA|A prova judicial será mais difícil. Mas nada vivo sai desta ilha.'],
  };
  const [title,...dialogue]=scripts[id],duration=dialogue.length*3.8+1;
  const {x,z}=focus,wide=id.startsWith('act')||id==='opening', giant=id==='tyrant';
  const boarding=id==='extraction'||id.startsWith('ending-');
  const boatKeys=[{t:0,pos:[x+8,5,z-7],look:[x,1.3,z+3],fov:52},{t:duration*.52,pos:[x-6,3.5,z-4],look:[x,1.3,z+4],fov:46},{t:duration,pos:[x-5,3,z+1],look:[x,1.5,z+5],fov:43}];
  return {id,title,duration,
    keys:boarding?boatKeys:[{t:0,pos:[x+(wide?13:8),giant?9:wide?12:5,z+11],look:[x,giant?3:1.4,z],fov:52},
      {t:duration*.52,pos:[x-6,giant?4.5:3.8,z+8],look:[x,giant?3:1.5,z],fov:46},
      {t:duration,pos:[x-4,giant?3:2.6,z+5.5],look:[x,giant?3.2:1.4,z],fov:43}],
    lines:dialogue.map((s,i)=>({start:.5+i*3.8,end:.5+(i+1)*3.8,who:s.split('|')[0],text:s.split('|')[1]}))};
}
