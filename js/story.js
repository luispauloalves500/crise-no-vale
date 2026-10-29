// story.js — roteiro original de "Crise no Vale": registros (logs), cartões de história,
// falas/legendas (rádio) e epílogo variável. Só texto + DOM; quem decide QUANDO é o director.js.
import { $ } from './utils.js';
import { G } from './state.js';
import { sfx } from './audio.js';
import { clearInput, lockPointer, unlockPointer } from './input.js';

/* ============================================================
 *  LORE (resumo para quem mantém o código)
 *  Estação de Pesquisa Vale Verde, da Fundação Tellus. Sob o altar das ruínas, uma câmara selada guardava
 *  âmbar com DNA pré-histórico (Projeto RAIZ). O composto V-7 acelera o crescimento, mas apaga o medo
 *  e faz os animais seguirem barulho. O Espécime Zero — o "Colosso" — cresceu demais.
 *  O diretor Otávio Brandt, com inspeção do governo chegando, mandou retirar o fusível de partida
 *  automática do gerador: na tempestade a energia caiu, as cercas desligaram e os animais escaparam.
 *  Ele trocou as senhas do heliponto e tentou fugir com amostras; o Colosso derrubou o helicóptero.
 *  A agente Marina Rocha (Grupo de Resgate Ambiental) atende o pedido de socorro da Dra. Helena Lima.
 * ============================================================ */

export const SPEAKERS = {
  ROCHA: { name: 'Rocha', col: '#9fd0ff' },
  LIMA: { name: 'Dra. Lima', col: '#7dffb0' },
  PILOTO: { name: 'Garça-1', col: '#ffd27a' },
  BRANDT: { name: 'Brandt', col: '#ff8a70' },
  RADIO: { name: 'Rádio', col: '#b8c4c0' },
};

