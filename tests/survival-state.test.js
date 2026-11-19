import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SURVIVAL,
  attemptPhaseShift,
  createSurvivalState,
  drinkAlmondWater,
  tickSurvival,
  toggleVisor,
} from '../site/js/survival-state.js';

test('a sanidade cai mais rápido em andares mais profundos', () => {
  const state = createSurvivalState();
  const shallow = tickSurvival(state, 100, { dt: 10, floor: 1 });
  const deep = tickSurvival(state, 100, { dt: 10, floor: 5 });

  assert.ok(shallow.sanity < 100);
  assert.ok(deep.sanity < shallow.sanity);
});

test('o visor consome energia e desliga sozinho quando a bateria acaba', () => {
  const state = toggleVisor(createSurvivalState());
  const result = tickSurvival(state, 100, { dt: 100 / SURVIVAL.visorDrain + 1 });

  assert.equal(state.visor, true);
  assert.equal(result.state.visor, false);
  assert.equal(result.state.energy, 0);
  assert.deepEqual(result.events, ['visor-depleted']);
  assert.equal(toggleVisor(result.state).visor, false);
});

test('encarar o fantasma por tempo demais causa um golpe de sanidade', () => {
  const state = { ...createSurvivalState(), exposure: SURVIVAL.exposureTime - 0.1 };
  const result = tickSurvival(state, 80, { dt: 0.2, ghostDistance: 2, ghostInView: true });

  assert.ok(result.events.includes('ghost-strike'));
  assert.ok(result.sanity < 80 - SURVIVAL.ghostStrikeDamage + 1);
  assert.equal(result.state.exposure, 0);
});

test('cobrir os olhos impede a exposição ao fantasma', () => {
  const state = { ...createSurvivalState(), eyesCovered: true, exposure: 3 };
  const result = tickSurvival(state, 80, { dt: 1, ghostDistance: 2, ghostInView: true });

  assert.ok(result.state.exposure < 3);
  assert.equal(result.events.includes('ghost-strike'), false);
});

test('phase shift custa energia e sanidade e respeita a chance de sucesso', () => {
  const state = createSurvivalState();
  const success = attemptPhaseShift(state, 50, () => 0.5);
  const failure = attemptPhaseShift(state, 50, () => 0.99);

  assert.equal(success.allowed, true);
  assert.equal(success.success, true);
  assert.equal(failure.success, false);
  assert.equal(success.state.energy, 100 - SURVIVAL.phaseEnergyCost);
  assert.equal(success.sanity, 50 - SURVIVAL.phaseSanityCost);
});

test('phase shift é bloqueado sem energia suficiente', () => {
  const result = attemptPhaseShift({ ...createSurvivalState(), energy: 10 }, 50);

  assert.equal(result.allowed, false);
  assert.equal(result.sanity, 50);
});

test('almond water restaura sanidade e energia sem passar de 100', () => {
  const result = drinkAlmondWater({ ...createSurvivalState(), energy: 70 }, 30);

  assert.equal(result.sanity, 70);
  assert.equal(result.state.energy, 100);
});

test('chegar a zero de sanidade emite o evento de perda', () => {
  const result = tickSurvival(createSurvivalState(), 0.05, { dt: 1 });

  assert.equal(result.sanity, 0);
  assert.ok(result.events.includes('sanity-lost'));
});
