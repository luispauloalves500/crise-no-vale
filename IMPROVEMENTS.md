# Melhorias

## v7: Ato 2 — Rio Abaixo (mais áreas, história maior)

### Campanha em dois atos
- **O Ato 1 continua igual:** matar o Colosso e chamar o resgate na marca H ainda leva ao final clássico (com os finais da v6).
- Depois do Colosso, o **portão leste do heliponto** se abre e o objetivo oferece a escolha: *"Chame o resgate na marca H — ou siga o rio pelo portão leste (Ato 2)"*. Uma fala no rádio lembra a opção 24 s depois.
- Ao entrar na primeira área nova aparece o banner **ATO 2 — RIO ABAIXO** e um cartão de introdução.

### Três áreas novas (`js/areas.js`, feitas com os construtores de `world.js`)
- **Margem do Rio:** neblina, lama e água corrente. Tem save, a primeira aparição do Brandt fugindo e uma emboscada de raptores que saem da lama.
- **Acampamento Tellus-2:** barracas, geradores e jaulas. Tem save e uma cena com o Brandt, que **abre as jaulas** e dispara o alarme. O portão sul fica travado até você **invadir o terminal** (evento de defesa de 18 s com três ondas).
- **Ninho Raiz:** uma cratera de pedra cheia de ovos que brilham, com um barco no cais.
- O streaming, o mapa (agora centralizado e ajustado ao tamanho do mundo), os pontos do HUD e as travas de porta (com mensagens) cobrem as áreas novas.

### Brandt (`js/brandt.js`)
- Diretor da Tellus, agora um NPC com rota: aparece, corre, se encolhe no cais e pode ser **preso** (E, +1000 pontos).
- Depois que a chefe cai, você tem **40 s** (com avisos aos 20 e aos 10) antes de o barco ligar. Se você sair do ninho ou o tempo acabar, ele foge.

### Chefe: Matriarca
- Uma guardiã do ninho, maior e com mais vida que o Colosso (1150 HP). Ela investe, pisa e **choca ovos** nas fases de vida, que viram raptores.
- Tem banner próprio, barra de chefe e uma camada de áudio de chefe. A porta do ninho fica travada durante a luta.

### Escolhas e finais
- Depois da Matriarca você pode **plantar cargas** no ninho (pavio de 6 s, explosão, ovos apagados) ou deixar como está, e decidir se corre atrás do Brandt.
- O resgate do Ato 2 acontece na clareira do ninho (três ondas).
- **Quatro epílogos novos:** *FIM DO PROJETO RAIZ* (preso e ninho destruído), *JUSTIÇA RIO ABAIXO*, *CINZAS DO NINHO* e *O RIO GUARDA SEGREDOS*.

### História
- **Registros 10–13** (agora são 13), falas novas para cada momento e cartões com roteiro (portão do acampamento, despertar do ninho). O epílogo do Ato 1 continua contando só os 9 registros do vale.

### Áudio
- Ambiente próprio para cada área nova, com camadas novas de **rio** e **respiração** do ninho, uma mixagem tensa durante a invasão do terminal e passos de lama ou pedra.

### Save
- O save passou para **`v: 3`** e agora guarda as flags da campanha, o estado da história e os encontros já disparados. Flags transitórias (escolta, luta de chefe) não são salvas.
- Saves `v: 1`/`v: 2` continuam funcionando. As flags são deduzidas pela área salva (pátio → energia; heliponto → energia e código).
- Configurações, submetralhadora, colete, controle e Pages (v6) não foram alterados.

### Depuração
- `__game.setFlags({...})` e `__game.brandt` (posição e estado).

## v6: pacote completo (ajustes, impacto, submetralhadora e final alternativo)

