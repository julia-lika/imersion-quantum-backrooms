import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  AGENT_MESSAGE,
  CAMPAIGN,
  difficulty,
  isEnraged,
  isFinalFloor,
  isHardFloor,
} from '../src/js/campaign.js';
import { advanceFloor, createGameState, markAgentFound, restoreGameState, serializeGameState } from '../src/js/game-state.js';
import { createSurvivalState, tickSurvival } from '../src/js/survival-state.js';

const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');

test('a campanha tem 5 andares normais, a agente no 5 e a fuga depois do 10', () => {
  assert.equal(CAMPAIGN.agentFloor, 5);
  assert.equal(CAMPAIGN.finalFloor, 10);
  [1, 2, 3, 4, 5].forEach((floor) => assert.equal(isHardFloor(floor), false));
  [6, 7, 8, 9, 10].forEach((floor) => assert.equal(isHardFloor(floor), true));
  assert.equal(isFinalFloor(9), false);
  assert.equal(isFinalFloor(10), true);
  assert.match(AGENT_MESSAGE, /NÃO QUERIA QUE VOCÊ A ENCONTRASSE[\s\S]*FURIOSA[\s\S]*CORRA/);
});

test('a entidade só fica furiosa depois de achar a agente', () => {
  assert.equal(isEnraged(5, false), false);
  assert.equal(isEnraged(5, true), true);
  assert.equal(isEnraged(8, true), true);
  assert.equal(difficulty(3, false).enraged, false);
  assert.equal(difficulty(3, false).drainMultiplier, 1);
});

test('furiosa, a entidade anda mais rápido e a sanidade cai mais, piorando até o andar 10', () => {
  const normal = difficulty(4, false);
  const first = difficulty(6, true);
  const last = difficulty(10, true);

  assert.ok(first.huntMs < normal.huntMs && first.chaseMs < normal.chaseMs);
  assert.ok(last.huntMs < first.huntMs && last.chaseMs < first.chaseMs);
  assert.ok(first.drainMultiplier >= 2.5);
  assert.ok(last.drainMultiplier > first.drainMultiplier);
  // Ainda dá para fugir: caçando, ela não passa da velocidade de caminhada (~2,2 m/s).
  assert.ok(1.05 / (last.huntMs / 1000) <= 2.25);
});

test('o multiplicador acelera a queda contínua, mas não o contato', () => {
  const state = createSurvivalState();
  const calm = tickSurvival(state, 100, { dt: 10, floor: 6 });
  const hard = tickSurvival(state, 100, { dt: 10, floor: 6, drainMultiplier: 3 });
  assert.ok(Math.abs((100 - hard.sanity) - 3 * (100 - calm.sanity)) < 1e-9);

  const touch = tickSurvival(state, 100, { dt: 0.1, floor: 6, ghostDistance: 0.2 });
  const touchHard = tickSurvival(state, 100, { dt: 0.1, floor: 6, ghostDistance: 0.2, drainMultiplier: 3 });
  assert.ok(touchHard.sanity < touch.sanity);
  assert.ok(touch.sanity - touchHard.sanity < 1);
});

test('achar a agente fica no save e passa para os andares seguintes', () => {
  let state = markAgentFound(createGameState('010110101100', 5));
  state = advanceFloor(state, '111000111000');
  assert.equal(state.floor, 6);
  assert.equal(state.agentFound, true);
  assert.equal(restoreGameState(serializeGameState(state)).agentFound, true);
  assert.equal(createGameState('010110101100', 1).agentFound, false);
});

test('o jogo carrega o corpo da agente e liga a campanha só no modo solo', () => {
  const html = read('src/index.html');
  const glb = readFileSync(new URL('src/assets/models/dead-hazmat-agent.glb', root));
  const json = JSON.parse(glb.subarray(20, 20 + glb.readUInt32LE(12)).toString('utf8'));
  // O three.js do A-Frame 1.8 não lê specular-glossiness: o GLB não pode exigir extensões.
  assert.equal((json.extensionsRequired || []).length, 0);
  assert.ok(glb.length < 2.5 * 1024 * 1024);
  assert.match(html, /id="dead-agent-model" src="assets\/models\/dead-hazmat-agent\.glb"/);
  assert.match(html, /dead-agent="player: #player-head"/);
  assert.match(html, /id="enraged-tint"/);
  assert.match(html, /id="scare-overlay"/);

  const phase = read('src/js/phase-zero.js');
  assert.match(phase, /function soloCampaign\(\) \{\s*return !coop\(\) && !operatorMode\(\);/);
  assert.match(read('src/js/components/quantum-ghost.js'), /shared\.difficulty/);
  assert.match(read('src/js/components/vr-effects.js'), /difficulty\?\.enraged/);
});
