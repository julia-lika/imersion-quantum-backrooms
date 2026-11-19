# Quantum Backrooms

Protótipo em A-Frame servido por Caddy com HTTPS local e geração de níveis
orientada por medições quânticas.

## Proposta e conceito imersivo

Quantum Backrooms VR é um jogo de horror em realidade virtual, feito com A-Frame
e WebXR para o navegador do Meta Quest, em que cada andar dos Backrooms é gerado
a partir de medições de um circuito quântico. Ele parte de uma referência, o
Quantum Backrooms da Moth, jogo gratuito de navegador cujos labirintos, segundo
a empresa, nascem de computadores quânticos reais. A proposta daqui conserva a
ideia central, dados quânticos que moldam o mapa e uma mecânica de medir para
colapsar o estado, e a leva para o corpo: o jogador olha, aponta, cobre os olhos
e mede num console dentro do cenário. A frase que resume o projeto é que o mundo
só decide o que é quando você o mede.

A leitura do projeto a partir da Aula 1, "Genealogia da imersão", começa pela
ideia de *mimese*. Para Platão, imitar é do lado da aparência e afasta da
verdade; para Aristóteles, representar é uma forma de aprender e de apresentar
as possibilidades do mundo. Um jogo sobre computação quântica precisa se
posicionar entre os dois, porque o que ele imita é um fenômeno que quase ninguém
vê. A distinção que organiza a ficha de projeto é a da moldura: a moldura à vista
traz o prazer de reconhecer a imitação, e a moldura escondida é a que pode
enganar. Toda imersão, diz a aula, esconde a moldura e prende o corpo num ponto,
e quem projeta decide o que a pessoa vai sentir e para quê.

O domínio do projeto é o entretenimento, mais precisamente o horror e a
sobrevivência, com a divulgação científica como segundo uso. A experiência
acontece no navegador do Quest, em sessões curtas de cerca de dez minutos, em
casa, em sala de aula ou numa feira. O que a pessoa deve sentir é desorientação,
vigilância e incerteza: corredores iguais, uma entidade que só se vê com o visor
e paredes que podem mudar quando o olhar se desvia. Esse medo, porém, é o
veículo, e não o destino. O objetivo é despertar a curiosidade sobre como o
mundo quântico funciona, a pergunta "por que a parede mudou quando eu deixei de
olhar?" servindo de porta para entender que medir não é um ato neutro.

O teste da tela pergunta por que a experiência não poderia acontecer num
monitor, e a resposta é que o olhar vira a mecânica. Numa tela, observar é mover
um cursor. No headset, encarar a entidade acumula exposição e cobra um preço da
sanidade, enquanto cobrir os olhos com as mãos protege. A escala dos corredores,
sentida no corpo, e o gesto de medir tornam literal a ideia de que observar
interfere no que se observa. É essa correspondência entre a física que se quer
ensinar e o gesto que o jogador faz que justifica o meio.

A moldura, no projeto, tem duas posições. Dentro do espaço ela se esconde: não há
menus de tela, e a informação vive no mundo, no painel do pulso, no visor e no
console. No conceito, porém, ela se mostra: o jogo declara se os dados vieram de
um computador quântico da IBM (`IBM-QPU`) ou de um simulador (`LOCAL-SIM`), e
a partida termina com uma revelação de como o mapa foi gerado. A moldura fica
escondida enquanto se joga e à mostra nas bordas da experiência, no começo e no
fim, o que mantém a imersão e preserva a possibilidade de pensar "isto é uma
representação". Vale registrar que esse compromisso ainda não está cumprido por
inteiro: o painel com a origem dos dados existe hoje como elemento de tela do
desktop, que não aparece no headset, e a tela final de revelação ainda precisa
ser construída.

O corpo, por sua vez, fica preso num ponto, como o público de um panorama. O
jogador está em pé ou sentado dentro da área rastreada do headset, e o espaço
real é pequeno demais para o mapa, de modo que quem se desloca é o mundo: o
joystick, ou o balançar dos braços, move o rig enquanto a cabeça olha, o controle
aponta e mede e as mãos cobrem os olhos. A aula chama a atenção para o fato de
que o headset fixa a distância e liberta o corpo no espaço, e o projeto assume
essa dupla condição em vez de escondê-la.

