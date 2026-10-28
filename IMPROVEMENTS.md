# Melhorias: de ondas para áreas conectadas

O jogo deixou de ser uma arena com ondas e virou uma campanha com 6 áreas ligadas por portões. A versão de ondas anterior foi guardada em `../crise-no-vale.bak-waves/`.

## Mundo e progressão
- Novo `areas.js` com 6 áreas: cais, ruínas, laboratório, pântano, pátio e heliponto. Cada área tem cenário, colisões, portas, itens, patrulhas, encontros e clima próprios (neblina, céu, luz da lua e chuva).
- Novo `director.js` no lugar do sistema de ondas:
  - troca de área com fade e invulnerabilidade breve;
  - portões animados com luz verde ou vermelha;
  - travas por flag: `power`, `heliCode` e `bossLock`, com mensagem explicando o motivo.
- Objetivos derivados do estado do jogo: chegar ao laboratório → ligar o gerador → achar e escoltar a sobrevivente → código do portão → chefe → resgate.
- Eventos com roteiro e medidor no HUD:
  - defesa do gerador (20 s, 3 grupos de inimigos);
  - digitação do código (4 s);
  - resgate final (14 s).
- O mundo é persistente: patrulhas mortas e itens coletados não voltam, e encontros novos aparecem quando você volta com a energia ligada.
- Terminais de save restauram a vida e gravam o progresso em `localStorage`, com botão "Continuar" no menu e na tela de morte.
- Nova NPC, a Dra. Lima (`npc.js`): segue o jogador, desvia de paredes, cai ao ser atacada e precisa ser protegida.

## Chefe
- O **Colosso** é um bruto gigante (1600 HP) com:
  - investida;
  - pisão em área;
  - fúria abaixo de 34% da vida.
- Ele chama a matilha conforme perde vida e tem barra de vida própria no topo da tela.
- Ao bater numa parede fica atordoado e leva +50% de dano. Granadas também o atordoam.

## Armas e itens
- A escopeta agora é encontrada no mapa (ruínas) em vez de vir no início. A tecla 2 só funciona depois de pegá-la.
- Granadas (G) com física de quique no chão e nas paredes, pavio, dano com queda pela distância e teste de cobertura. Também atordoam e podem ferir o próprio jogador.
- Kits médicos (H) vão para o inventário (máx. 4).
- Itens fixos no mapa: munição, kits, granadas e a escopeta. Inimigos ainda deixam drops, e o bruto deixa mais.
- Tiros fazem barulho e atraem inimigos que ainda não perceberam o jogador.

## HUD
- Painel com o nome da área e o objetivo atual, mais um mini-mapa esquemático das áreas (atual, visitadas, desconhecidas, trancadas e marcadores de save/objetivo).
- Mapa grande com Tab.
- Inventário (kits, granadas, escopeta), prompt de interação (E), barra do chefe e medidor de eventos.
- Banner de entrada em cada área e tela final com rank S–D.

## Áudio
- Novos sons: porta, porta trancada, save, gerador, energia restaurada, explosão, alarme, rugido do chefe, objetivo e emboscada.

## Testado
- Testado em servidor estático com Chrome headless (puppeteer): sem erros de console.
- Campanha completa validada: save → gerador → escolta → código → chefe → resgate (vitória).
- Também validados: Continuar do save, pegar a escopeta, granada, mapa (Tab) e pausa.
