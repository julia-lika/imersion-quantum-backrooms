// Entidade que vaga pelos corredores e caça o jogador quando ele está perto.
// Mantém o modelo visível no escuro; o Zeta Visor intensifica o brilho violeta.
const WANDER_INTERVAL_MS = 3200;
const HUNT_INTERVAL_MS = 1600;
const HUNT_RADIUS_CELLS = 5;
const MAX_GHOST_MESH_EXTENT = 30;
const VIEW_HALF_ANGLE = THREE.MathUtils.degToRad(37.5);

AFRAME.registerComponent('quantum-ghost', {
  schema: {
    player: { type: 'selector' },
    rig: { type: 'selector' },
  },

  init() {
    this.cell = null;
    this.previousCell = null;
    this.lastStep = 0;
    this.target = new THREE.Vector3();
    this.toGhost = new THREE.Vector3();

    const model = document.createElement('a-entity');
    model.setAttribute('gltf-model', '#bacteria-model');
    model.setAttribute('scale', '0.18 0.18 0.18');
    // A origem do GLB fica no topo da malha; ele se estende ~2 m para baixo.
    model.setAttribute('position', '0 2 0');
    model.addEventListener('model-loaded', () => {
      this.parts = [];
      model.object3D.traverse((object) => {
        if (!object.isMesh) return;
        object.geometry.computeBoundingBox();
        const bounds = object.geometry.boundingBox;
        const size = bounds?.getSize(new THREE.Vector3());
        if (size && Math.max(size.x, size.y, size.z) > MAX_GHOST_MESH_EXTENT) {
          // O GLB tem um Torus fora de escala (mais de 150 unidades) que causa artefatos.
          object.visible = false;
          return;
        }

        const materials = Array.isArray(object.material)
          ? object.material
          : [object.material];
        materials.forEach((material) => {
          if (!material) return;
          material.transparent = false;
          material.depthWrite = true;
          material.blending = THREE.NormalBlending;
          this.parts.push(material);
        });
      });
      this.lookKey = null;
      this.updateLook(0, window.quantumPlayer?.visor, Infinity);
    });
    this.parts = [];
    this.el.appendChild(model);

    this.onWorldUpdated = () => this.spawnFarFromPlayer();
    this.onStrike = () => this.spawnFarFromPlayer();
    this.el.sceneEl.addEventListener('maze-world-updated', this.onWorldUpdated);
    this.el.sceneEl.addEventListener('ghost-strike', this.onStrike);
  },

  remove() {
    this.el.sceneEl.removeEventListener('maze-world-updated', this.onWorldUpdated);
    this.el.sceneEl.removeEventListener('ghost-strike', this.onStrike);
  },

  playerCell() {
    const world = window.quantumWorld;
    const position = this.data.player?.object3D.position;
    return world && position
      ? window.quantumPhysics.worldToCell(world, position.x, position.z)
      : null;
  },

  spawnFarFromPlayer() {
    const world = window.quantumWorld;
    const player = this.playerCell();
    if (!world || !player) return;

    let farthest = null;
    world.maze.forEach((row, z) => {
      row.forEach((cell, x) => {
        if (cell !== '.') return;
        const distance = window.quantumPhysics.cellDistance(player, { x, z });
        if (!farthest || distance > farthest.distance) farthest = { x, z, distance };
      });
    });

    if (!farthest) return;
    this.cell = { x: farthest.x, z: farthest.z };
    this.previousCell = null;
    const position = window.quantumPhysics.cellToWorld(world, this.cell.x, this.cell.z);
    this.el.object3D.position.set(position.x, 0, position.z);
  },

  step(player) {
    const world = window.quantumWorld;
    const physics = window.quantumPhysics;

    if (physics.cellDistance(this.cell, player) <= HUNT_RADIUS_CELLS) {
      this.previousCell = this.cell;
      this.cell = physics.nextStepToward(world.maze, this.cell, player);
      return;
    }

    const options = [[1, 0], [-1, 0], [0, 1], [0, -1]]
      .map(([dx, dz]) => ({ x: this.cell.x + dx, z: this.cell.z + dz }))
      .filter(({ x, z }) => world.maze[z]?.[x] === '.');
    const forward = options.filter(({ x, z }) => (
      !this.previousCell || x !== this.previousCell.x || z !== this.previousCell.z
    ));
    const pool = forward.length > 0 ? forward : options;
    if (pool.length === 0) return;

    this.previousCell = this.cell;
    this.cell = pool[Math.floor(Math.random() * pool.length)];
  },

  // Linha de visão simples: amostra o segmento e para em paredes sólidas.
  hasLineOfSight(from, to) {
    const world = window.quantumWorld;
    const physics = window.quantumPhysics;
    const samples = Math.ceil(from.distanceTo(to) / 0.25);
    const time = this.el.sceneEl.time / 1000;

    for (let index = 1; index < samples; index += 1) {
      const t = index / samples;
      const cell = physics.worldToCell(world, from.x + (to.x - from.x) * t, from.z + (to.z - from.z) * t);
      if (physics.isCellSolid(world, cell.x, cell.z, time)) return false;
    }
    return true;
  },

  tick(time, delta) {
    const world = window.quantumWorld;
    const player = this.playerCell();
    const tracker = this.data.rig?.components['xr-hands'];
    const shared = window.quantumPlayer;
    if (!world || !player || !shared) return;
    if (!this.cell) this.spawnFarFromPlayer();
    if (!this.cell) return;

    const hunting = window.quantumPhysics.cellDistance(this.cell, player) <= HUNT_RADIUS_CELLS;
    const interval = hunting ? HUNT_INTERVAL_MS : WANDER_INTERVAL_MS;
    if (shared.active && time - this.lastStep > interval) {
      this.lastStep = time;
      this.step(player);
    }

    const goal = window.quantumPhysics.cellToWorld(world, this.cell.x, this.cell.z);
    this.target.set(goal.x, 0, goal.z);
    this.el.object3D.position.lerp(this.target, Math.min(1, (delta / 1000) * 1.6));

    const headWorld = this.data.player.object3D.position;
    const ghostEyes = this.el.object3D.position.clone().setY(headWorld.y);
    this.toGhost.subVectors(ghostEyes, headWorld);
    const distance = this.toGhost.length() / world.cellSize;
    const forward = tracker?.head.forward;
    const angle = forward ? this.toGhost.angleTo(forward) : Math.PI;
    const inView = angle < VIEW_HALF_ANGLE && this.hasLineOfSight(headWorld, ghostEyes);

    shared.ghost = { distance, inView, hunting };
    this.updateLook(time, shared.visor, distance);
  },

  updateLook(time, visor, distance) {
    const tint = '#000000';
    const emissive = visor ? 0.85 : 0;
    const key = `black:${emissive}`;
    if (key === this.lookKey) return;

    this.lookKey = key;
    this.parts.forEach((material) => {
      material.transparent = false;
      material.opacity = 1;
      material.depthWrite = true;
      material.blending = THREE.NormalBlending;
      if (material.color) material.color.set(tint);
      if (material.emissive) material.emissive.set('#c44dff');
      material.emissiveIntensity = emissive;
      material.needsUpdate = true;
    });
  },
});
