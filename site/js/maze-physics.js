export const CELL_SIZE = 1.05;
export const PLAYER_RADIUS = 0.24;
// Grade do Level 0: 23 x 23 células (~24 m de lado) para caber salas grandes.
export const MAZE_SIZE = 23;
// Pé-direito baixo, como nas fotos clássicas das Backrooms.
export const WALL_HEIGHT = 2.8;
export const START_CELL = { x: 1, z: 1 };

export function startPosition(size = MAZE_SIZE, cellSize = CELL_SIZE) {
  const origin = -((cellSize * size) / 2) + cellSize / 2;
  return { x: origin + START_CELL.x * cellSize, z: origin + START_CELL.z * cellSize };
}

const SUPERPOSED_SPEED = 0.7;
const SUPERPOSED_OPEN_THRESHOLD = 0.35;
const CARDINALS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

function seededRandom(bitstring) {
  let seed = Number.parseInt(String(bitstring).replace(/[^01]/g, '').slice(0, 24) || '1', 2) || 1;
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

function cellKey(x, z) {
  return `${x},${z}`;
}

export function createMazeWorld(maze, { cellSize = CELL_SIZE, superposed = [] } = {}) {
  const size = maze.length;

  return {
    maze,
    size,
    cellSize,
    origin: -((cellSize * size) / 2) + cellSize / 2,
    superposed: new Map(superposed.map(({ x, z, offset }) => [cellKey(x, z), offset])),
  };
}

export function worldToCell(world, x, z) {
  return {
    x: Math.round((x - world.origin) / world.cellSize),
    z: Math.round((z - world.origin) / world.cellSize),
  };
}

export function cellToWorld(world, x, z) {
  return {
    x: world.origin + x * world.cellSize,
    z: world.origin + z * world.cellSize,
  };
}

export function isSuperposedOpen(offset, timeSeconds) {
  return Math.sin(timeSeconds * SUPERPOSED_SPEED + offset) > SUPERPOSED_OPEN_THRESHOLD;
}

export function isCellSolid(world, x, z, timeSeconds = 0) {
  if (x < 0 || z < 0 || x >= world.size || z >= world.size) return true;
  if (world.maze[z][x] !== '#') return false;

  const offset = world.superposed.get(cellKey(x, z));
  return offset === undefined || !isSuperposedOpen(offset, timeSeconds);
}

function overlappingSolidCells(world, x, z, radius, timeSeconds) {
  const half = world.cellSize / 2;
  const min = worldToCell(world, x - radius, z - radius);
  const max = worldToCell(world, x + radius, z + radius);
  const cells = [];

  for (let cz = min.z; cz <= max.z; cz += 1) {
    for (let cx = min.x; cx <= max.x; cx += 1) {
      if (!isCellSolid(world, cx, cz, timeSeconds)) continue;

      const center = cellToWorld(world, cx, cz);
      const nearestX = Math.max(center.x - half, Math.min(x, center.x + half));
      const nearestZ = Math.max(center.z - half, Math.min(z, center.z + half));
      if ((x - nearestX) ** 2 + (z - nearestZ) ** 2 < radius ** 2) cells.push(cellKey(cx, cz));
    }
  }

  return cells;
}

// Resolve cada eixo separadamente para o jogador deslizar rente às paredes.
// Paredes que já envolvem o jogador (uma superposição que fechou sobre ele)
// são ignoradas para que ele consiga sair.
export function resolveMove(world, position, delta, radius = PLAYER_RADIUS, timeSeconds = 0) {
  let { x, z } = position;
  const trapped = new Set(overlappingSolidCells(world, x, z, radius, timeSeconds));
  const blocked = (nextX, nextZ) => overlappingSolidCells(world, nextX, nextZ, radius, timeSeconds)
    .some((key) => !trapped.has(key));

  if (!blocked(x + delta.x, z)) x += delta.x;
  if (!blocked(x, z + delta.z)) z += delta.z;

  return { x, z };
}

// Procura a primeira célula livre depois de pelo menos uma parede na direção do olhar.
export function findPhaseTarget(world, position, direction, timeSeconds = 0, maxCells = 3) {
  const horizontal = Math.abs(direction.x) >= Math.abs(direction.z);
  const stepX = horizontal ? Math.sign(direction.x) : 0;
  const stepZ = horizontal ? 0 : Math.sign(direction.z);
  if (stepX === 0 && stepZ === 0) return null;

  const start = worldToCell(world, position.x, position.z);
  let crossedWall = false;

  for (let step = 1; step <= maxCells; step += 1) {
    const x = start.x + stepX * step;
    const z = start.z + stepZ * step;
    if (x <= 0 || z <= 0 || x >= world.size - 1 || z >= world.size - 1) return null;

    if (isCellSolid(world, x, z, timeSeconds)) {
      crossedWall = true;
    } else if (crossedWall) {
      return { cell: { x, z }, ...cellToWorld(world, x, z) };
    } else {
      return null;
    }
  }

  return null;
}

// Paredes internas que separam dois corredores viram atalhos em superposição.
export function findSuperposedWalls(maze, bitstring, maxWalls = 6) {
  const candidates = [];

  for (let z = 1; z < maze.length - 1; z += 1) {
    for (let x = 1; x < maze[z].length - 1; x += 1) {
      if (maze[z][x] !== '#') continue;

      const bridgesX = maze[z][x - 1] === '.' && maze[z][x + 1] === '.';
      const bridgesZ = maze[z - 1][x] === '.' && maze[z + 1][x] === '.';
      if (bridgesX || bridgesZ) candidates.push({ x, z });
    }
  }

  const random = seededRandom(bitstring);
  for (let index = candidates.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [candidates[index], candidates[target]] = [candidates[target], candidates[index]];
  }

  return candidates.slice(0, maxWalls).map((cell) => ({
    ...cell,
    offset: Number((random() * Math.PI * 2).toFixed(3)),
  }));
}

export function pickFloorCells(maze, bitstring, count, exclude = []) {
  const blocked = new Set(exclude.map(({ x, z }) => cellKey(x, z)));
  const cells = [];

  maze.forEach((row, z) => {
    row.forEach((cell, x) => {
      if (cell === '.' && !blocked.has(cellKey(x, z))) cells.push({ x, z });
    });
  });

  const random = seededRandom(`${bitstring}1`);
  const picked = [];
  while (picked.length < count && cells.length > 0) {
    picked.push(cells.splice(Math.floor(random() * cells.length), 1)[0]);
  }

  return picked;
}

export function cellDistance(from, to) {
  return Math.hypot(from.x - to.x, from.z - to.z);
}

// BFS pelas células livres; devolve a próxima célula no caminho até o alvo.
export function nextStepToward(maze, from, to) {
  if (from.x === to.x && from.z === to.z) return from;

  const queue = [from];
  const previous = new Map([[cellKey(from.x, from.z), null]]);

  while (queue.length > 0) {
    const current = queue.shift();
    if (current.x === to.x && current.z === to.z) break;

    for (const [dx, dz] of CARDINALS) {
      const next = { x: current.x + dx, z: current.z + dz };
      const key = cellKey(next.x, next.z);
      if (maze[next.z]?.[next.x] !== '.' || previous.has(key)) continue;

      previous.set(key, current);
      queue.push(next);
    }
  }

  if (!previous.has(cellKey(to.x, to.z))) return from;

  let step = to;
  let parent = previous.get(cellKey(step.x, step.z));
  while (parent !== from) {
    step = parent;
    parent = previous.get(cellKey(step.x, step.z));
  }

  return step;
}

// Direção cardinal com o corredor livre mais longo a partir de uma célula.
// Usada para o jogador nascer olhando para um caminho aberto, e não para uma parede.
export function bestOpenDirection(maze, from) {
  let best = null;

  for (const [dx, dz] of CARDINALS) {
    let run = 0;
    let x = from.x + dx;
    let z = from.z + dz;
    while (maze[z]?.[x] === '.') {
      run += 1;
      x += dx;
      z += dz;
    }
    if (run > 0 && (!best || run > best.run)) best = { x: dx, z: dz, run };
  }

  return best;
}

if (typeof window !== 'undefined') {
  window.quantumPhysics = {
    bestOpenDirection,
    CELL_SIZE,
    MAZE_SIZE,
    WALL_HEIGHT,
    START_CELL,
    startPosition,
    PLAYER_RADIUS,
    createMazeWorld,
    worldToCell,
    cellToWorld,
    isCellSolid,
    isSuperposedOpen,
    resolveMove,
    findPhaseTarget,
    findSuperposedWalls,
    pickFloorCells,
    cellDistance,
    nextStepToward,
  };
}
