// Paredes em superposição de verdade: cada parede é um qubit simulado.
//
// Estado de cada parede:  |0> = PAREDE  e  |1> = PASSAGEM.
// Até alguém medir, a parede não é nem uma coisa nem outra: ela tem amplitudes
// (números complexos) para os dois resultados, e a chance de cada um é o
// quadrado da amplitude (regra de Born). Isto é um simulador de vetor de estado
// (statevector) exato, igual ao que roda no Qiskit, só que pequeno o bastante
// para rodar no navegador a cada quadro.
//
// Paredes vêm em PARES EMARANHADOS. O par começa com o circuito
//   RY(θ) na parede A  ->  CX(A, B)  ->  X na parede B
// que dá  cos(θ/2)|A=0,B=1> + sin(θ/2)|A=1,B=0>: exatamente UMA das duas é
// passagem, mas ninguém sabe qual. Medir uma decide a outra na hora.
//
// Evolução no tempo (enquanto ninguém mede):
//   par:     a amplitude da passagem "pula" de uma parede para a outra
//            (rotação XY entre |01> e |10>, como uma excitação que troca de lugar)
//   sozinha: oscilação de Rabi (RX), a chance de passagem sobe e desce
//
// Medição: encostar na parede é medir. O resultado é sorteado pela regra de
// Born e o estado colapsa (a parede vira |0> ou |1>; a parceira também). Enquanto
// o jogador continua encostado, ela continua sendo medida e não evolui (efeito
// Zeno). Quando ele sai, a evolução recomeça a partir do estado medido.

// Velocidade das rotações (rad/s): um ciclo completo leva ~7 s.
export const WALL_OMEGA = 0.9;

// ---------------------------------------------------------------------------
// Registrador de 1 ou 2 qubits (vetor de estado complexo).
// Índice do vetor: o bit q do índice é o qubit q.

export function createRegister(qubits) {
  const size = 1 << qubits;
  const re = new Float64Array(size);
  const im = new Float64Array(size);
  re[0] = 1;
  return { qubits, re, im };
}

// Porta de 1 qubit dada por uma matriz 2x2 complexa [[a, b], [c, d]], cada
// entrada como [real, imag].
function apply1(reg, q, [[a, b], [c, d]]) {
  const mask = 1 << q;
  for (let i = 0; i < reg.re.length; i += 1) {
    if (i & mask) continue;
    const j = i | mask;
    const r0 = reg.re[i]; const i0 = reg.im[i];
    const r1 = reg.re[j]; const i1 = reg.im[j];
    reg.re[i] = a[0] * r0 - a[1] * i0 + b[0] * r1 - b[1] * i1;
    reg.im[i] = a[0] * i0 + a[1] * r0 + b[0] * i1 + b[1] * r1;
    reg.re[j] = c[0] * r0 - c[1] * i0 + d[0] * r1 - d[1] * i1;
    reg.im[j] = c[0] * i0 + c[1] * r0 + d[0] * i1 + d[1] * r1;
  }
}

export function ry(reg, q, theta) {
  const c = Math.cos(theta / 2); const s = Math.sin(theta / 2);
  apply1(reg, q, [[[c, 0], [-s, 0]], [[s, 0], [c, 0]]]);
}

export function rx(reg, q, theta) {
  const c = Math.cos(theta / 2); const s = Math.sin(theta / 2);
  apply1(reg, q, [[[c, 0], [0, -s]], [[0, -s], [c, 0]]]);
}

export function x(reg, q) {
  apply1(reg, q, [[[0, 0], [1, 0]], [[1, 0], [0, 0]]]);
}

export function cx(reg, control, target) {
  const cm = 1 << control; const tm = 1 << target;
  for (let i = 0; i < reg.re.length; i += 1) {
    if (!(i & cm) || (i & tm)) continue;
    const j = i | tm;
    [reg.re[i], reg.re[j]] = [reg.re[j], reg.re[i]];
    [reg.im[i], reg.im[j]] = [reg.im[j], reg.im[i]];
  }
}

// Rotação XY entre |01> e |10> (troca a passagem de parede): exp(-iθ(XX+YY)/2).
export function hop(reg, theta) {
  basisHop(reg, 0b01, 0b10, theta);
}

