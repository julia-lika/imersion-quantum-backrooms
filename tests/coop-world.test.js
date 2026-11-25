import test from 'node:test';
import assert from 'node:assert/strict';
import { COOP, createCoopWorld, nearestRegion, regionLabel } from '../src/js/coop/coop-world.js';
import { isFullyConnected } from '../src/js/decoherence.js';
import { findPhaseTarget, createMazeWorld, cellToWorld } from '../src/js/maze-physics.js';

const BITS = ['010110101100', '111000111000', '000111000111', '101010101010'];

function makeWorld(seed = 0) {
  let n = 0;
  return createCoopWorld({
    drawBits: () => BITS[(seed + n++) % BITS.length],
    random: () => 0.5,
    now: 0,
  });
}

// Uma célula livre no meio de uma região, longe da borda.
function freeCellIn(state, region) {
  for (let z = region.minZ + 1; z < region.maxZ; z += 1) {
    for (let x = region.minX + 1; x < region.maxX; x += 1) {
      if (state.maze[z][x] === '.') return { x, z };
    }
  }
  return { x: region.minX, z: region.minZ };
}

test('as regiões recebem rótulos de A1 a C4', () => {
  const world = makeWorld();
  const labels = world.state.regions.map((region) => region.label);
  assert.deepEqual(labels, ['A1', 'B1', 'C1', 'A2', 'B2', 'C2', 'A3', 'B3', 'C3', 'A4', 'B4', 'C4']);
  assert.equal(regionLabel({ col: 2, row: 3 }), 'C4');
});

test('a armadilha avisa antes e prende o explorador que ficou no trecho', () => {
  const world = makeWorld();
  const region = world.state.regions[4];
  const cell = freeCellIn(world.state, region);
  world.setExplorer({ ...cell, dirX: 0, dirZ: 1 });

  assert.deepEqual(world.update(1000), []);
  const warn = world.update(COOP.firstTrapMs);
  assert.equal(warn[0].type, 'warn');
  assert.equal(warn[0].trap, true);
  assert.equal(warn[0].label, region.label);
  assert.equal(world.state.pending.length, 1);

  const events = world.update(COOP.firstTrapMs + COOP.trapWarnMs);
  assert.ok(events.some((event) => event.type === 'trapped'), JSON.stringify(events));
  assert.ok(world.state.cage);
  assert.ok(!isFullyConnected(world.state.maze), 'a jaula isola o explorador');
  assert.equal(world.state.maze[cell.z][cell.x], '.');
  // Anel de parede a duas células, sem paredes em superposição (não abre sozinho).
  for (let d = -2; d <= 2; d += 1) {
    const ring = [[cell.x + d, cell.z - 2], [cell.x + d, cell.z + 2], [cell.x - 2, cell.z + d], [cell.x + 2, cell.z + d]];
    ring.forEach(([x, z]) => {
      if (x <= 0 || z <= 0 || x >= world.state.size - 1 || z >= world.state.size - 1) return;
      const isDoor = world.state.doorCandidates.some((door) => door.x === x && door.z === z);
      if (!isDoor) assert.equal(world.state.maze[z][x], '#', `${x},${z}`);
      assert.ok(!world.state.superposed.has(`${x},${z}`));
    });
  }
});

test('quem sai do trecho antes do colapso escapa da armadilha', () => {
  const world = makeWorld();
  const regions = world.state.regions;
  world.setExplorer({ ...freeCellIn(world.state, regions[0]), dirX: 1, dirZ: 0 });
  world.update(COOP.firstTrapMs);
  world.setExplorer({ ...freeCellIn(world.state, regions[11]), dirX: 1, dirZ: 0 });
  const events = world.update(COOP.firstTrapMs + COOP.trapWarnMs);
  assert.ok(events.some((event) => event.type === 'dodged'));
  assert.equal(world.state.cage, null);
  assert.ok(isFullyConnected(world.state.maze));
});