### Ajustes e controle (`js/settings.js`, `js/gamepad.js`)
- **Painel "Ajustes"** no menu e na pausa: sensibilidade do mouse/analógico, **inverter Y**, volumes **geral / efeitos / ambiente** (barramentos separados do WebAudio) e **movimento reduzido**.
- Tudo é salvo em `localStorage` (`crise-no-vale-settings`) e vale na hora, inclusive durante a partida. **M** continua silenciando tudo.
- **Movimento reduzido:** menos tremor de câmera, menos coice da arma, metade das partículas e sem *hitstop*.
- **Controle (gamepad, layout padrão):** analógico esquerdo move, direito mira; RT atira, LT mira; A interage, X recarrega, B granada, Y kit médico, LB/RB trocam de arma, Start pausa, Select abre o mapa, L3 corre, R3 troca o ombro. Pode ser desligado nos ajustes.

### Impacto e acabamento visual
- **Morte dos dinossauros:** o corpo achata no golpe, cai com um pequeno quique, desliza com o empurrão do tiro, levanta poeira ao bater no chão e afunda antes de sumir.
- **Sangue:** jorro maior no abate (com spray para cima e mancha no chão nas qualidades Médio/Alto).
- **Dano no jogador:** vinheta vermelha mais forte conforme o golpe, **mancha na borda da tela do lado de onde veio o ataque** e batimento duplo quando a vida está baixa. Com colete, a vinheta fica azulada.
- **Arma na mão:** coice por arma, abaixar na troca e animação de recarga (inclina, abaixa e "bate" o pente).
- **Crítico e abate:** faíscas e clarão (dourado no crítico; anel vermelho no abate) e uma **pausa de impacto de 40–55 ms** (*hitstop*), com intervalo mínimo para não travar o ritmo.
- **Granada:** além do fogo, poeira e faíscas longas; nas qualidades Médio/Alto ganha fumaça extra e uma onda de poeira.
- No **Baixo** os efeitos pesados (spray extra, decalques, ondas e clarões do *flourish*) ficam desligados.

### Terceira arma: submetralhadora
- **SUBMETRALHADORA** automática (segure o clique): pente de 30, dano 13, cadência alta, pouco coice, barulho intermediário (17) e reserva máxima de 120.
- **Onde achar:** caída junto ao anexo leste do **laboratório**. Também pode cair (raro, 3%) de inimigos se você ainda não tiver. Pentes extras no laboratório, no pátio e como drop.
- **Troca de arma:** **1 / 2 / 3**, **Q** e **roda do mouse** (pula as armas que você não tem).
- **Caixas de suprimentos** brilhantes no pátio, no pântano e no heliponto: dão munição para as armas que você tem, um kit médico (ou vida) e às vezes uma granada.
- **Colete:** no galpão oeste do pátio (e às vezes deixado pelo bruto). Até 50 pontos; absorve 60% de cada golpe até acabar ("Colete destruído!").
- **HUD de inventário:** mostra as três armas com tecla, munição (`pente+reserva`) e a arma atual destacada, além do colete.
- **Saves:** o save passou para `v: 2`. Saves da v5 continuam funcionando: as armas e a munição que faltam recebem valores padrão e o colete começa em 0.

### Final alternativo
- **Dois registros novos fora da estação (agora são 9):**
  - **Registro 8 — "Caixa RAIZ-3":** na margem leste do pântano, junto a uma caixa arrebentada de dentro para fora.
  - **Registro 9 — "Rádio de campo Tellus-2":** na borda oeste do heliponto.
- **Epílogo "Rio abaixo — ameaça viva":** com os 9 registros, o Garça-1 desvia a rota e segue o rio atrás das caixas. A tela final troca o título ("A FUGA DO VALE" no final normal e "RIO ABAIXO — AMEAÇA VIVA" no alternativo).
- **Segredo:** depois de ler o rádio da Tellus-2 e derrubar o Colosso, o rádio oferece **"Transmitir provas no canal aberto"** (+500). Isso muda uma página do final alternativo.
- O caminho antigo continua: com os **7 registros da estação** o epílogo ainda mostra "Rio abaixo" e indica quantos faltam. O contador do HUD mostra `n/9`.

## v5: áudio, combate e novos momentos

