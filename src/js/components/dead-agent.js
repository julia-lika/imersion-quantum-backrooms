// Agente morta (campanha solo, andar 5): o corpo da agente que desceu antes do
// jogador, encostado numa parede num beco longe da entrada. Chegar perto
// dispara 'agent-found' na cena; phase-zero.js cuida do resto (frase, entidade
// furiosa, andares difíceis).
//
// Leitura contínua: window.quantumPlayer.agent = { show, found }
//   show: este andar tem o corpo; found: já foi encontrado (fica lá, sem disparar)
// O modelo (dead-hazmat-agent.glb) tem a origem no chão, as costas na parede em
// +Z e o corpo de x -0,26 a 0,75 m; já está em metros.
const AGENT_MODEL_OFFSET_X = -0.25;
const AGENT_WALL_GAP = 0.22;
const AGENT_NEIGHBORS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

AFRAME.registerComponent('dead-agent', {
  schema: {
    player: { type: 'selector' },
    radius: { type: 'number', default: 1.5 },
  },

  init() {
    this.cell = null;
    this.headPosition = new THREE.Vector3();
    this.bodyPosition = new THREE.Vector3();

    this.body = document.createElement('a-entity');
    this.body.setAttribute('id', 'dead-agent-body');
    this.model = document.createElement('a-entity');
    this.model.setAttribute('gltf-model', '#dead-agent-model');
    this.model.setAttribute('position', `${AGENT_MODEL_OFFSET_X} 0 0`);
    this.model.setAttribute('shadow', 'cast: false; receive: false');
    this.body.appendChild(this.model);

    // Luz fria piscando sobre o corpo: um sinal de longe, no fim do corredor.
    const light = document.createElement('a-entity');
    light.setAttribute('light', 'type: point; color: #ff3b2f; intensity: 0.9; distance: 4.5; decay: 1.4');
    light.setAttribute('position', '0 2.1 -0.5');
    light.setAttribute('light-flicker', 'min: 0.35; max: 1.0; interval: 160');
    this.body.appendChild(light);

    this.el.appendChild(this.body);
    this.el.object3D.visible = false;

    this.onWorld = ({ detail }) => {
      this.cell = null;
      if (detail?.lobby) return;
      this.place();
    };
    this.onShift = () => {
      if (!this.cell || this.isValidCell(this.cell.x, this.cell.z, this.cell.wall)) return;
      this.place();
    };
    this.el.sceneEl.addEventListener('maze-world-updated', this.onWorld);
    this.el.sceneEl.addEventListener('maze-region-shifted', this.onShift);
  },

  remove() {
    this.el.sceneEl.removeEventListener('maze-world-updated', this.onWorld);
    this.el.sceneEl.removeEventListener('maze-region-shifted', this.onShift);
  },

  isSolidWall(world, x, z) {
    const key = `${x},${z}`;
    return world.maze[z]?.[x] === '#' && !world.superposed?.has(key);
  },

  isValidCell(x, z, wall) {
    const world = window.quantumWorld;
    if (!world || world.maze[z]?.[x] !== '.') return false;
    return !wall || this.isSolidWall(world, x + wall.dx, z + wall.dz);
  },

  // Escolhe um beco longe da entrada (pelo caminho do labirinto), fora das
  // posições possíveis da porta e das garrafas.
  pickCell() {
    const world = window.quantumWorld;
    const start = window.quantumPhysics?.START_CELL || { x: 1, z: 1 };
    const mapInfo = document.querySelector('[quantum-map]')?.components['quantum-map']?.mapInfo;
    const avoid = new Set([
      ...(mapInfo?.doorCandidates || []),
      ...(document.querySelector('[quantum-map]')?.components['quantum-map']?.itemCells || []),
    ].filter(Boolean).map((cell) => `${cell.x},${cell.z}`));

    const distance = new Map([[`${start.x},${start.z}`, 0]]);
    const queue = [start];
    while (queue.length) {
      const cell = queue.shift();
      const d = distance.get(`${cell.x},${cell.z}`);
      AGENT_NEIGHBORS.forEach(([dx, dz]) => {
        const x = cell.x + dx;
        const z = cell.z + dz;
        const key = `${x},${z}`;
        if (distance.has(key) || world.maze[z]?.[x] !== '.') return;
        distance.set(key, d + 1);
        queue.push({ x, z });
      });
    }

    let best = null;
    distance.forEach((d, key) => {
      if (avoid.has(key)) return;
      const [x, z] = key.split(',').map(Number);
      const walls = AGENT_NEIGHBORS.filter(([dx, dz]) => this.isSolidWall(world, x + dx, z + dz));
      if (!walls.length) return;
      // Beco (3 paredes) vale mais: o corpo fica escondido no fim do corredor.
      const score = d + (walls.length >= 3 ? 6 : 0);
      if (!best || score > best.score) {
        // Encosta na parede oposta à saída do beco (ou na primeira sólida).
        const open = AGENT_NEIGHBORS.find(([dx, dz]) => world.maze[z + dz]?.[x + dx] === '.');
        const back = open && this.isSolidWall(world, x - open[0], z - open[1])
          ? [-open[0], -open[1]]
          : walls[0];
        best = { x, z, score, wall: { dx: back[0], dz: back[1] } };
      }
    });
    return best;
  },

  place() {
    const world = window.quantumWorld;
    if (!world) return;
    const cell = this.pickCell();
    this.cell = cell;
    if (!cell) return;

    const center = window.quantumPhysics.cellToWorld(world, cell.x, cell.z);
    const toWall = world.cellSize / 2 - AGENT_WALL_GAP;
    this.body.object3D.position.set(center.x + cell.wall.dx * toWall, 0, center.z + cell.wall.dz * toWall);
    // As costas (+Z do modelo) ficam viradas para a parede.
    this.body.object3D.rotation.set(0, Math.atan2(cell.wall.dx, cell.wall.dz), 0);
    window.quantumAgentStats = { cell: `${cell.x},${cell.z}`, wall: `${cell.wall.dx},${cell.wall.dz}` };
  },

  tick() {
    const agent = window.quantumPlayer?.agent;
    const show = Boolean(agent?.show && this.cell);
    this.el.object3D.visible = show;
    if (!show || agent.found || !window.quantumPlayer.active || !this.data.player) return;

    this.data.player.object3D.getWorldPosition(this.headPosition);
    this.body.object3D.getWorldPosition(this.bodyPosition);
    const distance = Math.hypot(this.headPosition.x - this.bodyPosition.x, this.headPosition.z - this.bodyPosition.z);
    if (distance <= this.data.radius) {
      agent.found = true;
      this.el.sceneEl.emit('agent-found', { cell: this.cell });
    }
  },
});
