// Espalha objetos pelo labirinto atual: móveis do pack Vol. 2 encostados nas
// paredes, peças do PSX Liminal Kit (placa de EXIT, ventilação, porta para lugar
// nenhum) e manchas de umidade no carpete e nas paredes. O total de objetos
// continua em `maxObjects`; tudo é redistribuído a cada novo andar/colapso para
// nada ficar dentro de uma parede.
const WALL_OBJECT = /CCTV|Warning|Door|Security|Alarm/i;
const DIRECTIONS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

// Peças do PSX Liminal Kit: as alturas já vêm no modelo (1 unidade = 1 m).
const PSX_PIECES = [
  { model: '#psx-exit-sign-model', inset: 0.01 },
  { model: '#psx-exit-sign-model', inset: 0.01 },
  { model: '#psx-vent-model', inset: 0.01 },
  { model: '#psx-vent-model', inset: 0.01 },
  { model: '#psx-door-nowhere-model', inset: 0.13 },
];
const FLOOR_STAINS = 3;
const WALL_STAINS = 2;

AFRAME.registerComponent('scatter-props', {
  schema: {
    maxObjects: { type: 'number', default: 22 },
    seed: { type: 'number', default: 17 },
    floorStain: { type: 'string', default: 'assets/textures/psx/damp-stain.png' },
    wallStain: { type: 'string', default: 'assets/textures/psx/wall-stain.png' },
  },

  init() {
    this.stairs = null;
    this.items = [];
    this.pieces = PSX_PIECES.map(({ model, inset }) => {
      const el = document.createElement('a-entity');
      el.setAttribute('gltf-model', model);
      el.setAttribute('visible', false);
      this.el.sceneEl.appendChild(el);
      return { el, inset };
    });
    this.stains = this.createStains();

    this.onModel = () => this.scatter();
    this.onWorld = ({ detail }) => {
      this.stairs = detail?.stairs || null;
      this.items = detail?.items || [];
      this.scatter();
    };
    this.el.addEventListener('model-loaded', this.onModel);
    this.el.sceneEl.addEventListener('maze-world-updated', this.onWorld);
  },

  remove() {
    this.el.removeEventListener('model-loaded', this.onModel);
    this.el.sceneEl.removeEventListener('maze-world-updated', this.onWorld);
    this.pieces.forEach(({ el }) => el.parentNode?.removeChild(el));
    this.stains.forEach((mesh) => {
      this.el.sceneEl.object3D.remove(mesh);
      mesh.material.map?.dispose();
      mesh.material.dispose();
    });
  },

  createStains() {
    const loader = new THREE.TextureLoader();
    const material = (src) => {
      const map = loader.load(src);
      if ('colorSpace' in map) map.colorSpace = THREE.SRGBColorSpace;
      return new THREE.MeshStandardMaterial({
        map,
        transparent: true,
        depthWrite: false,
        roughness: 0.6,
        polygonOffset: true,
        polygonOffsetFactor: -2,
      });
    };
    const floorMaterial = material(this.data.floorStain);
    const wallMaterial = material(this.data.wallStain);
    const floorGeometry = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    const wallGeometry = new THREE.PlaneGeometry(1, 2);
    const stains = [];

    for (let index = 0; index < FLOOR_STAINS; index += 1) {
      const mesh = new THREE.Mesh(floorGeometry, floorMaterial);
      mesh.userData.surface = 'floor';
      stains.push(mesh);
    }
    for (let index = 0; index < WALL_STAINS; index += 1) {
      const mesh = new THREE.Mesh(wallGeometry, wallMaterial);
      mesh.userData.surface = 'wall';
      stains.push(mesh);
    }
    stains.forEach((mesh) => {
      mesh.visible = false;
      mesh.renderOrder = 1;
      this.el.sceneEl.object3D.add(mesh);
    });
    return stains;
  },

  createRandom(text) {
    let seed = this.data.seed;
    for (const char of text) seed = (seed * 31 + char.charCodeAt(0)) % 4294967296;
    return () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };
  },

  shuffle(items, random) {
    const shuffled = [...items];
    for (let index = shuffled.length - 1; index > 0; index -= 1) {
      const target = Math.floor(random() * (index + 1));
      [shuffled[index], shuffled[target]] = [shuffled[target], shuffled[index]];
    }
    return shuffled;
  },

  // Células livres longe da entrada, da porta e dos itens; `walls` lista as
  // paredes fixas vizinhas (vazio no meio das salas).
  freeCells(world) {
    const { maze } = world;
    const cells = [];

    maze.forEach((row, z) => {
      row.forEach((cell, x) => {
        if (cell !== '.' || (x <= 3 && z <= 3)) return;
        if (this.stairs && Math.abs(this.stairs.x - x) + Math.abs(this.stairs.z - z) <= 1) return;
        if (this.items.some((item) => item.x === x && item.z === z)) return;

        const walls = DIRECTIONS.filter(([dx, dz]) => (
          maze[z + dz]?.[x + dx] === '#' && !world.superposed.has(`${x + dx},${z + dz}`)
        ));
        cells.push({ x, z, walls });
      });
    });

    return cells;
  },

  scatter() {
    const root = this.el.getObject3D('mesh');
    const world = window.quantumWorld;
    const physics = window.quantumPhysics;
    if (!root || !world || !physics) return;

    const random = this.createRandom(world.maze.map((row) => row.join('')).join(''));
    const free = this.shuffle(this.freeCells(world), random);
    const wallCells = free.filter((cell) => cell.walls.length > 0);
    const used = new Set();
    const half = world.cellSize / 2;
    const take = (pool) => {
      const cell = pool.find(({ x, z }) => !used.has(`${x},${z}`));
      if (cell) used.add(`${cell.x},${cell.z}`);
      return cell;
    };
    const onWall = (cell, inset) => {
      const [dx, dz] = cell.walls[Math.floor(random() * cell.walls.length)];
      const center = physics.cellToWorld(world, cell.x, cell.z);
      return {
        x: center.x + dx * (half - inset),
        z: center.z + dz * (half - inset),
        facing: Math.atan2(-dx, -dz),
      };
    };

    // Mantém a frequência: as peças novas ocupam vagas dentro de maxObjects.
    const vol2Slots = Math.max(0, this.data.maxObjects - this.pieces.length - this.stains.length);
    const objects = this.shuffle(root.children, random);
    let placed = 0;

    objects.forEach((object, index) => {
      const cell = index < vol2Slots ? take(wallCells) : null;
      if (!cell) {
        object.visible = false;
        return;
      }

      placed += 1;
      const mounted = WALL_OBJECT.test(object.name || '');
      const spot = onWall(cell, mounted ? 0.04 : 0.32);
      object.visible = true;
      object.position.set(spot.x, mounted && !/Door/i.test(object.name) ? 1.6 + random() * 0.5 : 0, spot.z);
      object.rotation.y = mounted ? spot.facing : spot.facing + (random() - 0.5) * 1.2;
    });

    this.pieces.forEach(({ el, inset }) => {
      const cell = take(wallCells);
      el.object3D.visible = Boolean(cell);
      if (!cell) return;

      placed += 1;
      const spot = onWall(cell, inset);
      el.object3D.position.set(spot.x, 0, spot.z);
      el.object3D.rotation.set(0, spot.facing, 0);
    });

    this.stains.forEach((mesh) => {
      const wall = mesh.userData.surface === 'wall';
      const cell = take(wall ? wallCells : free);
      mesh.visible = Boolean(cell);
      if (!cell) return;

      placed += 1;
      if (wall) {
        const spot = onWall(cell, -0.004);
        mesh.position.set(spot.x, 1, spot.z);
        mesh.rotation.set(0, spot.facing, 0);
        mesh.scale.set(0.9 + random() * 0.3, 1, 1);
      } else {
        const center = physics.cellToWorld(world, cell.x, cell.z);
        const size = 1 + random() * 0.8;
        mesh.position.set(center.x, 0.004, center.z);
        mesh.rotation.set(0, random() * Math.PI * 2, 0);
        mesh.scale.set(size, 1, size);
      }
    });

    console.info(`[scatter-props] ${placed} objetos distribuídos`);
  },
});
