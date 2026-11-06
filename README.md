# Crise no Vale

Ação/sobrevivência em terceira pessoa, Three.js **r160**, módulos ES, teclado/mouse ou controle. A campanha tem **4 atos, 14 áreas e dois finais jogáveis**, seguido de epílogo, créditos e estatísticas.

**Jogar:** https://luispauloalves500.github.io/crise-no-vale/  
**Repositório:** https://github.com/luispauloalves500/crise-no-vale — GitHub Pages na branch `main`.

## História e fluxo atual (fonte de referência)

A Fundação Tellus recriou dinossauros com DNA do **Projeto RAIZ**. O composto **V-7** eliminou o medo dos animais e os tornou sensíveis ao barulho. O diretor **Otávio Brandt** sabotou o gerador e fugiu com amostras; o **Colosso** derrubou seu helicóptero no penhasco. A agente **Marina Rocha** procura a **Dra. Helena Lima**, segue a rota das amostras e descobre a ameaça à água de **Porto Anil**. O piloto **Garça-1** ajuda nas evacuações, mas não encerra a campanha no primeiro ato. O arquivo original no **Setor Zero** revela que Brandt liberou o V-7 de propósito e falsificou a autorização de Rocha para culpá-la pela eliminação de testemunhas. A tempestade foi um álibi; o Conselho financiou a matriz de clonagem.

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

### Ato 3 — Porto Anil (3 áreas)

**Porto Anil → Captação Anil → Sede Tellus.** A captação ganhou duas passarelas secas sobre o canal, faixas de serviço e placas para o painel/escotilha. Feche as comportas antes do relógio de contaminação para preservar a água. Atrasar muda o desfecho, mas não impede terminar o jogo. Derrote o **Primórdio** e escolha:

- **Transmitir as atas do Conselho** no terminal azul; ou
- **Destruir o laboratório** no núcleo.

A escolha resolve a missão local, **não encerra a campanha**. Volte por **Sede → Captação → Porto Anil**: uma **lancha visível**, passarela, sinalizador verde, luz, placa EMBARQUE [E] e ponto no radar aparecem juntos em `(0, 17.2)`, somente com todos os pré-requisitos. Aperte **E** para embarcar rumo ao **Setor Zero (Ato 4)**. A Defesa Civil assume o transporte porque o Garça-1 está sem combustível. O ponto reaparece corretamente ao voltar ou carregar o save.

### Ato 4 — a origem (2 áreas) e final verdadeiro

1. **Setor Zero → portão norte → Matriz RAIZ**. O cais industrial da ilha tem contexto próprio; a arena da Matriz é independente da Captação Anil, sem portas para outros atos.
2. **Arquivo central azul**: aperte E e defenda a leitura por 10 s. A ordem original desmascara a fraude de Brandt contra Rocha. Se ele foi preso, confessa pelo rádio; se fugiu, os metadados o incriminam sem fazê-lo reaparecer na ilha.
3. O protocolo de emergência solta o **Tirano Matriz (T-rex)**. A saída e o save ficam bloqueados na luta. Atraia-o contra os pilares; aos 66% e 33% de vida, ele chama reforços.
4. Após abatê-lo, escolha **PROVAS** (arquivo azul: transmissão integral e neutralização controlada dos estoques) ou **QUARENTENA** (terminal laranja: esterilizar estoques e destruir servidores, lacrando a ilha). **Nenhuma opção transporta amostras vivas.** A transmissão do Conselho no Ato 3 não é apagada retroativamente.
5. **Volte à lancha no Setor Zero**. Só agora a evacuação final aparece. E inicia a cena de embarque, depois vêm **epílogo → créditos → estatísticas**. Escolhas do Ato 3, contaminação e captura/fuga de Brandt mudam o epílogo. Rocha e Lima sobrevivem; Brandt responde pelo crime e todos os estoques viáveis do RAIZ são neutralizados. Não é necessário encontrar os 17 registros opcionais.

### Cutscenes em tempo real

Câmera com trilhos/keyframes, letterbox, legendas de diálogo e botão de pular. **Esc ou Enter** pula sem perder flags, transporte ou final. Movimento, combate, IA, projéteis e relógios de missão ficam suspensos; mixers da heroína/dinos e caminhos roteirizados dos NPCs continuam animados. A câmera/entrada são restauradas no fim. As cenas não são vídeos e não usam downloads extras.

