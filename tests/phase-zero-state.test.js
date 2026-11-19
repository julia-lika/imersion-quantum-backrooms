import test from 'node:test';
import assert from 'node:assert/strict';
import {
  advanceQuantumStream,
  collapseQuantumState,
  createPhaseZeroState,
} from '../site/js/phase-zero-state.js';

test('inicia a Fase 0 com a grade colapsada e sem medição', () => {
  const state = createPhaseZeroState('000000000000000000000000');

  assert.equal(state.floor, 1);
  assert.equal(state.tick, 0);
  assert.equal(state.totalCells, 84);
  assert.equal(state.superposedCells, 0);
  assert.equal(state.collapsedCells, 84);
  assert.equal(state.sanity, 100);
  assert.deepEqual(state.candidates, [state.bitstring]);
});

test('mantém o estado atual e abre células superpostas no stream', () => {
  const state = createPhaseZeroState('000000000000000000000000');
  const next = advanceQuantumStream(
    state,
    '001100000000000000000000'
  );

  assert.equal(next.tick, 1);
  assert.equal(next.bitstring, state.bitstring);
  assert.deepEqual(next.candidates, [state.bitstring, '001100000000000000000000']);
  assert.equal(next.superposedCells, 4);
  assert.equal(next.collapsedCells, 80);
});

test('colapsar uma medição resolve a entropia e reduz a sanidade pelo ruído', () => {
  const state = advanceQuantumStream(
    createPhaseZeroState('000000000000000000000000'),
    '001100000000000000000000'
  );
  const collapsed = collapseQuantumState(
    state,
    '001100000000000000000000',
    { noise: 36, qps: 72 }
  );

  assert.equal(collapsed.bitstring, '001100000000000000000000');
  assert.deepEqual(collapsed.candidates, [collapsed.bitstring]);
  assert.equal(collapsed.superposedCells, 0);
  assert.equal(collapsed.collapsedCells, 84);
  assert.equal(collapsed.sanity, 98);
  assert.equal(collapsed.qps, 72);
});
