import test from 'node:test';
import assert from 'node:assert/strict';
import {
  advanceFloor,
  createGameState,
  markStairsReached,
  recordMeasurement,
  restoreGameState,
  serializeGameState,
} from '../site/js/game-state.js';

test('registra a medição e revela as escadas no andar atual', () => {
  const measured = recordMeasurement(
    createGameState('010110101100'),
    {
      bitstring: '110010101011',
      qps: 72,
      stairs: { x: 8, z: 6, visible: false },
    }
  );

  assert.equal(measured.floor, 1);
  assert.equal(measured.measured, true);
  assert.equal(measured.qps, 72);
  assert.deepEqual(measured.floors[1].stairs, {
    x: 8,
    z: 6,
    visible: true,
  });
  assert.equal(measured.floors[1].completed, false);
});

test('marca a chegada às escadas e prepara o próximo andar', () => {
  const state = recordMeasurement(
    createGameState('010110101100'),
    {
      bitstring: '110010101011',
      qps: 72,
      stairs: { x: 8, z: 6 },
    }
  );
  const reached = markStairsReached(state);
  const next = advanceFloor(reached, '001100110011');

  assert.equal(reached.floors[1].completed, true);
  assert.equal(next.floor, 2);
  assert.equal(next.measured, false);
  assert.equal(next.qps, null);
  assert.equal(next.floors[2].completed, false);
  assert.equal(next.floors[2].stairs, null);
  assert.equal(next.currentBitstring, '001100110011');
});

test('serializa e restaura o progresso sem perder a sanidade', () => {
  const state = {
    ...markStairsReached(
      recordMeasurement(
        createGameState('010110101100'),
        {
          bitstring: '110010101011',
          qps: 72,
          stairs: { x: 8, z: 6 },
        }
      )
    ),
    sanity: 63,
  };

  const restored = restoreGameState(serializeGameState(state));

  assert.deepEqual(restored, state);
});
