// Pequenas cenas sobre o cenário já carregado; IDs persistem no estado de história.
export const PASSAGES = {
  'porto>ruinas': { title:'A TRILHA DA ESCAVAÇÃO', text:'Pegadas recentes deixam o cais e seguem para o altar. A equipe da Tellus passou por aqui antes do silêncio.', hint:'Explore as ruínas e procure registros da expedição.' },
  'ruinas>lab': { title:'PORTÕES DA ESTAÇÃO', text:'Cabos e cercas ligam o sítio antigo ao laboratório. A tempestade deixou o complexo às escuras.', hint:'Siga o rádio e encontre uma forma de restaurar a energia.' },
  'lab>pantano': { title:'LINHA DE MANUTENÇÃO', text:'A tubulação sai do laboratório e desaparece na lama. O gerador reserva fica no fim da trilha.', hint:'O gerador faz barulho: prepare-se antes de ligá-lo.' },
  'lab>patio': { title:'O PÁTIO REATIVADO', text:'Com a energia de volta, as luzes revelam a cabine onde a Dra. Lima espera pelo resgate.', hint:'Encontre Lima e escolte-a até o terminal.' },
  'patio>heliponto': { title:'A PISTA NO PENHASCO', text:'O portão liberado leva à pista. Os destroços mostram que alguém tentou partir antes da equipe.', hint:'Observe os obstáculos e mantenha espaço para recuar.' },
  'heliponto>margem': { title:'RIO ABAIXO', text:'Além da pista, uma trilha acompanha a correnteza. Marcas de carga apontam para a margem.', hint:'Investigue o barco e siga os vestígios da Tellus-2.' },
  'margem>acampamento': { title:'ACAMPAMENTO TELLUS-2', text:'Pelo rio chegam ruídos de metal. A trilha termina nas cercas de uma operação abandonada.', hint:'Vasculhe o posto e encontre o controle do portão.' },
  'acampamento>ninho': { title:'A CRATERA', text:'Atrás da contenção, o calor sobe do chão. As marcas de transporte seguem para dentro da cratera.', hint:'Avance com cuidado e procure uma rota de saída.' },
};
export function passageFor(from, to, alreadyVisited, seen) {
  const id = `${from}>${to}`, scene = PASSAGES[id], key = `passage:${id}`;
  return scene && !alreadyVisited && !seen.has(key) ? { ...scene, key, duration:5.5 } : null;
}
export function advancePassage(elapsed, dt, duration, skip = false) {
  const time = Math.min(duration, Math.max(0, elapsed) + Math.max(0, dt));
  return { time, done: skip || time >= duration };
}
