import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildLightPanels, buildWallGeometry } from '../src/js/components/level-geometry.js';

const toMaze = (rows) => rows.map((row) => row.split(''));
const options = { origin: 0, cellSize: 1, height: 2.8 };

test('emite só as faces de parede voltadas para células livres', () => {
  const maze = toMaze([
    '###',
    '#.#',
    '###',
  ]);
  const { walls, baseboards } = buildWallGeometry(maze, options);

  // A única célula livre enxerga quatro faces; as faces externas da borda não existem.
  assert.equal(walls.indices.length / 6, 4);
  assert.equal(baseboards.indices.length / 6, 4);
  assert.ok(walls.positions.every((value, index) => index % 3 !== 1 || value === 0 || value === 2.8));
});

test('paredes em superposição ficam fora do mesh fixo e expõem as vizinhas', () => {
  const maze = toMaze([
    '#####',
    '#.#.#',
    '#####',
  ]);
  const all = buildWallGeometry(maze, options).walls.indices.length / 6;
  const withoutCenter = buildWallGeometry(maze, {
    ...options,
    isStatic: (x, z) => !(x === 2 && z === 1),
  }).walls.indices.length / 6;

  assert.equal(all, 8);
  // Sem a parede do meio: perde as 2 faces dela, ganha as faces das vizinhas de cima e de baixo.
  assert.equal(withoutCenter, 8);
});

test('UV em coordenadas de mundo mantém o papel de parede contínuo', () => {
  const maze = toMaze([
    '####',
    '#..#',
    '####',
  ]);
  const { walls } = buildWallGeometry(maze, { ...options, tile: 1 });
  const us = walls.uvs.filter((_, index) => index % 2 === 0);
  const span = Math.max(...us) - Math.min(...us);

  assert.ok(span >= 2);
});

test('luminárias ficam em grade, só sobre o chão livre', () => {
  const maze = toMaze([
    '#######',
    '#.....#',
    '#.....#',
    '#.....#',
    '#.....#',
    '#.....#',
    '#######',
  ]);
  const { panels, fixtures } = buildLightPanels(maze, { ...options, random: () => 0.5 });

  assert.equal(fixtures.length, 4);
  assert.equal(panels.indices.length / 6, 4);
  assert.ok(panels.normals.every((value, index) => index % 3 !== 1 || value === -1));
});

test('as luminárias apagadas não viram luz que segue o jogador', () => {
  const maze = toMaze(['#####', '#...#', '#...#', '#...#', '#####']);
  const { fixtures, panels } = buildLightPanels(maze, { ...options, offset: 1, spacing: 1, random: () => 0 });

  assert.equal(fixtures.length, 0);
  assert.equal(panels.indices.length / 6, 9);
});

test('as texturas do Level 0 são leves o bastante para o Quest', () => {
  const html = readFileSync(new URL('../src/index.html', import.meta.url), 'utf8');
  const sources = [...html.matchAll(/<img id="[^"]+" src="([^"]+)"/g)].map((match) => match[1]);

  assert.ok(sources.length >= 4);
  sources.forEach((src) => {
    const bytes = readFileSync(new URL(`../src/${src}`, import.meta.url)).length;
    assert.ok(bytes < 400 * 1024, `${src} tem ${bytes} bytes`);
  });
});
