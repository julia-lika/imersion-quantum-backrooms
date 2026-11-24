// Conteúdo do lobby (fase 0): placas, paredes de treino e posições dos móveis.
// Posições em células do mapa do lobby; `wall` diz em qual parede a peça fica.
// O lobby-builder converte isso em entidades.

export const LOBBY_FURNITURE = [
  // Nos modelos do pack, a frente de cada móvel aponta para -Z.
  { piece: 'sofa', wall: 'left', inset: 0.7, cellZ: 5, rotation: -90 },
  { piece: 'armchair', cellX: 3, cellZ: 5, rotation: 90 },
  { piece: 'desk', cellX: 5.5, cellZ: 4, rotation: 0 },
  // Cadeira puxada para trás e para o lado: no VR dá para chegar à borda da mesa.
  { piece: 'officeChair', cellX: 4.2, cellZ: 5.25, rotation: 35 },
  { piece: 'metalTable', wall: 'right', inset: 0.6, cellZ: 7.5, rotation: 90 },
  { piece: 'terminal', wall: 'right', inset: 0.6, cellZ: 7.5, y: 0.75, rotation: 90 },
  { piece: 'blueChair', cellX: 10, cellZ: 7.5, rotation: -90 },
  // Mesa dos equipamentos, no canto à esquerda do telão de slides. Da esquerda
  // para a direita de quem olha: relógio, óculos e chip, na ordem da placa.
  { piece: 'desk', wall: 'far', cellX: 2.2, inset: 0.55, rotation: 180 },
];

// Equipamentos do agente expostos na mesa do canto. Os modelos são pequenos de
// verdade (o chip tem 4 cm), então ficam ampliados na vitrine.
export const LOBBY_GEAR = {
  wall: 'far', inset: 0.5, y: 0.74,
  items: [
    { model: '#relogio-qlink-model', label: 'Q-LINK', cellX: 2.85, scale: 2.8, lift: 0.08, tilt: 0 },
    { model: '#oculos-zeta-model', label: 'VISOR ZETA', cellX: 2.2, scale: 1.6, lift: 0.03, tilt: 0 },
    { model: '#chip-qps-model', label: 'QPS', cellX: 1.55, scale: 4, lift: 0.02, tilt: 0 },
  ],
};

// Notebook do briefing perto da borda da mesa, do lado em que o jogador fica.
export const LOBBY_COMPUTER = { cellX: 5.5, cellZ: 4, edgeOffset: 0.32, y: 0.76, rotation: -10 };

// Telão de slides sobre computação quântica (parede esquerda, fundo do salão).
export const LOBBY_SLIDES = { wall: 'left', cellZ: 15, y: 1.6, width: 2.6 };

// TV de segurança com a entidade andando, embaixo da placa da ENTIDADE.
export const LOBBY_TV = { wall: 'right', cellZ: 14.5, y: 0.78, inset: 0.345 };

export const LOBBY_SIGNS = [
  {
    wall: 'right', cellZ: 2.5,
    title: 'FASE 0 // LOBBY', subtitle: 'TREINAMENTO',
    body: 'Bem-vindo, agente. Este é o lobby de treinamento.\n\nANDAR: balance os braços (VR) ou WASD/setas, olhando com o mouse.\n\nLeia as estações ao longo do salão e abra o COMPUTADOR na mesa: toque com a mão (VR), clique ou aperte E. No fundo, à esquerda, o telão explica a física do jogo.',
  },
  {
    wall: 'left', cellZ: 8,
    title: 'PAINEL DO PULSO', subtitle: 'Q-LINK',
    body: 'Olhe para o pulso esquerdo (VR) ou aperte H (desktop) para abrir o Q-LINK: ANDAR, SANIDADE, ENERGIA, VISOR ZETA, distância da ENTIDADE e OBJETIVO.\n\nA sanidade cai com o tempo e perto da entidade. A energia alimenta o visor e o salto de fase.',
  },
  {
    wall: 'right', cellZ: 10.5,
    title: 'ÁGUA DE AMÊNDOA', subtitle: 'SUPRIMENTO',
    body: 'Garrafas espalhadas pelos andares. Estenda a mão até a garrafa para pegar e leve à boca para beber. No desktop: E pega, E de novo bebe.\n\nRestaura SANIDADE e recarrega toda a ENERGIA. Experimente a garrafa ao lado: outra aparece a cada 10 s.',
  },
  {
    wall: 'left', cellZ: 12,
    title: 'QPS', subtitle: 'O SEU MAPA',
    body: 'Cada andar esconde um QPS. Pegue com pinça ou encostando a mão (desktop: Q ou clique).\n\nPegar o QPS MEDE o andar: ele grava a planta naquele instante e revela a PORTA. Veja no pulso direito (desktop: M).\n\nO labirinto muda onde ninguém olha, e o mapa fica velho (trechos chiando). Nova leitura: pinça perto do mapa (desktop: R), 10 de energia.',
  },
  {
    wall: 'right', cellZ: 12.5, y: 2.32, height: 0.62,
    title: 'PAREDE DE TREINO', subtitle: 'TUNELAMENTO + SUPERPOSIÇÃO',
    body: 'SALTO DE FASE (tunelamento): olhe para a parede ciano e aperte X (VR: palmas). VISOR ZETA (Z): a parede roxa abre e fecha; entre quando abrir e ela fica aberta. As duas levam à mesma sala.',
  },
  {
    wall: 'right', cellZ: 14.5,
    title: 'ENTIDADE', subtitle: 'PERIGO',
    body: 'Ela persegue você pelo labirinto. Não a encare: cubra os olhos com as duas mãos.\n\nVISOR ZETA: pinça na testa (Z) revela paredes em superposição.\nSALTO DE FASE: palmas na parede (X) para atravessar.\nTeste os dois na parede de treino ao lado.',
  },
  {
    wall: 'far', cellX: 2.2, y: 1.8, height: 0.95,
    title: 'EQUIPAMENTO', subtitle: 'DO AGENTE',
    body: 'RELÓGIO = Q-LINK: painel do pulso esquerdo (H). Andar, sanidade, energia e entidade.\n\nÓCULOS = VISOR ZETA: pinça na testa (Z). Mostra as paredes em superposição; gasta energia.\n\nCHIP QUÂNTICO = QPS: pegue no andar (Q). Mede o andar, vira o seu mapa (pulso direito ou M) e revela a porta.',
  },
  {
    wall: 'far', cellX: 8.6, height: 0.6,
    title: 'SAÍDA', subtitle: 'ANDAR 01',
    body: 'A porta amarela leva ao ANDAR 01.\n\nQuando estiver pronto, atravesse. Boa sorte, agente.',
  },
];

// Paredes de treino bem marcadas: ciano = salto de fase, roxo = visor zeta.
export const LOBBY_TRAINING_WALLS = [
  {
    cellZ: 12.5, cells: 2, color: '#44ffcc',
    title: 'ATRAVESSE AQUI', floorText: 'SALTO DE FASE — APERTE X',
    hint: 'PAREDE DE TREINO — olhe para ela e aperte X (VR: palmas na parede) para atravessar',
  },
  {
    cellZ: 16, cells: 1, color: '#b46bff',
    title: 'VISOR ZETA', floorText: 'APERTE Z — ENTRE QUANDO ABRIR',
    hint: 'PAREDE EM SUPERPOSIÇÃO — ligue o visor (Z) e entre quando ela abrir: ao entrar você a mede e ela fica aberta',
  },
];