Cenas: abertura do jogo; aberturas dos Atos 1–4; resgate de Lima na plataforma do Cais; sabotagem das jaulas; revelação de Brandt; aparição do Tirano Matriz; embarque de Porto Anil; finais PROVAS/QUARENTENA. Gatilhos de campanha são persistentes no save e não repetem a cada visita.

### Fronteiras e isolamento

| Ato | IDs dos mapas | Saída de capítulo |
|---|---|---|
| 1 | `porto`, `ruinas`, `lab`, `pantano`, `patio`, `heliponto` | Portão norte do penhasco → `margem` |
| 2 | `margem`, `acampamento`, `ninho` | Piloto depois de chefe + resgate → carregamento de `portoanil` |
| 3 | `portoanil`, `captacao`, `sede` | Decisão da sede + retorno à lancha → `setorzero` |
| 4 | `setorzero`, `raiz` | Arquivo + Tirano Matriz + decisão + retorno à lancha → créditos |

Não há porta física ligando os mapas do Ato 2 aos do Ato 3. Atos anteriores ficam fechados após a passagem de capítulo. Só um grupo de cenário fica visível; preload, streaming, minimapa e mapa grande respeitam o ato atual, inclusive na qualidade Alta. Recursos antigos em compilação são descartados depois que a preparação termina, sem aparecerem no novo mapa.

## Dificuldade

Escolha **Fácil / Normal / Difícil** no menu inicial, antes de Novo jogo. A seleção fica como preferência para novos jogos; **Continuar respeita a dificuldade gravada no save**.

| Efeito (multiplicador) | Fácil | Normal | Difícil |
|---|---:|---:|---:|
| Dano recebido, antes do colete | 0,65 | 1 | 1,35 |
| Vida dos dinossauros, incluindo chefes | 0,80 | 1 | 1,25 |
| Quantidade de patrulhas ambientais | 0,65 | 1 | 1,35 |
| Reserva inicial / munição coletada | 1,50 | 1 | 0,70 |

Quantidades são arredondadas, patrulhas mantêm mínimo de um inimigo quando previstas, e os limites do inventário continuam valendo. Ondas roteirizadas e os quatro chefes obrigatórios são mantidos para não apagar eventos da história. A pistola usa **munição finita**; drops e reposição de emergência ajudam nos retornos. Terminais TELLUS oferecem save e melhorias.

## Saves e animação

- Save **v8**, na chave existente `crise-no-vale-save`; checkpoint do Ato 3 separado. Saves anteriores recebem dificuldade Normal se não informarem outra.
- O capítulo é normalizado pela área salva. Flags, memória e gatilhos indevidos de capítulos futuros não podem pular chefes ou trocar objetivos.
- Checkpoint falso do Ato 3 sem conclusão do Ato 2 retorna ao ninho, com a Matriarca rearmada. Checkpoints v6 legítimos continuam aceitos. Inventário, itens e registros legítimos são preservados.
- Recarregar uma escolha antiga do Ato 3 retoma a fuga até a lancha e permite jogar o Ato 4. Saves adulterados sem pré-requisitos não entram na ilha. Saves anteriores à leitura ou posteriores ao chefe/decisão retomam no ponto correto; o confronto não pode ser salvo no meio.
- A heroína separa camadas superior/inferior: idle não disputa com pernas andando; mira/recarga preservam a locomoção. A fase dos passos segue o deslocamento real, para ao encostar em paredes e mistura andar/correr suavemente. A recarga é avançada uma única vez pelo progresso real da arma.
- Marina/Regina e Jill usam a mesma biblioteca canônica da Jill, retarget pela pose-base, IK dos dois braços, recarga procedural e camadas. Só o bob vertical do quadril é adaptado proporcionalmente; não se copiam comprimentos nem root motion XZ. Troca de modelo restaura a pose-base e avalia idle + IK antes de exibir a personagem.

## Correção posterior: braço da Jill, recarga e jaulas

### Braços e recarga

O diagnóstico dos GLBs mostrou que **Marina já tem os braços abaixados no repouso (~16° do tronco), enquanto Jill tem repouso em T (~92°)**. Não faltavam trilhas do braço esquerdo: a transformação entre as poses-base preservava o T da Jill no `Weapon_Idle`. Verificar apenas quaternions normalizados não detectava esse erro visual.

