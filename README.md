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

## Jogar online

**https://luispauloalves500.github.io/crise-no-vale/**

O jogo roda direto no navegador (desktop, com teclado e mouse), sem instalar nada. O GitHub Pages republica o site a cada push na branch `main`.

- O repositório traz o workflow `.github/workflows/pages.yml` ("Publicar no GitHub Pages"), que publica só `index.html`, `css/` e `js/`.
- Para o workflow assumir a publicação, ajuste uma vez **Settings → Pages → Source: GitHub Actions** (https://github.com/luispauloalves500/crise-no-vale/settings/pages). Enquanto a fonte for "Deploy from a branch" (`main`, raiz), o site continua sendo atualizado do mesmo jeito.
- Os caminhos são relativos (`<base href="./">`) e o Three.js vem do CDN, então o jogo funciona em `/crise-no-vale/`.

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
| E perto da Dra. Lima caída | levantá-la na hora (escolta) |

### Áudio

Todo o som é gerado no navegador com WebAudio; não há nenhum arquivo de áudio. O navegador só libera o som depois do primeiro clique ou tecla. Por isso o ambiente começa quando você clica em "Novo jogo".

- Cada área tem um **ambiente próprio**: chuva, vento, mar, insetos, zumbido elétrico, alarme e tensão. A troca de área faz um crossfade. O ambiente muda com a energia, o gerador, o lockdown, a escolta e o chefe.
- Os **passos** mudam conforme o terreno, e o Colosso faz passos pesados que você ouve antes de ver.
- Na **pausa** e nos **cartões de história** o som fica abafado.
- **M** liga e desliga todo o som.

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
3. **Escolta.** No pátio, fale com a Dra. Lima (E). Ela passa a seguir você. Leve-a até o terminal de controle no nordeste, protegendo-a de raptores e de um bruto que arromba o galpão. Ela aguenta uma mordida. Na segunda ela cai: chegue perto e aperte **E** para levantá-la. Ela digita o código e libera o portão leste. Se você sair do pátio antes disso, a escolta reinicia.
4. **Chefe.** No heliponto, o portão se fecha atrás de você e o **Colosso** ataca:
   - Ele investe em linha reta e pisa no chão em área.
   - Ele chama raptores nas fases de vida.
   - Quando bate numa parede fica atordoado e leva +50% de dano. Granadas também o atordoam.
   - v5: um **anel vermelho** no chão avisa o pisão e uma **faixa** mostra a direção da investida.
5. **Resgate.** Com o Colosso morto, suba na marca H e aguente 14 s até o helicóptero chegar. No fim você recebe um rank (S–D) calculado pelo tempo, pela precisão e pelo número de saves.

### Momentos com roteiro (v5)

- **Protocolo da diretoria:** com a energia de volta, a sala do Brandt tranca você por 7 s e a sirene chama a matilha para o corredor.
- **A lama ferve:** no meio do pântano, raptores saem de dentro da lama. As bolhas avisam antes.
- **Rádio interceptado:** depois do código do heliponto, uma transmissão da Tellus-2 aparece e entra no epílogo.

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

## Desempenho e qualidade

O jogo foi ajustado para não travar ("engasgar") em máquinas modestas:

- **Carregamento progressivo.** Uma tela "Carregando…" com barra mostra o progresso. Só o cais é montado antes do menu; os modelos de inimigos vão para um pool e os shaders são pré-compilados. As outras áreas são construídas em segundo plano, uma por fatia ociosa do navegador, e o menu mostra "Áreas prontas: n/6".
- **Qualidade gráfica** (menu principal e pausa): **Auto**, **Baixo**, **Médio** ou **Alto**. A escolha fica salva no navegador.

| | Baixo | Médio | Alto |
|---|---|---|---|
| Mapa de sombras | 512, simples | 1024, suave | 2048, suave |
| Sombras de árvores distantes e objetos pequenos | não | não | sim |
| Resolução máxima (pixel ratio) | 1× | 1,25× | 1,75× |
| Gotas de chuva / vaga-lumes | 250 / 40 | 500 / 80 | 900 / 140 |
| Bloom (padrão; a tecla B continua valendo) | desligado | ligado | ligado |
| Textura do chão | 256 px | 512 px | 512 px |
| Postes iluminados / holofotes | 4 (alcance menor) / 1 | 6 / 2 | 6 / 2 |
| Áreas na memória | atual + vizinhas | atual + vizinhas | todas |

- **Auto** escolhe pelo aparelho (memória, núcleos, celular, GPU; renderizador por software cai em Baixo). Se o FPS ficar abaixo de ~36 por 6 s durante o jogo, ele desce um nível.
- O bloom ainda se desliga sozinho se o FPS cair, como antes.

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
js/quality.js     predefinições de qualidade (Auto/Baixo/Médio/Alto) e queda automática
js/idle.js        fila de tarefas em fatias ociosas (construção de áreas em segundo plano)
js/player.js      jogador, armas, inventário, câmera em terceira pessoa
js/enemies.js     raptor, cuspidor, bruto e Colosso (IA, ataques)
js/npc.js         sobrevivente (seguir, ser atacada)
js/combat.js      tiros, dano, granadas, itens e drops
js/fx.js          partículas e efeitos
js/audio.js       áudio procedural via WebAudio: mixagem, ambiente por área, abafar, passos, stingers
js/input.js       teclado e mouse
js/ui.js          HUD, radar, mapa das áreas, banners, telas
js/main.js        loop principal e estados (menu, jogo, pausa, fim)
js/utils.js       utilitários
.github/workflows/pages.yml  publicação no GitHub Pages
```

### Depuração

No console, `__game` expõe o estado (`area`, `flags`, `objective`, `hp`, `enemies`). Também tem `__game.goto('patio')` para pular de área, `__game.story` (ex.: `__game.story.skipCard()`) e `__game.post` (bloom). Para desempenho: `__game.quality`, `__game.setQuality('baixo')`, `__game.areas()` (áreas construídas), `__game.streamStats`, `__game.poolStats`, `__game.hudStats` e `__game.renderInfo()`. Áudio (v5): `__game.ambience` (camada atual), `__game.muted` e `__game.toggleMute()`.

Os saves antigos continuam compatíveis: o campo `story` (registros lidos e falas já ditas) é opcional.
