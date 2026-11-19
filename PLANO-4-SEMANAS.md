# Quantum Backrooms VR — Plano de 4 semanas

Início assumido: qua 18/nov/2026 · Feature freeze: ter 8/dez · Entrega: seg 15/dez.
Contexto: solo · alvo Meta Quest (navegador, WebXR) · quântico = simulador + dados reais da IBM pré-gerados.
Premissa de capacidade: ~15–20 h/semana. Se for menos, corte pela lista da seção 6.

---

## 1. Ponto de partida (o que já existe no repo)

A "Fase 0" já está pronta, então o plano **parte dela**, não do zero:

- A-Frame 1.8 + Caddy HTTPS local + API FastAPI (`backend/main.py`) com Qiskit/IBM Runtime e fallback local.
- Loop base: console de medição → QPS revela escadas → próximo andar; save local; sanidade, energia, Zeta Visor, phase shift.
- Entidade `quantum-ghost`, `superposed-wall`, mãos XR, locomoção, HUD de pulso, props, 6 suítes de teste (`npm test`).
- Assets: Yasu (CC BY 4.0), Backrooms Vol. 2 (CC0), Ottoman Signs (**licença não confirmada**).

**Dois problemas que precisam de decisão na semana 1:**

1. **O "quântico" hoje não faz diferença.** O circuito é H em todos os qubits + anel de CZ. Gates CZ são diagonais, então a medição na base Z continua **uniforme** — equivale a um PRNG num QPU ideal (só o ruído do hardware real diferencia). Além disso, o bitstring vira só uma semente de 12 bits para um labirinto clássico (backtracker 11×11).
2. **Dependência de fila/cota IBM em runtime** é o maior risco de demo. Resolver com banco pré-gravado (seção 3).

---

## 2. Definição de pronto (MVP)

Uma pessoa sem explicação consegue jogar ~10 min no Quest:

- [ ] 5 andares jogáveis, cada um gerado a partir de dados quânticos distintos.
- [ ] Loop completo: explorar → medir → achar escadas → descer; condição de vitória (andar 5) e de derrota (sanidade 0).
- [ ] Estável ≥ 72 fps no Quest (ver orçamento na seção 5).
- [ ] Dados de todos os andares vindos de **QPU real** (pré-gravados), com rótulo honesto no HUD.
- [ ] Hospedado em HTTPS estático (sem backend obrigatório).

---

## 3. Arquitetura quântica proposta

**Princípio:** o dado quântico precisa *moldar* o mapa, não só semear.

**Circuito (12 qubits, por andar):** camada de `RY(θᵢ)` com θ dependente do andar (controla viés) + camadas de `CX`/`CZ` + `RY` final. Isso gera distribuição **não uniforme e correlacionada**.

**Do resultado ao mapa:**

- Cada qubit = uma região do mapa (grade macro 3×4).
- Marginal P(qᵢ=1) → tipo/densidade da região (salão aberto com pilares vs. corredores).
- Bitstring amostrado de `counts` → "colapso" que o jogador observa ao medir.
- Entropia de Shannon dos `counts` → nº de paredes superpostas e agressividade da entidade (o HUD já mostra entropia).
- Correlações entre qubits vizinhos → regiões coerentes (corredores contínuos, não ruído).

**Banco pré-gravado:**

```
tools/pregen.py  →  site/data/quantum-bank.json
  { floor, circuit_params, counts, backend, job_id, timestamp, source }
```

Rodar na semana 1 (fila pode demorar). Em runtime, o console sorteia amostras dos `counts` gravados (cada medição ainda é "viva"). HUD mostra `IBM-QPU (gravado)` vs `LOCAL-SIM`. API ao vivo vira opcional (stretch), nunca caminho crítico.

---

## 4. Cronograma

### Semana 1 (18–24/nov) — Fundação e decisões

Meta: rodar no Quest, resolver o quântico, disparar jobs reais.

- [ ] Commitar o estado atual (há arquivos não rastreados) e criar branch de trabalho.
- [ ] Rodar no Quest de verdade (HTTPS na rede local ou túnel); anotar fps, controles, conforto. **Fazer no dia 1–2.**
- [ ] Criar `tools/pregen.py` com o novo circuito; validar no simulador (distribuição não uniforme, correlações visíveis).
- [ ] Submeter jobs IBM para 5 andares (confira sua cota no plano gratuito); gerar também versão simulada de reserva.
- [ ] Decidir licença do Ottoman Signs (contatar autor ou remover); preencher créditos.
- [ ] Testes: contrato do JSON do banco, determinismo do gerador.