export const LOGS = {
  log1: {
    area: 'porto', title: 'MANIFESTO DE CARGA Nº 88', who: 'Joel Pacheco — estivador da Fundação Tellus',
    pages: [
      'Entrada: 12 caixas refrigeradas, rótulo "V-7 — NÃO AGITAR". Destino: laboratório Vale Verde.\nSaída: 3 caixas lacradas, rótulo "AMOSTRAS RAIZ". Destino: ninguém me disse. O diretor Brandt veio buscar pessoalmente, de helicóptero.',
      'Observação minha, fora do formulário: as caixas de saída arranhavam por dentro.\nPedi transferência para o continente. O barco da estação não sai mais do píer — mandaram afundar o casco "até a inspeção passar". Ninguém vai embora antes da hora.',
    ],
  },
  log2: {
    area: 'ruinas', title: 'CADERNO DE CAMPO — SÍTIO 3', who: 'Prof.ª Inês Caldeira — arqueóloga',
    pages: [
      'Sob o altar encontramos uma câmara selada há séculos. Lá dentro, resina fossilizada — âmbar — com insetos e sangue preservados.\nA Fundação Tellus mandou isolar tudo no mesmo dia e batizou o projeto de RAIZ.',
      'As paredes da câmara têm entalhes: pessoas fugindo de um animal do tamanho de uma casa, e um aviso repetido — "não acorde o que dorme na pedra".\nO diretor Brandt riu e disse que mito não paga as contas da estação. Eu não rio mais.',
    ],
  },
  log3: {
    area: 'lab', title: 'DIÁRIO — DIA 212', who: 'Dra. Helena Lima — geneticista',
    pages: [
      'Conseguimos. Com o DNA do âmbar e o composto V-7, os embriões crescem em semanas, não em anos.\nMas o V-7 tem um efeito colateral: apaga o medo. Os animais não recuam diante de nada.',
      'Pior: eles são atraídos por barulho — tiros, motores, alarmes. Avisei o diretor que o projeto precisava parar.\nEle me tirou da equipe do Espécime Zero, o que os guardas chamam de "Colosso". Ele já pesa seis toneladas.',
    ],
  },
  log4: {
    area: 'pantano', title: 'ORDEM DE SERVIÇO Nº 417', who: 'Técnico R. Alves — manutenção',
    pages: [
      'Serviço: retirar o fusível de partida automática do gerador reserva.\nAutorizado por: O. Brandt, diretor.\nMotivo informado: "economia de combustível".',
      'Nota do técnico: sem esse fusível, se a subestação cair, as cercas elétricas desligam e o gerador só liga na mão, aqui no pântano.\nDeixei o procedimento colado no painel. Se a tempestade vier, que Deus ajude quem estiver lá dentro.',
    ],
  },
  log5: {
    area: 'lab', title: 'GRAVAÇÃO PARTICULAR', who: 'Otávio Brandt — diretor da estação',
    pages: [
      'Os inspetores do governo chegam na sexta. Se virem o RAIZ, a Tellus acaba e eu vou junto.\nA tempestade é a minha chance: a energia cai, as cercas caem e os animais fazem o resto. Um acidente da natureza. Ninguém investiga um acidente.',
      'Troquei as senhas do portão do heliponto. Só eu saio daqui — com as três caixas de amostras.\nA Lima fica. Ela que conte a versão dela para os bichos.',
    ],
  },
  log6: {
    area: 'patio', title: 'RELATÓRIO DE SEGURANÇA', who: 'Sgt. Dário Mendes — chefe da guarda',
    pages: [
      'O Espécime Zero rompeu a jaula do penhasco às 02h10. Bala comum mal entra no couro.\nMas notei uma coisa: quando ele investe e bate em concreto, fica atordoado por alguns segundos. É aí que o couro cede.',
      'Ordem a quem sobrar: atraiam o bicho contra as paredes e descarreguem tudo enquanto ele estiver tonto.\nQuando se fere, ele chama a matilha. Não fiquem parados no meio da pista.',
    ],
  },
  log7: {
    area: 'heliponto', title: 'GRAVADOR DE VOO — ÚLTIMOS SEGUNDOS', who: 'Helicóptero da diretoria',
    pages: [
      '[BRANDT] Decola, decola! As caixas estão a bordo, esquece o resto!\n[PILOTO] Tem alguma coisa na pista, senhor — meu Deus, o tamanho disso...\n[BRANDT] Eu disse DECOLA!',
      '[impacto] [alarme do rotor] [estática]\n\nAs três caixas de amostras não estão nos destroços. Marcas enormes de garras levam até a borda do penhasco.',
    ],
  },
  // ---------- v6: dois registros fora da estação — o que aconteceu com as caixas ----------
  log8: {
    area: 'pantano', title: 'CAIXA RAIZ-3 — MARGEM DO RIO', who: 'Etiqueta de transporte e anotação a caneta',
    pages: [
      'Etiqueta: "LOTE RAIZ-3 — MANTER REFRIGERADO — NÃO ABRIR SEM AUTORIZAÇÃO DO DIRETOR".\nA tampa foi arrancada de dentro para fora. O isopor está rasgado em tiras, e há pegadas pequenas, de três dedos, descendo para a água.',
      'Anotação a caneta no verso, letra tremida: "Caiu do helicóptero na curva do rio. Fui buscar. Não era só amostra. Eram ovos.\nOs rastreadores das caixas 1 e 2 ainda dão sinal — descendo o rio, uns três quilômetros por dia. Na direção de Porto Anil."',
    ],
  },
  log9: {
    area: 'heliponto', title: 'RÁDIO DE CAMPO — TELLUS-2', who: 'Equipe de recuperação da Fundação Tellus',
    pages: [
      '[gravação automática] Tellus-2 para a base. Chegamos ao penhasco antes do resgate. O helicóptero do Brandt já era.\nRecuperamos o gravador de voo? Negativo. Prioridade continua sendo as caixas 1 e 2. A estação será lacrada como "acidente natural".',
      '[gravação automática] Base para Tellus-2: as caixas seguem o rio até a captação de água de Porto Anil. Recuperem antes que alguém da cidade abra.\nSobre a agente do resgate e a doutora: não são problema nosso. Ainda.\n\n(O rádio ainda tem bateria. O canal aberto alcança a costa inteira.)',
    ],
  },
  // ---------- v7: Ato 2 — rio abaixo ----------
  log10: {
    area: 'margem', title: 'RELATÓRIO DE RECUPERAÇÃO — TELLUS-2', who: 'Cabo Ítalo Reis — equipe de recuperação',
    pages: [
      'Barco encalhado na margem depois da corredeira. Motor queimado. Caixa RAIZ-1 recuperada... e aberta. O lacre foi cortado com faca, não com garra.\nA caixa RAIZ-2 seguiu com a equipe até o acampamento.',
      'Achamos um sobrevivente do helicóptero: terno rasgado, gravata, uma maleta que ele não larga por nada. Diz que é o diretor da estação.\nO Brandt sobreviveu. Ordem da base: levar ele vivo para o acampamento. Não sei por quê.',
    ],
  },
  log11: {
    area: 'acampamento', title: 'ORDEM DO CONSELHO — CONFIDENCIAL', who: 'Conselho da Fundação Tellus',
    pages: [
      'Prioridade 1: os ovos do lote RAIZ-2 devem chegar vivos à sede. Prioridade 2: o diretor Otávio Brandt é um ativo — ele conhece a fórmula do crescimento acelerado.',
      'Prioridade 3: nenhuma testemunha. A agente do resgate e a Dra. Lima não podem chegar à costa com provas.\nSe a contenção falhar no acampamento, abandonem o local e apaguem os registros.',
    ],
  },
  log12: {
    area: 'acampamento', title: 'TABLET DO BRANDT', who: 'Anotações pessoais — Otávio Brandt',
    pages: [
      'Os idiotas da Tellus-2 deixaram a caixa 3 no calor do gerador. Os ovos chocaram em dois dias. A mãe veio buscar as crias — eu vi o tamanho dela.\nEla fez ninho na cratera ao sul. Chamam de Matriarca.',
      'Plano: ofereço os ovos do ninho ao conselho em troca da minha liberdade e de uma conta no exterior. O barco da equipe está no cais do ninho, com tanque cheio.\nSenha do portão sul trocada. Que a matilha cuide de quem vier atrás.',
    ],
  },
  log13: {
    area: 'ninho', title: 'CÂMERA DE CAMPO — CRATERA', who: 'Registro automático da câmera 4',
    pages: [
      '[02h40] Equipe Tellus-2 entra na cratera com redes e caixas térmicas.\n[02h43] Movimento grande na água. [02h44] Gritos. [02h47] Sinal das lanternas perdido.',
      '[contagem automática] Cerca de quarenta ovos no monte central, todos quentes.\nA captação de água de Porto Anil fica 12 km rio abaixo. A cratera transborda a cada cheia.',
    ],
  },
};
export const LOG_IDS = Object.keys(LOGS);
/** v7: o Ato 1 (vale) tem 9 registros; o Ato 2 (rio abaixo) mais 4. */
export const ACT1_LOGS = ['log1', 'log2', 'log3', 'log4', 'log5', 'log6', 'log7', 'log8', 'log9'];
export const ACT2_LOGS = ['log10', 'log11', 'log12', 'log13'];
/** v6: os 7 registros originais da estação (o caminho de 7 continua valendo para o epílogo "Rio abaixo"). */
export const STATION_LOGS = ['log1', 'log2', 'log3', 'log4', 'log5', 'log6', 'log7'];
export const TOTAL_LOGS = LOG_IDS.length;

