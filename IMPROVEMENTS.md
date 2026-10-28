# Melhorias em relação à versão monolítica

A versão anterior era um único `dino-crisis-inspired.html` com 699 linhas e three r128.

## Estrutura
- O jogo agora é dividido em `index.html`, 2 CSS e 12 módulos ES, cada um com uma responsabilidade (veja o README).
- Three.js foi atualizado para o r160 via importmap/jsDelivr. As cores agora usam sRGB, o tone mapping é ACES e as luzes seguem unidades físicas.
- Todo o balanceamento (armas, inimigos, ondas, câmera) fica centralizado em `config.js`.

## Câmera e controles
- A câmera segue o personagem com amortecimento e tem colisão com paredes: aproxima rápido ao encostar e se afasta devagar.
- Novo modo de mira com o botão direito: zoom por FOV, ombro mais próximo, menos dispersão e menos velocidade.
- É possível trocar o ombro da câmera com V. Perto de paredes o ombro centraliza sozinho.
- Recuo da arma na câmera e tremor de tela suavizado.
- O jogo pausa sozinho ao trocar de aba ou perder o foco. A tecla M agora aparece no menu.

## Combate
- Nova retícula dinâmica: abre ao atirar ou se mover e fica vermelha sobre um inimigo.
- Marcador de acerto em X, que muda de cor no abate.
- Números de dano flutuantes, com críticos em amarelo.
- Clarão de disparo mais forte (luz e sprite), rastros de tiro e faíscas.
- Indicador de direção do dano recebido.
- Knockback nos inimigos que leva em conta a massa (o bruto quase não recua). Um tiro forte de escopeta interrompe a investida dele.
- O dano da escopeta cai com a distância.
- Combo de abates com multiplicador até x4 e bônus por onda limpa.
- Barra de vida sobre o inimigo depois que ele leva dano.

## Inimigos
- Silhuetas e cores diferentes por tipo:
  - raptor: baixo e alongado, com listras, penas laranja e garra em foice.
  - cuspidor: pescoço ereto, cristas duplas e leque laranja que se abre antes de cuspir.
  - bruto: 2× maior, com chifres e placas dorsais.
- Olhos brilhantes que aparecem na neblina.
- Raptores flanqueiam em arco. O cuspe do cuspidor antecipa o seu movimento e só sai com linha de visão livre.
- Os inimigos nascem nas bordas, longe do jogador e fora de obstáculos.

## Ondas e ritmo
- Cada onda tem um limite de inimigos vivos ao mesmo tempo, intervalo variável entre spawns e uma frase de abertura.
- Anúncio de spawn com a direção cardeal, por exemplo "Bruto se aproximando — NORTE".
- Intervalo entre ondas com contagem regressiva 3‑2‑1. Na última onda o bruto aparece primeiro.
- Tela final com pontos, abates, precisão, tempo e recorde salvo (localStorage).

## Radar
- Varredura animada e cone de visão.
- Ruínas e limites da arena desenhados no radar.
- Itens aparecem no radar, e inimigos fora do alcance viram setas na borda.
- Cores por tipo de inimigo e marcador do Norte.

## Ambiente
- Chuva que acompanha a câmera, vagalumes, grama instanciada (900 tufos em 1 draw call), cipós e heliponto.
- Relâmpagos com trovão atrasado.
- Postes com luz tremulando e lanterna presa ao personagem.
- Partículas de sangue, faísca, ácido e poeira, além de manchas no chão.

## Bugs corrigidos
- O "kick" da retícula era desfeito no mesmo frame e nunca aparecia.
- Vazamento de memória: geometrias e materiais eram criados a cada spawn, tiro e partícula. Agora são compartilhados ou reaproveitados em pool e descartados quando o inimigo some.
- Os itens se acumulavam sem limite. Agora o limite é 8.
- A reserva da escopeta não tinha teto. Agora o teto é 36.
- Caixas e pedras baixas bloqueavam tiros. O tiro agora passa por cima de obstáculos baixos.
- A recarga automática usava `setTimeout` e disparava mesmo com o jogo pausado.
- Voltar da pausa logo depois do Esc fazia o pointer lock falhar sem aviso. Agora o erro é tratado e aparece uma dica.
- O cuspe atravessava paredes e os cuspidores atiravam sem linha de visão.
