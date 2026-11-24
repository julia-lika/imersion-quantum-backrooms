// Cada qubit controla uma região do andar.
//
// O interior do mapa é dividido numa grade de 3 colunas x 4 linhas = 12 regiões,
// uma por qubit. O qubit 0 é a região da entrada (canto de cima, à esquerda) e a
// numeração segue por linha, na mesma ordem da cadeia de CX do circuito:
//
//    q0  q1  q2
//    q3  q4  q5
//    q6  q7  q8
//    q9  q10 q11
//
// O bit medido de cada qubit decide o TIPO da região:
//   1 -> SALA ABERTA  (espaço amplo, no máximo alguns pilares)
//   0 -> CORREDORES   (a região é repartida por paredes com passagens estreitas)
//
// E a fronteira entre duas regiões vizinhas mostra a correlação entre os qubits:
//   bits iguais    -> a parede some quase toda (as regiões viram um espaço só)
//   bits diferentes -> parede inteira com uma única passagem
// Como o CX em cadeia correlaciona vizinhos, bits iguais lado a lado são mais
// comuns do que numa moeda: dá para ver o emaranhamento na planta do andar.
//
// O que é clássico: onde exatamente ficam os vãos e os pilares dentro da região
// sai de um gerador pseudoaleatório semeado pelo bitstring (mesmo bitstring =
// mesmo andar). O tipo de cada região e as fronteiras vêm direto dos bits.

export const REGION_COLS = 3;
export const REGION_ROWS = 4;
export const REGION_TYPES = { 1: 'sala aberta', 0: 'corredores' };

export function createRandom(bitstring, salt = 0) {
  let seed = ((Number.parseInt(String(bitstring).slice(0, 12), 2) || 0) + 1) * 2654435761 + salt * 97;
  return () => {
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Divide `count` faixas num interior de `inner` células, com 1 célula de parede
// entre faixas. Devolve [{ min, max }], as primeiras faixas um pouco maiores.
function bands(inner, count) {
  const usable = inner - (count - 1);
  const base = Math.floor(usable / count);
  const extra = usable - base * count;
  const result = [];
  let start = 1;
  for (let index = 0; index < count; index += 1) {
    const length = base + (index < extra ? 1 : 0);
    result.push({ min: start, max: start + length - 1 });
    start += length + 1; // pula a linha de parede
  }
  return result;
}

// As 12 regiões (sem as linhas de fronteira). Cada uma sabe seu qubit.
export function listRegions(size) {
  const cols = bands(size - 2, REGION_COLS);
  const rows = bands(size - 2, REGION_ROWS);
  const regions = [];
  rows.forEach((row, r) => {
    cols.forEach((col, c) => {
      const qubit = r * REGION_COLS + c;
      regions.push({
        id: `q${qubit}`,
        qubit,
        row: r,
        col: c,
        minX: col.min,
        maxX: col.max,
        minZ: row.min,
        maxZ: row.max,
      });
    });
  });
  return regions;
}

export function regionAt(regions, x, z) {
  return regions.find((region) => x >= region.minX && x <= region.maxX && z >= region.minZ && z <= region.maxZ) || null;
}

// Desenha o interior de uma região conforme o bit do seu qubit. Só mexe nas
// células da região.
export function layoutRegion(maze, region, bit, random) {
  const { minX, maxX, minZ, maxZ } = region;
  const width = maxX - minX + 1;
  const depth = maxZ - minZ + 1;
  const randomInt = (min, max) => min + Math.floor(random() * (max - min + 1));

  for (let z = minZ; z <= maxZ; z += 1) {
    for (let x = minX; x <= maxX; x += 1) maze[z][x] = '.';
  }

  if (bit === '1') {
    // Sala aberta: às vezes um pilar solto no meio, longe das bordas.
    if (width >= 6 && depth >= 5 && random() < 0.5) {
      maze[Math.floor((minZ + maxZ) / 2)][Math.floor((minX + maxX) / 2)] = '#';
    }
    return;
  }

  // Corredores: uma parede atravessa a região no sentido mais comprido, com uma
  // passagem de 1 célula, e um toco de parede sai do outro lado.
  const vertical = width >= depth;
  const line = vertical
    ? randomInt(minX + 2, maxX - 2)
    : randomInt(minZ + 2, maxZ - 2);
  const from = vertical ? minZ : minX;
  const to = vertical ? maxZ : maxX;
  const gap = randomInt(from, to);
  for (let t = from; t <= to; t += 1) {
    if (t === gap) continue;
    if (vertical) maze[t][line] = '#';
    else maze[line][t] = '#';
  }

  // Toco perpendicular, de um dos lados da parede, encostado na borda da região.
  const mid = vertical ? Math.floor((minZ + maxZ) / 2) : Math.floor((minX + maxX) / 2);
  const left = random() < 0.5;
  const stubFrom = vertical ? (left ? minX : line + 2) : (left ? minZ : line + 2);
  const stubTo = vertical ? (left ? line - 2 : maxX) : (left ? line - 2 : maxZ);
  for (let t = stubFrom; t <= stubTo; t += 1) {
    if (vertical) maze[mid][t] = '#';
    else maze[t][mid] = '#';
  }
}

// Fronteiras entre regiões vizinhas. Cada segmento é a linha de parede entre
// duas regiões (as interseções das linhas ficam sempre como pilar).
export function listBorders(regions) {
  const borders = [];
  regions.forEach((a) => {
    const right = regions.find((b) => b.row === a.row && b.col === a.col + 1);
    const below = regions.find((b) => b.col === a.col && b.row === a.row + 1);
    if (right) {
      borders.push({ a: a.qubit, b: right.qubit, vertical: true, line: a.maxX + 1, from: a.minZ, to: a.maxZ });
    }
    if (below) {
      borders.push({ a: a.qubit, b: below.qubit, vertical: false, line: a.maxZ + 1, from: a.minX, to: a.maxX });
    }
  });
  return borders;
}

function layoutBorder(maze, border, bits, random) {
  const set = (t, value) => {
    if (border.vertical) maze[t][border.line] = value;
    else maze[border.line][t] = value;
  };
  const same = bits[border.a] === bits[border.b];
  for (let t = border.from; t <= border.to; t += 1) set(t, same ? '.' : '#');
  if (same) return;
  const length = border.to - border.from + 1;
  const gap = Math.min(2, length);
  const start = border.from + Math.floor(random() * (length - gap + 1));
  for (let t = start; t < start + gap; t += 1) set(t, '.');
}

// Monta o andar inteiro a partir dos 12 bits.
export function buildRegionMaze(bits, size) {
  // Começa tudo parede: as regiões e as passagens das fronteiras são abertas a seguir.
  const maze = Array.from({ length: size }, () => Array(size).fill('#'));
  const random = createRandom(bits);
  const regions = listRegions(size).map((region) => ({
    ...region,
    bit: bits[region.qubit],
    type: REGION_TYPES[bits[region.qubit]],
  }));

  regions.forEach((region) => layoutRegion(maze, region, region.bit, random));
  const borders = listBorders(regions);
  borders.forEach((border) => layoutBorder(maze, border, bits, random));

  return { maze, regions, borders, random };
}
