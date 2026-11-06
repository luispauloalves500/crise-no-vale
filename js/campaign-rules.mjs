import {abilityOverrides} from './enemy-capabilities.mjs';
// Fonte única das fronteiras de capítulos e do balanceamento (sem DOM/WebGL).
export const ACT_AREAS = Object.freeze({
  1: ['porto', 'ruinas', 'lab', 'pantano', 'patio', 'heliponto'],
  2: ['margem', 'acampamento', 'ninho'],
  3: ['portoanil', 'captacao', 'sede'],
  4: ['setorzero', 'raiz'],
});
export const actOf = id => Number(Object.keys(ACT_AREAS).find(k => ACT_AREAS[k].includes(id))) || 0;
export const currentAct = f => f.act4 ? 4 : f.act3 ? 3 : f.act2 ? 2 : 1;
export function canTravel(from, to, f) {
  const a = actOf(from), b = actOf(to);
  if (!a || !b || a !== currentAct(f)) return false;
  if (a === b) return true;
  return from === 'heliponto' && to === 'margem' && !!f.bossDead && !f.bossFight && !!f.heliCode && !!f.power;
}
export const canStartAct3 = f => !!(f.act2Win && f.nestClear && !f.nestFight && !f.act3);
export const canCompleteAct3 = f => !!(f.act3 && f.act2Win && f.nestClear && f.valvesClosed && f.primDead && ['expose', 'destroy'].includes(f.act3Choice));
export const canStartAct4 = f => !!(canCompleteAct3(f) && f.act3Resolved && !f.act4);
export const canFinishCampaign = f => !!(f.act4 && canCompleteAct3(f) && f.originKnown && f.originDead && f.act4Resolved && ['proof', 'quarantine'].includes(f.act4Choice));
// A mesma coordenada alimenta cenário, interação, radar e auditorias (sem ponto invisível).
export const extractionReady = (area, f) => area === 'portoanil' ? !!(f.act3Resolved && canStartAct4(f)) : area === 'setorzero' && !!(!f.act4Win && canFinishCampaign(f));
export const DIFFICULTIES = Object.freeze({
  easy: Object.freeze({ label: 'Fácil', damage: 0.65, enemyHP: 0.8, patrols: 0.65, ammo: 1.5 }),
  normal: Object.freeze({ label: 'Normal', damage: 1, enemyHP: 1, patrols: 1, ammo: 1 }),
  hard: Object.freeze({ label: 'Difícil', damage: 1.35, enemyHP: 1.25, patrols: 1.35, ammo: 0.7 }),
});
export const difficultyId = id => Object.hasOwn(DIFFICULTIES, id) ? id : 'normal';
export const difficultyProfile = id => DIFFICULTIES[difficultyId(id)];
export const ammoAmount = (n, id) => Math.max(0, Math.round(n * difficultyProfile(id).ammo));
export function patrolComposition(patrols, id) {
  if (!patrols.length) return [];
  const count = Math.max(1, Math.round(patrols.length * difficultyProfile(id).patrols));
  return Array.from({ length: count }, (_, i) => i < patrols.length ? patrols[i] : { ...patrols[i % patrols.length], x: undefined, z: undefined, hp: undefined, ambientIdx: undefined });
}
/** Salvos antigos são normalizados PELA área, nunca só por flags globais conflitantes. */
export function normalizeCampaignSave(raw) {
  if (!raw || typeof raw !== 'object' || !actOf(raw.area)) return null;
  const s = { ...raw, flags: { ...(raw.flags || {}) }, difficulty: difficultyId(raw.difficulty), st: { ...(raw.st || {}) }, enc: Array.isArray(raw.enc) ? [...raw.enc] : [] };
  const f = s.flags; f.cinematics={...(f.cinematics||{})}; let act = actOf(s.area);
  if (act === 4 && !canStartAct4({ ...f, act3Resolved:f.act3Resolved||!!(f.primDead&&f.valvesClosed&&['expose','destroy'].includes(f.act3Choice)), act4: false })) { s.area = 'portoanil'; s.at = null; act = 3; }
  // Um atalho falso do Ato 3 não pode pular a Matriarca/resgate.
  if (act === 3 && !(f.act2Win && (f.nestClear || (raw.v <= 6 && f.act3)))) {
    s.area = 'ninho'; s.at = null; act = 2;
    f.campGate = true; f.nestClear = false; f.act2Win = false;
    s.enc = s.enc.filter(id => id !== 'nest-awaken'); s.st.ninho = { visited: false, dead: [], taken: s.st.ninho?.taken || [], living: null, pending: [] };
  }
  f.act2 = act >= 2; f.act3 = act >= 3; f.act4 = act === 4;
  if (act >= 2) Object.assign(f, { power: true, heliCode: true, bossDead: true, act1Complete: true });
  if (act >= 3) Object.assign(f, { nestClear: true, act2Win: true, campGate: true, limaRescued: true });
  if (act < 3) for (const k of ['act3Banner','act3Win','act3Choice','act3Resolved','valvesClosed','primDead','primFight','contamT','contaminated','contamOk']) delete f[k];
  if (act < 4) for (const k of ['act4Banner','act4Win','act4Choice','act4Resolved','originKnown','originDead','originFight']) delete f[k];
  if (act === 1) {
    for (const k of ['campGate','nestClear','nestDestroyed','brandt','cagesReleased']) delete f[k];
    f.act1Complete = false; f.act2Win = false; f.rescued = false;
  }
  else f.rescued = !!f.act2Win;
  if(!['expose','destroy'].includes(f.act3Choice)||!f.primDead||!f.valvesClosed){delete f.act3Choice;f.act3Resolved=false;}
  else f.act3Resolved=true;
  const sceneActs={opening:1,act1:1,lima:1,act2:2,cages:2,act3:3,extraction:3,act4:4,brandt:4,tyrant:4,'ending-proof':4,'ending-quarantine':4};
  for(const id of Object.keys(f.cinematics))if((sceneActs[id]||99)>act)delete f.cinematics[id];
  // Saves que já resolveram o ninho não podem fazer Brandt preso/fugitivo reaparecer no acampamento.
  if (s.enc.includes('camp-brandt') && (f.brandt || f.nestClear || f.act2Win)) f.cagesReleased=true;
  // O evento antigo abria na chegada; sem a nova flag, rearmar para o gatilho jogável.
  if (!f.cagesReleased) {
    if (s.enc.includes('camp-brandt') && s.st.acampamento) s.st.acampamento={...s.st.acampamento,pending:[]};
    s.enc=s.enc.filter(id=>id!=='camp-brandt'&&id!=='camp-jaula');
  }
  // Memória de áreas futuras misturadas não pode pular gatilhos na próxima etapa.
  for (const id of Object.keys(s.st)) if (actOf(id) > act) delete s.st[id];
  // Recarregar uma decisão antiga retoma a fuga, sem disparar vitória incompleta.
  if(act===4&&f.originDead)f.originKnown=true;
  if(act===4&&!f.originDead){f.originKnown=false;s.enc=s.enc.filter(id=>id!=='zero-awaken');if(s.st.raiz)s.st.raiz={...s.st.raiz,living:(s.st.raiz.living||[]).filter(e=>e.type!=='origin'),pending:[]};}
  if(act===4&&(!f.originDead||!['proof','quarantine'].includes(f.act4Choice))){f.act4Resolved=false;delete f.act4Choice;}
  f.act3Win = act === 4; f.act4Win = false; f.bossFight = f.nestFight = f.primFight = f.originFight = false;
  return s;
}

// Jaulas: uma liberação persistente por campanha. Só patrulhas ambientais renovam.
export const CAGE_OPEN_SECONDS = 1.6;
export function cageReleaseWave(cages, difficulty) {
  if(!cages.length)return [];
  const count=Math.max(1,Math.round(cages.length*difficultyProfile(difficulty).patrols));
  return Array.from({length:count},(_,i)=>{
    const c=cages[i%cages.length],w=c.big?5:3.6,extra=Math.floor(i/cages.length),z=c.z+(extra ? .65 : 0);
    return {...abilityOverrides(c),type:c.type||(c.big?'brute':'raptor'),x:c.x,z,delay:.20+i*.35,cageRelease:true,
      cageExit:{x:c.x+c.face*(w/2+1.9),z}};
  });
}
export function cageGatePose(progress, height) {
  const p=Math.min(1,Math.max(0,progress)),y=(height+.2)*p*p*(3-2*p);
  return {y,blocking:y<height*.88};
}
