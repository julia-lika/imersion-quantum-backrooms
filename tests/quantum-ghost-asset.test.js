import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const indexHtml = readFileSync(new URL('src/index.html', root), 'utf8');
const ghostComponent = readFileSync(
  new URL('src/js/components/quantum-ghost.js', root),
  'utf8'
);

test('usa o modelo Bacteria como visual do fantasma', () => {
  assert.ok(
    existsSync(new URL('src/assets/models/bacteria-backrooms.glb', root)),
    'o modelo bacteria-backrooms.glb deve existir nos assets locais'
  );
  assert.match(
    indexHtml,
    /<a-asset-item\s+id="bacteria-model"\s+src="assets\/models\/bacteria-backrooms\.glb"><\/a-asset-item>/
  );
  assert.match(ghostComponent, /gltf-model["']?,\s*["']#bacteria-model/);
  assert.match(ghostComponent, /model-loaded/);
  assert.match(ghostComponent, /traverse\(/);
  assert.match(ghostComponent, /material\.opacity\s*=\s*1/);
  assert.match(ghostComponent, /material\.transparent\s*=\s*false/);
  assert.match(ghostComponent, /material\.depthWrite\s*=\s*true/);
  assert.match(ghostComponent, /material\.emissiveIntensity/);
});
