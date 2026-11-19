AFRAME.registerComponent('door-proximity-animation', {
  schema: {
    target: { type: 'selector' },
    radius: { type: 'number', default: 2.5 },
  },

  init() {
    this.openRequested = false;
    this.opened = false;
    this.playerPosition = new THREE.Vector3();
    this.doorPosition = new THREE.Vector3();
    this.onModelLoaded = () => {
      this.modelReady = true;
      this.openIfReady();
    };
    this.modelReady = Boolean(this.el.getObject3D('mesh'));
    this.el.addEventListener('model-loaded', this.onModelLoaded);
  },

  remove() {
    this.el.removeEventListener('model-loaded', this.onModelLoaded);
  },

  tick() {
    const target = this.data.target;
    if (this.openRequested || !target) return;

    this.el.object3D.getWorldPosition(this.doorPosition);
    target.object3D.getWorldPosition(this.playerPosition);
    const distance = Math.hypot(
      this.doorPosition.x - this.playerPosition.x,
      this.doorPosition.z - this.playerPosition.z
    );

    if (distance <= this.data.radius) {
      this.openRequested = true;
      this.openIfReady();
    }
  },

  openIfReady() {
    if (!this.openRequested || !this.modelReady || this.opened) return;

    this.opened = true;
    this.el.setAttribute(
      'animation-mixer',
      'clip: open; loop: once; clampWhenFinished: true'
    );
  },
});

