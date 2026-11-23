// Slides da sala de briefing quântico do lobby. O texto descreve o que o código
// faz de verdade (circuito em backend/quantum_circuit.py, banco em
// data/quantum-bank.json, gerador em js/map-generator.js) e separa o que é
// física do que é mecânica de jogo.
export const QUANTUM_SLIDES = [
  {
    title: 'BRIEFING QUÂNTICO',
    subtitle: '0 / COMO USAR',
    body: 'Este terminal explica a física por trás do jogo, sem exagero: o que é quântico de verdade e o que é mecânica de jogo.\n\nAvance e volte com os botões (clique ou toque com a mão) ou com as teclas [ e ].',
    diagram: 'intro',
  },
  {
    title: 'QUBIT E SUPERPOSIÇÃO',
    subtitle: '1 / ESTADO',
    body: 'Um bit é 0 ou 1. Um qubit pode estar em superposição: a|0⟩ + b|1⟩, com chance |a|² de dar 0 e |b|² de dar 1. Só a medição mostra um valor.\n\nCada andar usa 12 qubits. A porta RY gira cada um e define a chance dele dar 1.',
    diagram: 'superposition',
  },
  {
    title: 'EMARANHAMENTO',
    subtitle: '2 / CORRELAÇÃO',
    body: 'A porta CX liga cada qubit ao vizinho, em cadeia (0→1→…→11). Depois dela os qubits não têm mais estado próprio: o resultado de um diz algo sobre o vizinho.\n\nPor isso os bits medidos vêm correlacionados, e não 12 moedas independentes.',
    diagram: 'entanglement',
  },
  {
    title: 'INTERFERÊNCIA E FASE',
    subtitle: '3 / PREFERÊNCIAS',
    body: 'Outra camada de RY e um anel de CZ mexem nas fases. Amplitudes se somam ou se cancelam, então alguns bitstrings ficam muito mais prováveis que outros.\n\nSem isso, os 4096 resultados teriam a mesma chance e o mapa seria puro sorteio.',
    diagram: 'interference',
  },
  {
    title: 'MEDIÇÃO E COLAPSO',
    subtitle: '4 / O QPS',
    body: 'Pegar o QPS é medir. O jogo sorteia um resultado entre os 1024 disparos (shots) gravados do circuito daquele andar, respeitando as frequências.\n\nO estado colapsa num único bitstring de 12 bits, e o labirinto é redesenhado com ele enquanto você pisca.',
    diagram: 'measurement',
  },
  {
    title: 'ENTROPIA',
    subtitle: '5 / INCERTEZA',
    body: 'A entropia de Shannon mede o quanto os resultados se espalham: 0 bits = sempre o mesmo, 12 bits = os 4096 igualmente prováveis.\n\nOs andares gravados ficam entre ~7 e 8 bits: muita incerteza, mas com preferências claras.',
    diagram: 'entropy',
  },
  {
    title: 'COMO O MAPA NASCE',
    subtitle: '6 / DO BIT À SALA',
    body: 'O bitstring medido é a SEMENTE de um gerador clássico: divide o andar em salas, abre vãos, ergue pilares e põe a porta longe da entrada.\n\nO quântico escolhe QUAL dos 4096 mapas aparece. A construção é clássica e repetível: mesmo bitstring, mesmo mapa.',
    diagram: 'map',
  },
  {
    title: 'PAREDE EM SUPERPOSIÇÃO',
    subtitle: '7 / VISOR ZETA',
    body: 'Algumas paredes internas ficam no estado parede + passagem e oscilam no tempo (metáfora visual da fase girando). O Visor Zeta mostra esse estado.\n\nEntrar nela aberta é uma medição: ela colapsa em PASSAGEM (fica ciano) e só volta a oscilar quando você sai.',
    diagram: 'superposedWall',
  },
  {
    title: 'SALTO DE FASE',
    subtitle: '8 / TUNELAMENTO',
    body: 'No tunelamento, uma partícula atravessa uma barreira que, pela física clássica, não conseguiria. É uma questão de probabilidade.\n\nAqui: palmas na parede (ou X) tentam tunelar por até 2 células de parede. Custa 25 de energia e 3 de sanidade, e funciona 92% das vezes.',
    diagram: 'tunneling',
  },
  {
    title: 'O QUE É METÁFORA',
    subtitle: '9 / HONESTIDADE',
    body: 'Real: o circuito de 12 qubits e a amostragem dos seus resultados. Hoje as medições vêm de simulação exata (statevector, 1024 shots) gravada no jogo; com ?live ele chama a API.\n\nMecânica de jogo: entidade, sanidade, oscilação das paredes e os índices de coerência/ruído do HUD (calculados dos bits).',
    diagram: 'honesty',
  },
];
