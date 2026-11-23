---
title: Plano de 5 semanas
sidebar_label: Plano
sidebar_position: 0.5
---

# Plano de 5 semanas

Estou fazendo o projeto sozinha, com o Meta Quest como alvo e rodando no navegador. A ideia é ter um jogo curto, de uns 10 minutos, em que cada andar dos Backrooms nasce de medições quânticas.

| Semana | Datas | No que vou focar |
| --- | --- | --- |
| [1](./semana-1) | 16 a 19/11 | Proposta, ficha e primeira versão (já entregue) |
| [2](./semana-2) | 23 a 27/11 | Rever a parte quântica e deixar o jogo com cara de Backrooms (agora) |
| [3](./semana-3) | 30/11 a 04/12 | Fazer o mapa nascer dos dados e fechar o loop do jogo |
| [4](./semana-4) | 07 a 11/12 | Conteúdo, som e conforto |
| [5](./semana-5) | 14 a 18/12 | Polir e apresentar |

Cada semana tem a sua lista na própria página, e eu vou marcando conforme termino.

## Onde quero chegar

No fim, quero que alguém pegue o headset sem explicação nenhuma e consiga jogar. Para mim, isso significa:

- [ ] ter 5 andares, cada um vindo de uma medição diferente;
- [ ] o mapa realmente refletir o circuito, e não só usar o resultado como semente;
- [ ] dar para ganhar no andar 5 e perder quando a sanidade zera;
- [ ] rodar a 72 fps no Quest;
- [ ] usar dados de um computador quântico de verdade e mostrar isso dentro do jogo;
- [ ] terminar com uma tela que explica como o mapa foi gerado.

## Onde estou agora

Já tenho o lobby funcionando como tutorial, com o QPS, a Água de Amêndoa, as paredes de treino, o laptop, a TV e os slides. O loop básico de medir, achar a escada e descer também funciona, junto com a sanidade, o Visor Zeta, o Salto de Fase e a entidade que persegue. O visual já está bem mais perto do Level 0.

O que mais me incomoda hoje é que o quântico ainda não muda o mapa de verdade: o resultado da medição só serve de semente para um gerador comum. Também ainda não rodei nada na IBM, então os cinco andares vêm do simulador. Isso é o centro da Semana 2.

## Se o tempo apertar

Vou cortando nesta ordem: a API da IBM ao vivo (fico só com os dados gravados), os gestos de mão, os andares 4 e 5, as variações da entidade e, por último, o som feito na hora.

## O que pode dar errado

- A fila da IBM pode demorar, então quero mandar os jobs logo e manter o simulador como reserva.
- O gerador novo pode atrasar. Nesse caso, sigo com o atual até o novo funcionar.
- O Quest pode não aguentar. Vou medir toda semana e tirar props primeiro.
- O escopo pode crescer. Por isso, nada de coisa nova depois de 11/12.
- Pode dar enjoo, então snap turn, vinheta e teleporte entram na Semana 4.
