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
    theme: 'cream',
    title: 'O que é um algoritmo?',
    flow: true,
    cards: [
      { label: 'ENTRADA', heading: 'O que você tem', text: 'Ingredientes. Ou, num computador, uma fileira de bits.' },
      { label: 'PASSOS', heading: 'A receita', text: 'Instruções exatas, uma depois da outra, sem pular nenhuma.' },
      { label: 'SAÍDA', heading: 'O resultado', text: 'O bolo pronto. Ou outra fileira de bits: a resposta.' },
    ],
    note: 'Um algoritmo é uma receita passo a passo. Ordenar cartas, achar o caminho mais curto, gerar um labirinto: tudo isso é algoritmo. No computador, cada passo vira operações com bits.',
  },
  {
    theme: 'dark',
    title: 'Portas lógicas: os tijolos do computador',
    cards: [
      {
        heading: 'Bits entram, um bit sai',
        text: '• NOT: inverte. 0 vira 1, 1 vira 0.\n• AND (E): dá 1 só se as duas entradas forem 1.\n• OR (OU): dá 1 se pelo menos uma for 1.\n\nO processador tem bilhões dessas portas. Juntando muitas, ele soma, compara e roda qualquer algoritmo clássico, como o gerador de salas deste jogo.',
      },
      { diagram: 'logicGates', caption: 'Cada porta e a sua tabela: entrada → saída.' },
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
    theme: 'cream',
    title: 'Algoritmo quântico = circuito com portas',
    cards: [
      {
        heading: 'Fios e caixinhas',
        text: 'Cada fio é um qubit. As caixinhas são portas quânticas, lidas da esquerda para a direita, como uma receita.\n\n• H (Hadamard): põe a moeda para girar, meio a meio.\n• CNOT: inverte o segundo qubit se o primeiro for 1. Isso amarra (emaranha) os dois.\n• Medição: abre a caixa e dá 0 ou 1.',
      },
      { diagram: 'circuit', caption: 'O circuito mais famoso: dá 00 ou 11, nunca 01 ou 10.' },
    ],
  },
  {
    theme: 'yellow',
    title: 'Clássico x quântico',
    table: [
      ['', 'Algoritmo clássico', 'Algoritmo quântico'],
      ['Guarda', 'Bits: 0 ou 1', 'Qubits: 0 e 1 com chances'],
      ['Portas', 'NOT, AND, OR', 'H, X, CNOT, RY, CZ'],
      ['Durante a conta', 'Um valor de cada vez', 'Muitas possibilidades juntas'],
      ['Resultado', 'Sempre o mesmo', 'Um sorteio: roda muitas vezes'],
      ['Bom para', 'Quase tudo do dia a dia', 'Alguns problemas (moléculas, criptografia)'],
    ],
    note: 'Computador quântico não é um computador mais rápido para tudo: ele ganha só em problemas específicos. Neste jogo, o quântico sorteia o código e o clássico constrói as salas.',
  },
  {
    theme: 'dark',
    title: 'O circuito escolhe as chances',
    cards: [
      {
        heading: 'As portas giram a moeda',
        text: 'O circuito deste jogo usa 3 portas:\n• RY: gira a moeda no ângulo que quisermos (um H ajustável)\n• CX: é o CNOT, amarra duas moedas\n• CZ: muda o ritmo (a fase) do giro\n\nCada andar tem o seu circuito de 12 qubits, sempre o mesmo para aquele andar.',
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
      ['Abrir a caixa', 'Entrar num andar: o jogo sorteia um desses resultados'],
      ['O resultado', 'Um código de 12 bits, que vira a semente do mapa'],
      ['Olhar a caixa sem parar', 'O QPS: mede tudo a ~4 m de você, o tempo todo'],
      ['Caixa fechada', 'Paredes em superposição (metáfora visual)'],
    ],
  },
  {
    theme: 'dark',
    title: 'Como o mapa nasce',
    cards: [
      {
        heading: 'O código é a semente',
        text: 'O código de 12 bits medido alimenta um gerador comum (não quântico): ele divide o andar em salas, abre passagens, ergue pilares e marca algumas posições possíveis para a porta, longe da entrada.\n\nO quântico escolhe QUAL dos 4096 mapas aparece. Mesmo código, mesmo mapa, sempre.',
      },
      { diagram: 'map', caption: '010110101100 → salas, passagens e onde a porta pode estar (amarelo).' },
    ],
  },
  {
    theme: 'dark',
    title: 'O labirinto evolui quando ninguém mede',
    flow: true,
    cards: [
      { label: 'MEDIDO', heading: 'Perto de você', text: 'O QPS (raio de ~4 m) e os seus olhos medem sem parar: ali nada muda.' },
      { label: '18 S SEM MEDIR', heading: 'Ele evolui', text: 'Sem medição, o estado daquele trecho segue evoluindo para uma nova superposição.' },
      { label: 'MEDIDO DE NOVO', heading: 'Outro resultado', text: 'O jogo tira um novo código de 12 bits e o trecho aparece reorganizado.' },
    ],
    note: 'Você percebe pelo aviso: a luz oscila e passa um zumbido. O labirinto continua sempre conectado. Os números (raio, 18 s) são regra de jogo; a ideia vem do efeito Zeno, no próximo slide.',
  },
  {
    theme: 'cream',
    title: 'Efeito Zeno: medir sem parar congela',
    cards: [
      {
        heading: 'A panela vigiada',
        text: 'Um sistema quântico medido muitas e muitas vezes quase não consegue mudar: cada medição o devolve ao estado medido. Isso é o efeito Zeno quântico, já visto em laboratório com átomos.\n\nQuando as medições param, ele volta a evoluir para uma superposição. Na próxima medição, pode dar outro resultado.',
      },
      { image: 'spinning', caption: 'Sem medição ela gira; medida sem parar, fica parada.' },
    ],
  },
  {
    theme: 'dark',
    title: 'O QPS é o seu mapa (e mede sem parar)',
    cards: [
      {
        heading: 'Pegue no lobby, leve sempre',
        text: 'O QPS é o chip da estação 3. Ele mede o tempo todo tudo num raio de ~4 m e desenha o mapa (pulso direito ou M).\n\nClaro = medindo agora. Apagado = última leitura. Chiando com ? = evoluiu desde então. A porta fica em superposição entre algumas posições (amarelo tracejado). Quando uma entra no raio, o QPS mede e sorteia onde ela aparece.',
      },
      { diagram: 'qpsMap', caption: 'Mapa do QPS com um trecho que evoluiu (?).' },
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
        text: '• O circuito de 12 qubits de cada andar\n• As chances e a contagem dos 1024 resultados\n• Sortear um resultado para cada andar e cada trecho que muda\n• A entropia de cada andar',
      },
      {
        label: 'MECÂNICA DE JOGO',
        text: '• A entidade, a sanidade e a energia\n• As paredes que piscam\n• Trechos mudarem quando ninguém olha\n• Construir as salas a partir do código',
      },
    ],
    note: 'Boa sorte, agente. A porta amarela no fim do salão leva ao ANDAR 01.',
  },
];
