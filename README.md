# Crise no Vale

Jogo de ação e sobrevivência em terceira pessoa feito em Three.js (r160) com módulos ES. Projeto original, inspirado na *estrutura* dos survival-horror de áreas conectadas da era PS1: exploração, portas trancadas, objetivos, terminais de save e um chefe no final. Não usa nenhum asset, nome ou mapa de outro jogo.

## História

A **Estação de Pesquisa Vale Verde**, da Fundação Tellus, estudava DNA preservado em âmbar (o **Projeto RAIZ**). Para "domar" os animais recriados, a equipe testou o composto **V-7**: ele apagou o medo dos dinossauros e os deixou atraídos por barulho. Na noite da tempestade, o diretor **Otávio Brandt** tirou o fusível de partida automática do gerador para cobrir a fuga com o apagão, trocou as senhas do heliponto e fugiu com as amostras. As cercas elétricas caíram. O **Espécime Zero — o Colosso** — derrubou o helicóptero dele no penhasco.

Você é a agente **Marina Rocha**, enviada depois de três dias de silêncio do rádio. Sua missão é achar a última sobrevivente, a **Dra. Helena Lima**, e sair do vale com o piloto **Garça-1**.

- **Introdução** com cartões de história depois de "Novo jogo". Clique ou Espaço avança, Enter pula.
- **7 registros** (tablets azuis) espalhados pelas áreas. Aproxime-se e aperte **E** para ler. Cada um vale +150 pontos e é guardado no save.
- **Sala da diretoria** opcional no laboratório (lado oeste). Ela é destrancada quando a energia volta e guarda a gravação particular do diretor.
- **Falas de rádio e diálogos** com legendas: Lima comenta a escolta, reage aos registros e conversa depois do código.
- **Cenas curtas** em cada marco: energia, código do heliponto, chegada ao Colosso, morte do chefe e resgate.
- **Epílogo variável**: muda conforme você achou as provas contra Brandt (registros 4 e 5) e se encontrou todos os 7.

## Como jogar

Os módulos ES precisam de um servidor HTTP (não funciona abrindo via `file://`):

```bash
cd crise-no-vale
python3 -m http.server 8000
# abra http://localhost:8000
```

O Three.js vem do CDN jsDelivr via importmap, então é preciso estar online. O bloom usa os *addons* oficiais da mesma versão (`three/addons/`, r160). Se eles não carregarem, o jogo segue sem bloom.

### Controles

| Tecla | Ação |
|---|---|
| WASD | mover (Shift corre) |
| Mouse | mirar / girar a câmera (clique na tela para travar o cursor) |
| Clique esquerdo | atirar |
| Botão direito | mirar com zoom |
| R | recarregar |
| 1 / 2 / Q | pistola / escopeta / alternar |
| G | lançar granada |
| H | usar kit médico |
| E | interagir (terminal de save, gerador, sobrevivente, registros) |
| Espaço / clique · Enter | avançar / pular cartões de história |
| B | bloom liga/desliga (desliga sozinho se o FPS cair) |
| Tab | mapa do vale |
| V | trocar ombro da câmera |
| P / Esc | pausar |
| M | som liga/desliga |

## Áreas

| # | Área | Clima | Conteúdo |
|---|---|---|---|
| 1 | **Cais do Porto** | noite azulada, chuva | início, terminal de save, emboscada entre os contêineres |
| 2 | **Corredor das Ruínas** | âmbar, neblina densa | **escopeta** no altar, emboscada na primeira passagem |
| 3 | **Exterior do Laboratório** | cinza, sem energia | hub: portas para ruínas (S), pântano (O) e pátio (N, **sem energia**); save; **sala da diretoria** (opcional) |
| 4 | **Trilha do Pântano** | verde, neblina pesada | **gerador** (evento de defesa de 20 s) |
| 5 | **Pátio da Instalação** | holofotes brancos | sobrevivente **Dra. Lima**, escolta, terminal de controle, save |
| 6 | **Heliponto do Penhasco** | vermelho | chefe **Colosso** e resgate final |

```
            [Pátio]──🔒──[Heliponto]
               │🔒
[Pântano]──[Laboratório]
               │
           [Ruínas]
               │
            [Cais]
```

## Progressão

