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
const GEAR_STORAGE_KEY = 'quantum-backrooms-gear-v1';
const GEAR_LABELS = { qlink: 'Q-LINK (relógio)', visor: 'VISOR ZETA (óculos)', qps: 'QPS (chip)' };
// Raio de medição contínua do QPS, em células (~4,2 m). Sem QPS, só o que o
// jogador vê de perto define a porta.
const QPS_RADIUS_CELLS = 4;
const BARE_RADIUS_CELLS = 2;
const savedGame = (() => {
  try {
    return loadGameState();
  } catch {
    return null;
  }
})();
// O jogo começa no lobby de treinamento (fase 0). Um save de andar 1+ só é
// retomado pelo botão CONTINUAR da tela inicial.
const game = { current: savedGame || createGameState(initialBits, LOBBY_FLOOR) };
const resumableFloor = savedGame && savedGame.floor !== LOBBY_FLOOR ? savedGame.floor : null;
const state = {
  current: createPhaseState(game.current.currentBitstring),
};
const elements = {};
let started = false;
let playedThisSession = false;
let lastVisorToggle = 0;
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
  // Equipamentos pegos nas estações do lobby (salvos entre sessões).
  gear: (() => {
    try {
      const saved = JSON.parse(localStorage.getItem(GEAR_STORAGE_KEY) || '{}');
      return { qlink: Boolean(saved.qlink), visor: Boolean(saved.visor), qps: Boolean(saved.qps) };
    } catch {
      return { qlink: false, visor: false, qps: false };
    }
  })(),
  hasQps: false,
  qpsRadius: QPS_RADIUS_CELLS,
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

window.quantumPlayer.hasQps = window.quantumPlayer.gear.qps;

function setGear(gear) {
  window.quantumPlayer.gear = { ...gear };
  window.quantumPlayer.hasQps = Boolean(gear.qps);
  try {
    localStorage.setItem(GEAR_STORAGE_KEY, JSON.stringify(window.quantumPlayer.gear));
  } catch {
    // Sem armazenamento: vale só para esta sessão.
  }
}

function missingGear() {
  return Object.keys(GEAR_LABELS).filter((key) => !window.quantumPlayer.gear[key]);
}

// Medição contínua: quando a porta do andar entra no raio do QPS, o estado
// do andar é medido e a porta se define (aparece).
let doorMeasuring = false;
let doorCache = { bits: null, stairs: null };
function checkDoorMeasurement() {
  if (game.current.floor === LOBBY_FLOOR || game.current.measured || doorMeasuring) return;
  const world = window.quantumWorld;
  const head = document.getElementById('player-head')?.object3D.position;
  if (!world || !head || typeof window.generateQuantumMap !== 'function') return;
  if (doorCache.bits !== game.current.currentBitstring) {
    doorCache = { bits: game.current.currentBitstring, stairs: window.generateQuantumMap(game.current.currentBitstring).stairs };
  }
  const x = (head.x - world.origin) / world.cellSize;
  const z = (head.z - world.origin) / world.cellSize;
  const radius = window.quantumPlayer.hasQps ? QPS_RADIUS_CELLS : BARE_RADIUS_CELLS;
  if (Math.hypot(x - doorCache.stairs.x, z - doorCache.stairs.z) > radius) return;
  doorMeasuring = true;
  elements['backrooms-scene'].emit('door-measured');
}

