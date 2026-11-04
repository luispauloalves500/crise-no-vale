# PROMPT DE IMPLEMENTAÇÃO — CRISE NO VALE
Trabalhe como engenheiro principal e game designer de survival horror em Three.js no repositório https://github.com/jogoiarexx-blip/Crisis-no-vale.

**Leia integralmente antes de alterar código:** README.md, AUDITORIA-COERENCIA.md, IMPROVEMENTS.md, PLANO-MUNDO-COERENTE.md e os módulos js/areas.js, js/director.js, js/world.js, js/story.js, js/combat.js, js/enemies.js, js/player.js, js/encounter-memory.mjs, js/ui.js, js/state.js e tests/coherence.test.mjs.

Objetivo: transformar as nove áreas do jogo em mundo conectado e persistente, garantindo coerência de portas, cenários, documentos, encontros de dinossauros ao retornar, e **combo de eliminados sem receber golpe até a passagem para o próximo cenário**.

**Não reescreva o jogo do zero.** Preserve campanha em dois atos, treze registros, saves antigos, IA e memória de inimigos existentes, armas, loja, gráficos, performance e finais. Não ressuscite inimigos eliminados nem use teleporte arbitrário. Corrija defeitos confirmados antes de acrescentar conteúdo.

**Execute diretamente no código, nesta ordem:**
1. Mapear todas as portas e validar conexões recíprocas; corrigir gatilho involuntário por simples proximidade, colisores, animações de abrir/fechar, indicadores de tranca e posição/câmera do personagem depois de atravessar.
2. Refatorar a transição em máquina de estados com debounce, bloqueio de reentrada e pré-carregamento, protegendo contra loading falho, race conditions, dialogos tardios e transição dupla. Manter inventário, flags, inimigos, documentos e objetivos.
3. Melhorar os 13 registros com objetos físicos relacionados ao texto, locais acessíveis, leitura E, aba Arquivo, ícones de não lidos e persistência compatível com saves antigos. Não recontar leitura nem antecipar provas não descobertas.
4. Fazer backtracking com encontros únicos motivados por energia, alarmes e consequências narrativas. Dinossauros mortos ficam mortos; inimigos vivos preservam HP/posição; novos aparecem por entradas plausíveis e só conforme gatilho registrado em save. Nada de farm infinito.
5. Manter o combo de cadência atual de 2,5 s / até 4x e adicionar a “sequência limpa de travessia”: conte abates do primeiro inimigo eliminado até a próxima **travessia concluída**; qualquer golpe válido inclusive absorvido pelo colete quebra a sequência; ao entrar no cenário seguinte conceda bônus único conforme tabela do MD, encerre segmento e mostre HUD discreto. Proteja contra duplicação por pausa, save, reentrada, travessia falha ou morte. Não duplicar bonificações de chefe/evento.
6. Melhorar pistas visuais, mapa e mudanças ambientais nas áreas revisitadas sem aumentar demais o uso de memória ou CPU.
7. Criar testes de grafo/portas, transições, documentos, flags, respawn, sequência sem dano, colete, PE, save/load e compatibilidade. Rodar os testes Node e, se houver ambiente WebGL, reproduzir jornadas reais no navegador. Corrigir as falhas comprovadas pelos testes.
8. Atualizar o MD com o que realmente foi implementado, evidências antes/depois, arquivos, commits, testes **executados versus não executados** e pendências. Publicar as correções no repositório e verificar o GitHub Pages.

**Critérios de aceite:** 9 áreas conectadas corretamente; 13 registros alcançáveis e persistentes; portas trancadas obedecem condições; voltar não ressuscita mortes antigas; novos encontros surgem apenas por eventos da história; três abates sem sofrer golpes geram **um** bônus ao atravessar; golpe absorvido pelo colete cancela sequência; nenhum loop de fade ou item perdido; saves e finais preservados.

Avance de P0 para P1 sem perguntar a cada passo. Se algum teste ou publicação não puder ser realizado, diga exatamente o que bloqueou e não invente sucesso.