### Áudio (`js/audio.js`)
- **Nova mixagem:** efeitos e ambiente passam por barramentos separados → filtro de "abafar" → compressor → volume mestre. A tecla **M** silencia com uma rampa curta, sem estalo.
- **Ambiente por área com crossfade de ~2,5 s.** São 7 camadas procedurais (chuva, vento, insetos, mar, zumbido elétrico, alarme distante e drone de tensão), misturadas de um jeito diferente em cada área e no menu. O mar quebra no cais, os insetos cantam no pântano e o vento sopra forte no heliponto.
- **O ambiente reage ao estado do jogo:** o zumbido cresce quando a energia volta e durante o gerador, o alarme dispara no lockdown e a tensão sobe na escolta, no Colosso e no resgate.
- **Abafar:** na pausa e nos cartões de história a mistura passa por um passa-baixa e fica mais baixa.
- **Passos** variam por terreno (tábuas do cais, pedra das ruínas, lama do pântano, concreto, água) e ficam mais fortes na corrida. O Colosso e o bruto fazem passos pesados, que perdem volume com a distância.
- **Stingers** discretos nas emboscadas e na chegada do chefe, no máximo 1 a cada 3 s.
- **Limite de 40 vozes simultâneas** (os sons importantes podem passar disso) e um limitador por nome, para que a escopeta com vários acertos não estoure o som.

### Combate e feedback
- **Hitmarks:** branco no acerto, **dourado no crítico** e vermelho e maior no abate, com um "pop" de escala.
- **Números de dano** que saltam e assentam. Os críticos levam "!", golpes ≥ 60 aparecem maiores e o dano no ponto fraco do Colosso atordoado aparece em **azul**.
- **Escopeta** um pouco mais forte de perto: a perda de dano começa a 5 m (antes 4) e o dano mínimo subiu para 50% (antes 45%).
- **Raio da granada** passou de 5,5 para 6.
- **Barulho dos tiros** diminuiu: a pistola chega a 15 (antes 18) e a escopeta a 22 (antes 26). Agora dá para lutar sem acordar a área inteira.
- **Telegrafia do Colosso:**
  - antes do pisão, um anel vermelho aparece no chão e enche até o impacto (aviso de 1,2 s), acompanhado de um ronco grave;
  - antes da investida, uma faixa no chão mostra a direção e o alcance, com bufo e raspar de patas;
  - ao bater na parede ele fica atordoado por 3,2 s (antes 2,4) e tem uma carência antes de pisar ou investir de novo.

### Momentos novos
- **Protocolo da diretoria (lockdown):** depois que a energia volta, entrar na sala do Brandt faz a porta blindada bater. A sirene toca, a luz fica vermelha e pulsante e a gravação do diretor zomba de você. O alarme chama tudo o que está no laboratório. Em 7 s a porta reabre com dois raptores e um cuspidor esperando no corredor, e o objetivo mostra a contagem.
- **A lama ferve:** perto da poça central do pântano, bolhas e um ronco avisam antes de dois raptores saírem da lama, com jorro, mancha e onda de choque.
- **Rádio interceptado:** pouco depois do código do heliponto, uma transmissão da equipe Tellus-2 revela que a Fundação está acobertando o Brandt. A gravação vira uma página extra no epílogo.
- **Dica de caminho:** fora da área do objetivo, o HUD mostra a próxima porta ("Caminho: portão norte → pátio da instalação").

### Escolta mais justa (Dra. Lima)
- **Fôlego:** ela aguenta 2 mordidas. A primeira só a faz cambalear (marcador amarelo) e ela recupera 1 ponto a cada 7 s sem ser mordida.
- **Caída:** ela fica 4 s no chão e o marcador vermelho pisca. **Chegue perto e aperte E** para levantá-la na hora; o alcance é maior que o de outros objetos.
- Depois de levantar, ela tem **2,2 s em que os inimigos a ignoram**. Os inimigos também só a escolhem como alvo quando ela está bem mais perto que você.
- Na primeira queda aparece um aviso explicando o E, e ela agradece com falas variadas.

## v4: desempenho (menos travadas)

