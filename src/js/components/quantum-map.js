import { buildLightPanels, buildWallGeometry } from './level-geometry.js';
import { buildLobby } from './lobby/lobby-builder.js?v=20261124-3';

const LOBBY_RESPAWN_MS = 10000;

AFRAME.registerComponent('quantum-map', {
  schema: {
    bitstring: { type: 'string', default: '010110101100' },
    stairsVisible: { type: 'boolean', default: false },
    floor: { type: 'number', default: 1 },
  },

  init() {
    this.materials = this.createMaterials();
    this.consumed = new Set();
    this.respawnTimers = new Map();
    this.onItemConsumed = ({ detail }) => {
      this.consumed.add(detail.id);
      this.scheduleLobbyRespawn(detail.id);
    };
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
    this.clearRespawnTimers();
  },

  clearRespawnTimers() {
    this.respawnTimers.forEach((timer) => window.clearTimeout(timer));
    this.respawnTimers.clear();
  },

  // No lobby, os itens de treino voltam LOBBY_RESPAWN_MS depois de usados.
  scheduleLobbyRespawn(id) {
    const def = this.lobbyItems?.find((item) => item.id === id);
    if (this.data.floor !== 0 || !def || def.persistent || this.respawnTimers.has(id)) return;

    this.respawnTimers.set(id, window.setTimeout(() => {
      this.respawnTimers.delete(id);
      this.consumed.delete(id);
      if (this.data.floor !== 0 || this.el.querySelector(`[data-item-id="${id}"]:not([data-consumed])`)) return;
      this.spawnLobbyItem(def);
    }, LOBBY_RESPAWN_MS));
  },

  update(oldData) {
    if (oldData.floor !== undefined && oldData.floor !== this.data.floor) {
      this.consumed.clear();
      this.clearRespawnTimers();
    }

    const sameMap = oldData.floor === this.data.floor && oldData.bitstring === this.data.bitstring;
    if (sameMap && oldData.stairsVisible !== this.data.stairsVisible && this.mapInfo) {
      // Medir com o QPS só revela a porta: o labirinto (inclusive os trechos
      // que já se reorganizaram) continua como está.
      this.rebuildWalls();
      if (this.data.stairsVisible && !this.el.querySelector('#stairs')) {
        this.addStairs(this.mapInfo.stairs, this.mapInfo.origin, this.mapInfo.cellSize);
      }
      return;
    }
    if (!sameMap || oldData.stairsVisible !== this.data.stairsVisible) {
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
    const superposed = lobby
      ? window.LOBBY_LAYOUT.superposed.map((wall) => ({ ...wall }))
      : physics.findSuperposedWalls(map.maze, map.bitstring);

    window.quantumWorld = physics.createMazeWorld(map.maze, { cellSize, superposed });

    this.mapInfo = { stairs: map.stairs, origin, cellSize, height, lobby, bitstring: map.bitstring };
    this.superposedEls = new Map();
    this.rebuildWalls();

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
    superposed.forEach((wall) => this.addSuperposedWall(wall));

    if (lobby) buildLobby(this.el, origin, cellSize);

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

  // Paredes fixas viram um único mesh (poucas draw calls no Quest). Refeito
  // quando um trecho fora da vista se reorganiza (decoerência) ou a porta abre.
  rebuildWalls() {
    const world = window.quantumWorld;
    const info = this.mapInfo;
    if (!world || !info) return;
    ['walls', 'baseboards'].forEach((name) => {
      const mesh = this.el.getObject3D(name);
      if (!mesh) return;
      mesh.geometry.dispose();
      this.el.removeObject3D(name);
      this.staticMeshes = (this.staticMeshes || []).filter((entry) => entry !== name);
    });
    const { walls, baseboards } = buildWallGeometry(world.maze, {
      origin: info.origin,
      cellSize: info.cellSize,
      height: info.height,
      tile: 0.8,
      isStatic: (x, z) => !world.superposed.has(`${x},${z}`),
      doorway: this.data.stairsVisible || info.lobby ? info.stairs : null,
    });
    this.addStaticMesh('walls', walls, this.materials.wall);
    this.addStaticMesh('baseboards', baseboards, this.materials.baseboard);
  },

  addSuperposedWall({ x, z, offset }) {
    const { origin, cellSize, height } = this.mapInfo;
    const wall = document.createElement('a-box');
    wall.setAttribute('superposed-wall', { offset, x, z });
    wall.setAttribute('width', cellSize + 0.01);
    wall.setAttribute('height', height);
    wall.setAttribute('depth', cellSize + 0.01);
    wall.setAttribute('position', `${origin + x * cellSize} ${height / 2} ${origin + z * cellSize}`);
    wall.setAttribute('backrooms-wall', 'repeat: 1 1; offset: 0 0; textureScale: 0.8');
    this.el.appendChild(wall);
    this.superposedEls.set(`${x},${z}`, wall);
    window.quantumWorld?.superposed.set(`${x},${z}`, offset);
  },

  // Chamado pela decoerência depois de reorganizar um setor (já mudado em
  // quantumWorld.maze): troca as paredes em superposição do setor e refaz o mesh.
  applySectorChange(sector, superposed = []) {
    const world = window.quantumWorld;
    if (!world || !this.mapInfo) return;
    [...this.superposedEls.entries()].forEach(([key, el]) => {
      const [x, z] = key.split(',').map(Number);
      if (x < sector.minX || x > sector.maxX || z < sector.minZ || z > sector.maxZ) return;
      el.parentNode?.removeChild(el);
      this.superposedEls.delete(key);
      world.superposed.delete(key);
      world.collapsed.delete(key);
    });
    superposed.forEach((wall) => this.addSuperposedWall(wall));
    this.rebuildWalls();
  },

  // Um QPS por andar (até ser coletado) e garrafas de Água de Amêndoa espalhadas.
  addItems(map, origin, cellSize) {
    const exclude = [
      { x: 1, z: 1 }, { x: 2, z: 1 }, { x: 1, z: 2 },
      { x: map.stairs.x, z: map.stairs.z },
    ];
    const cells = window.quantumPhysics.pickFloorCells(map.maze, map.bitstring, 3, exclude);
    // Os props evitam estas células para não esconder as garrafas. O QPS não
    // fica mais nos andares: o jogador pega no lobby e leva consigo.
    this.itemCells = cells.slice(1);
    const items = [
      { type: 'almond-water', cell: cells[1] },
      { type: 'almond-water', cell: cells[2] },
    ];

    items.forEach(({ type, cell }, index) => {
      const id = `${this.data.floor}-${type}-${index + 1}`;
      if (!cell || this.consumed.has(id)) return;

      const item = type === 'qps' ? this.createQps() : this.createAlmondWater();
      item.setAttribute('position', `${origin + cell.x * cellSize} 1.05 ${origin + cell.z * cellSize}`);
      item.dataset.item = type;
      item.dataset.itemId = id;
      this.el.appendChild(item);
    });
  },

  // Lobby: o QPS (chip na mesa dos equipamentos, fica com o jogador o jogo
  // todo) e uma Água de Amêndoa de treino.
  addLobbyItems(origin, cellSize) {
    const { almondWater, qps } = window.LOBBY_LAYOUT.items;
    this.itemCells = [almondWater];
    this.lobbyItems = [
      { type: 'almond-water', cell: almondWater, id: '0-almond-water-0', origin, cellSize },
    ];
    if (!window.quantumPlayer?.hasQps) {
      this.lobbyItems.push({ type: 'qps', cell: qps, id: '0-qps', origin, cellSize, persistent: true });
    }
    this.lobbyItems.forEach((def) => {
      if (!this.consumed.has(def.id)) this.spawnLobbyItem(def);
    });
  },

  spawnLobbyItem({ type, cell, id, origin, cellSize, persistent }) {
    const item = type === 'qps' ? this.createQps() : this.createAlmondWater();
    const y = cell.y ?? 1.05;
    item.setAttribute('position', `${origin + cell.x * cellSize} ${y} ${origin + cell.z * cellSize}`);
    item.dataset.item = type;
    item.dataset.itemId = id;
    // O QPS do lobby é o de verdade (persistente); a garrafa é de treino.
    item.dataset.training = persistent ? 'false' : 'true';
    this.el.appendChild(item);
  },

  // O QPS é o chip quântico (modelo chip-qps.glb), ampliado e brilhando.
  createQps() {
    const qps = document.createElement('a-entity');
    const model = document.createElement('a-entity');
    model.setAttribute('gltf-model', '#chip-qps-model');
    model.setAttribute('scale', '4 4 4');
    const glow = document.createElement('a-entity');
    glow.setAttribute('light', 'type: point; color: #44ffcc; intensity: 0.5; distance: 1.6');
    glow.setAttribute('position', '0 0.12 0');
    qps.append(model, glow);
    qps.classList.add('clickable');
    qps.setAttribute('animation', 'property: rotation; to: 0 360 0; loop: true; dur: 16000; easing: linear');
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
});
