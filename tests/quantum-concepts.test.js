import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createMazeWorld,
  cellToWorld,
  isCellSolid,
  superposedOpenProbability,
  observeSuperposedWalls,
} from '../src/js/maze-physics.js';
import { generateLobbyMap, LOBBY } from '../src/js/map-generator.js';
import { QUANTUM_SLIDES, SLIDE_IMAGES } from '../src/js/content/quantum-slides.js';

// Sorteio fixo para os testes: 0 mede sempre passagem quando P>0; 0.999 quase sempre parede.
const always = (value) => () => value;

test('encostar numa parede em superposição a mede: deu passagem, fica aberta até sair', () => {
  const map = generateLobbyMap();
  const world = createMazeWorld(map.maze, { superposed: LOBBY.superposed, random: always(0) });
  const wall = LOBBY.superposed[0];
  const center = cellToWorld(world, wall.x, wall.z);
  // Antes de medir, colisão trata como parede; o visor mostra só a chance.
  observeSuperposedWalls(world, center.x - 5, center.z, 0.24, 0);
  observeSuperposedWalls(world, center.x - 5, center.z, 0.24, 1.5);
  const chance = superposedOpenProbability(world, wall.x, wall.z);
  assert.ok(chance > 0 && chance < 1, `em superposição (${chance})`);
  assert.equal(isCellSolid(world, wall.x, wall.z, 1.5), true);

  const [result] = observeSuperposedWalls(world, center.x - world.cellSize / 2 - 0.3, center.z, 0.24, 1.6);
  assert.equal(result.open, true);
  assert.equal(isCellSolid(world, wall.x, wall.z, 1.6), false, 'colapsada em passagem');
  assert.equal(superposedOpenProbability(world, wall.x, wall.z), 1);

  const outside = cellToWorld(world, wall.x - 3, wall.z);
  observeSuperposedWalls(world, outside.x, outside.z, 0.24, 1.7);
  assert.equal(isCellSolid(world, wall.x, wall.z, 1.7), true, 'sai e ela volta a ser um qubit');
});

test('medição que dá parede deixa sólida enquanto encosta (Zeno) e não é refeita', () => {
  const map = generateLobbyMap();
  const world = createMazeWorld(map.maze, { superposed: LOBBY.superposed, random: always(0.999999) });
  const wall = LOBBY.superposed[0];
  const center = cellToWorld(world, wall.x, wall.z);
  const touching = { x: center.x - world.cellSize / 2 - 0.3, z: center.z };
  const first = observeSuperposedWalls(world, touching.x, touching.z, 0.24, 0);
  assert.equal(first.length, 1);
  assert.equal(first[0].open, false);
  assert.equal(isCellSolid(world, wall.x, wall.z, 0), true);
  // Continua encostado: nenhuma medição nova e o estado não evolui.
  assert.equal(observeSuperposedWalls(world, touching.x, touching.z, 0.24, 3).length, 0);
  assert.equal(world.collapsed.size, 0);
});

test('a sala de treino do lobby é alcançável pelas duas paredes', () => {
  const { maze } = generateLobbyMap();
  const room = LOBBY.trainingRoom;
  const wallX = room.minX - 1;
  assert.equal(maze[room.minZ][wallX], '#', 'parede sólida do salto de fase');
  assert.equal(maze[room.minZ][wallX - 1], '.', 'salão na frente da parede do salto');
  assert.equal(maze[room.minZ][room.minX], '.');
  const wall = LOBBY.superposed[0];
  assert.equal(wall.x, wallX);
  assert.equal(maze[wall.z][wall.x + 1], '.', 'sala atrás da parede em superposição');
  assert.equal(maze[wall.z][wall.x - 1], '.', 'salão na frente da parede em superposição');
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
