// Rastreia cabeça e mãos (hand tracking ou controles) no espaço local do rig.
// Em VR as poses vêm direto do XRFrame; no desktop a câmera faz o papel da cabeça.
const HAND_SIDES = ['left', 'right'];
const PALM_JOINT = 'middle-finger-metacarpal';
const SNAP_TURN_DEGREES = 30;

// Gesto de olhar o pulso (Q-LINK no esquerdo, mapa do QPS no direito). Precisa
// ser deliberado: pulso perto do rosto, girado para os olhos, mão parada e longe
// dos itens, segurado por um instante. Estender a mão para pegar algo não abre.
// Os limites "keep" são mais folgados, para o painel não piscar depois de aberto.
// Mais tolerante que a primeira versão (que quase nunca disparava no Quest):
// basta trazer o pulso para a frente do rosto, girado para os olhos, e parar
// um instante. Braço esticado ou mão em movimento rápido continuam não contando.
const WRIST_LOOK = {
  showAngle: THREE.MathUtils.degToRad(35),
  keepAngle: THREE.MathUtils.degToRad(48),
  showDistance: 0.6,
  keepDistance: 0.72,
  // Distância horizontal cabeça-mão: braço esticado passa disso.
  showReach: 0.5,
  keepReach: 0.6,
  // Altura da mão em relação aos olhos (do peito até um pouco acima dos olhos).
  minHeight: -0.7,
  maxHeight: 0.15,
  // |cos| entre a normal da palma e a direção mão→olhos: pulso girado para o rosto.
  showFacing: 0.35,
  keepFacing: 0.2,
  showSpeed: 0.8,
  keepSpeed: 1.4,
  // Mão rápida = estendendo o braço: bloqueia o gesto por um tempo.
  reachSpeed: 1.6,
  reachBlockSeconds: 0.4,
  itemClearance: 0.2,
  holdSeconds: 0.2,
};

function createHandState() {
  return {
    tracked: false,
    wasTracked: false,
    isHand: false,
    pinching: false,
    position: new THREE.Vector3(),
    quaternion: new THREE.Quaternion(),
    // Eixo perpendicular à palma: Y nas juntas do hand tracking, X no grip dos controles.
    palmAxis: new THREE.Vector3(0, 1, 0),
    look: { hold: 0, shown: false, block: 0, speed: 0 },
    // Raio de apontar (targetRaySpace): controles e mãos. Usado pelo menu no VR.
    rayValid: false,
    rayOrigin: new THREE.Vector3(),
    rayDirection: new THREE.Vector3(0, 0, -1),
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
    this.lookToHead = new THREE.Vector3();
    this.lookNormal = new THREE.Vector3();
    this.lookItem = new THREE.Vector3();
    this.lookQuat = new THREE.Quaternion();

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
      this.hands[side].rayValid = false;
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
    // Mão e controle do mesmo lado ao mesmo tempo: vale a mão.
    if (hand.tracked && hand.isHand && !source.hand) return;

    const rayPose = source.targetRaySpace ? frame.getPose(source.targetRaySpace, referenceSpace) : null;
    if (rayPose) {
      const { position: p, orientation: q } = rayPose.transform;
      hand.rayOrigin.set(p.x, p.y, p.z);
      hand.rayDirection.set(0, 0, -1).applyQuaternion(this.lookQuat.set(q.x, q.y, q.z, q.w));
      hand.rayValid = true;
    }

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
    const o = pose.transform.orientation;
    hand.quaternion.set(o.x, o.y, o.z, o.w);
    if (source.hand) hand.palmAxis.set(0, 1, 0);
    else hand.palmAxis.set(1, 0, 0);
    if (!hand.wasTracked) hand.position.set(x, y, z);
    hand.previous.copy(hand.position);
    hand.position.set(x, y, z);
    hand.velocity.subVectors(hand.position, hand.previous).divideScalar(dt);
    // Salto grande num quadro (mão e controle do mesmo lado se alternando, ou
    // o tracking voltando) não é movimento de verdade: não bloqueia o gesto.
    if (!Number.isFinite(hand.velocity.x) || hand.position.distanceTo(hand.previous) > 0.25) hand.velocity.set(0, 0, 0);
    hand.tracked = true;
    hand.isHand = Boolean(source.hand);

    const axes = source.gamepad?.axes || [];
    hand.thumbstick.x = axes[2] ?? 0;
    hand.thumbstick.y = axes[3] ?? 0;
  },

  // true enquanto o jogador faz o gesto de olhar o pulso `side`. Chamado uma vez
  // por quadro pelo painel daquele pulso (dt em segundos).
  wristLook(side, dt) {
    const hand = this.hands[side];
    const look = hand?.look;
    if (!look) return false;
    look.block = Math.max(0, look.block - dt);

    const reset = () => {
      look.hold = 0;
      look.shown = false;
      return false;
    };
    if (!this.inVr || !hand.tracked) {
      look.speed = 0;
      return reset();
    }

    // Velocidade suavizada: o tremor do hand tracking não conta como movimento.
    look.speed += (hand.velocity.length() - look.speed) * Math.min(1, dt * 10);
    const { speed } = look;
    if (speed > WRIST_LOOK.reachSpeed) look.block = WRIST_LOOK.reachBlockSeconds;
    if (look.block > 0 || hand.pinching) return reset();

    const gestures = this.el.components['hand-gestures'];
    if (gestures?.held?.[side] || gestures?.isBusy?.()) return reset();
    if (this.itemNear(hand.world, WRIST_LOOK.itemClearance)) return reset();

    const keep = look.shown;
    const toHead = this.lookToHead.subVectors(this.head.world, hand.world);
    const distance = toHead.length();
    const reach = Math.hypot(toHead.x, toHead.z);
    const height = hand.world.y - this.head.world.y;
    // Ângulo entre o olhar e a mão (toHead aponta ao contrário).
    const angle = Math.PI - toHead.angleTo(this.head.forward);
    this.lookQuat.copy(this.el.object3D.quaternion).multiply(hand.quaternion);
    const normal = this.lookNormal.copy(hand.palmAxis).applyQuaternion(this.lookQuat);
    const facing = distance > 0.001 ? Math.abs(normal.dot(toHead) / distance) : 0;

    const ok = distance < (keep ? WRIST_LOOK.keepDistance : WRIST_LOOK.showDistance) &&
      reach < (keep ? WRIST_LOOK.keepReach : WRIST_LOOK.showReach) &&
      height > WRIST_LOOK.minHeight && height < WRIST_LOOK.maxHeight &&
      angle < (keep ? WRIST_LOOK.keepAngle : WRIST_LOOK.showAngle) &&
      facing > (keep ? WRIST_LOOK.keepFacing : WRIST_LOOK.showFacing) &&
      speed < (keep ? WRIST_LOOK.keepSpeed : WRIST_LOOK.showSpeed);
    if (!ok) return reset();

    look.hold = Math.min(WRIST_LOOK.holdSeconds, look.hold + dt);
    look.shown = look.shown || look.hold >= WRIST_LOOK.holdSeconds;
    return look.shown;
  },

  itemNear(position, radius) {
    let near = false;
    this.el.sceneEl.querySelectorAll('[data-item]').forEach((item) => {
      if (near || item.dataset.consumed || !item.object3D.visible) return;
      item.object3D.getWorldPosition(this.lookItem);
      near = this.lookItem.distanceTo(position) < radius;
    });
    return near;
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
