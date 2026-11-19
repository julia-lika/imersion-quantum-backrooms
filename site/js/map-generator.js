const MAP_SIZE = 4;

const REQUIRED_PATH = [
  [0, 0], [1, 0], [2, 0], [3, 0],
  [3, 1], [3, 2], [3, 3],
];

const OPEN_AREAS = [
  { minX: 2, maxX: 8, minZ: 3, maxZ: 7 },
  { minX: 4, maxX: 6, minZ: 2, maxZ: 8 },
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

function buildMaze(bitstring) {
  const size = 11;
  const maze = Array.from({ length: size }, () => Array(size).fill('#'));
  let seed = Number.parseInt(bitstring.slice(0, 12), 2) || 1;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };

  const shuffle = (items) => {
    const result = [...items];
    for (let index = result.length - 1; index > 0; index -= 1) {
      const target = Math.floor(random() * (index + 1));
      [result[index], result[target]] = [result[target], result[index]];
    }
    return result;
  };

  const stack = [[1, 1]];
  maze[1][1] = '.';

  while (stack.length > 0) {
    const [x, z] = stack[stack.length - 1];
    const neighbors = shuffle([
      [x + 2, z],
      [x - 2, z],
      [x, z + 2],
      [x, z - 2],
    ]).filter(([nextX, nextZ]) => (
      nextX > 0 && nextX < size - 1 &&
      nextZ > 0 && nextZ < size - 1 &&
      maze[nextZ][nextX] === '#'
    ));

    if (neighbors.length === 0) {
      stack.pop();
      continue;
    }

    const [nextX, nextZ] = neighbors[0];
    maze[(z + nextZ) / 2][(x + nextX) / 2] = '.';
    maze[nextZ][nextX] = '.';
    stack.push([nextX, nextZ]);
  }

  const roomCandidates = [
    [3, 3],
    [7, 3],
    [3, 7],
    [7, 7],
  ];
  const roomCenters = roomCandidates.filter((_, index) => bitstring[index] === '1');

  roomCenters.forEach(([centerX, centerZ]) => {
    for (let z = centerZ - 2; z <= centerZ + 2; z += 1) {
      for (let x = centerX - 2; x <= centerX + 2; x += 1) {
        maze[z][x] = '.';
      }
    }
  });

  OPEN_AREAS.forEach(({ minX, maxX, minZ, maxZ }) => {
    for (let z = minZ; z <= maxZ; z += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        maze[z][x] = '.';
      }
    }
  });

  return { maze, roomCenters };
}

export function findStairsCell(maze, bitstring) {
  const floorCells = [];

  maze.forEach((row, z) => {
    row.forEach((cell, x) => {
      if (cell === '.' && !(x === 1 && z === 1)) {
        floorCells.push({ x, z });
      }
    });
  });

  const seed = Number.parseInt(normalizeBits(bitstring, 12), 2) || 1;
  return floorCells[seed % floorCells.length] || { x: 9, z: 9 };
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
  window.sampleQuantumBitstring = sampleQuantumBitstring;
  window.analyzeQuantumState = analyzeQuantumState;
  window.dispatchEvent(new Event('quantum-generator-ready'));
}
