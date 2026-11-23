import { buildLightPanels, buildWallGeometry } from './level-geometry.js';

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
    this.materials = this.createMaterials();
    this.consumed = new Set();
    this.onItemConsumed = ({ detail }) => this.consumed.add(detail.id);
    this.el.sceneEl.addEventListener('qps-collected', this.onItemConsumed);
    this.el.sceneEl.addEventListener('almond-water-drunk', this.onItemConsumed);
    this.onGeneratorReady = () => this.renderMap();
    window.addEventListener('quantum-generator-ready', this.onGeneratorReady);
    this.renderMap();
  },

  remove() {
    this.clearStaticMeshes();
    Object.values(this.materials).forEach((material) => {
      material.map?.dispose();
      material.dispose();
    });
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
    this.clearStaticMeshes();
    const map = window.generateQuantumMap(this.data.bitstring);
    const cellSize = physics.CELL_SIZE;
    const size = map.maze.length;
    const height = physics.WALL_HEIGHT;
    const origin = -((cellSize * size) / 2) + cellSize / 2;
    const superposed = physics.findSuperposedWalls(map.maze, map.bitstring);
    const superposedOffsets = new Map(superposed.map(({ x, z, offset }) => [`${x},${z}`, offset]));

    window.quantumWorld = physics.createMazeWorld(map.maze, { cellSize, superposed });

    // Paredes fixas viram um único mesh (poucas draw calls no Quest).
    const { walls, baseboards } = buildWallGeometry(map.maze, {
      origin,
      cellSize,
      height,
      tile: 0.8,
      isStatic: (x, z) => !superposedOffsets.has(`${x},${z}`),
    });
    this.addStaticMesh('walls', walls, this.materials.wall);
    this.addStaticMesh('baseboards', baseboards, this.materials.baseboard);

    const { panels, fixtures } = buildLightPanels(map.maze, {
      origin,
      cellSize,
      height,
      random: this.seededRandom(map.bitstring),
    });
    this.addStaticMesh('light-panels', panels, this.materials.lightPanel);
    window.quantumLightFixtures = fixtures;

    // Paredes em superposição continuam separadas porque mudam de material.
    superposed.forEach(({ x, z, offset }) => {
      const wall = document.createElement('a-box');
      wall.setAttribute('superposed-wall', { offset });
      wall.setAttribute('width', cellSize + 0.01);
      wall.setAttribute('height', height);
      wall.setAttribute('depth', cellSize + 0.01);
      wall.setAttribute('position', `${origin + x * cellSize} ${height / 2} ${origin + z * cellSize}`);
      wall.setAttribute('backrooms-wall', 'repeat: 1 1; offset: 0 0; textureScale: 0.8');
      this.el.appendChild(wall);
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
    this.el.sceneEl.emit('maze-world-updated', { stairs: map.stairs, items: this.itemCells });
  },

  // Um QPS por andar (até ser coletado) e garrafas de Almond Water espalhadas.
  addItems(map, origin, cellSize) {
    const exclude = [
      { x: 1, z: 1 }, { x: 2, z: 1 }, { x: 1, z: 2 },
      { x: map.stairs.x, z: map.stairs.z },
    ];
    const cells = window.quantumPhysics.pickFloorCells(map.maze, map.bitstring, 3, exclude);
    // Os props evitam estas células para não esconder o QPS nem as garrafas.
    this.itemCells = cells;
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
    const beaconHeight = window.quantumPhysics.WALL_HEIGHT - 0.1;
    beacon.setAttribute('height', beaconHeight);
    beacon.setAttribute('position', `0 ${beaconHeight / 2} 0`);
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

  createMaterials() {
    const loader = new THREE.TextureLoader();
    const texture = (selector, fallback) => {
      const src = document.querySelector(selector)?.getAttribute('src') || fallback;
      const map = loader.load(src);
      map.wrapS = THREE.RepeatWrapping;
      map.wrapT = THREE.RepeatWrapping;
      map.anisotropy = 4;
      if ('colorSpace' in map) map.colorSpace = THREE.SRGBColorSpace;
      return map;
    };

    return {
      wall: new THREE.MeshStandardMaterial({
        map: texture('#wall-texture', 'assets/textures/level0/wallpaper-color.jpg'),
        roughness: 0.95,
        metalness: 0,
      }),
      baseboard: new THREE.MeshStandardMaterial({ color: '#8c7a4c', roughness: 0.8, metalness: 0 }),
      lightPanel: new THREE.MeshBasicMaterial({
        map: texture('#light-panel-texture', 'assets/textures/level0/light-panel.jpg'),
        vertexColors: true,
        color: '#fff4d6',
      }),
    };
  },

  addStaticMesh(name, buffers, material) {
    if (buffers.indices.length === 0) return;

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(buffers.positions, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(buffers.normals, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(buffers.uvs, 2));
    if (buffers.colors.length > 0) {
      geometry.setAttribute('color', new THREE.Float32BufferAttribute(buffers.colors, 3));
    }
    geometry.setIndex(buffers.indices);
    geometry.computeBoundingSphere();
    this.el.setObject3D(name, new THREE.Mesh(geometry, material));
    this.staticMeshes = [...(this.staticMeshes || []), name];
  },

  clearStaticMeshes() {
    (this.staticMeshes || []).forEach((name) => {
      const mesh = this.el.getObject3D(name);
      if (!mesh) return;
      mesh.geometry.dispose();
      this.el.removeObject3D(name);
    });
    this.staticMeshes = [];
  },

  seededRandom(bitstring) {
    let seed = Number.parseInt(bitstring, 2) + 7 || 7;
    return () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };
  },

  addMarker(x, z, color, label) {
    const marker = document.createElement('a-cylinder');
    const cellSize = window.quantumPhysics.CELL_SIZE;
    const size = window.quantumWorld?.size ?? window.quantumPhysics.MAZE_SIZE;
    const origin = -((cellSize * size) / 2) + cellSize / 2;

    marker.setAttribute('radius', '0.28');
    marker.setAttribute('height', '0.08');
    marker.setAttribute('color', color);
    marker.setAttribute('position', `${origin + x * cellSize} 0.12 ${origin + z * cellSize}`);
    marker.setAttribute('animation', 'property: material.emissiveIntensity; from: 0.2; to: 0.9; dir: alternate; loop: true; dur: 900');
    marker.setAttribute('data-label', label);
    this.el.appendChild(marker);
  },
});
