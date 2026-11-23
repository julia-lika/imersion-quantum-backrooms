import {
  LOBBY_FLOOR,
  advanceFloor,
  createGameState,
  loadGameState,
  markStairsReached,
  recordMeasurement,
  saveGameState,
} from './game-state.js';
import {
  advanceQuantumStream,
  collapseQuantumState,
  createPhaseZeroState,
} from './phase-zero-state.js';
import {
  SURVIVAL,
  attemptPhaseShift,
  createSurvivalState,
  drinkAlmondWater,
  tickSurvival,
  toggleVisor as toggleVisorState,
} from './survival-state.js?v=20261123-2';
import { startPosition } from './maze-physics.js';

const initialBits = '010110101100';
const savedGame = (() => {
  try {
    return loadGameState();
  } catch {
    return null;
  }
})();
// Jogo novo começa no lobby de treinamento (fase 0).
const game = { current: savedGame || createGameState(initialBits, LOBBY_FLOOR) };
const state = {
  current: createPhaseState(game.current.currentBitstring),
};
const elements = {};
let started = false;
let paused = false;
let transitioning = false;
let survival = createSurvivalState();
let lastSave = 0;
let lastWristUpdate = 0;

const START_POSITION = startPosition();
const SURVIVAL_TICK_MS = 100;
// Névoa escura de base (o index.html define a cor); sobe com a loucura.
const FOG_BASE_DENSITY = 0.085;

// Estado compartilhado com os componentes A-Frame (fantasma, paredes superpostas).
window.quantumPlayer = {
  active: false,
  visor: false,
  eyesCovered: false,
  ghost: { distance: Infinity, inView: false, hunting: false },
};

function createPhaseState(bitstring) {
  return {
    ...createPhaseZeroState(`${bitstring}${bitstring}`),
    floor: game.current.floor,
    sanity: game.current.sanity,
    qps: game.current.qps || 0,
  };
}

function cacheElements() {
  [
    'phase-telemetry',
    'phase-floor',
    'phase-qps',
    'phase-tick',
    'phase-current',
    'phase-candidates',
    'phase-superposed',
    'phase-collapsed',
    'phase-total',
    'phase-sentinel',
    'phase-ghost',
    'phase-look-time',
    'phase-visor',
    'phase-status',
    'quantum-map',
    'desktop-hint',
    'player',
    'backrooms-scene',
    'hud-sanity',
    'hud-energy',
    'hud-measurements',
  ].forEach((id) => {
    elements[id] = document.getElementById(id);
  });
}

function formatBits(bitstring) {
  return bitstring.match(/.{1,6}/g)?.join(' ') || bitstring;
}

function localBitstring() {
  const sample = window.sampleQuantumBitstring?.() || initialBits;
  return `${sample}${sample}`;
}

function persistProgress() {
  try {
    saveGameState(game.current);
  } catch {
    // Storage can be unavailable in private browsing; the session still runs.
  }
}

function setHint(message) {
  // Objeto (não string): o texto pode conter ";" sem quebrar o atributo.
  elements['desktop-hint'].setAttribute('canvas-text', {
    value: message, align: 'center', color: '#fff0c7', width: 1.1,
  });
}

function flash(className, duration = 420) {
  document.body.classList.add(className);
  window.setTimeout(() => document.body.classList.remove(className), duration);
}

function setSanity(value) {
  const sanity = Math.max(0, Math.min(100, value));
  state.current = { ...state.current, sanity };
  game.current = { ...game.current, sanity };
}

function isActive() {
  return started && !paused && !transitioning;
}

function objectiveText() {
  if (game.current.floor === LOBBY_FLOOR) return 'TUTORIAL: EXPLORE O LOBBY';
  return game.current.measured ? 'DESÇA: A PORTA FOI REVELADA' : 'ENCONTRE O QPS';
}

function syncHud() {
  elements['hud-sanity'].textContent = `SANIDADE: ${Math.round(game.current.sanity)}%`;
  elements['hud-energy'].textContent = `ENERGIA: ${Math.round(survival.energy)}%`;
  elements['hud-measurements'].textContent = `MEDIÇÕES: ${game.current.measurements ?? 0}`;
}

