// Tela inicial, medição quântica ao pegar o QPS (banco gravado ou ?live),
// piscar lento da transição e HUD de métricas. Carregado no fim do <body>.
(function quantumMeasurement() {
  const scene = document.querySelector('#backrooms-scene');
  const hint = document.querySelector('#desktop-hint');
  const quantumMap = document.querySelector('#quantum-map');
  const startScreen = document.querySelector('#start-screen');
  const startGame = document.querySelector('#start-game');
  const hud = document.querySelector('#hud');
  const hudState = document.querySelector('#hud-state');
  const hudQpu = document.querySelector('#hud-qpu');
  const hudQps = document.querySelector('#hud-qps');
  const hudCoherence = document.querySelector('#hud-coherence');
  const hudNoise = document.querySelector('#hud-noise');
  let measured = false;
  let measuring = false;

  function updateQuantumHud(bitstring, result) {
    const metrics = window.analyzeQuantumState(bitstring);
    hudQps.textContent = `QPS: ${metrics.qps}/100`;
    hudCoherence.textContent = `COERÊNCIA: ${metrics.coherence}%`;
    hudNoise.textContent = `RUÍDO: ${metrics.noise}%`;
    hudQpu.textContent = `QPU: ${result.source.toUpperCase()} // ${result.backend}`;
    return metrics;
  }

  function hideStartScreen() {
    startScreen.hidden = true;
    hud.hidden = false;
  }

  startGame.addEventListener('click', hideStartScreen);
  document.querySelector('#continue-game')?.addEventListener('click', hideStartScreen);
  // Entrar em VR sem clicar em ENTER também inicia o jogo.
  scene.addEventListener('enter-vr', hideStartScreen);

  const BLINK_MS = 2600;

  // Piscar lento: o mapa só troca quando os olhos estão fechados.
  function playCollapseBlink(onClosed) {
    document.body.classList.remove('blink-transition');
    void document.body.offsetWidth;
    document.body.classList.add('blink-transition');
    scene.emit('screen-effect', { type: 'blink', color: '#000000', duration: BLINK_MS });
    window.setTimeout(onClosed, BLINK_MS * 0.46);
    window.setTimeout(() => document.body.classList.remove('blink-transition'), BLINK_MS + 50);
  }

  function applyMeasurement(result) {
    measured = true;
    hint.setAttribute(
      'canvas-text',
      'value: O QPS MEDIU O ESTADO — a realidade está colapsando; align: center; color: #39ff88; width: 1.1; style: terminal'
    );
    playCollapseBlink(() => commitMeasurement(result));
  }

  function commitMeasurement(result) {
    const bitstring = result.bitstring;

    quantumMap.setAttribute(
      'quantum-map',
      `bitstring: ${bitstring}`
    );
    hint.setAttribute(
      'canvas-text',
      `value: MEDIÇÃO REGISTRADA — ${bitstring}; align: center; color: #39ff88; width: 1.1; style: terminal`
    );
    hudState.textContent = `ESTADO: MEDIDO // ${bitstring}`;
    const metrics = updateQuantumHud(bitstring, result);
    window.dispatchEvent(new CustomEvent('quantum-measured', {
      detail: { result, metrics },
    }));
  }

  async function collapseQuantumState(event) {
    // QPS de treino do lobby: só explica, não mede nem muda o mapa.
    if (event?.detail?.training) {
      hint.setAttribute(
        'canvas-text',
        'value: QPS DE TREINO COLETADO — nos andares, isso mede o estado e revela a porta. Outro aparece em 10 s; align: center; color: #39ff88; width: 1.1; style: terminal'
      );
      scene.emit('screen-effect', { type: 'flash', color: '#44ffcc', duration: 500, peak: 0.3 });
      return;
    }
    if (measuring) return;
    measuring = true;
    hint.setAttribute(
      'canvas-text',
      'value: MEDIÇÃO EM ANDAMENTO — o estado está sendo amostrado; align: center; color: #39ff88; width: 1.1; style: terminal'
    );

    try {
      const floor = window.quantumPlayer?.floor ?? 1;
      // Caminho padrão: banco de medições gravadas (sem fila nem cota). Use ?live para chamar a API.
      const bank = new URLSearchParams(location.search).has('live')
        ? null
        : await window.quantumBank?.ready;
      if (bank) {
        applyMeasurement(window.quantumBank.measureFromBank(bank, floor));
        return;
      }

      const response = await fetch('/api/measure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shots: 128, floor }),
      });

      if (!response.ok) throw new Error(`quantum-api-${response.status}`);
      applyMeasurement(await response.json());
    } catch (error) {
      console.warn('[quantum-backrooms] IBM unavailable, using local fallback', error);
      applyMeasurement({
        bitstring: window.sampleQuantumBitstring(),
        source: 'local-sim',
        backend: 'browser-fallback',
      });
    } finally {
      measuring = false;
    }
  }

  // O QPS é coletado com uma pinça (VR) ou ao passar por ele (desktop).
  scene.addEventListener('qps-collected', collapseQuantumState);

  window.addEventListener('quantum-measured', () => {
    hint.setAttribute(
      'canvas-text',
      'value: QPS ENCONTRADO — localize a porta antes do próximo colapso; align: center; color: #39ff88; width: 1.1; style: terminal'
    );
  });
})();
