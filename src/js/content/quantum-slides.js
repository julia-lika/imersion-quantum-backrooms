// Slides do telão do lobby: computação quântica do zero, no visual da
// apresentação do projeto (moedas, gato de Schrödinger, caixas). Pensados para
// quem nunca estudou computação. O texto segue o que o código faz de verdade:
// circuito em backend/quantum_circuit.py, banco em data/quantum-bank.json,
// gerador em js/map-generator.js.
//
// Cada slide: theme ('dark' | 'cream' | 'yellow'), title, cards (1 a 3, lado a
// lado), note opcional (faixa embaixo), flow (setas entre os cards) ou table.
// Card: label, heading, text, image (assets/slides/...), diagram, caption.

export const SLIDE_IMAGES = {
  coins: 'assets/slides/moedas.png',
  spinning: 'assets/slides/moeda-girando.png',
  cat: 'assets/slides/gato-caixa.png',
  cats: 'assets/slides/gatos-emaranhados.png',
  bars: 'assets/slides/barras.png',
};

export const QUANTUM_SLIDES = [
  {
    theme: 'dark',
    title: 'Como este jogo pensa',
    cards: [
      {
        heading: 'Sem conta, sem pré-requisito',
        text: 'Em poucos slides vamos de moedas e gatos até o labirinto em que você está. Você não precisa saber nada de computação.',
      },
      { image: 'coins', caption: 'Moedas, caixas e um gato: é tudo o que vamos usar.' },
    ],
    note: 'Para avançar: clique nos botões ▶ e ◀ (ou na metade da tela), use as teclas [ e ], ou toque os botões com a mão no VR.',
  },
  {
    theme: 'cream',
    title: 'O que é um bit?',
    cards: [
      {
        heading: 'Um interruptor',
        text: 'Todo computador guarda informação em bits. Um bit é como um interruptor de luz: desligado vale 0, ligado vale 1.\n\nUma foto, uma música, este jogo: tudo vira uma fileira enorme de zeros e uns.',
      },
      { diagram: 'switches', caption: 'Cada lâmpada é um bit: apagada = 0, acesa = 1.' },
    ],
  },
  {
    theme: 'dark',
    title: 'Vários bits juntos',
    cards: [
      {
        heading: 'Cada bit dobra as opções',
        text: 'Com 1 bit há 2 possibilidades (0 ou 1). Com 2 bits, 4 (00, 01, 10, 11). Cada bit a mais dobra a conta.\n\nCom 12 bits são 4096 combinações. Cada andar do jogo é uma delas, um código como 010110101100.',
      },
      { diagram: 'doubling', caption: '1, 2, 3 … 12 bits: 2, 4, 8 … 4096 combinações.' },
    ],
  },
  {
    theme: 'dark',
    title: 'Um bit é uma moeda parada.\nUm qubit é uma moeda girando.',
    cards: [
      { label: 'BIT COMUM', image: 'coins', text: 'Cara ou coroa. Está em 0 ou em 1, sempre, e você enxerga qual.' },
      { label: 'QUBIT', image: 'spinning', text: 'Enquanto gira, é 0 e 1 ao mesmo tempo, cada um com a sua chance.' },
    ],
  },
  {
    theme: 'cream',
    title: 'Superposição: as duas coisas ao mesmo tempo',
    cards: [
      {
        heading: 'A moeda no ar',
        text: 'Enquanto gira, a moeda não é só cara nem só coroa: é as duas, cada uma com a sua chance (por exemplo 70% cara e 30% coroa). Isso é superposição.\n\nNum computador quântico, a "moeda" é o qubit, feito de átomos, luz ou circuitos supercondutores.',
      },
      { diagram: 'superposition', caption: 'As chances podem ser ajustadas antes de olhar.' },
    ],
  },
  {
    theme: 'cream',
    title: 'O gato de Schrödinger: vivo e morto até abrir a caixa',
    cards: [
      {
        heading: 'Imagine a cena',
        text: 'Dentro de uma caixa fechada, um evento quântico aleatório decide a sorte de um gato. Antes de abrir, a física descreve o gato como vivo e morto ao mesmo tempo.\n\nSchrödinger propôs a ideia em 1935 para mostrar como ela soa estranha. É uma metáfora: quem faz isso de verdade são átomos e qubits, não gatos.',
      },
      { image: 'cat', caption: 'Os dois ao mesmo tempo, sobrepostos, até alguém abrir.' },
    ],
  },
  {
    theme: 'dark',
    title: 'Abrir a caixa é medir',
    flow: true,
    cards: [
      { label: 'ANTES', heading: 'Caixa fechada', text: 'Vivo e morto, cada um com a sua chance.' },
      { label: 'MEDIR', heading: 'Abrir a caixa', text: 'Olhar força o estado a escolher.' },
      { label: 'DEPOIS', heading: 'Um só resultado', text: 'Vivo ou morto. Nunca os dois.' },
    ],
    note: 'Como bater a mão numa moeda girando: ela para em cara ou coroa. Repita muitas vezes e as chances aparecem, por exemplo 70% cara e 30% coroa.',
  },
  {
    theme: 'cream',
    title: 'Emaranhamento: duas caixas combinadas',
    cards: [
      { image: 'cats', caption: 'Dois gatos, duas caixas, resultados que andam juntos.' },
      {
        heading: 'Uma sina combinada',
        text: 'Emaranhar dois gatos é combinar as caixas: nenhum tem resultado próprio, mas os dois andam juntos. Abriu uma e viu vivo? Você já sabe o que tem na outra.\n\nNo jogo: os 12 qubits são amarrados em fila (porta CX), então cada bit tende a combinar com o vizinho.',
      },
    ],
  },
  {
    theme: 'dark',
    title: 'O circuito escolhe as chances',
    cards: [
      {
        heading: 'As portas giram a moeda',
        text: '• RY: inclina a moeda para um lado\n• CX: amarra duas moedas\n• CZ: muda o ritmo do giro\n\nCada andar tem o seu circuito de 12 qubits, sempre o mesmo para aquele andar.',
      },
      {
        label: 'MIL ABERTURAS DA MESMA CAIXA',
        image: 'bars',
        text: 'Rodamos o circuito 1024 vezes (shots) e contamos cada resultado. Essa contagem fica gravada no jogo.',
      },
    ],
    note: 'Gráfico ilustrativo. Hoje os 1024 resultados de cada andar vêm de uma simulação exata do circuito; com ?live no endereço o jogo chama a API quântica.',
  },
  {
    theme: 'dark',
    title: 'Entropia: quanta surpresa tem o resultado',
    cards: [
      {
        heading: 'Previsível ou caótico?',
        text: 'Se a moeda sempre desse cara, não haveria surpresa: entropia zero. Se todos os resultados tivessem a mesma chance, a surpresa seria máxima.\n\nMedimos em bits, de 0 a 12 aqui. Os andares do jogo ficam entre 7 e 8: imprevisíveis, mas com preferências.',
      },
      { diagram: 'entropy', caption: 'De "sempre igual" (0) a "qualquer um dos 4096" (12).' },
    ],
  },
  {
    theme: 'yellow',
    title: 'Do gato ao jogo',
    table: [
      ['Na metáfora', 'No Quantum Backrooms'],
      ['Uma moeda girando', 'Um qubit (são 12 por andar)'],
      ['Mil caixas iguais', '1024 shots do circuito, gravados no jogo'],
      ['Abrir a caixa', 'Pegar o QPS: o jogo sorteia um desses resultados'],
      ['O resultado', 'Um código de 12 bits, que vira a semente do mapa'],
      ['Caixa fechada', 'Paredes em superposição (metáfora visual)'],
    ],
  },
  {
    theme: 'dark',
    title: 'Como o mapa nasce',
    cards: [
      {
        heading: 'O código é a semente',
        text: 'O código de 12 bits medido alimenta um gerador comum (não quântico): ele divide o andar em salas, abre passagens, ergue pilares e põe a porta longe da entrada.\n\nO quântico escolhe QUAL dos 4096 mapas aparece. Mesmo código, mesmo mapa, sempre.',
      },
      { diagram: 'map', caption: '010110101100 → salas, passagens e a porta (amarelo).' },
    ],
  },
  {
    theme: 'cream',
    title: 'Parede em superposição e Visor Zeta',
    cards: [
      {
        heading: 'Parede ou passagem?',
        text: 'Algumas paredes ficam "parede e passagem" e piscam com o tempo (é a metáfora da moeda girando). O Visor Zeta (Z ou pinça na testa) mostra quais são.\n\nEntrar nela quando abre é medir: ela "escolhe" passagem, fica ciano e só volta a piscar quando você sai.',
      },
      { diagram: 'superposedWall', caption: 'Teste na parede roxa, à direita no salão.' },
    ],
  },
  {
    theme: 'dark',
    title: 'Salto de fase: tunelamento',
    cards: [
      {
        heading: 'Atravessar o impossível',
        text: 'Na física quântica, uma partícula às vezes atravessa uma barreira que, pelas regras do dia a dia, não conseguiria. Isso se chama tunelamento, e é questão de chance.\n\nNo jogo: palmas na parede (ou X) tentam atravessar até 2 blocos de parede. Custa 25 de energia e 3 de sanidade e funciona 92% das vezes.',
      },
      { diagram: 'tunneling', caption: 'A onda chega à barreira e um pedaço passa.' },
    ],
  },
  {
    theme: 'yellow',
    title: 'O que é de verdade e o que é jogo',
    cards: [
      {
        label: 'QUÂNTICO DE VERDADE',
        text: '• O circuito de 12 qubits de cada andar\n• As chances e a contagem dos 1024 resultados\n• Sortear um resultado ao pegar o QPS\n• A entropia de cada andar',
      },
      {
        label: 'MECÂNICA DE JOGO',
        text: '• A entidade, a sanidade e a energia\n• As paredes que piscam\n• Os índices de coerência e ruído do painel\n• Construir as salas a partir do código',
      },
    ],
    note: 'Boa sorte, agente. A porta amarela no fim do salão leva ao ANDAR 01.',
  },
];
