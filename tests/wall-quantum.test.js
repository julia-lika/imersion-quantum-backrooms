import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createRegister, ry, rx, cx, x, hop, probabilityOne, measure,
  createWallQuantum, addWalls, evolveWalls, openProbability, measureWall, removeWall, syncWalls, WALL_OMEGA,
} from '../src/js/wall-quantum.js';

const norm = (reg) => [...reg.re].reduce((s, r, i) => s + r * r + reg.im[i] ** 2, 0);
const close = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;

test('portas básicas: RY dá a probabilidade de Born e RX conserva a norma', () => {
  const reg = createRegister(1);
  ry(reg, 0, Math.PI / 3);
  assert.ok(close(probabilityOne(reg, 0), Math.sin(Math.PI / 6) ** 2));
  rx(reg, 0, 1.234);
  assert.ok(close(norm(reg), 1));
  const r2 = createRegister(1);
  rx(r2, 0, Math.PI);
  assert.ok(close(probabilityOne(r2, 0), 1));
});

test('par emaranhado: exatamente uma parede é passagem, e medir uma decide a outra', () => {
  for (let trial = 0; trial < 50; trial += 1) {
    const reg = createRegister(2);
    ry(reg, 0, 1.1);
    cx(reg, 0, 1);
    x(reg, 1);
    assert.ok(close(probabilityOne(reg, 0) + probabilityOne(reg, 1), 1));
    const a = measure(reg, 0, () => trial / 50);
    assert.ok(close(probabilityOne(reg, 1), a ? 0 : 1), 'a parceira vira o oposto');
  }
});

test('a passagem "pula" de parede no par sem sair do subespaço de uma passagem só', () => {
  const reg = createRegister(2);
  x(reg, 0); // passagem em A com certeza
  hop(reg, Math.PI / 2);
  assert.ok(close(probabilityOne(reg, 1), 1), 'depois de π/2 está toda em B');
  hop(reg, Math.PI / 4);
  assert.ok(close(probabilityOne(reg, 0), 0.5));
  assert.ok(close(probabilityOne(reg, 0) + probabilityOne(reg, 1), 1));
  assert.ok(close(norm(reg), 1));
});

test('as frequências das medições seguem a regra de Born', () => {
  let open = 0;
  let seed = 7;
  const random = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
  for (let i = 0; i < 4000; i += 1) {
    const reg = createRegister(1);
    ry(reg, 0, 2 * Math.asin(Math.sqrt(0.3)));
    open += measure(reg, 0, random);
  }
  assert.ok(Math.abs(open / 4000 - 0.3) < 0.03, `${open / 4000}`);
});

test('o sistema de paredes: pares, evolução, Zeno e remoção', () => {
  const system = createWallQuantum({ random: () => 0 });
  addWalls(system, [{ key: 'a', offset: 0 }, { key: 'b', offset: 0 }, { key: 'c', offset: 0 }]);
  assert.equal(system.walls.get('a').partner, 'b');
  assert.equal(system.walls.get('c').partner, null);
  assert.ok(close(openProbability(system, 'b'), 1), 'θ=0: passagem toda em B');
  assert.ok(close(openProbability(system, 'c'), 0));

  evolveWalls(system, 1, new Set(['a']));
  assert.ok(close(openProbability(system, 'b'), 1), 'par observado não evolui (Zeno)');
  assert.ok(close(openProbability(system, 'c'), Math.sin(WALL_OMEGA / 2) ** 2), 'Rabi na parede sozinha');

  evolveWalls(system, 1);
  assert.ok(openProbability(system, 'a') > 0.4, 'a passagem foi para A');

  assert.equal(measureWall(system, 'a'), 1);
  assert.ok(close(openProbability(system, 'b'), 0));

  removeWall(system, 'a');
  assert.equal(system.walls.get('b').partner, null);
  assert.ok(close(openProbability(system, 'b'), 0));

  syncWalls(system, new Map([['b', 0], ['d', 1], ['e', 2]]));
  assert.ok(!system.walls.has('c'));
  assert.equal(system.walls.get('d').partner, 'e');
});

test('porta: amplitudes iniciais do hardware, evolução no anel e medição', async () => {
  const { createDoor, evolveDoor, doorProbabilities, measureDoor, doorDistributionFromCounts } = await import('../src/js/wall-quantum.js');
  const probs = doorDistributionFromCounts({ '000000000000': 6, '000000000001': 2, '000000000011': 2 }, 4);
  assert.deepEqual(probs, [0.6, 0.2, 0, 0.2]);
  const door = createDoor(probs);
  doorProbabilities(door).forEach((p, i) => assert.ok(close(p, probs[i]), 'medir no início dá a distribuição do hardware'));
  evolveDoor(door, 2);
  const after = doorProbabilities(door);
  assert.ok(close(after.reduce((a, b) => a + b, 0), 1));
  assert.ok(after.some((p, i) => Math.abs(p - probs[i]) > 0.01), 'o estado evolui');
  const index = measureDoor(door, () => 0.5);
  assert.ok(close(doorProbabilities(door)[index], 1), 'colapsou');
  evolveDoor(door, 5);
  assert.ok(close(doorProbabilities(door)[index], 1), 'medida não evolui mais');
  assert.equal(measureDoor(door, () => 0.99), index);

  const three = createDoor([0.5, 0.25, 0.25]);
  evolveDoor(three, 3);
  const p3 = doorProbabilities(three);
  assert.equal(p3.length, 3);
  assert.ok(close(p3.reduce((a, b) => a + b, 0), 1), 'com 3 posições a amplitude não vaza para a 4ª');
});

test('frequências de Born da porta batem com as do hardware', async () => {
  const { createDoor, measureDoor } = await import('../src/js/wall-quantum.js');
  const probs = [0.1, 0.4, 0.3, 0.2];
  const hits = [0, 0, 0, 0];
  let seed = 3;
  const random = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
  for (let i = 0; i < 4000; i += 1) hits[measureDoor(createDoor(probs), random)] += 1;
  hits.forEach((h, i) => assert.ok(Math.abs(h / 4000 - probs[i]) < 0.03, `${i}: ${h / 4000}`));
});