O risco, por fim, é o lado de Platão como projeto. O exemplo da aula é o
panorama de Sedan, exibido em Berlim em 1883, com o público numa plataforma a
doze metros da tela, no limite do que o olho distingue, de modo que a pincelada
desaparece e a pintura passa a valer como lugar. Foi feito, na leitura da aula,
para suspender a capacidade de relativizar o que se vê. O headset repete essa
estrutura, e quem controla a moldura e o corpo pode manipular, desorientar ou
convencer. No jogo, manipular seria usar a perda de sanidade para empurrar a
pessoa a continuar; desorientar seria deixá-la sem saída num mundo que se move
enquanto o corpo está parado; e convencer seria passar um sorteio comum por
"universo quântico real", exibir indicadores como se fossem medidas de hardware
ou sugerir que o olhar de uma pessoa altera a realidade, quando em física medir é
interagir com um aparelho. A versão inicial do circuito, aliás, caía nesse
último caso, porque produzia uma distribuição exatamente uniforme, equivalente a
um sorteio comum, o que motivou a troca por um circuito de distribuição desigual
e correlacionada.

Mitigar esse risco não significa deixar o jogo menos real. O perigo de Sedan não
estava no realismo, e sim na falta de saída e de pistas de que aquilo era uma
pintura. A resposta do projeto mantém a escuridão, o susto e a incerteza, que
são o que faz do jogo um jogo de horror, e devolve à pessoa a chance de
relativizar: pausa e saída sempre à mão, vinheta e teleporte contra o enjoo,
derrota clara e sessões curtas contra a pressão de continuar, origem dos dados
dentro do mundo e uma tela final que explique que medir não é olhar e que o gato
de Schrödinger é só uma metáfora. É a mesma conclusão da aula aplicada ao
projeto: quem esconde a moldura precisa, em algum ponto, mostrá-la.

## Rodar

```bash
docker compose up --build
```

Abra `https://localhost:8443`. Na primeira execução, aceite o certificado local do Caddy.

O conteúdo de desenvolvimento fica em `site/`. Como essa pasta é montada no contêiner, alterações em `site/index.html` aparecem após recarregar o navegador sem refazer a imagem.

## IBM Quantum

O navegador nunca recebe o token da IBM. A API Python em `backend/` é acessada
internamente pelo Caddy em `/api/measure`.

1. Copie `.env.example` para `.env`.
2. Preencha `IBM_QUANTUM_API_KEY` com a chave da IBM Quantum Platform.
3. Preencha `IBM_QUANTUM_INSTANCE` com a instância/CRN, se sua conta exigir.
4. Opcionalmente, defina `IBM_QUANTUM_BACKEND` para fixar um backend; vazio usa o
   backend operacional menos ocupado com pelo menos 12 qubits.
5. Rode novamente:

```bash
docker compose up --build
```

Sem uma chave válida, `/api/measure` usa o fallback local e o HUD mostra
`LOCAL-SIM`. Com a chave, o serviço envia um circuito de 12 qubits pelo
`SamplerV2` e mostra `IBM-QPU` junto do backend utilizado.

Cada medição é limitada por um intervalo mínimo para não consumir a cota do
plano gratuito a cada entrada e saída do raio de medição.

## Banco de medições (caminho padrão)

O jogo sorteia amostras de `site/data/quantum-bank.json`, sem depender da fila
ou da cota da IBM. O HUD mostra a origem verdadeira, por exemplo
`LOCAL-SIM // python-statevector (gravado)` ou `IBM-QPU // <backend> (gravado)`.
Para forçar a API ao vivo, abra a página com `?live`.

O circuito (`backend/quantum_circuit.py`) tem rotações RY por andar, cadeia de CX,
nova camada de RY, anel de CZ e RY final. O circuito anterior (H + CZ) produzia
distribuição exatamente uniforme; este tem distribuição não uniforme e
correlações entre qubits vizinhos. Convenção: o caractere `i` do bitstring é o
qubit `i`.

Regerar o banco:

```bash
python3 tools/pregen.py                 # simulador, sem credenciais
IBM_QUANTUM_API_KEY=... python3 tools/pregen.py --backend ibm   # QPU real (precisa de qiskit-ibm-runtime)
```

Testes: `npm test` (JavaScript) e, em `backend/`,
`python3 -m unittest discover -s tests -v` (circuito).

## Vertical slice da Fase 0

O protótipo recria a camada jogável observada no Quantum Backrooms: o painel de
telemetria acompanha `FLOOR`, `QPS`, `TICK`, estados candidatos e entropia da
grade; a medição do console colapsa os candidatos e atualiza a sanidade; e o
stream local abre estados superpostos entre medições.

Controles no desktop: `WASD` movimenta, `V` alterna o Zeta Visor, `Space + W`
executa um phase shift e `P` pausa o stream. No headset, os controladores usam
laser para apontar ao console e o gatilho mede o estado.

Após a medição, o QPS revela uma posição de escadas válida no mapa. Ao entrar
no volume de chegada, o jogo salva o andar concluído, aplica uma transição e
gera o próximo andar. O progresso e a sanidade são restaurados pelo save local
`quantum-backrooms-save-v1`.