// Sanidade baixa engrossa a névoa e escurece o andar.
function syncAtmosphere() {
  const madness = 1 - game.current.sanity / 100;
  // Perto da entidade a névoa engrossa: em VR é o substituto do blur (CSS não aparece).
  const contact = window.quantumPlayer?.effects?.contact ?? 0;
  elements['backrooms-scene'].setAttribute('fog', 'density', FOG_BASE_DENSITY + madness * 0.08 + contact * 0.12);
}

function syncMap() {
  window.quantumPlayer.floor = game.current.floor;
  const floor = game.current.floors[game.current.floor];
  elements['quantum-map'].setAttribute('quantum-map', {
    bitstring: game.current.currentBitstring,
    stairsVisible: Boolean(floor?.stairs?.visible),
    floor: game.current.floor,
  });
  elements['backrooms-scene'].setAttribute('data-floor', game.current.floor);
}

function renderTelemetry() {
  const current = state.current;
  const candidates = current.candidates.length > 1
    ? current.candidates.map((bits, index) => (
      `${index === 0 ? '>' : '|'} |${formatBits(bits)}⟩ p=50%`
    )).join('<br>')
    : `> |${formatBits(current.bitstring)}⟩ p=100%`;

  elements['phase-floor'].textContent = game.current.floor === LOBBY_FLOOR
    ? 'LOBBY // FASE 0'
    : `ANDAR ${String(game.current.floor).padStart(2, '0')}`;
  elements['phase-qps'].textContent = game.current.qps > 0
    ? `QPS ${game.current.qps}`
    : 'BUSCANDO QPS';
  elements['phase-tick'].textContent = `CICLO ${current.tick}`;
  elements['phase-current'].textContent = formatBits(current.bitstring);
  elements['phase-candidates'].innerHTML = candidates;
  elements['phase-superposed'].textContent = current.superposedCells;
  elements['phase-collapsed'].textContent = current.collapsedCells;
  elements['phase-total'].textContent = current.totalCells;
  const ghost = window.quantumPlayer.ghost;
  elements['phase-sentinel'].textContent = current.superposedCells > 16 ? 'ATIVA' : 'LIVRE';
  elements['phase-ghost'].textContent = ghost.hunting
    ? (survival.visor ? 'CAÇANDO // VISÍVEL' : 'CAÇANDO')
    : (survival.visor ? 'VISÍVEL' : 'ADORMECIDA');
  elements['phase-look-time'].textContent = `${survival.exposure.toFixed(1)}s / ${SURVIVAL.exposureTime}s${survival.eyesCovered ? ' // OLHOS COBERTOS' : ''}`;
  elements['phase-visor'].textContent = survival.visor
    ? `VISOR ZETA LIGADO // ${Math.round(survival.energy)}%`
    : 'VISOR ZETA DESLIGADO';
  elements['phase-status'].textContent = current.superposedCells > 0
    ? 'REALIDADE: SOBREPOSTA'
    : 'REALIDADE: COLAPSADA';
  elements['phase-telemetry'].classList.toggle('zeta-visor', survival.visor);
  syncHud();
}

function advanceStream() {
  if (!started || paused || transitioning) return;
  state.current = advanceQuantumStream(state.current, localBitstring());
  renderTelemetry();
}

function setVisor(next) {
  survival = next;
  window.quantumPlayer.visor = survival.visor;
  document.body.classList.toggle('zeta-visor', survival.visor);
}

function toggleVisor() {
  if (!isActive()) return;

  const next = toggleVisorState(survival);
  if (next === survival) {
    setHint('VISOR ZETA SEM ENERGIA — encontre Água de Amêndoa');
    return;
  }

  setVisor(next);
  renderTelemetry();
  setHint(survival.visor
    ? 'VISOR ZETA ATIVO — paredes roxas oscilam; atravesse quando estiverem abertas'
    : 'PINÇA NA TESTA (ou Z): VISOR ZETA // PALMAS NA PAREDE (ou X): SALTO DE FASE');
}

function requestPhaseShift() {
  if (!isActive()) return;
  elements['backrooms-scene'].emit('phase-shift-request', { source: 'keyboard' });
}

