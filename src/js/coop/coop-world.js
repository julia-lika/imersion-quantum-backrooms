// Modo cooperativo assimétrico: o estado do mundo que o OPERADOR (desktop,
// host) controla e manda para o EXPLORADOR (VR).
//
// O operador é dono do andar: a string medida, o labirinto, a decoerência, as
// armadilhas e a porta. O explorador só manda de volta onde está, para onde
// olha e onde está a entidade. Nada aqui toca no DOM: o mesmo código roda no
// navegador do operador e nos testes (node --test).
//
// Diferença para o jogo solo: aqui as paredes podem fechar de verdade em volta
// do explorador. Antes, o operador recebe um aviso com contagem regressiva
// ("B3 colapsa em 6 s") que o explorador não vê. Quem fica preso sai com o
// Salto de Fase (atravessa a parede, gasta energia) ou quando o operador mede
// de novo (efeito Zeno: o QPS fixa o trecho e desfaz a jaula).
import { generateQuantumMap, pickDoorCandidate } from '../map-generator.js';
import { findSuperposedWalls, pickFloorCells } from '../maze-physics.js';
import {
  NEAR_CELLS,
  UNOBSERVED_MS,
  SHIFT_COOLDOWN_MS,
  distanceToSector,
  isSectorObserved,
  pickSectorSuperposed,
  reshuffleSector,
} from '../decoherence.js';
import { listRegions } from '../qubit-regions.js';

export const COOP = {
  // Aviso que só o operador vê antes de um trecho se reorganizar.
  ambientWarnMs: 5000,
  // Aviso antes de uma armadilha (o trecho onde o explorador está colapsa).
  trapWarnMs: 7000,
  firstTrapMs: 30000,
  trapMinGapMs: 25000,
  trapMaxGapMs: 40000,
  // Raio da medição do QPS do operador, em células, em volta do explorador.
  qpsRadius: 4,
  // Os olhos do explorador medem a porta quando chegam perto de uma posição possível.
  eyesRadius: 2,
  measureCooldownMs: 20000,
  // Quanto tempo o explorador precisa ficar fora da jaula (Salto de Fase) para ela sumir.
  escapeReleaseMs: 1500,
  // Na hora de descer, o explorador precisa estar perto da porta medida.
  stairsRadius: 2.5,
};

const COLUMN_LETTERS = 'ABC';

export function regionLabel(region) {
  return `${COLUMN_LETTERS[region.col] ?? '?'}${region.row + 1}`;
}

function key(x, z) {
  return `${x},${z}`;
}

function cloneMaze(maze) {
  return maze.map((row) => [...row]);
}

// Região onde a célula está; numa linha de fronteira (passagem entre duas
// regiões), a região mais próxima.
export function nearestRegion(regions, x, z) {
  let best = null;
  regions.forEach((region) => {
    const distance = distanceToSector(region, x, z);
    if (!best || distance < best.distance) best = { region, distance };
  });
  return best?.region || null;
}

