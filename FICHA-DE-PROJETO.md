# Ficha de projeto — Quantum Backrooms VR

OP03 · Experiências Imersivas · Aula 1 — Genealogia da imersão
Autora: Júlia

**Em uma frase:** jogo de horror em VR (A-Frame/WebXR, Meta Quest) ambientado nos Backrooms, em que cada andar é gerado a partir de medições de um circuito quântico, e o mundo só "decide" o que é quando o jogador o mede ou o observa.

---

## 1. Domínio — onde a experiência acontece

Entretenimento (jogo de horror e sobrevivência), com um segundo uso de divulgação científica: tornar sensível a ideia de superposição e medição quântica. Acontece no navegador do Meta Quest, em ambiente doméstico, de sala de aula ou de feira, com sessões curtas de ~10 minutos.

## 2. Sentir — o quê, e para quê

- **O quê:** desorientação em espaço liminal (corredores amarelos sem fim), vigilância constante (uma entidade que só se vê com o visor) e incerteza: a parede à frente pode não ser a mesma depois de você desviar o olhar.
- **Para quê:** (a) prazer do medo controlado, que é o prazer de Aristóteles; (b) aprender por experiência que, na física quântica, observar não é neutro, e que um estado só se fixa ao ser medido.

## 3. Teste da tela — por que não numa tela

Numa tela, a pessoa vê o corredor de fora, por uma janela. No headset, a escala (teto baixo, corredores estreitos) é sentida pelo corpo, e a cabeça é o olhar. Isso importa porque **o olhar é a mecânica**: olhar para a entidade acumula exposição, e cobrir os olhos com as mãos protege. Numa tela, "observar" seria só mover um cursor. Em VR, observar e se proteger de observar são gestos do corpo, o que casa literalmente com a ideia de medição.

## 4. Moldura — o que fica dentro, e se ela se mostra

- **Dentro:** os andares dos Backrooms (papel de parede, carpete, luz fluorescente, escadas), a entidade e o console de medição.
- **No espaço, a moldura se esconde:** não há menu nem barra de tela. A interface é diegética: HUD no pulso, visor, console no cenário. O jogador não vê "bordas" do mundo.
- **No conceito, a moldura se mostra:** o jogo declara a origem dos dados (rótulo `IBM-QPU` ou `LOCAL-SIM` e telemetria de entropia) e, ao fim, revela como o mapa foi gerado. Isso mantém o prazer de Aristóteles (sabe-se que é representação) sem a ilusão total de Platão.

## 5. Corpo — onde fica, e o que pode fazer

- **Onde fica:** em pé ou sentado, dentro da área rastreada do Quest (o sweet spot). Como a área real é pequena e o mapa é grande, o corpo fica preso a uma "plataforma", como o público do panorama: quem se move pelo mapa é o rig, via joystick, e não o corpo.
- **O que pode fazer:** girar a cabeça (olhar), apontar com o controle e usar o gatilho para medir no console, cobrir os olhos com as mãos, ligar o visor, executar phase shift. Conforto: giro em passos (snap turn) e vinheta ao mover, para reduzir enjoo.

## 6. Risco — como serviria para enganar

- **Enganar sobre a ciência:** vender como "universo quântico real" algo que é só aleatoriedade comum. É um risco real aqui: o circuito atual (H + CZ) produz distribuição uniforme, indistinguível de um gerador comum. Mitigação: rótulo honesto de fonte dos dados, circuito que de fato molde o mapa e revelação final de como funciona.
- **Enganar o corpo (perigo de Platão / Eberhard):** a mesma imersão que suspende a capacidade de relativizar o que se vê pode desorientar, assustar demais ou dificultar a saída. Mitigação: botão de pausa/saída sempre acessível, aviso de conteúdo e de conforto antes de começar, e sessões curtas.
- **Pressão de permanência:** a drenagem de sanidade empurra o jogador a continuar. Não prender por medo: a derrota deve ser clara e o reinício, simples.
