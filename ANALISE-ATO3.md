# Análise do jogo e design do Ato 3 (v11)

Base analisada: `luispauloalves500/crise-no-vale` @ `d15d17c` (v10.1), publicada em https://luispauloalves500.github.io/crise-no-vale/.

## 1. Pontos fortes
- Arquitetura modular e limpa (ES modules, Three.js r160 via CDN). O `director.js` concentra flags/eventos, e `areas.js` é declarativo (dados + `build`).
- **Streaming de áreas** (`streamAround`/`warmArea`), sementes determinísticas por índice (`SEED+i*101`), **LOD** em armas e NPC (`*-lod.glb`), Marina em `.min.glb.b64` (sem 404), aquecimento de shader (`shader-warmup`) e árvores instanciadas por setor.
- Narrativa coesa e original: 13 registros, falas de rádio, cartões, finais que mudam com as escolhas, Atos 1 e 2 com 2 + 4 desfechos.
- Sistemas maduros: save em terminal com migração, PE/loja TELLUS, portas validadas por grafo (`door-safety.mjs`), passagens curtas entre áreas e 66 testes de Node que rodam sem navegador.

## 2. Bugs e riscos abertos (encontrados na análise)
- `node --test tests/` falha no Node 22+ (forma de caminho). Use `node --test tests/*.test.mjs` (documentado).
- O epílogo do Ato 2 tinha o texto fixo **"todos os 13 registros"** e usava `TOTAL_LOGS`. Corrigido: agora conta só os registros dos Atos 1 e 2.
- O fim do Ato 2 chamava o resgate direto, sem gancho para continuar. Corrigido com a escolha no helicóptero.
- `assets/originais/` (54 MB) não é usada pelo código e pesa no clone. Foi documentada em `assets/originais/LEIA-ME.md`, sem mover nem apagar. O arquivo `Jill Valentine.glb` tem nome de personagem de outra franquia (risco de IP, apontado ali).
- Os testes leem `director.js`/`areas.js` por recorte de texto + `vm`, então são frágeis a `export` dentro do trecho recortado. Isso pegou o `SAVE_V`: ele virou `const` com `export { SAVE_V }` no fim do arquivo.

## 3. Desempenho
- Já estavam OK: LOD carregado, Marina `.b64`, warmup de shaders, instancing, streaming por vizinhança.
- No v11: as áreas novas reaproveitam materiais/geometrias do `build` existente (sem GLB novo, sem textura nova), e o chefe novo reusa o rig `brute` (sem download extra).
- Pendente (de propósito, porque não é ganho rápido sem risco): `matrixAutoUpdate=false` nos meshes estáticos de cada área (portões e objetos animados precisariam de exceção) e pool de partículas compartilhado entre áreas.

## 4. Design do Ato 3 — PORTO ANIL
**Gancho:** no ninho, depois do resgate do Ato 2, o Garça-1 pousa com Lima a bordo. Há duas opções:
- **H — "Voltar para casa"**: o final do Ato 2, como antes (e grava o checkpoint do Ato 3).
- **"Porto Anil"** (marca ao lado do H): começa o Ato 3.

O menu ganha **"CONTINUAR ATO 3 — PORTO ANIL"** (chave própria `crise-no-vale-act3`, sem sobrescrever o save principal).

| Área | Papel |
|---|---|
| `portoanil` (cais da cidade, chuva, sirenes) | chegada, emboscada de evacuação, Brute na rua, registro 14, terminal de save |
| `captacao` (casa de bombas, névoa tóxica) | **relógio de contaminação (240 s)**, painel laranja "fechar comportas" (defesa de 20 s com ondas), registros 15 e 17, save. A escotilha norte só abre com as comportas fechadas |
| `sede` (bunker do Conselho) | registro 16, **chefe Primórdio** (cuspe ácido em leque, investida e pisão; fase 1 chama a matilha, fase 2 choca ovos do núcleo). Depois, a **escolha final** |

**Escolha final:**
- Terminal azul = **expor o Conselho** (transmissão de 14 s sob ataque).
- Núcleo = **destruir o laboratório** (cargas, 10 s).

**4 finais** (escolha × comportas a tempo):

| | comportas a tempo | contaminou |
|---|---|---|
| expor | **MARÉ LIMPA** | **VERDADE TURVA** |
| destruir | **SILÊNCIO NA CAPTAÇÃO** | **ESCOMBROS E LAMA** |

Novos personagens de voz: **Conselho Tellus** e **Prefeita Sá**. O save vai para `v6`, e saves v5 migram sem perder nada.
