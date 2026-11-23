import test from 'node:test';
import assert from 'node:assert/strict';
import { bestOpenDirection, createMazeWorld, resolveMove, startPosition, PLAYER_RADIUS } from '../site/js/maze-physics.js';
import { generateQuantumMap } from '../site/js/map-generator.js';

const toMaze = (rows) => rows.map((row) => row.split(''));

test('escolhe o corredor livre mais longo a partir da célula', () => {
  const maze = toMaze([
    '#####',
    '#...#',
    '###.#',
    '#####',
  ]);

  assert.deepEqual(bestOpenDirection(maze, { x: 1, z: 1 }), { x: 1, z: 0, run: 2 });
  assert.deepEqual(bestOpenDirection(maze, { x: 3, z: 1 }), { x: -1, z: 0, run: 2 });
});

test('não devolve direção quando a célula está cercada', () => {
  const maze = toMaze(['###', '#.#', '###']);

  assert.equal(bestOpenDirection(maze, { x: 1, z: 1 }), null);
});

test('no spawn de todos os andares existe uma direção em que dá para andar', () => {
  const world = (bits) => createMazeWorld(generateQuantumMap(bits).maze);
  const start = startPosition();

  ['010110101100', '000000000000', '111111111111', '101010101010'].forEach((bits) => {
    const w = world(bits);
    const open = bestOpenDirection(w.maze, { x: 1, z: 1 });
    assert.ok(open, bits);

    let position = { ...start };
    for (let step = 0; step < 20; step += 1) {
      position = resolveMove(w, position, { x: open.x * 0.05, z: open.z * 0.05 }, PLAYER_RADIUS, 0);
    }
    assert.ok(Math.hypot(position.x - start.x, position.z - start.z) > 0.9, bits);
  });
});
