// Gestos com as mãos:
// - dois toques com a mão direita na lateral direita do rosto: liga/desliga o Zeta Visor;
// - mãos sobre os olhos: protege da exposição ao fantasma;
// - duas palmas empurrando a parede: phase shift;
// - pinça perto de um item: pega o QPS ou a Água de Amêndoa (beber = levar à boca);
// - estender a mão até um item também pega: o QPS é coletado e a garrafa fica na mão.
// Lateral direita do rosto (têmpora), no referencial da cabeça (x para a direita).
// O ponto rastreado é o centro da palma: com os dedos na têmpora ele fica uns
// 10 cm para fora.
const TEMPLE_OFFSET = new THREE.Vector3(0.12, 0.02, -0.01);
const TEMPLE_RADIUS = 0.1;
// Para contar um toque novo a mão precisa se afastar um pouco antes.
const TEMPLE_RELEASE = 0.14;
const DOUBLE_TAP_SECONDS = 0.7;
const VISOR_TAP_COOLDOWN = 1;
const EYES_OFFSET = new THREE.Vector3(0, 0, -0.08);
const MOUTH_OFFSET = new THREE.Vector3(0, -0.09, -0.07);
// O ponto rastreado é o centro da palma, não a ponta dos dedos.
const EYES_RADIUS = 0.15;
const MOUTH_RADIUS = 0.16;
const PHASE_HOLD_SECONDS = 1.1;
const PHASE_COOLDOWN_SECONDS = 2;
const GRAB_RADIUS = 0.3;
const TOUCH_RADIUS = 0.2;
// Equipamentos ficam no tampo da mesa: um raio maior para alcançar com a mão.
const GEAR_TOUCH_RADIUS = 0.28;
const DESKTOP_GRAB_RADIUS = 1.3;
// Equipamentos que se pegam uma vez e ficam com o jogador.
const GEAR_TYPES = new Set(['qps', 'qlink', 'visor']);
const GEAR_NAMES = { qps: 'QPS (chip quântico)', qlink: 'Q-LINK (relógio)', visor: 'VISOR ZETA (óculos)' };
const DESKTOP_DRINK_MS = 700;

