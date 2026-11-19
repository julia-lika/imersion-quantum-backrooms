// Valores inspirados nas constantes do Quantum Backrooms da Moth (sanidade em %/s).
export const SURVIVAL = {
  ambientDrain: 0.12,
  ambientDrainPerFloor: 0.025,
  ghostRadiationDrain: 1.5,
  ghostContactRadiusCells: 0.65,
  ghostContactDrainPerSecond: 35,
  visorDrain: 6,
  energyRecovery: 0.8,
  visorMinEnergy: 5,
  phaseEnergyCost: 25,
  phaseSanityCost: 3,
  phaseBaseSuccess: 0.92,
  almondWaterRestore: 40,
  exposureRadiusCells: 3,
  exposureTime: 7,
  exposureDecay: 0.5,
  ghostStrikeDamage: 15,
};

function clamp(value, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value));
}

export function createSurvivalState() {
  return {
    energy: 100,
    visor: false,
    exposure: 0,
    eyesCovered: false,
  };
}

export function toggleVisor(state) {
  if (!state.visor && state.energy < SURVIVAL.visorMinEnergy) return state;
  return { ...state, visor: !state.visor };
}

export function tickSurvival(state, sanity, {
  dt,
  floor = 1,
  ghostDistance = Infinity,
  ghostInView = false,
}) {
  const events = [];
  let energy = state.visor
    ? state.energy - SURVIVAL.visorDrain * dt
    : state.energy + SURVIVAL.energyRecovery * dt;
  let visor = state.visor;

  if (visor && energy <= 0) {
    visor = false;
    events.push('visor-depleted');
  }
  energy = clamp(energy);

  let drain = SURVIVAL.ambientDrain + SURVIVAL.ambientDrainPerFloor * (floor - 1);
  if (ghostDistance <= 1) drain += SURVIVAL.ghostRadiationDrain;
  if (ghostDistance <= SURVIVAL.ghostContactRadiusCells) {
    drain += SURVIVAL.ghostContactDrainPerSecond;
  }
  let nextSanity = sanity - drain * dt;

  // Olhar para a entidade acumula exposição; cobrir os olhos com as mãos protege.
  const exposed = ghostInView && !state.eyesCovered && ghostDistance <= SURVIVAL.exposureRadiusCells;
  let exposure = exposed
    ? state.exposure + dt
    : state.exposure - SURVIVAL.exposureDecay * dt;

  if (exposure >= SURVIVAL.exposureTime) {
    exposure = 0;
    nextSanity -= SURVIVAL.ghostStrikeDamage;
    events.push('ghost-strike');
  }

  nextSanity = clamp(nextSanity);
  if (nextSanity === 0 && sanity > 0) events.push('sanity-lost');

  return {
    state: { ...state, energy, visor, exposure: Math.max(0, exposure) },
    sanity: nextSanity,
    events,
  };
}

export function attemptPhaseShift(state, sanity, random = Math.random) {
  if (state.energy < SURVIVAL.phaseEnergyCost || sanity <= SURVIVAL.phaseSanityCost) {
    return { allowed: false, success: false, state, sanity };
  }

  return {
    allowed: true,
    success: random() < SURVIVAL.phaseBaseSuccess,
    state: { ...state, energy: state.energy - SURVIVAL.phaseEnergyCost },
    sanity: sanity - SURVIVAL.phaseSanityCost,
  };
}

export function drinkAlmondWater(state, sanity) {
  return {
    state: { ...state, energy: clamp(state.energy + SURVIVAL.almondWaterRestore) },
    sanity: clamp(sanity + SURVIVAL.almondWaterRestore),
  };
}
