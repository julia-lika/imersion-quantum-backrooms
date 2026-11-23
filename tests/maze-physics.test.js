import test from 'node:test';
import assert from 'node:assert/strict';
import {
  cellToWorld,
  createMazeWorld,
  findPhaseTarget,
  findSuperposedWalls,
  isCellSolid,
  nextStepToward,
  pickFloorCells,
  resolveMove,
  worldToCell,
} from '../site/js/maze-physics.js';
import { generateQuantumMap } from '../site/js/map-generator.js';

const corridor = [
  '#####',
  '#.#.#',
  '#.#.#',
  '#...#',
  '#####',
].map((row) => [...row]);

test('converte células para o mundo e de volta', () => {
  const world = createMazeWorld(corridor);
  const center = cellToWorld(world, 1, 3);

  assert.deepEqual(worldToCell(world, center.x, center.z), { x: 1, z: 3 });
});

test('bloqueia o movimento contra uma parede e permite deslizar no outro eixo', () => {
  const world = createMazeWorld(corridor);
  const start = cellToWorld(world, 1, 2);
  const moved = resolveMove(world, start, { x: 0.6, z: 0.3 });

  assert.equal(moved.x, start.x);
  assert.ok(Math.abs(moved.z - (start.z + 0.3)) < 1e-9);
});

test('paredes superpostas ficam atravessáveis apenas na fase aberta', () => {
  const world = createMazeWorld(corridor, { superposed: [{ x: 2, z: 1, offset: 0 }] });

  assert.equal(isCellSolid(world, 2, 1, 0), true);
  assert.equal(isCellSolid(world, 2, 1, (Math.PI / 2) / 0.7), false);
  assert.equal(isCellSolid(world, 2, 2, 0), true);
});

test('phase shift encontra a célula livre logo após a parede', () => {
  const world = createMazeWorld(corridor);
  const target = findPhaseTarget(world, cellToWorld(world, 1, 1), { x: 1, z: 0.1 });

  assert.deepEqual(target.cell, { x: 3, z: 1 });
});

test('phase shift não dispara sem parede à frente nem através da borda', () => {
  const world = createMazeWorld(corridor);

  assert.equal(findPhaseTarget(world, cellToWorld(world, 1, 2), { x: 0, z: 1 }), null);
  assert.equal(findPhaseTarget(world, cellToWorld(world, 1, 1), { x: -1, z: 0 }), null);
});

test('o fantasma segue o caminho mais curto pelos corredores', () => {
  assert.deepEqual(nextStepToward(corridor, { x: 1, z: 1 }, { x: 3, z: 1 }), { x: 1, z: 2 });
  assert.deepEqual(nextStepToward(corridor, { x: 1, z: 1 }, { x: 1, z: 1 }), { x: 1, z: 1 });
});

test('escolhe paredes superpostas que ligam dois corredores no labirinto real', () => {
  const { maze } = generateQuantumMap('010110101100');
  const walls = findSuperposedWalls(maze, '010110101100');

  assert.ok(walls.length > 0 && walls.length <= 6);
  walls.forEach(({ x, z }) => assert.equal(maze[z][x], '#'));
  assert.deepEqual(walls, findSuperposedWalls(maze, '010110101100'));
});

test('sorteia itens em células livres sem repetir nem usar as excluídas', () => {
  const { maze } = generateQuantumMap('010110101100');
  const cells = pickFloorCells(maze, '010110101100', 4, [{ x: 1, z: 1 }]);
  const keys = new Set(cells.map(({ x, z }) => `${x},${z}`));

  assert.equal(cells.length, 4);
  assert.equal(keys.size, 4);
  assert.equal(keys.has('1,1'), false);
  cells.forEach(({ x, z }) => assert.equal(maze[z][x], '.'));
});

test('o jogador consegue sair de uma parede superposta que fechou sobre ele', () => {
  const world = createMazeWorld(corridor, { superposed: [{ x: 2, z: 1, offset: 0 }] });
  const inside = cellToWorld(world, 2, 1);
  const moved = resolveMove(world, inside, { x: 0.4, z: 0 }, 0.24, 0);

  assert.ok(moved.x > inside.x);
});

test('QPS e Almond Water sempre caem em células livres do Level 0', () => {
  ['010110101100', '000000000000', '111111111111', '101010101010', '111000111000', '001100110011'].forEach((bits) => {
    const map = generateQuantumMap(bits);
    const exclude = [{ x: 1, z: 1 }, { x: 2, z: 1 }, { x: 1, z: 2 }, map.stairs];
    const cells = pickFloorCells(map.maze, map.bitstring, 3, exclude);

    assert.equal(cells.length, 3, bits);
    cells.forEach(({ x, z }) => {
      assert.equal(map.maze[z][x], '.', `${bits} ${x},${z}`);
      assert.ok(!exclude.some((cell) => cell.x === x && cell.z === z), bits);
    });
  });
});