// Mesma rotação entre dois estados da base quaisquer, |a> e |b>.
export function basisHop(reg, a, b, theta) {
  const c = Math.cos(theta); const s = Math.sin(theta);
  const ra = reg.re[a]; const ia = reg.im[a];
  const rb = reg.re[b]; const ib = reg.im[b];
  // [[c, -i s], [-i s, c]]
  reg.re[a] = c * ra + s * ib;
  reg.im[a] = c * ia - s * rb;
  reg.re[b] = c * rb + s * ia;
  reg.im[b] = c * ib - s * ra;
}

export function probabilityOne(reg, q) {
  const mask = 1 << q;
  let p = 0;
  for (let i = 0; i < reg.re.length; i += 1) {
    if (i & mask) p += reg.re[i] ** 2 + reg.im[i] ** 2;
  }
  return p;
}

// Medição projetiva do qubit q: sorteia pela regra de Born e colapsa.
export function measure(reg, q, random = Math.random) {
  const p1 = probabilityOne(reg, q);
  const bit = random() < p1 ? 1 : 0;
  const mask = 1 << q;
  const norm = Math.sqrt(bit ? p1 : 1 - p1) || 1;
  for (let i = 0; i < reg.re.length; i += 1) {
    if (Boolean(i & mask) === Boolean(bit)) {
      reg.re[i] /= norm;
      reg.im[i] /= norm;
    } else {
      reg.re[i] = 0;
      reg.im[i] = 0;
    }
  }
  return bit;
}

// ---------------------------------------------------------------------------
// Sistema das paredes do andar.

export function createWallQuantum({ random = Math.random } = {}) {
  return { walls: new Map(), random, time: null, pairs: 0 };
}

function singleRegister(theta) {
  const reg = createRegister(1);
  ry(reg, 0, theta);
  return reg;
}

// Adiciona paredes novas, em pares emaranhados (a última fica sozinha se sobrar).
// `walls`: [{ key, offset }], offset vira o ângulo inicial θ.
export function addWalls(system, walls) {
  for (let index = 0; index < walls.length; index += 2) {
    const a = walls[index];
    const b = walls[index + 1];
    if (!b) {
      system.walls.set(a.key, { reg: singleRegister(a.offset), q: 0, partner: null });
      continue;
    }
    const reg = createRegister(2);
    ry(reg, 0, a.offset);
    cx(reg, 0, 1);
    x(reg, 1);
    system.pairs += 1;
    system.walls.set(a.key, { reg, q: 0, partner: b.key });
    system.walls.set(b.key, { reg, q: 1, partner: a.key });
  }
}

// Tira uma parede. Se ela era de um par, mede antes: a parceira fica com o
// estado que sobrou (puro, depois da medição) num registrador próprio.
export function removeWall(system, key) {
  const wall = system.walls.get(key);
  if (!wall) return;
  system.walls.delete(key);
  if (!wall.partner) return;
  const partner = system.walls.get(wall.partner);
  if (!partner) return;
  const bit = measure(wall.reg, wall.q, system.random);
  const reg = createRegister(1);
  const p = 1 << partner.q;
  const base = bit << wall.q;
  reg.re[0] = wall.reg.re[base]; reg.im[0] = wall.reg.im[base];
  reg.re[1] = wall.reg.re[base | p]; reg.im[1] = wall.reg.im[base | p];
  system.walls.set(wall.partner, { reg, q: 0, partner: null });
}

// Mantém o sistema igual ao conjunto de paredes em superposição do mundo.
export function syncWalls(system, superposed) {
  [...system.walls.keys()].forEach((key) => {
    if (!superposed.has(key)) removeWall(system, key);
  });
  const fresh = [...superposed.entries()]
    .filter(([key]) => !system.walls.has(key))
    .map(([key, offset]) => ({ key, offset: Number(offset) || 0 }));
  if (fresh.length) addWalls(system, fresh);
}

