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
    window.clearTimeout(this.pauseTimer);
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
    // O clipe "open" abre até ~100° e fecha de novo (2,4 s): congela no meio,
    // com a porta aberta para a escuridão.
    this.pauseTimer = window.setTimeout(() => {
      if (this.el.isConnected) this.el.setAttribute('animation-mixer', 'timeScale', 0);
    }, 1200);
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
    // Andar 0 = lobby de treinamento (sala fixa); os outros vêm do bitstring.
    const lobby = this.data.floor === 0 && typeof window.generateLobbyMap === 'function';
    const map = lobby ? window.generateLobbyMap() : window.generateQuantumMap(this.data.bitstring);
    const cellSize = physics.CELL_SIZE;
    const size = map.maze.length;
    const height = physics.WALL_HEIGHT;
    const origin = -((cellSize * size) / 2) + cellSize / 2;
    const superposed = lobby ? [] : physics.findSuperposedWalls(map.maze, map.bitstring);
    const superposedOffsets = new Map(superposed.map(({ x, z, offset }) => [`${x},${z}`, offset]));

    window.quantumWorld = physics.createMazeWorld(map.maze, { cellSize, superposed });

    // Paredes fixas viram um único mesh (poucas draw calls no Quest).
    const { walls, baseboards } = buildWallGeometry(map.maze, {
      origin,
      cellSize,
      height,
      tile: 0.8,
      isStatic: (x, z) => !superposedOffsets.has(`${x},${z}`),
      doorway: this.data.stairsVisible || lobby ? map.stairs : null,
    });
    this.addStaticMesh('walls', walls, this.materials.wall);
    this.addStaticMesh('baseboards', baseboards, this.materials.baseboard);

    const { panels, fixtures } = buildLightPanels(map.maze, {
      origin,
      cellSize,
      height,
      random: this.seededRandom(map.bitstring),
      offChance: lobby ? 0 : 0.3,
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

    if (lobby) this.addLobby(origin, cellSize);

    if (this.data.stairsVisible || lobby) {
      this.addStairs(map.stairs, origin, cellSize);
    }

    if (lobby) this.addLobbyItems(origin, cellSize);
    else this.addItems(map, origin, cellSize);
    this.el.setAttribute('data-map-state', map.state);
    window.quantumMapStats = {
      renders: (window.quantumMapStats?.renders ?? 0) + 1,
      bitstring: map.bitstring,
      stairsVisible: this.data.stairsVisible,
      stairs: `${map.stairs.x},${map.stairs.z}`,
      doorModel: Boolean(document.querySelector('#door-yellow-model')?.data),
    };
    this.el.sceneEl.emit('maze-world-updated', { stairs: map.stairs, items: this.itemCells, lobby });
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

  // Lobby: QPS de treino (não mede nada) e uma Almond Water de verdade.
  addLobbyItems(origin, cellSize) {
    const { almondWater, qps } = window.LOBBY_LAYOUT.items;
    this.itemCells = [almondWater, qps];
    [
      { type: 'qps', cell: qps, id: '0-qps-training', training: true },
      { type: 'almond-water', cell: almondWater, id: '0-almond-water-0' },
    ].forEach(({ type, cell, id, training }) => {
      if (this.consumed.has(id)) return;
      const item = type === 'qps' ? this.createQps() : this.createAlmondWater();
      item.setAttribute('position', `${origin + cell.x * cellSize} 1.05 ${origin + cell.z * cellSize}`);
      item.dataset.item = type;
      item.dataset.itemId = id;
      if (training) item.dataset.training = 'true';
      this.el.appendChild(item);
    });
  },

  addLobby(origin, cellSize) {
    const at = (cell) => origin + cell * cellSize;
    const half = cellSize / 2;
    const leftWall = at(0) + half + 0.02;
    const rightWall = at(11) + half - 0.02;
    const farWall = at(17) + half - 0.02;

    const furniture = document.createElement('a-entity');
    // Nos modelos do pack, a frente de cada móvel aponta para -Z.
    furniture.lobbyLayout = [
      { piece: 'sofa', x: at(0) + half + 0.7, z: at(5), rotation: -90 },
      { piece: 'armchair', x: at(3), z: at(5), rotation: 90 },
      { piece: 'desk', x: at(5.5), z: at(4), rotation: 0 },
      { piece: 'officeChair', x: at(5.5), z: at(4.85), rotation: 0 },
      { piece: 'metalTable', x: rightWall - 0.6, z: at(7.5), rotation: 90 },
      { piece: 'terminal', x: rightWall - 0.6, z: at(7.5), y: 0.75, rotation: 90 },
      { piece: 'blueChair', x: at(10), z: at(7.5), rotation: -90 },
    ];
    furniture.setAttribute('lobby-furniture', '');
    this.el.appendChild(furniture);

    const notebook = document.createElement('a-entity');
    notebook.setAttribute('position', `${at(5.5)} 0.76 ${at(4) - 0.3}`);
    notebook.setAttribute('rotation', '0 168 0');
    notebook.setAttribute('lobby-notebook', '');
    this.el.appendChild(notebook);

    const signs = [
      {
        x: rightWall, z: at(2.5), rotation: -90,
        title: 'FASE 0 // LOBBY', subtitle: 'TREINAMENTO',
        body: 'Bem-vindo, agente. Este é o lobby de treinamento.\n\nANDAR: balance os braços (VR) ou WASD/setas. Q e E giram.\n\nLeia as estações ao longo do salão e abra o CADERNO na mesa: toque com a mão (VR), clique ou aperte E.',
      },
      {
        x: leftWall, z: at(8), rotation: 90,
        title: 'PAINEL DO PULSO', subtitle: 'Q-LINK',
        body: 'Olhe para o pulso esquerdo (VR) ou aperte H (desktop) para abrir o Q-LINK: ANDAR, SANIDADE, ENERGIA, ZETA VISOR, distância da ENTIDADE e OBJETIVO.\n\nA sanidade cai com o tempo e perto da entidade. A energia alimenta o visor e o phase shift.',
      },
      {
        x: rightWall, z: at(10.5), rotation: -90,
        title: 'ALMOND WATER', subtitle: 'SUPRIMENTO',
        body: 'Garrafas espalhadas pelos andares. Estenda a mão até a garrafa para pegar e leve à boca para beber. No desktop: F pega, F de novo bebe.\n\nRestaura SANIDADE e recarrega toda a ENERGIA. Experimente a garrafa ao lado.',
      },
      {
        x: leftWall, z: at(12), rotation: 90,
        title: 'QPS', subtitle: 'QUANTUM POSITIONING',
        body: 'Cada andar esconde um QPS. Pegue com pinça ou encostando a mão (desktop: passe por ele).\n\nEle mede o estado quântico: o mapa colapsa, a PORTA de saída aparece e uma seta ciano aponta para ela. Este aqui é de treino.',
      },
      {
        x: rightWall, z: at(14.5), rotation: -90,
        title: 'ENTIDADE', subtitle: 'PERIGO',
        body: 'Ela persegue você pelo labirinto. Não a encare: cubra os olhos com as duas mãos.\n\nZETA VISOR: pinça na testa (V) revela paredes em superposição.\nPHASE SHIFT: palmas na parede (Space + W) para atravessar.',
      },
      {
        x: at(8.6), z: farWall, rotation: 180,
        title: 'SAÍDA', subtitle: 'FLOOR 01',
        body: 'A porta amarela leva ao FLOOR 01.\n\nQuando estiver pronto, atravesse. Boa sorte, agente.',
        height: 0.6,
      },
    ];

    signs.forEach(({ x, z, rotation, title, subtitle, body, height = 0.9 }) => {
      const sign = document.createElement('a-entity');
      sign.setAttribute('position', `${x} 1.65 ${z}`);
      sign.setAttribute('rotation', `0 ${rotation} 0`);
      sign.setAttribute('terminal-panel', {
        title,
        subtitle,
        body: body.replace(/\n/g, '\\n'),
        width: 1.35,
        height,
        fontSize: 28,
      });
      this.el.appendChild(sign);
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
    // Modelo "Almond Water [Backrooms]" (CrZ, CC BY 4.0): ~4,3 unidades de altura,
    // já centralizado na origem. Escala para ~22 cm no ponto do item.
    const model = document.createElement('a-entity');
    model.setAttribute('gltf-model', '#almond-water-model');
    model.setAttribute('scale', '0.0515 0.0515 0.0515');
    bottle.appendChild(model);
    // Brilho próprio (emissive) para a garrafa não sumir no escuro, sem luz extra.
    model.addEventListener('model-loaded', () => {
      model.object3D.traverse((object) => {
        if (!object.isMesh || !object.material) return;
        object.material.emissive?.set('#6b5a30');
        object.material.emissiveIntensity = 0.6;
      });
    });
    bottle.setAttribute('animation', 'property: rotation; to: 0 360 0; loop: true; dur: 9000; easing: linear');
    return bottle;
  },

  // Porta amarela (PSX Liminal Kit) embutida na parede, com escuridão atrás.
  addStairs(stairsCell, origin, cellSize) {
    const wall = stairsCell.wall || { dx: 0, dz: 1 };
    const half = cellSize / 2;
    const faceX = origin + stairsCell.x * cellSize + wall.dx * half;
    const faceZ = origin + stairsCell.z * cellSize + wall.dz * half;
    const stairs = document.createElement('a-entity');

    stairs.setAttribute('id', 'stairs');
    stairs.setAttribute('position', `${faceX} 0 ${faceZ}`);
    // A frente da porta (+Z do modelo) fica virada para dentro da sala.
    stairs.setAttribute('rotation', `0 ${THREE.MathUtils.radToDeg(Math.atan2(-wall.dx, -wall.dz))} 0`);
    stairs.setAttribute('data-stairs', 'true');

    const door = document.createElement('a-entity');
    door.setAttribute('gltf-model', '#door-yellow-model');
    door.setAttribute('door-proximity-animation', 'target: #player-head; radius: 2.5');
    door.setAttribute('class', 'door-yellow');
    stairs.appendChild(door);

    // Escuridão: uma caixa preta por dentro, no vão da parede atrás da porta.
    const darkness = document.createElement('a-entity');
    darkness.setAttribute('geometry', 'primitive: box; width: 0.98; height: 2.19; depth: 1.2');
    darkness.setAttribute('material', 'shader: flat; color: #000000; side: back; fog: false');
    // Fundo 4 mm acima do carpete para cobrir o chão dentro do vão.
    darkness.setAttribute('position', '0 1.099 -0.6');
    stairs.appendChild(darkness);

    // Brilho ciano pulsando na frente da porta para ela ser achada no escuro.
    const glow = document.createElement('a-entity');
    glow.setAttribute('light', 'type: point; color: #44ffcc; intensity: 0.6; distance: 3.5');
    glow.setAttribute('position', '0 2.0 0.5');
    glow.setAttribute('animation', 'property: light.intensity; from: 0.25; to: 0.8; dir: alternate; loop: true; dur: 900');
    stairs.appendChild(glow);

    const trigger = document.createElement('a-box');
    trigger.setAttribute('id', 'stairs-trigger');
    trigger.setAttribute('visible', 'false');
    trigger.setAttribute('width', '1');
    trigger.setAttribute('height', '2.2');
    trigger.setAttribute('depth', '0.4');
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
      baseboard: new THREE.MeshStandardMaterial({ color: '#5e5030', roughness: 0.8, metalness: 0 }),
      lightPanel: new THREE.MeshBasicMaterial({
        map: texture('#light-panel-texture', 'assets/textures/level0/light-panel.jpg'),
        vertexColors: true,
        color: '#d8c592',
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
