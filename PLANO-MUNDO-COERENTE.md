# CRISE NO VALE — Plano de evolução do mundo coerente
**Data:** 03/11/2026 | **Status:** especificação técnica após inspeção do repositório; funcionalidades novas ainda NÃO implementadas nem certificadas em navegador.

## 1. Objetivo e limites
Fazer as nove áreas parecerem um único lugar real, fisicamente interligado. Melhorar as transições, portas, localização dos treze registros, retorno às áreas anteriores, consequências narrativas, dinossauros em revisitas e combos de abates sem receber ataques até atravessar para o próximo cenário. Manter os dois atos, a história original, os saves, o inventário, a IA recente, as otimizações e os finais. Não copiar cenários, marcas ou assets de terceiros.

## 2. Diagnóstico fundamentado (não confundir inspeção com playtest)
- **js/areas.js:** nove áreas conectadas, portas com destino/toDoor, encontros e registros em coordenadas locais; doorArrival determina chegada; buildArea carrega modelos sob demanda.
- **js/director.js:** checkDoors atravessa automaticamente quando Marina alcança a borda e usa pushBack quando uma saída está trancada. A transição troca a área sob fade. syncGates altera a altura visual do portão, enquanto isLocked consulta flags. A dica de trajeto por busca em largura não descarta portas trancadas.
- **js/encounter-memory.mjs / tests/coherence.test.mjs:** já existe memória leve de adversários vivos, sua vida e fila de encontros entre cenas e testes puros; preservar e ampliar. Os encontros são identificados por ID, sem reiniciar indiscriminadamente toda vez que uma área é visitada.
- **js/story.js:** treze documentos com enredo próprio: nove no Ato 1 e quatro no Ato 2. Leitura registrada no progresso, não deve reaparecer como inédita.
- **js/combat.js / js/config.js:** combo atual de abates usa janela de 2,5 s e multiplicador até 4x, inclusive PE de inimigos normais. Há bônus de chefe/evento sem dano. **js/player.js** contabiliza G.dmgTaken depois da absorção do colete, ou seja, um ataque totalmente absorvido não é interpretado como dano nesse contador.
- **AUDITORIA-COERENCIA.md:** as correções recentes de IA/memória foram documentadas, mas a travessia integral das nove áreas, colisões e saves continua pendente de certificação real no navegador.

## 3. Grafo oficial e bloqueios (preservar)
| Área | Acessos e direção | Progressão |
|---|---|---|
| Cais (porto) | N ↔ Ruínas S | Início |
| Ruínas (ruinas) | S ↔ Cais N; N ↔ Laboratório S | Primeiro corredor |
| Laboratório (lab) | S ↔ Ruínas N; W ↔ Pântano E; N ↔ Pátio S | N requer energia |
| Pântano (pantano) | E ↔ Laboratório W | Gerador e volta ao hub |
| Pátio (patio) | S ↔ Laboratório N; E ↔ Heliponto W | E requer código da Dra. Lima |
| Heliponto (heliponto) | W ↔ Pátio E; E ↔ Margem W | Chefe bloqueia recuo; Leste só depois do Colosso; escolha de resgate |
| Margem (margem) | W ↔ Heliponto E; S ↔ Acampamento N | Ato 2 |
| Acampamento (acampamento) | N ↔ Margem S; S ↔ Ninho N | S requer terminal |
| Ninho (ninho) | N ↔ Acampamento S | Fechado durante a Matriarca |

**Invariante:** para toda porta A→B, o destino deve conter a entrada recíproca B→A (exceto passagem declarada unilateral), com orientação, posição, animação, fechadura e colisores compatíveis.

