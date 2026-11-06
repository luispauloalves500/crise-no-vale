# Crise no Vale

Ação/sobrevivência em terceira pessoa, Three.js **r160**, módulos ES, teclado/mouse ou controle. A campanha tem **3 atos, 12 áreas e um final jogável**, seguido de epílogo, créditos e estatísticas.

**Jogar:** https://luispauloalves500.github.io/crise-no-vale/  
**Repositório:** https://github.com/luispauloalves500/crise-no-vale — GitHub Pages na branch `main`.

## História e fluxo atual (fonte de referência)

A Fundação Tellus recriou dinossauros com DNA do **Projeto RAIZ**. O composto **V-7** eliminou o medo dos animais e os tornou sensíveis ao barulho. O diretor **Otávio Brandt** sabotou o gerador e fugiu com amostras; o **Colosso** derrubou seu helicóptero no penhasco. A agente **Marina Rocha** procura a **Dra. Helena Lima**, segue a rota das amostras e descobre a ameaça à água de **Porto Anil**. O piloto **Garça-1** ajuda nas evacuações, mas não encerra a campanha no primeiro ato.

Jill é a aparência alternativa da heroína jogável; as missões continuam sendo as da Marina. Os nomes de modelos não criam personagens ou campanhas paralelas.

### Ato 1 — a estação (6 áreas)

1. **Cais do Porto → PORTÃO NORTE → Corredor das Ruínas → Laboratório.** O heliponto do Cais não é a saída da protagonista.
2. **Laboratório → Pântano:** ative e defenda o gerador por 20 s. Volte ao laboratório e atravesse o portão norte energizado.
3. **Pátio:** fale com Lima e escolte-a ao terminal de controle no nordeste. Ela libera o código do portão leste para o penhasco. Se cair, aproxime-se e aperte E.
4. **Heliponto do Penhasco:** derrote o **Colosso**. Atravesse o **PORTÃO NORTE**, pela passarela/trilha até a Margem do Rio. **Essa travessia conclui o Ato 1 e carrega o Ato 2. Não há embarque/final de helicóptero aqui.**
5. **Resgate opcional no Cais:** depois de obter o código, é possível voltar ao Cais. Lima chega pelo corredor de serviço; aperte E na marca H e proteja a evacuação por 14 s. Ela caminha até o helicóptero e parte; a heroína fica no chão e segue ao portão do penhasco. O resgate não concede vitória, não teleporta a jogadora e não desbloqueia o Ato 3. Se essa opção não for feita, Garça-1 recolhe Lima durante a operação do ninho.

A sala da diretoria, os registros e a transmissão das provas são opcionais. Os portões que liberam o rio exigem energia, código e Colosso abatido.

### Ato 2 — rio abaixo (3 áreas)

**Margem do Rio → Acampamento Tellus-2 → Ninho Raiz.** Quebre a senha no acampamento e derrote a **Matriarca** no ninho. Brandt pode ser capturado ou fugir; destruir o ninho é opcional.

Após a Matriarca, chame e proteja o resgate na marca H por 14 s, aguarde o pouso completo e **aperte E junto ao piloto**. Só com **`nestClear` + `act2Win`** o Ato 3 é liberado. Há fade, preparação do cenário/shaders e carregamento separado de Porto Anil. Uma falha de construção permite tentar novamente sem conceder vitória.

O menu **CONTINUAR ATO 3 — PORTO ANIL** usa o checkpoint legítimo dessa conclusão. Não existe mais a opção de terminar toda a campanha voltando para casa no Ato 2.

### Ato 3 — Porto Anil (3 áreas) e final

**Porto Anil → Captação Anil → Sede Tellus.** Feche as comportas antes do relógio de contaminação para preservar a água. Atrasar muda o desfecho, mas não impede terminar o jogo. Derrote o **Primórdio** e escolha:

- **Transmitir as atas do Conselho** no terminal azul; ou
- **Destruir o laboratório** no núcleo.

A escolha resolve a missão, **não termina o jogo dentro do bunker**. Volte por **Sede → Captação → Porto Anil** e aperte **E no ponto de extração do cais**. Só então são exibidos **epílogo → FIM / créditos → tela final com estatísticas**. Há quatro variações (escolha × água preservada/contaminada). Nenhuma exige encontrar todos os 17 registros.

### Fronteiras e isolamento

