# Crise no Vale

Jogo de ação e sobrevivência em terceira pessoa feito em Three.js (r160) com módulos ES. Projeto original, inspirado na *estrutura* dos survival-horror de áreas conectadas da era PS1: exploração, portas trancadas, objetivos, terminais de save e um chefe no final. Não usa nenhum asset, nome ou mapa de outro jogo.

Você chega de barco a uma estação de pesquisa abandonada no Vale Verde. A energia caiu, dinossauros tomaram a selva e a única saída é o heliponto no penhasco.

## Como jogar

Os módulos ES precisam de um servidor HTTP (não funciona abrindo via `file://`):

```bash
cd crise-no-vale
python3 -m http.server 8000
# abra http://localhost:8000
```

O Three.js vem do CDN jsDelivr via importmap, então é preciso estar online.

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
| E | interagir (terminal de save, gerador, sobrevivente) |
| Tab | mapa do vale |
| V | trocar ombro da câmera |
| P / Esc | pausar |
| M | som liga/desliga |

## Áreas

| # | Área | Clima | Conteúdo |
|---|---|---|---|
| 1 | **Cais do Porto** | noite azulada, chuva | início, terminal de save, emboscada entre os contêineres |
| 2 | **Corredor das Ruínas** | âmbar, neblina densa | **escopeta** no altar, emboscada na primeira passagem |
| 3 | **Exterior do Laboratório** | cinza, sem energia | hub: portas para ruínas (S), pântano (O) e pátio (N, **sem energia**); save |
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

## Estrutura

```
index.html        HUD, menus, importmap do Three r160
css/main.css      telas e menus
css/hud.css       HUD, mapa, barras
js/config.js      balanceamento: armas, inimigos, chefe, câmera, pontuação
js/state.js       estado global, recorde e save (localStorage)
js/world.js       renderer, cena, luzes, colisão 2D e construtores de cenário
js/areas.js       definição das 6 áreas (portas, itens, patrulhas, encontros, clima)
js/director.js    progressão: troca de área, travas, eventos, encontros, save/load, objetivos
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

No console, `__game` expõe o estado (`area`, `flags`, `objective`, `hp`, `enemies`). Também tem `__game.goto('patio')` para pular de área.
