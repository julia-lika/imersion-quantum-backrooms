// Campanha do modo solo: 5 andares normais, a agente morta no fim do 5º e mais
// 5 andares difíceis (a entidade fica furiosa). Depois do 10º, o jogador escapa.
// O duo não usa nada disto: lá o operador é dono do andar.
export const CAMPAIGN = {
  agentFloor: 5,
  lastNormalFloor: 5,
  finalFloor: 10,
  // Recomeço quando a sanidade zera depois de achar a agente.
  hardRestartFloor: 6,
  // Distância (em metros, no chão) para "achar" o corpo.
  agentFoundRadius: 1.5,
};

export const AGENT_MESSAGE = 'A ENTIDADE NÃO QUERIA QUE VOCÊ A ENCONTRASSE.\nAGORA ELA ESTÁ FURIOSA.\nCORRA.';

// Ritmo normal da entidade (o mesmo de antes da campanha).
const NORMAL_PACE = { chaseMs: 900, huntMs: 650, huntRadius: 5 };

// A entidade está furiosa quando a agente já foi achada (no resto do andar 5 e
// em todos os andares difíceis).
export function isEnraged(floor, agentFound) {
  return Boolean(agentFound) && floor >= CAMPAIGN.agentFloor;
}

export function isHardFloor(floor) {
  return floor > CAMPAIGN.lastNormalFloor;
}

// Quanto o andar difícil já avançou: 0 no fim do andar 5 / andar 6, 1 no andar 10.
function hardProgress(floor) {
  const span = CAMPAIGN.finalFloor - CAMPAIGN.hardRestartFloor;
  return Math.min(1, Math.max(0, (floor - CAMPAIGN.hardRestartFloor) / span));
}

// Dificuldade do andar: ritmo da entidade e multiplicador da queda de sanidade.
// Uma célula tem 1,05 m: caçando, a entidade normal anda ~1,6 m/s; furiosa,
// ~2,0 m/s no andar 6 e ~2,2 m/s no andar 10 (o jogador anda a ~2,2 m/s e
// corre mais rápido no desktop). Ainda dá para fugir, mas não dá para parar.
export function difficulty(floor, agentFound) {
  if (!isEnraged(floor, agentFound)) {
    return { enraged: false, drainMultiplier: 1, ...NORMAL_PACE };
  }

  const t = hardProgress(floor);
  return {
    enraged: true,
    // Sanidade cai de 1,5x (andar 6) a 2,5x (andar 10) mais rápido.
    drainMultiplier: 1.5 + 1 * t,
    chaseMs: Math.round(640 - 60 * t),
    huntMs: Math.round(520 - 45 * t),
    huntRadius: 8,
  };
}

export function isFinalFloor(floor) {
  return floor >= CAMPAIGN.finalFloor;
}