Marina/Regina e Jill agora recebem a **mesma camada final de IK de dois ossos**, depois do mixer, nos dois braços. Ela usa comprimentos e ossos reais do modelo e a orientação do corpo: esquerda relaxada com balanço ao andar, cotovelo dobrado ao correr, apoio junto à arma ao mirar. Ombros, braços, antebraços e mãos recebem pose explícita; não há retorno à bind/T-pose quando o peso de um clipe muda. A correção também roda no idle do menu e é descartada ao trocar de personagem.

A recarga usa **keyframes procedurais normalizados pelo tempo real de recarga da arma**, inclusive com melhorias: preparação → mão esquerda ao cinto (26–40%) → pega o pente visível → levanta e encaixa sob a pistola (~70%) → volta à pose pronta (100%). A arma inclina até ~32°. Somente tronco/braços são afetados: a animação de pernas continua andando/correndo. O pente acompanha a mão e fica vertical, alinhado à inclinação da arma.

A auditoria com o mixer e ossos reais mede ângulos e rotações, não apenas validade numérica: maior ângulo esquerdo em idle/andar/correr **33,3°**, sem braço lateral em T em 2.904 avaliações dos dois rigs, incluindo mira alta/baixa, raiz girada e recarga parada/andando. As quaternions de quadril/pernas permanecem exatamente iguais antes/depois dessa camada. Isso não substitui testar o jogo com WebGL e texturas.

### Jaulas do Acampamento Tellus-2

- **Fechadas na chegada**, sem temporizador que as abra enquanto a jogadora lê cartões. Grades visíveis e com colisão.
- Avançar pelo **corredor central** (zona x=0, z=1, raio 5,5) dispara a sabotagem do Brandt: alerta, alarme, barulho de metal e grades subindo durante **1,6 s**. Iniciar o hack também dispara a liberação se a zona foi contornada.
- A colisão da grade só sai depois de atingir a altura segura; os dinos nascem **dentro** das jaulas e seguem até um ponto do lado de fora antes de retomar a IA de combate. Não são teletransportados para o corredor.
- Leva extra além das patrulhas: **Fácil: 2 raptores; Normal: 2 raptores + 1 bruto; Difícil: 3 raptores + 1 bruto**. Vida continua seguindo a dificuldade.
- **Evento persistente, uma vez por campanha**, salvo em `cagesReleased`. Ao voltar ao cenário, grades continuam abertas e não surge outra leva. Sobreviventes dessa leva mantêm HP e destino de saída; mortos não voltam. Patrulhas ambientais continuam renovando como antes.
- Saves anteriores sem a nova flag rearmam o evento e eliminam a antiga abertura automática/fila do Brandt; inventário e itens coletados são preservados. Exceção: se o ninho/Brandt já foi resolvido e o evento antigo estava registrado, as grades continuam abertas, para não fazer Brandt preso ou fugitivo reaparecer no acampamento. Novo jogo fecha novamente as grades, inclusive se o mapa estava em cache.

## Auditoria de coerência desta revisão

Foram lidos `README.md`, `ANALISE-ATO3.md`, `AUDITORIA-COERENCIA.md`, `AUDITORIA-DESEMPENHO.md`, `IMPROVEMENTS.md`, `PLANO-MUNDO-COERENTE.md`, `PROMPT-IMPLEMENTACAO-MUNDO.md` e `assets/originais/LEIA-ME.md`, confrontando propostas e história com portas, triggers, flags, eventos, HUD e saves do código.