## 4. P0 — Transições e continuidade de cenários
1. Criar um controlador único com estados: ready → approach → opening → fadeOut → switch → fadeIn → cooldown → ready. Somente uma transição por vez; ignorar teclas e colisão durante o processo.
2. Para **portas físicas** usar E quando próximo, olhando para a porta: prompt legível, indicador de alcance, maçaneta/painel, abertura visual e sonora; somente atravessar após abertura completa. Para **portões externos** pode existir passagem por movimento depois de já abertos, desde que o jogador tenha de fato cruzado o plano do vão, não apenas tocado a borda do mapa.
3. Posicionar Marina **depois** do limiar da porta correspondente no cenário de destino, apontando no sentido da caminhada. Aplicar bloqueio curto contra reentrada, sem empurrão brusco, câmera teletransportada para lugar errado ou segundo fade automático.
4. Carregar área seguinte assíncrona e preparar materiais/shaders quando possível antes da passagem. Nunca alterar o estado do jogo se o carregamento falhar: manter a área antiga e apresentar erro recuperável.
5. Preservar HP, colete, balas, recarga, arma escolhida, flags, documentos, objetivos, contagem de mortes, mortes de inimigos, alertas e dados do combo. Não rearmar bosses ou cutscenes já concluídos.
6. Crossfade de chuva, ambiência, iluminação e pós-processamento sem cortes abruptos. A geometria deve explicar a passagem: túnel vira túnel, portão vira pátio, trilha vira margem; elementos de fronteira podem ser reaproveitados em ambas as áreas.
7. Para mudança com diálogo/cartão, finalizar ou transferir falas válidas sem narrar uma cena abandonada; evitar cartão de história antes do fade terminar.
8. Automatizar auditoria de portas com IDs, sentidos, raio de interação, ponto de chegada sem colisão e zona segura de reaparição.

**Aceite P0:** todas as ligações percorridas nos dois sentidos (quando permitido), 30 passagens seguidas sem loop de fade, sem entrada no meio de parede, sem perda de inventário ou de inimigos sobreviventes.

## 5. P0 — Portas, fechaduras e feedback
- Estados formais: locked, unlockedClosed, opening, open, closing, temporarilyBlocked, destroyed (somente se previsto pela narrativa). Estado lógico independente do modelo 3D.
- Sinalização por cor/luz, nome do destino, indicação do requisito exato e feedback de E. Não repetir som de porta trancada a cada quadro; limitar aviso por cooldown.
- Porta bloqueada mantém colisão; remover colisor **só quando a abertura permitir passagem**; restaurar ao fechar, sem atingir Marina ou NPC.
- Portões sem energia não se abrem; energia restaurada altera luz e estado permanentemente; código da Dra. Lima abre o heliponto; batalha bloqueia saída durante arena; terminal libera caminho do ninho.
- Travas temporárias (lockdown, boss, hack, resgate) precisam de estado reconstituível se o jogador salvar, morrer ou trocar de área; proibir saltos artificiais por E enquanto trava estiver ativa.
- Reavaliar pathHint para evitar sugerir atalhos por portas bloqueadas quando o objetivo estiver inacessível; orientar primeiro para a condição a cumprir.
- Acessibilidade: opção de passagem automática nos portões externos, mantendo E obrigatório para portas internas/painéis.

## 6. P0 — Documentos e lugares que fazem sentido
Cada registro possui objeto físico, posição alcançável, suporte, iluminação, ícone discreto no radar, interação E, e uma entrada persistente na aba **Arquivo** (lidos e não lidos). Não usar o mesmo tablet azul genérico em toda localização; a representação precisa corresponder ao conteúdo. Conservar IDs e textos já existentes para não quebrar saves e finais.

| ID | Área atual | Colocação / representação a revisar ou melhorar |
|---|---|---|
| log1 | Cais | Manifesto de carga na prancheta de despacho, junto ao embarque e aos contêineres |
| log2 | Ruínas | Caderno de arqueologia no apoio da escavação, próximo ao altar, sem bloquear a escopeta |
| log3 | Laboratório | Diário da Dra. Lima sobre bancada no anexo científico |
| log4 | Pântano | Ordem de manutenção afixada junto ao painel real do gerador |
| log5 | Laboratório | Gravação do Brandt no terminal da sala da diretoria; inacessível até abrir a sala |
| log6 | Pátio | Relatório de segurança na guarita/mesa da equipe de vigilância |
| log7 | Heliponto | Gravador de voo entre os destroços do helicóptero, com caminho seguro para leitura |
| log8 | Pântano | Etiqueta física na caixa RAIZ-3 rompida perto da margem leste |
| log9 | Heliponto | Rádio de campo Tellus-2 sobre uma caixa ou posto de comunicação |
| log10 | Margem | Relatório em bolsa/equipamento da equipe junto ao barco encalhado |
| log11 | Acampamento | Ordem confidencial no posto de comando, próxima ao quadro de operações |
| log12 | Acampamento | Tablet do Brandt em barraca/escritório ou bagagem deixada na fuga |
| log13 | Ninho | Câmera de campo número 4 acoplada a tripé/poste de observação |