### Carregamento
- **Sem construção síncrona de todas as áreas na partida.** `buildAreas()` deu lugar a `buildArea(id)`.
- **Tela de carregamento** em português com barra e etapas: qualidade, cais, criaturas e shaders.
- O jogo libera o menu quando o cais está pronto. As outras áreas são construídas **uma por fatia ociosa** (`requestIdleCallback`, ou rAF quando ele não existe) por `js/idle.js`.
- **Pré-compilação de shaders** (`renderer.compileAsync`, com fallback para `compile`), incluindo os modelos de inimigos do pool. Isso evita o engasgo do primeiro encontro.

### Qualidade gráfica (`js/quality.js`)
- Predefinições **Baixo / Médio / Alto** mais **Auto**, salvas no `localStorage` (`crise-no-vale-quality`).
- Seletor no menu principal e na pausa. Na primeira vez, o seletor aparece destacado, com o palpite do Auto.
- O que cada nível controla:
  - mapa de sombras (512/1024/2048) e tipo de sombra (Basic ou PCFSoft);
  - sombras de árvores distantes e objetos pequenos;
  - limite de pixel ratio (1/1,25/1,75);
  - chuva (250/500/900) e vaga-lumes (40/80/140);
  - bloom (desligado por padrão no Baixo);
  - textura do chão (256 ou 512);
  - número de postes acesos e holofotes.
- O padrão do Auto é decidido por memória, núcleos, celular e nome da GPU (software → Baixo). Durante o jogo, ele desce um nível se o FPS ficar baixo por 6 s, com 20 s de espera entre as quedas.
- Trocar o nível só recompila materiais quando muda o tipo de sombra ou o número de luzes. Isso acontece apenas no clique, nunca durante o jogo normal.

### Sombras
- O padrão é Médio (1024). A lua continua sendo a única luz com sombra.
- Os objetos receberam níveis de sombra:
  - perto: sempre projeta;
  - médio: postes, beirais e pilares;
  - longe: anéis de árvores fora da área jogável;
  - pequeno: entulho, pedrinhas, unidades de telhado.
- `applyShadowTiers` aplica esses níveis em cada área e a cada troca de qualidade.

### Chuva e vaga-lumes
- Os buffers são alocados no máximo. O preset só muda o `drawRange` e o laço atualiza apenas as partículas ativas.
- A chuva continua presa à câmera. Os vaga-lumes não são atualizados quando estão invisíveis.

### Iluminação
- O pool de 6 PointLights foi mantido, sem mudar a contagem de luzes durante o jogo.
- A cada 0,25 s, as luzes vão para os **N postes mais próximos da câmera**, com preferência pelos acesos.
- O pisca-pisca agora é **determinístico** (seno + semente pela posição + hash), sem `Math.random` por quadro.
- Os holofotes não usados ficam desligados. No Baixo há 4 postes com alcance de 75% e 1 holofote.

### Streaming de áreas (melhor esforço)
- Ficam na memória a área atual e as vizinhas. As demais são descartadas com `disposeGroup`.
  - Um registro `SHARED` (WeakSet) protege materiais, geometrias e texturas compartilhados (MATS, árvores, caixas etc.).
  - A geometria de Sprite nunca é descartada.
- Uma área é reconstruída de forma determinística (semente por área) quando:
  - o jogador entra numa vizinha (fatia ociosa);
  - ou ele se aproxima a até 12 m de uma porta;
  - ou, em último caso, na hora, sob a tela preta da transição.
- Depois de reconstruída, a área reaplica o estado da campanha: energia, porta lateral, portões e heliponto.
- `FADE` passou de 0,35 para 0,4 s, e a tela fica preta por mais 0,06 s depois da troca, para esconder o primeiro quadro.
- No Alto, todas as áreas ficam na memória.
- **Limitação:** é "melhor esforço". Num aparelho muito lento, uma reconstrução síncrona ainda pode ocorrer sob o fade. Os contadores ficam em `__game.streamStats`.

### Inimigos
- **Pool** para raptor, cuspidor e bruto (até 8 por tipo). O modelo volta ao pool ao sumir e é reiniciado (pose, emissivo, olhos, barra de vida) ao reaparecer.
- O Colosso continua único.
- O cuspe ácido reaproveita sprites e usa um material compartilhado.
- Ao carregar, ficam no pool 4 raptores, 2 cuspidores e 2 brutos.

