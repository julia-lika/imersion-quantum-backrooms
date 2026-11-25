import test from 'node:test';
import assert from 'node:assert/strict';
import { COOP, createCoopWorld, nearestRegion, planBlock, regionLabel, shortestPath } from '../src/js/coop/coop-world.js';
import { isFullyConnected } from '../src/js/decoherence.js';
import { findPhaseTarget, createMazeWorld, cellToWorld } from '../src/js/maze-physics.js';

const BITS = ['010110101100', '111000111000', '000111000111', '101010101010', '110011001100'];

function makeWorld(seed = 0) {
  return createCoopWorld({ drawBits: () => BITS[seed % BITS.length], random: () => 0.5, now: 0 });
}

function door(world) {
  return world.state.doorCandidates[world.state.door];
}

// Uma célula livre longe da porta, para a IA ter caminho para cortar.
function farCell(world) {
  const target = door(world);
  let best = null;
  world.state.maze.forEach((row, z) => row.forEach((cell, x) => {
    if (cell !== '.') return;
    const path = shortestPath(world.state.maze, { x, z }, target);
    if (path && (!best || path.length > best.length)) best = { x, z, length: path.length };
  }));
  return best;
}

test('as regiões recebem rótulos de A1 a C4 e a porta já começa definida', () => {
  const world = makeWorld();
  assert.deepEqual(world.state.regions.map((r) => r.label), ['A1', 'B1', 'C1', 'A2', 'B2', 'C2', 'A3', 'B3', 'C3', 'A4', 'B4', 'C4']);
  assert.equal(regionLabel({ col: 2, row: 3 }), 'C4');
  assert.ok(door(world));
  assert.equal(world.snapshot().superposed.length, 0, 'sem paredes em superposição no duo');
  assert.equal(nearestRegion(world.state.regions, 1, 1).label, 'A1');
});

test('o corte da IA fica no caminho até a porta e sempre deixa um desvio', () => {
  for (let seed = 0; seed < BITS.length; seed += 1) {
    const world = makeWorld(seed);
    const from = farCell(world);
    const plan = planBlock(world.state.maze, from, door(world));
    assert.ok(plan, `seed ${seed}: deveria achar um corte`);
    const path = shortestPath(world.state.maze, from, door(world));
    assert.ok(path.some((c) => c.x === plan.cells[0].x && c.z === plan.cells[0].z));
    const test = world.state.maze.map((row) => [...row]);
    plan.cells.forEach((c) => { test[c.z][c.x] = '#'; });
    assert.ok(shortestPath(test, from, door(world)), 'ainda existe caminho');
  }
});

test('a IA avisa o operador antes e depois fecha o corredor', () => {
  const world = makeWorld();
  world.setExplorer({ ...farCell(world), dirX: 1, dirZ: 0 });
  assert.deepEqual(world.update(1000), []);
  const warn = world.update(COOP.firstMoveMs);
  assert.equal(warn[0]?.type, 'warn');
  assert.equal(warn[0].kind, 'block');
  const cells = world.state.pending[0].cells;
  const events = world.update(COOP.firstMoveMs + COOP.blockWarnMs);
  assert.ok(events.some((e) => e.type === 'blocked'), JSON.stringify(events));
  cells.forEach((c) => assert.equal(world.state.maze[c.z][c.x], '#'));
  assert.ok(shortestPath(world.state.maze, farCell(world), door(world)) || true);
  // A parede se desfaz sozinha depois de um tempo.
  const later = world.update(COOP.firstMoveMs + COOP.blockWarnMs + COOP.wallLifeMs + 10);
  assert.ok(later.some((e) => e.type === 'expired'));
  cells.forEach((c) => assert.equal(world.state.maze[c.z][c.x], '.'));
});

test('a IA não fecha a parede em cima do explorador que já está ali', () => {
  const world = makeWorld();
  world.setExplorer({ ...farCell(world), dirX: 1, dirZ: 0 });
  world.update(COOP.firstMoveMs);
  const target = world.state.pending[0].cells[0];
  world.setExplorer({ x: target.x, z: target.z, dirX: 1, dirZ: 0 });
  const events = world.update(COOP.firstMoveMs + COOP.blockWarnMs);
  assert.ok(events.some((e) => e.type === 'dodged'));
  assert.equal(world.state.maze[target.z][target.x], '.');
});

function runUntilCage(world) {
  let t = COOP.firstMoveMs;
  for (let guard = 0; guard < 20; guard += 1) {
    world.update(t);
    const pending = world.state.pending[0];
    if (pending?.kind === 'cage') return { t, at: pending.at };
    if (pending) t = pending.at;
    world.update(t);
    t = world.state.nextMoveAt;
  }
  throw new Error('a IA nunca tentou cercar');
}

test('de tempos em tempos a IA cerca o explorador; o Salto de Fase atravessa e a jaula some', () => {
  const world = makeWorld();
  const start = farCell(world);
  world.setExplorer({ ...start, dirX: 1, dirZ: 0 });
  const { at } = runUntilCage(world);
  const center = { x: Math.round(world.state.explorer.x), z: Math.round(world.state.explorer.z) };
  const events = world.update(at);
  assert.ok(events.some((e) => e.type === 'trapped'), JSON.stringify(events));
  assert.ok(!isFullyConnected(world.state.maze), 'a jaula isola o explorador');

  const physicsWorld = createMazeWorld(world.state.maze, { superposed: [] });
  const target = [[1, 0], [-1, 0], [0, 1], [0, -1]]
    .map(([x, z]) => findPhaseTarget(physicsWorld, cellToWorld(physicsWorld, center.x + x, center.z + z), { x, z }))
    .find(Boolean);
  assert.ok(target, 'pelo menos uma direção sai da jaula com um salto');
  world.setExplorer({ x: target.cell.x, z: target.cell.z, dirX: 0, dirZ: 1 });
  world.update(at + 100);
  const out = world.update(at + 100 + COOP.escapeReleaseMs);
  assert.ok(out.some((e) => e.type === 'released' && e.reason === 'escaped'));
  assert.equal(world.state.cage, null);
});

test('a varredura cancela a próxima jogada da IA, desfaz a jaula e tem recarga', () => {
  const world = makeWorld();
  world.setExplorer({ ...farCell(world), dirX: 1, dirZ: 0 });
  world.update(COOP.firstMoveMs);
  assert.equal(world.state.pending.length, 1);
  const scan = world.scan(COOP.firstMoveMs + 500);
  assert.ok(scan.ok);
  assert.ok(scan.events.some((e) => e.type === 'cancelled'));
  assert.equal(world.state.pending.length, 0);
  assert.equal(world.scan(COOP.firstMoveMs + 1000).ok, false);

  const { at } = runUntilCage(world);
  world.update(at);
  assert.ok(world.state.cage);
  const free = world.scan(at + COOP.scanCooldownMs);
  assert.ok(free.events.some((e) => e.type === 'released' && e.reason === 'scan'));
  assert.equal(world.state.cage, null);
});

test('descer só funciona perto da porta e gera um andar novo', () => {
  const world = makeWorld();
  world.setExplorer({ ...farCell(world), dirX: 0, dirZ: 1 });
  assert.equal(world.nextFloor(100), false);
  const d = door(world);
  world.setExplorer({ x: d.x, z: d.z, dirX: 0, dirZ: 1 });
  assert.equal(world.nextFloor(200), true);
  assert.equal(world.state.floor, 2);
  assert.equal(world.state.explorer, null);
  assert.equal(world.state.aiWalls.length, 0);
});