export function createCoopWorld({
  drawBits = () => '010110101100',
  random = Math.random,
  now = 0,
  floor = 1,
} = {}) {
  const world = {
    floor: 1,
    bitstring: '',
    maze: [],
    size: 0,
    superposed: new Map(),
    regions: [],
    doorCandidates: [],
    itemCells: [],
    door: -1,
    doorBits: null,
    measured: false,
    explorer: null,
    ghost: null,
    lastSeen: {},
    lastShift: now,
    pending: [],
    cage: null,
    shifts: 0,
    nextTrapAt: now + COOP.firstTrapMs,
    lastMeasureAt: -Infinity,
    version: 0,
  };

  function bump() {
    world.version += 1;
  }

  function loadFloor(nextFloor, bits, at) {
    const map = generateQuantumMap(bits);
    world.floor = nextFloor;
    world.bitstring = map.bitstring;
    world.maze = cloneMaze(map.maze);
    world.size = world.maze.length;
    world.superposed = new Map(findSuperposedWalls(map.maze, map.bitstring).map(({ x, z, offset }) => [key(x, z), offset]));
    world.regions = listRegions(world.size).map((region) => ({
      ...region,
      label: regionLabel(region),
      bit: map.bitstring[region.qubit],
    }));
    world.doorCandidates = map.doorCandidates || [];
    // As mesmas células onde o jogo do explorador põe a Água de Amêndoa.
    world.itemCells = pickFloorCells(map.maze, map.bitstring, 3, [
      { x: 1, z: 1 }, { x: 2, z: 1 }, { x: 1, z: 2 }, map.stairs,
    ]).slice(1);
    world.door = -1;
    world.doorBits = null;
    world.measured = false;
    world.lastSeen = Object.fromEntries(world.regions.map((region) => [region.id, at]));
    world.lastShift = at;
    world.pending = [];
    world.cage = null;
    world.shifts = 0;
    world.nextTrapAt = at + COOP.firstTrapMs;
    world.lastMeasureAt = -Infinity;
    bump();
  }

  function explorerCell() {
    if (!world.explorer) return null;
    return { x: Math.round(world.explorer.x), z: Math.round(world.explorer.z) };
  }

  function observeOptions() {
    return { transparent: (x, z) => world.superposed.has(key(x, z)), near: NEAR_CELLS };
  }

  function protectedCells() {
    const cells = [];
    const doors = world.measured ? [world.doorCandidates[world.door]] : world.doorCandidates;
    doors.forEach((door) => door && cells.push({ x: door.x, z: door.z }));
    world.itemCells.forEach((cell) => cell && cells.push(cell));
    if (world.ghost) cells.push({ x: Math.round(world.ghost.x), z: Math.round(world.ghost.z) });
    const here = explorerCell();
    if (here) {
      // A célula do explorador e as vizinhas: compensa o atraso da rede.
      for (let dz = -1; dz <= 1; dz += 1) {
        for (let dx = -1; dx <= 1; dx += 1) cells.push({ x: here.x + dx, z: here.z + dz });
      }
    }
    return cells;
  }

  function reshuffle(region) {
    const bits = drawBits(world.floor) || world.bitstring;
    const changed = reshuffleSector(world.maze, region, bits, {
      protectedCells: protectedCells(),
      salt: world.shifts + 1,
    });
    world.shifts += 1;
    region.bit = String(bits)[region.qubit];
    // Troca as paredes em superposição do setor.
    [...world.superposed.keys()].forEach((cellKey) => {
      const [x, z] = cellKey.split(',').map(Number);
      if (x >= region.minX && x <= region.maxX && z >= region.minZ && z <= region.maxZ) world.superposed.delete(cellKey);
    });
    pickSectorSuperposed(world.maze, region, bits, 1).forEach(({ x, z, offset }) => world.superposed.set(key(x, z), offset));
    bump();
    return changed.length;
  }

  // Jaula 3x3 em volta do explorador: o anel a 2 células vira parede (1 célula
  // de espessura, dá para atravessar com o Salto de Fase).
  function buildCage(center) {
    const doors = new Set(world.doorCandidates.map((door) => key(door.x, door.z)));
    const cells = [];
    for (let dz = -2; dz <= 2; dz += 1) {
      for (let dx = -2; dx <= 2; dx += 1) {
        const x = center.x + dx;
        const z = center.z + dz;
        if (x <= 0 || z <= 0 || x >= world.size - 1 || z >= world.size - 1) continue;
        const ring = Math.max(Math.abs(dx), Math.abs(dz)) === 2;
        if (ring && doors.has(key(x, z))) continue;
        const value = ring ? '#' : '.';
        const superposed = world.superposed.get(key(x, z));
        cells.push({ x, z, prev: world.maze[z][x], value, superposed });
        world.maze[z][x] = value;
        world.superposed.delete(key(x, z));
      }
    }
    bump();
    return cells;
  }

  function releaseCage() {
    if (!world.cage) return false;
    world.cage.cells.forEach(({ x, z, prev, value, superposed }) => {
      if (world.maze[z][x] === value) world.maze[z][x] = prev;
      if (superposed !== undefined) world.superposed.set(key(x, z), superposed);
    });
    world.cage = null;
    world.nextTrapAt = Math.max(world.nextTrapAt, world.lastNow + gap());
    bump();
    return true;
  }

  function gap() {
    return COOP.trapMinGapMs + random() * (COOP.trapMaxGapMs - COOP.trapMinGapMs);
  }

  function regionById(id) {
    return world.regions.find((region) => region.id === id);
  }

  function explorerInside(region, margin = 0.5) {
    if (!world.explorer) return false;
    return distanceToSector(region, world.explorer.x, world.explorer.z) <= margin;
  }

  function collapseDoor(events) {
    if (world.measured || !world.doorCandidates.length) return;
    const bits = drawBits(world.floor) || world.bitstring;
    const picked = pickDoorCandidate(world.doorCandidates, bits);
    world.door = picked.index;
    world.doorBits = bits;
    world.measured = true;
    bump();
    events.push({ type: 'door', index: picked.index, total: world.doorCandidates.length, cell: picked.cell, bits });
  }

  function doorInRange(radius) {
    if (!world.explorer) return false;
    return world.doorCandidates.some((door) => Math.hypot(world.explorer.x - door.x, world.explorer.z - door.z) <= radius);
  }

  loadFloor(floor, drawBits(floor) || '010110101100', now);

  const api = {
    get state() {
      return world;
    },

    // Explorador: posição em células (com fração), direção do olhar e entidade.
    setExplorer(explorer, ghost = null) {
      world.explorer = explorer;
      world.ghost = ghost;
    },

    update(at) {
      world.lastNow = at;
      const events = [];
      const viewer = world.explorer;
      if (!viewer) return events;

      const options = observeOptions();
      world.regions.forEach((region) => {
        if (isSectorObserved(world.maze, region, viewer, options)) world.lastSeen[region.id] = at;
      });

      // Olhos do explorador: chegar perto de uma posição possível mede a porta.
      if (!world.measured && doorInRange(COOP.eyesRadius)) collapseDoor(events);

      // Avisos vencidos: o trecho colapsa agora.
      world.pending.filter((item) => item.at <= at).forEach((item) => {
        world.pending = world.pending.filter((other) => other !== item);
        const region = regionById(item.regionId);
        if (!region) return;
        if (item.trap) {
          const inside = explorerInside(region);
          const changed = reshuffle(region);
          world.lastSeen[region.id] = at;
          world.lastShift = at;
          if (inside) {
            const center = explorerCell();
            world.cage = { cells: buildCage(center), center, regionId: region.id, since: at, outsideSince: null };
            events.push({ type: 'trapped', label: region.label, changed });
          } else {
            world.nextTrapAt = at + gap();
            events.push({ type: 'dodged', label: region.label, changed });
          }
          return;
        }
        // Decoerência comum: continua sem mudar diante dos olhos do explorador.
        if (isSectorObserved(world.maze, region, viewer, options)) {
          events.push({ type: 'cancelled', label: region.label, reason: 'observed' });
          return;
        }
        const changed = reshuffle(region);
        world.lastSeen[region.id] = at;
        world.lastShift = at;
        events.push({ type: 'collapse', label: region.label, changed });
      });

      // Jaula: se o explorador saiu dela (Salto de Fase), ela se desfaz.
      if (world.cage) {
        const here = explorerCell();
        const out = Math.max(Math.abs(here.x - world.cage.center.x), Math.abs(here.z - world.cage.center.z)) >= 2;
        if (!out) world.cage.outsideSince = null;
        else if (world.cage.outsideSince == null) world.cage.outsideSince = at;
        else if (at - world.cage.outsideSince >= COOP.escapeReleaseMs) {
          releaseCage();
          events.push({ type: 'released', reason: 'escaped' });
        }
      }

      const busy = world.cage || world.pending.length;
      // Armadilha: o trecho onde o explorador está vai colapsar.
      if (!busy && at >= world.nextTrapAt) {
        const region = nearestRegion(world.regions, viewer.x, viewer.z);
        if (region) {
          world.pending.push({ regionId: region.id, label: region.label, at: at + COOP.trapWarnMs, trap: true, since: at });
          events.push({ type: 'warn', label: region.label, trap: true, ms: COOP.trapWarnMs });
        }
      } else if (!busy && at - world.lastShift >= SHIFT_COOLDOWN_MS) {
        // Decoerência comum: o trecho mais esquecido, com aviso para o operador.
        const region = world.regions
          .filter((candidate) => at - world.lastSeen[candidate.id] >= UNOBSERVED_MS)
          .filter((candidate) => !isSectorObserved(world.maze, candidate, viewer, options))
          .sort((a, b) => world.lastSeen[a.id] - world.lastSeen[b.id])[0];
        if (region) {
          world.pending.push({ regionId: region.id, label: region.label, at: at + COOP.ambientWarnMs, trap: false, since: at });
          world.lastShift = at;
          events.push({ type: 'warn', label: region.label, trap: false, ms: COOP.ambientWarnMs });
        }
      }
      return events;
    },

    // O explorador entrou (ou voltou) no andar: os relógios recomeçam, para a
    // primeira armadilha não cair assim que ele chega.
    startClock(at) {
      world.regions.forEach((region) => { world.lastSeen[region.id] = at; });
      world.lastShift = at;
      world.pending = [];
      if (!world.cage) world.nextTrapAt = at + COOP.firstTrapMs;
    },

    measureCooldown(at) {
      return Math.max(0, COOP.measureCooldownMs - (at - world.lastMeasureAt));
    },

    // Operador aperta MEDIR: o QPS mede tudo no raio em volta do explorador.
    measure(at) {
      const events = [];
      if (!world.explorer || api.measureCooldown(at) > 0) return { ok: false, events };
      world.lastMeasureAt = at;
      world.lastNow = at;
      const { x, z } = world.explorer;
      const frozen = world.regions.filter((region) => distanceToSector(region, x, z) <= COOP.qpsRadius);
      frozen.forEach((region) => { world.lastSeen[region.id] = at; });
      const ids = new Set(frozen.map((region) => region.id));
      world.pending = world.pending.filter((item) => {
        if (!ids.has(item.regionId)) return true;
        if (item.trap) world.nextTrapAt = at + gap();
        events.push({ type: 'cancelled', label: item.label, reason: 'measured', trap: item.trap });
        return false;
      });
      if (releaseCage()) events.push({ type: 'released', reason: 'measured' });
      if (!world.measured && doorInRange(COOP.qpsRadius)) collapseDoor(events);
      events.push({ type: 'measured', regions: frozen.map((region) => region.label) });
      return { ok: true, events };
    },

    // O explorador chegou na porta: o operador confere e sorteia o próximo andar.
    nextFloor(at) {
      if (!world.measured || !world.explorer) return false;
      const door = world.doorCandidates[world.door];
      if (!door || Math.hypot(world.explorer.x - door.x, world.explorer.z - door.z) > COOP.stairsRadius) return false;
      loadFloor(world.floor + 1, drawBits(world.floor + 1) || '010110101100', at);
      world.explorer = null;
      return true;
    },

    // Sanidade zerada: de volta ao andar 1.
    restart(at) {
      loadFloor(1, drawBits(1) || '010110101100', at);
      world.explorer = null;
    },

    // O que vai pela rede: o labirinto inteiro (23 x 23 caracteres) é pequeno o
    // bastante para mandar a cada mudança, sem risco de os dois lados divergirem.
    snapshot() {
      return {
        floor: world.floor,
        bits: world.bitstring,
        maze: world.maze.map((row) => row.join('')),
        superposed: [...world.superposed.entries()].map(([cellKey, offset]) => {
          const [x, z] = cellKey.split(',').map(Number);
          return { x, z, offset };
        }),
        regionBits: world.regions.map((region) => region.bit).join(''),
        door: world.door,
        doorBits: world.doorBits,
        caged: Boolean(world.cage),
        version: world.version,
      };
    },
  };
  return api;
}
