---
title: Ficha de projeto
sidebar_label: Ficha de projeto
sidebar_position: 2
---

# Ficha de projeto · Quantum Backrooms VR

OP03 · Experiências Imersivas · Aula 1, "Genealogia da imersão" · Autora: Júlia

**Em uma frase:** jogo de horror em VR (A-Frame/WebXR, Meta Quest) ambientado nos Backrooms, em que cada andar é gerado a partir de medições de um circuito quântico, e o mundo só "decide" o que é quando o jogador o mede ou o observa.

**Posição sobre a mimese:** o jogo fica do lado de Aristóteles. Ele representa um fenômeno que quase ninguém vê, a medição quântica, para que se possa aprender com ele. O cuidado é não cair no que Platão condenava: uma cópia que se passa pela coisa e afasta da verdade. Por isso a ficha volta o tempo todo à pergunta de quando a moldura se esconde e quando ela se mostra.

---

## 1. Domínio · onde a experiência acontece

Entretenimento (jogo de horror e sobrevivência), com um segundo uso de divulgação científica: tornar sensível a ideia de superposição e medição quântica. Acontece no navegador do Meta Quest, em casa, em sala de aula ou numa feira, em sessões curtas de cerca de 10 minutos.

## 2. Sentir · o quê, e para quê

- **O quê:** desorientação num espaço liminar (corredores amarelos sem fim), vigilância constante (uma entidade que só se vê com o visor) e incerteza: a parede à frente pode não ser a mesma depois que você desvia o olhar.
- **Para quê:** (a) o prazer do medo controlado, que é o prazer de Aristóteles, o de reconhecer que se trata de uma representação; (b) aprender pela experiência que, na física quântica, observar não é neutro e que um estado só se fixa ao ser medido. O medo é o veículo, e a curiosidade é o destino: a pergunta "por que a parede mudou quando eu deixei de olhar?" é a porta de entrada para o conceito.

## 3. Teste da tela · por que não numa tela

Numa tela, a pessoa vê o corredor de fora, por uma janela, com a moldura do monitor sempre à vista. No headset, a escala (teto baixo, corredores estreitos) é sentida pelo corpo, e a cabeça é o olhar. Isso importa porque **o olhar é a mecânica**: encarar a entidade acumula exposição, e cobrir os olhos com as mãos protege. Numa tela, "observar" seria só mover um cursor. Em VR, observar e se proteger de observar são gestos do corpo, o que traduz de forma literal a ideia de medição.

Pensando nas três técnicas da aula, a perspectiva dá a profundidade a partir de um ponto, o panorama tira as bordas da imagem e o headset junta as duas coisas: fixa a distância dos olhos à imagem e deixa o corpo livre dentro da área rastreada. É essa combinação que nenhuma tela oferece.

## 4. Moldura · o que fica dentro, e se ela se mostra

- **Dentro:** os andares dos Backrooms (papel de parede, carpete, luz fluorescente, escadas), a entidade e o console de medição.
- **No espaço, a moldura se esconde:** não há menu nem barra de tela. A interface é diegética: HUD no pulso, visor e console no cenário. O jogador não vê as "bordas" do mundo. Das duas formas de esconder a moldura vistas em aula, o jogo usa as duas: o trompe l'oeil, nas texturas e na névoa que fingem um corredor infinito, e a presencialidade, no console e nas escadas, que dividem o espaço com o corpo do jogador.
- **No conceito, a moldura se mostra:** o jogo declara a origem dos dados (rótulo `IBM-QPU` ou `LOCAL-SIM` e telemetria de entropia) e, ao fim, revela como o mapa foi gerado. A moldura fica escondida enquanto se joga e à mostra nas bordas da experiência, no começo e no fim. Isso mantém o prazer de Aristóteles (sabe-se que é representação) sem a ilusão total que preocupava Platão.
- **O que ainda falta:** hoje o painel com a origem dos dados só aparece na versão de desktop, e não no headset, e a tela final de revelação ainda precisa ser construída. As duas coisas estão no plano das próximas semanas.

## 5. Corpo · onde fica, e o que pode fazer

- **Onde fica:** em pé ou sentado, dentro da área rastreada do Quest (o sweet spot). Como a área real é pequena e o mapa é grande, o corpo fica preso a uma "plataforma", como o público do panorama: quem se move pelo mapa é o mundo, pelo joystick, e não o corpo.
- **O que pode fazer:** girar a cabeça (olhar), apontar com o controle e usar o gatilho para medir no console, cobrir os olhos com as mãos, ligar o visor e executar o phase shift.
- **Conforto:** giro em passos (snap turn) e vinheta ao se mover, para reduzir o enjoo de ver o mundo andar com o corpo parado.

## 6. Risco · como serviria para enganar

O risco que a aula aponta é o do panorama de Sedan: uma imersão feita para suspender a capacidade de relativizar o que se vê. O headset faz o mesmo, porque prende o corpo num ponto e apaga as bordas do mundo. Neste jogo, isso aparece de quatro formas:

- **Enganar sobre a ciência:** vender como "universo quântico real" algo que é só aleatoriedade comum. É um risco concreto aqui: o circuito atual (H + CZ) produz uma distribuição uniforme, indistinguível de um gerador comum. **Mitigação:** rótulo honesto da fonte dos dados, um circuito que de fato molde o mapa e a revelação final de como tudo funciona.
- **Enganar o corpo:** como Eberhard, que saiu do panorama tonto e sem ter como escapar, a mesma imersão que dá medo pode desorientar demais ou dificultar a saída. **Mitigação:** pausa e saída sempre à mão (inclusive por gesto), aviso de conteúdo e de conforto antes de começar, vinheta ao mover, opção de teleporte e sessões curtas.
- **Convencer de algo falso:** passar um sorteio comum por "universo quântico real", exibir indicadores como se fossem medidas de hardware ou sugerir que o olhar de uma pessoa altera a realidade, quando, na física, medir é interagir com um aparelho. **Mitigação:** uma tela final que explique que medir não é olhar e que o gato de Schrödinger é só uma metáfora.
- **Pressão para continuar:** a sanidade cai sem parar e empurra o jogador a seguir jogando. **Mitigação:** não prender pelo medo. A derrota deve ser clara e o reinício, simples.

Mitigar esse risco não significa deixar o jogo menos real. O perigo de Sedan não estava no realismo, e sim na falta de saída e de pistas de que aquilo era uma pintura. O jogo mantém a escuridão, o susto e a incerteza, que fazem dele um jogo de horror, e devolve à pessoa a chance de relativizar.

Toda imersão esconde a moldura e prende o corpo num ponto, e quem projeta decide o que a pessoa vai sentir, e para quê. Aqui, a decisão é usar o medo para levar à curiosidade, e mostrar a moldura no fim para que a pessoa saia sabendo que viveu uma representação.
