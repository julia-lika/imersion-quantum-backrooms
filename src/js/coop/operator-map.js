// Desenho do mapa do operador (modo duo): o andar inteiro, a porta, o
// explorador com o cone de visão, a entidade por perto e as jogadas da IA.
// Usado pelo monitor do lobby (operator-lobby.js).
export function drawOperatorMap(ctx, state, { x: ox = 0, y: oy = 0, size: sizePx }, now = performance.now()) {
  const size = state.size;
  const cell = sizePx / size;
  const px = (x) => x * cell + cell / 2;
  ctx.save();
  ctx.translate(ox, oy);
  ctx.fillStyle = '#020201';
  ctx.fillRect(0, 0, sizePx, sizePx);

  for (let z = 0; z < size; z += 1) {
    for (let x = 0; x < size; x += 1) {
      const solid = state.maze[z][x] === '#';
      if (solid) {
        ctx.fillStyle = '#8a7444';
        ctx.fillRect(x * cell, z * cell, cell, cell);
      } else {
        ctx.fillStyle = '#14120a';
        ctx.fillRect(x * cell + 0.5, z * cell + 0.5, cell - 1, cell - 1);
      }
    }
  }

  // Paredes da IA (já fechadas): vermelho escuro, somem com o tempo.
  state.aiWalls.forEach((wall) => {
    wall.cells.forEach(({ x, z }) => {
      ctx.fillStyle = '#7a1e26';
      ctx.fillRect(x * cell, z * cell, cell, cell);
    });
  });
  // Próxima jogada da IA: células tracejadas piscando (corte) ou o cerco.
  state.pending.forEach((item) => {
    const total = item.at - item.since;
    const progress = Math.min(1, Math.max(0, 1 - (item.at - performance.now()) / total));
    const pulse = 0.35 + 0.3 * Math.sin(now / 110) + progress * 0.3;
    if (item.kind === 'block') {
      item.cells.forEach(({ x, z }) => {
        ctx.fillStyle = `rgba(255, 40, 60, ${pulse})`;
        ctx.fillRect(x * cell + 2, z * cell + 2, cell - 4, cell - 4);
        ctx.strokeStyle = '#ff4d5e';
        ctx.setLineDash([4, 3]);
        ctx.strokeRect(x * cell + 1, z * cell + 1, cell - 2, cell - 2);
        ctx.setLineDash([]);
      });
    } else if (state.explorer) {
      ctx.strokeStyle = `rgba(255, 40, 60, ${pulse})`;
      ctx.lineWidth = 3;
      ctx.setLineDash([6, 4]);
      ctx.strokeRect((Math.round(state.explorer.x) - 2) * cell, (Math.round(state.explorer.z) - 2) * cell, cell * 5, cell * 5);
      ctx.setLineDash([]);
    }
  });

  // Jaula: contorno vermelho.
  if (state.cage) {
    const { x, z } = state.cage.center;
    ctx.strokeStyle = '#ff4d5e';
    ctx.lineWidth = 3;
    ctx.setLineDash([]);
    ctx.strokeRect((x - 2) * cell, (z - 2) * cell, cell * 5, cell * 5);
  }

  // Grade de referência (A1 a C4) para orientar o explorador pela voz.
  ctx.font = `bold ${Math.round(cell * 0.62)}px "Courier New", monospace`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  state.regions.forEach((region) => {
    ctx.strokeStyle = 'rgba(57, 255, 136, 0.18)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(region.minX * cell, region.minZ * cell, (region.maxX - region.minX + 1) * cell, (region.maxZ - region.minZ + 1) * cell);
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(57, 255, 136, 0.75)';
    ctx.fillText(region.label, region.minX * cell + 4, region.minZ * cell + 3);
  });

  // Porta (ciano): no duo ela já começa definida.
  state.doorCandidates.forEach((door, index) => {
    const chosen = index === state.door;
    if (!chosen) return;
    ctx.strokeStyle = chosen ? '#44ffcc' : '#ffd23c';
    ctx.fillStyle = chosen ? 'rgba(68, 255, 204, 0.35)' : 'rgba(255, 210, 60, 0.12)';
    ctx.lineWidth = chosen ? 3 : 2;
    ctx.setLineDash(chosen ? [] : [5, 4]);
    ctx.beginPath();
    ctx.arc(px(door.x), px(door.z), cell * 0.42, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.setLineDash([]);
  });

  const explorer = state.explorer;
  if (explorer) {
    const ex = px(explorer.x);
    const ez = px(explorer.z);
    // Cone de visão (para dizer "à sua esquerda" / "atrás de você").
    const angle = Math.atan2(explorer.dirZ, explorer.dirX);
    ctx.fillStyle = 'rgba(57, 255, 136, 0.12)';
    ctx.beginPath();
    ctx.moveTo(ex, ez);
    ctx.arc(ex, ez, cell * 3.2, angle - 0.6, angle + 0.6);
    ctx.closePath();
    ctx.fill();
    // Seta.
    ctx.save();
    ctx.translate(ex, ez);
    ctx.rotate(angle);
    ctx.fillStyle = '#39ff88';
    ctx.beginPath();
    ctx.moveTo(cell * 0.55, 0);
    ctx.lineTo(-cell * 0.35, cell * 0.32);
    ctx.lineTo(-cell * 0.2, 0);
    ctx.lineTo(-cell * 0.35, -cell * 0.32);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // Entidade: só aparece quando está perto do explorador (4 células).
  const ghost = state.ghost;
  if (ghost && explorer && Math.hypot(ghost.x - explorer.x, ghost.z - explorer.z) <= 4) {
    ctx.fillStyle = `rgba(255, 60, 80, ${0.6 + 0.4 * Math.sin(now / 120)})`;
    ctx.beginPath();
    ctx.arc(px(ghost.x), px(ghost.z), cell * 0.36, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}
