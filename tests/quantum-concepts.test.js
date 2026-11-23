import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createMazeWorld,
  cellToWorld,
  isCellSolid,
  isSuperposedOpen,
  observeSuperposedWalls,
} from '../src/js/maze-physics.js';
import { generateLobbyMap, LOBBY } from '../src/js/map-generator.js';
import { QUANTUM_SLIDES } from '../src/js/content/quantum-slides.js';

function openTime(offset) {
  for (let t = 0; t < 20; t += 0.05) if (isSuperposedOpen(offset, t)) return t;
  throw new Error('nunca abre');
}
function closedTime(offset, after) {
  for (let t = after; t < after + 20; t += 0.05) if (!isSuperposedOpen(offset, t)) return t;
  throw new Error('nunca fecha');
}

test('entrar numa parede em superposição aberta a mede: fica aberta até sair', () => {
  const map = generateLobbyMap();
  const world = createMazeWorld(map.maze, { superposed: LOBBY.superposed });
  const wall = LOBBY.superposed[0];
  const center = cellToWorld(world, wall.x, wall.z);
  const open = openTime(wall.offset);
  const closed = closedTime(wall.offset, open);

  observeSuperposedWalls(world, center.x, center.z, 0.24, open);
  assert.equal(isCellSolid(world, wall.x, wall.z, closed), false, 'colapsada em passagem');

  const outside = cellToWorld(world, wall.x - 2, wall.z);
  observeSuperposedWalls(world, outside.x, outside.z, 0.24, closed);
  assert.equal(isCellSolid(world, wall.x, wall.z, closed), true, 'volta a oscilar quando o jogador sai');
});

test('parede fechada não é medida ao encostar', () => {
  const map = generateLobbyMap();
  const world = createMazeWorld(map.maze, { superposed: LOBBY.superposed });
  const wall = LOBBY.superposed[0];
  const center = cellToWorld(world, wall.x, wall.z);
  const closed = closedTime(wall.offset, 0);
  observeSuperposedWalls(world, center.x, center.z, 0.24, closed);
  assert.equal(world.collapsed.size, 0);
});

test('a sala de treino do lobby é alcançável pelas duas paredes', () => {
  const { maze } = generateLobbyMap();
  const room = LOBBY.trainingRoom;
  assert.equal(maze[12][12], '#', 'parede sólida do salto de fase');
  assert.equal(maze[room.minZ][room.minX], '.');
  assert.equal(maze[16][13], '.', 'sala atrás da parede em superposição');
});

test('os slides cobrem os conceitos e todos têm diagrama', () => {
  const titles = QUANTUM_SLIDES.map((slide) => slide.title).join(' ');
  ['SUPERPOSIÇÃO', 'EMARANHAMENTO', 'ENTROPIA', 'MEDIÇÃO', 'MAPA', 'TUNELAMENTO']
    .forEach((word) => assert.match(`${titles} ${QUANTUM_SLIDES.map((s) => s.subtitle).join(' ')}`, new RegExp(word)));
  QUANTUM_SLIDES.forEach((slide) => assert.ok(slide.diagram && slide.body.length > 40));
});
