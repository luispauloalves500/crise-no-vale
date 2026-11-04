# Auditoria de desempenho e jogabilidade — 04/11/2026

> Os números de WebGL/RTX 4060 abaixo foram declarados na auditoria anterior, recebida como patch. Não foram reproduzidos nesta continuação: o navegador disponível registrou `GL_RENDERER = Disabled` e não criou contexto WebGL. As verificações desta continuação estão no final do documento.

Método: versão publicada no GitHub Pages aberta num Chromium com WebGL real (RTX 4060, 902×675, qualidade Alto, bloom ligado), percorrendo as 9 áreas com `__game.goto`, medindo quadros por segundo, tempo de CPU por quadro e contagem de render, e exercitando combate, granada, troca de arma, pontos e pausa. Mais leitura estática do código e dos modelos GLB.

## Resultado geral
- Nenhum erro de JavaScript, nenhuma promessa rejeitada e nenhuma tarefa longa durante toda a sessão.
- 60 fps (limitado pelo vsync) nas 9 áreas; CPU por quadro de 1,2 a 1,9 ms em média (p95 ≤ 4,8 ms).
- Memória JS estável entre 79 e 119 MB; as 9 áreas ficam construídas no preset Alto, sem descarte.
- Combate, abate (+10 PE, +100 pontos num raptor), granada, troca de arma e pausa ao perder o foco funcionaram.

## Gargalos encontrados
1. **Modelos de arma e NPC pesadíssimos (principal).** Cada área desenhava ~950 mil triângulos, quase todos de um único objeto: a pistola tinha **866 mil triângulos (20 MB)**. A submetralhadora tem 458 mil (14 MB) e a Dra. Lima 244 mil (10 MB), que somam 1,19 M triângulos no pátio. Numa GPU forte não aparece; em notebook com vídeo integrado ou celular é a primeira causa de queda de fps, além de ~45 MB de download.
2. **Pico ao entrar no acampamento.** Os programas de shader subiram de 74 para 90 na primeira visita, com um quadro de 21,9 ms de CPU. A pré-compilação em `boot()` só cobre o cais.
3. **`__game.renderInfo()` enganoso com bloom.** Mostrava 1 chamada e 1 triângulo, porque o compositor faz várias passagens e a contagem era zerada a cada uma.
4. **404 a cada abertura** ao pedir `marina.min.glb` (só existe o `.b64`).
5. **Repositório pesado:** `assets/originais` tem 76 MB que nenhum código usa.

## Correções aplicadas
- Versões simplificadas dos modelos, com os originais mantidos: pistola 866 mil → 56,6 mil triângulos (20,4 → 2,0 MiB), submetralhadora 458 mil → 40 mil (14,0 → 1,6 MiB), Dra. Lima 244 mil → 36,5 mil (10,3 → 2,0 MiB, esqueleto de 66 ossos e 2 animações). Os limites geométricos têm pequenas diferenças, inferiores a 1% da dimensão de cada eixo. Arquivos `*-lod.glb`; `gun-layout.mjs` e `npc.js` apontam para eles. Para voltar atrás, restaure as URLs antigas e as contagens de partes das armas.
- `renderInfo()` correto com bloom (`renderer.info.autoReset = false` e reset uma vez por quadro).
- Modelo da Marina carregado pelo `.b64` primeiro (sem 404); CI verifica a sintaxe de todos os módulos; README corrigido.
- `tests/assets.test.mjs` cobre os três arquivos novos.

## Melhorias recomendadas (não aplicadas)
1. Preparação de shaders ampliada nesta continuação, conforme seção abaixo. Não há garantia de eliminar o pico do acampamento sem medições em GPU.
2. Tirar `assets/originais` do repositório (Git LFS ou pasta fora do repo) e as partes antigas dos GLB, depois de conferir os modelos novos no jogo.
3. Controles de toque e seletor de dificuldade (ver `IMPROVEMENTS.md`).
4. Conferir visualmente as armas e a Dra. Lima simplificadas; a validação aqui foi por contagem de triângulos, caixa delimitadora, esqueleto e testes automáticos, não por comparação de imagem.
5. Percorrer a campanha ponta a ponta com controle real (portas, fuga do Brandt, saves antigos), como lista `AUDITORIA-COERENCIA.md`.

