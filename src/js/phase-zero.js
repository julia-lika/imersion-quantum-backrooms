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
import { startPosition } from './maze-physics.js?v=20261124-12';

const initialBits = '010110101100';
const GEAR_STORAGE_KEY = 'quantum-backrooms-gear-v1';
// Missão lida no computador do lobby (a porta do lobby só abre depois disso).
const MISSION_STORAGE_KEY = 'quantum-backrooms-mission-v1';
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
// Modo cooperativo (js/coop/coop-explorer.js): este navegador é o EXPLORADOR.
// O operador, no desktop, é dono do andar; aqui só roda o corpo do jogador.
const coop = () => (window.quantumCoop?.active ? window.quantumCoop : null);
let coopRequest = false;
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
  missionRead: (() => {
    try {
      return localStorage.getItem(MISSION_STORAGE_KEY) === '1';
    } catch {
      return false;
    }
  })(),
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
    'phase-door',
    'phase-shifts',
    'circuit-canvas',
    'hud-floor',
    'hud-bits',
    'hud-origin',
    'quantum-map',
    'desktop-hint',
    'player',
    'backrooms-scene',
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
  // O cooperativo não mexe no save do jogo solo.
  if (coop()) return;
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
  if (coop()) return;
  try {
    localStorage.setItem(GEAR_STORAGE_KEY, JSON.stringify(window.quantumPlayer.gear));
  } catch {
    // Sem armazenamento: vale só para esta sessão.
  }
}

function missingGear() {
  return Object.keys(GEAR_LABELS).filter((key) => !window.quantumPlayer.gear[key]);
}

function setMissionRead(read) {
  window.quantumPlayer.missionRead = read;
  if (coop()) return;
  try {
    localStorage.setItem(MISSION_STORAGE_KEY, read ? '1' : '0');
  } catch {
    // Sem armazenamento: vale só para esta sessão.
  }
}

// O que ainda falta para a porta do lobby abrir: os 3 instrumentos e a missão.
function lobbyMissing() {
  const missing = missingGear().map((key) => GEAR_LABELS[key]);
  if (!window.quantumPlayer.missionRead) missing.push('LER A MISSÃO no computador da mesa');
  return missing;
}

// Medição contínua: quando a porta do andar entra no raio do QPS, o estado
// do andar é medido e a porta se define (aparece). Antes disso ela está em
// superposição entre algumas posições possíveis (doorCandidates): basta uma
// delas entrar no raio para o QPS medir, e a medição sorteia onde a porta fica.
let doorMeasuring = false;
let doorCache = { bits: null, candidates: [] };
function doorCandidates() {
  if (doorCache.bits !== game.current.currentBitstring && typeof window.generateQuantumMap === 'function') {
    doorCache = { bits: game.current.currentBitstring, candidates: window.generateQuantumMap(game.current.currentBitstring).doorCandidates || [] };
  }
  return doorCache.candidates;
}
function checkDoorMeasurement() {
  // No cooperativo quem mede a porta é o operador (host).
  if (coop()) return;
  if (game.current.floor === LOBBY_FLOOR || game.current.measured || doorMeasuring) return;
  const world = window.quantumWorld;
  const head = document.getElementById('player-head')?.object3D.position;
  if (!world || !head || typeof window.generateQuantumMap !== 'function') return;
  const x = (head.x - world.origin) / world.cellSize;
  const z = (head.z - world.origin) / world.cellSize;
  const radius = window.quantumPlayer.hasQps ? QPS_RADIUS_CELLS : BARE_RADIUS_CELLS;
  if (!doorCandidates().some((door) => Math.hypot(x - door.x, z - door.z) <= radius)) return;
  doorMeasuring = true;
  elements['backrooms-scene'].emit('door-measured');
}

// Único texto fixo do canto inferior (no lobby). As outras dicas somem em 20 s
// e, no lobby, este texto volta no lugar delas.
const LOBBY_HINT = 'LOBBY DE TREINAMENTO — pegue os 3 instrumentos nas estações (Q-LINK, Visor Zeta e QPS) e leia a missão no computador da mesa';