**Pronto quando:** `quantum-bank.json` existe (mesmo que simulado) e há medição de fps no Quest.

### Semana 2 (25/nov–1/dez) — Gerador de mapa v2 + loop completo

Meta: o mapa reflete a distribuição quântica; 3 andares jogáveis ponta a ponta.

- [ ] Gerador v2: grade macro 3×4, tipos de região, conectividade garantida (BFS) até as escadas. Substitui o 11×11.
- [ ] Paredes superpostas guiadas pela entropia; colapso ao medir.
- [ ] Variação visual por andar (papel de parede/teto Yasu, cor da luz, fog).
- [ ] Carregar mapas do banco no runtime (sem chamar `/api/measure`).
- [ ] Tela/estado de vitória e derrota; reinício.
- [ ] Testes: todo mapa do banco é conectado; escadas alcançáveis.

**Pronto quando:** do andar 1 ao 3 sem recarregar página, no Quest.

### Semana 3 (2–8/dez) — Conteúdo, áudio, conforto → FEATURE FREEZE dia 8

Meta: parecer jogo, não protótipo.

- [ ] Andares 4–5 (dificuldade crescente: drenagem, velocidade/raio de caça da entidade).
- [ ] Áudio: zumbido de luz fluorescente, passos, áudio espacial da entidade, estinger ao medir.
- [ ] IA da entidade: patrulha → caça → perda de rastro; feedback claro de dano.
- [ ] Onboarding diegético (cartaz/painel no andar 1) explicando medir, Visor, esconder olhos.
- [ ] Conforto VR: snap turn, vinhetas ao mover, opção de teleporte.
- [ ] Props do Vol. 2 posicionados por região (otimizados — ver seção 5).

**Pronto quando:** partida completa 1→5 sem bugs bloqueantes. Depois disso **nenhuma feature nova**.

### Semana 4 (9–15/dez) — Polimento, performance, entrega

- [ ] Otimização no Quest (orçamento abaixo); remover texturas 4K, converter para KTX2/JPG reduzido.
- [ ] 3+ playtests com pessoas diferentes; corrigir só o que bloqueia ou enjoa.
- [ ] Deploy estático em HTTPS + fallback desktop (WASD) documentado.
- [ ] README final, créditos CC BY (Yasu), página explicando o uso de dados reais da IBM.
- [ ] Roteiro de demo de 3 min + gravação de vídeo de reserva.
- [ ] **12–15/dez = buffer.** Só bugfix.

---

## 5. Orçamento de performance (Quest)

Referência de trabalho; meça e ajuste na semana 1.

- Draw calls < ~100; triângulos visíveis < ~150k.
- Texturas ≤ 1024² (somente Color + Normal quando fizer diferença); o pacote Yasu original tem normais de >10 MB cada — **não usar originais**.
- Luzes dinâmicas: no máximo 1–2; resto emissivo/baked. Flicker via emissive, não luz real.
- Instanciar/mesclar paredes (geometria mesclada por região); descartar regiões fora do alcance.
- Fog curto para esconder o corte de render.

---

## 6. Lista de cortes (do primeiro a cortar ao último)

1. API IBM ao vivo no navegador (manter só o banco).
2. Gestos de mão (manter controles).
3. Andares 4–5 (entregar 3 sólidos em vez de 5 frágeis).
4. Segunda entidade / variações de IA.
5. Procedural audio (usar loops gravados/CC0).

---

## 7. Riscos

| Risco | Mitigação |
|---|---|
| Fila/cota IBM atrasa | Submeter na semana 1; simulador como reserva rotulado |
| Quest com fps baixo | Medir no dia 1–2; orçamento na seção 5; cortar props primeiro |
| Escopo cresce sozinho | Freeze dia 8/dez; lista de cortes |
| Enjoo em VR | Snap turn, vinheta, teleporte; testar cedo |
| Licença do Ottoman Signs | Resolver na semana 1 ou remover |
| Perda do trabalho (repo quase todo não commitado) | Commit hoje; commits diários |

---

## 8. Referência

Quantum Backrooms (Moth): mapas gerados em QPUs IBM/IQM, cada qubit corresponde a uma seção do mundo e as conexões entre qubits definem rotas. Não há detalhes públicos dos circuitos; a arquitetura da seção 3 é uma proposta própria, não uma cópia.