**Aceite:** todos os 13 registros acessíveis sem atravessar geometrias; coleta uma única vez; possibilidade de reler o texto no Arquivo; logs de provas só afetam diálogo/final se efetivamente descobertos; marcador do radar distingue não lido/lido; nenhum documento é perdido pelo streaming.

## 7. P0 — Backtracking que causa acontecimentos
- Conservar permanentes: inventário e itens fixos recolhidos; dinossauros mortos; portões abertos; documentos lidos; flags; decisões de Brandt e do ninho.
- Conservar temporários: adversários vivos com HP/posição/estado básico, fila de emboscada não executada, ruídos e patrulhas apenas quando coerentes. Não ressuscitar um inimigo eliminado só porque o jogador saiu por uma porta.
- Retorno **nunca pode ser uma loteria de respawn**. Criar uma tabela de encontros de revisita com ID único, condição narrativa, estágio de campanha, budget de inimigos e gatilho explicitamente motivado (energia reativada, sirene, jaulas, tiros, rastros). Cada encontro dispara no máximo o número definido por campanha e fica registrado no save.
- Exemplo 1: voltar do Pântano ao Laboratório **depois** do gerador: sirene ativa, portas iluminadas, matilha atraída pelo ruído uma única vez; sinais de briga na entrada.
- Exemplo 2: retorno Laboratório→Ruínas depois da energia: novos raptores seguindo barulho, sem ressuscitar os anteriores; restos, pegadas e marcas comunicam a mudança.
- Exemplo 3: Pátio→Laboratório depois do código: rádio/objetivo atualizado, patrulhas sobreviventes reais; não repetir a fala de entrada nem recompensas.
- Exemplo 4: Heliponto→Margem→Acampamento→Margem: mudança depois da fuga de Brandt ou do alarme do acampamento; encontro roteirizado apenas se ainda não ocorreu, seguido de área limpa.
- Inimigos entram por portas, matagal, lama, jaulas ou locais ocultos, com áudio/pistas de aproximação. Evitar surgimento instantâneo diante da câmera, atravessando portões ou sobre Marina.
- Criar versões leve/médio/alto do número simultâneo de inimigos por desempenho; **dificuldade não modifica** a história e as condições de desbloqueio.
- Ao voltar, NPCs, locais de registros, portas, iluminação e estruturas devem refletir as mesmas flags da narrativa.

**Aceite:** revisitar toda área ≥3 vezes; derrotados não ressurgem, encontros únicos aparecem apenas em sua condição, sobreviventes retêm HP e localização, não há farm infinito de PE/pontos, e save/load não multiplica encontros.

## 8. P0 — Novo combo de dinossauros eliminados sem sofrer golpes, até o próximo cenário
**Não destruir o combo existente.** Separar dois conceitos:
- **Combo de cadência:** multiplicador atual de abates em até 2,5 s, máximo 4x, mantém pontuação já conhecida. Congelar contagem durante o fade e pausas; evitar reset em troca de área.
- **Sequência limpa por trecho:** inicia com o primeiro dinossauro morto em uma área; cada novo abate até a próxima porta incrementa o contador, mesmo que se passem mais de 2,5 s. Qualquer **golpe válido recebido** (mesmo que absorvido integralmente pelo colete) quebra a sequência. Atualizar indicador no HUD: “SEM DANO — 3 ABATES”.
- Ao completar travessia real para o próximo cenário, fechar o trecho e conceder **bônus único de travessia limpa** se houver ao menos dois abates e nenhum golpe. Sugestão de níveis a calibrar: 2 abates = +10 PE; 3–4 = +25 PE; 5–7 = +50 PE; 8+ = +80 PE. Chefes e eventos podem continuar com seus próprios bônus atuais, **sem dupla remuneração** pelo mesmo evento.
- Começar novo trecho na área de destino. Painel da nova área pode mostrar por ~2 s “TRAVESSIA LIMPA +25 PE”, abates, precisão e dano; conservar melhor sequência do jogo como estatística.
- Considerar hit quando hurtPlayer realmente processar um ataque e não durante invulnerabilidade do fade. Usar contador de golpes recebidos distinto de G.dmgTaken (que mede HP perdido depois do colete). Dano ambiental confirmado também conta como golpe; dano autoinfligido pode contar se realmente reduzir recursos.
- Terminal de save, leitura de documento, pausa e menu não concedem combo nem permitem duplicar recompensa. Morrer zera sequência; sair e voltar à mesma área sem nova eliminação não gera PE. Se a troca falhar, não concluir trecho. Save/load restaura estado ou encerra sem prêmio conforme regra única documentada — nunca duplicar.
- Barra discreta e legível; feedback de abate sequencial, quebra da sequência com som e indicador simples; acessibilidade sem piscadas excessivas.

