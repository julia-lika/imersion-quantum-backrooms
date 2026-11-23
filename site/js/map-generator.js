import { MAZE_SIZE } from './maze-physics.js';

const MAP_SIZE = 4;

const REQUIRED_PATH = [
  [0, 0], [1, 0], [2, 0], [3, 0],
  [3, 1], [3, 2], [3, 3],
];

function normalizeBits(bitstring, length) {
  const bits = String(bitstring ?? '').replace(/[^01]/g, '');
  return (bits + '0'.repeat(length)).slice(0, length);
}

function hasPath(layout) {
  const queue = [[0, 0]];
  const visited = new Set(['0,0']);

  while (queue.length > 0) {
    const [x, z] = queue.shift();
    if (x === MAP_SIZE - 1 && z === MAP_SIZE - 1) return true;

    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nextX = x + dx;
      const nextZ = z + dz;
      const key = `${nextX},${nextZ}`;

      if (
        nextX >= 0 && nextX < MAP_SIZE &&
        nextZ >= 0 && nextZ < MAP_SIZE &&
        layout[nextZ][nextX] === 1 &&
        !visited.has(key)
      ) {
        visited.add(key);
        queue.push([nextX, nextZ]);
      }
    }
  }

  return false;
}

// Gerador do Level 0: em vez de corredores de 1 célula, divide a área em salas
// grandes (BSP) separadas por paredes finas, com vãos largos, paredes que
// terminam no meio do nada e salas de pilares. Tudo determinístico pelos bits.
const MIN_ROOM = 4;

