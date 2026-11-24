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
        heading: 'Relaxa: não tem conta',
        text: 'Nos próximos slides a gente sai de moedas e gatos e chega no labirinto onde você está agora.\n\nVocê não precisa saber nada de computação. Se souber jogar cara ou coroa, já dá.',
      },
      { image: 'coins', caption: 'Moedas, caixas e um gato. É só disso que vamos precisar.' },
    ],
    note: 'Para passar: clique em ▶ e ◀ (ou numa metade da tela), use [ e ], ou toque nos botões com a mão no VR.',
  },
  {
    theme: 'cream',
    title: 'O que é um bit?',
    cards: [
      {
        heading: 'Pense num interruptor',
        text: 'Todo computador guarda informação em bits. Um bit é igual a um interruptor de luz: desligado é 0, ligado é 1.\n\nFoto, música, este jogo: no fundo, tudo é uma fileira enorme de zeros e uns.',
      },
      { diagram: 'switches', caption: 'Cada lâmpada é um bit: apagada é 0, acesa é 1.' },
    ],
  },
  {
    theme: 'dark',
    title: 'Vários bits juntos',
    cards: [
      {
        heading: 'Cada bit dobra as opções',
        text: 'Um bit tem 2 jeitos de ficar: 0 ou 1. Dois bits têm 4: 00, 01, 10 e 11. A cada bit novo, as opções dobram.\n\nCom 12 bits, já são 4096. Cada andar do jogo é um desses códigos, tipo 010110101100.',
      },
      { diagram: 'doubling', caption: '1, 2, 3 … 12 bits: 2, 4, 8 … 4096 combinações.' },
    ],
  },
  {
    theme: 'cream',
    title: 'O que é um algoritmo?',
    flow: true,
    cards: [
      { label: 'ENTRADA', heading: 'O que você tem', text: 'Os ingredientes. No computador, uma fileira de bits.' },
      { label: 'PASSOS', heading: 'A receita', text: 'Instruções bem claras, uma depois da outra, sem pular nenhuma.' },
      { label: 'SAÍDA', heading: 'O resultado', text: 'O bolo pronto. No computador, outra fileira de bits: a resposta.' },
    ],
    note: 'Algoritmo é só uma receita passo a passo. Organizar cartas, achar o caminho mais curto, montar um labirinto: tudo isso é algoritmo.',
  },
  {
    theme: 'dark',
    title: 'Portas lógicas: os tijolinhos do computador',
    cards: [
      {
        heading: 'Entram bits, sai um bit',
        text: '• NOT: inverte. 0 vira 1 e 1 vira 0.\n• AND (E): só dá 1 se as duas entradas forem 1.\n• OR (OU): dá 1 se pelo menos uma for 1.\n\nUm processador tem bilhões dessas portinhas. Juntando todas, ele soma, compara e roda qualquer programa, inclusive o que monta as salas deste jogo.',
      },
      { diagram: 'logicGates', caption: 'Cada porta com a sua tabelinha: o que entra e o que sai.' },
    ],
  },
  {
    theme: 'dark',
    title: 'Um bit é uma moeda parada.\nUm qubit é uma moeda girando.',
    cards: [
      { label: 'BIT COMUM', image: 'coins', text: 'Cara ou coroa. É 0 ou 1, sempre, e dá para ver qual é.' },
      { label: 'QUBIT', image: 'spinning', text: 'Enquanto gira, ela é um pouco 0 e um pouco 1 ao mesmo tempo.' },
    ],
  },
  {
    theme: 'cream',
    title: 'Superposição: as duas coisas ao mesmo tempo',
    cards: [
      {
        heading: 'A moeda no ar',
        text: 'Enquanto a moeda gira, ela não é só cara nem só coroa. É as duas, cada uma com a sua chance, tipo 70% cara e 30% coroa. Isso é superposição.\n\nNum computador quântico, essa "moeda" é o qubit. Ele pode ser feito de átomos, de luz ou de circuitos supergelados.',
      },
      { diagram: 'superposition', caption: 'Dá para ajustar as chances antes de olhar.' },
    ],
  },
  {
    theme: 'cream',
    title: 'O gato de Schrödinger: vivo e morto até abrir a caixa',
    cards: [
      {
        heading: 'Imagina a cena',
        text: 'Um gato está numa caixa fechada, e um evento quântico sorteia a sorte dele. Enquanto ninguém abre, a física diz que o gato está vivo e morto ao mesmo tempo.\n\nSchrödinger inventou essa história em 1935 justamente para mostrar como isso soa estranho. É só uma metáfora: na vida real, quem faz isso são átomos e qubits.',
      },
      { image: 'cat', caption: 'Vivo e morto juntos, até alguém abrir a caixa.' },
    ],
  },
  {
    theme: 'dark',
    title: 'Abrir a caixa é medir',
    flow: true,
    cards: [
      { label: 'ANTES', heading: 'Caixa fechada', text: 'Vivo e morto, cada um com a sua chance.' },
      { label: 'MEDIR', heading: 'Abrir a caixa', text: 'Olhar obriga o gato a "escolher".' },
      { label: 'DEPOIS', heading: 'Um resultado só', text: 'Vivo ou morto. Nunca os dois.' },
    ],
    note: 'É como bater a mão numa moeda girando: ela para em cara ou em coroa. Faça isso muitas vezes e você descobre as chances, tipo 70% cara e 30% coroa.',
  },
  {
    theme: 'cream',
    title: 'Emaranhamento: duas caixas combinadas',
    cards: [
      { image: 'cats', caption: 'Dois gatos, duas caixas, e os resultados andam juntos.' },
      {
        heading: 'Destinos amarrados',
        text: 'Emaranhar dois gatos é combinar as caixas. Nenhum dos dois tem resultado próprio, mas eles andam juntos: abriu uma caixa e viu o gato vivo? Já sabe o que tem na outra.\n\nNo jogo, os 12 qubits ficam amarrados em fila, então cada bit costuma combinar com o vizinho.',
      },
    ],
  },
  {
    theme: 'cream',
    title: 'Algoritmo quântico = circuito com portas',
    cards: [
      {
        heading: 'Fios e caixinhas',
        text: 'Cada fio é um qubit. Cada caixinha é uma porta quântica. Você lê da esquerda para a direita, como uma receita.\n\n• H: faz a moeda girar, meio a meio.\n• CNOT: vira o segundo qubit se o primeiro for 1. É assim que os dois ficam amarrados.\n• Medição: abre a caixa e sai 0 ou 1.',
      },
      { diagram: 'circuit', caption: 'O circuito mais famoso: sai 00 ou 11, nunca 01 nem 10.' },
    ],
  },
  {
    theme: 'yellow',
    title: 'Clássico x quântico',
    table: [
      ['', 'Computador clássico', 'Computador quântico'],
      ['Guarda', 'Bits: 0 ou 1', 'Qubits: 0 e 1, com chances'],
      ['Portas', 'NOT, AND, OR', 'H, X, CNOT, RY, CZ'],
      ['Enquanto calcula', 'Um valor de cada vez', 'Várias possibilidades juntas'],
      ['Resultado', 'Sempre o mesmo', 'Um sorteio: roda várias vezes'],
      ['Serve para', 'Quase tudo do dia a dia', 'Alguns problemas difíceis (moléculas, criptografia)'],
    ],
    note: 'O quântico não é um computador mais rápido para tudo. Ele brilha só em alguns problemas. Aqui no jogo, o quântico sorteia o código e o clássico constrói as salas.',
  },
  {
    theme: 'dark',
    title: 'O circuito decide as chances',
    cards: [
      {
        heading: 'Portas que giram a moeda',
        text: 'O circuito do jogo usa 3 portas:\n• RY: gira a moeda no ângulo que a gente quiser\n• CX: o mesmo CNOT, amarra duas moedas\n• CZ: muda o ritmo (a fase) do giro\n\nCada andar tem o seu circuito de 12 qubits, e ele é sempre o mesmo para aquele andar.',
      },
      {
        label: 'A MESMA CAIXA, ABERTA MIL VEZES',
        image: 'bars',
        text: 'Rodamos o circuito 1024 vezes e contamos quantas vezes saiu cada resultado. Essa contagem fica guardada no jogo.',
      },
    ],
    note: 'Gráfico ilustrativo. Hoje os 1024 resultados de cada andar vêm de uma simulação exata do circuito. Com ?live no endereço, o jogo chama a API quântica.',
  },
  {
    theme: 'dark',
    title: 'Entropia: quanta surpresa tem o resultado',
    cards: [
      {
        heading: 'Previsível ou bagunçado?',
        text: 'Se a moeda desse sempre cara, não teria surpresa nenhuma: entropia zero. Se todo resultado tivesse a mesma chance, a surpresa seria a maior possível.\n\nAqui ela vai de 0 a 12. Os andares do jogo ficam entre 7 e 8: difíceis de prever, mas com alguns favoritos.',
      },
      { diagram: 'entropy', caption: 'De "sai sempre o mesmo" (0) a "pode sair qualquer um dos 4096" (12).' },
    ],
  },
  {
    theme: 'yellow',
    title: 'Do gato ao jogo',
    table: [
      ['Na história', 'No Quantum Backrooms'],
      ['Uma moeda girando', 'Um qubit (cada andar tem 12)'],
      ['Mil caixas iguais', 'Os 1024 resultados do circuito, guardados no jogo'],
      ['Abrir a caixa', 'Entrar num andar: o jogo sorteia um desses resultados'],
      ['O que saiu', 'Um código de 12 bits, que vira a semente do mapa'],
      ['Olhar a caixa sem parar', 'O QPS, que mede tudo a uns 4 m de você o tempo todo'],
      ['Caixa fechada', 'A porta e as paredes em superposição'],
    ],
  },
  {
    theme: 'dark',
    title: 'Como o mapa nasce',
    cards: [
      {
        heading: 'O código é a semente',
        text: 'O código de 12 bits vai para um gerador comum, nada quântico. Ele divide o andar em salas, abre passagens, coloca pilares e marca alguns lugares onde a porta pode estar.\n\nO quântico escolhe QUAL dos 4096 mapas você vai ver. Mesmo código, mesmo mapa, sempre.',
      },
      { diagram: 'map', caption: '010110101100 → salas, passagens e onde a porta pode estar (amarelo).' },
    ],
  },
  {
    theme: 'dark',
    title: 'O labirinto muda quando ninguém está medindo',
    flow: true,
    cards: [
      { label: 'MEDINDO', heading: 'Perto de você', text: 'O QPS (uns 4 m em volta) e os seus olhos medem o tempo todo. Ali, nada muda.' },
      { label: '18 S SEM MEDIR', heading: 'Ele evolui', text: 'Sem ninguém medindo, aquele trecho volta a ficar em superposição.' },
      { label: 'MEDIDO DE NOVO', heading: 'Outro resultado', text: 'O jogo sorteia um código novo e o trecho aparece reorganizado.' },
    ],
    note: 'Você percebe pelo aviso: a luz treme e passa um zumbido. O labirinto nunca fica sem saída. Os números (raio, 18 s) são regra de jogo; a ideia vem do efeito Zeno, no próximo slide.',
  },
  {
    theme: 'cream',
    title: 'Efeito Zeno: quem vigia, congela',
    cards: [
      {
        heading: 'Panela vigiada não ferve',
        text: 'Um sistema quântico que é medido sem parar quase não consegue mudar: cada medição puxa ele de volta. Isso é o efeito Zeno quântico, e já foi visto em laboratório com átomos.\n\nQuando param de medir, ele volta a evoluir. Na próxima medição, pode dar outra coisa.',
      },
      { image: 'spinning', caption: 'Sem ninguém olhando ela gira; vigiada o tempo todo, fica parada.' },
    ],
  },
  {
    theme: 'dark',
    title: 'O QPS é o seu mapa (e mede sem parar)',
    cards: [
      {
        heading: 'Pegue no lobby e leve junto',
        text: 'O QPS é o chip da estação 3. Ele mede tudo a uns 4 m de você, o tempo todo, e desenha o mapa (pulso direito ou M).\n\nClaro é o que ele está medindo agora. Apagado é a última leitura. Chiando com "?" é um trecho que mudou depois. A porta fica entre alguns lugares possíveis (amarelo tracejado): quando um deles entra no raio, o QPS mede e sorteia onde ela aparece.',
      },
      { diagram: 'qpsMap', caption: 'Mapa do QPS com um trecho que mudou (?).' },
    ],
  },
  {
    theme: 'cream',
    title: 'Parede em superposição e Visor Zeta',
    cards: [
      {
        heading: 'Parede ou passagem?',
        text: 'Algumas paredes estão "parede e passagem" ao mesmo tempo e ficam piscando, como a moeda girando. O Visor Zeta (Z ou pinça na testa) mostra quais são: no mapa, elas aparecem em roxo.\n\nSe você entra quando ela abre, você a mede: ela vira passagem e só volta a piscar quando você sai.',
      },
      { diagram: 'superposedWall', caption: 'Teste na parede roxa de treino, no fundo do salão à direita.' },
    ],
  },
  {
    theme: 'dark',
    title: 'Salto de fase: tunelamento',
    cards: [
      {
        heading: 'Atravessar a parede',
        text: 'No mundo quântico, uma partícula às vezes passa por uma barreira que, pelas regras do dia a dia, ela nunca conseguiria. Isso é tunelamento, e depende de sorte.\n\nNo jogo: palmas na parede (ou X) para atravessar até 2 blocos. Gasta 25 de energia e 3 de sanidade, e dá certo 92% das vezes. No mapa, essas paredes aparecem em azul.',
      },
      { diagram: 'tunneling', caption: 'A onda bate na barreira e um pedacinho passa.' },
    ],
  },
  {
    theme: 'yellow',
    title: 'O que é de verdade e o que é jogo',
    cards: [
      {
        label: 'QUÂNTICO DE VERDADE',
        text: '• O circuito de 12 qubits de cada andar\n• As chances e a contagem dos 1024 resultados\n• Sortear um resultado para o andar, a porta e cada trecho que muda\n• A entropia de cada andar',
      },
      {
        label: 'INVENÇÃO DO JOGO',
        text: '• A entidade, a sanidade e a energia\n• As paredes que piscam\n• O tempo e o raio para um trecho mudar\n• Montar as salas a partir do código',
      },
    ],
    note: 'Boa sorte, agente. A porta amarela no fundo do salão leva ao ANDAR 01.',
  },
];
