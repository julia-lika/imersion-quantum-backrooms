# Quantum Backrooms

Protótipo em A-Frame servido por Caddy com HTTPS local e geração de níveis
orientada por medições quânticas.

## Proposta e entrega

Quantum Backrooms VR é um jogo de horror em realidade virtual, feito com A-Frame
e WebXR para o navegador do Meta Quest, em que cada andar dos Backrooms é gerado
a partir de medições de um circuito quântico.

As entregas de cada semana, incluindo a ficha de projeto e a apresentação, estão
na documentação: https://julia-lika.github.io/imersion-quantum-backrooms/docs/semanas/

- Semana 1, apresentação: https://julia-lika.github.io/imersion-quantum-backrooms/docs/semanas/semana-1/
- Semana 1, ficha de projeto: https://julia-lika.github.io/imersion-quantum-backrooms/docs/semanas/semana-1/ficha-de-projeto/
- Plano de 5 semanas: https://julia-lika.github.io/imersion-quantum-backrooms/docs/semanas/plano/ (as checklists ficam em `docs/semanas/`)

O código da documentação fica em [`docs/`](docs/).

## Rodar

```bash
docker compose up --build
```

Abra `https://localhost:8443`. Na primeira execução, aceite o certificado local do Caddy.

O conteúdo de desenvolvimento fica em `src/`. Como essa pasta é montada no contêiner, alterações em `src/index.html` aparecem após recarregar o navegador sem refazer a imagem.

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

O jogo sorteia amostras de `src/data/quantum-bank.json`, sem depender da fila
ou da cota da IBM. O HUD mostra a origem verdadeira, por exemplo
`SIMULADOR EXATO` ou `QPU IBM_TORINO // JOB D4F9A1C2 // 24/11/2026`.
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

### Medir no hardware real pelo GitHub

1. Crie a chave em https://quantum.cloud.ibm.com (plano Open, gratuito).
2. Salve-a como secret `IBM_QUANTUM_API_KEY` em Settings > Secrets and variables > Actions
   (e `IBM_QUANTUM_INSTANCE`, se a conta tiver mais de uma instância).
3. Em Actions, abra **Medir no computador quântico (IBM)** e clique em **Run workflow**.

Os andares vão num único job (um PUB por andar). O workflow grava o banco com
backend, job ID, data, profundidade do circuito transpilado e a fidelidade em
relação à distribuição ideal, faz o commit no `main` e republica o site. Se a fila
demorar mais que o limite do workflow, rode de novo passando o `job_id` mostrado
no log: ele só baixa o resultado, sem gastar cota.

Testes: `npm test` (JavaScript) e, em `backend/`,
`python3 -m unittest discover -s tests -v` (circuito).

## Vertical slice da Fase 0

O protótipo recria a camada jogável observada no Quantum Backrooms: o painel de
telemetria acompanha `FLOOR`, `QPS`, `TICK`, estados candidatos e entropia da
grade; a medição do console colapsa os candidatos e atualiza a sanidade; e o
stream local abre estados superpostos entre medições.

Controles no desktop: `WASD` movimenta, `H` abre o painel do pulso, `Q` pega o
QPS, `E` pega e bebe a Almond Water (e abre o caderno do lobby), `Z` alterna o
Visor Zeta, `X` executa um salto de fase e `P` pausa o stream. No headset, os controladores usam
laser para apontar ao console e o gatilho mede o estado.

Após a medição, o QPS revela uma posição de escadas válida no mapa. Ao entrar
no volume de chegada, o jogo salva o andar concluído, aplica uma transição e
gera o próximo andar. O progresso e a sanidade são restaurados pelo save local
`quantum-backrooms-save-v1`.
