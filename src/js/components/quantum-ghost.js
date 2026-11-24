// Entidade que persegue o jogador pelo labirinto o tempo todo, pelo caminho mais
// curto, e acelera quando chega perto. Mantém o modelo visível no escuro; o Zeta
// Visor intensifica o brilho violeta.
// Uma célula por intervalo: ~1,2 m/s de longe e ~1,6 m/s perto. O jogador anda a
// ~2,2 m/s, então ainda dá para fugir, mas parar é perigoso.
const CHASE_INTERVAL_MS = 900;
const HUNT_INTERVAL_MS = 650;
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
    // Se um trecho se reorganizou e a entidade ficou dentro de parede, ela reaparece longe.
    this.onShift = () => {
      const world = window.quantumWorld;
      const position = this.el.object3D.position;
      if (!world) return;
      const cell = window.quantumPhysics.worldToCell(world, position.x, position.z);
      if (world.maze[cell.z]?.[cell.x] !== '.') this.spawnFarFromPlayer();
    };
    this.el.sceneEl.addEventListener('maze-region-shifted', this.onShift);
  },

  remove() {
    this.el.sceneEl.removeEventListener('maze-world-updated', this.onWorldUpdated);
    this.el.sceneEl.removeEventListener('ghost-strike', this.onStrike);
    this.el.sceneEl.removeEventListener('maze-region-shifted', this.onShift);
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
        // Longe do jogador e também da entrada: no primeiro andar a cabeça
        // ainda pode estar na origem quando o mapa é desenhado.
        const distance = Math.min(
          window.quantumPhysics.cellDistance(player, { x, z }),
          window.quantumPhysics.cellDistance(window.quantumPhysics.START_CELL || { x: 1, z: 1 }, { x, z })
        );
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
    this.previousCell = this.cell;
    this.cell = window.quantumPhysics.nextStepToward(world.maze, this.cell, player);
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
    // No lobby (andar 0) a entidade não existe.
    const inLobby = shared.floor === 0;
    this.el.object3D.visible = !inLobby;
    if (inLobby) {
      shared.ghost = { distance: Infinity, inView: false, hunting: false };
      return;
    }
    if (!this.cell) this.spawnFarFromPlayer();
    if (!this.cell) return;

    const hunting = window.quantumPhysics.cellDistance(this.cell, player) <= HUNT_RADIUS_CELLS;
    const interval = hunting ? HUNT_INTERVAL_MS : CHASE_INTERVAL_MS;
    if (shared.active && time - this.lastStep > interval) {
      this.lastStep = time;
      this.step(player);
    }

    // Anda em velocidade constante até a próxima célula (sem o atraso do lerp).
    const goal = window.quantumPhysics.cellToWorld(world, this.cell.x, this.cell.z);
    this.target.set(goal.x, 0, goal.z);
    const position = this.el.object3D.position;
    const remaining = position.distanceTo(this.target);
    const stepLength = (world.cellSize / interval) * delta * 1.15;
    if (remaining <= stepLength) position.copy(this.target);
    else position.lerp(this.target, stepLength / remaining);

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