| Ato | IDs dos mapas | Saída de capítulo |
|---|---|---|
| 1 | `porto`, `ruinas`, `lab`, `pantano`, `patio`, `heliponto` | Portão norte do penhasco → `margem` |
| 2 | `margem`, `acampamento`, `ninho` | Piloto depois de chefe + resgate → carregamento de `portoanil` |
| 3 | `portoanil`, `captacao`, `sede` | Retorno ao cais e interação de extração |

Não há porta física ligando os mapas do Ato 2 aos do Ato 3. Atos anteriores ficam fechados após a passagem de capítulo. Só um grupo de cenário fica visível; preload, streaming, minimapa e mapa grande respeitam o ato atual, inclusive na qualidade Alta. Recursos antigos em compilação são descartados depois que a preparação termina, sem aparecerem no novo mapa.

## Dificuldade

Escolha **Fácil / Normal / Difícil** no menu inicial, antes de Novo jogo. A seleção fica como preferência para novos jogos; **Continuar respeita a dificuldade gravada no save**.

| Efeito (multiplicador) | Fácil | Normal | Difícil |
|---|---:|---:|---:|
| Dano recebido, antes do colete | 0,65 | 1 | 1,35 |
| Vida dos dinossauros, incluindo chefes | 0,80 | 1 | 1,25 |
| Quantidade de patrulhas ambientais | 0,65 | 1 | 1,35 |
| Reserva inicial / munição coletada | 1,50 | 1 | 0,70 |

Quantidades são arredondadas, patrulhas mantêm mínimo de um inimigo quando previstas, e os limites do inventário continuam valendo. Ondas roteirizadas e os três chefes obrigatórios são mantidos para não apagar eventos da história. A pistola usa **munição finita**; drops e reposição de emergência ajudam nos retornos. Terminais TELLUS oferecem save e melhorias.

## Saves e animação

- Save **v7**, na chave existente `crise-no-vale-save`; checkpoint do Ato 3 separado. Saves anteriores recebem dificuldade Normal se não informarem outra.
- O capítulo é normalizado pela área salva. Flags, memória e gatilhos indevidos de capítulos futuros não podem pular chefes ou trocar objetivos.
- Checkpoint falso do Ato 3 sem conclusão do Ato 2 retorna ao ninho, com a Matriarca rearmada. Checkpoints v6 legítimos continuam aceitos. Inventário, itens e registros legítimos são preservados.
- Recarregar uma escolha final antiga retoma a fuga até a extração, em vez de disparar vitória dentro do bunker.
- A heroína separa camadas superior/inferior: idle não disputa com pernas andando; mira/recarga preservam a locomoção. A fase dos passos segue o deslocamento real, para ao encostar em paredes e mistura andar/correr suavemente. A recarga é avançada uma única vez pelo progresso real da arma.
- Jill recebe os clipes de combate adaptados à sua pose de repouso, sem copiar translações de outro esqueleto. Troca de modelo restaura a pose-base e avalia o idle antes de exibir a personagem.

## Auditoria de coerência desta revisão

Foram lidos `README.md`, `ANALISE-ATO3.md`, `AUDITORIA-COERENCIA.md`, `AUDITORIA-DESEMPENHO.md`, `IMPROVEMENTS.md`, `PLANO-MUNDO-COERENTE.md`, `PROMPT-IMPLEMENTACAO-MUNDO.md` e `assets/originais/LEIA-ME.md`, confrontando propostas e história com portas, triggers, flags, eventos, HUD e saves do código.

| Incoerência encontrada | Correção |
|---|---|
| README antigo: URLs de outro repositório, 9 mapas, final/extração de helicóptero no Ato 1, fim opcional no Ato 2 e pistola infinita | Esta especificação descreve os 12 mapas, a travessia terrestre, os três atos obrigatórios e a munição finita |
| `startCampaign` zerava a área atual antes de esconder seu grupo: cenário anterior permanecia sobreposto | Ocultar todos os grupos antigos ao iniciar/continuar/entrar; limpar efeitos, falas e timers da área anterior |
| Preload em Alta e callbacks ociosos antigos podiam construir qualquer ato; mapa mostrava todos | Filtrar pelo ato e invalidar tarefas antigas, retirar recursos dos outros capítulos |
| Entrada/checkpoint de Porto Anil aceitava flags parciais e saves misturados | Regras de campanha centralizadas, validação da conclusão da Matriarca/resgate e migração de saves |
| Escolha final vencia automaticamente dentro da sede, embora o HUD mandasse escapar | Extração jogável no cais, epílogo, créditos e tela de fim |
| Jill usava clipes de combate de outra pose; idle de corpo inteiro concorria com pernas; recarga avançava em duplicidade | Retarget pela pose-base, camadas independentes, cadência por deslocamento e tempo manual de recarga |

