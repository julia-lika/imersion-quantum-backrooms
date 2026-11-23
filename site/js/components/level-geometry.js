// Geometria estática do Level 0, gerada como arrays simples (sem THREE) para
// poder ser testada no Node. Só as faces visíveis das paredes são emitidas:
// faces entre duas células sólidas nunca aparecem e não custam nada no Quest.

const DIRECTIONS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

function createBuffers() {
  return { positions: [], normals: [], uvs: [], colors: [], indices: [] };
}

// Quad vertical virado para `normal`, com UV em coordenadas de mundo para que o
// papel de parede continue sem emendas de uma célula para a outra.
function pushWallQuad(buffers, { cx, cz, nx, nz, halfWidth, bottom, top, tile }) {
  const rightX = nz;
  const rightZ = -nx;
  const base = buffers.positions.length / 3;

  [[-1, bottom], [1, bottom], [1, top], [-1, top]].forEach(([side, y]) => {
    const x = cx + rightX * halfWidth * side;
    const z = cz + rightZ * halfWidth * side;
    buffers.positions.push(x, y, z);
    buffers.normals.push(nx, 0, nz);
    buffers.uvs.push((x * rightX + z * rightZ) / tile, y / tile);
  });

  buffers.indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
}

export function buildWallGeometry(maze, {
  origin,
  cellSize,
  height,
  tile = 1,
  isStatic = () => true,
  baseboardHeight = 0.11,
  baseboardInset = 0.015,
}) {
  const walls = createBuffers();
  const baseboards = createBuffers();
  const half = cellSize / 2;
  const solid = (x, z) => maze[z]?.[x] === '#' && isStatic(x, z);

  maze.forEach((row, z) => {
    row.forEach((cell, x) => {
      if (!solid(x, z)) return;

      DIRECTIONS.forEach(([dx, dz]) => {
        const neighbor = maze[z + dz]?.[x + dx];
        if (neighbor === undefined || solid(x + dx, z + dz)) return;

        const cx = origin + x * cellSize;
        const cz = origin + z * cellSize;
        pushWallQuad(walls, {
          cx: cx + dx * half, cz: cz + dz * half, nx: dx, nz: dz,
          halfWidth: half, bottom: 0, top: height, tile,
        });
        pushWallQuad(baseboards, {
          cx: cx + dx * (half + baseboardInset),
          cz: cz + dz * (half + baseboardInset),
          nx: dx,
          nz: dz,
          halfWidth: half + baseboardInset,
          bottom: 0,
          top: baseboardHeight,
          tile,
        });
      });
    });
  });

  return { walls, baseboards };
}

// Luminárias fluorescentes em grade no teto, só sobre células livres.
// Algumas ficam apagadas (cor escura), como nas fotos do Level 0.
export function buildLightPanels(maze, {
  origin,
  cellSize,
  height,
  spacing = 3,
  offset = 2,
  panelSize = 0.92,
  random = Math.random,
  offChance = 0.1,
}) {
  const buffers = createBuffers();
  const fixtures = [];
  const half = panelSize / 2;
  const y = height - 0.02;

  maze.forEach((row, z) => {
    row.forEach((cell, x) => {
      if (cell !== '.' || (x - offset) % spacing !== 0 || (z - offset) % spacing !== 0) return;

      const cx = origin + x * cellSize;
      const cz = origin + z * cellSize;
      const on = random() >= offChance;
      const shade = on ? 1 : 0.28;
      const base = buffers.positions.length / 3;

      [[-1, -1, 0, 0], [1, -1, 1, 0], [1, 1, 1, 1], [-1, 1, 0, 1]].forEach(([sx, sz, u, v]) => {
        buffers.positions.push(cx + sx * half, y, cz + sz * half);
        buffers.normals.push(0, -1, 0);
        buffers.uvs.push(u, v);
        buffers.colors.push(shade, shade, shade);
      });
      // Virado para baixo: ordem horária vista de cima = anti-horária vista de baixo.
      buffers.indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
      if (on) fixtures.push({ x: cx, z: cz });
    });
  });

  return { panels: buffers, fixtures };
}