| Incoerência encontrada | Correção |
|---|---|
| README antigo: URLs de outro repositório, 9 mapas, final/extração de helicóptero no Ato 1, fim opcional no Ato 2 e pistola infinita | Esta especificação descreve os 14 mapas, a travessia terrestre, os quatro atos obrigatórios e a munição finita |
| `startCampaign` zerava a área atual antes de esconder seu grupo: cenário anterior permanecia sobreposto | Ocultar todos os grupos antigos ao iniciar/continuar/entrar; limpar efeitos, falas e timers da área anterior |
| Preload em Alta e callbacks ociosos antigos podiam construir qualquer ato; mapa mostrava todos | Filtrar pelo ato e invalidar tarefas antigas, retirar recursos dos outros capítulos |
| Entrada/checkpoint de Porto Anil aceitava flags parciais e saves misturados | Regras de campanha centralizadas, validação da conclusão da Matriarca/resgate e migração de saves |
| Escolha final vencia automaticamente dentro da sede, embora o HUD mandasse escapar | Extração jogável no cais, epílogo, créditos e tela de fim |
| Workflow de publicação copiava apenas Marina, deixando Jill/Lima/armas/sombra fora do artefato | Publicar todos os recursos de runtime, excluindo apenas `assets/originais`, e testar a montagem do site |
| Jill usava clipes de combate de outra pose; idle de corpo inteiro concorria com pernas; recarga avançava em duplicidade | Retarget pela pose-base, camadas independentes, cadência por deslocamento e tempo manual de recarga |

**Os demais `.md` são análises/planos históricos, não especificações simultâneas.** Propostas antigas de final no heliponto, retorno para casa no Ato 2 ou progressão opcional para Porto Anil ficam superadas pelo fluxo acima e por `js/campaign-rules.mjs`.

## Grama otimizada do usuário

`assets/models/grass-patch.glb`: **60.456 bytes (60,5 kB / 59,0 KiB)**, contra **5.420.960 bytes** do `grama_leve.glb` enviado (**98,88% menor**). Foram extraídas dez folhas/componentes inteiros do original e simplificadas para um patch de **511 triângulos**, aproximadamente **0,72 × 0,42 × 0,57 m**. Meshopt + uma textura WebP de 512²; mapas de normal/ORM removidos e metalness zerado. O arquivo de 161.635 triângulos **não é copiado para o runtime nem repetido por tufo**. Proveniência, hash e medidas em `assets/models/grass-patch.audit.json`; licença pública não especificada no pacote de origem.

- Substitui os tufos antigos em **Cais, Ruínas (bordas), Pântano, Margem, Acampamento e Ninho**. Laboratório/Pátio e os mapas pavimentados dos Atos 3–4 ficam sem grama. A seleção usa os mesmos nove sorteios de antes: não altera as sementes, portas, obstáculos ou saves da campanha.
- `InstancedMesh` por **chunks de 10 m**, geometria/textura/material compartilhados; sem projetar **nem receber sombras**. LOD próximo usa o GLB; distante usa quatro fitas curvas (**12 triângulos**). Cada chunk desenha um único LOD; frustum culling, corte por distância e orçamento **global por mapa**, não multiplicado pelo número de chunks. Matrizes estáticas, atualização de LOD a ~6 Hz.
- Orçamento antes dos redutores: **Baixo 8/40 patches próximo/distante, 6/16 m**; **Médio 20/80, 9/24 m**; **Alto 32/128, 12/32 m**. No Cais, teto adicional de **16/80**. Multiplicador gráfico 0,55/0,8/1; **Fácil ×0,65**, e slider **Densidade da grama (0–100%)** no menu/pausa. Auto já baixa a qualidade em hardware fraco/FPS baixo. Densidade zero remove todos os desenhos de grama.
- Máscaras calculadas **após** terminar o mapa: verificam o footprint inteiro mais margem para o vento, limites da terra, água/poças, obstáculos, pisos/passarelas (inclusive sem colisão), tendas, jaulas, helipontos, caminhos, itens e terminais. O mar/rios fora do chão não recebem instâncias.
- Vento do JS fornecido adaptado em `js/grass.js`: `onBeforeCompile`, fase espacial via `instanceMatrix`, peso por altura e uniformes compartilhados. `atualizarVento` roda no loop, inclusive nas cutscenes; pausa congela e Movimento reduzido suaviza. Nenhum vértice é atualizado na CPU. O carregamento usa o `GLTFLoader` + `MeshoptDecoder` existente, uma tentativa; falha mantém as fitas procedurais e vento. Streaming não destrói recursos compartilhados nem ressuscita áreas após carregamento tardio.

### Triângulos de grama aproximadamente submetidos por mapa

