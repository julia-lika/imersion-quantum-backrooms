// Tela inicial, medição quântica ao pegar o QPS (banco gravado ou ?live)
// e HUD de métricas. Carregado no fim do <body>.
(function quantumMeasurement() {
  const scene = document.querySelector('#backrooms-scene');
  const hint = document.querySelector('#desktop-hint');
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

  // Pegar o QPS mede o estado: grava a planta do andar (o mapa do QPS) e
  // revela a porta. O labirinto em si não muda nessa hora; ele muda sozinho,
  // nos trechos que ninguém observa (decoerência, maze-decoherence.js).
  function applyMeasurement(result) {
    measured = true;
    commitMeasurement(result);
  }

  function commitMeasurement(result) {
    const bitstring = result.bitstring;
    hudState.textContent = `ESTADO: MEDIDO // ${bitstring}`;
    const metrics = updateQuantumHud(bitstring, result);
    window.dispatchEvent(new CustomEvent('quantum-measured', {
      detail: { result, metrics },
    }));
  }

  // A porta entrou no raio do QPS (ou foi vista de perto): o estado do andar é
  // medido, a porta se define e aparece. Usa o banco gravado (ou ?live).
  async function collapseQuantumState() {
    if (measuring) return;
    measuring = true;
    hint.setAttribute(
      'canvas-text',
      'value: O QPS ESTÁ MEDINDO A PORTA — o estado está sendo amostrado; align: center; color: #39ff88; width: 1.1; style: terminal'
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

  scene.addEventListener('door-measured', collapseQuantumState);

  window.addEventListener('quantum-measured', () => {
    hint.setAttribute(
      'canvas-text',
      'value: PORTA MEDIDA — ela se definiu e está no mapa do QPS (M ou pulso direito); align: center; color: #39ff88; width: 1.1; style: terminal'
    );
  });
})();
