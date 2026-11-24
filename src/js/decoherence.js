// Decoerência: o labirinto muda em tempo real, mas só onde ninguém está olhando.
//
// A ideia (metáfora de jogo, inspirada na física): observar é medir, e o que foi
// medido fica fixo. Um trecho que ninguém observa há algum tempo "perde" a
// medição, volta à superposição e é medido de novo, com um novo bitstring de 12
// bits tirado da mesma distribuição do andar (banco de medições). O trecho então
// se reorganiza. O que o jogador está vendo nunca muda.
//
// O mapa é dividido em setores de SECTOR_SIZE x SECTOR_SIZE células. A troca de
// um setor é local: só as células dele mudam, e o labirinto inteiro continua
// conectado (nenhuma sala fica isolada e ninguém fica preso).

export const SECTOR_SIZE = 7;
// Quanto tempo um setor precisa ficar sem ser observado para decoerir.
export const UNOBSERVED_MS = 18000;
// Intervalo mínimo entre duas trocas, em qualquer setor.
export const SHIFT_COOLDOWN_MS = 9000;
// Setores a menos de NEAR_CELLS células do jogador contam como observados,
// mesmo fora do campo de visão (visão periférica, virar a cabeça rápido no VR).
export const NEAR_CELLS = 2.5;
// Metade do ângulo de visão considerado, com folga (o Quest tem ~100° de FOV).
export const VIEW_HALF_ANGLE = (75 * Math.PI) / 180;
export const VIEW_DISTANCE = 16;

const DIRECTIONS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

export function listSectors(size, sectorSize = SECTOR_SIZE) {
  const sectors = [];
  for (let minZ = 1; minZ < size - 1; minZ += sectorSize) {
    for (let minX = 1; minX < size - 1; minX += sectorSize) {
      sectors.push({
        id: `${minX},${minZ}`,
        minX,
        minZ,
        maxX: Math.min(size - 2, minX + sectorSize - 1),
        maxZ: Math.min(size - 2, minZ + sectorSize - 1),
      });
    }
  }
  return sectors;
}

export function inSector(sector, x, z, margin = 0) {
  return x >= sector.minX - margin && x <= sector.maxX + margin &&
    z >= sector.minZ - margin && z <= sector.maxZ + margin;
}

// Distância (em células) de um ponto até o retângulo do setor.
export function distanceToSector(sector, x, z) {
  const dx = Math.max(sector.minX - 0.5 - x, 0, x - sector.maxX - 0.5);
  const dz = Math.max(sector.minZ - 0.5 - z, 0, z - sector.maxZ - 0.5);
  return Math.hypot(dx, dz);
}

function opaque(maze, x, z) {
  const cell = maze[z]?.[x];
  return cell === undefined || cell === '#' || cell === 'F';
}

// Linha de visão no grid: anda do olho até a célula alvo e para na primeira
// parede. Paredes em superposição contam como transparentes (podem estar
// abertas), o que deixa o teste mais conservador.
export function hasLineOfSight(maze, from, to, transparent = () => false) {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const steps = Math.ceil(Math.hypot(dx, dz) / 0.2);
  for (let index = 1; index < steps; index += 1) {
    const x = Math.round(from.x + (dx * index) / steps);
    const z = Math.round(from.z + (dz * index) / steps);
    if (x === to.x && z === to.z) return true;
    if (opaque(maze, x, z) && !transparent(x, z)) return false;
  }
  return true;
}

// viewer: { x, z } em células (com fração) e { dirX, dirZ } para onde olha.
export function isSectorObserved(maze, sector, viewer, {
  transparent = () => false,
  near = NEAR_CELLS,
  halfAngle = VIEW_HALF_ANGLE,
  maxDistance = VIEW_DISTANCE,
} = {}) {
  if (distanceToSector(sector, viewer.x, viewer.z) <= near) return true;
  const length = Math.hypot(viewer.dirX, viewer.dirZ) || 1;
  const fx = viewer.dirX / length;
  const fz = viewer.dirZ / length;
  const cosLimit = Math.cos(halfAngle);

  for (let z = sector.minZ; z <= sector.maxZ; z += 1) {
    for (let x = sector.minX; x <= sector.maxX; x += 1) {
      const ox = x - viewer.x;
      const oz = z - viewer.z;
      const distance = Math.hypot(ox, oz);
      if (distance > maxDistance) continue;
      if ((ox * fx + oz * fz) / distance < cosLimit) continue;
      if (hasLineOfSight(maze, viewer, { x, z }, transparent)) return true;
    }
  }
  return false;
}

