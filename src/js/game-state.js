// v2: o jogo novo começa no lobby (andar 0); saves antigos são descartados.
const SAVE_VERSION = 2;
const DEFAULT_BITSTRING = '010110101100';

function normalizeBitstring(bitstring) {
  const bits = String(bitstring ?? '').replace(/[^01]/g, '');
  return (bits + '0'.repeat(12)).slice(0, 12);
}

function normalizeStairs(stairs, visible = false) {
  if (!stairs) return null;

  return {
    x: Number(stairs.x),
    z: Number(stairs.z),
    visible: Boolean(stairs.visible ?? visible),
  };
}

export const LOBBY_FLOOR = 0;

export function createGameState(bitstring = DEFAULT_BITSTRING, floor = 1) {
  const normalized = normalizeBitstring(bitstring);

  return {
    version: SAVE_VERSION,
    floor,
    sanity: 100,
    qps: null,
    measured: false,
    // Campanha solo: a agente morta do andar 5 já foi encontrada?
    agentFound: false,
    currentBitstring: normalized,
    floors: {
      [floor]: {
        bitstring: normalized,
        stairs: null,
        completed: false,
      },
    },
  };
}

export function recordMeasurement(state, { bitstring, qps, stairs }) {
  const normalized = normalizeBitstring(bitstring);
  const floor = state.floor;

  return {
    ...state,
    qps: Number.isFinite(qps) ? qps : null,
    measured: true,
    currentBitstring: normalized,
    floors: {
      ...state.floors,
      [floor]: {
        ...state.floors[floor],
        bitstring: normalized,
        stairs: normalizeStairs({ ...stairs, visible: true }, true),
      },
    },
  };
}

export function markStairsReached(state) {
  const floor = state.floor;
  const currentFloor = state.floors[floor];

  if (!currentFloor?.stairs?.visible) return state;

  return {
    ...state,
    floors: {
      ...state.floors,
      [floor]: {
        ...currentFloor,
        completed: true,
      },
    },
  };
}

export function markAgentFound(state) {
  return { ...state, agentFound: true };
}

export function advanceFloor(state, bitstring = DEFAULT_BITSTRING) {
  const nextFloor = state.floor + 1;
  const normalized = normalizeBitstring(bitstring);

  return {
    ...state,
    floor: nextFloor,
    qps: null,
    measured: false,
    currentBitstring: normalized,
    floors: {
      ...state.floors,
      [nextFloor]: {
        bitstring: normalized,
        stairs: null,
        completed: false,
      },
    },
  };
}

export function serializeGameState(state) {
  return JSON.stringify({ ...state, version: SAVE_VERSION });
}

export function restoreGameState(serialized) {
  const parsed = typeof serialized === 'string'
    ? JSON.parse(serialized)
    : serialized;

  if (!parsed || parsed.version !== SAVE_VERSION) {
    throw new Error('invalid-game-save');
  }

  const state = createGameState(parsed.currentBitstring);
  return {
    ...state,
    ...parsed,
    currentBitstring: normalizeBitstring(parsed.currentBitstring),
  };
}

export function saveGameState(state, storage = globalThis.localStorage) {
  storage?.setItem('quantum-backrooms-save-v2', serializeGameState(state));
}

export function loadGameState(storage = globalThis.localStorage) {
  const serialized = storage?.getItem('quantum-backrooms-save-v2');
  if (!serialized) return null;

  try {
    return restoreGameState(serialized);
  } catch {
    return null;
  }
}
