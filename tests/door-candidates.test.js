import test from 'node:test';
import assert from 'node:assert/strict';
import { generateQuantumMap, pickDoorCandidate, DOOR_CANDIDATES } from '../src/js/map-generator.js';

const bits = (n) => n.toString(2).padStart(12, '0');

test('cada andar tem várias posições possíveis para a porta, afastadas e livres', () => {
  for (let n = 0; n < 4096; n += 211) {
    const map = generateQuantumMap(bits(n));
    const { doorCandidates: doors } = map;
    assert.ok(doors.length >= 2 && doors.length <= DOOR_CANDIDATES, `${bits(n)}: ${doors.length}`);
    doors.forEach((door) => assert.equal(map.maze[door.z][door.x], '.'));
    for (let i = 0; i < doors.length; i += 1) {
      for (let j = i + 1; j < doors.length; j += 1) {
        assert.ok(Math.abs(doors[i].x - doors[j].x) + Math.abs(doors[i].z - doors[j].z) >= 4);
      }
    }
  }
});

test('a medição escolhe a posição da porta pelo bitstring medido', () => {
  const { doorCandidates: doors } = generateQuantumMap('010110101100');
  const seen = new Set();
  for (let n = 0; n < 64; n += 1) {
    const picked = pickDoorCandidate(doors, bits(n));
    assert.equal(picked.cell, doors[picked.index]);
    assert.deepEqual(pickDoorCandidate(doors, bits(n)), picked);
    seen.add(picked.index);
  }
  assert.equal(seen.size, doors.length);
});
