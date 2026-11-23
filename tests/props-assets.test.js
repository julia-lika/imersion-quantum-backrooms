import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');
const indexHtml = read('site/index.html');

test('a Almond Water usa o modelo GLB leve', () => {
  const model = new URL('site/assets/models/almond-water.glb', root);
  assert.ok(existsSync(model));
  assert.ok(statSync(model).size < 400 * 1024);
  assert.match(indexHtml, /id="almond-water-model" src="assets\/models\/almond-water\.glb"/);
  assert.match(read('site/js/components/quantum-map.js'), /gltf-model['"],\s*['"]#almond-water-model/);
});

test('estender a mão até a Almond Water segura a garrafa, como no QPS', () => {
  const gestures = read('site/js/components/hand-gestures.js');
  assert.match(gestures, /almond-water['"][^\n]*\n\s*this\.grab\(side, item, 'touch'\)/);
  assert.match(gestures, /grabMode\[side\] === 'touch'\) return;/);
});

test('as peças do PSX Liminal Kit e o atlas delas estão nos assets', () => {
  ['psx-exit-sign', 'psx-vent', 'psx-door-nowhere'].forEach((name) => {
    assert.ok(existsSync(new URL(`site/assets/models/${name}.glb`, root)), name);
    assert.match(indexHtml, new RegExp(`id="${name}-model" src="assets/models/${name}\\.glb"`));
  });
  // O atlas vem embutido: com a textura externa, várias cópias do mesmo GLB
  // ficavam pretas no navegador (inclusive a porta amarela).
  ['psx-exit-sign', 'psx-vent', 'psx-door-nowhere', 'door-yellow'].forEach((name) => {
    const glb = readFileSync(new URL(`site/assets/models/${name}.glb`, root));
    const json = JSON.parse(glb.subarray(20, 20 + glb.readUInt32LE(12)).toString('utf8'));
    assert.ok(json.images.every((image) => image.bufferView !== undefined && !image.uri), name);
  });
});

test('a entidade sempre persegue o jogador', () => {
  const ghost = read('site/js/components/quantum-ghost.js');
  assert.doesNotMatch(ghost, /WANDER_INTERVAL_MS/);
  assert.match(ghost, /nextStepToward\(world\.maze, this\.cell, player\)/);
});
