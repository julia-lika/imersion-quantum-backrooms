import { existsSync, readFileSync } from 'node:fs';
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
import { QUANTUM_SLIDES, SLIDE_IMAGES } from '../src/js/content/quantum-slides.js';

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

test('os slides explicam do bit ao jogo e as imagens existem', () => {
  const titles = QUANTUM_SLIDES.map((slide) => slide.title).join(' ').toLowerCase();
  ['bit', 'qubit', 'superposição', 'schrödinger', 'medir', 'emaranhamento', 'entropia', 'mapa', 'tunelamento']
    .forEach((word) => assert.ok(titles.includes(word), `falta slide sobre ${word}`));
  QUANTUM_SLIDES.forEach((slide) => {
    assert.ok(['dark', 'cream', 'yellow'].includes(slide.theme));
    assert.ok((slide.cards && slide.cards.length >= 1 && slide.cards.length <= 3) || slide.table);
    (slide.cards || []).forEach((card) => {
      if (card.image) {
        assert.ok(SLIDE_IMAGES[card.image], `imagem ${card.image}`);
        assert.ok(existsSync(new URL(`../src/${SLIDE_IMAGES[card.image]}`, import.meta.url)));
      }
    });
  });
});

test('Esc volta ao menu, o visor desliga e a dica usa a fonte de terminal', () => {
  const phase = readFileSync(new URL('../src/js/phase-zero.js', import.meta.url), 'utf8');
  assert.match(phase, /'Escape'/);
  assert.match(phase, /function returnToMenu/);
  assert.match(phase, /style: 'terminal'/);
  const canvasText = readFileSync(new URL('../src/js/components/canvas-text.js', import.meta.url), 'utf8');
  assert.match(canvasText, /monospace/);
  const locomotion = readFileSync(new URL('../src/js/components/player-locomotion.js', import.meta.url), 'utf8');
  assert.match(locomotion, /start-screen/);
});
