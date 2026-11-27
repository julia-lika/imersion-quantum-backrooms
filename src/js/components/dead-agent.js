// Agente morta (campanha solo, andar 5): o corpo da agente que desceu antes do
// jogador, encostado na parede no fim do primeiro corredor a caminho da porta. Chegar perto
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
    light.setAttribute('light', 'type: point; color: #ff3b2f; intensity: 1.6; distance: 7; decay: 1.2');
    light.setAttribute('position', '0 2.1 -0.5');
    light.setAttribute('light-flicker', 'min: 0.7; max: 1.8; interval: 160');
    this.body.appendChild(light);

    // Luz fria de frente: o corpo fica bem visível, não só um vulto vermelho.
    const fill = document.createElement('a-entity');
    fill.setAttribute('light', 'type: point; color: #ffe2c8; intensity: 1.1; distance: 3.2; decay: 1.5');
    fill.setAttribute('position', '0.25 1.6 -1.1');
    this.body.appendChild(fill);

    // Sinalizador de emergência no peito: pisca vermelho e se vê de longe na névoa.
    const beacon = document.createElement('a-sphere');
    beacon.setAttribute('radius', '0.05');
    beacon.setAttribute('position', `${0.05} 0.62 -0.12`);
    beacon.setAttribute('material', 'shader: flat; color: #ff2a1f; fog: false');
    beacon.setAttribute('animation', 'property: scale; from: 0.6 0.6 0.6; to: 1.6 1.6 1.6; dir: alternate; loop: true; dur: 450; easing: easeInOutSine');
    this.body.appendChild(beacon);
    const strobe = document.createElement('a-entity');
    strobe.setAttribute('light', 'type: point; color: #ff1a10; intensity: 0; distance: 3.5');
    strobe.setAttribute('position', '0.05 0.75 -0.4');
    strobe.setAttribute('animation', 'property: light.intensity; from: 0; to: 2.2; dir: alternate; loop: true; dur: 450; easing: easeInOutSine');
    this.body.appendChild(strobe);

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

  // Põe o corpo onde o jogador dá de cara com ela: no caminho mais curto da
  // entrada até a porta, no fim do primeiro corredor reto (a parede em frente
  // de quem anda por ele), a pelo menos 4 células da entrada. Ela fica de
  // frente para quem chega. Sem um ponto assim, cai num beco longe da entrada.
  pickCell() {
    const world = window.quantumWorld;
    const start = window.quantumPhysics?.START_CELL || { x: 1, z: 1 };
    const component = document.querySelector('[quantum-map]')?.components['quantum-map'];
    const doors = component?.mapInfo?.doorCandidates || [];
    const avoid = new Set([...doors, ...(component?.itemCells || [])]
      .filter(Boolean).map((cell) => `${cell.x},${cell.z}`));

    const parent = new Map([[`${start.x},${start.z}`, null]]);
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
        parent.set(key, cell);
        queue.push({ x, z });
      });
    }

    const door = doors
      .filter((cell) => distance.has(`${cell.x},${cell.z}`))
      .sort((a, b) => distance.get(`${a.x},${a.z}`) - distance.get(`${b.x},${b.z}`))[0];
    const onPath = door ? this.pathFacing(world, parent, door, avoid) : null;
    return onPath || this.farDeadEnd(world, distance, avoid);
  },

  pathFacing(world, parent, door, avoid) {
    const path = [];
    for (let cell = door; cell; cell = parent.get(`${cell.x},${cell.z}`)) path.unshift(cell);
    let fallback = null;
    let side = null;
    let run = 0;
    for (let i = 1; i < path.length - 1; i += 1) {
      const dx = path[i].x - path[i - 1].x;
      const dz = path[i].z - path[i - 1].z;
      const sameDirection = i > 1 && dx === path[i - 1].x - path[i - 2].x && dz === path[i - 1].z - path[i - 2].z;
      run = sameDirection ? run + 1 : 1;
      if (i < 4 || avoid.has(`${path[i].x},${path[i].z}`)) continue;
      if (!this.isSolidWall(world, path[i].x + dx, path[i].z + dz)) {
        // Sala aberta: encosta numa parede do lado do caminho, ainda à vista.
        const wall = [[dz, dx], [-dz, -dx]].find(([sx, sz]) => this.isSolidWall(world, path[i].x + sx, path[i].z + sz));
        if (wall && !side) side = { x: path[i].x, z: path[i].z, score: i, wall: { dx: wall[0], dz: wall[1] } };
        continue;
      }
      const pick = { x: path[i].x, z: path[i].z, score: i, wall: { dx, dz } };
      // Corredor reto de 3+ células: dá para ver o corpo de longe, de frente.
      if (run >= 3) return pick;
      fallback ||= pick;
    }
    return fallback || side;
  },

  farDeadEnd(world, distance, avoid) {
    let best = null;
    distance.forEach((d, key) => {
      if (avoid.has(key)) return;
      const [x, z] = key.split(',').map(Number);
      const walls = AGENT_NEIGHBORS.filter(([dx, dz]) => this.isSolidWall(world, x + dx, z + dz));
      if (!walls.length) return;
      const score = d + (walls.length >= 3 ? 6 : 0);
      if (!best || score > best.score) {
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