function createRandom(bitstring) {
  let seed = (Number.parseInt(bitstring.slice(0, 12), 2) + 1) * 2654435761;
  return () => {
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function floodFrom(maze, startX, startZ) {
  const visited = new Set([`${startX},${startZ}`]);
  const queue = [[startX, startZ]];

  while (queue.length > 0) {
    const [x, z] = queue.shift();
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const key = `${x + dx},${z + dz}`;
      if (maze[z + dz]?.[x + dx] === '.' && !visited.has(key)) {
        visited.add(key);
        queue.push([x + dx, z + dz]);
      }
    }
  }

  return visited;
}

// Abre passagens até que todas as células livres sejam alcançáveis pela entrada.
function connectAll(maze, random) {
  const size = maze.length;

  for (let guard = 0; guard < size * size; guard += 1) {
    const reached = floodFrom(maze, 1, 1);
    const holes = [];

    for (let z = 1; z < size - 1; z += 1) {
      for (let x = 1; x < size - 1; x += 1) {
        if (maze[z][x] !== '#') continue;
        const pairs = [[[x - 1, z], [x + 1, z]], [[x, z - 1], [x, z + 1]]];
        pairs.forEach(([[ax, az], [bx, bz]]) => {
          if (maze[az][ax] !== '.' || maze[bz][bx] !== '.') return;
          const a = reached.has(`${ax},${az}`);
          const b = reached.has(`${bx},${bz}`);
          if (a !== b) holes.push({ x, z, horizontal: az === bz });
        });
      }
    }

    if (holes.length === 0) return;
    const hole = holes[Math.floor(random() * holes.length)];
    maze[hole.z][hole.x] = '.';
    // Passagens de duas células, como os vãos sem porta das Backrooms.
    const [nx, nz] = hole.horizontal ? [hole.x, hole.z + 1] : [hole.x + 1, hole.z];
    if (nx < size - 1 && nz < size - 1 && maze[nz][nx] === '#') maze[nz][nx] = '.';
  }
}

function buildMaze(bitstring, size = MAZE_SIZE) {
  const maze = Array.from({ length: size }, (_, z) => Array.from(
    { length: size },
    (__, x) => (x === 0 || z === 0 || x === size - 1 || z === size - 1 ? '#' : '.')
  ));
  const random = createRandom(bitstring);
  const randomInt = (min, max) => min + Math.floor(random() * (max - min + 1));
  const rooms = [];

  const split = (room, depth) => {
    const width = room.maxX - room.minX + 1;
    const depthZ = room.maxZ - room.minZ + 1;
    const canSplitX = width >= MIN_ROOM * 2 + 1;
    const canSplitZ = depthZ >= MIN_ROOM * 2 + 1;
    const keepOpen = depth >= 2 && width * depthZ <= 110 && random() < 0.35;

    if ((!canSplitX && !canSplitZ) || keepOpen) {
      rooms.push(room);
      return;
    }

    const vertical = canSplitX && (!canSplitZ || (width === depthZ ? random() < 0.5 : width > depthZ));
    const min = (vertical ? room.minX : room.minZ) + MIN_ROOM;
    const max = (vertical ? room.maxX : room.maxZ) - MIN_ROOM;
    const line = randomInt(min, max);
    const from = vertical ? room.minZ : room.minX;
    const to = vertical ? room.maxZ : room.maxX;
    const length = to - from + 1;
    const set = (t, value) => {
      if (vertical) maze[t][line] = value;
      else maze[line][t] = value;
    };

    for (let t = from; t <= to; t += 1) set(t, '#');

    // Vãos largos na parede: um ou dois, de 2 a 3 células.
    const openings = length > 10 && random() < 0.6 ? 2 : 1;
    for (let index = 0; index < openings; index += 1) {
      const gap = randomInt(2, 3);
      const start = randomInt(from, Math.max(from, to - gap + 1));
      for (let t = start; t < start + gap && t <= to; t += 1) set(t, '.');
    }

    // Às vezes a parede termina antes de encostar na outra: espaço contínuo e confuso.
    if (random() < 0.4) {
      const cut = randomInt(2, Math.max(2, Math.floor(length / 3)));
      const atStart = random() < 0.5;
      for (let index = 0; index < cut; index += 1) set(atStart ? from + index : to - index, '.');
    }

    const [first, second] = vertical
      ? [{ ...room, maxX: line - 1 }, { ...room, minX: line + 1 }]
      : [{ ...room, maxZ: line - 1 }, { ...room, minZ: line + 1 }];
    split(first, depth + 1);
    split(second, depth + 1);
  };

  split({ minX: 1, maxX: size - 2, minZ: 1, maxZ: size - 2 }, 0);

  // Salas grandes ganham pilares isolados em grade (nunca encostam em paredes).
  const roomCenters = [];
  rooms.forEach((room) => {
    const width = room.maxX - room.minX + 1;
    const depthZ = room.maxZ - room.minZ + 1;
    if (width * depthZ >= 36) {
      roomCenters.push([Math.floor((room.minX + room.maxX) / 2), Math.floor((room.minZ + room.maxZ) / 2)]);
    }
    if (width < 7 || depthZ < 7 || random() < 0.4) return;

    const spacing = random() < 0.5 ? 3 : 4;
    for (let z = room.minZ + 2; z <= room.maxZ - 2; z += spacing) {
      for (let x = room.minX + 2; x <= room.maxX - 2; x += spacing) {
        let clear = true;
        for (let dz = -1; dz <= 1 && clear; dz += 1) {
          for (let dx = -1; dx <= 1; dx += 1) {
            if (maze[z + dz][x + dx] !== '.') clear = false;
          }
        }
        if (clear) maze[z][x] = '#';
      }
    }
  });

  // Entrada e canto oposto sempre livres.
  [[1, 1], [2, 1], [1, 2], [2, 2], [size - 2, size - 2]].forEach(([x, z]) => {
    maze[z][x] = '.';
  });
  connectAll(maze, random);

  return { maze, roomCenters };
}

// A porta de saída fica embutida na parede externa do mapa (atrás dela só há
// escuridão) e longe da entrada, para obrigar o jogador a cruzar as salas.
export function findStairsCell(maze, bitstring) {
  const size = maze.length;
  const minDistance = Math.floor(size * 0.6);
  const floorCells = [];
  const doorCells = [];

  maze.forEach((row, z) => {
    row.forEach((cell, x) => {
      if (cell !== '.' || (x === 1 && z === 1)) return;
      floorCells.push({ x, z });
      if (x + z - 2 < minDistance) return;
      // Parede da borda vizinha: nunca vira parede em superposição.
      const wall = [[1, 0], [0, 1], [-1, 0], [0, -1]].find(([dx, dz]) => (
        (x + dx === 0 || x + dx === size - 1 || z + dz === 0 || z + dz === size - 1) &&
        maze[z + dz]?.[x + dx] === '#'
      ));
      if (wall) doorCells.push({ x, z, wall: { dx: wall[0], dz: wall[1] } });
    });
  });

  const pool = doorCells.length > 0 ? doorCells : floorCells;
  const seed = Number.parseInt(normalizeBits(bitstring, 12), 2) || 1;
  return pool[seed % pool.length] || { x: size - 2, z: size - 2, wall: { dx: 1, dz: 0 } };
}

// Fase 0: lobby fixo de treinamento. Um salão de 11 x 17 células a partir da
// entrada, com as estações do tutorial e a porta para o FLOOR 01 no fundo.
export const LOBBY = {
  minX: 1,
  maxX: 11,
  minZ: 1,
  maxZ: 17,
  door: { x: 6, z: 17, wall: { dx: 0, dz: 1 } },
  // Células ocupadas por móveis (bloqueiam o jogador).
  furniture: [
    [1, 4], [1, 5], [1, 6], // sofá
    [5, 4], [6, 4], // mesa com o computador
    [11, 7], [11, 8], // mesa de metal com o terminal
    [3, 5], // poltrona
  ],
  items: {
    almondWater: { x: 9, z: 10 },
    qps: { x: 3, z: 12 },
  },
};

export function generateLobbyMap(size = MAZE_SIZE) {
  const maze = Array.from({ length: size }, (_, z) => Array.from({ length: size }, (__, x) => (
    x >= LOBBY.minX && x <= LOBBY.maxX && z >= LOBBY.minZ && z <= LOBBY.maxZ ? '.' : '#'
  )));
  LOBBY.furniture.forEach(([x, z]) => { maze[z][x] = 'F'; });

  return {
    bitstring: '000000000000',
    lobby: true,
    layout: [],
    maze,
    roomCenters: [],
    stairs: { ...LOBBY.door, visible: true },
    quantumMetrics: analyzeQuantumState('000000000000'),
    state: 'lobby',
    isReachable: true,
    entangledRooms: [],
  };
}

export function generateQuantumMap(bitstring) {
  const bits = normalizeBits(bitstring, MAP_SIZE * MAP_SIZE);
  const layout = Array.from({ length: MAP_SIZE }, () => Array(MAP_SIZE).fill(0));
  const requiredCells = new Set(REQUIRED_PATH.map(([x, z]) => `${x},${z}`));
  let bitIndex = 0;

  for (let z = 0; z < MAP_SIZE; z += 1) {
    for (let x = 0; x < MAP_SIZE; x += 1) {
      const key = `${x},${z}`;
      layout[z][x] = requiredCells.has(key) ? 1 : Number(bits[bitIndex]);
      bitIndex += 1;
    }
  }

  const state = bits[0] === '1' ? 'poolrooms' : 'level-0';

  const mazeResult = buildMaze(bits);
  const quantumMetrics = analyzeQuantumState(bits);
  const stairs = findStairsCell(mazeResult.maze, bits);

  return {
    bitstring: bits,
    layout,
    maze: mazeResult.maze,
    roomCenters: mazeResult.roomCenters,
    stairs: { ...stairs, visible: false },
    quantumMetrics,
    state,
    isReachable: hasPath(layout),
    entangledRooms: [
      { id: 'room-a', state },
      { id: 'room-b', state },
    ],
  };
}

export function sampleQuantumBitstring(randomSource = Math.random) {
  const entangledPair = randomSource() < 0.5 ? '00' : '11';
  let bitstring = entangledPair;

  for (let index = 0; index < 10; index += 1) {
    bitstring += randomSource() < 0.5 ? '0' : '1';
  }

  return bitstring;
}

export function analyzeQuantumState(bitstring) {
  const bits = normalizeBits(bitstring, 12);
  const ones = [...bits].filter((bit) => bit === '1').length;
  const density = ones / bits.length;
  const balance = 1 - Math.abs(0.5 - density) * 2;
  let matchingNeighbors = 0;

  for (let index = 1; index < bits.length; index += 1) {
    if (bits[index] === bits[index - 1]) matchingNeighbors += 1;
  }

  const correlation = matchingNeighbors / (bits.length - 1);
  const qps = Math.round((balance * 0.6 + correlation * 0.4) * 100);
  const coherence = Math.round((correlation * 0.7 + balance * 0.3) * 100);
  const noise = 100 - coherence;

  return {
    qpu: 'LOCAL-SIM',
    qubits: bits.length,
    qps,
    coherence,
    noise,
    ones,
    density: Number(density.toFixed(2)),
  };
}

if (typeof window !== 'undefined') {
  window.generateQuantumMap = generateQuantumMap;
  window.generateLobbyMap = generateLobbyMap;
  window.LOBBY_LAYOUT = LOBBY;
  window.sampleQuantumBitstring = sampleQuantumBitstring;
  window.analyzeQuantumState = analyzeQuantumState;
  window.dispatchEvent(new Event('quantum-generator-ready'));
}