Máximos amostrados na CPU com **49 posições × 8 direções** por mapa, câmera de 60°, chunks testados contra o frustum, slider em 100%. **Não são medições de FPS/GPU, nem garantia de um máximo para toda câmera possível.** Somente grama, não a cena inteira; contagem anterior a recorte por pixel/oclusão. Relatório reproduzível em `tests/grass-runtime-audit.json`.

| Mapa | Baixo + Fácil | Médio + Normal | Alto + Normal |
|---|---:|---:|---:|
| Cais do Porto | 1.106 | 6.348 | 8.632 |
| Ruínas | 1.046 | 3.577 | 6.643 |
| Pântano | 1.178 | 8.620 | 17.012 |
| Margem do Rio | 1.190 | 8.788 | 17.432 |
| Acampamento | 1.070 | 5.717 | 11.686 |
| Ninho | 1.058 | 4.611 | 8.440 |
| Laboratório, Pátio, Heliponto e Atos 3–4 | 0 | 0 | 0 |

Limite teórico no Alto/Normal: **17.888 triângulos de grama por mapa**, **9.136 no Cais**, antes de frustum/densidade; até 13 draws de grama no Cais na amostragem (até um por chunk visível). O LOD distante/fallback é deliberadamente simples. **Ainda requer revisão no navegador com WebGL**: aspecto/inclinação/transição das folhas, shader de vento compilado, integração visual junto a pisos, FPS real e dispositivos móveis. Foi inspecionado apenas um render técnico offline do patch; isso não valida a cena do jogo.

Auditoria CPU adicional com dependências opcionais (a suíte padrão continua sem dependências):

```bash
npm install --no-save three@0.160.0 @napi-rs/canvas
node --experimental-vm-modules tests/runtime-grass.mjs
node --experimental-vm-modules tests/runtime-grass.mjs --failure
```

Testa o GLB real com Meshopt/WebP, máscaras de todos os mapas, limites/slider/Fácil, materiais sem sombra, shader/uniformes, um único 404, descarte e recarga/streaming. **Não compila GLSL nem abre navegador**.

## Rodar e testar

```bash
python3 -m http.server 8765
# abrir http://localhost:8765
node --test tests/*.test.mjs
```

Os módulos exigem HTTP (não `file://`). Three.js/addons vêm do jsDelivr via importmap e exigem conexão; bloom tem fallback.

A suíte tem **186 testes**, incluindo sequência completa dos quatro atos nas três dificuldades e nas quatro combinações de decisões, portas por ato, travas, saves antigos/misturados, isolamento de mapas/preload, resgate opcional, dificuldade, jaulas persistentes, keyframes da recarga e montagem do artefato Pages. A simulação executa o diretor real em VM, com renderização, inimigos e entrada simulados: **não é uma partida humana nem uma prova de balanceamento de combate**.

Auditorias CPU adicionais reproduzíveis, com o Three da mesma versão, sem instalar dependências no projeto:

```bash
npm install --prefix /tmp/crise-test-deps three@0.160.0
THREE_ROOT=/tmp/crise-test-deps/node_modules/three node --experimental-vm-modules tests/runtime-geometry.mjs
THREE_ROOT=/tmp/crise-test-deps/node_modules/three node tests/runtime-animation.mjs
```

- Geometria real dos **14 mapas**, chegadas de portas e **73 rotas** até portas, registros e pontos de missão: sem bloqueios na auditoria (diretoria testada com a porta energizada aberta). Também são testadas **9 saídas de jaulas** (2/3/4 por dificuldade): bloqueadas com a grade fechada e livres com ela aberta.
- Esqueletos GLB reais de Marina/Jill, **15 clipes de combate adaptados**, **1.446 amostras** de mistura e **2.904 avaliações de pose dos dois rigs**: quaternions finitos, braços fora da T-pose em idle/andar/correr/mira/recarga e pernas não alteradas pela camada de braços. A mão chega ao cinto e volta à arma; o pente aparece e desaparece na sequência. Malhas/texturas não são desenhadas nesse teste.
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
| Esc / Enter em cutscenes | Pular cena (não altera a conclusão do evento) |

Controle: analógico esquerdo move, direito mira; RT atira, LT mira; A interage, X recarrega, B granada, Y kit; LB/RB arma; Start pausa, Select mapa; L3 corre e R3 troca ombro. Ajustes permitem sensibilidade, inverter Y, volumes, movimento reduzido, qualidade e controle. O áudio é procedural WebAudio e começa após interação com a página.