function setHint(message, persistent = false) {
  // Objeto (não string): o texto pode conter ";" sem quebrar o atributo.
  elements['desktop-hint'].setAttribute('canvas-text', {
    value: message, align: 'center', color: '#39ff88', width: 1.1, style: 'terminal',
  });
  // Mesmo texto repetido não dispara componentchanged: reinicia os 20 s aqui.
  elements['desktop-hint'].components['auto-hide']?.restart(persistent);
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
  if (coop()) {
    if (transitioning) return 'AGUARDANDO O OPERADOR';
    return game.current.measured ? 'A PORTA FOI MEDIDA: PEÇA O CAMINHO' : 'OUÇA O OPERADOR: ELE TEM O MAPA';
  }
  if (game.current.floor === LOBBY_FLOOR) {
    return missingGear().length ? 'PEGUE O EQUIPAMENTO NAS 3 ESTAÇÕES' : 'TUTORIAL: A PORTA LEVA AO ANDAR 01';
  }
  return game.current.measured ? 'DESÇA: A PORTA FOI MEDIDA' : 'ACHE A PORTA: O QPS MEDE AO REDOR';
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
    door: floor?.stairs ? doorCandidates().findIndex((door) => door.x === floor.stairs.x && door.z === floor.stairs.z) : -1,
    floor: game.current.floor,
  });
  elements['backrooms-scene'].setAttribute('data-floor', game.current.floor);
}

// Painéis do desktop: a string medida do andar, de onde ela veio e o circuito
// que a produziu. O resto (sanidade, energia, objetivo) fica no Q-LINK.
function floorOrigin() {
  if (game.current.floor === LOBBY_FLOOR) return 'ORIGEM: STRING FIXA DE TREINO (LOBBY)';
  if (new URLSearchParams(location.search).has('live')) return 'ORIGEM: API QUÂNTICA (?live)';
  const bank = window.quantumBank?.data;
  if (!bank) return 'ORIGEM: SORTEIO CLÁSSICO (BANCO INDISPONÍVEL)';
  const entry = window.quantumBank.pickEntry(bank, game.current.floor);
  const where = window.quantumBank.describeOrigin(entry);
  return `ORIGEM: ${where} // ${entry.shots} SHOTS GRAVADOS`;
}

// Desenho do circuito real (backend/quantum_circuit.py), em miniatura:
// RY em todos, CX em fila, RY, CZ em anel, RY e medição.
let circuitDrawn = false;
function drawCircuit() {
  const canvas = elements['circuit-canvas'];
  if (!canvas || circuitDrawn) return;
  circuitDrawn = true;
  const ctx = canvas.getContext('2d');
  const { width, height } = canvas;
  const qubits = 12;
  const top = 12;
  const gap = (height - top * 2) / (qubits - 1);
  const y = (q) => top + q * gap;
  ctx.clearRect(0, 0, width, height);
  ctx.strokeStyle = 'rgba(216, 188, 117, 0.45)';
  ctx.lineWidth = 1.5;
  for (let q = 0; q < qubits; q += 1) {
    ctx.beginPath();
    ctx.moveTo(28, y(q));
    ctx.lineTo(width - 10, y(q));
    ctx.stroke();
  }
  ctx.fillStyle = '#a99a6c';
  ctx.font = '12px "Courier New", monospace';
  ctx.textBaseline = 'middle';
  for (let q = 0; q < qubits; q += 1) ctx.fillText(`q${q}`, 0, y(q));
  const box = (x, q, color) => {
    ctx.fillStyle = color;
    ctx.fillRect(x - 9, y(q) - 7, 18, 14);
  };
  const dot = (x, q, color) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y(q), 3.2, 0, Math.PI * 2);
    ctx.fill();
  };
  const link = (x, a, b, color) => {
    ctx.strokeStyle = color;
    ctx.beginPath();
    ctx.moveTo(x, y(a));
    ctx.lineTo(x, y(b));
    ctx.stroke();
  };
  const ry = '#e3cc4b';
  const cx = '#44ffcc';
  const cz = '#c45cff';
  for (let q = 0; q < qubits; q += 1) box(52, q, ry);
  // CX em fila (escada): q -> q+1.
  for (let q = 0; q < qubits - 1; q += 1) {
    const x = 80 + q * 16;
    link(x, q, q + 1, cx);
    dot(x, q, cx);
    ctx.strokeStyle = cx;
    ctx.beginPath();
    ctx.arc(x, y(q + 1), 5, 0, Math.PI * 2);
    ctx.stroke();
  }
  for (let q = 0; q < qubits; q += 1) box(272, q, ry);
  // CZ em anel: q com q+1, e o último com o primeiro.
  for (let q = 0; q < qubits; q += 1) {
    const x = 300 + q * 14;
    const other = (q + 1) % qubits;
    link(x, q, other, cz);
    dot(x, q, cz);
    dot(x, other, cz);
  }
  for (let q = 0; q < qubits; q += 1) box(486, q, ry);
  for (let q = 0; q < qubits; q += 1) {
    ctx.strokeStyle = '#f4dda1';
    ctx.strokeRect(514 - 9, y(q) - 7, 18, 14);
    ctx.beginPath();
    ctx.arc(514, y(q) + 4, 6, Math.PI, 0);
    ctx.stroke();
  }
}