function resolvePhaseShift({ detail }) {
  if (!isActive()) return;

  const attempt = attemptPhaseShift(survival, game.current.sanity);
  if (!attempt.allowed) {
    setHint('SALTO DE FASE INDISPONÍVEL — energia ou sanidade insuficiente');
    return;
  }

  survival = attempt.state;
  setSanity(attempt.sanity);
  flash('phase-shift');
  elements['backrooms-scene'].emit('screen-effect', { type: 'flash', color: '#c9a8ff', duration: 420, peak: 0.5 });
  elements['backrooms-scene'].emit('phase-shift-resolved', {
    success: attempt.success,
    target: detail.target,
  });
  setHint(attempt.success
    ? 'SALTO DE FASE — você atravessou a parede'
    : 'SALTO DE FASE FALHOU — a parede colapsou de volta');
  persistProgress();
  renderTelemetry();
}

function bindControls() {
  document.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    if (event.code === 'KeyZ') toggleVisor();
    if (event.code === 'KeyX') requestPhaseShift();
    if (event.code === 'KeyP') {
      paused = !paused;
      window.quantumPlayer.active = isActive();
      renderTelemetry();
    }
  });
}

function transitionToNextFloor() {
  // No lobby a porta já está aberta; nos andares, só depois de medir o QPS.
  if (transitioning || (!game.current.measured && game.current.floor !== LOBBY_FLOOR)) return;

  transitioning = true;
  window.quantumPlayer.active = false;
  game.current = markStairsReached(game.current);
  persistProgress();
  setHint('DESCIDA CONFIRMADA — preparando o próximo andar');
  document.body.classList.add('floor-transition');
  elements['backrooms-scene'].emit('screen-effect', { type: 'fade', color: '#000000', duration: 900 });

  window.setTimeout(() => {
    const nextBits = window.sampleQuantumBitstring?.() || initialBits;
    game.current = advanceFloor(game.current, nextBits);
    state.current = createPhaseState(nextBits);
    resetPlayerPosition();
    syncMap();
    persistProgress();
    document.body.classList.remove('floor-transition');
    setHint(`ANDAR ${String(game.current.floor).padStart(2, '0')} — encontre o QPS para localizar a porta`);
    transitioning = false;
    window.quantumPlayer.active = isActive();
    renderTelemetry();
  }, 900);
}

function resetPlayerPosition() {
  elements['backrooms-scene'].emit('player-teleport', START_POSITION);
}

// Sanidade zerada: o jogador se perde e recomeça do andar 1.
function loseSanity() {
  if (transitioning) return;

  transitioning = true;
  window.quantumPlayer.active = false;
  document.body.classList.add('sanity-lost');
  elements['backrooms-scene'].emit('screen-effect', { type: 'fade', color: '#000000', duration: 2400 });

  window.setTimeout(() => {
    const nextBits = window.sampleQuantumBitstring?.() || initialBits;
    game.current = createGameState(nextBits);
    state.current = createPhaseState(nextBits);
    setVisor(createSurvivalState());
    resetPlayerPosition();
    syncMap();
    syncAtmosphere();
    persistProgress();
    document.body.classList.remove('sanity-lost');
    setHint('VOCÊ SE PERDEU — de volta ao ANDAR 01');
    transitioning = false;
    window.quantumPlayer.active = isActive();
    renderTelemetry();
  }, 2400);
}

function updateSurvival() {
  if (!isActive()) {
    document.body.classList.remove('ghost-contact');
    window.quantumPlayer.effects = { contact: 0, visor: survival.visor, madness: 0 };
    return;
  }

  const ghost = window.quantumPlayer.ghost;
  const result = tickSurvival(survival, game.current.sanity, {
    dt: SURVIVAL_TICK_MS / 1000,
    floor: game.current.floor,
    ghostDistance: ghost.distance,
    ghostInView: ghost.inView,
  });

  setVisor(result.state);
  setSanity(result.sanity);
  document.body.classList.toggle(
    'ghost-contact',
    ghost.distance <= SURVIVAL.ghostContactRadiusCells
  );
  // Em VR o CSS não aparece: o componente vr-effects lê este estado a cada quadro.
  // O efeito cresce a partir de ~3 células e chega ao máximo no contato.
  window.quantumPlayer.effects = {
    contact: ghost.distance <= SURVIVAL.ghostContactRadiusCells
      ? 1
      : Math.max(0, 1 - ghost.distance / 3),
    visor: survival.visor,
    madness: 1 - game.current.sanity / 100,
  };
  syncAtmosphere();

  result.events.forEach((event) => {
    if (event === 'visor-depleted') setHint('VISOR ZETA DESCARREGADO');
    if (event === 'ghost-strike') {
      flash('ghost-strike', 700);
      elements['backrooms-scene'].emit('screen-effect', { type: 'flash', color: '#b0001a', duration: 700, peak: 0.7 });
      setHint('VOCÊ ENCAROU A ENTIDADE — cubra os olhos com as mãos');
      elements['backrooms-scene'].emit('ghost-strike');
    }
    if (event === 'sanity-lost') loseSanity();
  });

  const now = performance.now();
  if (now - lastSave > 3000) {
    lastSave = now;
    persistProgress();
  }
  if (now - lastWristUpdate > 250) {
    lastWristUpdate = now;
    elements['backrooms-scene'].emit('survival-updated', {
      floor: game.current.floor,
      sanity: game.current.sanity,
      energy: survival.energy,
      visor: survival.visor,
      objective: objectiveText(),
    });
    renderTelemetry();
  }
}

