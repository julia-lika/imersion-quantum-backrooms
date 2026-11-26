// Conteúdo do lobby (fase 0): placas, paredes de treino e posições dos móveis.
// Posições em células do mapa do lobby; `wall` diz em qual parede a peça fica.
// O lobby-builder converte isso em entidades.

export const LOBBY_FURNITURE = [
  // Nos modelos do pack, a frente de cada móvel aponta para -Z.
  // Balcão do briefing logo à frente do spawn (célula 1,1, olhando para +X),
  // com a frente virada para o jogador. A borda da frente fica no limite da
  // célula bloqueada: no VR dá para encostar a mão no computador.
  { piece: 'desk', cellX: 2.9, cellZ: 1.35, rotation: 90, scale: [0.7, 1, 0.8] },
  { piece: 'officeChair', cellX: 3.75, cellZ: 1.4, rotation: 90 },
  { piece: 'metalTable', wall: 'right', inset: 0.6, cellZ: 1.66, rotation: 90 },
  { piece: 'terminal', wall: 'right', inset: 0.6, cellZ: 1.66, y: 0.75, rotation: 90 },
  // Estações de equipamento: uma mesa menor (o mesmo modelo) para cada item.
  // Afastadas da parede: a borda da frente fica no limite da célula bloqueada,
  // onde o jogador consegue encostar e alcançar os itens no VR.
  { piece: 'desk', wall: 'left', inset: 0.62, cellZ: 4.2, rotation: 90, scale: [0.6, 1, 0.75] },
  { piece: 'desk', wall: 'left', inset: 0.62, cellZ: 6.7, rotation: 90, scale: [0.6, 1, 0.75] },
  { piece: 'desk', wall: 'left', inset: 0.62, cellZ: 9.2, rotation: 90, scale: [0.6, 1, 0.75] },
];

// Notebook do briefing na borda da frente do balcão, com a tela virada para o
// jogador (-X): a tela do notebook olha para +Z local, então gira -90°.
export const LOBBY_COMPUTER = { cellX: 2.67, cellZ: 1.35, y: 0.736, rotation: -90 };

// Telão de slides sobre computação quântica (parede do fundo, canto esquerdo).
export const LOBBY_SLIDES = { wall: 'far', cellX: 2.5, y: 1.6, width: 2.4 };

// TV de segurança com a entidade andando, embaixo da placa da ENTIDADE.
export const LOBBY_TV = { wall: 'right', cellZ: 8.6, y: 0.78, inset: 0.345 };

