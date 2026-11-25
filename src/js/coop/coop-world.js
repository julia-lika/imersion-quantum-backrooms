// Modo duo (cooperativo assimétrico): o estado do mundo que o OPERADOR
// (desktop, host) controla e manda para o EXPLORADOR (VR ou desktop).
//
// No modo solo o labirinto é quântico (bitstring medido, decoerência, porta em
// superposição). No duo não: quem mexe nas paredes é uma IA ADVERSÁRIA. Ela
// acompanha o explorador, calcula o caminho mais curto dele até a porta e fecha
// um trecho desse caminho para forçar desvios. De vez em quando tenta
// encurralar: fecha um anel de paredes em volta dele. O operador vê cada jogada
// com alguns segundos de antecedência (o explorador não vê) e joga contra a IA:
// tira o explorador do caminho, ou gasta a VARREDURA, que cancela a próxima
// jogada e desfaz a jaula. Preso, o explorador também sai com o Salto de Fase.
//
// Nada aqui toca no DOM: o mesmo código roda no console do operador e nos
// testes (node --test).
import { generateQuantumMap } from '../map-generator.js';
import { pickFloorCells } from '../maze-physics.js';
import { distanceToSector } from '../decoherence.js';
import { listRegions } from '../qubit-regions.js';

export const COOP = {
  // Primeira jogada da IA depois que o explorador entra no andar.
  firstMoveMs: 20000,
  moveMinGapMs: 15000,
  moveMaxGapMs: 24000,
  // Aviso (só para o operador) antes de a IA fechar um corredor.
  blockWarnMs: 6000,
  // Aviso antes de um cerco (jaula em volta do explorador).
  cageWarnMs: 7000,
  // A cada quantas jogadas a IA tenta um cerco.
  cageEvery: 3,
  // Paredes da IA se desfazem sozinhas depois de um tempo (o andar não trava).
  wallLifeMs: 45000,
  // Onde a IA corta o caminho: entre estes passos à frente do explorador.
  cutMinSteps: 3,
  cutMaxSteps: 9,
  scanCooldownMs: 20000,
  // Quanto tempo o explorador precisa ficar fora da jaula para ela sumir.
  escapeReleaseMs: 1500,
  // Na hora de descer, o explorador precisa estar perto da porta.
  stairsRadius: 2.5,
};

const COLUMN_LETTERS = 'ABC';
const DIRECTIONS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

export function regionLabel(region) {
  return `${COLUMN_LETTERS[region.col] ?? '?'}${region.row + 1}`;
}

function key(x, z) {
  return `${x},${z}`;
}

// Região onde a célula está; numa linha de fronteira, a região mais próxima.
export function nearestRegion(regions, x, z) {
  let best = null;
  regions.forEach((region) => {
    const distance = distanceToSector(region, x, z);
    if (!best || distance < best.distance) best = { region, distance };
  });
  return best?.region || null;
}

// Caminho mais curto (BFS em 4 direções) de `from` até `to`; null se não houver.
export function shortestPath(maze, from, to) {
  const size = maze.length;
  const open = (x, z) => x > 0 && z > 0 && x < size - 1 && z < size - 1 && maze[z][x] !== '#';
  if (!open(from.x, from.z) || !open(to.x, to.z)) return null;
  const previous = new Map([[key(from.x, from.z), null]]);
  const queue = [from];
  while (queue.length) {
    const cell = queue.shift();
    if (cell.x === to.x && cell.z === to.z) {
      const path = [];
      for (let at = key(to.x, to.z); at; at = previous.get(at)) {
        const [x, z] = at.split(',').map(Number);
        path.unshift({ x, z });
      }
      return path;
    }
    DIRECTIONS.forEach(([dx, dz]) => {
      const next = { x: cell.x + dx, z: cell.z + dz };
      const id = key(next.x, next.z);
      if (!open(next.x, next.z) || previous.has(id)) return;
      previous.set(id, key(cell.x, cell.z));
      queue.push(next);
    });
  }
  return null;
}