### HUD
- O radar é desenhado a ~12 Hz, em vez de todo quadro.
- O minimapa é redesenhado quando algo muda ou a cada 0,5 s.
- O mapa grande (Tab) só é desenhado com o mapa aberto (quando algo muda ou a cada 0,25 s).

### Texturas
- No Baixo, o chão usa ruído de 256 px.
- As texturas de chão ficam em cache por tipo e tamanho, e os clones compartilham a mesma imagem na GPU.

### Mantido
- O `dt` continua limitado a 0,05.
- Textos em português, saves (compatíveis), Continuar, história e registros, e `__game.goto`.

## v3: história expandida e gráficos

### História (tudo original, em português)
- Novo `js/story.js` com o roteiro do jogo:
  - Lore: Fundação Tellus, Projeto RAIZ, composto V-7, Espécime Zero e a fuga do diretor Otávio Brandt.
  - Personagens: a agente Marina Rocha, a Dra. Helena Lima e o piloto Garça-1.
- **Introdução** em 4 cartões depois de "Novo jogo", com câmera cinematográfica. Clique ou Espaço avança, Enter pula.
- **7 registros legíveis** (tablets azuis, tecla E):
  - Ficam no cais, nas ruínas, no laboratório (2), no pântano, no pátio e no heliponto.
  - Valem +150 pontos, aparecem no radar e geram um contador no HUD ("Registros n/7").
  - São gravados no save.
- **Sala da diretoria** (opcional, lado oeste do laboratório): a porta abre quando a energia volta. Lá estão a gravação particular de Brandt e uma granada.
- **Falas com legendas**:
  - O rádio do Garça-1 e a fala de entrada em cada área.
  - Lima comenta durante a escolta, reclama quando é derrubada e reage aos registros.
  - Ela também conversa depois do código (E).
- **Cenas de história** nos marcos: energia restaurada, código aceito, chegada ao Colosso, morte do chefe e chegada do helicóptero.
- **Epílogo variável**: muda conforme você achou as provas contra Brandt (registros 4 e 5), só a gravação ou nenhuma delas. Encontrar os 7 registros libera uma página extra. A tela final mostra os registros encontrados.
- O objetivo do HUD ganhou uma linha secundária para a sala opcional.
- A descrição do jogo deixou de citar outras franquias.

### Gráficos
- **Texturas procedurais** com manchas, escorridos, granulado e mapa de relevo:
  - concreto, paralelepípedo, lama e ferrugem;
  - chapa corrugada para contêineres e galpões;
  - escamas dos dinossauros.
- **Chão** com manchas de variação, poças com ondulações animadas de chuva e brilho molhado.
- **Cenário**:
  - Contêineres corrugados com nervuras e travas, caixas com cintas e portões com placa de destino.
  - Árvores por bioma, barco afundado no cais e altar rachado com brilho âmbar.
  - Fachada "Fundação Tellus" e destroços do helicóptero do diretor em chamas.
  - Torres de holofote, e janelas que acendem com a energia.
- **Personagens**:
  - Rocha ganhou colete com faixa refletiva, cinto, coldre, ombreiras, joelheiras, mãos e armas mais detalhadas.
  - Lima ganhou jaleco aberto, crachá, óculos, tablet e braços que acenam.
  - Dinossauros têm tronco orgânico, dentes, garras e textura de escamas. O Colosso tem cicatrizes incandescentes.
- **Luz e clima**:
  - Holofotes varrem o pátio e o heliponto, e o fogo tremula.
  - Ao restaurar a energia há um clarão quente e as lâmpadas acendem.
  - A arena do chefe tem névoa vermelha e uma luz que acompanha o Colosso.
- **Efeitos**:
  - Faíscas alongadas e aditivas.
  - Explosões com luz real e fumaça.
  - Pisão do Colosso com onda de choque dupla, clarão e marca no chão.
  - Manchas com bordas suaves.
- **Helicóptero de resgate** Garça-1 com rotor principal e de cauda, luzes de navegação, farol, holofote de busca, som de rotor e tremor de câmera.
- **Pós-processamento opcional**:
  - Bloom em meia resolução, usando os addons oficiais do Three r160 (sem pacote novo).
  - Tecla B liga e desliga; desliga sozinho com FPS baixo e cai para o render direto se não carregar.
  - Também há granulado de filme em CSS.

