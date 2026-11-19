// Rastreia cabeça e mãos (hand tracking ou controles) no espaço local do rig.
// Em VR as poses vêm direto do XRFrame; no desktop a câmera faz o papel da cabeça.
const HAND_SIDES = ['left', 'right'];
const PALM_JOINT = 'middle-finger-metacarpal';
const SNAP_TURN_DEGREES = 30;

function createHandState() {
  return {
    tracked: false,
    wasTracked: false,
    isHand: false,
    pinching: false,
    position: new THREE.Vector3(),
    previous: new THREE.Vector3(),
    world: new THREE.Vector3(),
    velocity: new THREE.Vector3(),
    thumbstick: { x: 0, y: 0 },
  };
}

AFRAME.registerComponent('xr-hands', {
  schema: {
    camera: { type: 'selector' },
    anchor: { type: 'selector' },
  },

  init() {
    this.head = {
      position: new THREE.Vector3(),
      previous: new THREE.Vector3(),
      velocity: new THREE.Vector3(),
      quaternion: new THREE.Quaternion(),
      world: new THREE.Vector3(),
      forward: new THREE.Vector3(0, 0, -1),
    };
    this.hands = { left: createHandState(), right: createHandState() };
    this.inVr = false;
    this.snapReady = true;
    this.markers = {};

    HAND_SIDES.forEach((side) => {
      const marker = document.createElement('a-sphere');
      marker.setAttribute('radius', '0.028');
      marker.setAttribute('material', 'color: #ffe69b; emissive: #ffe69b; emissiveIntensity: 0.6; opacity: 0.85; transparent: true');
      marker.setAttribute('visible', 'false');
      this.el.appendChild(marker);
      this.markers[side] = marker;
    });

    this.onSessionInput = (event) => {
      const side = event.inputSource?.handedness;
      if (!this.hands[side]) return;

      const pressed = event.type === 'selectstart' || event.type === 'squeezestart';
      this.hands[side].pinching = pressed;
      this.el.emit(pressed ? 'hand-pinchstart' : 'hand-pinchend', { hand: side });
    };

    this.onEnterVr = () => {
      const session = this.el.sceneEl.renderer.xr.getSession();
      if (!session) return;

      this.inVr = true;
      this.session = session;
      ['selectstart', 'selectend', 'squeezestart', 'squeezeend'].forEach((type) => {
        session.addEventListener(type, this.onSessionInput);
      });
    };

    this.onExitVr = () => {
      this.inVr = false;
      HAND_SIDES.forEach((side) => {
        this.hands[side].tracked = false;
        this.hands[side].pinching = false;
        this.markers[side].setAttribute('visible', 'false');
      });
      this.session = null;
    };

    this.el.sceneEl.addEventListener('enter-vr', this.onEnterVr);
    this.el.sceneEl.addEventListener('exit-vr', this.onExitVr);
  },

  remove() {
    this.el.sceneEl.removeEventListener('enter-vr', this.onEnterVr);
    this.el.sceneEl.removeEventListener('exit-vr', this.onExitVr);
  },

  setMarkerColor(side, color) {
    this.markers[side]?.setAttribute('material', { color, emissive: color });
  },

  tick(time, delta) {
    const dt = Math.min(0.1, Math.max(0.001, delta / 1000));
    const frame = this.el.sceneEl.frame;
    const referenceSpace = this.inVr ? this.el.sceneEl.renderer.xr.getReferenceSpace() : null;

    this.head.previous.copy(this.head.position);
    const viewerPose = frame && referenceSpace ? frame.getViewerPose(referenceSpace) : null;

    if (viewerPose) {
      const { position, orientation } = viewerPose.transform;
      this.head.position.set(position.x, position.y, position.z);
      this.head.quaternion.set(orientation.x, orientation.y, orientation.z, orientation.w);
    } else if (this.data.camera) {
      this.head.position.copy(this.data.camera.object3D.position);
      this.head.quaternion.copy(this.data.camera.object3D.quaternion);
    }

    this.head.velocity.subVectors(this.head.position, this.head.previous).divideScalar(dt);
    this.el.object3D.updateMatrixWorld();
    this.head.world.copy(this.head.position).applyMatrix4(this.el.object3D.matrixWorld);
    this.head.forward.set(0, 0, -1).applyQuaternion(this.head.quaternion)
      .applyQuaternion(this.el.object3D.quaternion);

    if (this.data.anchor) {
      this.data.anchor.object3D.position.copy(this.head.world);
    }

    HAND_SIDES.forEach((side) => {
      this.hands[side].wasTracked = this.hands[side].tracked;
      this.hands[side].tracked = false;
    });

    if (frame && referenceSpace && this.session) {
      for (const source of this.session.inputSources) {
        this.readInputSource(source, frame, referenceSpace, dt);
      }
    }

    HAND_SIDES.forEach((side) => {
      const hand = this.hands[side];
      if (!hand.tracked) {
        hand.velocity.set(0, 0, 0);
        hand.thumbstick.x = 0;
        hand.thumbstick.y = 0;
      }
      hand.world.copy(hand.position).applyMatrix4(this.el.object3D.matrixWorld);
      this.markers[side].object3D.position.copy(hand.position);
      this.markers[side].object3D.visible = hand.tracked;
    });

    this.applySnapTurn();
  },

  readInputSource(source, frame, referenceSpace, dt) {
    const hand = this.hands[source.handedness];
    if (!hand) return;

    let pose = null;
    if (source.hand) {
      const joint = source.hand.get(PALM_JOINT) || source.hand.get('wrist');
      pose = joint && frame.getJointPose ? frame.getJointPose(joint, referenceSpace) : null;
    }
    if (!pose && source.gripSpace) {
      pose = frame.getPose(source.gripSpace, referenceSpace);
    }
    if (!pose) return;

    const { x, y, z } = pose.transform.position;
    if (!hand.wasTracked) hand.position.set(x, y, z);
    hand.previous.copy(hand.position);
    hand.position.set(x, y, z);
    hand.velocity.subVectors(hand.position, hand.previous).divideScalar(dt);
    hand.tracked = true;
    hand.isHand = Boolean(source.hand);

    const axes = source.gamepad?.axes || [];
    hand.thumbstick.x = axes[2] ?? 0;
    hand.thumbstick.y = axes[3] ?? 0;
  },

  // Controles com analógico ganham snap turn; com as mãos o giro é físico.
  applySnapTurn() {
    const axis = this.hands.right.thumbstick.x || this.hands.left.thumbstick.x;

    if (Math.abs(axis) < 0.3) {
      this.snapReady = true;
      return;
    }
    if (!this.snapReady || Math.abs(axis) < 0.75) return;

    this.snapReady = false;
    this.rotateAroundHead(THREE.MathUtils.degToRad(-Math.sign(axis) * SNAP_TURN_DEGREES));
  },

  rotateAroundHead(angle) {
    const rig = this.el.object3D;
    const pivot = this.head.world.clone();

    rig.rotation.y += angle;
    rig.updateMatrixWorld();
    const moved = this.head.position.clone().applyMatrix4(rig.matrixWorld);
    rig.position.x += pivot.x - moved.x;
    rig.position.z += pivot.z - moved.z;
  },
});
