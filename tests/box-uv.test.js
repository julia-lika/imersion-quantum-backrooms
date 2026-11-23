import test from 'node:test';
import assert from 'node:assert/strict';
import { getBoxFaceUvScales } from '../src/js/components/box-uv.js';

test('mapeia cada face do cubo usando suas dimensões reais', () => {
  assert.deepEqual(
    getBoxFaceUvScales({ width: 2, height: 3, depth: 1, textureScale: 1 }),
    [
      [1, 3],
      [1, 3],
      [2, 1],
      [2, 1],
      [2, 3],
      [2, 3],
    ]
  );
});

test('mantém a proporção da textura em uma parede alta', () => {
  const [[sideU, sideV]] = getBoxFaceUvScales({
    width: 1.08,
    height: 4.7,
    depth: 1.08,
    textureScale: 1,
  });

  assert.equal(sideU / sideV, 1.08 / 4.7);
});