## Arquitetura e assets

- `campaign-rules.mjs`: fronteiras, dificuldade e normalização de saves, sem DOM/WebGL.
- `director.js`: progressão, objetivos, portas/cenas, resgates e finais.
- `areas.js` / `world.js`: descrições/construção sob demanda, geometria e colisores.
- `player.js` / `animation-retarget.mjs` / `hero-arms.mjs`: movimento, heroína, camadas e adaptação de animações.
- `enemies.js` / `combat.js`: IA, dano e munição; `story.js`: história/epílogos; `ui.js` / `main.js`: interface/loop.

Os modelos existentes estão em `assets/`. Fontes não carregadas ficam em `assets/originais/`; consulte seu LEIA-ME e as licenças dos modelos antes de redistribuir. Esta revisão não troca assets nem afirma que o modelo alternativo Jill seja de autoria original.

## Raptor e T-rex fornecidos pelo jogador

- `assets/models/raptor.glb` (943.168 bytes) e `trex.glb` (964.104 bytes), cada um com seis clipes esqueléticos: idle, walk, run, attack, hurt, death. Meshopt + texturas WebP 1024², cerca de 10,5 mil triângulos por espécie. Os originais não tinham clipes; os ciclos foram gerados no próprio rig.
- Patrulhas comuns usam raptor; o Cuspidor usa o GLB próprio descrito abaixo. Brutos, Colosso, Matriarca, Primórdio e Tirano Matriz usam T-rex, com dimensões calibradas ao procedural de `24d7e1e` e balanceamento por tipo preservado. O raio de navegação considera o tronco; projéteis usam uma elipse orientada que também cobre cabeça/cauda.
- GLTFLoader + MeshoptDecoder r160, template em cache; SkeletonUtils.clone e AnimationMixer independentes. Geometria/texturas compartilhadas, materiais privados para flash de dano. Animação dirigida pelo estado da IA e deslocamento real; ataques/dano/morte são one-shots, morte sem a queda procedural duplicada. Pool restaura pose e ações; descarte invalida callbacks e libera esqueleto/materiais privados. Download/decodificação falhos mantêm o dinossauro procedural, com uma tentativa por espécie na sessão.
- Teste real do adaptador, WebP, loader, clones, seis/sete estados, reset/descarte/callback tardio e fallback sem tempestade de 404:

```bash
npm install --no-save three@0.160.0 @napi-rs/canvas
node tests/runtime-dinos.mjs
node tests/runtime-dinos.mjs --failure
```

Essas auditorias são CPU: **não certificam FPS, deformação em GPU, enquadramento visual, áudio ou balanceamento de uma partida humana**. Os modelos enviados são preservados como conteúdo do usuário; não se presume licença de terceiros para redistribuição fora do projeto.

## Correção de Marina/Regina e dimensões/pés dos dinossauros

No código, a personagem chamada Regina neste pedido é a aparência **`marina`** (Marina Rocha); não há outro NPC/GLB Regina. `js/hero-animation.mjs` fornece **os mesmos 22 clipes canônicos** às duas aparências: locomoção nativa da Jill, combate adaptado para Jill, e então retarget para o rig escolhido. Nomes com/sem `:` e poses A/T são tratados; translações de ossos não são copiadas entre corpos. As duas usam a mesma criação de ações, camadas inferior/superior, fase por velocidade, IK, mira e recarga normalizada. Não existe mais a condição que aplicava IK só na Jill, nem o patch tardio que trocava apenas a caminhada da Marina. Falha da referência mantém os clipes nativos no mesmo pipeline com IK.

### Medição e correção de escala

O diagnóstico mediu os **vértices deformados** reais, não apenas os limites do arquivo: `skeleton.pose()` depois da normalização/reparent podia restaurar inversas de bind num espaço incompatível, reduzindo a malha e deixando os pés abaixo de y=0. Agora o reset restaura **transforms locais dos ossos**; não reaplica `skeleton.pose()`. A medição/apoio também chama `updateMatrixWorld` (só `updateWorldMatrix` não atualiza o `bindMatrixInverse` do SkinnedMesh em r160).