// Evolui `dt` segundos. Registradores com alguma parede sendo observada não
// evoluem (efeito Zeno).
export function evolveWalls(system, dt, observed = new Set()) {
  if (!(dt > 0)) return;
  const done = new Set();
  system.walls.forEach((wall, key) => {
    if (done.has(wall.reg)) return;
    done.add(wall.reg);
    if (observed.has(key) || (wall.partner && observed.has(wall.partner))) return;
    if (wall.reg.qubits === 2) hop(wall.reg, WALL_OMEGA * dt);
    else rx(wall.reg, 0, WALL_OMEGA * dt);
  });
}

export function openProbability(system, key) {
  const wall = system.walls.get(key);
  return wall ? probabilityOne(wall.reg, wall.q) : 0;
}

// Mede uma parede: 1 = passagem, 0 = parede.
export function measureWall(system, key) {
  const wall = system.walls.get(key);
  if (!wall) return null;
  return measure(wall.reg, wall.q, system.random);
}

export function partnerOf(system, key) {
  return system.walls.get(key)?.partner ?? null;
}

// ---------------------------------------------------------------------------
// A porta de saída: 2 qubits = 4 posições possíveis (|00>, |01>, |10>, |11>).
//
// HÍBRIDO COM O HARDWARE: as amplitudes iniciais vêm das frequências que o
// computador quântico da IBM mediu para o andar (banco de medições). A posição
// i começa com amplitude raiz(P_i), então medir a porta logo no início dá a
// mesma distribuição do hardware. Depois o estado continua vivo no jogo: ele
// evolui devagar (passeio quântico num anel: a amplitude escorre de uma
// posição para as vizinhas) e só colapsa quando o QPS mede.

export const DOOR_OMEGA = 0.22;
// Anel de posições na ordem dos índices: 0 -> 1 -> 3 -> 2 -> 0 (vizinhos diferem em 1 bit).
const DOOR_RING = [[0, 1], [1, 3], [3, 2], [2, 0]];

export function createDoor(probabilities) {
  const n = Math.max(1, Math.min(4, probabilities.length));
  const total = probabilities.slice(0, n).reduce((sum, p) => sum + Math.max(0, p), 0);
  const reg = createRegister(2);
  reg.re[0] = 0;
  for (let i = 0; i < n; i += 1) {
    reg.re[i] = total > 0 ? Math.sqrt(Math.max(0, probabilities[i]) / total) : Math.sqrt(1 / n);
  }
  return { reg, n, initial: probabilities.slice(0, n), measured: null };
}

export function evolveDoor(door, dt) {
  if (!door || door.measured !== null || !(dt > 0)) return;
  DOOR_RING.forEach(([a, b]) => {
    if (a < door.n && b < door.n) basisHop(door.reg, a, b, DOOR_OMEGA * dt);
  });
}

export function doorProbabilities(door) {
  if (!door) return [];
  return Array.from({ length: door.n }, (_, i) => door.reg.re[i] ** 2 + door.reg.im[i] ** 2);
}

// Medição da porta (os 2 qubits de uma vez): devolve o índice da posição.
export function measureDoor(door, random = Math.random) {
  if (!door) return null;
  if (door.measured !== null) return door.measured;
  const probs = doorProbabilities(door);
  const total = probs.reduce((sum, p) => sum + p, 0) || 1;
  let target = random() * total;
  let index = probs.length - 1;
  for (let i = 0; i < probs.length; i += 1) {
    target -= probs[i];
    if (target < 0) { index = i; break; }
  }
  for (let i = 0; i < door.reg.re.length; i += 1) {
    door.reg.re[i] = i === index ? 1 : 0;
    door.reg.im[i] = 0;
  }
  door.measured = index;
  return index;
}

// Distribuição das posições da porta segundo as medições do hardware:
// a mesma regra do jogo (valor do bitstring módulo o número de posições).
export function doorDistributionFromCounts(counts, n) {
  const probs = Array(n).fill(0);
  let total = 0;
  Object.entries(counts || {}).forEach(([bits, count]) => {
    probs[(Number.parseInt(bits, 2) || 0) % n] += count;
    total += count;
  });
  return total > 0 ? probs.map((c) => c / total) : Array(n).fill(1 / n);
}

// Ângulo RY que dá probabilidade p de passagem: p = sin²(θ/2).
export function thetaForProbability(p) {
  return 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, p))));
}
