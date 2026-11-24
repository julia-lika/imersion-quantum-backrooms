// Mini-quadro do HUD (desktop): a planta do andar dividida na grade 3x4, com o
// qubit e o bit medido que gerou cada região. 1 = sala aberta (âmbar),
// 0 = corredores (verde-água). Atualiza quando o andar muda e quando uma região
// decoere e é medida de novo.
(() => {
  const COLORS = {
    1: { fill: 'rgba(214, 160, 52, 0.55)', text: '#ffd98a' },
    0: { fill: 'rgba(52, 170, 160, 0.55)', text: '#8ff0e4' },
    wall: '#050402',
    border: 'rgba(110, 100, 70, 0.35)',
    player: '#ffffff',
  };

  function mapComponent() {
    return document.querySelector('[quantum-map]')?.components?.['quantum-map'];
  }

  function regionOf(regions, x, z) {
    return regions.find((r) => x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ) || null;
  }

  function playerCell() {
    const world = window.quantumWorld;
    const head = document.querySelector('#player')?.components?.['xr-hands']?.head?.world;
    if (!world || !head) return null;
    return { x: (head.x - world.origin) / world.cellSize, z: (head.z - world.origin) / world.cellSize };
  }

  function draw(canvas, caption) {
    const ctx = canvas.getContext('2d');
    const info = mapComponent()?.mapInfo;
    const maze = window.quantumWorld?.maze;
    const regions = info?.regions || [];
    const wrap = canvas.parentElement;
    if (!maze || info?.lobby || regions.length === 0) {
      wrap.hidden = true;
      return;
    }
    wrap.hidden = false;

    const size = maze.length;
    const cell = canvas.width / size;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (let z = 0; z < size; z += 1) {
      for (let x = 0; x < size; x += 1) {
        const solid = maze[z][x] === '#';
        const region = regionOf(regions, x, z);
        ctx.fillStyle = solid ? COLORS.wall : region ? COLORS[region.bit].fill : COLORS.border;
        ctx.fillRect(x * cell, z * cell, cell + 0.5, cell + 0.5);
      }
    }

    const player = playerCell();
    const here = player ? regionOf(regions, Math.round(player.x), Math.round(player.z)) : null;

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    regions.forEach((r) => {
      const x = r.minX * cell;
      const z = r.minZ * cell;
      const w = (r.maxX - r.minX + 1) * cell;
      const h = (r.maxZ - r.minZ + 1) * cell;
      ctx.strokeStyle = r === here ? '#ffffff' : COLORS[r.bit].text;
      ctx.lineWidth = r === here ? 4 : 1.5;
      ctx.strokeRect(x + 1, z + 1, w - 2, h - 2);
      // Etiqueta pequena num canto, para não esconder as paredes da região.
      const label = `q${r.qubit}=${r.bit}`;
      ctx.font = `bold ${Math.round(cell * 0.95)}px "Courier New", monospace`;
      const tw = ctx.measureText(label).width + cell * 0.4;
      ctx.fillStyle = 'rgba(5, 4, 2, 0.78)';
      ctx.fillRect(x + w - tw - 2, z + 2, tw, cell * 1.1);
      ctx.fillStyle = COLORS[r.bit].text;
      ctx.fillText(label, x + w - tw / 2 - 2, z + 2 + cell * 0.58);
    });

    if (player) {
      ctx.fillStyle = COLORS.player;
      ctx.beginPath();
      ctx.arc((player.x + 0.5) * cell, (player.z + 0.5) * cell, cell * 0.38, 0, Math.PI * 2);
      ctx.fill();
    }

    const bits = regions.map((r) => r.bit).join('');
    caption.textContent = here
      ? `VOCÊ ESTÁ EM q${here.qubit} = ${here.bit} (${here.type.toUpperCase()}) // BITS ${bits}`
      : `BITS ${bits}`;
  }

  function start() {
    const canvas = document.getElementById('qubit-board');
    const caption = document.getElementById('qubit-board-here');
    const scene = document.getElementById('backrooms-scene');
    if (!canvas || !caption || !scene) return;
    const redraw = () => draw(canvas, caption);
    scene.addEventListener('maze-world-updated', () => setTimeout(redraw, 0));
    scene.addEventListener('maze-region-shifted', redraw);
    // Posição do jogador: redesenha devagar, só com o painel visível.
    setInterval(() => {
      if (!document.getElementById('phase-telemetry')?.hidden) redraw();
    }, 400);
    window.drawQubitBoard = redraw;
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