Referência reproduzível: `node tests/measure-dino-reference.mjs`, que lê `git show 24d7e1e:js/enemies.js` e mede os meshes físicos, excluindo sprites/barras/sombras. Depois, cada GLB é medido na pose **idle a 0,4 s**, e seus três eixos são calibrados para largura, altura e comprimento históricos, inclusive a posição longitudinal assimétrica da cabeça/cauda. `cfg.scale` continua aplicado uma única vez no grupo externo. Os GLBs de raptor/T-rex não foram alterados por essa correção de escala; o Cuspidor foi substituído na revisão abaixo.

Metros, **altura × comprimento**, idle deformado; “antes” é o adapter de `b5c6c1d`, não uma estimativa pelo bind:

| Tipo | GLB antes | Corrigido = referência procedural | Largura corrigida | Raio de navegação mantido |
|---|---:|---:|---:|---:|
| Raptor | 1,185 × 2,353 | 2,126 × 4,730 | 0,760 | 0,75 |
| Cuspidor (antes: raptor) | 1,244 × 2,471 | 2,543 × 4,394 | 0,882 | 0,75 |
| Bruto (T-rex) | 2,163 × 4,943 | 5,242 × 9,772 | 2,436 | 1,70 |
| Colosso | 3,297 × 7,532 | 7,988 × 14,891 | 3,712 | 2,60 |
| Matriarca | 2,782 × 6,355 | 6,740 × 12,564 | 3,132 | 2,10 |
| Primórdio | 3,091 × 7,061 | 7,489 × 13,960 | 3,480 | 2,40 |
| Tirano Matriz | 3,194 × 7,296 | 7,738 × 14,425 | 3,596 | 2,50 |

O Tirano Matriz não existia em `24d7e1e`: usa a mesma fórmula procedural do bruto/chefe antigo, com seu `scale=3,1`. A referência, as medições antes e a validação depois estão em `tests/dino-procedural-reference.json` e `tests/dino-sizing-audit.json`.

### Apoio e integração

- Pré-cálculo por espécie de **47/51/60 vértices de apoio** (raptor/cuspidor/T-rex) de todos os clipes, inclusive cuspir; por instância, só esses contatos são atualizados após o mixer. Não há varredura de 14 mil vértices por frame. Folga de **1,2 cm** acima do piso local, compensada pela escala da instância. A sombra de contato foi baixada para 6 mm (não fica acima das solas ao multiplicar a escala). Na morte, os contatos incluem o corpo; retirado o afundamento proposital antes do descarte.
- **4.214 poses completas/transições** medidas na CPU, mais **20 resets de pool por tipo**: a menor coordenada da malha ficou em **y=0,012 m**, sem encolher após reuso. Verificados também translação, rotação, piso elevado, geometria/texturas compartilhadas e esqueletos independentes.
- **Navegação/colisão horizontal mantém os raios antigos**, para não bloquear portas/rotas. **Projéteis continuam sendo aproximações 2D**, agora com elipse orientada de cabeça a cauda; não se afirma colisão 3D por triângulo. Impactos e barras/números usam a altura calibrada. Trilhos da aparição do Tirano enquadram sua altura/comprimento novos, com 192 projeções CPU dentro da área útil do letterbox (16:9). O ponto inicial dele foi recuado para o centro norte (z=-10), para a cauda não nascer atravessando a parede.

```bash
# Dependências opcionais das auditorias CPU reais
npm install --no-save three@0.160.0 @napi-rs/canvas
node tests/measure-dino-reference.mjs
node tests/runtime-dino-grounding.mjs
node tests/runtime-dinos.mjs
THREE_ROOT=./node_modules/three node tests/runtime-animation.mjs
```

**Não validado no navegador:** deformação visual da pele e armas, contatos/interpolação vistos pela câmera real, sensação de passada, composição final das cutscenes, combate humano, FPS/GPU, áudio e celular. Testes de vértices/ossos não substituem essa revisão visual.


## Cuspidor — dilofossauro com gola móvel