## Continuação: integração das otimizações e variantes de renderização

O patch anterior ainda não constava no commit `8a4465c` da branch principal. Esta revisão integra seus modelos e correções, sem remover os originais, e amplia a preparação de shaders existente.

### Antes e depois medidos nos arquivos

| Modelo | Triângulos antes | Triângulos depois | Arquivo antes | Arquivo depois |
| --- | ---: | ---: | ---: | ---: |
| Glock | 866.323 | 56.610 | 21.386.832 bytes | 2.117.456 bytes |
| MP5 | 458.305 | 40.000 | 14.719.304 bytes | 1.708.260 bytes |
| Dra. Lima | 243.664 | 36.544 | 10.779.896 bytes | 2.054.436 bytes |

Somados, os três modelos passam de 46.886.032 para 5.880.152 bytes, redução de aproximadamente 87,5%. É tamanho dos arquivos; não representa o total transferido pela página nem memória de GPU ou ganho de FPS. Testes comparativos confirmam dimensões dentro de 1% por eixo, hierarquia e pose de repouso da Lima dentro de tolerância de 0,00001, mesmos 66 índices de juntas, matrizes inversas de bind e dados dos canais de Walking/Running idênticos. A aparência, os pesos da malha simplificada e as poses deformadas ainda precisam de inspeção visual.

### Preparação de shaders

Já existia uma fila serial de compilação dos cenários vizinhos. Porém, ela preparava apenas o desenho direto; no preset Alto, as áreas distantes eram construídas sem solicitar compilação. No Three.js r160, renderizar no buffer do bloom usa outra variante de espaço de cor e tone mapping.

- A preparação agora cobre saída direta e o render target do compositor, sem desenhar uma área oculta na tela ou alterar sua visibilidade.
- O alvo anterior, sua face e nível mip são restaurados no mesmo turno, antes de aguardar a GPU. Falhas síncronas e rejeições também restauram o estado.
- O compositor opcional é inicializado antes da preparação inicial. Falhar ao carregar bloom continua permitindo o desenho direto.
- Alto solicita preparação para todas as áreas mantidas; Baixo/Médio preservam o limite de área atual e vizinhas. Trocar a qualidade invalida e solicita novamente a preparação pertinente.
- A fila serial, compartilhamento de solicitações, proteção de contextos pendentes e prazo de 2,5 segundos da porta foram preservados.

Referências técnicas: [compilação no WebGLRenderer r160](https://github.com/mrdoob/three.js/blob/r160/src/renderers/WebGLRenderer.js) e [variantes em WebGLPrograms r160](https://github.com/mrdoob/three.js/blob/r160/src/renderers/webgl/WebGLPrograms.js).

### Verificação e limites

66 testes Node aprovados e sintaxe de todos os módulos JS/MJS verificada. Cinco novos testes cobrem restauração do alvo durante compilação pendente, falhas e ausência de compileAsync, orçamento/dimensões dos LODs e compatibilidade do esqueleto/animações. O navegador da prévia falhou na criação de WebGL; não foi possível conferir visualmente os modelos, jogar ou medir tempos/FPS. Os testes de renderizador usam simulação; não certificam compilação real em GPU.

Construção procedural e início da compilação continuam executando trabalho na thread principal. Upload de texturas/geometria, bloom e modelos carregados mais tarde podem causar picos. A prioridade seguinte é comparar visualmente os LODs e percorrer os dois atos em WebGL, medindo as trocas antes de fazer novas alterações de desempenho.
