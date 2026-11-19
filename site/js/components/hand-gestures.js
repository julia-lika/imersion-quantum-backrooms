// Gestos com as mãos:
// - pinça na testa: liga/desliga o Zeta Visor;
// - mãos sobre os olhos: protege da exposição ao fantasma;
// - duas palmas empurrando a parede: phase shift;
// - pinça perto de um item: pega o QPS ou a Almond Water (beber = levar à boca).
const BROW_OFFSET = new THREE.Vector3(0, 0.09, -0.06);
const EYES_OFFSET = new THREE.Vector3(0, 0, -0.08);
const MOUTH_OFFSET = new THREE.Vector3(0, -0.09, -0.07);
// O ponto rastreado é o centro da palma, não a ponta dos dedos.
const BROW_RADIUS = 0.18;
const EYES_RADIUS = 0.15;
const MOUTH_RADIUS = 0.16;
const PHASE_HOLD_SECONDS = 1.1;
const PHASE_COOLDOWN_SECONDS = 2;
const GRAB_RADIUS = 0.3;
const DESKTOP_PICKUP_RADIUS = 0.85;

AFRAME.registerComponent('hand-gestures', {
  init() {
    // Não use `get tracker()` na definição: o A-Frame lê getters ao registrar o
    // componente (sem `this.el`) e o registro falha com TypeError.
    Object.defineProperty(this, 'tracker', {
      get: () => this.el.components['xr-hands'],
    });

    this.held = { left: null, right: null };
    this.phaseCharge = 0;
    this.phaseCooldown = 0;
    this.eyesCovered = false;
    this.headLocal = new THREE.Vector3();
    this.inverseHead = new THREE.Quaternion();
    this.itemWorld = new THREE.Vector3();

    this.onPinchStart = ({ detail }) => this.handlePinch(detail.hand);
    this.onPinchEnd = ({ detail }) => this.release(detail.hand);

    this.el.addEventListener('hand-pinchstart', this.onPinchStart);
    this.el.addEventListener('hand-pinchend', this.onPinchEnd);
  },

  remove() {
    this.el.removeEventListener('hand-pinchstart', this.onPinchStart);
    this.el.removeEventListener('hand-pinchend', this.onPinchEnd);
  },

  isBusy() {
    return this.eyesCovered || this.phaseCharge > 0.15;
  },

  // Distância da mão até um ponto do rosto, no referencial da cabeça.
  distanceToFace(side, offset) {
    const { head, hands } = this.tracker;
    this.inverseHead.copy(head.quaternion).invert();
    this.headLocal.copy(hands[side].position).sub(head.position).applyQuaternion(this.inverseHead);
    return this.headLocal.distanceTo(offset);
  },

  handlePinch(side) {
    const hand = this.tracker?.hands[side];
    if (!hand?.tracked) return;

    if (this.distanceToFace(side, BROW_OFFSET) < BROW_RADIUS) {
      this.el.sceneEl.emit('visor-toggle-request', { source: `${side}-hand` });
      return;
    }

    const item = window.quantumPlayer?.active && this.findNearestItem(hand.world, GRAB_RADIUS);
    if (!item) return;

    this.held[side] = item;
    item.emit('item-grabbed', { hand: side });
    if (item.dataset.item === 'qps') this.consume(item, 'qps-collected', 1200);
  },

  release(side) {
    const item = this.held[side];
    this.held[side] = null;
    if (!item?.isConnected || item.dataset.consumed) return;

    item.object3D.position.y = 0.16;
  },

  findNearestItem(position, radius) {
    let nearest = null;
    let nearestDistance = radius;

    this.el.sceneEl.querySelectorAll('[data-item]').forEach((item) => {
      if (item.dataset.consumed) return;
      item.object3D.getWorldPosition(this.itemWorld);
      const distance = this.itemWorld.distanceTo(position);
      if (distance < nearestDistance) {
        nearest = item;
        nearestDistance = distance;
      }
    });

    return nearest;
  },

  consume(item, eventName, removeAfter = 0) {
    item.dataset.consumed = 'true';
    this.el.sceneEl.emit(eventName, { id: item.dataset.itemId });
    window.setTimeout(() => item.parentNode?.removeChild(item), removeAfter);
  },

  tick(time, delta) {
    const tracker = this.tracker;
    if (!tracker) return;

    const dt = Math.min(0.1, delta / 1000);
    this.phaseCooldown = Math.max(0, this.phaseCooldown - dt);

    if (!tracker.inVr) {
      this.updateDesktopPickup(tracker.head.world);
      this.setEyesCovered(false);
      return;
    }

    const { left, right } = tracker.hands;
    const bothTracked = left.tracked && right.tracked;

    this.setEyesCovered(
      bothTracked &&
      this.distanceToFace('left', EYES_OFFSET) < EYES_RADIUS &&
      this.distanceToFace('right', EYES_OFFSET) < EYES_RADIUS
    );

    this.updateHeldItems();
    this.updatePhasePress(dt, bothTracked);
  },

  setEyesCovered(covered) {
    if (covered === this.eyesCovered) return;
    this.eyesCovered = covered;
    this.el.sceneEl.emit('eyes-covered', { covered });
  },

  updateHeldItems() {
    ['left', 'right'].forEach((side) => {
      const item = this.held[side];
      if (!item?.isConnected || item.dataset.consumed) return;

      const handWorld = this.tracker.hands[side].world;
      item.object3D.position.copy(item.object3D.parent.worldToLocal(handWorld.clone()));

      if (item.dataset.item === 'almond-water' && this.distanceToFace(side, MOUTH_OFFSET) < MOUTH_RADIUS) {
        this.held[side] = null;
        this.consume(item, 'almond-water-drunk');
      }
    });
  },

  // As duas palmas precisam tocar uma parede à frente por PHASE_HOLD_SECONDS.
  updatePhasePress(dt, bothTracked) {
    const world = window.quantumWorld;
    const physics = window.quantumPhysics;
    const pressing = bothTracked && world && physics && this.phaseCooldown === 0 &&
      ['left', 'right'].every((side) => this.isPalmOnWall(side, world, physics));

    this.phaseCharge = pressing
      ? this.phaseCharge + dt / PHASE_HOLD_SECONDS
      : Math.max(0, this.phaseCharge - dt * 2);

    const color = this.phaseCharge > 0
      ? `#${new THREE.Color('#ffe69b').lerp(new THREE.Color('#c44dff'), Math.min(1, this.phaseCharge)).getHexString()}`
      : '#ffe69b';
    if (color !== this.markerColor) {
      this.markerColor = color;
      this.tracker.setMarkerColor('left', color);
      this.tracker.setMarkerColor('right', color);
    }

    if (this.phaseCharge >= 1) {
      this.phaseCharge = 0;
      this.phaseCooldown = PHASE_COOLDOWN_SECONDS;
      this.el.sceneEl.emit('phase-shift-request', { source: 'hands' });
    }
  },

  isPalmOnWall(side, world, physics) {
    const { hands, head } = this.tracker;
    const palm = hands[side].world;
    const toPalm = new THREE.Vector3(palm.x - head.world.x, 0, palm.z - head.world.z);
    const reach = toPalm.length();
    if (reach < 0.2 || toPalm.normalize().dot(head.forward) < 0.4) return false;

    // Empurra a palma alguns centímetros para frente e testa se encosta na parede.
    const probe = palm.clone().addScaledVector(toPalm, 0.08);
    const cell = physics.worldToCell(world, probe.x, probe.z);
    return physics.isCellSolid(world, cell.x, cell.z, this.el.sceneEl.time / 1000);
  },

  updateDesktopPickup(headWorld) {
    if (!headWorld || !window.quantumPlayer?.active) return;

    this.el.sceneEl.querySelectorAll('[data-item]').forEach((item) => {
      if (item.dataset.consumed) return;
      item.object3D.getWorldPosition(this.itemWorld);
      const distance = Math.hypot(this.itemWorld.x - headWorld.x, this.itemWorld.z - headWorld.z);
      if (distance > DESKTOP_PICKUP_RADIUS) return;

      this.consume(
        item,
        item.dataset.item === 'qps' ? 'qps-collected' : 'almond-water-drunk'
      );
    });
  },
});