export const LOBBY_SIGNS = [
  {
    // Painel solto sobre o balcão, logo à frente de onde o jogador nasce
    // (célula 1,1, olhando para +X): é a primeira coisa que ele vê.
    cellX: 3.15, cellZ: 1.35, y: 1.78, rotation: -90,
    title: 'FASE 0 // LOBBY', subtitle: 'TREINAMENTO',
    body: 'Bem-vindo, agente. Este é o lobby de treinamento.\n\nANDAR: marche no lugar, balançando os braços para ir mais rápido (VR), ou WASD/setas, olhando com o mouse. Shift corre.\n\nAbra o COMPUTADOR aqui embaixo: toque com a mão (VR), clique ou aperte E. Depois pegue os 3 equipamentos nas estações ao longo do salão. No fundo do salão, o telão explica a física do jogo.',
  },
  {
    wall: 'left', cellZ: 4.2, y: 1.85,
    title: 'ESTAÇÃO 1: Q-LINK', subtitle: 'O RELÓGIO',
    body: 'O relógio é o Q-LINK, o painel do pulso esquerdo. Mostra ANDAR, SANIDADE, ENERGIA, VISOR ZETA, a distância da ENTIDADE e o OBJETIVO.\n\nPegue o relógio na mesa (encoste a mão; desktop: Q). Para ver o painel: traga o pulso esquerdo para perto do rosto, gire o pulso para os olhos e segure um instante (desktop: H).',
  },
  {
    wall: 'right', cellZ: 4.2,
    title: 'ÁGUA DE AMÊNDOA', subtitle: 'SUPRIMENTO',
    body: 'Garrafas espalhadas pelos andares. Estenda a mão até a garrafa para pegar e leve à boca para beber. No desktop: E pega, E de novo bebe.\n\nRestaura SANIDADE e recarrega toda a ENERGIA. Experimente a garrafa ao lado: outra aparece a cada 10 s.',
  },
  {
    wall: 'left', cellZ: 6.7, y: 1.85,
    title: 'ESTAÇÃO 2: VISOR ZETA', subtitle: 'OS ÓCULOS',
    body: 'Os óculos são o Visor Zeta. Com ele ligado, você enxerga as paredes em SUPERPOSIÇÃO (roxas), que abrem e fecham. Entre quando abrir: você a mede e ela fica aberta. O salto de fase (X) não passa por ela.\n\nPegue os óculos na mesa (desktop: Q). Ligar e desligar: dois toques com a mão direita na lateral direita do rosto (desktop: Z). Gasta energia.',
  },
  {
    wall: 'right', cellZ: 6.5, y: 2.32, height: 0.62,
    title: 'PAREDE DE TREINO', subtitle: 'TUNELAMENTO + SUPERPOSIÇÃO',
    body: 'SALTO DE FASE (tunelamento): olhe para a parede ciano e aperte X (VR: palmas). VISOR ZETA (Z): a parede roxa abre e fecha; entre quando abrir e ela fica aberta. As duas levam à mesma sala.',
  },
  {
    wall: 'right', cellZ: 8.6,
    title: 'ENTIDADE', subtitle: 'PERIGO',
    body: 'Ela persegue você pelo labirinto. Não a encare: cubra os olhos com as duas mãos.\n\nVISOR ZETA: dois toques na lateral direita do rosto (Z) revela paredes em superposição.\nSALTO DE FASE: palmas na parede (X) para atravessar.\nTeste os dois na parede de treino ao lado.',
  },
  {
    wall: 'left', cellZ: 9.2, y: 1.85, height: 0.95,
    title: 'ESTAÇÃO 3: QPS', subtitle: 'O CHIP QUÂNTICO',
    body: 'O chip é o QPS. Ele mede sem parar tudo num raio de ~4 m e desenha o mapa (traga o pulso direito ao rosto e gire; desktop: M). O que é medido o tempo todo não muda: efeito Zeno.\n\nLonge de você ninguém mede e o labirinto evolui (no mapa: ?). A porta fica entre algumas posições possíveis; quando uma entra no raio, o QPS mede e sorteia onde ela aparece. Pegue o chip (desktop: Q).',
  },
  {
    wall: 'far', cellX: 6.4, height: 0.6,
    title: 'SAÍDA', subtitle: 'ANDAR 01',
    body: 'A porta amarela leva ao ANDAR 01.\n\nEla só abre depois de pegar os 3 instrumentos e ler a missão no computador. Boa sorte, agente.',
  },
];

// Paredes de treino bem marcadas: ciano = salto de fase, roxo = visor zeta.
export const LOBBY_TRAINING_WALLS = [
  {
    cellZ: 6.5, cells: 2, color: '#44ffcc',
    title: 'ATRAVESSE AQUI', floorText: 'SALTO DE FASE — APERTE X',
    hint: 'PAREDE DE TREINO — olhe para ela e aperte X (VR: palmas na parede) para atravessar',
  },
  {
    cellZ: 10, cells: 1, color: '#b46bff',
    title: 'VISOR ZETA', floorText: 'APERTE Z — ENTRE QUANDO ABRIR',
    hint: 'PAREDE EM SUPERPOSIÇÃO — ligue o visor (Z) e entre quando ela abrir: ao entrar você a mede e ela fica aberta',
  },
];