// estado da história (vai no save)
export const S = { logs: new Set(), said: new Set() };
export function resetStory(saved) { S.logs = new Set((saved && saved.logs) || []); S.said = new Set((saved && saved.said) || []); clearSpeech(); }
export const storySave = () => ({ logs: [...S.logs], said: [...S.said] });

// ---------- falas ----------
const R = true; // marca de rádio
export const LINES = {
  enter_porto: [['RADIO', '...chiado... Garça-1 em espera na base costeira. Sem condições de voo até a tempestade passar...', R], ['ROCHA', 'Ótimo. Sem barco, sem helicóptero. Só eu e o vale.']],
  enter_ruinas: [['ROCHA', 'Essas pedras foram escavadas há pouco tempo. Alguém mexeu no altar.']],
  enter_lab: [['LIMA', 'Alguém aí? Vi uma lanterna nas câmeras do laboratório!', R], ['ROCHA', 'Dra. Lima? Agente Rocha, do resgate. Onde a senhora está?'],
    ['LIMA', 'Presa na cabine da guarda, no pátio. O portão norte está sem energia. O gerador reserva fica no pântano, a oeste.', R]],
  enter_pantano: [['LIMA', 'O gerador não liga sozinho... alguém tirou o fusível automático. Você vai ter que ligar na mão — e o barulho vai chamar a matilha.', R]],
  enter_patio: [['LIMA', 'Estou vendo você pela janela! Canto sudoeste do pátio, depressa!', R]],
  enter_heliponto: [['ROCHA', 'O helicóptero do diretor... alguém tentou fugir daqui.']],
  power_after: [['LIMA', 'As luzes do pátio acenderam! Venha pelo portão norte do laboratório.', R]],
  greet: [['LIMA', 'Graças a Deus. Achei que ninguém viria.'], ['ROCHA', 'Consegue andar? O heliponto está trancado.'],
    ['LIMA', 'O Brandt trocou as senhas, mas eu escrevi aquele sistema. O terminal de controle fica no nordeste. Me cubra.']],
  code_start: [['LIMA', 'Senha nova... claro, a data de fundação da Tellus. Me dê alguns segundos.']],
  boss_start: [['ROCHA', 'Então esse é o Colosso...'], ['LIMA', 'Rocha! Faça ele bater nas paredes — é o único jeito de ferir o couro!', R]],
  boss_phase1: [['LIMA', 'Ele está chamando a matilha! Cuidado com os flancos!', R]],
  boss_phase2: [['LIMA', 'Ele está fraco, mas furioso! Não pare agora!', R]],
  boss_dead: [['ROCHA', 'Acabou, grandão.'], ['LIMA', 'Você conseguiu?! Fique na marca H e acenda o sinalizador. Já chamei o Garça-1!', R]],
  rescue_start: [['PILOTO', 'Garça-1 para solo: a tempestade abriu, vemos seu sinalizador. Aguentem firme!', R]],
  rescue_mid: [['PILOTO', 'Muito movimento na mata! Mantenham a pista limpa!', R]],
  rescue_near: [['PILOTO', 'Doutora a bordo! Aproximação final — vamos buscar você!', R]],
  lima_down: [['LIMA', 'Ai! Me ajude, eles estão em cima de mim!']],
  log5: [['ROCHA', 'O Brandt derrubou a energia de propósito... Isso aqui é prova.']],
  log4: [['ROCHA', 'Tiraram o fusível... a queda de energia não foi acidente.']],
  log7: [['ROCHA', 'As caixas de amostras sumiram. Para onde?']],
  // ---------- v5 ----------
  lockdown: [['RADIO', 'ALERTA: acesso não autorizado à sala da diretoria. Protocolo de contenção ativado.', R],
    ['BRANDT', '(gravação) Se você está ouvindo isto, mexeu no que não devia. Fique à vontade — a matilha já está a caminho.', R],
    ['ROCHA', 'Uma armadilha... ele trancou a própria sala.'],
    ['LIMA', 'Rocha, a sirene da diretoria está tocando no laboratório inteiro! Eles vão esperar você na porta!', R]],
  lockdown_open: [['ROCHA', 'Lá vêm eles. Bem-vindos.']],
  // ---------- v7: Ato 2 ----------
  act2_offer: [['LIMA', 'Rocha... achei pegadas de sapato social descendo para o rio pelo portão leste. O Brandt está vivo!', R],
    ['LIMA', 'Se quiser ir atrás dele, eu fico aqui com o rádio. O Garça-1 pode te buscar rio abaixo.', R]],
  enter_margem: [['ROCHA', 'Rio cheio, barranco podre... e um barco da Tellus-2 encalhado.'], ['LIMA', 'Cuidado com o lodo da margem. Eles chocam no quente.', R]],
  brandt_glimpse: [['ROCHA', 'Brandt! Parado!'], ['BRANDT', 'Você de novo? Vá embora, agente. Isto aqui é maior que nós dois!']],
  enter_acampamento: [['ROCHA', 'O acampamento da Tellus-2. Ninguém de pé.'], ['LIMA', 'Jaulas de contenção... Rocha, se elas abrirem, saia do meio!', R]],
  brandt_camp: [['BRANDT', 'Quer me prender? Então primeiro sobreviva aos meus bichinhos!']],
  hack_start: [['LIMA', 'É o mesmo sistema do heliponto. Leve o terminal até o fim — a sirene vai chamar todo mundo!', R]],
  brandt_taunt: [['BRANDT', '(rádio) A cratera é minha garantia, agente. Ninguém toca nos ovos!', R], ['ROCHA', 'Veremos.']],
  enter_ninho: [['ROCHA', 'Uma cratera inteira de ovos... está quente aqui dentro.']],
  nest_brandt: [['BRANDT', 'Pare aí! Um passo e eu acordo a mãe!'], ['ROCHA', 'Brandt, larga esse sinalizador—'], ['BRANDT', 'Tarde demais!']],
  nest_start: [['ROCHA', 'Então essa é a Matriarca...'], ['LIMA', 'Os pilares de pedra! Faça ela bater neles, como o Colosso!', R]],
  nest_phase1: [['LIMA', 'Os ovos estão chocando! Ela chama as crias!', R]],
  nest_phase2: [['ROCHA', 'Ela não desiste... nem eu.']],
  nest_clear: [['LIMA', 'Ela caiu?! Rocha, o Brandt está no cais — o barco tem tanque cheio!', R]],
  brandt_caught: [['ROCHA', 'Otávio Brandt, você está preso.'], ['BRANDT', 'Você não sabe com quem está mexendo...'], ['ROCHA', 'Sei. Por isso mesmo.']],
  brandt_escaped: [['ROCHA', 'Droga! Ele escapou rio abaixo...'], ['LIMA', 'Ainda dá para salvar o resto. Chame o Garça-1!', R]],
  charges: [['ROCHA', 'Cargas da Tellus-2. Hora de usar para alguma coisa boa.']],
  charges_done: [['LIMA', 'Que estrondo! Os ovos... acabou?', R], ['ROCHA', 'Acabou. Porto Anil vai beber água limpa.']],
  rescue2_start: [['PILOTO', 'Garça-1 rio abaixo! A Dra. Lima está a bordo, vemos seu sinalizador na clareira!', R]],
  rescue2_mid: [['PILOTO', 'A cratera está fervendo de movimento! Segurem a clareira!', R]],
  log10: [['ROCHA', 'O Brandt sobreviveu à queda... e a Tellus quer ele vivo.']],
  log11: [['ROCHA', '"Nenhuma testemunha." Que gentileza.']],
  log12: [['ROCHA', 'Ovos em troca de liberdade. Ele vai vender o rio inteiro.']],
  log13: [['ROCHA', 'Quarenta ovos, doze quilômetros da cidade. Não dá para deixar isso aqui.']],
  mud: [['LIMA', 'Eles fazem ninho no lodo quente do pântano. Evite o meio das poças!', R]],
  // v6
  log8: [['ROCHA', 'Ovos... e duas caixas descendo o rio. Isso não acabou no vale.']],
  log9: [['ROCHA', 'A Tellus vai enterrar tudo. A não ser que alguém ouça isto antes.']],
  broadcast: [['ROCHA', 'A todos na frequência aberta: aqui é a agente Marina Rocha, do Grupo de Resgate Ambiental. Vou ler as provas.', R],
    ['RADIO', '...chiado... Capitania de Porto Anil, recebido. Repita a parte das caixas no rio...', R],
    ['LIMA', 'Agora é público. A Tellus não consegue mais apagar isso.', R]],
  intercept: [['RADIO', '...chiado... Tellus-2 para a base: achamos uma caixa RAIZ na margem do rio. Vazia. Arranhada por dentro.', R],
    ['RADIO', '...As outras duas seguiram correnteza abaixo. Ordem do conselho: o nome do Brandt não entra no relatório.', R],
    ['ROCHA', 'Doutora, ouviu isso? A Tellus já está no vale.'],
    ['LIMA', 'Ouvi. Gravei tudo. Agora ninguém vai dizer que o Brandt agiu sozinho.', R]],
};
export const BARKS = [
  'Fique perto de mim!', 'Ouvi alguma coisa nos galpões...', 'Eu ajudei a criar esses animais. Nunca pensei que teria medo deles.',
  'O V-7 tirou o medo deles. Não perca o seu.', 'Falta pouco. O terminal fica depois da fonte.', 'Cuidado com o barulho — os tiros atraem a matilha.',
];
export const POST_CODE = [
  'Vá. O Colosso fica perto da pista — use as paredes.', 'Se achar os registros do Brandt, guarde. Isso é prova.',
  'Eu seguro o portão. Não se preocupe comigo.', 'Quando tudo acabar, eu vou contar tudo. Tudo.',
];

