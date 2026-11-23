import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const indexHtml = readFileSync(new URL('site/index.html', root), 'utf8');
const quantumMap = readFileSync(
  new URL('site/js/components/quantum-map.js', root),
  'utf8'
);
const floorTransition = readFileSync(
  new URL('site/js/components/floor-transition.js', root),
  'utf8'
);
const stairsSection = quantumMap.slice(
  quantumMap.indexOf('  addStairs('),
  quantumMap.indexOf('  createMaterials(')
);

test('usa a porta amarela animada como saída sem alterar o gatilho de fase', () => {
  assert.ok(
    existsSync(new URL('site/assets/models/door-yellow.glb', root)),
    'o modelo door-yellow.glb deve existir nos assets locais'
  );
  assert.match(
    indexHtml,
    /<a-asset-item\s+id="door-yellow-model"\s+src="assets\/models\/door-yellow\.glb"><\/a-asset-item>/
  );
  assert.match(indexHtml, /aframe-extras/);
  assert.match(quantumMap, /gltf-model["']?,\s*["']#door-yellow-model/);
  // Clipe "open" controlado à mão: abre ao chegar perto e fecha ao se afastar.
  assert.match(quantumMap, /item\.name === 'open'/);
  assert.match(quantumMap, /this\.state = 'closing'/);
  assert.match(quantumMap, /id["']?,\s*["']stairs-trigger/);
  assert.match(quantumMap, /floor-transition["']?,\s*["']target: #player-head; radius: 0\.75/);
  assert.match(floorTransition, /stairs-reached/);
  assert.doesNotMatch(stairsSection, /marker/);
});