test('o Salto de Fase atravessa a jaula e ela se desfaz quando o explorador sai', () => {
  const world = makeWorld();
  const region = world.state.regions[4];
  const cell = freeCellIn(world.state, region);
  world.setExplorer({ ...cell, dirX: 0, dirZ: 1 });
  world.update(COOP.firstTrapMs);
  world.update(COOP.firstTrapMs + COOP.trapWarnMs);
  assert.ok(world.state.cage);

  const physicsWorld = createMazeWorld(world.state.maze, { superposed: [] });
  // De pé na beirada da jaula, de frente para o anel.
  const target = ['1,0', '-1,0', '0,1', '0,-1']
    .map((dir) => dir.split(',').map(Number))
    .map(([x, z]) => findPhaseTarget(physicsWorld, cellToWorld(physicsWorld, cell.x + x, cell.z + z), { x, z }))
    .find(Boolean);
  assert.ok(target, 'pelo menos uma direção sai da jaula com um salto');

  const t = COOP.firstTrapMs + COOP.trapWarnMs + 100;
  world.setExplorer({ x: target.cell.x, z: target.cell.z, dirX: 0, dirZ: 1 });
  world.update(t);
  const events = world.update(t + COOP.escapeReleaseMs);
  assert.ok(events.some((event) => event.type === 'released' && event.reason === 'escaped'));
  assert.equal(world.state.cage, null);
  assert.ok(isFullyConnected(world.state.maze), 'desfazer a jaula religa o labirinto');
});

test('medir com o QPS cancela o colapso próximo e solta quem está preso', () => {
  const world = makeWorld();
  const region = world.state.regions[4];
  world.setExplorer({ ...freeCellIn(world.state, region), dirX: 0, dirZ: 1 });
  world.update(COOP.firstTrapMs);
  const cancel = world.measure(COOP.firstTrapMs + 1000);
  assert.ok(cancel.ok);
  assert.ok(cancel.events.some((event) => event.type === 'cancelled' && event.trap));
  assert.equal(world.state.pending.length, 0);

  // A medição tem recarga.
  assert.equal(world.measure(COOP.firstTrapMs + 2000).ok, false);

  // Nova armadilha, desta vez sem medir: preso. A medição seguinte solta.
  const next = world.state.nextTrapAt;
  world.update(next);
  world.update(next + COOP.trapWarnMs);
  assert.ok(world.state.cage);
  const release = world.measure(next + COOP.trapWarnMs + COOP.measureCooldownMs);
  assert.ok(release.events.some((event) => event.type === 'released' && event.reason === 'measured'));
  assert.ok(isFullyConnected(world.state.maze));
});

test('a porta colapsa quando o explorador chega perto de uma posição possível', () => {
  const world = makeWorld();
  const door = world.state.doorCandidates[0];
  world.setExplorer({ x: door.x, z: door.z, dirX: 0, dirZ: 1 });
  const events = world.update(500);
  const collapsed = events.find((event) => event.type === 'door');
  assert.ok(collapsed);
  assert.equal(world.state.measured, true);
  assert.equal(world.snapshot().door, collapsed.index);
});

test('descer só funciona perto da porta medida e sorteia um andar novo', () => {
  const world = makeWorld();
  world.setExplorer({ x: 1, z: 1, dirX: 0, dirZ: 1 });
  assert.equal(world.nextFloor(100), false);
  const door = world.state.doorCandidates[0];
  world.setExplorer({ x: door.x, z: door.z, dirX: 0, dirZ: 1 });
  world.update(200);
  const measured = world.state.doorCandidates[world.state.door];
  world.setExplorer({ x: measured.x, z: measured.z, dirX: 0, dirZ: 1 });
  assert.equal(world.nextFloor(300), true);
  assert.equal(world.state.floor, 2);
  assert.equal(world.state.measured, false);
  assert.equal(world.state.explorer, null);
});

test('a decoerência comum avisa o operador e não muda o que o explorador vê', () => {
  const world = makeWorld();
  world.state.nextTrapAt = Infinity;
  const start = freeCellIn(world.state, world.state.regions[0]);
  world.setExplorer({ ...start, dirX: -1, dirZ: -1 });
  world.update(100);
  const warn = world.update(30000).find((event) => event.type === 'warn');
  assert.ok(warn);
  assert.equal(warn.trap, false);
  const events = world.update(30000 + COOP.ambientWarnMs);
  assert.ok(events.some((event) => event.type === 'collapse' || event.type === 'cancelled'));
  assert.ok(isFullyConnected(world.state.maze));
});

test('o snapshot leva o labirinto como texto e as paredes em superposição', () => {
  const world = makeWorld();
  const snap = world.snapshot();
  assert.equal(snap.maze.length, world.state.size);
  assert.ok(snap.maze.every((row) => row.length === world.state.size));
  assert.equal(snap.bits.length, 12);
  assert.ok(Array.isArray(snap.superposed));
  assert.equal(nearestRegion(world.state.regions, 1, 1).label, 'A1');
});