// A IA escolhe onde cortar: um ponto do caminho entre cutMinSteps e cutMaxSteps
// à frente, fechado de parede a parede na perpendicular. Só vale um corte que
// ainda deixa outro caminho até a porta (a IA força desvio, não tranca o andar).
export function planBlock(maze, from, door, { protectedCells = [] } = {}) {
  const path = shortestPath(maze, from, door);
  if (!path || path.length < COOP.cutMinSteps + 3) return null;
  const banned = new Set(protectedCells.map((cell) => key(cell.x, cell.z)));
  const last = Math.min(COOP.cutMaxSteps, path.length - 3);
  const options = [];
  for (let step = COOP.cutMinSteps; step <= last; step += 1) {
    const cell = path[step];
    const next = path[step + 1];
    const along = { x: next.x - cell.x, z: next.z - cell.z };
    const across = { x: along.z, z: along.x };
    // Parede perpendicular ao caminho, até 2 células para cada lado.
    const cells = [cell];
    [1, -1].forEach((sign) => {
      for (let reach = 1; reach <= 2; reach += 1) {
        const x = cell.x + across.x * sign * reach;
        const z = cell.z + across.z * sign * reach;
        if (maze[z]?.[x] !== '.') break;
        cells.push({ x, z });
      }
    });
    if (cells.some((c) => banned.has(key(c.x, c.z)))) continue;
    const test = maze.map((row) => [...row]);
    cells.forEach((c) => { test[c.z][c.x] = '#'; });
    const detour = shortestPath(test, from, door);
    if (!detour) continue;
    // Prefere cortes estreitos que mais alongam o caminho.
    options.push({ cells, step, detour: detour.length - path.length, width: cells.length });
  }
  options.sort((a, b) => (b.detour - b.width) - (a.detour - a.width));
  return options[0] || null;
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
    measured: true,
    explorer: null,
    ghost: null,
    pending: [],
    aiWalls: [],
    cage: null,
    moves: 0,
    nextMoveAt: now + COOP.firstMoveMs,
    lastScanAt: -Infinity,
    lastNow: now,
    version: 0,
  };

  function bump() {
    world.version += 1;
  }

  function gap() {
    return COOP.moveMinGapMs + random() * (COOP.moveMaxGapMs - COOP.moveMinGapMs);
  }

  function loadFloor(nextFloor, bits, at) {
    const map = generateQuantumMap(bits);
    world.floor = nextFloor;
    world.bitstring = map.bitstring;
    world.maze = map.maze.map((row) => [...row]);
    world.size = world.maze.length;
    // Sem paredes em superposição: isso é do modo solo (quântico).
    world.superposed = new Map();
    world.regions = listRegions(world.size).map((region) => ({ ...region, label: regionLabel(region) }));
    world.doorCandidates = map.doorCandidates || [];
    world.itemCells = pickFloorCells(map.maze, map.bitstring, 3, [
      { x: 1, z: 1 }, { x: 2, z: 1 }, { x: 1, z: 2 }, map.stairs,
    ]).slice(1);
    // A porta já começa definida: o operador sabe onde ela está.
    world.door = Math.floor(random() * Math.max(1, world.doorCandidates.length));
    world.measured = true;
    world.pending = [];
    world.aiWalls = [];
    world.cage = null;
    world.moves = 0;
    world.nextMoveAt = at + COOP.firstMoveMs;
    world.lastScanAt = -Infinity;
    bump();
  }

  function doorCell() {
    return world.doorCandidates[world.door];
  }

  function explorerCell() {
    if (!world.explorer) return null;
    return { x: Math.round(world.explorer.x), z: Math.round(world.explorer.z) };
  }

  function nearExplorer(cells, radius = 1) {
    const here = explorerCell();
    if (!here) return false;
    return cells.some((cell) => Math.max(Math.abs(cell.x - here.x), Math.abs(cell.z - here.z)) <= radius);
  }

  function protectedCells() {
    const cells = [];
    const door = doorCell();
    if (door) cells.push(door);
    world.itemCells.forEach((cell) => cell && cells.push(cell));
    const here = explorerCell();
    if (here) {
      for (let dz = -1; dz <= 1; dz += 1) {
        for (let dx = -1; dx <= 1; dx += 1) cells.push({ x: here.x + dx, z: here.z + dz });
      }
    }
    return cells;
  }

  function labelAt(cell) {
    return nearestRegion(world.regions, cell.x, cell.z)?.label || '?';
  }

  // Jaula 3x3 em volta do explorador: o anel a 2 células vira parede (1 célula
  // de espessura, dá para atravessar com o Salto de Fase).
  function buildCage(center) {
    const door = doorCell();
    const cells = [];
    for (let dz = -2; dz <= 2; dz += 1) {
      for (let dx = -2; dx <= 2; dx += 1) {
        const x = center.x + dx;
        const z = center.z + dz;
        if (x <= 0 || z <= 0 || x >= world.size - 1 || z >= world.size - 1) continue;
        const ring = Math.max(Math.abs(dx), Math.abs(dz)) === 2;
        if (ring && door && door.x === x && door.z === z) continue;
        const value = ring ? '#' : '.';
        cells.push({ x, z, prev: world.maze[z][x], value });
        world.maze[z][x] = value;
      }
    }
    bump();
    return cells;
  }

  function restore(cells) {
    cells.forEach(({ x, z, prev, value }) => {
      if (world.maze[z][x] === value) world.maze[z][x] = prev;
    });
    bump();
  }

  function releaseCage() {
    if (!world.cage) return false;
    restore(world.cage.cells);
    world.cage = null;
    world.nextMoveAt = Math.max(world.nextMoveAt, world.lastNow + gap());
    return true;
  }

  // Próxima jogada da IA: cerco (de tempos em tempos) ou corte no caminho.
  function planMove(at, events) {
    const here = explorerCell();
    const door = doorCell();
    if (!here || !door) return;
    world.moves += 1;
    const cage = world.moves % COOP.cageEvery === 0;
    if (cage) {
      world.pending.push({ kind: 'cage', label: labelAt(here), at: at + COOP.cageWarnMs, since: at });
      events.push({ type: 'warn', kind: 'cage', label: labelAt(here), ms: COOP.cageWarnMs });
      return;
    }
    const plan = planBlock(world.maze, here, door, { protectedCells: protectedCells() });
    if (!plan) {
      world.nextMoveAt = at + 4000;
      return;
    }
    const label = labelAt(plan.cells[0]);
    world.pending.push({ kind: 'block', label, cells: plan.cells, at: at + COOP.blockWarnMs, since: at });
    events.push({ type: 'warn', kind: 'block', label, ms: COOP.blockWarnMs, detour: plan.detour });
  }

  function resolve(item, at, events) {
    if (item.kind === 'cage') {
      // O cerco pega onde o explorador estiver agora: a IA o segue.
      const center = explorerCell();
      world.cage = { cells: buildCage(center), center, since: at, outsideSince: null };
      events.push({ type: 'trapped', label: labelAt(center) });
      return;
    }
    // Corte: não fecha em cima do explorador. Se ele já passou, a IA erra.
    const cells = item.cells.filter((cell) => world.maze[cell.z][cell.x] === '.');
    if (!cells.length || nearExplorer(cells, 0)) {
      events.push({ type: 'dodged', label: item.label });
      return;
    }
    const placed = cells.map(({ x, z }) => ({ x, z, prev: '.', value: '#' }));
    placed.forEach(({ x, z }) => { world.maze[z][x] = '#'; });
    world.aiWalls.push({ cells: placed, until: at + COOP.wallLifeMs, label: item.label });
    bump();
    events.push({ type: 'blocked', label: item.label, cells: placed.length });
  }

  loadFloor(floor, drawBits(floor) || '010110101100', now);

  const api = {
    get state() {
      return world;
    },

    setExplorer(explorer, ghost = null) {
      world.explorer = explorer;
      world.ghost = ghost;
    },

    // O explorador entrou (ou voltou) no andar: a IA espera um pouco antes de agir.
    startClock(at) {
      world.pending = [];
      if (!world.cage) world.nextMoveAt = at + COOP.firstMoveMs;
    },

    update(at) {
      world.lastNow = at;
      const events = [];
      if (!world.explorer) return events;

      world.pending.filter((item) => item.at <= at).forEach((item) => {
        world.pending = world.pending.filter((other) => other !== item);
        resolve(item, at, events);
        world.nextMoveAt = at + gap();
      });

      // Paredes antigas da IA se desfazem (se o explorador não estiver nelas).
      world.aiWalls = world.aiWalls.filter((wall) => {
        if (wall.until > at || nearExplorer(wall.cells, 0)) return true;
        restore(wall.cells);
        events.push({ type: 'expired', label: wall.label });
        return false;
      });

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

      if (!world.cage && !world.pending.length && at >= world.nextMoveAt) planMove(at, events);
      return events;
    },

    scanCooldown(at) {
      return Math.max(0, COOP.scanCooldownMs - (at - world.lastScanAt));
    },

    // VARREDURA do operador: cancela a próxima jogada da IA e desfaz a jaula.
    scan(at) {
      const events = [];
      if (!world.explorer || api.scanCooldown(at) > 0) return { ok: false, events };
      world.lastScanAt = at;
      world.lastNow = at;
      world.pending.forEach((item) => events.push({ type: 'cancelled', kind: item.kind, label: item.label }));
      world.pending = [];
      if (releaseCage()) events.push({ type: 'released', reason: 'scan' });
      world.nextMoveAt = Math.max(world.nextMoveAt, at + gap());
      events.push({ type: 'scanned' });
      return { ok: true, events };
    },

    nextFloor(at) {
      const door = doorCell();
      if (!door || !world.explorer) return false;
      if (Math.hypot(world.explorer.x - door.x, world.explorer.z - door.z) > COOP.stairsRadius) return false;
      loadFloor(world.floor + 1, drawBits(world.floor + 1) || '010110101100', at);
      world.explorer = null;
      return true;
    },

    restart(at) {
      loadFloor(1, drawBits(1) || '010110101100', at);
      world.explorer = null;
    },

    // O labirinto inteiro (23 x 23 caracteres) vai a cada mudança.
    snapshot() {
      return {
        floor: world.floor,
        bits: world.bitstring,
        maze: world.maze.map((row) => row.join('')),
        superposed: [],
        regionBits: '',
        door: world.door,
        doorBits: null,
        caged: Boolean(world.cage),
        version: world.version,
      };
    },
  };
  return api;
}
