import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';

const dir = new URL('../src/js/components/', import.meta.url);

// O A-Frame avalia getters da definição ao registrar o componente, quando `this.el`
// ainda não existe: o registro lança TypeError e o componente nunca funciona.
test('nenhum componente A-Frame define getters/setters na definição', () => {
  const offenders = [];

  readdirSync(dir).filter((name) => name.endsWith('.js')).forEach((name) => {
    readFileSync(new URL(name, dir), 'utf8').split('\n').forEach((line, index) => {
      if (/^\s+(get|set) \w+\(/.test(line)) offenders.push(`${name}:${index + 1}`);
    });
  });

  assert.deepEqual(offenders, []);
});
