import test from 'node:test';
import assert from 'node:assert/strict';
import {
  analyzeQuantumState,
  generateQuantumMap,
  sampleQuantumBitstring,
} from '../site/js/map-generator.js';

test('gera uma grade 4x4 com entrada e saída conectadas', () => {
  const map = generateQuantumMap('010110101100');

  assert.equal(map.layout.length, 4);
  assert.equal(map.layout[0].length, 4);
  assert.equal(map.layout[0][0], 1);
  assert.equal(map.layout[3][3], 1);
  assert.equal(map.isReachable, true);
});

test('mantém as salas emaranhadas no mesmo estado', () => {
  const map = generateQuantumMap('000000000000');

  assert.equal(map.entangledRooms[0].state, map.entangledRooms[1].state);
});

test('simula um par emaranhado com resultados correlacionados', () => {
  assert.equal(sampleQuantumBitstring(() => 0.1).slice(0, 2), '00');
  assert.equal(sampleQuantumBitstring(() => 0.9).slice(0, 2), '11');
});

test('calcula índices quânticos simulados dentro da escala do HUD', () => {
  const metrics = analyzeQuantumState('010110101100');

  assert.equal(metrics.qpu, 'LOCAL-SIM');
  assert.equal(metrics.qubits, 12);
  assert.ok(metrics.qps >= 0 && metrics.qps <= 100);
  assert.ok(metrics.coherence >= 0 && metrics.coherence <= 100);
  assert.equal(metrics.noise, 100 - metrics.coherence);
});

test('gera paredes internas de um labirinto ocupando a área do mapa', () => {
  const map = generateQuantumMap('010110101100');

  assert.equal(map.maze.length, 11);
  assert.equal(map.maze[0].length, 11);
  assert.equal(map.maze[1][1], '.');
  assert.equal(map.maze[9][9], '.');
  assert.ok(map.maze.flat().includes('#'));
});

test('abre salas deformadas a partir dos bits do mapa', () => {
  const map = generateQuantumMap('010110101100');

  assert.deepEqual(map.roomCenters, [[7, 3], [7, 7]]);
  assert.equal(map.maze[3][6], '.');
  assert.equal(map.maze[8][7], '.');
});

test('mantém uma área central ampla para deixar o jogador exposto', () => {
  const map = generateQuantumMap('010110101100');
  const floorCells = map.maze.flat().filter((cell) => cell === '.').length;

  assert.ok(floorCells > map.maze.length * map.maze[0].length * 0.6);
  assert.equal(map.maze[5][2], '.');
  assert.equal(map.maze[5][8], '.');
  assert.equal(map.maze[2][5], '.');
  assert.equal(map.maze[8][5], '.');
});

test('localiza as escadas em uma célula livre e diferente da entrada', () => {
  const map = generateQuantumMap('010110101100');

  assert.equal(map.maze[map.stairs.z][map.stairs.x], '.');
  assert.notDeepEqual(map.stairs, { x: 1, z: 1 });
  assert.equal(map.stairs.visible, false);
});
