import { MAZE_SIZE } from './maze-physics.js?v=20261124-12';
import { buildRegionMaze } from './qubit-regions.js?v=20261124-13';

// Cada andar é decidido por uma medição de 12 qubits (um bitstring de 12 bits).
export const QUBITS = 12;

function normalizeBits(bitstring, length) {
  const bits = String(bitstring ?? '').replace(/[^01]/g, '');
  return (bits + '0'.repeat(length)).slice(0, length);
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

// O andar: cada qubit desenha a sua região (ver qubit-regions.js). Depois a
// entrada fica livre e, se alguma sala ficou isolada, abre-se a passagem mínima.
function buildMaze(bitstring, size = MAZE_SIZE) {
  const { maze, regions, random } = buildRegionMaze(bitstring, size);
  [[1, 1], [2, 1], [1, 2], [2, 2], [size - 2, size - 2]].forEach(([x, z]) => {
    maze[z][x] = '.';
  });
  connectAll(maze, random);
  const roomCenters = regions.map((r) => [Math.floor((r.minX + r.maxX) / 2), Math.floor((r.minZ + r.maxZ) / 2)]);
  const publicRegions = regions.map(({ id, qubit, row, col, minX, maxX, minZ, maxZ, bit, type }) => (
    { id, qubit, row, col, minX, maxX, minZ, maxZ, bit, type }
  ));
  return { maze, roomCenters, regions: publicRegions };
}

// A porta de saída fica embutida na parede externa do mapa (atrás dela só há
// escuridão) e longe da entrada, para obrigar o jogador a cruzar as salas.
function doorPool(maze) {
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

  return doorCells.length > 0 ? doorCells : floorCells;
}

export function findStairsCell(maze, bitstring) {
  const size = maze.length;
  const pool = doorPool(maze);
  const seed = Number.parseInt(normalizeBits(bitstring, 12), 2) || 1;
  return pool[seed % pool.length] || { x: size - 2, z: size - 2, wall: { dx: 1, dz: 0 } };
}

// A porta fica em superposição entre `count` posições possíveis, bem afastadas
// umas das outras. A medição do QPS escolhe uma delas (pickDoorCandidate).
export const DOOR_CANDIDATES = 4;
export function findDoorCandidates(maze, bitstring, count = DOOR_CANDIDATES) {
  const pool = doorPool(maze);
  const first = findStairsCell(maze, bitstring);
  const picked = [first];
  const distance = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.z - b.z);
  while (picked.length < count) {
    let best = null;
    let bestDistance = 0;
    pool.forEach((cell) => {
      const nearest = Math.min(...picked.map((other) => distance(cell, other)));
      if (nearest > bestDistance) {
        best = cell;
        bestDistance = nearest;
      }
    });
    // Sem espaço para outra posição bem separada: fica com as que tem.
    if (!best || bestDistance < 4) break;
    picked.push(best);
  }
  return picked;
}

// Colapso: o bitstring medido (do banco, com a distribuição do circuito)
// escolhe uma das posições possíveis.
export function pickDoorCandidate(candidates, measuredBits) {
  if (!candidates?.length) return null;
  const value = Number.parseInt(normalizeBits(measuredBits, 12), 2) || 0;
  return { index: value % candidates.length, cell: candidates[value % candidates.length] };
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
    [1, 8], [1, 9], // estação do Q-LINK
    [1, 11], [1, 12], // estação do Visor Zeta
    [1, 15], [1, 16], // estação do QPS
  ],
  items: {
    almondWater: { x: 9, z: 10 },
    // Equipamentos, cada um na mesa da sua estação, na borda da frente (a mesa
    // termina em x ≈ 1,49 célula; o centro fica para dentro o bastante para o
    // item girar sem sair do tampo). y = tampo (0,726 m) + 2 mm: apoiado, sem
    // atravessar a mesa.
    qlink: { x: 1.36, z: 8.2, y: 0.728 },
    visor: { x: 1.3, z: 11.2, y: 0.728 },
    qps: { x: 1.34, z: 15.2, y: 0.728 },
  },
  // Sala de treino atrás da parede direita (x 13..15, z 12..16). A parede em
  // (12, 12..13) é sólida, para testar o salto de fase (tunelamento); a de
  // (12, 16) fica em superposição, para testar o visor zeta. As duas dão para a
  // mesma sala, e a parede em superposição abre sozinha: ninguém fica preso.
  trainingRoom: { minX: 13, maxX: 15, minZ: 12, maxZ: 16 },
  superposed: [{ x: 12, z: 16, offset: 0 }],
};

export function generateLobbyMap(size = MAZE_SIZE) {
  const maze = Array.from({ length: size }, (_, z) => Array.from({ length: size }, (__, x) => (
    x >= LOBBY.minX && x <= LOBBY.maxX && z >= LOBBY.minZ && z <= LOBBY.maxZ ? '.' : '#'
  )));
  LOBBY.furniture.forEach(([x, z]) => { maze[z][x] = 'F'; });
  const room = LOBBY.trainingRoom;
  for (let z = room.minZ; z <= room.maxZ; z += 1) {
    for (let x = room.minX; x <= room.maxX; x += 1) maze[z][x] = '.';
  }

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

// Como o mapa nasce (fiel ao código): o interior é uma grade 3x4 de regiões e
// cada um dos 12 qubits medidos decide a sua: 1 = sala aberta, 0 = corredores.
// Fronteira entre bits iguais some; entre bits diferentes vira parede com uma
// passagem. Só a posição exata de vãos e pilares é pseudoaleatória (semeada
// pelo bitstring, então mesmo bitstring = mesmo mapa).
export function generateQuantumMap(bitstring) {
  const bits = normalizeBits(bitstring, QUBITS);
  const mazeResult = buildMaze(bits);
  const doorCandidates = findDoorCandidates(mazeResult.maze, bits);
  const stairs = doorCandidates[0];

  return {
    bitstring: bits,
    maze: mazeResult.maze,
    roomCenters: mazeResult.roomCenters,
    regions: mazeResult.regions,
    stairs: { ...stairs, visible: false },
    doorCandidates,
    quantumMetrics: analyzeQuantumState(bits),
    state: 'level-0',
  };
}

// Plano B clássico, usado só quando o banco de medições não carrega: imita a
// correlação entre vizinhos que o CX em cadeia cria no circuito (cada bit tende
// a repetir o anterior). Não é uma medição quântica.
export function sampleQuantumBitstring(randomSource = Math.random, correlation = 0.7) {
  let bitstring = randomSource() < 0.5 ? '0' : '1';

  for (let index = 1; index < QUBITS; index += 1) {
    const previous = bitstring[index - 1];
    const flip = previous === '0' ? '1' : '0';
    bitstring += randomSource() < correlation ? previous : flip;
  }

  return bitstring;
}

// Indicadores do HUD (QPS, coerência, ruído). São heurísticas do jogo calculadas
// a partir do equilíbrio de 0/1 e da correlação entre bits vizinhos; não são
// medidas físicas de coerência de um hardware.
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
  window.pickDoorCandidate = pickDoorCandidate;
  window.LOBBY_LAYOUT = LOBBY;
  window.sampleQuantumBitstring = sampleQuantumBitstring;
  window.analyzeQuantumState = analyzeQuantumState;
  window.dispatchEvent(new Event('quantum-generator-ready'));
}
