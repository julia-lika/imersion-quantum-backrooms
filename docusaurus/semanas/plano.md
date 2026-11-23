---
title: Plano de 5 semanas
sidebar_label: Plano
sidebar_position: 0.5
---

# Plano de 5 semanas

Contexto: projeto solo · alvo Meta Quest (navegador, WebXR) · quântico com simulador e dados reais da IBM pré-gravados.

Para marcar uma tarefa como feita, troque `- [ ]` por `- [x]` neste arquivo (`docusaurus/semanas/plano.md`).

| Semana | Período | Foco |
| --- | --- | --- |
| 1 | 16 a 19/11 | Proposta, ficha de projeto e Fase 0 (entregue) |
| 2 | 23 a 27/11 | Revisão da arquitetura quântica e ambientação |
| 3 | 30/11 a 04/12 | Gerador quântico v2 e loop completo |
| 4 | 07 a 11/12 | Conteúdo, áudio e conforto, até o feature freeze |
| 5 | 14 a 18/12 | Polimento, performance e entrega |

---

## Onde estamos

O que o jogo já tem hoje:

- A-Frame + WebXR, servido por Caddy com HTTPS local e publicado no GitHub Pages.
- Lobby da Fase 0 como tutorial: QPS e Água de Amêndoa de treino (reaparecem a cada 10 s), parede de treino para o Salto de Fase e parede superposta para o Visor Zeta, laptop com terminal, TV com câmera de segurança mostrando a entidade e porta de saída.
- Loop base: medir com o QPS, revelar as escadas e descer para o próximo andar, com save local.
- Sobrevivência: sanidade, energia, Visor Zeta e Salto de Fase.
- Entidade que patrulha e persegue, nítida só com o visor.
- Visual de Level 0 (papel de parede, carpete, forro e luminárias), props PSX e Água de Amêndoa que se pega com a mão.
- Painel de pulso Q-LINK, mãos XR, interface em pt-BR e teclas de desktop (WASD, H, Q, E, Z, X, P).
- Circuito quântico novo (RY por andar, cadeia de CX, anel de CZ) e banco de medições pré-gravado, com o rótulo da origem no HUD.

O que ainda não está como deveria:

- **O quântico ainda não molda o mapa.** O bitstring sorteado dos `counts` vira só a semente de um gerador clássico (divisão de salas). A distribuição do circuito não aparece na forma do andar.
- **Os 5 andares do banco vêm do simulador** (`LOCAL-SIM`). Nenhum job da IBM foi gravado ainda.
- O rótulo da origem dos dados não aparece no headset, e a tela final de revelação não existe.
- Falta vitória, derrota com reinício, áudio e opções de conforto (snap turn, teleporte).

---

## Definição de pronto (MVP)

Uma pessoa sem explicação consegue jogar cerca de 10 minutos no Quest:

- [ ] 5 andares jogáveis, cada um gerado a partir de dados quânticos distintos.
- [ ] O mapa reflete a distribuição do circuito (marginais, entropia e correlações), e não só uma semente.
- [ ] Loop completo: explorar, medir, achar as escadas e descer; vitória no andar 5 e derrota com sanidade 0.
- [ ] Estável a 72 fps ou mais no Quest.
- [ ] Dados de todos os andares vindos de QPU real (pré-gravados), com a origem declarada no headset.
- [ ] Tela final que revela como o mapa foi gerado.
- [ ] Hospedado em HTTPS estático, sem backend obrigatório.

---

## Semana 1 · 16 a 19/11 · Proposta e Fase 0 (entregue)

- [x] Apresentação da proposta (Google Slides).
- [x] Ficha de projeto da Aula 1.
- [x] Fase 0 jogável: console de medição, escadas, próximo andar e save local.
- [x] Rodar no Meta Quest.
- [x] Novo circuito (`backend/quantum_circuit.py`) e `tools/pregen.py`.
- [x] Banco `site/data/quantum-bank.json` (simulado) e testes do banco.
- [ ] Jobs reais na IBM → movido para a Semana 2.
- [ ] Licença do Ottoman Signs → movido para a Semana 2.

## Semana 2 · 23 a 27/11 · Revisão da arquitetura quântica e ambientação

**Ambientação e tutorial**

- [x] Visual de Level 0 nos labirintos.
- [x] Props PSX fora das células do QPS e da Água de Amêndoa.
- [x] Água de Amêndoa com pegar e beber pela mão.
- [x] Entidade que persegue e Level 0 mais escuro.
- [x] Lobby da Fase 0 com painel Q-LINK, escuridão na porta e transição de piscar.
- [x] Itens de treino que reaparecem, laptop, TV com a entidade e porta que fecha.
- [x] Interface em pt-BR e novas teclas de desktop.

**Revisão da arquitetura quântica**

