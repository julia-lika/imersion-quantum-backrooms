// Banco de medições quânticas pré-gravadas (src/data/quantum-bank.json).
// Gerado por tools/pregen.py a partir do circuito por andar; o jogo sorteia
// amostras dos `counts` gravados, sem depender de fila ou cota da IBM.
// Convenção: o caractere i do bitstring é o qubit i (bit_order "qubit0-first").

const QUBITS = 12;

export class QuantumBankError extends Error {}

function isBitstring(value) {
  return typeof value === 'string' && value.length === QUBITS && /^[01]+$/.test(value);
}

export function parseBank(data) {
  if (!data || data.version !== 1 || data.qubits !== QUBITS || data.bit_order !== 'qubit0-first') {
    throw new QuantumBankError('formato de banco desconhecido');
  }
  if (!Array.isArray(data.entries) || data.entries.length === 0) {
    throw new QuantumBankError('banco sem andares');
  }

  const entries = data.entries
    .map((entry) => {
      const counts = entry?.counts;
      const keys = counts ? Object.keys(counts) : [];
      if (
        !Number.isInteger(entry?.floor) || entry.floor < 1 ||
        keys.length === 0 ||
        !keys.every((bits) => isBitstring(bits) && Number.isInteger(counts[bits]) && counts[bits] > 0)
      ) {
        throw new QuantumBankError(`andar inválido no banco: ${entry?.floor}`);
      }
      return entry;
    })
    .sort((a, b) => a.floor - b.floor);

  return { ...data, entries };
}

// Andares além do que o banco cobre reaproveitam os gravados em ciclo.
export function pickEntry(bank, floor) {
  const exact = bank.entries.filter((entry) => entry.floor === floor);
  if (exact.length > 0) return exact[0];
  return bank.entries[(Math.max(1, floor) - 1) % bank.entries.length];
}

export function sampleFromCounts(counts, random = Math.random) {
  const keys = Object.keys(counts);
  const total = keys.reduce((sum, bits) => sum + counts[bits], 0);
  let target = random() * total;

  for (const bits of keys) {
    target -= counts[bits];
    if (target < 0) return bits;
  }
  return keys[keys.length - 1];
}

export function shannonEntropy(counts) {
  const total = Object.values(counts).reduce((sum, value) => sum + value, 0);
  const negative = Object.values(counts).reduce((sum, value) => {
    const p = value / total;
    return sum + (value > 0 ? p * Math.log2(p) : 0);
  }, 0);
  return Math.max(0, -negative); // evita -0 quando só há um resultado
}

// Probabilidade de cada qubit valer 1 (define o tipo/densidade de cada região do mapa).
export function qubitMarginals(counts) {
  const total = Object.values(counts).reduce((sum, value) => sum + value, 0);
  const marginals = Array(QUBITS).fill(0);

  Object.entries(counts).forEach(([bits, value]) => {
    for (let q = 0; q < QUBITS; q += 1) {
      if (bits[q] === '1') marginals[q] += value / total;
    }
  });

  return marginals;
}

export function measureFromBank(bank, floor, random = Math.random) {
  const entry = pickEntry(bank, floor);

  return {
    bitstring: sampleFromCounts(entry.counts, random),
    source: entry.source,
    backend: `${entry.backend} (gravado)`,
    job_id: entry.job_id ?? null,
    shots: entry.shots,
    floor,
    entropy_bits: entry.entropy_bits ?? shannonEntropy(entry.counts),
    recorded: true,
  };
}

export async function loadBank(url = 'data/quantum-bank.json', fetchImpl = globalThis.fetch) {
  const response = await fetchImpl(url, { cache: 'no-cache' });
  if (!response.ok) throw new QuantumBankError(`banco indisponível (${response.status})`);
  return parseBank(await response.json());
}

if (typeof window !== 'undefined') {
  const ready = loadBank().catch((error) => {
    console.warn('[quantum-backrooms] banco quântico indisponível, usando API/local', error);
    return null;
  });
  window.quantumBank = { ready, measureFromBank, qubitMarginals, shannonEntropy, pickEntry, data: null };
  ready.then((bank) => { window.quantumBank.data = bank; });
  // Uma medição do andar: tirada do banco gravado; sem banco, o plano B clássico.
  window.drawFloorBitstring = (floor) => {
    const bank = window.quantumBank.data;
    if (bank) return measureFromBank(bank, floor).bitstring;
    return window.sampleQuantumBitstring?.() || null;
  };
}