**Os demais `.md` são análises/planos históricos, não especificações simultâneas.** Propostas antigas de final no heliponto, retorno para casa no Ato 2 ou progressão opcional para Porto Anil ficam superadas pelo fluxo acima e por `js/campaign-rules.mjs`.

## Rodar e testar

```bash
python3 -m http.server 8765
# abrir http://localhost:8765
node --test tests/*.test.mjs
```

Os módulos exigem HTTP (não `file://`). Three.js/addons vêm do jsDelivr via importmap e exigem conexão; bloom tem fallback.

A suíte tem **101 testes**, incluindo sequência completa dos três atos nos dois caminhos finais, portas por ato, travas, saves antigos/misturados, isolamento de mapas/preload, resgate opcional e dificuldade. A simulação executa o diretor real em VM, com renderização, inimigos e entrada simulados: **não é uma partida humana nem uma prova de balanceamento de combate**.

Auditorias CPU adicionais reproduzíveis, com o Three da mesma versão, sem instalar dependências no projeto:

```bash
npm install --prefix /tmp/crise-test-deps three@0.160.0
THREE_ROOT=/tmp/crise-test-deps/node_modules/three node --experimental-vm-modules tests/runtime-geometry.mjs
THREE_ROOT=/tmp/crise-test-deps/node_modules/three node tests/runtime-animation.mjs
```

- Geometria real dos **12 mapas**, chegadas de portas e **64 rotas** até portas, registros e pontos de missão: sem bloqueios na auditoria (diretoria testada com a porta energizada aberta).
- Esqueletos GLB reais de Marina/Jill, **15 clipes de combate adaptados**, **1.446 amostras** de mistura idle/andar/correr/mira/recarga: quaternions finitos e normalizados. Malhas/texturas não são desenhadas nesse teste.
- Servidor local `:8765` validado para entregar HTML/módulos.
- **Não verificado visualmente nesta revisão:** WebGL/GPU, deformação da malha/arma na mão, qualidade visual dos pés/transições/embarque, câmera, FPS, áudio, controles físicos e conclusão por uma pessoa. Não se afirma ausência visual absoluta de T-pose/deslizamento nem “60 FPS garantidos” com base em testes CPU.

## Controles e ajustes

| Entrada | Ação |
|---|---|
| WASD / Shift | Mover / correr |
| Mouse / clique esquerdo / botão direito | Câmera / atirar / mirar |
| R / 1–3 / Q ou roda | Recarregar / arma / alternar |
| E / G / H | Interagir / granada / kit médico |
| Tab / J / V | Mapa / arquivo de registros / trocar ombro |
| P ou Esc / M / B | Pausa / som / bloom |
| Espaço ou clique / Enter | Avançar / pular cartões |

Controle: analógico esquerdo move, direito mira; RT atira, LT mira; A interage, X recarrega, B granada, Y kit; LB/RB arma; Start pausa, Select mapa; L3 corre e R3 troca ombro. Ajustes permitem sensibilidade, inverter Y, volumes, movimento reduzido, qualidade e controle. O áudio é procedural WebAudio e começa após interação com a página.

## Arquitetura e assets

- `campaign-rules.mjs`: fronteiras, dificuldade e normalização de saves, sem DOM/WebGL.
- `director.js`: progressão, objetivos, portas/cenas, resgates e finais.
- `areas.js` / `world.js`: descrições/construção sob demanda, geometria e colisores.
- `player.js` / `animation-retarget.mjs`: movimento, heroína, camadas e adaptação de animações.
- `enemies.js` / `combat.js`: IA, dano e munição; `story.js`: história/epílogos; `ui.js` / `main.js`: interface/loop.

Os modelos existentes estão em `assets/`. Fontes não carregadas ficam em `assets/originais/`; consulte seu LEIA-ME e as licenças dos modelos antes de redistribuir. Esta revisão não troca assets nem afirma que o modelo alternativo Jill seja de autoria original.
