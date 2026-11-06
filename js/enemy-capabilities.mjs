// A espécie visual segue o ATAQUE, nunca somente o nome/silhueta do spawn.
const KEYS=['spit','acid','ranged','variant','attackMode','abilities','attacks'];
const spitWord=s=>typeof s==='string'&&/(spit|acid|cuspid|dilo|ranged)/i.test(s);
const describesSpit=value=>typeof value==='string'?spitWord(value):Array.isArray(value)?value.some(v=>describesSpit(v)):!!value&&typeof value==='object'&&Object.entries(value).some(([k,v])=>(spitWord(k)&&!!v)||(['kind','type','mode','name'].includes(k)&&spitWord(v)));
export function canSpit(cfg={}) {
  return cfg.shape==='spitter'||!!cfg.spit||!!cfg.acid||!!cfg.ranged||spitWord(cfg.type)||spitWord(cfg.variant)||spitWord(cfg.attackMode)||describesSpit(cfg.abilities)||describesSpit(cfg.attacks);
}
export function abilityOverrides(source={}) {
  const result={};for(const input of [source.abilityOverrides,source])if(input)for(const key of KEYS)if(input[key]!==undefined)result[key]=structuredClone(input[key]);
  return result;
}
export function enemyConfig(base,spawn={}) {return {...base,...abilityOverrides(spawn)};}