AFRAME.registerComponent('hand-gestures', {
  init() {
    // Não use `get tracker()` na definição: o A-Frame lê getters ao registrar o
    // componente (sem `this.el`) e o registro falha com TypeError.
    Object.defineProperty(this, 'tracker', {
      get: () => this.el.components['xr-hands'],
    });

    this.held = { left: null, right: null };
    // 'touch' (estendeu a mão) ou 'pinch': só a pinça larga o item ao soltar.
    this.grabMode = { left: null, right: null };
    this.phaseCharge = 0;
    this.phaseCooldown = 0;
    this.eyesCovered = false;
    this.templeTouching = false;
    this.lastTempleTap = -Infinity;
    this.visorTapCooldown = 0;
    this.clock = 0;
    this.headLocal = new THREE.Vector3();
    this.inverseHead = new THREE.Quaternion();
    this.itemWorld = new THREE.Vector3();

    this.desktopHeld = null;
    this.desktopNearby = null;
    this.drinkStart = 0;
    this.desktopRight = new THREE.Vector3();
    this.desktopHold = new THREE.Vector3();
    this.onDesktopKeyDown = (event) => this.onDesktopKey(event);
    window.addEventListener('keydown', this.onDesktopKeyDown);
    this.onDesktopClickEvent = (event) => this.onDesktopClick(event);
    this.el.sceneEl.addEventListener('click', this.onDesktopClickEvent);

    this.onPinchStart = ({ detail }) => this.handlePinch(detail.hand);
    this.onPinchEnd = ({ detail }) => this.release(detail.hand);

    this.el.addEventListener('hand-pinchstart', this.onPinchStart);
    this.el.addEventListener('hand-pinchend', this.onPinchEnd);
  },

  remove() {
    window.removeEventListener('keydown', this.onDesktopKeyDown);
    this.el.sceneEl.removeEventListener('click', this.onDesktopClickEvent);
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

    if (this.held[side]) return;
    const item = window.quantumPlayer?.active && this.findNearestItem(hand.world, GRAB_RADIUS);
    if (!item) return;

    this.grab(side, item, 'pinch');
    if (GEAR_TYPES.has(item.dataset.item)) this.collectGear(item, 1200);
  },

  // Dois toques da mão direita na lateral direita do rosto ligam/desligam o visor.
  updateTempleTaps(dt, right) {
    this.clock += dt;
    this.visorTapCooldown = Math.max(0, this.visorTapCooldown - dt);
    if (!right.tracked || this.eyesCovered || this.held.right) {
      this.templeTouching = false;
      return;
    }
    const distance = this.distanceToFace('right', TEMPLE_OFFSET);
    if (!this.templeTouching && distance < TEMPLE_RADIUS) {
      this.templeTouching = true;
      if (this.clock - this.lastTempleTap < DOUBLE_TAP_SECONDS && this.visorTapCooldown === 0) {
        this.lastTempleTap = -Infinity;
        this.visorTapCooldown = VISOR_TAP_COOLDOWN;
        this.el.sceneEl.emit('visor-toggle-request', { source: 'right-temple' });
      } else {
        this.lastTempleTap = this.clock;
      }
    } else if (this.templeTouching && distance > TEMPLE_RELEASE) {
      this.templeTouching = false;
    }
  },

  grab(side, item, mode) {
    const other = side === 'left' ? 'right' : 'left';
    if (this.held[other] === item) this.held[other] = null;
    this.held[side] = item;
    this.grabMode[side] = mode;
    // Na mão a garrafa para de girar.
    item.removeAttribute('animation');
    item.object3D.rotation.set(0, 0, 0);
    item.emit('item-grabbed', { hand: side });
  },

  isHeld(item) {
    return this.held.left === item || this.held.right === item;
  },

  release(side) {
    // Fechar e abrir a mão ao pegar pela ponta dos dedos não deve largar a garrafa.
    if (this.grabMode[side] === 'touch') return;
    const item = this.held[side];
    this.held[side] = null;
    if (!item?.isConnected || item.dataset.consumed) return;

    item.dataset.droppedAt = String(performance.now());
    // Larga a garrafa na altura da cintura, onde dá para pegar de novo.
    item.object3D.position.y = Math.max(0.6, item.object3D.position.y);
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

  // Pegar um equipamento: avisa o jogo (gear-collected) e, no caso do QPS,
  // também quem escuta qps-collected (mapa).
  collectGear(item, removeAfter = 0) {
    if (item.dataset.consumed) return;
    const gear = item.dataset.item;
    if (gear === 'qps') this.consume(item, 'qps-collected', removeAfter);
    else this.consume(item, 'gear-collected', removeAfter);
    if (gear === 'qps') this.el.sceneEl.emit('gear-collected', { gear });
  },

  consume(item, eventName, removeAfter = 0) {
    item.dataset.consumed = 'true';
    // Itens de treino (lobby) avisam quem escuta para não disparar a medição real.
    this.el.sceneEl.emit(eventName, { id: item.dataset.itemId, training: item.dataset.training === 'true', gear: item.dataset.item });
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

    this.updateTempleTaps(dt, right);
    this.updateHeldItems();
    this.touchCollectItems();
    this.updatePhasePress(dt, bothTracked);
  },

  // Reserva para a pinça: tocar um item com a mão também o pega. Evita depender
  // do evento select do navegador (que varia entre mãos e controles).
  touchCollectItems() {
    if (!window.quantumPlayer?.active) return;

    ['left', 'right'].forEach((side) => {
      const hand = this.tracker.hands[side];
      if (!hand.tracked) return;

      const gear = this.findNearestItem(hand.world, GEAR_TOUCH_RADIUS);
      if (GEAR_TYPES.has(gear?.dataset.item)) this.collectGear(gear, 600);
      const item = this.findNearestItem(hand.world, TOUCH_RADIUS);
      // Encostar a mão na Água de Amêndoa a segura; levar à boca bebe, pinçar e soltar larga.
      const recentlyDropped = performance.now() - Number(item?.dataset.droppedAt || 0) < 1500;
      if (item?.dataset.item === 'almond-water' && !this.held[side] && !this.isHeld(item) && !recentlyDropped) {
        this.grab(side, item, 'touch');
      }
    });
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

  // Desktop: perto do QPS, Q (ou um clique nele) coleta. A Água de Amêndoa é pega
  // com E (fica na mão, no canto da tela) e um segundo E leva a garrafa à boca.
  updateDesktopPickup(headWorld) {
    if (!headWorld || !window.quantumPlayer?.active) return;

    const nearest = { gear: null, 'almond-water': null };
    const best = { gear: DESKTOP_GRAB_RADIUS, 'almond-water': DESKTOP_GRAB_RADIUS };
    this.el.sceneEl.querySelectorAll('[data-item]').forEach((item) => {
      const type = GEAR_TYPES.has(item.dataset.item) ? 'gear' : item.dataset.item;
      if (item.dataset.consumed || item === this.desktopHeld || !(type in nearest)) return;
      item.object3D.getWorldPosition(this.itemWorld);
      const distance = Math.hypot(this.itemWorld.x - headWorld.x, this.itemWorld.z - headWorld.z);
      if (distance < best[type]) {
        nearest[type] = item;
        best[type] = distance;
      }
    });

    if (nearest.gear !== this.desktopNearbyQps) {
      this.desktopNearbyQps = nearest.gear;
      if (nearest.gear) {
        this.el.sceneEl.emit('interaction-hint', { text: `${GEAR_NAMES[nearest.gear.dataset.item]} — aperte Q ou clique para pegar` });
      }
    }
    if (nearest['almond-water'] !== this.desktopNearby) {
      this.desktopNearby = nearest['almond-water'];
      if (this.desktopNearby && !this.desktopHeld) {
        this.el.sceneEl.emit('interaction-hint', { text: 'ÁGUA DE AMÊNDOA — aperte E para pegar' });
      }
    }
    // O caderno do lobby também usa E: avisa quando a tecla já está ocupada.
    window.quantumPlayer.desktopWaterBusy = Boolean(this.desktopNearby || this.desktopHeld);
    this.updateDesktopHeld();
  },

  collectDesktopQps(item = this.desktopNearbyQps) {
    if (!item?.isConnected || item.dataset.consumed || !GEAR_TYPES.has(item.dataset.item)) return;
    this.desktopNearbyQps = null;
    this.collectGear(item);
  },

  onDesktopClick(event) {
    if (this.tracker?.inVr || !window.quantumPlayer?.active) return;
    const item = event.target?.closest?.('[data-gear]');
    if (item && item === this.desktopNearbyQps) this.collectDesktopQps(item);
  },

  onDesktopKey(event) {
    if (event.repeat || this.tracker?.inVr || !window.quantumPlayer?.active) return;
    if (event.code === 'KeyQ') {
      this.collectDesktopQps();
      return;
    }
    if (event.code !== 'KeyE') return;

    if (this.desktopHeld && !this.drinkStart) {
      this.drinkStart = performance.now();
      return;
    }
    const item = this.desktopNearby;
    if (!item?.isConnected || item.dataset.consumed) return;

    this.desktopHeld = item;
    this.drinkStart = 0;
    item.removeAttribute('animation');
    this.el.sceneEl.emit('interaction-hint', { text: 'ÁGUA DE AMÊNDOA NA MÃO — aperte E de novo para beber' });
  },

  // Garrafa presa à câmera; ao beber, sobe até a boca e inclina.
  updateDesktopHeld() {
    const item = this.desktopHeld;
    if (!item) return;
    if (!item.isConnected || item.dataset.consumed) {
      this.desktopHeld = null;
      return;
    }

    const { head } = this.tracker;
    const forward = head.forward;
    const right = this.desktopRight.set(-forward.z, 0, forward.x).normalize();
    const progress = this.drinkStart ? Math.min(1, (performance.now() - this.drinkStart) / DESKTOP_DRINK_MS) : 0;
    const ease = progress * progress * (3 - 2 * progress);
    const hold = this.desktopHold.copy(head.world)
      .addScaledVector(forward, 0.36 - ease * 0.22)
      .addScaledVector(right, 0.16 * (1 - ease))
      .add({ x: 0, y: -0.2 + ease * 0.14, z: 0 });

    item.object3D.position.copy(item.object3D.parent.worldToLocal(hold));
    item.object3D.rotation.set(0, Math.atan2(-forward.x, -forward.z), 0);
    item.object3D.rotateX(ease * 1.4);

    if (progress >= 1) {
      this.desktopHeld = null;
      this.drinkStart = 0;
      this.consume(item, 'almond-water-drunk');
    }
  },
});
