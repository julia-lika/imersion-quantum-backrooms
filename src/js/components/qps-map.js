// QPS: o mapa que mede. O agente pega o QPS na mesa do lobby e fica com ele.
// O QPS mede sem parar tudo num raio de ~4 m (QPS_RADIUS em células) e desenha
// o mapa. Pelo efeito Zeno quântico, o que está sendo medido o tempo todo não
// evolui. Fora do raio ninguém mede: o mapa guarda a última leitura (apagada),
// e os trechos que evoluíram e se reorganizaram desde então aparecem chiando
// com "?". Basta voltar ao raio para medir de novo.
//
// VR: aparece ao trazer o pulso direito ao rosto, girado para os olhos, e
// segurar um instante (xr-hands.wristLook). Desktop: M abre/fecha.
const MAP_PANEL_WIDTH = 0.2;
const MAP_PANEL_HEIGHT = 0.24;
const MAP_REDRAW_MS = 180;
const MAP_GREEN = '#39ff88';
const MAP_DIM = 'rgba(57, 255, 136, 0.45)';
const MAP_FAINT = 'rgba(57, 255, 136, 0.12)';
const MAP_MONO = '"Courier New", ui-monospace, monospace';

AFRAME.registerComponent('qps-map', {
  schema: {
    hand: { type: 'string', default: 'right' },
    toggleKey: { type: 'string', default: 'KeyM' },
  },

  init() {
    this.memory = null;
    this.lastMeasure = 0;
    this.opacity = 0;
    this.desktopOpen = false;
    this.lastDraw = 0;
    this.target = new THREE.Vector3();
    this.forward = new THREE.Vector3();

    this.canvas = document.createElement('canvas');
    this.canvas.width = 600;
    this.canvas.height = 720;
    this.texture = new THREE.CanvasTexture(this.canvas);
    if ('colorSpace' in this.texture) this.texture.colorSpace = THREE.SRGBColorSpace;
    this.material = new THREE.MeshBasicMaterial({
      map: this.texture, transparent: true, opacity: 0, toneMapped: false, fog: false, depthWrite: false,
    });
    this.panel = new THREE.Mesh(new THREE.PlaneGeometry(MAP_PANEL_WIDTH, MAP_PANEL_HEIGHT), this.material);
    this.panel.renderOrder = 900;
    this.el.setObject3D('mesh', this.panel);
    this.el.object3D.visible = false;

    this.onQps = () => {
      this.desktopOpen = true;
      this.measure();
    };
    // Mapa novo (andar novo ou lobby refeito): a memória do QPS recomeça.
    this.onWorld = () => {
      this.memory = null;
      this.measure();
    };
    this.onKey = (event) => {
      if (event.repeat || !window.quantumPlayer?.active) return;
      if (event.code === this.data.toggleKey) {
        this.desktopOpen = !this.desktopOpen;
        if (this.desktopOpen) this.draw();
      }
    };

    const scene = this.el.sceneEl;
    scene.addEventListener('qps-collected', this.onQps);
    scene.addEventListener('maze-world-updated', this.onWorld);
    window.addEventListener('keydown', this.onKey);
    window.quantumQpsMap = {
      state: () => ({
        hasQps: Boolean(window.quantumPlayer?.hasQps),
        measuredCells: this.memory ? this.memory.cells.flat().filter((cell) => cell !== null).length : 0,
        stale: this.staleSectors().map((sector) => sector.id),
        open: this.opacity > 0.5,
      }),
    };
    this.draw();
  },

  remove() {
    const scene = this.el.sceneEl;
    scene.removeEventListener('qps-collected', this.onQps);
    scene.removeEventListener('maze-world-updated', this.onWorld);
    window.removeEventListener('keydown', this.onKey);
    this.el.removeObject3D('mesh');
    this.panel.geometry.dispose();
    this.material.dispose();
    this.texture.dispose();
  },

  playerCell() {
    const tracker = this.el.parentEl?.components['xr-hands'];
    const world = window.quantumWorld;
    if (!tracker || !world) return null;
    return {
      x: (tracker.head.world.x - world.origin) / world.cellSize,
      z: (tracker.head.world.z - world.origin) / world.cellSize,
    };
  },

  sectorOf(x, z) {
    return window.quantumDecoherence?.sectors()
      .find((sector) => x >= sector.minX && x <= sector.maxX && z >= sector.minZ && z <= sector.maxZ) || null;
  },

  // Medição contínua: copia para a memória tudo o que está no raio do QPS,
  // anotando a versão do setor naquele instante.
  measure() {
    const world = window.quantumWorld;
    const player = this.playerCell();
    if (!world || !player || !window.quantumPlayer?.hasQps) return;
    if (!this.memory || this.memory.cells.length !== world.size) {
      this.memory = {
        cells: Array.from({ length: world.size }, () => Array(world.size).fill(null)),
        versions: Array.from({ length: world.size }, () => Array(world.size).fill(0)),
        superposed: new Set(),
      };
    }
    const radius = window.quantumPlayer.qpsRadius ?? 4;
    const versions = window.quantumDecoherence?.versions() || {};
    for (let z = Math.max(0, Math.floor(player.z - radius)); z <= Math.min(world.size - 1, Math.ceil(player.z + radius)); z += 1) {
      for (let x = Math.max(0, Math.floor(player.x - radius)); x <= Math.min(world.size - 1, Math.ceil(player.x + radius)); x += 1) {
        if (Math.hypot(x - player.x, z - player.z) > radius) continue;
        this.memory.cells[z][x] = world.maze[z][x];
        this.memory.versions[z][x] = versions[this.sectorOf(x, z)?.id] ?? 0;
        const key = `${x},${z}`;
        if (world.superposed.has(key)) this.memory.superposed.add(key);
        else this.memory.superposed.delete(key);
      }
    }
  },

  // Mesma regra de findPhaseTarget (maze-physics): andando reto, 1 ou 2
  // blocos de parede e depois chão livre que não seja a borda do mapa.
  phaseWalls(memory) {
    const cells = memory.cells;
    const size = cells.length;
    const solid = (x, z) => {
      const value = cells[z]?.[x];
      return value === '#' || value === 'F';
    };
    const free = (x, z) => cells[z]?.[x] === '.' && x > 0 && z > 0 && x < size - 1 && z < size - 1;
    const marked = new Map();
    for (let z = 1; z < size - 1; z += 1) {
      for (let x = 1; x < size - 1; x += 1) {
        if (!free(x, z)) continue;
        [[1, 0], [0, 1]].forEach(([dx, dz]) => {
          for (let length = 1; length <= 2; length += 1) {
            const run = Array.from({ length }, (_, i) => ({ x: x + dx * (i + 1), z: z + dz * (i + 1) }));
            if (!run.every((c) => solid(c.x, c.z))) break;
            // Superposição barra o salto de fase (só passa quando abre).
            if (run.some((c) => memory.superposed.has(`${c.x},${c.z}`))) break;
            if (free(x + dx * (length + 1), z + dz * (length + 1))) {
              run.forEach((c) => marked.set(`${c.x},${c.z}`, c));
              break;
            }
          }
        });
      }
    }
    return [...marked.values()];
  },

  isStale(x, z, versions) {
    const sector = this.sectorOf(x, z);
    return Boolean(sector) && (versions[sector.id] ?? 0) !== this.memory.versions[z][x];
  },

  // Setores com alguma célula lembrada que evoluiu depois de medida.
  staleSectors() {
    if (!this.memory || !window.quantumDecoherence) return [];
    const versions = window.quantumDecoherence.versions();
    return window.quantumDecoherence.sectors().filter((sector) => {
      for (let z = sector.minZ; z <= sector.maxZ; z += 1) {
        for (let x = sector.minX; x <= sector.maxX; x += 1) {
          if (this.memory.cells[z][x] !== null && this.isStale(x, z, versions)) return true;
        }
      }
      return false;
    });
  },

  draw() {
    const ctx = this.canvas.getContext('2d');
    const { width, height } = this.canvas;
    const pad = 26;
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = 'rgba(4, 12, 7, 0.93)';
    ctx.fillRect(4, 4, width - 8, height - 8);
    ctx.strokeStyle = MAP_DIM;
    ctx.lineWidth = 2;
    ctx.strokeRect(4, 4, width - 8, height - 8);

    ctx.textBaseline = 'top';
    ctx.fillStyle = MAP_GREEN;
    ctx.font = `bold 28px ${MAP_MONO}`;
    ctx.fillText('QPS // MAPA', pad, pad);
    ctx.font = `20px ${MAP_MONO}`;
    ctx.fillStyle = MAP_DIM;

    const world = window.quantumWorld;
    const memory = this.memory;
    if (!window.quantumPlayer?.hasQps || !memory || !world) {
      ctx.fillText('MEDIÇÃO CONTÍNUA AO SEU REDOR', pad, pad + 36);
      ctx.fillStyle = MAP_GREEN;
      ctx.font = `bold 24px ${MAP_MONO}`;
      ctx.fillText('SEM QPS', pad, height / 2 - 40);
      ctx.font = `18px ${MAP_MONO}`;
      ctx.fillStyle = MAP_DIM;
      if (window.quantumCoop?.active) {
        ctx.fillText('No cooperativo o QPS e o mapa', pad, height / 2);
        ctx.fillText('ficam com o operador: pergunte.', pad, height / 2 + 28);
      } else {
        ctx.fillText('Pegue o chip na ESTAÇÃO 3', pad, height / 2);
        ctx.fillText('do lobby (parede esquerda).', pad, height / 2 + 28);
      }
      this.texture.needsUpdate = true;
      return;
    }

    const stale = this.staleSectors();
    const radius = window.quantumPlayer.qpsRadius ?? 4;
    ctx.fillStyle = stale.length ? '#ffb347' : MAP_GREEN;
    ctx.fillText(`RAIO ${(radius * world.cellSize).toFixed(1)} M // ${stale.length ? `${stale.length} TRECHO(S) EVOLUÍRAM` : 'NADA MUDOU'}`, pad, pad + 36);

    const size = memory.cells.length;
    const top = pad + 70;
    const cell = Math.floor((width - pad * 2) / size);
    const left = Math.round((width - cell * size) / 2);
    const player = this.playerCell();
    const versions = window.quantumDecoherence?.versions() || {};
    const visor = Boolean(window.quantumPlayer?.visor);
    // Paredes comuns em tom neutro. Cor só para destacar: ciano = Salto de
    // Fase, lilás = superposição (cor do Visor Zeta), azul = objetos da sala,
    // amarelo = porta.
    const phase = new Set(this.phaseWalls(memory).map(({ x, z }) => `${x},${z}`));
    const neutral = (alpha) => `rgba(205, 200, 180, ${alpha})`;
    memory.cells.forEach((row, z) => {
      row.forEach((value, x) => {
        const px = left + x * cell;
        const pz = top + z * cell;
        if (value === null) {
          ctx.fillStyle = neutral(0.03);
          ctx.fillRect(px, pz, cell - 1, cell - 1);
          return;
        }
        const live = player && Math.hypot(x - player.x, z - player.z) <= radius;
        if (!live && this.isStale(x, z, versions)) {
          // Evoluiu depois da última medição: estática.
          ctx.fillStyle = neutral((0.08 + Math.random() * 0.4).toFixed(2));
        } else if (memory.superposed.has(`${x},${z}`)) {
          // Com o Visor Zeta ligado o roxo fica mais forte.
          const alpha = (visor ? 1 : 0.65) * (live ? 1 : 0.55);
          ctx.fillStyle = `rgba(201, 163, 255, ${alpha.toFixed(2)})`;
        } else if (phase.has(`${x},${z}`)) {
          ctx.fillStyle = live ? 'rgba(68, 255, 220, 0.95)' : 'rgba(68, 255, 220, 0.5)';
        } else if (value === 'F') {
          // Móveis do lobby.
          ctx.fillStyle = live ? 'rgba(70, 130, 255, 0.95)' : 'rgba(70, 130, 255, 0.5)';
        } else if (value === '#') {
          ctx.fillStyle = neutral(live ? 0.85 : 0.4);
        } else {
          ctx.fillStyle = neutral(live ? 0.14 : 0.06);
        }
        ctx.fillRect(px, pz, cell - 1, cell - 1);
      });
    });

    stale.forEach((sector) => {
      const cx = left + ((sector.minX + sector.maxX + 1) / 2) * cell;
      const cz = top + ((sector.minZ + sector.maxZ + 1) / 2) * cell;
      ctx.fillStyle = 'rgba(4, 12, 7, 0.75)';
      ctx.fillRect(cx - 18, cz - 18, 36, 36);
      ctx.fillStyle = '#ffb347';
      ctx.font = `bold 30px ${MAP_MONO}`;
      ctx.textAlign = 'center';
      ctx.fillText('?', cx, cz - 15);
      ctx.textAlign = 'left';
    });

    // Raio de medição em volta do jogador.
    if (player) {
      ctx.strokeStyle = 'rgba(57, 255, 136, 0.6)';
      ctx.setLineDash([6, 6]);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(left + (player.x + 0.5) * cell, top + (player.z + 0.5) * cell, radius * cell, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Objetos da sala (garrafas e equipamentos) que o QPS já leu, em azul.
    document.querySelectorAll('#quantum-map [data-item], #quantum-map [data-gear]').forEach((item) => {
      if (!item.object3D.visible) return;
      const position = item.object3D.position;
      const ix = Math.round((position.x - world.origin) / world.cellSize);
      const iz = Math.round((position.z - world.origin) / world.cellSize);
      if (memory.cells[iz]?.[ix] == null) return;
      ctx.fillStyle = 'rgb(70, 130, 255)';
      ctx.beginPath();
      ctx.arc(left + (ix + 0.5) * cell, top + (iz + 0.5) * cell, cell * 0.32, 0, Math.PI * 2);
      ctx.fill();
    });

    // Porta (quando já revelada) e posição atual do jogador.
    const mapInfo = document.querySelector('#quantum-map')?.components['quantum-map'];
    const stairs = mapInfo?.mapInfo?.stairs;
    if (stairs && (mapInfo.data.stairsVisible || mapInfo.mapInfo.lobby)) {
      ctx.fillStyle = '#e3cc4b';
      ctx.fillRect(left + stairs.x * cell - 2, top + stairs.z * cell - 2, cell + 3, cell + 3);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.strokeRect(left + stairs.x * cell - 2, top + stairs.z * cell - 2, cell + 3, cell + 3);
    } else if (mapInfo?.mapInfo?.doorCandidates?.length) {
      // Porta ainda em superposição (2 qubits no simulador): cada posição
      // possível pisca tracejada, mais forte quanto maior a chance, com o %.
      const chances = window.quantumPhysics?.doorPositionProbabilities?.(world) || [];
      const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 300);
      ctx.save();
      ctx.lineWidth = 2;
      ctx.setLineDash([3, 3]);
      ctx.font = `bold ${Math.max(9, Math.round(cell * 0.9))}px monospace`;
      ctx.textAlign = 'center';
      mapInfo.mapInfo.doorCandidates.forEach((door, index) => {
        const chance = chances.length === mapInfo.mapInfo.doorCandidates.length ? chances[index] : null;
        const strength = chance === null ? 0.6 : 0.15 + 0.85 * Math.min(1, chance * 1.6);
        ctx.strokeStyle = `rgba(227, 204, 75, ${(strength * (0.55 + 0.45 * pulse)).toFixed(2)})`;
        ctx.strokeRect(left + door.x * cell - 1, top + door.z * cell - 1, cell + 1, cell + 1);
        if (chance !== null) {
          ctx.fillStyle = `rgba(227, 204, 75, ${Math.max(0.5, strength).toFixed(2)})`;
          ctx.fillText(`${Math.round(chance * 100)}%`, left + (door.x + 0.5) * cell, top + door.z * cell - 3);
        }
      });
      ctx.restore();
    }
    const tracker = this.el.parentEl?.components['xr-hands'];
    if (tracker) {
      const px = left + ((tracker.head.world.x - world.origin) / world.cellSize + 0.5) * cell;
      const pz = top + ((tracker.head.world.z - world.origin) / world.cellSize + 0.5) * cell;
      const angle = Math.atan2(tracker.head.forward.z, tracker.head.forward.x);
      ctx.save();
      ctx.translate(px, pz);
      ctx.rotate(angle);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(cell * 0.9, 0);
      ctx.lineTo(-cell * 0.5, cell * 0.55);
      ctx.lineTo(-cell * 0.5, -cell * 0.55);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    const legendY = top + cell * size + 12;
    ctx.font = `17px ${MAP_MONO}`;
    ctx.fillStyle = MAP_DIM;
    ctx.fillText('CLARO: MEDINDO AGORA   APAGADO: ÚLTIMA LEITURA', pad, legendY);
    ctx.fillText(`? EVOLUIU SEM MEDIÇÃO   ${tracker?.inVr ? '' : '[M] FECHA'}`, pad, legendY + 20);
    ctx.fillStyle = 'rgb(68, 255, 220)';
    ctx.fillText('■ CIANO: SALTO DE FASE (X)', pad, legendY + 40);
    ctx.fillStyle = 'rgb(201, 163, 255)';
    ctx.fillText('■ LILÁS: SUPERPOSIÇÃO (Z)', pad + 290, legendY + 40);
    ctx.fillStyle = 'rgb(70, 130, 255)';
    ctx.fillText('● AZUL: OBJETOS', pad, legendY + 60);
    ctx.fillStyle = '#e3cc4b';
    ctx.fillText('■ AMARELO: PORTA  ┆ POSSÍVEL', pad + 200, legendY + 60);
    this.texture.needsUpdate = true;
  },

  tick(time, delta) {
    const tracker = this.el.parentEl?.components['xr-hands'];
    if (!tracker) return;
    if (time - this.lastMeasure > 200 && window.quantumPlayer?.active) {
      this.lastMeasure = time;
      this.measure();
    }
    const head = tracker.head;
    const hand = tracker.hands[this.data.hand];
    let show = false;

    if (tracker.inVr) {
      if (hand?.tracked) {
        this.el.object3D.position.copy(hand.position).add({ x: 0, y: 0.09, z: 0 });
        show = tracker.wristLook(this.data.hand, Math.min(0.1, delta / 1000));
        this.el.object3D.lookAt(head.world);
      }
    } else if (this.desktopOpen) {
      // Desktop: canto inferior direito do campo de visão (o Q-LINK fica à esquerda).
      this.forward.copy(head.forward).setY(0).normalize();
      const right = new THREE.Vector3(-this.forward.z, 0, this.forward.x);
      this.target.copy(head.world)
        .addScaledVector(head.forward, 0.42)
        .addScaledVector(right, 0.15)
        .add({ x: 0, y: 0.01, z: 0 });
      this.el.object3D.position.copy(this.el.object3D.parent.worldToLocal(this.target.clone()));
      this.el.object3D.lookAt(head.world);
      show = true;
    }

    const step = Math.min(1, (delta / 1000) * 6);
    this.opacity += ((show ? 1 : 0) - this.opacity) * step;
    if (this.opacity > 0.05 && time - this.lastDraw > MAP_REDRAW_MS) {
      this.lastDraw = time;
      this.draw();
    }
    this.material.opacity = this.opacity;
    this.el.object3D.visible = this.opacity > 0.02;
  },
});