function setHint(message) {
  // Objeto (não string): o texto pode conter ";" sem quebrar o atributo.
  elements['desktop-hint'].setAttribute('canvas-text', {
    value: message, align: 'center', color: '#39ff88', width: 1.1, style: 'terminal',
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
  if (game.current.floor === LOBBY_FLOOR) {
    return missingGear().length ? 'PEGUE O EQUIPAMENTO NAS 3 ESTAÇÕES' : 'TUTORIAL: A PORTA LEVA AO ANDAR 01';
  }
  return game.current.measured ? 'DESÇA: A PORTA FOI MEDIDA' : 'ACHE A PORTA: O QPS MEDE AO REDOR';
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
  if (!window.quantumPlayer.gear.visor) {
    setHint('SEM VISOR ZETA — pegue os óculos na ESTAÇÃO 2 do lobby');
    return;
  }
  // A pinça do rastreamento de mãos pode tremer (solta e fecha de novo em poucos
  // quadros); sem esse intervalo o visor liga e desliga no mesmo gesto.
  const now = performance.now();
  if (now - lastVisorToggle < 500) return;
  lastVisorToggle = now;

  const next = toggleVisorState(survival);
  if (next === survival) {
    setHint('VISOR ZETA SEM ENERGIA — encontre Água de Amêndoa');
    return;
  }

  setVisor(next);
  renderTelemetry();
  setHint(survival.visor
    ? 'VISOR ZETA ATIVO — paredes roxas oscilam; atravesse quando estiverem abertas'
    : 'VISOR ZETA DESLIGADO — pinça na testa (ou Z) liga de novo');
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
  if (game.current.floor === LOBBY_FLOOR && missingGear().length) {
    setHint(`PEGUE O EQUIPAMENTO ANTES — falta: ${missingGear().map((key) => GEAR_LABELS[key]).join(', ')}`);
    window.setTimeout(() => document.querySelector('[floor-transition]')?.components['floor-transition']?.reset(), 2500);
    return;
  }

  transitioning = true;
  window.quantumPlayer.active = false;
  game.current = markStairsReached(game.current);
  persistProgress();
  setHint('DESCIDA CONFIRMADA — preparando o próximo andar');
  document.body.classList.add('floor-transition');
  elements['backrooms-scene'].emit('screen-effect', { type: 'fade', color: '#000000', duration: 900 });

  window.setTimeout(() => {
    // O andar novo nasce de uma medição tirada do banco gravado.
    const nextBits = window.drawFloorBitstring?.(game.current.floor + 1) || initialBits;
    game.current = advanceFloor(game.current, nextBits);
    state.current = createPhaseState(nextBits);
    resetPlayerPosition();
    syncMap();
    persistProgress();
    document.body.classList.remove('floor-transition');
    setHint(`ANDAR ${String(game.current.floor).padStart(2, '0')} — explore: a porta se define quando entra no raio do QPS`);
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
    const nextBits = window.drawFloorBitstring?.(1) || initialBits;
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

  checkDoorMeasurement();
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
  // ENTRAR (ou entrar em VR) = lobby; CONTINUAR = retoma o andar salvo.
  function beginGame(mode = 'lobby') {
    if (started) return;
    started = true;
    // ENTRAR NO LOBBY = jogo novo. Na primeira entrada da página o lobby já está
    // no estado inicial; depois de voltar ao menu com Esc, recomeça do zero.
    if (mode !== 'continue' && (game.current.floor !== LOBBY_FLOOR || playedThisSession)) {
      game.current = createGameState(initialBits, LOBBY_FLOOR);
      state.current = createPhaseState(initialBits);
      setVisor(createSurvivalState());
      resetPlayerPosition();
      persistProgress();
    }
    // Jogo novo: os equipamentos voltam para as mesas do lobby.
    if (mode !== 'continue' && Object.values(window.quantumPlayer.gear).some(Boolean)) {
      setGear({ qlink: false, visor: false, qps: false });
      setVisor({ ...survival, visor: false });
      elements['quantum-map'].components['quantum-map']?.renderMap();
    }
    playedThisSession = true;
    window.quantumPlayer.active = isActive();
    elements['phase-telemetry'].hidden = false;
    if (game.current.floor === LOBBY_FLOOR) {
      setHint(missingGear().length
        ? 'LOBBY DE TREINAMENTO — pegue o equipamento nas 3 estações da parede esquerda (Q-LINK, Visor Zeta e QPS)'
        : 'LOBBY DE TREINAMENTO — leia as estações e abra o computador na mesa');
    } else if (mode === 'continue') {
      setHint(`ANDAR ${String(game.current.floor).padStart(2, '0')} — jogo retomado`);
    }
    syncMap();
    syncAtmosphere();
    renderTelemetry();
  }

  const continueButton = document.getElementById('continue-game');
  function showContinue(floor) {
    if (!continueButton) return;
    continueButton.hidden = floor == null;
    if (floor == null) return;
    continueButton.textContent = floor === LOBBY_FLOOR
      ? 'CONTINUAR — LOBBY'
      : `CONTINUAR — ANDAR ${String(floor).padStart(2, '0')}`;
  }

  // Esc: salva e volta ao menu inicial. CONTINUAR retoma de onde parou;
  // ENTRAR NO LOBBY começa um jogo novo.
  function returnToMenu() {
    if (!started || transitioning || scene.is('vr-mode')) return;
    persistProgress();
    started = false;
    paused = false;
    window.quantumPlayer.active = false;
    elements['phase-telemetry'].hidden = true;
    document.getElementById('hud').hidden = true;
    document.getElementById('start-screen').hidden = false;
    showContinue(game.current.floor);
    renderTelemetry();
  }

  showContinue(resumableFloor);
  continueButton?.addEventListener('click', () => beginGame('continue'));
  document.getElementById('start-game').addEventListener('click', () => beginGame('lobby'));
  document.addEventListener('keydown', (event) => {
    if (event.code === 'Escape' && !event.repeat) returnToMenu();
  });
  scene.addEventListener('enter-vr', () => beginGame('lobby'));

  // Cada estação do lobby habilita um equipamento, que fica com o agente.
  scene.addEventListener('gear-collected', ({ detail }) => {
    const gear = detail?.gear;
    if (!GEAR_LABELS[gear]) return;
    setGear({ ...window.quantumPlayer.gear, [gear]: true });
    scene.emit('screen-effect', { type: 'flash', color: '#44ffcc', duration: 500, peak: 0.3 });
    const next = {
      qlink: 'Q-LINK HABILITADO — olhe para o pulso esquerdo (desktop: H)',
      visor: 'VISOR ZETA HABILITADO — pinça na testa (desktop: Z) liga e desliga',
      qps: 'QPS HABILITADO — mede tudo num raio de ~4 m e desenha o mapa (pulso direito ou M)',
    }[gear];
    const missing = missingGear();
    setHint(missing.length ? `${next}. Falta: ${missing.map((key) => GEAR_LABELS[key]).join(', ')}` : `${next}. Equipamento completo!`);
    renderTelemetry();
  });
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

    // A medição não refaz o labirinto: só define a porta. O andar continua
    // sendo o mesmo bitstring.
    doorMeasuring = false;
    const floorBits = game.current.currentBitstring;
    const map = window.generateQuantumMap(floorBits);
    game.current = recordMeasurement(game.current, {
      bitstring: floorBits,
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
