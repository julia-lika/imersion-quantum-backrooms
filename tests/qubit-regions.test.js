import test from 'node:test';
import assert from 'node:assert/strict';
import { generateQuantumMap } from '../src/js/map-generator.js';
import { listRegions, listBorders, regionAt, buildRegionMaze } from '../src/js/qubit-regions.js';
import { MAZE_SIZE } from '../src/js/maze-physics.js';

const wallsIn = (maze, r) => {
  let walls = 0;
  for (let z = r.minZ; z <= r.maxZ; z += 1) for (let x = r.minX; x <= r.maxX; x += 1) if (maze[z][x] === '#') walls += 1;
  return walls;
};

test('a grade tem 12 regiões 3x4, uma por qubit, com o qubit 0 na entrada', () => {
  const regions = listRegions(MAZE_SIZE);
  assert.equal(regions.length, 12);
  assert.deepEqual(regions.map((r) => r.qubit), [...Array(12).keys()]);
  assert.equal(regionAt(regions, 1, 1).qubit, 0);
  assert.equal(regionAt(regions, MAZE_SIZE - 2, MAZE_SIZE - 2).qubit, 11);
  assert.equal(regions[1].row, 0);
  assert.equal(regions[3].row, 1);
  assert.equal(regions[3].col, 0);
  regions.forEach((r) => assert.ok(r.maxX - r.minX + 1 >= 6 && r.maxZ - r.minZ + 1 >= 4, r.id));
});

test('o bit de cada qubit decide o tipo da região: 1 sala aberta, 0 corredores', () => {
  for (let seed = 0; seed < 4096; seed += 37) {
    const bits = seed.toString(2).padStart(12, '0');
    const { maze, regions } = buildRegionMaze(bits, MAZE_SIZE);
    regions.forEach((r) => {
      assert.equal(r.bit, bits[r.qubit]);
      if (r.bit === '1') {
        assert.equal(r.type, 'sala aberta');
        assert.ok(wallsIn(maze, r) <= 1, `${bits} ${r.id}`);
      } else {
        assert.equal(r.type, 'corredores');
        assert.ok(wallsIn(maze, r) >= 3, `${bits} ${r.id}`);
      }
    });
  }
});

test('fronteira entre bits iguais some; entre bits diferentes é parede com uma passagem', () => {
  const bits = '110010011101';
  const { maze, regions } = buildRegionMaze(bits, MAZE_SIZE);
  listBorders(regions).forEach((border) => {
    const cells = [];
    for (let t = border.from; t <= border.to; t += 1) {
      cells.push(border.vertical ? maze[t][border.line] : maze[border.line][t]);
    }
    const open = cells.filter((c) => c === '.').length;
    if (bits[border.a] === bits[border.b]) assert.equal(open, cells.length, `q${border.a}|q${border.b}`);
    else assert.equal(open, 2, `q${border.a}|q${border.b}`);
  });
});

test('o mapa do jogo expõe as regiões com o bit que gerou cada uma', () => {
  const map = generateQuantumMap('101010101010');
  assert.equal(map.regions.length, 12);
  assert.equal(map.regions.map((r) => r.bit).join(''), '101010101010');
});