- [ ] Documentar a arquitetura atual: circuito, banco, sorteio dos `counts` e como o bitstring vira mapa hoje.
- [ ] Registrar o problema: o bitstring só semeia o gerador clássico, então o circuito não faz diferença visível.
- [ ] Definir o novo mapeamento: cada qubit é uma região de uma grade 3×4; a marginal P(qᵢ=1) define o tipo e a densidade da região; a entropia dos `counts` define o número de paredes superpostas e a agressividade da entidade; as correlações entre vizinhos definem corredores contínuos.
- [ ] Validar no simulador, com gráficos: distribuição não uniforme por andar e correlações visíveis entre qubits vizinhos.
- [ ] Revisar os parâmetros do circuito por andar (θ das rotações RY) para que cada andar tenha uma cara diferente.
- [ ] Submeter os jobs na IBM para os 5 andares e gravar `job_id`, `backend` e `timestamp` no banco, mantendo o simulado como reserva.
- [ ] Testes: contrato do banco com dados da IBM e determinismo do novo mapeamento.

**Outros**

- [ ] Licença do Ottoman Signs: confirmar com o autor ou remover.
- [ ] Página da Semana 2 na documentação e entradas no devlog.

## Semana 3 · 30/11 a 04/12 · Gerador quântico v2 e loop completo

**Implementação do gerador quântico**

- [ ] Gerador v2 guiado pelos `counts`, substituindo a divisão de salas com semente.
- [ ] Conectividade garantida (BFS) até as escadas.
- [ ] Paredes superpostas guiadas pela entropia, colapsando ao medir com o QPS.
- [ ] Carregar os dados gravados da IBM no runtime, sem chamar `/api/measure`.
- [ ] Origem dos dados (`IBM-QPU` ou `LOCAL-SIM`) visível no headset, no painel Q-LINK.
- [ ] Testes: todo mapa do banco é conectado e as escadas são alcançáveis.

**Loop**

- [ ] Variação visual por andar (luz, névoa, texturas).
- [ ] Vitória no andar 5 e derrota com sanidade 0, com reinício simples.
- [ ] Andares 1 a 3 jogáveis de ponta a ponta no Quest, sem recarregar a página.
- [ ] Página da Semana 3 na documentação e devlog.

## Semana 4 · 07 a 11/12 · Conteúdo, áudio e conforto (feature freeze dia 11)

- [ ] Andares 4 e 5, com dificuldade crescente (drenagem de sanidade, velocidade e raio de caça da entidade).
- [ ] Áudio: zumbido das luminárias, passos, áudio espacial da entidade e som ao medir.
- [ ] IA da entidade: patrulha, caça e perda de rastro, com feedback claro de dano.
- [ ] Conforto: snap turn, vinheta ao se mover e opção de teleporte.
- [ ] Pausa e saída sempre à mão, e aviso de conteúdo e conforto antes de começar.
- [ ] Tela final de revelação: como o mapa foi gerado, origem dos dados e "medir não é olhar".
- [ ] Partida completa do andar 1 ao 5 sem bugs bloqueantes. Depois disso, nenhuma feature nova.
- [ ] Página da Semana 4 na documentação e devlog.

## Semana 5 · 14 a 18/12 · Polimento, performance e entrega

- [ ] Otimização no Quest: menos de ~100 draw calls, texturas de até 1024², no máximo 1 ou 2 luzes dinâmicas.
- [ ] Pelo menos 3 playtests com pessoas diferentes; corrigir só o que bloqueia ou enjoa.
- [ ] Fallback de desktop documentado.
- [ ] Créditos dos assets (Yasu CC BY 4.0, Backrooms Vol. 2 CC0, PSX Liminal Kit CC BY 4.0, entre outros).
- [ ] Página na documentação explicando a arquitetura quântica e o uso de dados reais da IBM.
- [ ] Roteiro de demo de 3 minutos e vídeo de reserva.
- [ ] Apresentação final e página da Semana 5 na documentação.

---

## Lista de cortes

Do primeiro a cortar ao último:

1. API da IBM ao vivo no navegador (manter só o banco gravado).
2. Gestos de mão (manter os controles).
3. Andares 4 e 5 (entregar 3 sólidos em vez de 5 frágeis).
4. Variações de IA da entidade.
5. Áudio procedural (usar loops gravados CC0).

## Riscos

| Risco | Mitigação |
| --- | --- |
| Fila ou cota da IBM atrasa | Submeter os jobs ainda na Semana 2; simulador rotulado como reserva |
| Novo gerador não fica pronto | Manter o gerador atual como fallback até o v2 passar nos testes de conectividade |
| Quest com fps baixo | Medir a cada semana; cortar props primeiro |
| Escopo cresce sozinho | Feature freeze no dia 11/12 e lista de cortes |
| Enjoo em VR | Snap turn, vinheta e teleporte; testar cedo |
| Licença do Ottoman Signs | Resolver na Semana 2 ou remover |