export function createRandom(bitstring, salt = 0) {
  let seed = ((Number.parseInt(String(bitstring).slice(0, 12), 2) || 0) + 1) * 2654435761 + salt * 97;
  return () => {
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function floodFloor(maze, start) {
  const seen = new Set([`${start.x},${start.z}`]);
  const queue = [start];
  while (queue.length) {
    const { x, z } = queue.shift();
    DIRECTIONS.forEach(([dx, dz]) => {
      const key = `${x + dx},${z + dz}`;
      if (maze[z + dz]?.[x + dx] === '.' && !seen.has(key)) {
        seen.add(key);
        queue.push({ x: x + dx, z: z + dz });
      }
    });
  }
  return seen;
}

function floorCells(maze) {
  const cells = [];
  maze.forEach((row, z) => row.forEach((cell, x) => { if (cell === '.') cells.push({ x, z }); }));
  return cells;
}

export function isFullyConnected(maze) {
  const cells = floorCells(maze);
  if (cells.length === 0) return true;
  return floodFloor(maze, cells[0]).size === cells.length;
}

// Abre paredes, só dentro do setor, até tudo ficar conectado. Devolve false se
// não conseguir (aí quem chamou abre o setor inteiro).
function connectInside(maze, sector, random) {
  for (let guard = 0; guard < 200; guard += 1) {
    const cells = floorCells(maze);
    const reached = floodFloor(maze, cells[0]);
    if (reached.size === cells.length) return true;

    const holes = [];
    for (let z = sector.minZ; z <= sector.maxZ; z += 1) {
      for (let x = sector.minX; x <= sector.maxX; x += 1) {
        if (maze[z][x] !== '#') continue;
        const sides = DIRECTIONS
          .map(([dx, dz]) => ({ x: x + dx, z: z + dz }))
          .filter(({ x: nx, z: nz }) => maze[nz]?.[nx] === '.');
        const inside = sides.filter(({ x: nx, z: nz }) => reached.has(`${nx},${nz}`)).length;
        if (inside > 0 && inside < sides.length) holes.push({ x, z });
      }
    }
    if (holes.length === 0) return false;
    const hole = holes[Math.floor(random() * holes.length)];
    maze[hole.z][hole.x] = '.';
  }
  return false;
}

// Novo arranjo do setor a partir do bitstring medido: sala aberta, paredes com
// vãos (como o gerador do andar) ou grade de pilares.
function layoutSector(maze, sector, random) {
  const width = sector.maxX - sector.minX + 1;
  const depth = sector.maxZ - sector.minZ + 1;
  const randomInt = (min, max) => min + Math.floor(random() * (max - min + 1));

  for (let z = sector.minZ; z <= sector.maxZ; z += 1) {
    for (let x = sector.minX; x <= sector.maxX; x += 1) maze[z][x] = '.';
  }

  const style = random();
  if (style < 0.6) {
    // Uma ou duas paredes atravessando o setor, cada uma com um vão.
    const lines = random() < 0.5 ? 1 : 2;
    for (let index = 0; index < lines; index += 1) {
      const vertical = random() < 0.5;
      const span = vertical ? width : depth;
      if (span < 3) continue;
      const line = vertical
        ? randomInt(sector.minX + 1, sector.maxX - 1)
        : randomInt(sector.minZ + 1, sector.maxZ - 1);
      const from = vertical ? sector.minZ : sector.minX;
      const to = vertical ? sector.maxZ : sector.maxX;
      const gapStart = randomInt(from, Math.max(from, to - 1));
      const cut = random() < 0.4 ? randomInt(1, 2) : 0;
      for (let t = from + cut; t <= to; t += 1) {
        if (t === gapStart || t === gapStart + 1) continue;
        if (vertical) maze[t][line] = '#';
        else maze[line][t] = '#';
      }
    }
  } else if (style < 0.85) {
    // Pilares soltos, sem encostar uns nos outros.
    const spacing = random() < 0.5 ? 2 : 3;
    for (let z = sector.minZ + 1; z < sector.maxZ; z += spacing) {
      for (let x = sector.minX + 1; x < sector.maxX; x += spacing) maze[z][x] = '#';
    }
  }
  // Senão: sala aberta.
}

// Reorganiza um setor. `protectedCells` ficam sempre livres (jogador, porta,
// itens, entidade). Muta `maze` e devolve as células que mudaram.
export function reshuffleSector(maze, sector, bitstring, { protectedCells = [], salt = 0 } = {}) {
  const random = createRandom(bitstring, salt);
  const before = [];
  for (let z = sector.minZ; z <= sector.maxZ; z += 1) {
    for (let x = sector.minX; x <= sector.maxX; x += 1) before.push({ x, z, cell: maze[z][x] });
  }
  // Móveis (lobby) nunca entram aqui; se aparecerem, o setor não é tocado.
  if (before.some(({ cell }) => cell === 'F')) return [];

  layoutSector(maze, sector, random);
  protectedCells.forEach(({ x, z }) => {
    if (inSector(sector, x, z)) maze[z][x] = '.';
  });

  if (!connectInside(maze, sector, random)) {
    // Setor todo aberto liga qualquer vizinho que antes passava por ele.
    for (let z = sector.minZ; z <= sector.maxZ; z += 1) {
      for (let x = sector.minX; x <= sector.maxX; x += 1) maze[z][x] = '.';
    }
  }

  return before.filter(({ x, z, cell }) => maze[z][x] !== cell).map(({ x, z }) => ({ x, z, solid: maze[z][x] === '#' }));
}

// Escolhe até `max` paredes do setor que separam dois espaços livres para
// ficarem em superposição (as que piscam com o Visor Zeta).
export function pickSectorSuperposed(maze, sector, bitstring, max = 1) {
  const random = createRandom(bitstring, 7);
  const candidates = [];
  for (let z = sector.minZ; z <= sector.maxZ; z += 1) {
    for (let x = sector.minX; x <= sector.maxX; x += 1) {
      if (maze[z][x] !== '#') continue;
      const bridgesX = maze[z][x - 1] === '.' && maze[z][x + 1] === '.';
      const bridgesZ = maze[z - 1]?.[x] === '.' && maze[z + 1]?.[x] === '.';
      if (bridgesX || bridgesZ) candidates.push({ x, z });
    }
  }
  const picked = [];
  while (picked.length < max && candidates.length) {
    const [cell] = candidates.splice(Math.floor(random() * candidates.length), 1);
    picked.push({ ...cell, offset: Number((random() * Math.PI * 2).toFixed(3)) });
  }
  return picked;
}