function renderTelemetry() {
  const lobby = game.current.floor === LOBBY_FLOOR;
  elements['hud-floor'].textContent = lobby
    ? 'QUANTUM BACKROOMS // LOBBY'
    : `QUANTUM BACKROOMS // ANDAR ${String(game.current.floor).padStart(2, '0')}`;
  elements['hud-bits'].textContent = formatBits(game.current.currentBitstring);
  elements['hud-origin'].textContent = floorOrigin();
  drawCircuit();
  const positions = doorCandidates().length;
  elements['phase-door'].textContent = lobby
    ? 'PORTA: FIXA (LOBBY DE TREINO)'
    : (game.current.measured
      ? `PORTA: MEDIDA // ${window.quantumMeasureStats?.door ? `POSIÇÃO ${window.quantumMeasureStats.door}` : 'DEFINIDA'}`
      : `PORTA: EM SUPERPOSIÇÃO ENTRE ${positions} POSIÇÕES`);
  const shifts = window.quantumDecoherence?.stats().shifts ?? 0;
  elements['phase-shifts'].textContent = lobby
    ? 'TRECHOS QUE EVOLUÍRAM: — (O LOBBY NÃO MUDA)'
    : `TRECHOS QUE EVOLUÍRAM: ${shifts}`;
  elements['phase-telemetry'].classList.toggle('zeta-visor', survival.visor);
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
    setHint(coop()
      ? 'NO COOPERATIVO VOCÊ SÓ TEM O Q-LINK — o operador enxerga por você'
      : 'SEM VISOR ZETA — pegue os óculos na ESTAÇÃO 2 do lobby');
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
  // Cooperativo: o operador confere a porta e manda o próximo andar.
  if (coop()) {
    if (!game.current.measured || coopRequest || transitioning) return;
    coopRequest = true;
    coop().send({ t: 'stairs' });
    setHint('NA PORTA — esperando o operador abrir o próximo andar');
    window.setTimeout(() => {
      coopRequest = false;
      document.querySelector('[floor-transition]')?.components['floor-transition']?.reset();
    }, 2500);
    return;
  }
  // No lobby a porta já está aberta; nos andares, só depois de medir o QPS.
  if (transitioning || (!game.current.measured && game.current.floor !== LOBBY_FLOOR)) return;
  if (game.current.floor === LOBBY_FLOOR && lobbyMissing().length) {
    setHint(`PORTA BLOQUEADA — falta: ${lobbyMissing().join(', ')}`);
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
    setHint(`ANDAR ${String(game.current.floor).padStart(2, '0')} — a porta está em superposição entre algumas posições (amarelo tracejado no mapa); o QPS mede quando uma delas entra no raio`);
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
  if (coop()) {
    // O operador recomeça o andar 1 e manda de volta (enterCoopFloor).
    if (coopRequest) return;
    coopRequest = true;
    coop().send({ t: 'sanity-lost' });
    window.setTimeout(() => { coopRequest = false; }, 4000);
    return;
  }

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
    if (coop()) {
      beginCoopGame();
      return;
    }
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
    if (mode !== 'continue') setMissionRead(false);
    if (mode !== 'continue' && Object.values(window.quantumPlayer.gear).some(Boolean)) {
      setGear({ qlink: false, visor: false, qps: false });
      setVisor({ ...survival, visor: false });
      elements['quantum-map'].components['quantum-map']?.renderMap();
    }
    playedThisSession = true;
    window.quantumPlayer.active = isActive();
    elements['phase-telemetry'].hidden = false;
    if (game.current.floor === LOBBY_FLOOR) {
      setHint(LOBBY_HINT, true);
      scene.emit('lobby-entered');
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
  // No VR o menu inicial aparece como painel 3D (vr-start-menu): entrar no VR
  // não começa o jogo sozinho.

  // Cada estação do lobby habilita um equipamento, que fica com o agente.
  scene.addEventListener('gear-collected', ({ detail }) => {
    const gear = detail?.gear;
    if (!GEAR_LABELS[gear]) return;
    setGear({ ...window.quantumPlayer.gear, [gear]: true });
    scene.emit('screen-effect', { type: 'flash', color: '#44ffcc', duration: 500, peak: 0.3 });
    const next = {
      qlink: 'Q-LINK HABILITADO — traga o pulso esquerdo ao rosto e gire (desktop: H)',
      visor: 'VISOR ZETA HABILITADO — pinça na testa (desktop: Z) liga e desliga',
      qps: 'QPS HABILITADO — mede tudo num raio de ~4 m e desenha o mapa (pulso direito ao rosto ou M)',
    }[gear];
    const missing = lobbyMissing();
    setHint(missing.length ? `${next}. Falta: ${missing.join(', ')}` : `${next}. Tudo pronto: a porta amarela leva ao ANDAR 01`);
    renderTelemetry();
  });
  scene.addEventListener('visor-toggle-request', toggleVisor);
  scene.addEventListener('lobby-briefing-opened', () => {
    if (window.quantumPlayer.missionRead) return;
    setMissionRead(true);
    const missing = lobbyMissing();
    setHint(missing.length ? `MISSÃO LIDA — falta: ${missing.join(', ')}` : 'MISSÃO LIDA — tudo pronto: a porta amarela leva ao ANDAR 01');
  });
  elements['desktop-hint'].addEventListener('hint-expired', () => {
    if (started && game.current.floor === LOBBY_FLOOR) setHint(LOBBY_HINT, true);
  });
  scene.addEventListener('interaction-hint', ({ detail }) => {
    if (isActive()) setHint(detail.text);
  });
  scene.addEventListener('phase-shift-attempt', resolvePhaseShift);
  scene.addEventListener('phase-shift-blocked', ({ detail }) => {
    if (!isActive()) return;
    setHint(detail?.reason === 'superposed'
      ? 'PAREDE EM SUPERPOSIÇÃO — o salto de fase não passa por ela: ligue o visor (Z) e entre quando ela abrir'
      : 'NADA PARA ATRAVESSAR — encoste as palmas numa parede');
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
    if (coop()) return;
    state.current = collapseQuantumState(
      state.current,
      `${detail.result.bitstring}${detail.result.bitstring}`,
      detail.metrics
    );

    // A medição não refaz o labirinto: colapsa a porta numa das posições
    // possíveis, escolhida pelo bitstring medido. O andar continua o mesmo.
    doorMeasuring = false;
    const floorBits = game.current.currentBitstring;
    const candidates = doorCandidates();
    const picked = window.pickDoorCandidate?.(candidates, detail.result.bitstring)
      || { index: 0, cell: window.generateQuantumMap(floorBits).stairs };
    const map = { stairs: picked.cell };
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
      door: `${picked.index + 1}/${candidates.length}`,
    };
    elements['backrooms-scene'].emit('screen-effect', { type: 'flash', color: '#44ffcc', duration: 500, peak: 0.35 });
    syncMap();
    const world = window.quantumWorld;
    const head = document.getElementById('player-head')?.object3D.position;
    const near = world && head && Math.hypot(
      (head.x - world.origin) / world.cellSize - map.stairs.x,
      (head.z - world.origin) / world.cellSize - map.stairs.z,
    ) <= QPS_RADIUS_CELLS + 1;
    setHint(near
      ? `PORTA MEDIDA — de ${candidates.length} posições possíveis, ela colapsou aqui perto`
      : `PORTA MEDIDA — de ${candidates.length} posições possíveis, ela colapsou em outro ponto do andar: veja no mapa (M ou pulso direito)`);
    persistProgress();
    renderTelemetry();
  });

  elements['backrooms-scene'].addEventListener('stairs-reached', transitionToNextFloor);
}

// ---------- Modo cooperativo (explorador) ----------
// Começa direto no andar que o operador mandou: só com o Q-LINK, sem mapa.
function beginCoopGame() {
  started = true;
  playedThisSession = true;
  setGear({ qlink: true, visor: false, qps: false });
  setMissionRead(true);
  setVisor(createSurvivalState());
  // O painel do circuito traz o mini-quadro das regiões (um mapa do andar):
  // no cooperativo o mapa é só do operador.
  elements['phase-telemetry'].hidden = true;
  const pending = coop().floor;
  if (pending) enterCoopFloor({ ...pending, reason: 'join' });
  window.quantumPlayer.active = isActive();
  setHint(elements['backrooms-scene'].is('vr-mode')
    ? 'MODO COOPERATIVO — você não tem mapa. O operador vê o andar inteiro e sabe onde as paredes vão fechar: ouça e responda'
    : 'MODO COOPERATIVO — WASD anda (Shift corre), arraste o mouse para olhar, H abre o Q-LINK, X é o Salto de Fase. Sem mapa: ouça o operador');
  syncAtmosphere();
  renderTelemetry();
}

function coopDoorState(index, bits) {
  const cell = doorCandidates()[index];
  if (!cell) return;
  game.current = recordMeasurement(game.current, {
    bitstring: game.current.currentBitstring,
    qps: window.analyzeQuantumState?.(bits || game.current.currentBitstring).qps,
    stairs: cell,
  });
  window.quantumMeasureStats = {
    count: (window.quantumMeasureStats?.count ?? 0) + 1,
    bitstring: bits,
    source: 'operador',
    stairs: cell,
    door: `${index + 1}/${doorCandidates().length}`,
  };
}

function applyCoopWorld(message) {
  if (message.floor !== game.current.floor || message.bits !== game.current.currentBitstring) return;
  const mapComponent = elements['quantum-map'].components['quantum-map'];
  mapComponent?.applyWorldState(message.maze, message.superposed, message.regionBits);
}

// Andar novo vindo do operador. reason: join/start (sem animação), stairs
// (descida) ou sanity (sanidade zerada, volta ao andar 1).
function enterCoopFloor(message) {
  const sameFloor = message.floor === game.current.floor && message.bits === game.current.currentBitstring;
  const apply = () => {
    if (!sameFloor || message.reason !== 'start') {
      const keepSanity = message.reason === 'stairs' ? game.current.sanity : 100;
      game.current = { ...createGameState(message.bits, message.floor), sanity: keepSanity };
      state.current = createPhaseState(message.bits);
      if (message.reason === 'sanity' || message.reason === 'join') setVisor(createSurvivalState());
      resetPlayerPosition();
    }
    if (message.door >= 0 && !game.current.measured) coopDoorState(message.door, message.doorBits);
    syncMap();
    applyCoopWorld(message);
    syncAtmosphere();
    coopRequest = false;
    renderTelemetry();
  };

  if (!started || message.reason === 'join' || message.reason === 'start') {
    apply();
    return;
  }
  transitioning = true;
  window.quantumPlayer.active = false;
  const sanity = message.reason === 'sanity';
  const className = sanity ? 'sanity-lost' : 'floor-transition';
  const duration = sanity ? 2400 : 900;
  document.body.classList.add(className);
  elements['backrooms-scene'].emit('screen-effect', { type: 'fade', color: '#000000', duration });
  window.setTimeout(() => {
    apply();
    document.body.classList.remove(className);
    setHint(sanity
      ? 'VOCÊ SE PERDEU — de volta ao ANDAR 01. O operador já tem o mapa novo'
      : `ANDAR ${String(game.current.floor).padStart(2, '0')} — o operador está lendo o mapa novo`);
    transitioning = false;
    window.quantumPlayer.active = isActive();
    renderTelemetry();
  }, duration);
}

function coopDoorMeasured({ index, bits }) {
  if (game.current.measured) return;
  coopDoorState(index, bits);
  elements['backrooms-scene'].emit('screen-effect', { type: 'flash', color: '#44ffcc', duration: 500, peak: 0.35 });
  syncMap();
  setHint('A PORTA FOI MEDIDA — ela apareceu em algum lugar do andar; o operador sabe onde');
  renderTelemetry();
}

// Efeitos que o operador manda junto com as mudanças do labirinto.
function coopEffect(kind) {
  const scene = elements['backrooms-scene'];
  if (kind === 'shift') window.quantumDecoherence?.signal?.();
  if (kind === 'trapped') {
    window.quantumDecoherence?.signal?.();
    flash('ghost-strike', 700);
    scene.emit('screen-effect', { type: 'flash', color: '#000000', duration: 900, peak: 0.6 });
    setHint('AS PAREDES FECHARAM EM VOLTA DE VOCÊ — encoste as palmas numa parede para o Salto de Fase (X) ou peça ao operador para medir');
  }
  if (kind === 'released') {
    scene.emit('screen-effect', { type: 'flash', color: '#44ffcc', duration: 500, peak: 0.3 });
    setHint('O OPERADOR MEDIU — as paredes da jaula voltaram ao lugar');
  }
  if (kind === 'escaped') setHint('VOCÊ ESCAPOU DA JAULA — atrás de você, as paredes já se desfazem');
  if (kind === 'lost') setHint('O OPERADOR CAIU — o labirinto congelou até ele voltar');
  if (kind === 'measure') {
    scene.emit('screen-effect', { type: 'flash', color: '#44ffcc', duration: 400, peak: 0.18 });
  }
}

window.quantumGame = {
  enterCoopFloor,
  applyCoopWorld,
  coopDoorMeasured,
  coopEffect,
  started: () => started,
};

cacheElements();
bindControls();
bindGameEvents();
syncMap();
renderTelemetry();
window.setInterval(advanceStream, 1600);
window.setInterval(updateSurvival, SURVIVAL_TICK_MS);
