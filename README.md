# Crise no Vale

Jogo de sobrevivência em terceira pessoa feito em **Three.js**, com câmera atrás do personagem. Ele é *inspirado em Dino Crisis 2*. Você está numa ruína tomada pela selva, à noite e debaixo de chuva, e precisa sobreviver a 5 ondas de dinossauros.

Todo o visual é feito com geometria low-poly procedural e texturas geradas em canvas. Todos os sons são sintetizados com a Web Audio API. O projeto não tem nenhum arquivo de imagem, modelo ou áudio externo.

## Como jogar

- Elimine todos os dinossauros de cada onda. Entre as ondas há uma pausa curta com contagem regressiva.
- **Raptor** (laranja no radar): rápido, chega pelos lados em arco e dá botes.
- **Cuspidor** (verde): mantém distância e cospe ácido. O leque laranja se abre logo antes do cuspe.
- **Bruto** (vermelho): enorme e resistente. Ele pisca e ruge antes de investir. Se você desviar, ele bate na parede e fica atordoado por alguns instantes.
- Os **kits médicos** (cruz vermelha) e as **caixas de munição** (amarelas) aparecem no começo de cada onda e às vezes caem dos inimigos abatidos.
- Abates em sequência rápida ativam o **combo**, que multiplica os pontos até x4.
- O seu recorde fica salvo no navegador.

## Controles

| Ação | Tecla |
|---|---|
| Mover | W A S D |
| Correr | Shift |
| Olhar / mirar | Mouse |
| Atirar | Botão esquerdo (ou Espaço) |
| Mirar com precisão (zoom) | Botão direito |
| Recarregar | R |
| Trocar arma | 1 / 2 / Q |
| Trocar ombro da câmera | V |
| Som liga/desliga | M |
| Pausar | P / Esc |

## Como rodar

O jogo usa **módulos ES**, então precisa ser servido por HTTP. Abrir o `index.html` direto (`file://`) não funciona. Rode qualquer servidor estático na pasta do projeto:

```bash
npx serve .
# ou
python3 -m http.server 8000
```

Depois abra `http://localhost:3000` (serve) ou `http://localhost:8000` (python).

Não é preciso build nem `npm install`. Para publicar, basta ativar o **GitHub Pages** (branch `main`, pasta raiz).

### Dependência (CDN)

O Three.js **r160 (`three@0.160.0`)** é carregado pelo **jsDelivr** com um *importmap* no `index.html`:

```
https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js
```

Para jogar offline, baixe esse arquivo para `vendor/three.module.js` e troque o endereço no importmap.

## Estrutura

```
index.html        estrutura da página, importmap e telas (menu, pausa, fim)
css/main.css      layout, menus, painéis do HUD
css/hud.css       elementos dinâmicos do HUD (retícula, marcador de acerto, radar, banners)
js/main.js        inicialização, estados do jogo (menu/jogo/pausa/vitória/derrota) e diretor de ondas
js/config.js      balanceamento: armas, inimigos, ondas, câmera
js/state.js       estado compartilhado (pontos, onda, mira...)
js/input.js       teclado, mouse e pointer lock
js/audio.js       efeitos sonoros sintetizados (Web Audio)
js/world.js       cena, iluminação, cenário, chuva/relâmpagos, colisão e raycast 2D
js/player.js      personagem, armas, vida e câmera em terceira pessoa
js/enemies.js     modelos, IA e spawn dos dinossauros (raptor, cuspidor, bruto)
js/combat.js      tiros, acertos, dano, combo e itens
js/fx.js          partículas, rastros de tiro e manchas (com pool)
js/ui.js          HUD, radar, textos em português e telas
js/utils.js       funções auxiliares (aleatórios, texturas procedurais, pools)
```

## Créditos e inspiração

- Inspirado em **Dino Crisis 2** (Capcom, 2000). Este é um projeto de fã, sem fins comerciais e sem ligação com a Capcom. O projeto não usa nenhum asset, nome de personagem, modelo, som ou imagem do jogo original.
- Renderização feita com [Three.js](https://threejs.org) (licença MIT).
- Código, modelos procedurais e sons criados para este projeto.