**Aceite:** matar três raptores sem golpe, entrar no laboratório e receber exatamente um bônus; golpe absorvido pelo colete cancela; voltar pela porta sem novos abates não paga novamente; troca de área não apaga o combo de cadência sem motivo; morte, pausa e save não duplicam PE.

## 9. P1 — Coerência narrativa, mapa e acabamento
- Cada alteração do mapa (energia, jaulas, incêndio apagado, ninho destruído) muda luz, áudio, obstáculos e placas também em revisitas.
- Os documentos devem conduzir uma cadeia de pistas: RAIZ → V-7 → sabotagem → evacuação → caixas/ovos → Tellus-2 → Brandt → Matriarca, sem antecipar descobertas que a Marina não fez.
- O mapa (Tab) mostra portas conhecidas, fechado/aberto, área atual, documentos ainda não lidos, local dos terminais e última área explorada, sem revelar segredos cedo demais.
- Melhorar animação de abrir/fechar portas e microcena de travessia sem perder a câmera no ombro; não sacrificar FPS em dispositivos modestos.
- Tornar o destino visível por arquitetura coerente: porto/ruínas (trilha), ruínas/laboratório (portão da pesquisa), laboratório/pântano (passagem de manutenção), laboratório/pátio (cerca elétrica), pátio/heliponto (barreira de segurança), heliponto/margem (trilha do penhasco), margem/acampamento (caminho do rio), acampamento/ninho (portão de contenção).

## 10. Implementação por fases (prioridade)
**P0-A**: adicionar validação estática de grafo de portas + entrada segura; corrigir triggers e feedback das portas; testes básicos reversíveis.
**P0-B**: centralizar transição/streaming/sync visual e colisores; certificar 9 áreas, duas direções e saves.
**P0-C**: representar fisicamente documentos, Arquivo e mapa; testar os 13 IDs e finais.
**P0-D**: enriquecer memória/revisita com tabela de novos encontros e não reaparição de mortos; testar flags e saves.
**P0-E**: adicionar sequência sem dano por trecho e bônus no cenário seguinte; testar ataques com colete.
**P1**: pistas visuais, iluminação/ambiente, animações, polimento e medições de FPS.

## 11. Matriz de QA obrigatória
1. Início→Cais→Ruínas→Laboratório; retorno até Cais; todas as transições sem spawn fora do mapa.
2. Laboratório→Pântano→gerador→Laboratório; energia abre o portão norte; matilhas de revisita aparecem só uma vez.
3. Laboratório→Pátio→escolta/terminal→Heliponto; entrada bloqueada antes do código; saída do heliponto bloqueada durante Colosso.
4. Colosso morto: caminhar sobre H **sem E** não encerra; E inicia extração; alternativamente sair para Margem e iniciar Ato 2.
5. Margem↔Acampamento↔Ninho: portão do terminal, luta da Matriarca, estados de Brandt, finais alternativos.
6. Testar todos os treze documentos nas coordenadas reais, acessibilidade E, salvamento, releitura e contagem 9→13.
7. Matar inimigo, sair e voltar: morto continua morto, vivo preserva HP, emboscada adiada reaparece na ordem certa.
8. Combo: 0/1/2/3/5 abates, dano no HP, colete totalmente absorvido, fade, pausa, save, morte, troca recíproca e reentrada sem abates.
9. Qualidade Baixo/Médio/Alto; 50 transições; verificar que quantidade de geometrias/texturas não cresce continuamente.
10. Rodar **node --test tests/coherence.test.mjs** e novos testes puros de portas, progressão, registros e combo; fazer playtest em navegador com WebGL e registrar capturas, console e resultados.

## 12. Definição de pronto e relatório
Cada item concluído precisa de: (a) arquivo/linha ou commit, (b) teste automatizado reproduzido, (c) teste real de navegador quando alegado, (d) antes/depois, (e) pendências honestas. Não declarar “testado no navegador” se houver apenas inspeção estática ou simulações. Manter revisão compatível com saves anteriores, preferindo migração de schema em vez de apagar progresso. Publicar no GitHub Pages só depois de verificar carregamento, controles, transições e ausência de regressões.

**Nota:** este documento descreve a evolução desejada. Sua publicação não equivale a implementar as mudanças.