// ---------- legendas (fila) ----------
const sp = $('speech'); let queue = [], cur = null, curT = 0;
/** Enfileira falas. key evita repetir (fica no save); replace descarta falas antigas ainda na fila. */
export function say(lines, key, replace = false) {
  if (key) { if (S.said.has(key)) return false; S.said.add(key); }
  if (replace) queue = [];
  for (const l of lines) queue.push(l);
  while (queue.length > 5) queue.shift();   // a legenda nunca fica atrasada em relação ao jogo
  return true;
}
export function sayOne(who, text, radio = false) { queue.push([who, text, radio]); }
export const speaking = () => !!cur || queue.length > 0;
export function clearSpeech() { queue = []; cur = null; if (sp) { sp.style.opacity = 0; sp.innerHTML = ''; } }
function nextLine() {
  cur = queue.shift();
  const [who, text, radio] = cur; const s = SPEAKERS[who] || SPEAKERS.RADIO;
  curT = Math.min(7, 2.2 + text.length * 0.055);
  sp.innerHTML = `${radio ? '<span class="radio">📻</span>' : ''}<b style="color:${s.col}">${s.name}:</b> ${text}`;
  sp.classList.toggle('radio', !!radio); sp.style.opacity = 1;
  if (radio && sfx.radio) sfx.radio();
}