### Técnico
- Sons novos: chiado de rádio, rotor do helicóptero e pisão.
- Novo estado `story`: os cartões pausam o jogo sem abrir o menu de pausa. Cenas que disparam durante uma troca de área esperam o fade acabar.
- Saves antigos continuam válidos: o novo campo `story` é opcional.
- `__game.goto(...)`, Continuar e os controles foram preservados.
- Testado com puppeteer no Chrome headless:
  - introdução, leitura de registro, escopeta e gerador;
  - sala da diretoria, escolta e mapa (Tab);
  - chefe, helicóptero, epílogo e tela final;
  - sem erros de console.

## v2: de ondas para áreas conectadas

O jogo deixou de ser uma arena com ondas e virou uma campanha com 6 áreas ligadas por portões. A versão de ondas anterior foi guardada em `../crise-no-vale.bak-waves/`.

### Mundo e progressão
- Novo `areas.js` com 6 áreas: cais, ruínas, laboratório, pântano, pátio e heliponto. Cada área tem cenário, colisões, portas, itens, patrulhas, encontros e clima próprios (neblina, céu, luz da lua e chuva).
- Novo `director.js` no lugar do sistema de ondas:
  - troca de área com fade e invulnerabilidade breve;
  - portões animados com luz verde ou vermelha;
  - travas por flag: `power`, `heliCode` e `bossLock`, com mensagem explicando o motivo.
- Objetivos derivados do estado do jogo: chegar ao laboratório → ligar o gerador → achar e escoltar a sobrevivente → código do portão → chefe → resgate.
- Eventos com roteiro e medidor no HUD:
  - defesa do gerador (20 s, 3 grupos de inimigos);
  - digitação do código (4 s);
  - resgate final (14 s).
- O mundo é persistente: patrulhas mortas e itens coletados não voltam, e encontros novos aparecem quando você volta com a energia ligada.
- Terminais de save restauram a vida e gravam o progresso em `localStorage`, com botão "Continuar" no menu e na tela de morte.
- Nova NPC, a Dra. Lima (`npc.js`): segue o jogador, desvia de paredes, cai ao ser atacada e precisa ser protegida.

### Chefe
- O **Colosso** é um bruto gigante (1600 HP) com:
  - investida;
  - pisão em área;
  - fúria abaixo de 34% da vida.
- Ele chama a matilha conforme perde vida e tem barra de vida própria no topo da tela.
- Ao bater numa parede fica atordoado e leva +50% de dano. Granadas também o atordoam.

### Armas e itens
- A escopeta agora é encontrada no mapa (ruínas) em vez de vir no início. A tecla 2 só funciona depois de pegá-la.
- Granadas (G) com física de quique no chão e nas paredes, pavio, dano com queda pela distância e teste de cobertura. Também atordoam e podem ferir o próprio jogador.
- Kits médicos (H) vão para o inventário (máx. 4).
- Itens fixos no mapa: munição, kits, granadas e a escopeta. Inimigos ainda deixam drops, e o bruto deixa mais.
- Tiros fazem barulho e atraem inimigos que ainda não perceberam o jogador.

### HUD
- Painel com o nome da área e o objetivo atual, mais um mini-mapa esquemático das áreas (atual, visitadas, desconhecidas, trancadas e marcadores de save/objetivo).
- Mapa grande com Tab.
- Inventário (kits, granadas, escopeta), prompt de interação (E), barra do chefe e medidor de eventos.
- Banner de entrada em cada área e tela final com rank S–D.

### Áudio
- Novos sons: porta, porta trancada, save, gerador, energia restaurada, explosão, alarme, rugido do chefe, objetivo e emboscada.

### Testado
- Testado em servidor estático com Chrome headless (puppeteer): sem erros de console.
- Campanha completa validada: save → gerador → escolta → código → chefe → resgate (vitória).
- Também validados: Continuar do save, pegar a escopeta, granada, mapa (Tab) e pausa.
