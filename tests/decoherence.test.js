import test from 'node:test';
import assert from 'node:assert/strict';
import { generateQuantumMap } from '../src/js/map-generator.js';
import {
  listSectors,
  reshuffleSector,
  isSectorObserved,
  isFullyConnected,
  pickSectorSuperposed,
} from '../src/js/decoherence.js';

const bits = (n) => n.toString(2).padStart(12, '0');

test('os setores cobrem todo o interior do mapa sem sobrepor', () => {
  const sectors = listSectors(23);
  const seen = new Set();
  sectors.forEach((s) => {
    for (let z = s.minZ; z <= s.maxZ; z += 1) {
      for (let x = s.minX; x <= s.maxX; x += 1) {
        assert.ok(!seen.has(`${x},${z}`));
        seen.add(`${x},${z}`);
      }
    }
  });
  assert.equal(seen.size, 21 * 21);
});

test('reorganizar setores mantém o labirinto conectado, a borda e as células protegidas', () => {
  for (let seed = 0; seed < 4096; seed += 97) {
    const map = generateQuantumMap(bits(seed));
    const maze = map.maze;
    assert.ok(isFullyConnected(maze), `mapa inicial ${seed}`);
    const protectedCells = [{ x: map.stairs.x, z: map.stairs.z }, { x: 1, z: 1 }, { x: 11, z: 11 }];
    listSectors(maze.length).forEach((sector, index) => {
      const before = maze.map((row) => row.join(''));
      reshuffleSector(maze, sector, bits((seed * 31 + index * 7) % 4096), { protectedCells, salt: index });
      maze.forEach((row, z) => row.forEach((cell, x) => {
        const inside = x >= sector.minX && x <= sector.maxX && z >= sector.minZ && z <= sector.maxZ;
        if (!inside) assert.equal(cell, before[z][x], `fora do setor mudou (${x},${z})`);
      }));
      assert.ok(isFullyConnected(maze), `desconectou: andar ${seed}, setor ${sector.id}`);
      protectedCells
        .filter(({ x, z }) => x >= sector.minX && x <= sector.maxX && z >= sector.minZ && z <= sector.maxZ)
        .forEach(({ x, z }) => assert.equal(maze[z][x], '.', `protegida (${x},${z})`));
    });
    for (let i = 0; i < maze.length; i += 1) {
      assert.equal(maze[0][i], '#');
      assert.equal(maze[i][0], '#');
    }
  }
});

test('a troca muda alguma coisa e as paredes em superposição ligam dois espaços', () => {
  const map = generateQuantumMap('010110101100');
  const sector = listSectors(23)[4];
  let changed = 0;
  for (let i = 0; i < 6; i += 1) changed += reshuffleSector(map.maze, sector, bits(i * 513 + 5), { salt: i }).length;
  assert.ok(changed > 0);
  pickSectorSuperposed(map.maze, sector, '101010101010', 3).forEach(({ x, z }) => {
    assert.equal(map.maze[z][x], '#');
    const m = map.maze;
    assert.ok((m[z][x - 1] === '.' && m[z][x + 1] === '.') || (m[z - 1][x] === '.' && m[z + 1][x] === '.'));
  });
});

test('observar: perto ou no campo de visão conta; de costas ou atrás de parede não', () => {
  const open = Array.from({ length: 23 }, (_, z) => Array.from({ length: 23 }, (__, x) => (
    x === 0 || z === 0 || x === 22 || z === 22 ? '#' : '.'
  )));
  const [first, , third] = listSectors(23); // x 1..7 e x 15..21, z 1..7
  const viewer = { x: 3, z: 4, dirX: 1, dirZ: 0 };
  assert.ok(isSectorObserved(open, first, viewer), 'dentro do setor');
  assert.ok(isSectorObserved(open, third, viewer), 'olhando para ele');
  assert.ok(!isSectorObserved(open, third, { ...viewer, dirX: -1 }), 'de costas');
  const walled = open.map((row) => [...row]);
  for (let z = 1; z < 22; z += 1) walled[z][11] = '#';
  assert.ok(!isSectorObserved(walled, third, viewer), 'parede no caminho');
  assert.ok(isSectorObserved(walled, third, viewer, { transparent: (x) => x === 11 }), 'superposição conta como transparente');
});