// ---------- cartões de história ----------
const el = { root: $('story'), kicker: $('stKicker'), title: $('stTitle'), who: $('stWho'), body: $('stBody'), foot: $('stFoot') };
let card = null;
/**
 * Mostra páginas de história (o jogo congela em G.state='story').
 * page: {kicker, title, who, text}
 * opts: {full: fundo opaco (intro/epílogo), cinematic: câmera orbitando}
 */
export function showCard(pages, onClose, opts = {}) {
  if (card) { const prev = card.onClose; card.onClose = () => { prev && prev(); showCard(pages, onClose, opts); }; return; }
  card = { pages, i: 0, ch: 0, t: 0, onClose, prev: G.state, opts };
  G.state = 'story'; clearInput(); unlockPointer();
  el.root.classList.add('on'); el.root.classList.toggle('full', !!opts.full);
  showPage();
}
export const cardOpen = () => !!card;
export const cinematic = () => !!(card && card.opts.cinematic);
function showPage() {
  const p = card.pages[card.i];
  el.kicker.textContent = p.kicker || ''; el.title.textContent = p.title || ''; el.who.textContent = p.who || '';
  el.body.textContent = ''; card.ch = 0; card.t = 0;
  el.foot.textContent = `${card.i + 1}/${card.pages.length} • Clique ou Espaço para continuar • Enter pula`;
  if (p.radio && sfx.radio) sfx.radio();
}
export function advanceCard() {
  if (!card || card.t < 0.2) return;
  const txt = card.pages[card.i].text;
  if (card.ch < txt.length) { card.ch = txt.length; el.body.textContent = txt; return; }
  if (++card.i < card.pages.length) showPage(); else closeCard();
}
export function skipCard() { if (card && card.t > 0.2) closeCard(); }
function closeCard() {
  const c = card; card = null;
  el.root.classList.remove('on', 'full');
  G.state = c.prev === 'story' ? 'play' : c.prev; clearInput();
  if (G.state === 'play') lockPointer();
  if (c.onClose) c.onClose();
}

export function updateStory(dt) {
  if (card) {
    card.t += dt;
    const txt = card.pages[card.i].text;
    if (card.ch < txt.length) {
      const before = Math.floor(card.ch); card.ch = Math.min(txt.length, card.ch + dt * 70);
      if (Math.floor(card.ch) !== before) el.body.textContent = txt.slice(0, Math.floor(card.ch));
    }
    return;
  }
  if (G.state !== 'play' && G.state !== 'win') return;
  if (cur) { curT -= dt; if (curT <= 0) { cur = null; sp.style.opacity = 0; } }
  else if (queue.length) nextLine();
}

