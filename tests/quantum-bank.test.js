import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  QuantumBankError,
  describeOrigin,
  measureFromBank,
  parseBank,
  pickEntry,
  qubitMarginals,
  sampleFromCounts,
  shannonEntropy,
} from '../src/js/quantum-bank.js';

const bankPath = new URL('../src/data/quantum-bank.json', import.meta.url);
const bank = parseBank(JSON.parse(readFileSync(bankPath, 'utf8')));

test('o banco gravado cobre 5 andares com counts válidos', () => {
  assert.equal(bank.entries.length, 5);
  bank.entries.forEach((entry, index) => {
    assert.equal(entry.floor, index + 1);
    const total = Object.values(entry.counts).reduce((sum, value) => sum + value, 0);
    assert.equal(total, entry.shots);
    assert.ok(['local-sim', 'ibm-qpu'].includes(entry.source));
  });
});

test('a distribuição gravada não é uniforme', () => {
  bank.entries.forEach((entry) => {
    assert.ok(shannonEntropy(entry.counts) < 11, `andar ${entry.floor}`);
  });
});

test('rejeita bancos de formato desconhecido ou counts inválidos', () => {
  assert.throws(() => parseBank({ version: 2 }), QuantumBankError);
  assert.throws(
    () => parseBank({ version: 1, qubits: 12, bit_order: 'qubit0-first', entries: [] }),
    QuantumBankError
  );
  assert.throws(
    () => parseBank({
      version: 1,
      qubits: 12,
      bit_order: 'qubit0-first',
      entries: [{ floor: 1, counts: { '01': 5 } }],
    }),
    QuantumBankError
  );
});

test('sorteia amostras proporcionalmente aos counts', () => {
  const counts = { '000000000000': 1, '111111111111': 3 };

  assert.equal(sampleFromCounts(counts, () => 0), '000000000000');
  assert.equal(sampleFromCounts(counts, () => 0.24), '000000000000');
  assert.equal(sampleFromCounts(counts, () => 0.26), '111111111111');
  assert.equal(sampleFromCounts(counts, () => 0.999), '111111111111');
});

test('calcula entropia de Shannon', () => {
  assert.equal(shannonEntropy({ a: 1 }), 0);
  assert.equal(shannonEntropy({ a: 1, b: 1 }), 1);
});

test('calcula a marginal de cada qubit', () => {
  const marginals = qubitMarginals({ '100000000000': 1, '110000000000': 1 });

  assert.equal(marginals.length, 12);
  assert.equal(marginals[0], 1);
  assert.equal(marginals[1], 0.5);
  assert.equal(marginals[2], 0);
});

test('andares além do banco reaproveitam os gravados em ciclo', () => {
  assert.equal(pickEntry(bank, 3).floor, 3);
  assert.equal(pickEntry(bank, 6).floor, 1);
  assert.equal(pickEntry(bank, 8).floor, 3);
});

test('a medição declara a origem como gravada e devolve um bitstring de 12 bits', () => {
  const result = measureFromBank(bank, 2, () => 0.5);

  assert.match(result.bitstring, /^[01]{12}$/);
  assert.match(result.backend, /\(gravado\)$/);
  assert.equal(result.recorded, true);
  assert.equal(result.floor, 2);
  assert.ok(result.entropy_bits > 0);
});

test('medições de hardware real mostram backend, job e data no HUD', () => {
  const entry = {
    floor: 1, shots: 4, source: 'ibm-qpu', backend: 'ibm_torino',
    job_id: 'd4f9a1c2e3b5', executed_at: '2026-11-24T15:02:00+00:00',
    counts: { '000000000000': 3, '111111111111': 1 },
  };
  assert.equal(describeOrigin(entry), 'QPU IBM_TORINO // JOB D4F9A1C2 // 24/11/2026');
  assert.equal(describeOrigin({ source: 'local-sim', backend: 'python-statevector' }), 'SIMULADOR EXATO');

  const hw = parseBank({ version: 1, qubits: 12, bit_order: 'qubit0-first', entries: [entry] });
  const result = measureFromBank(hw, 1, () => 0.1);
  assert.equal(result.source, 'ibm-qpu');
  assert.equal(result.backend, 'IBM_TORINO // JOB D4F9A1C2 // 24/11/2026 (gravado)');
  assert.equal(result.executed_at, '2026-11-24T15:02:00+00:00');
});
