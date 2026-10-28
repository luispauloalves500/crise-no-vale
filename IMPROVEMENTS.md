# Melhorias

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
