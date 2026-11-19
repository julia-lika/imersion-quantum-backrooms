import {
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
} from './survival-state.js?v=20261118-1';

const initialBits = '010110101100';
const savedGame = (() => {
  try {
    return loadGameState();
  } catch {
    return null;
  }
})();
const game = { current: savedGame || createGameState(initialBits) };
const state = {
  current: createPhaseState(game.current.currentBitstring),
};
const elements = {};
let started = false;
let paused = false;
let transitioning = false;
let spaceHeld = false;
let survival = createSurvivalState();
let lastSave = 0;
let lastWristUpdate = 0;

const START_POSITION = { x: -4.2, z: -4.2 };
const SURVIVAL_TICK_MS = 100;

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
  elements['desktop-hint'].setAttribute(
    'text',
    `value: ${message}; align: center; color: #fff0c7; width: 1.1`
  );
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
  return game.current.measured ? 'DESCEND: STAIRS REVEALED' : 'FIND THE QPS';
}

function syncHud() {
  elements['hud-sanity'].textContent = `SANITY: ${Math.round(game.current.sanity)}%`;
  elements['hud-energy'].textContent = `ENERGY: ${Math.round(survival.energy)}%`;
  elements['hud-measurements'].textContent = `MEASUREMENTS: ${game.current.measurements ?? 0}`;
}

// Sanidade baixa engrossa a névoa e escurece o andar.
function syncAtmosphere() {
  const madness = 1 - game.current.sanity / 100;
  // Perto da entidade a névoa engrossa: em VR é o substituto do blur (CSS não aparece).
  const contact = window.quantumPlayer?.effects?.contact ?? 0;
  elements['backrooms-scene'].setAttribute('fog', 'density', 0.035 + madness * 0.09 + contact * 0.12);
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

  elements['phase-floor'].textContent = `FLOOR ${String(game.current.floor).padStart(2, '0')}`;
  elements['phase-qps'].textContent = game.current.qps > 0
    ? `QPS ${game.current.qps}`
    : 'QPS SEARCH';
  elements['phase-tick'].textContent = `TICK ${current.tick}`;
  elements['phase-current'].textContent = formatBits(current.bitstring);
  elements['phase-candidates'].innerHTML = candidates;
  elements['phase-superposed'].textContent = current.superposedCells;
  elements['phase-collapsed'].textContent = current.collapsedCells;
  elements['phase-total'].textContent = current.totalCells;
  const ghost = window.quantumPlayer.ghost;
  elements['phase-sentinel'].textContent = current.superposedCells > 16 ? 'ACTIVE' : 'CLEAR';
  elements['phase-ghost'].textContent = ghost.hunting
    ? (survival.visor ? 'HUNTING // VISIBLE' : 'HUNTING')
    : (survival.visor ? 'VISIBLE' : 'DORMANT');
  elements['phase-look-time'].textContent = `${survival.exposure.toFixed(1)}s / ${SURVIVAL.exposureTime}s${survival.eyesCovered ? ' // EYES COVERED' : ''}`;
  elements['phase-visor'].textContent = survival.visor
    ? `ZETA VISOR ON // ${Math.round(survival.energy)}%`
    : 'ZETA VISOR OFF';
  elements['phase-status'].textContent = current.superposedCells > 0
    ? 'REALITY: SUPERPOSED'
    : 'REALITY: COLLAPSED';
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
    setHint('ZETA VISOR SEM ENERGIA — encontre Almond Water');
    return;
  }

  setVisor(next);
  renderTelemetry();
  setHint(survival.visor
    ? 'ZETA VISOR ATIVO — paredes roxas oscilam; atravesse quando estiverem abertas'
    : 'PINÇA NA TESTA (ou V): ZETA VISOR // PALMAS NA PAREDE (ou Space + W): PHASE SHIFT');
}

function requestPhaseShift() {
  if (!isActive()) return;
  elements['backrooms-scene'].emit('phase-shift-request', { source: 'keyboard' });
}

function resolvePhaseShift({ detail }) {
  if (!isActive()) return;

  const attempt = attemptPhaseShift(survival, game.current.sanity);
  if (!attempt.allowed) {
    setHint('PHASE SHIFT INDISPONÍVEL — energia ou sanidade insuficiente');
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
    ? 'PHASE SHIFT — você atravessou a parede'
    : 'PHASE SHIFT FALHOU — a parede colapsou de volta');
  persistProgress();
  renderTelemetry();
}

function bindControls() {
  document.addEventListener('keydown', (event) => {
    if (event.code === 'Space') spaceHeld = true;
    if (event.code === 'KeyV') toggleVisor();
    if (event.code === 'KeyP') {
      paused = !paused;
      window.quantumPlayer.active = isActive();
      renderTelemetry();
    }
    if (event.code === 'KeyW' && spaceHeld) requestPhaseShift();
  });

  document.addEventListener('keyup', (event) => {
    if (event.code === 'Space') spaceHeld = false;
  });
}

function transitionToNextFloor() {
  if (transitioning || !game.current.measured) return;

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
    setHint(`FLOOR ${String(game.current.floor).padStart(2, '0')} — encontre o QPS para localizar a porta`);
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
    setHint('VOCÊ SE PERDEU — de volta ao FLOOR 01');
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
    if (event === 'visor-depleted') setHint('ZETA VISOR DESCARREGADO');
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
    syncMap();
    syncAtmosphere();
    renderTelemetry();
  }

  document.getElementById('start-game').addEventListener('click', beginGame);
  scene.addEventListener('enter-vr', beginGame);

  scene.addEventListener('visor-toggle-request', toggleVisor);
  scene.addEventListener('phase-shift-attempt', resolvePhaseShift);
  scene.addEventListener('phase-shift-blocked', () => {
    if (isActive()) setHint('NADA PARA ATRAVESSAR — encoste as palmas numa parede');
  });
  scene.addEventListener('eyes-covered', ({ detail }) => {
    survival = { ...survival, eyesCovered: detail.covered };
    window.quantumPlayer.eyesCovered = detail.covered;
  });
  scene.addEventListener('almond-water-drunk', () => {
    const restored = drinkAlmondWater(survival, game.current.sanity);
    survival = restored.state;
    setSanity(restored.sanity);
    syncAtmosphere();
    persistProgress();
    setHint('ALMOND WATER — sanidade e energia restauradas');
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
