const DEFAULT_TOTAL_CELLS = 84;
const DEFAULT_BITSTRING_LENGTH = 24;

function normalizeQuantumBits(bitstring) {
  const bits = String(bitstring ?? '').replace(/[^01]/g, '');
  return (bits + '0'.repeat(DEFAULT_BITSTRING_LENGTH)).slice(
    0,
    DEFAULT_BITSTRING_LENGTH
  );
}

function countMismatches(left, right) {
  return [...left].reduce(
    (total, bit, index) => total + Number(bit !== right[index]),
    0
  );
}

export function createPhaseZeroState(bitstring = '') {
  const normalized = normalizeQuantumBits(bitstring);

  return {
    floor: 1,
    tick: 0,
    totalCells: DEFAULT_TOTAL_CELLS,
    bitstring: normalized,
    candidates: [normalized],
    superposedCells: 0,
    collapsedCells: DEFAULT_TOTAL_CELLS,
    sanity: 100,
    qps: 0,
  };
}

export function advanceQuantumStream(state, nextBitstring) {
  const candidate = normalizeQuantumBits(nextBitstring);
  const superposedCells = Math.min(
    state.totalCells,
    countMismatches(state.bitstring, candidate) * 2
  );
  const candidates = candidate === state.bitstring
    ? [state.bitstring]
    : [state.bitstring, candidate];

  return {
    ...state,
    tick: state.tick + 1,
    candidates,
    superposedCells,
    collapsedCells: state.totalCells - superposedCells,
  };
}

export function collapseQuantumState(
  state,
  bitstring,
  { noise = 0, qps = state.qps } = {}
) {
  const normalized = normalizeQuantumBits(bitstring);
  const sanityLoss = Math.max(1, Math.round(Math.max(0, noise) / 18));

  return {
    ...state,
    bitstring: normalized,
    candidates: [normalized],
    superposedCells: 0,
    collapsedCells: state.totalCells,
    sanity: Math.max(0, state.sanity - sanityLoss),
    qps,
  };
}
