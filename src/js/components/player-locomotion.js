// Locomoção por balanço de braços (VR) e teclado (desktop), sempre com colisão no labirinto.
// Desktop: WASD ou setas andam, Q/E giram, arrastar o mouse olha.
const KEY_DIRECTIONS = {
  KeyW: [0, 1],
  KeyS: [0, -1],
  KeyA: [-1, 0],
  KeyD: [1, 0],
  ArrowUp: [0, 1],
  ArrowDown: [0, -1],
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
};

// Q e E agora pegam o QPS e a Água de Amêndoa; no desktop o giro fica com o mouse.
const TURN_KEYS = {};

// Placa de boas-vindas do lobby (painel solto à frente do spawn, em lobby-content.js).
const LOBBY_WELCOME_CELL = { x: 3.4, z: 1.2 };

AFRAME.registerComponent('player-locomotion', {
  schema: {
    keyboardSpeed: { type: 'number', default: 2.2 },
    turnSpeed: { type: 'number', default: 1.8 },
    swingDeadzone: { type: 'number', default: 0.35 },
    swingGain: { type: 'number', default: 1.5 },
    maxSwingSpeed: { type: 'number', default: 2.6 },
  },

  init() {
    // Não use `get ...()` na definição: o A-Frame lê getters ao registrar o
    // componente (sem `this.el`) e o registro falha com TypeError.
    Object.defineProperty(this, 'tracker', {
      get: () => this.el.components['xr-hands'],
    });
    Object.defineProperty(this, 'sceneTime', {
      get: () => this.el.sceneEl.time / 1000,
    });

    this.keys = new Set();
    this.swingSpeed = 0;
    this.lastValid = null;
    // Quadros até virar o jogador (spawn). Espera a cabeça e o andar atualizarem.
    this.facingFrames = 2;
    this.ticks = 0;
    this.skipReason = 'ainda sem tick';
    this.lastMove = 0;
    this.lastApplied = 0;
    this.forward = new THREE.Vector3();
    this.right = new THREE.Vector3();

    this.onKeyDown = (event) => {
      if (!KEY_DIRECTIONS[event.code] && !TURN_KEYS[event.code]) return;
      if (event.code.startsWith('Arrow')) event.preventDefault(); // não rolar a página
      this.keys.add(event.code);
    };
    this.onKeyUp = (event) => this.keys.delete(event.code);
    this.onBlur = () => this.keys.clear();

    this.onPhaseRequest = () => this.requestPhaseShift();
    this.onPhaseResolved = ({ detail }) => {
      if (detail.success && detail.target) this.teleportHead(detail.target.x, detail.target.z);
    };
    this.onWorldUpdated = () => this.escapeSolidCell();
    this.onTeleport = ({ detail }) => {
      this.teleportHead(detail.x, detail.z);
      this.requestFacing(3);
    };

    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
    this.el.sceneEl.addEventListener('phase-shift-request', this.onPhaseRequest);
    this.el.sceneEl.addEventListener('phase-shift-resolved', this.onPhaseResolved);
    this.el.sceneEl.addEventListener('maze-world-updated', this.onWorldUpdated);
    this.el.sceneEl.addEventListener('player-teleport', this.onTeleport);
    // Ao entrar no VR a pose da cabeça muda: espera alguns quadros com o
    // rastreamento ativo e vira o jogador para a placa de boas-vindas.
    this.onEnterVr = () => this.requestFacing(30);
    this.onLobbyEntered = () => this.requestFacing(3);
    this.el.sceneEl.addEventListener('enter-vr', this.onEnterVr);
    this.el.sceneEl.addEventListener('lobby-entered', this.onLobbyEntered);

    // Diagnóstico: no console do navegador, rode quantumDebug().
    window.quantumDebug = () => ({
      ticks: this.ticks,
      skip: this.skipReason,
      move: Number(this.lastMove.toFixed(4)),
      applied: Number(this.lastApplied.toFixed(4)),
      keys: [...this.keys],
      worldReady: Boolean(window.quantumWorld),
      physicsReady: Boolean(window.quantumPhysics),
      trackerReady: Boolean(this.tracker),
      inVr: Boolean(this.tracker?.inVr),
      head: this.tracker ? this.tracker.head.world.toArray() : null,
      cell: window.quantumWorld && this.tracker
        ? window.quantumPhysics.worldToCell(window.quantumWorld, this.tracker.head.world.x, this.tracker.head.world.z)
        : null,
    });
  },

  remove() {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
    this.el.sceneEl.removeEventListener('phase-shift-request', this.onPhaseRequest);
    this.el.sceneEl.removeEventListener('phase-shift-resolved', this.onPhaseResolved);
    this.el.sceneEl.removeEventListener('maze-world-updated', this.onWorldUpdated);
    this.el.sceneEl.removeEventListener('player-teleport', this.onTeleport);
    this.el.sceneEl.removeEventListener('enter-vr', this.onEnterVr);
    this.el.sceneEl.removeEventListener('lobby-entered', this.onLobbyEntered);
    delete window.quantumDebug;
  },

  updateBasis() {
    const { forward } = this.tracker.head;
    this.forward.set(forward.x, 0, forward.z);
    if (this.forward.lengthSq() < 1e-6) this.forward.set(0, 0, -1);
    this.forward.normalize();
    this.right.set(-this.forward.z, 0, this.forward.x);
  },

  // Velocidade das mãos relativa à cabeça: balançar os braços = andar.
  computeSwingSpeed(dt) {
    const { hands, head } = this.tracker;
    const gestures = this.el.components['hand-gestures'];
    const tracked = ['left', 'right'].filter((side) => hands[side].tracked);
    let target = 0;

    if (tracked.length > 0 && !gestures?.isBusy()) {
      const swing = tracked.reduce((total, side) => (
        total + hands[side].velocity.clone().sub(head.velocity).length()
      ), 0) / tracked.length;
      const oneHandPenalty = tracked.length === 1 ? 0.6 : 1;
      target = Math.min(
        this.data.maxSwingSpeed,
        Math.max(0, swing - this.data.swingDeadzone) * this.data.swingGain * oneHandPenalty
      );
    }

    const smoothing = Math.min(1, dt * (target > this.swingSpeed ? 5 : 3));
    this.swingSpeed += (target - this.swingSpeed) * smoothing;
    return this.swingSpeed < 0.02 ? 0 : this.swingSpeed;
  },

  computeDesiredMove(dt) {
    const move = new THREE.Vector3();
    const tracker = this.tracker;

    this.keys.forEach((code) => {
      const direction = KEY_DIRECTIONS[code];
      if (!direction) return; // teclas de giro
      const [strafe, ahead] = direction;
      move.addScaledVector(this.forward, ahead).addScaledVector(this.right, strafe);
    });
    if (move.lengthSq() > 0) move.normalize().multiplyScalar(this.data.keyboardSpeed * dt);

    if (tracker.inVr) {
      move.addScaledVector(this.forward, this.computeSwingSpeed(dt) * dt);

      // Fallback para controles: analógico esquerdo para frente/trás.
      const stickY = tracker.hands.left.thumbstick.y;
      if (Math.abs(stickY) > 0.25) {
        move.addScaledVector(this.forward, -stickY * this.data.keyboardSpeed * 0.7 * dt);
      }
    }

    return move;
  },

  // Giro por teclado (só no desktop; em VR o giro é físico ou em passos pelo analógico).
  applyKeyboardTurn(dt) {
    if (this.tracker.inVr) return;

    let turn = 0;
    this.keys.forEach((code) => {
      turn += TURN_KEYS[code] || 0;
    });
    if (turn !== 0) this.tracker.rotateAroundHead(turn * this.data.turnSpeed * dt);
  },

  requestFacing(frames) {
    this.facingFrames = Math.max(this.facingFrames || 0, frames);
  },

  // Faz o jogador nascer olhando para um corredor aberto, e não para uma parede.
  // No lobby, nasce de frente para a placa de boas-vindas (FASE 0 // LOBBY),
  // no desktop e no VR.
  faceOpenDirection() {
    const world = window.quantumWorld;
    const physics = window.quantumPhysics;
    const tracker = this.tracker;
    if (!world || !physics?.bestOpenDirection || !tracker) return;

    const head = tracker.head.world;
    let open = null;
    if (window.quantumPlayer?.floor === 0) {
      const target = {
        x: world.origin + LOBBY_WELCOME_CELL.x * world.cellSize,
        z: world.origin + LOBBY_WELCOME_CELL.z * world.cellSize,
      };
      open = { x: target.x - head.x, z: target.z - head.z };
    } else if (!tracker.inVr) {
      open = physics.bestOpenDirection(world.maze, physics.worldToCell(world, head.x, head.z));
    }
    if (!open) return;

    this.updateBasis();
    const yawOf = (x, z) => Math.atan2(-x, -z);
    tracker.rotateAroundHead(yawOf(open.x, open.z) - yawOf(this.forward.x, this.forward.z));
  },

  tick(time, delta) {
    const world = window.quantumWorld;
    const physics = window.quantumPhysics;
    this.ticks += 1;
    if (!this.tracker || !world || !physics) {
      this.skipReason = !this.tracker ? 'sem xr-hands' : (!world ? 'sem mundo (quantumWorld)' : 'sem física');
      return;
    }
    // Com o menu inicial aberto (antes de entrar ou depois do Esc) ninguém anda.
    this.startScreen = this.startScreen || document.getElementById('start-screen');
    if (this.startScreen && !this.startScreen.hidden) {
      this.skipReason = 'menu inicial aberto';
      return;
    }
    this.skipReason = 'ok';

    if (this.facingFrames > 0) {
      this.facingFrames -= 1;
      if (this.facingFrames === 0) this.faceOpenDirection();
    }

    const dt = Math.min(0.1, delta / 1000);
    this.applyKeyboardTurn(dt);
    this.updateBasis();
    const move = this.computeDesiredMove(dt);
    const head = this.tracker.head.world;
    const rig = this.el.object3D;

    if (!this.lastValid) this.lastValid = { x: head.x, z: head.z };

    // Encostar numa parede em superposição aberta a "mede" e a mantém aberta.
    physics.observeSuperposedWalls(world, this.lastValid.x, this.lastValid.z, physics.PLAYER_RADIUS, this.sceneTime);

    // O movimento físico da cabeça também passa pela colisão (room-scale).
    const desired = { x: head.x + move.x, z: head.z + move.z };
    const resolved = physics.resolveMove(
      world,
      this.lastValid,
      { x: desired.x - this.lastValid.x, z: desired.z - this.lastValid.z },
      physics.PLAYER_RADIUS,
      this.sceneTime
    );

    rig.position.x += resolved.x - head.x;
    rig.position.z += resolved.z - head.z;
    this.lastMove = move.length();
    this.lastApplied = Math.hypot(resolved.x - head.x, resolved.z - head.z);
    this.lastValid = resolved;
    this.isMoving = move.lengthSq() > 1e-6;
  },

  requestPhaseShift() {
    const world = window.quantumWorld;
    const physics = window.quantumPhysics;
    if (!world || !physics || !this.tracker) return;

    this.updateBasis();
    const head = this.tracker.head.world;
    const target = physics.findPhaseTarget(
      world,
      { x: head.x, z: head.z },
      { x: this.forward.x, z: this.forward.z },
      this.sceneTime
    );

    const reason = target ? null : physics.phaseBlocker?.(
      world,
      { x: head.x, z: head.z },
      { x: this.forward.x, z: this.forward.z },
      this.sceneTime
    );
    this.el.sceneEl.emit(target ? 'phase-shift-attempt' : 'phase-shift-blocked', { target, reason });
  },

  teleportHead(x, z) {
    const head = this.tracker?.head.world;
    if (!head) return;

    this.el.object3D.position.x += x - head.x;
    this.el.object3D.position.z += z - head.z;
    head.x = x;
    head.z = z;
    this.lastValid = { x, z };
  },

  // Quando o colapso redesenha o labirinto, o jogador pode ficar dentro de uma parede.
  escapeSolidCell() {
    const world = window.quantumWorld;
    const physics = window.quantumPhysics;
    const head = this.tracker?.head.world;
    if (!world || !physics || !head) return;

    const current = physics.worldToCell(world, head.x, head.z);
    if (!physics.isCellSolid(world, current.x, current.z)) return;

    let nearest = null;
    world.maze.forEach((row, z) => {
      row.forEach((cell, x) => {
        if (cell !== '.') return;
        const distance = physics.cellDistance(current, { x, z });
        if (!nearest || distance < nearest.distance) nearest = { x, z, distance };
      });
    });

    if (nearest) {
      const target = physics.cellToWorld(world, nearest.x, nearest.z);
      this.teleportHead(target.x, target.z);
    }
  },
});