function bindGameEvents() {
  const scene = elements['backrooms-scene'];

  // O botão ENTER é HTML e não aparece no headset, e o botão de VR do A-Frame fica
  // acima da tela inicial. Entrar em VR também precisa iniciar o jogo, senão
  // `quantumPlayer.active` fica falso: a entidade não anda e o QPS não pode ser pego.
  function beginGame() {
    if (started) return;
    started = true;
    window.quantumPlayer.active = isActive();
    elements['phase-telemetry'].hidden = false;
    if (game.current.floor === LOBBY_FLOOR) {
      setHint('LOBBY DE TREINAMENTO — leia as estações e abra o computador na mesa');
    }
    syncMap();
    syncAtmosphere();
    renderTelemetry();
  }

  document.getElementById('start-game').addEventListener('click', beginGame);
  scene.addEventListener('enter-vr', beginGame);

  scene.addEventListener('visor-toggle-request', toggleVisor);
  scene.addEventListener('interaction-hint', ({ detail }) => {
    if (isActive()) setHint(detail.text);
  });
  scene.addEventListener('phase-shift-attempt', resolvePhaseShift);
  scene.addEventListener('phase-shift-blocked', () => {
    if (isActive()) setHint('NADA PARA ATRAVESSAR — encoste as palmas numa parede');
  });
  scene.addEventListener('eyes-covered', ({ detail }) => {
    survival = { ...survival, eyesCovered: detail.covered };
    window.quantumPlayer.eyesCovered = detail.covered;
  });
  scene.addEventListener('almond-water-drunk', ({ detail }) => {
    const restored = drinkAlmondWater(survival, game.current.sanity);
    survival = restored.state;
    setSanity(restored.sanity);
    syncAtmosphere();
    persistProgress();
    setHint(detail?.training
      ? 'ÁGUA DE AMÊNDOA DE TREINO BEBIDA — sanidade e energia restauradas; outra garrafa aparece em 10 s'
      : 'ÁGUA DE AMÊNDOA — sanidade e energia restauradas');
    renderTelemetry();
  });

  window.addEventListener('quantum-measured', ({ detail }) => {
    state.current = collapseQuantumState(
      state.current,
      `${detail.result.bitstring}${detail.result.bitstring}`,
      detail.metrics
    );

    const map = window.generateQuantumMap(detail.result.bitstring);
    game.current = recordMeasurement(game.current, {
      bitstring: detail.result.bitstring,
      qps: detail.metrics.qps,
      stairs: map.stairs,
    });
    setSanity(state.current.sanity);
    window.quantumMeasureStats = {
      count: (window.quantumMeasureStats?.count ?? 0) + 1,
      bitstring: detail.result.bitstring,
      source: `${detail.result.source} // ${detail.result.backend}`,
      stairs: map.stairs,
    };
    // Sinal visível em VR de que o estado colapsou e o mapa vai mudar.
    elements['backrooms-scene'].emit('screen-effect', { type: 'flash', color: '#44ffcc', duration: 500, peak: 0.35 });
    syncMap();
    persistProgress();
    renderTelemetry();
  });

  elements['backrooms-scene'].addEventListener('stairs-reached', transitionToNextFloor);
}

cacheElements();
bindControls();
bindGameEvents();
syncMap();
renderTelemetry();
window.setInterval(advanceStream, 1600);
window.setInterval(updateSurvival, SURVIVAL_TICK_MS);