// ---------- roteiros ----------
export const INTRO = [
  { kicker: 'VALE VERDE — 03h40', title: 'CRISE NO VALE', text: 'Há três dias, um pedido de socorro saiu da Estação de Pesquisa Vale Verde, uma base isolada da Fundação Tellus no meio da selva. Depois, silêncio.\nA tempestade derrubou as comunicações. Nenhum avião consegue pousar. Mandaram um barco — e mandaram você.' },
  { kicker: 'RÁDIO — CANAL 4', title: 'PEDIDO DE SOCORRO', who: 'Dra. Helena Lima', radio: true, text: '[estática] ...aqui é a Dra. Helena Lima, Vale Verde... a energia caiu, as cercas... eles estão soltos... estou no pátio, perto do heliponto... por favor... [estática]' },
  { kicker: 'AGENTE MARINA ROCHA', title: 'GRUPO DE RESGATE AMBIENTAL', text: 'O piloto do barco viu olhos brilhando entre as árvores do cais e não esperou nem eu firmar o pé no píer. Agora a única saída é o heliponto, no penhasco ao norte.\nMissão: encontrar a Dra. Lima, descobrir o que aconteceu aqui e chamar o resgate — prefixo Garça-1.' },
  { kicker: 'OBJETIVO', title: 'ENTRE NA ESTAÇÃO', text: 'Atravesse as ruínas até o laboratório.\nTerminais verdes salvam o jogo. Tablets com tela azul guardam registros da equipe — aperte E para ler.\nCuidado: barulho atrai a matilha.' },
];
export const BEATS = {
  power: [{ kicker: 'GERADOR RESERVA', title: 'AS LUZES DO VALE', text: 'O gerador ruge e, um a um, os postes da estação voltam a acender. As janelas do laboratório se iluminam pela primeira vez em três dias.\nNo rádio, a Dra. Lima solta o ar: "Você conseguiu! O portão norte do laboratório destravou... e a porta da diretoria também. Se passar por lá, olhe a sala do Brandt. Eu sempre quis saber o que ele escondia."' }],
  code: [{ kicker: 'TERMINAL DE CONTROLE', title: 'A PORTA DOS FUNDOS', who: 'Dra. Helena Lima', text: 'Lima digita rápido, sem olhar para o teclado. "O Brandt trocou todas as senhas do heliponto... mas fui eu que escrevi este sistema. Ele nunca soube da porta dos fundos."\nO portão leste destrava com um estalo. "Vá na frente, eu seguro o portão daqui. E, Rocha... o Colosso está lá em cima. Não deixe ele te encurralar no meio da pista."' }],
  // v7
  camp_gate: [{ kicker: 'ACAMPAMENTO TELLUS-2', title: 'O RASTRO DO DIRETOR', text: 'O portão sul destrava. Além dele, uma trilha de lama sobe até a borda de uma cratera fumegante — e, nela, as pegadas de sapato social do Brandt, uma maleta arrastada e marcas de garras enormes.\nO rádio chia: "Rocha, a Tellus-2 chamava aquilo de ninho. Ninguém de lá voltou."' }],
  nest: [{ kicker: 'A CRATERA', title: 'O NINHO', text: 'Quarenta ovos brilham no monte central, pulsando como brasa verde. Brandt está entre eles, de terno rasgado, com um sinalizador aceso na mão.\nAtrás dele, a água da cratera se mexe. Algo enorme estava dormindo ali.' }],
  boss: [{ kicker: 'HELIPONTO', title: 'ESPÉCIME ZERO', text: 'Os destroços do helicóptero do diretor ainda queimam. Entre a fumaça e a chuva, algo do tamanho de um caminhão se levanta.\nO Colosso. Seis toneladas sem medo nenhum — e tudo o que faz barulho é presa.' }],
};
/** v7: cartão de abertura do Ato 2 (primeira vez na margem). */
export const ACT2_INTRO = [
  { kicker: 'ATO 2', title: 'RIO ABAIXO', text: 'O portão leste dá para uma trilha escorregadia que desce o penhasco até o rio. A Dra. Lima ficou no heliponto com o rádio: o Garça-1 só pode buscar você mais abaixo, longe do penhasco.\nNo barro da margem, pegadas de sapato social. O Brandt está vivo — e tem pressa.' },
  { kicker: 'OBJETIVO', title: 'ALCANCE O BRANDT', text: 'Siga o rio para o sul: a margem, o acampamento da equipe Tellus-2 e, depois dele, a cratera que eles chamavam de ninho.\nLeia os registros do caminho — há quatro novos — e decida o que fazer com o que restou do Projeto RAIZ.' },
];
/** v7: finais do Ato 2 (resgate na clareira do ninho). */
function epilogueAct2(F) {
  const caught = F.brandt === 'caught', burnt = !!F.nestDestroyed, n2 = ACT2_LOGS.filter((id) => S.logs.has(id)).length;
  const pages = [{ kicker: 'GARÇA-1 — CLAREIRA DO NINHO', title: 'A CRATERA FICA PARA TRÁS', text: 'O Garça-1 sobe por cima da cratera fumegante. A Dra. Lima puxa Rocha para dentro pela porta lateral.\n' + (caught ? 'Algemado no banco de trás, Otávio Brandt não diz uma palavra.' : '"E o Brandt?" Rocha olha para o rio. O barco já virou uma mancha na neblina.') }];
  if (caught) pages.push({ kicker: 'UM MÊS DEPOIS', title: 'O DIRETOR DEPÕE', text: 'Diante dos inspetores, com a maleta de amostras sobre a mesa, Brandt entrega o conselho inteiro da Fundação Tellus para salvar a própria pele.' + (n2 >= 2 ? '\nA ordem do conselho e o tablet do diretor confirmam cada palavra.' : '') });
  else pages.push({ kicker: 'UM MÊS DEPOIS', title: 'UMA CONTA NO EXTERIOR', text: 'Uma maleta de amostras é vendida num leilão fechado do outro lado do oceano. O comprador nunca é identificado.\nO nome de Otávio Brandt some de todos os registros da Tellus.' });
  if (burnt) pages.push({ kicker: 'PORTO ANIL — AMANHECER', title: 'ÁGUA LIMPA', text: 'A cheia de março passa pela cratera e não leva nada além de cinzas. A captação de Porto Anil funciona normalmente — e, desta vez, isso é uma boa notícia.' });
  else pages.push({ kicker: 'PORTO ANIL — MARÇO', title: 'A CHEIA', text: 'A cheia de março transborda a cratera. Doze quilômetros rio abaixo, a captação de Porto Anil entope com algo que ninguém sabe explicar.\n(Os ovos podiam ter sido destruídos: as cargas da Tellus-2 estavam no ninho.)' });
  const T = caught && burnt ? 'FIM DO PROJETO RAIZ' : caught ? 'JUSTIÇA RIO ABAIXO' : burnt ? 'CINZAS DO NINHO' : 'O RIO GUARDA SEGREDOS';
  const tail = { 'FIM DO PROJETO RAIZ': 'O diretor preso, o ninho em cinzas. Pela primeira vez, a Fundação Tellus não tem mais nada para esconder — nem onde esconder.', 'JUSTIÇA RIO ABAIXO': 'O culpado responde pelo que fez. Mas, na cratera, alguma coisa ainda está quente.', 'CINZAS DO NINHO': 'O ninho acabou. O homem que o vendeu, não.', 'O RIO GUARDA SEGREDOS': 'Rocha saiu viva do vale. O resto, o rio levou.' }[T];
  pages.push({ kicker: `FINAL DO ATO 2 • REGISTROS ${S.logs.size}/${TOTAL_LOGS}`, title: T, text: tail + (S.logs.size < TOTAL_LOGS ? '\n(Ainda há registros pelo caminho para completar a história.)' : '\nArquivo completo: todos os 13 registros.') });
  return pages;
}
export function epilogue(F = {}) {
  if (F.act2Win) return epilogueAct2(F);
  // v7: os finais do Ato 1 contam só os 9 registros do vale
  const n = ACT1_LOGS.filter((id) => S.logs.has(id)).length, proof = S.logs.has('log5') && S.logs.has('log4');
  const pages = [{ kicker: 'GARÇA-1 — DECOLAGEM', title: 'O VALE FICA PARA TRÁS', text: 'O helicóptero sobe através da chuva. Lá embaixo, os holofotes do pátio piscam uma última vez e o vale some na neblina.\nA Dra. Lima aperta o tablet contra o peito. "Ninguém vai acreditar no que aconteceu aqui."' }];
  if (proof) pages.push({ kicker: 'UMA SEMANA DEPOIS', title: 'A VERDADE', text: 'Desta vez, acreditaram. A gravação de Brandt e a ordem de serviço do fusível chegam aos inspetores do governo.\nA Fundação Tellus é investigada, o Projeto RAIZ é encerrado e a estação é lacrada.\nO corpo de Otávio Brandt nunca foi encontrado.' });
  else if (S.logs.has('log5')) pages.push({ kicker: 'UMA SEMANA DEPOIS', title: 'MEIA VERDADE', text: 'A gravação de Brandt vira manchete, mas a Tellus diz que ele agiu sozinho e que a queda de energia foi acidente.\nSem a ordem de serviço do fusível, ninguém mais responde. O Projeto RAIZ "é encerrado" — no papel.' });
  else pages.push({ kicker: 'UMA SEMANA DEPOIS', title: 'VERSÃO OFICIAL', text: 'Sem provas, o relatório da Tellus fala em "acidente natural causado pela tempestade". O diretor Otávio Brandt é dado como desaparecido.\nO Projeto RAIZ muda de nome e de endereço.\n(As provas estavam pelo caminho: procure os registros do diretor e da manutenção.)' });
  if (S.said.has('intercept')) pages.push({ kicker: 'RÁDIO INTERCEPTADO', title: 'TELLUS-2', who: 'Gravação da Dra. Lima', radio: true, text: '"...achamos uma caixa RAIZ na margem do rio. Vazia. Arranhada por dentro... o nome do Brandt não entra no relatório."\nA gravação da Dra. Lima vai junto com o resto das provas. A Fundação Tellus nega que tivesse uma equipe no vale.' });
  const station = STATION_LOGS.every((id) => S.logs.has(id));
  if (n === ACT1_LOGS.length) {
    // v6: final alternativo — com os 9 registros, o Garça-1 não volta para a costa: segue o rio
    pages.push({ kicker: `ARQUIVO COMPLETO • ${n}/${ACT1_LOGS.length}`, title: 'A FUGA DO VALE', text: 'Lima espalha os registros no colo: o manifesto, o diário, a ordem do fusível, a gravação do Brandt, a etiqueta da caixa RAIZ-3, o rádio da Tellus-2.\n"Eles não estão fugindo do vale, Rocha. Eles estão descendo o rio."' });
    pages.push({ kicker: 'GARÇA-1 — DESVIO DE ROTA', title: 'CORRENTEZA', who: 'Agente Marina Rocha', text: 'O piloto protesta, mas vira o nariz para o leste. Sob a chuva, o rio é uma fita prateada cortando a selva.\nNa curva perto da cachoeira, a lanterna do helicóptero pega duas caixas abertas, encalhadas nas pedras — e pegadas de três dedos subindo o barranco.' });
    if (S.said.has('broadcast')) pages.push({ kicker: 'CANAL ABERTO', title: 'A COSTA INTEIRA OUVIU', text: 'A transmissão do penhasco foi gravada por radioamadores de três cidades. Quando a Tellus tenta chamar a queda de energia de "acidente natural", as provas já estão nos jornais.\nPorto Anil fecha a captação de água ao amanhecer. Ninguém abre as caixas.' });
    else pages.push({ kicker: 'PORTO ANIL — 06h10', title: 'SEM AVISO', text: 'Ninguém em Porto Anil foi avisado. A captação de água funciona normalmente ao amanhecer.\n(Havia um jeito de alertar a costa: o rádio de campo da Tellus-2, no heliponto, depois que o Colosso cai.)' });
    pages.push({ kicker: 'FIM ALTERNATIVO', title: 'RIO ABAIXO — AMEAÇA VIVA', text: 'O vale ficou para trás, mas o Projeto RAIZ não ficou no vale.\nEm algum lugar rio abaixo, sem medo de nada e atraído por qualquer barulho, alguma coisa está crescendo — e agora Rocha sabe exatamente para onde ela vai.' });
  } else if (station) {
    pages.push({ kicker: `REGISTROS DA ESTAÇÃO • ${STATION_LOGS.length}/${STATION_LOGS.length}`, title: 'RIO ABAIXO', text: 'Com os sete registros da estação, Lima monta quase todo o quebra-cabeça: as três caixas de amostras não estavam nos destroços. As marcas de garra levavam ao penhasco... e de lá, ao rio.\nEm algum lugar, rio abaixo, alguma coisa ainda está crescendo.\n(Faltam ' + (ACT1_LOGS.length - n) + ' registro(s) fora da estação — na margem do rio e no penhasco — para outro final.)' });
  } else pages.push({ kicker: 'FIM', title: `REGISTROS DO VALE: ${n}/${ACT1_LOGS.length}`, text: 'Ainda há partes da história escondidas na estação. Jogue de novo e leia todos os registros para descobrir o que aconteceu com as amostras do Projeto RAIZ — e para outro final.' });
  return pages;
}
/** v6: qual final o jogador viu (título da tela de fim + linha de resumo). */
export function ending(F = {}) {
  if (F.act2Win) {
    const c = F.brandt === 'caught', b = !!F.nestDestroyed;
    if (c && b) return { id: 'raiz', title: 'FIM DO PROJETO RAIZ', line: 'Brandt preso e o ninho destruído: o Projeto RAIZ acabou de verdade.' };
    if (c) return { id: 'justica', title: 'JUSTIÇA RIO ABAIXO', line: 'Otávio Brandt foi preso no cais do ninho. Os ovos ficaram para trás.' };
    if (b) return { id: 'cinzas', title: 'CINZAS DO NINHO', line: 'O ninho da Matriarca virou cinzas — mas o Brandt fugiu rio abaixo.' };
    return { id: 'segredos', title: 'O RIO GUARDA SEGREDOS', line: 'Rocha saiu viva da cratera. O Brandt e os ovos, não se sabe.' };
  }
  if (ACT1_LOGS.every((id) => S.logs.has(id))) return { id: 'rio', title: 'RIO ABAIXO — AMEAÇA VIVA', line: 'O Garça-1 não voltou para a costa: seguiu o rio atrás das caixas do Projeto RAIZ.' + (S.said.has('broadcast') ? ' A costa inteira ouviu as provas.' : '') };
  return { id: 'fuga', title: 'A FUGA DO VALE', line: 'A agente Rocha e a Dra. Lima deixaram o Vale Verde a bordo do Garça-1.' };
}
export function logPages(id) {
  const L = LOGS[id];
  return L.pages.map((t, i) => ({ kicker: `REGISTRO ${LOG_IDS.indexOf(id) + 1}/${TOTAL_LOGS}${L.pages.length > 1 ? ` • pág. ${i + 1}` : ''}`, title: L.title, who: L.who, text: t }));
}