AFRAME.registerComponent('quantum-map', {
  schema: {
    bitstring: { type: 'string', default: '010110101100' },
    stairsVisible: { type: 'boolean', default: false },
    floor: { type: 'number', default: 1 },
  },

  init() {
    this.consumed = new Set();
    this.onItemConsumed = ({ detail }) => this.consumed.add(detail.id);
    this.el.sceneEl.addEventListener('qps-collected', this.onItemConsumed);
    this.el.sceneEl.addEventListener('almond-water-drunk', this.onItemConsumed);
    this.onGeneratorReady = () => this.renderMap();
    window.addEventListener('quantum-generator-ready', this.onGeneratorReady);
    this.renderMap();
  },

  remove() {
    window.removeEventListener('quantum-generator-ready', this.onGeneratorReady);
    this.el.sceneEl.removeEventListener('qps-collected', this.onItemConsumed);
    this.el.sceneEl.removeEventListener('almond-water-drunk', this.onItemConsumed);
  },

  update(oldData) {
    if (oldData.floor !== undefined && oldData.floor !== this.data.floor) {
      this.consumed.clear();
    }

    if (
      oldData.floor !== this.data.floor ||
      oldData.bitstring !== this.data.bitstring ||
      oldData.stairsVisible !== this.data.stairsVisible
    ) {
      this.renderMap();
    }
  },

  renderMap() {
    const physics = window.quantumPhysics;
    if (typeof window.generateQuantumMap !== 'function' || !physics) return;

    this.el.replaceChildren();
    const map = window.generateQuantumMap(this.data.bitstring);
    const cellSize = physics.CELL_SIZE;
    const origin = -((cellSize * 11) / 2) + cellSize / 2;
    const superposed = physics.findSuperposedWalls(map.maze, map.bitstring);
    const superposedOffsets = new Map(superposed.map(({ x, z, offset }) => [`${x},${z}`, offset]));

    window.quantumWorld = physics.createMazeWorld(map.maze, { cellSize, superposed });

    map.maze.forEach((row, z) => {
      row.forEach((cell, x) => {
        if (cell !== '#') return;

        const wall = document.createElement('a-box');
        const offset = superposedOffsets.get(`${x},${z}`);
        if (offset !== undefined) wall.setAttribute('superposed-wall', { offset });
        wall.setAttribute('width', cellSize + 0.03);
        wall.setAttribute('height', '4.7');
        wall.setAttribute('depth', cellSize + 0.03);
        wall.setAttribute('position', `${origin + x * cellSize} 2.35 ${origin + z * cellSize}`);
        wall.setAttribute('backrooms-wall', 'repeat: 1 1; offset: 0 0; textureScale: 1');
        this.el.appendChild(wall);
      });
    });

    map.roomCenters.forEach(([roomX, roomZ], roomIndex) => {
      this.addStrangeRoom(roomX, roomZ, roomIndex, origin, cellSize);
    });

    this.addMarker(1, 1, '#ffe69b', 'ENTRADA');

    if (this.data.stairsVisible) {
      this.addStairs(map.stairs.x, map.stairs.z, origin, cellSize);
    }

    this.addItems(map, origin, cellSize);
    this.el.setAttribute('data-map-state', map.state);
    window.quantumMapStats = {
      renders: (window.quantumMapStats?.renders ?? 0) + 1,
      bitstring: map.bitstring,
      stairsVisible: this.data.stairsVisible,
      stairs: `${map.stairs.x},${map.stairs.z}`,
      doorModel: Boolean(document.querySelector('#door-yellow-model')?.data),
    };
    this.el.sceneEl.emit('maze-world-updated', { stairs: map.stairs });
  },

  // Um QPS por andar (até ser coletado) e garrafas de Almond Water espalhadas.
  addItems(map, origin, cellSize) {
    const exclude = [
      { x: 1, z: 1 }, { x: 2, z: 1 }, { x: 1, z: 2 },
      { x: map.stairs.x, z: map.stairs.z },
    ];
    const cells = window.quantumPhysics.pickFloorCells(map.maze, map.bitstring, 3, exclude);
    const items = [
      { type: 'qps', cell: cells[0], skip: this.data.stairsVisible },
      { type: 'almond-water', cell: cells[1] },
      { type: 'almond-water', cell: cells[2] },
    ];

    items.forEach(({ type, cell, skip }, index) => {
      const id = `${this.data.floor}-${type}-${index}`;
      if (!cell || skip || this.consumed.has(id)) return;

      const item = type === 'qps' ? this.createQps() : this.createAlmondWater();
      item.setAttribute('position', `${origin + cell.x * cellSize} 1.05 ${origin + cell.z * cellSize}`);
      item.dataset.item = type;
      item.dataset.itemId = id;
      this.el.appendChild(item);
    });
  },

  createQps() {
    const qps = document.createElement('a-entity');
    const device = document.createElement('a-box');
    device.setAttribute('width', '0.16');
    device.setAttribute('height', '0.05');
    device.setAttribute('depth', '0.1');
    device.setAttribute('material', 'color: #1b2a2a; emissive: #44ffcc; emissiveIntensity: 0.35');
    const screen = document.createElement('a-plane');
    screen.setAttribute('width', '0.12');
    screen.setAttribute('height', '0.07');
    screen.setAttribute('rotation', '-90 0 0');
    screen.setAttribute('position', '0 0.027 0');
    screen.setAttribute('material', 'color: #44ffcc; shader: flat');
    screen.setAttribute('animation', 'property: material.opacity; from: 0.35; to: 1; dir: alternate; loop: true; dur: 600');
    const glow = document.createElement('a-entity');
    glow.setAttribute('light', 'type: point; color: #44ffcc; intensity: 0.6; distance: 2.5');
    qps.append(device, screen, glow);
    qps.setAttribute('animation', 'property: rotation; to: 0 360 0; loop: true; dur: 6000; easing: linear');
    return qps;
  },

  createAlmondWater() {
    const bottle = document.createElement('a-entity');
    const body = document.createElement('a-cylinder');
    body.setAttribute('radius', '0.04');
    body.setAttribute('height', '0.2');
    body.setAttribute('material', 'color: #f4ead2; opacity: 0.75; transparent: true; roughness: 0.2');
    const cap = document.createElement('a-cylinder');
    cap.setAttribute('radius', '0.022');
    cap.setAttribute('height', '0.04');
    cap.setAttribute('position', '0 0.12 0');
    cap.setAttribute('color', '#ffcc44');
    bottle.append(body, cap);
    bottle.setAttribute('animation', 'property: rotation; to: 0 360 0; loop: true; dur: 9000; easing: linear');
    return bottle;
  },

  addStairs(stairsX, stairsZ, origin, cellSize) {
    const centerX = origin + stairsX * cellSize;
    const centerZ = origin + stairsZ * cellSize;
    const stairs = document.createElement('a-entity');

    stairs.setAttribute('id', 'stairs');
    stairs.setAttribute('position', `${centerX} 0 ${centerZ}`);
    stairs.setAttribute('data-stairs', 'true');

    const door = document.createElement('a-entity');
    door.setAttribute('gltf-model', '#door-yellow-model');
    door.setAttribute('door-proximity-animation', 'target: #player-head; radius: 2.5');
    door.setAttribute('class', 'door-yellow');
    stairs.appendChild(door);

    // Farol: feixe ciano pulsante que aparece mesmo se o modelo da porta demorar
    // ou falhar, e que se vê de longe pelos corredores (também em VR).
    const beacon = document.createElement('a-cylinder');
    beacon.setAttribute('radius', '0.08');
    beacon.setAttribute('height', '4.6');
    beacon.setAttribute('position', '0 2.3 0');
    beacon.setAttribute('material', 'color: #44ffcc; shader: flat; transparent: true; opacity: 0.55');
    beacon.setAttribute('animation', 'property: material.opacity; from: 0.25; to: 0.7; dir: alternate; loop: true; dur: 900');
    stairs.appendChild(beacon);

    const trigger = document.createElement('a-box');
    trigger.setAttribute('id', 'stairs-trigger');
    trigger.setAttribute('visible', 'false');
    trigger.setAttribute('width', '1.8');
    trigger.setAttribute('height', '2.2');
    trigger.setAttribute('depth', '1.8');
    trigger.setAttribute('position', '0 1 0');
    trigger.setAttribute('class', 'stairs-collider');
    trigger.setAttribute('floor-transition', 'target: #player-head; radius: 0.75');
    stairs.appendChild(trigger);

    this.el.appendChild(stairs);
  },

  addStrangeRoom(roomX, roomZ, roomIndex, origin, cellSize) {
    const centerX = origin + roomX * cellSize;
    const centerZ = origin + roomZ * cellSize;
    const offsets = [
      [-1.05, -1.05],
      [1.05, -1.05],
      [-1.05, 1.05],
      [1.05, 1.05],
    ];

    offsets.forEach(([offsetX, offsetZ], pillarIndex) => {
      const pillar = document.createElement('a-box');
      const skew = pillarIndex === roomIndex % offsets.length ? 0.22 : 0;
      pillar.setAttribute('width', '0.24');
      pillar.setAttribute('height', '4.7');
      pillar.setAttribute('depth', '0.24');
      pillar.setAttribute('position', `${centerX + offsetX + skew} 2.35 ${centerZ + offsetZ}`);
      pillar.setAttribute('backrooms-wall', 'repeat: 1 1; offset: 0 0; textureScale: 1');
      this.el.appendChild(pillar);
    });

    const beam = document.createElement('a-box');
    beam.setAttribute('width', '2.8');
    beam.setAttribute('height', '0.18');
    beam.setAttribute('depth', '0.22');
    beam.setAttribute('position', `${centerX} 4.48 ${centerZ}`);
    beam.setAttribute(
      'backrooms-wall',
      'repeat: 1 1; offset: 0 0; textureScale: 1'
    );
    this.el.appendChild(beam);

    const crossBeam = document.createElement('a-box');
    crossBeam.setAttribute('width', '0.22');
    crossBeam.setAttribute('height', '0.14');
    crossBeam.setAttribute('depth', '2.8');
    crossBeam.setAttribute('position', `${centerX} 4.58 ${centerZ}`);
    crossBeam.setAttribute(
      'backrooms-wall',
      'repeat: 1 1; offset: 0 0; textureScale: 1'
    );
    this.el.appendChild(crossBeam);
  },

  addMarker(x, z, color, label) {
    const marker = document.createElement('a-cylinder');
    const cellSize = window.quantumPhysics.CELL_SIZE;
    const origin = -((cellSize * 11) / 2) + cellSize / 2;

    marker.setAttribute('radius', '0.28');
    marker.setAttribute('height', '0.08');
    marker.setAttribute('color', color);
    marker.setAttribute('position', `${origin + x * cellSize} 0.12 ${origin + z * cellSize}`);
    marker.setAttribute('animation', 'property: material.emissiveIntensity; from: 0.2; to: 0.9; dir: alternate; loop: true; dur: 900');
    marker.setAttribute('data-label', label);
    this.el.appendChild(marker);
  },
});