1. **Cais → Ruínas → Laboratório.** Pegue a escopeta no caminho.
2. **Ligar a energia.** O portão norte do laboratório está sem energia. No pântano, ligue o gerador (E). O barulho atrai a matilha: fique perto dele por 20 s enquanto chegam três grupos de inimigos. A energia volta, as lâmpadas acendem e o portão abre. Depois disso as ruínas e o laboratório ganham novos encontros.
3. **Escolta.** No pátio, fale com a Dra. Lima (E). Ela passa a seguir você. Leve-a até o terminal de controle no nordeste, protegendo-a de raptores e de um bruto que arromba o galpão. Ela digita o código e libera o portão leste. Se você sair do pátio antes disso, a escolta reinicia.
4. **Chefe.** No heliponto, o portão se fecha atrás de você e o **Colosso** ataca:
   - Ele investe em linha reta e pisa no chão em área.
   - Ele chama raptores nas fases de vida.
   - Quando bate numa parede fica atordoado e leva +50% de dano. Granadas também o atordoam.
5. **Resgate.** Com o Colosso morto, suba na marca H e aguente 14 s até o helicóptero chegar. No fim você recebe um rank (S–D) calculado pelo tempo, pela precisão e pelo número de saves.

### Regras do mundo

- Inimigos de patrulha mortos **continuam mortos**, e itens coletados não voltam.
- Encontros com roteiro disparam ao entrar numa área, ao pisar numa zona ou quando uma flag muda.
- **Terminais de save** ficam no cais, no laboratório e no pátio. Eles restauram toda a vida e gravam o progresso no `localStorage`. "Continuar" no menu retoma do último terminal.
- Munição: a pistola tem reserva infinita. A escopeta usa cartuchos encontrados no mapa ou deixados por inimigos.
- Inventário: até 4 kits médicos e 5 granadas.
- Atirar faz barulho e atrai inimigos próximos.

## Gráficos

Tudo é procedural, sem arquivos de imagem ou modelo:
- **Texturas** em canvas com ruído, manchas, escorridos e relevo (*bump*): concreto, paralelepípedo, lama, ferrugem, chapa corrugada, escamas dos dinossauros. Superfícies molhadas têm brilho, e as poças recebem ondulações de chuva.
- **Cenário**: contêineres corrugados, caixas com cintas, portões com placas de destino, árvores por bioma (palmeira, pântano), barco afundado, destroços de helicóptero em chamas, torres de holofote e janelas que acendem quando a energia volta.
- **Personagens**:
  - Rocha com colete, cinto, coldre, ombreiras e armas detalhadas.
  - Lima com jaleco aberto, crachá, óculos e tablet; ela acena quando você chega.
  - Dinossauros com tronco orgânico, dentes, garras e textura de escamas. O Colosso tem cicatrizes incandescentes.
- **Iluminação**:
  - Pool fixo de luzes por área (não recompila *shaders*): lâmpadas com halo, fogo tremulante e holofotes varrendo o pátio e o heliponto.
  - Clarão quente quando a energia volta.
  - Arena do chefe com névoa vermelha e luz que acompanha o Colosso.
- **Efeitos**:
  - Clarão de tiro, sangue e faíscas alongadas.
  - Explosões com luz real e fumaça, e onda de choque dupla no pisão.
  - Chuva, relâmpagos e vaga-lumes.
  - Helicóptero de resgate com rotor, luzes de navegação e holofote de busca.
- **Pós-processamento** opcional (bloom em meia resolução), granulado de filme e vinheta.

## Estrutura

```
index.html        HUD, menus, importmap do Three r160
css/main.css      telas e menus
css/hud.css       HUD, mapa, barras
js/config.js      balanceamento: armas, inimigos, chefe, câmera, pontuação
js/state.js       estado global, recorde e save (localStorage)
js/world.js       renderer, cena, luzes, colisão 2D e construtores de cenário
js/areas.js       definição das 6 áreas (portas, itens, patrulhas, encontros, clima)
js/director.js    progressão: troca de área, travas, eventos, encontros, save/load, objetivos, registros, helicóptero
js/story.js       roteiro: introdução, registros, falas/legendas, cartões de história e epílogo
js/post.js        bloom opcional (addons do Three r160), com fallback
js/player.js      jogador, armas, inventário, câmera em terceira pessoa
js/enemies.js     raptor, cuspidor, bruto e Colosso (IA, ataques)
js/npc.js         sobrevivente (seguir, ser atacada)
js/combat.js      tiros, dano, granadas, itens e drops
js/fx.js          partículas e efeitos
js/audio.js       efeitos sonoros via WebAudio
js/input.js       teclado e mouse
js/ui.js          HUD, radar, mapa das áreas, banners, telas
js/main.js        loop principal e estados (menu, jogo, pausa, fim)
js/utils.js       utilitários
```

### Depuração

No console, `__game` expõe o estado (`area`, `flags`, `objective`, `hp`, `enemies`). Também tem `__game.goto('patio')` para pular de área, `__game.story` (ex.: `__game.story.skipCard()`) e `__game.post` (bloom).

Os saves antigos continuam compatíveis: o campo `story` (registros lidos e falas já ditas) é opcional.