- Substitui **somente o Cuspidor** (`spitter`) pelo modelo fornecido pelo usuário: dinossauro estilizado semelhante ao dilofossauro, com gola colorida, não cabelo. Original: **2.572.084 bytes**, um mesh/skin, **90 ossos genéricos e nenhum clipe**. Arquivo de jogo `assets/models/cuspidor.glb`: **1.170.588 bytes** (−54,5%), **10.433 triângulos**, Meshopt, quantização e três texturas WebP 1024². Proveniência e hashes em `assets/models/cuspidor-audit.json`; licença/autoria de terceiros não foram verificadas.
- Sete clipes esqueléticos **criados proceduralmente no rig** e embutidos no GLB: **idle, walk, run, attack, spit, hurt, death**. `SkeletonUtils.clone`, mixer e materiais privados por instância; geometria/texturas compartilhadas. GLB inválido/404 mantém o procedural e não repete downloads por spawn.
- O rig original não possuía ossos exclusivos para a gola: foram adicionadas **seis hastes** (dobradiças esquerda/direita + pontas superiores/inferiores), ponderando **6.323 vértices** com transição suave na base; mais um osso de mandíbula (**97 juntas** no total). Os clipes recolhem parcialmente a gola no repouso e a abrem no ataque/cuspe. Uma **mola amortecida por instância**, depois do mixer, acrescenta atraso por aceleração/curvas e balanço das pontas ao andar/correr. Sem shader novo/draw calls extras; reuso do pool zera a inércia. Na morte prevalece a pose de queda, sem mola residual.
- **Dimensões mantidas** no idle deformado a 0,4 s: **2,542605 m de altura × 4,394250 m de comprimento × 0,882 m de largura**, raio de navegação **0,75 m**. Medição de vértices skinned e os 51 contatos pré-calculados conservam o apoio em **y=0,012 m** nas sete animações, misturas, chão elevado e reuso. Barra de vida, elipse de tiros e enquadramento continuam usando o mesmo perfil histórico; a abertura da gola permanece dentro do envelope lateral de combate.
- **Cuspe sincronizado:** um único relógio da IA posiciona o clipe `spit` (0,95 s). Evento único em **0,52 s**, já com mandíbula/gola abertas: avalia o socket **`SpitSocket`** depois do mixer e do apoio, em coordenadas mundiais. O ácido sai da boca e desce continuamente até o torso do alvo, sem saltar para uma altura fixa no quadro seguinte. Dano, stun, morte, cutscene ou morte da jogadora interrompem a preparação; perda de visão/parede bloqueia a emissão. Cutscenes animam os dinos sem atacar. O fallback conserva esse relógio e usa o bico procedural. O cuspe em leque do Primórdio continua disponível.

### Testes específicos e render

```bash
node --test tests/*.test.mjs
npm install --no-save three@0.160.0 @napi-rs/canvas
node tests/runtime-dinos.mjs
node tests/runtime-dinos.mjs --failure
node tests/runtime-dino-grounding.mjs
node --experimental-vm-modules tests/runtime-spitter.mjs
node --experimental-vm-modules tests/runtime-spitter.mjs --failure
```

O último teste executa **a IA real de `enemies.js`** em um mundo/áudio simulados, com loader, decoder WebP, mixer e malhas reais: evento único, coordenadas da boca após escala/rotação/translação, deformação efetiva da gola por mola, resets e seis tipos de interrupção, também sem GLB. Relatório em `tests/cuspidor-runtime-audit.json`. As 4.214 poses do teste de apoio incluem 61 amostras do novo clipe e 121 frames com mola/cuspe; há mais 360 frames específicos da gola dinâmica. Regressões de heroínas, grama e rotas seguem disponíveis.

Autoria reproduzível (dependências opcionais de ferramentas, não carregadas pelo jogo):

```bash
npm install --no-save three@0.160.0 @gltf-transform/core @gltf-transform/extensions @gltf-transform/functions meshoptimizer sharp
node tools/build-cuspidor.mjs /caminho/original.glb /diretorio/saida
# saída: cuspidor.glb, cuspidor-preview.glb (sem Meshopt, para Blender) e asset-audit.json
```

Render offline salvo no box em **`/workspace/cuspidor-preview.png`**, com idle e frame de cuspe usando a escala do jogo. Foi inspecionado como imagem estática de CPU, **não captura do navegador**. Não foram verificados WebGL/deformação em GPU, animação em movimento pela câmera real, composição final das cutscenes, FPS, áudio, celular ou balanceamento humano. Esta entrega é **commit local, sem push/deploy**.
