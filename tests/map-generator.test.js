import test from 'node:test';
import assert from 'node:assert/strict';
import {
  analyzeQuantumState,
  generateQuantumMap,
  sampleQuantumBitstring,
} from '../src/js/map-generator.js';
import { MAZE_SIZE } from '../src/js/maze-physics.js';

test('o bitstring de 12 qubits é a semente: mesmo bitstring, mesmo mapa', () => {
  const first = generateQuantumMap('010110101100');
  const second = generateQuantumMap('010110101100');
  const other = generateQuantumMap('110010011101');

  assert.equal(first.bitstring.length, 12);
  assert.deepEqual(first.maze, second.maze);
  assert.notDeepEqual(first.maze, other.maze);
});

test('o plano B clássico gera 12 bits com vizinhos correlacionados', () => {
  assert.equal(sampleQuantumBitstring(() => 0.1), '000000000000');
  const alternating = sampleQuantumBitstring(() => 0.9);
  assert.equal(alternating.length, 12);
  assert.match(alternating, /^(10)+$/);
});

test('calcula índices quânticos simulados dentro da escala do HUD', () => {
  const metrics = analyzeQuantumState('010110101100');

  assert.equal(metrics.qpu, 'LOCAL-SIM');
  assert.equal(metrics.qubits, 12);
  assert.ok(metrics.qps >= 0 && metrics.qps <= 100);
  assert.ok(metrics.coherence >= 0 && metrics.coherence <= 100);
  assert.equal(metrics.noise, 100 - metrics.coherence);
});

test('gera o Level 0 ocupando toda a grade, com borda fechada', () => {
  const map = generateQuantumMap('010110101100');
  const last = MAZE_SIZE - 1;

  assert.equal(map.maze.length, MAZE_SIZE);
  assert.equal(map.maze[0].length, MAZE_SIZE);
  assert.equal(map.maze[1][1], '.');
  assert.equal(map.maze[last - 1][last - 1], '.');
  assert.ok(map.maze[0].every((cell) => cell === '#'));
  assert.ok(map.maze.every((row) => row[0] === '#' && row[last] === '#'));
  assert.ok(map.maze.flat().includes('#'));
});

const BITSTRINGS = ['010110101100', '000000000000', '111111111111', '101010101010', '111000111000'];

function reachableFrom(maze, start) {
  const seen = new Set([`${start.x},${start.z}`]);
  const queue = [start];
  while (queue.length > 0) {
    const { x, z } = queue.shift();
    [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dz]) => {
      const key = `${x + dx},${z + dz}`;
      if (maze[z + dz]?.[x + dx] === '.' && !seen.has(key)) {
        seen.add(key);
        queue.push({ x: x + dx, z: z + dz });
      }
    });
  }
  return seen;
}

test('toda célula livre é alcançável a partir da entrada', () => {
  BITSTRINGS.forEach((bits) => {
    const { maze } = generateQuantumMap(bits);
    const floor = maze.flat().filter((cell) => cell === '.').length;
    assert.equal(reachableFrom(maze, { x: 1, z: 1 }).size, floor, bits);
  });
});

test('tem salas grandes e é mais aberto que um labirinto de corredores', () => {
  BITSTRINGS.forEach((bits) => {
    const map = generateQuantumMap(bits);
    const floorCells = map.maze.flat().filter((cell) => cell === '.').length;

    assert.ok(map.roomCenters.length >= 1, bits);
    assert.ok(floorCells > MAZE_SIZE * MAZE_SIZE * 0.7, bits);
  });
});

test('o mesmo bitstring gera sempre o mesmo andar', () => {
  assert.deepEqual(generateQuantumMap('101010101010').maze, generateQuantumMap('101010101010').maze);
  assert.notDeepEqual(generateQuantumMap('101010101010').maze, generateQuantumMap('010101010101').maze);
});

test('localiza as escadas em uma célula livre e diferente da entrada', () => {
  const map = generateQuantumMap('010110101100');

  assert.equal(map.maze[map.stairs.z][map.stairs.x], '.');
  assert.notDeepEqual(map.stairs, { x: 1, z: 1 });
  assert.equal(map.stairs.visible, false);
  assert.ok(map.stairs.x + map.stairs.z - 2 >= Math.floor(MAZE_SIZE * 0.6));
});
