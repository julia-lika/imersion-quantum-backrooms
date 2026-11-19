import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const indexHtml = readFileSync(
  new URL('../site/index.html', import.meta.url),
  'utf8'
);

test('carrega o mapa depois do componente de textura das paredes', () => {
  const wallScript = indexHtml.match(
    /<script\s+type="module"\s+src="js\/components\/backrooms-wall\.js"><\/script>/
  );
  const mapScript = indexHtml.match(
    /<script\s+type="module"\s+src="js\/components\/quantum-map\.js(?:\?[^\"]+)?"><\/script>/
  );

  assert.ok(wallScript, 'backrooms-wall deve ser carregado como módulo');
  assert.ok(mapScript, 'quantum-map deve esperar os módulos de componentes');
  assert.ok(
    wallScript.index < mapScript.index,
    'backrooms-wall deve ser registrado antes de quantum-map'
  );
});
