// Menu inicial dentro do VR. A tela inicial em HTML some no headset, então este
// painel 3D a espelha enquanto ela estiver aberta: ENTRAR NO LOBBY, CONTINUAR e
// MODO COOPERATIVO (com teclado de letras para o código da sala).
//
// Cada botão só clica no botão HTML correspondente, então a lógica do jogo é a
// mesma do desktop. Para escolher: aponte (raio do controle ou da mão) e aperte
// o gatilho / faça a pinça, ou encoste a mão no botão.
const MENU_WIDTH = 0.66;
const MENU_HEIGHT = 0.5;
const MENU_DISTANCE = 0.62;
const MENU_DROP = 0.12;
// Fora deste ângulo do olhar o painel volta para a frente do jogador.
const MENU_FOLLOW_ANGLE = THREE.MathUtils.degToRad(55);
const CANVAS_W = 1056;
const CANVAS_H = 800;
const KEYS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const GREEN = '#39ff88';
const GREEN_DIM = 'rgba(57, 255, 136, 0.45)';
const GREEN_FAINT = 'rgba(57, 255, 136, 0.12)';
const MONO = '"Courier New", ui-monospace, monospace';
// Toque: a palma a menos de POKE_DEPTH do painel (na frente) aperta; precisa se
// afastar POKE_RELEASE antes de apertar de novo.
const POKE_DEPTH = 0.035;
const POKE_BEHIND = 0.1;
const POKE_RELEASE = 0.07;
const RAY_LENGTH = 3;

const $ = (id) => document.getElementById(id);

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

AFRAME.registerComponent('vr-start-menu', {
  schema: {
    player: { type: 'selector', default: '#player' },
  },

  init() {
    this.page = 'main';
    this.buttons = [];
    this.hover = { left: null, right: null };
    this.poked = { left: false, right: false };
    this.visible = false;
    this.lastDraw = 0;
    this.signature = '';
    this.raycaster = new THREE.Raycaster();
    this.rayOrigin = new THREE.Vector3();
    this.rayDirection = new THREE.Vector3();
    this.local = new THREE.Vector3();
    this.toPanel = new THREE.Vector3();
    this.forward = new THREE.Vector3();

    this.canvas = document.createElement('canvas');
    this.canvas.width = CANVAS_W;
    this.canvas.height = CANVAS_H;
    this.texture = new THREE.CanvasTexture(this.canvas);
    if ('colorSpace' in this.texture) this.texture.colorSpace = THREE.SRGBColorSpace;
    this.material = new THREE.MeshBasicMaterial({
      map: this.texture,
      transparent: true,
      toneMapped: false,
      fog: false,
      depthTest: false,
      depthWrite: false,
    });
    this.panel = new THREE.Mesh(new THREE.PlaneGeometry(MENU_WIDTH, MENU_HEIGHT), this.material);
    this.panel.renderOrder = 950;
    this.el.setObject3D('mesh', this.panel);
    this.el.object3D.visible = false;

    // Raio de cada mão (linha fina) e o ponto onde ele toca o painel.
    this.lasers = {};
    ['left', 'right'].forEach((side) => {
      const geometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 0, -1)]);
      const line = new THREE.Line(geometry, new THREE.LineBasicMaterial({
        color: GREEN, transparent: true, opacity: 0.7, depthTest: false, fog: false, toneMapped: false,
      }));
      line.renderOrder = 951;
      line.frustumCulled = false;
      line.visible = false;
      const dot = new THREE.Mesh(
        new THREE.CircleGeometry(0.008, 16),
        new THREE.MeshBasicMaterial({ color: GREEN, depthTest: false, fog: false, toneMapped: false })
      );
      dot.renderOrder = 952;
      dot.visible = false;
      this.el.sceneEl.object3D.add(line, dot);
      this.lasers[side] = { line, dot };
    });

    this.onPinch = ({ detail }) => {
      if (!this.visible) return;
      const button = this.hover[detail.hand];
      if (button) this.press(button);
    };
    this.data.player?.addEventListener('hand-pinchstart', this.onPinch);
  },

  remove() {
    this.data.player?.removeEventListener('hand-pinchstart', this.onPinch);
    Object.values(this.lasers).forEach(({ line, dot }) => {
      line.parent?.remove(line);
      dot.parent?.remove(dot);
    });
    this.el.removeObject3D('mesh');
    this.panel.geometry.dispose();
    this.material.dispose();
    this.texture.dispose();
  },

  tracker() {
    return this.data.player?.components['xr-hands'];
  },

  // O menu existe enquanto a tela inicial HTML estiver aberta e o jogador estiver no VR.
  shouldShow(tracker) {
    const screen = $('start-screen');
    return Boolean(tracker?.inVr && screen && !screen.hidden);
  },

  placeInFront(head) {
    this.forward.copy(head.forward).setY(0);
    if (this.forward.lengthSq() < 1e-6) this.forward.set(0, 0, -1);
    this.forward.normalize();
    this.el.object3D.position.copy(head.world)
      .addScaledVector(this.forward, MENU_DISTANCE)
      .add({ x: 0, y: -MENU_DROP, z: 0 });
    this.el.object3D.rotation.set(0, Math.atan2(-this.forward.x, -this.forward.z), 0);
    this.el.object3D.updateMatrixWorld(true);
  },

  press(button) {
    if (button.disabled) return;
    this.el.sceneEl.emit('screen-effect', { type: 'flash', color: GREEN, duration: 160, peak: 0.12 });
    button.action();
    this.signature = '';
  },

  // Botões da página atual, em pixels do canvas.
  layout() {
    const buttons = [];
    const add = (id, label, x, y, w, h, action, extra = {}) => buttons.push({ id, label, x, y, w, h, action, ...extra });
    const startButton = $('start-game');
    const continueButton = $('continue-game');
    const coop = window.quantumCoop;

    if (this.page === 'main') {
      let y = 270;
      add('start', startButton?.textContent || 'ENTRAR NO LOBBY', 178, y, 700, 104, () => startButton?.click(), { primary: true });
      y += 128;
      if (continueButton && !continueButton.hidden) {
        add('continue', continueButton.textContent, 178, y, 700, 92, () => continueButton.click());
        y += 116;
      }
      add('coop', 'MODO COOPERATIVO (2 JOGADORES)', 178, y, 700, 92, () => {
        if ($('coop-panel')?.hidden) $('coop-open')?.click();
        this.page = 'coop';
      });
      return buttons;
    }

    // Página do cooperativo: teclado com as letras do código da sala.
    const cols = 8;
    const keyW = 104;
    const keyH = 74;
    const gap = 10;
    const left = (CANVAS_W - (cols * keyW + (cols - 1) * gap)) / 2;
    [...KEYS].forEach((letter, index) => {
      const x = left + (index % cols) * (keyW + gap);
      const y = 300 + Math.floor(index / cols) * (keyH + gap);
      add(`key-${letter}`, letter, x, y, keyW, keyH, () => this.typeLetter(letter), { key: true });
    });
    const rowY = 300 + 3 * (keyH + gap) + 14;
    const code = $('coop-code')?.value || '';
    add('back', 'VOLTAR', left, rowY, 200, 84, () => { this.page = 'main'; });
    add('erase', 'APAGAR', left + 214, rowY, 200, 84, () => {
      const input = $('coop-code');
      if (input) input.value = input.value.slice(0, -1);
    });
    if (coop?.active && coop.floor) {
      add('start', startButton?.textContent || 'ENTRAR COMO EXPLORADOR', left + 428, rowY, cols * keyW + (cols - 1) * gap - 428, 84,
        () => startButton?.click(), { primary: true });
    } else {
      add('connect', 'CONECTAR', left + 428, rowY, cols * keyW + (cols - 1) * gap - 428, 84,
        () => $('coop-connect')?.click(), { primary: true, disabled: code.length !== 4 || $('coop-connect')?.disabled });
    }
    return buttons;
  },

  typeLetter(letter) {
    const input = $('coop-code');
    if (!input || input.value.length >= 4) return;
    input.value += letter;
  },

  draw() {
    const ctx = this.canvas.getContext('2d');
    const W = CANVAS_W;
    const H = CANVAS_H;
    ctx.clearRect(0, 0, W, H);

    roundRect(ctx, 6, 6, W - 12, H - 12, 26);
    ctx.fillStyle = 'rgba(4, 10, 6, 0.94)';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = GREEN_DIM;
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = GREEN;
    ctx.fillStyle = GREEN;
    ctx.shadowBlur = 14;
    ctx.font = `bold 62px ${MONO}`;
    ctx.fillText('QUANTUM BACKROOMS', W / 2, 92);
    ctx.shadowBlur = 0;
    ctx.fillStyle = GREEN_DIM;
    ctx.font = `24px ${MONO}`;
    ctx.fillText(this.page === 'main' ? 'UM EXPERIMENTO DE INCERTEZA ESPACIAL' : 'MODO COOPERATIVO — EXPLORADOR', W / 2, 146);

    if (this.page === 'coop') {
      ctx.font = `20px ${MONO}`;
      ctx.fillText('DIGITE O CÓDIGO DA SALA QUE APARECE NO CONSOLE DO OPERADOR', W / 2, 184);
      const code = ($('coop-code')?.value || '').toUpperCase();
      for (let index = 0; index < 4; index += 1) {
        const x = W / 2 - 2 * 86 + index * 86 + 8;
        roundRect(ctx, x, 208, 70, 70, 8);
        ctx.strokeStyle = index === code.length ? GREEN : GREEN_DIM;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = GREEN;
        ctx.font = `bold 46px ${MONO}`;
        ctx.fillText(code[index] || '', x + 35, 245);
      }
    }

    this.buttons.forEach((button) => {
      const hovered = this.hover.left === button || this.hover.right === button;
      roundRect(ctx, button.x, button.y, button.w, button.h, button.key ? 8 : 12);
      ctx.fillStyle = hovered && !button.disabled
        ? 'rgba(57, 255, 136, 0.32)'
        : (button.primary && !button.disabled ? 'rgba(57, 255, 136, 0.14)' : 'rgba(57, 255, 136, 0.05)');
      ctx.fill();
      ctx.lineWidth = hovered ? 4 : 2;
      ctx.strokeStyle = button.disabled ? GREEN_FAINT : (hovered ? GREEN : GREEN_DIM);
      ctx.stroke();
      ctx.fillStyle = button.disabled ? GREEN_DIM : GREEN;
      ctx.font = `bold ${button.key ? 38 : 32}px ${MONO}`;
      ctx.fillText(button.label, button.x + button.w / 2, button.y + button.h / 2 + 2);
    });

    ctx.font = `20px ${MONO}`;
    ctx.fillStyle = GREEN_DIM;
    if (this.page === 'coop') {
      const status = `${$('coop-status')?.textContent || ''}  //  ${$('coop-voice')?.textContent || ''}`;
      ctx.fillText(status.slice(0, 86), W / 2, H - 82);
    }
    ctx.fillText('APONTE E APERTE O GATILHO OU FAÇA A PINÇA — OU ENCOSTE A MÃO NO BOTÃO', W / 2, H - 46);

    this.texture.needsUpdate = true;
  },

  // Botão sob um ponto do painel (coordenadas locais em metros).
  buttonAt(x, y) {
    const px = (x / MENU_WIDTH + 0.5) * CANVAS_W;
    const py = (0.5 - y / MENU_HEIGHT) * CANVAS_H;
    return this.buttons.find((b) => px >= b.x && px <= b.x + b.w && py >= b.y && py <= b.y + b.h) || null;
  },

  updateHand(side, tracker) {
    const hand = tracker.hands[side];
    const laser = this.lasers[side];
    laser.line.visible = false;
    laser.dot.visible = false;
    this.hover[side] = null;
    if (!hand.tracked) return;

    // Toque: palma encostada no painel.
    this.local.copy(hand.world);
    this.panel.worldToLocal(this.local);
    const inside = Math.abs(this.local.x) < MENU_WIDTH / 2 && Math.abs(this.local.y) < MENU_HEIGHT / 2;
    if (this.local.z > POKE_RELEASE || !inside) this.poked[side] = false;
    if (inside && this.local.z < POKE_DEPTH && this.local.z > -POKE_BEHIND) {
      const button = this.buttonAt(this.local.x, this.local.y);
      this.hover[side] = button;
      if (button && !this.poked[side]) {
        this.poked[side] = true;
        this.press(button);
      }
      return;
    }

    // Raio: do controle ou da mão (targetRaySpace do WebXR).
    if (!hand.rayValid) return;
    this.rayOrigin.copy(hand.rayOrigin).applyMatrix4(this.data.player.object3D.matrixWorld);
    this.rayDirection.copy(hand.rayDirection).transformDirection(this.data.player.object3D.matrixWorld);
    this.raycaster.set(this.rayOrigin, this.rayDirection);
    this.raycaster.far = RAY_LENGTH;
    const hit = this.raycaster.intersectObject(this.panel, false)[0];
    const end = hit ? hit.point : this.rayOrigin.clone().addScaledVector(this.rayDirection, 0.6);

    const positions = laser.line.geometry.attributes.position;
    positions.setXYZ(0, this.rayOrigin.x, this.rayOrigin.y, this.rayOrigin.z);
    positions.setXYZ(1, end.x, end.y, end.z);
    positions.needsUpdate = true;
    laser.line.visible = true;
    if (!hit) return;

    this.local.copy(hit.point);
    this.panel.worldToLocal(this.local);
    this.hover[side] = this.buttonAt(this.local.x, this.local.y);
    laser.dot.position.copy(hit.point).addScaledVector(this.rayDirection, -0.002);
    laser.dot.quaternion.copy(this.el.object3D.quaternion);
    laser.dot.visible = true;
  },

  tick(time) {
    const tracker = this.tracker();
    const show = this.shouldShow(tracker);

    if (show !== this.visible) {
      this.visible = show;
      this.el.object3D.visible = show;
      // A dica do desktop fica presa à câmera e cobriria o menu.
      const hint = $('desktop-hint');
      if (hint && show) {
        this.hintWasVisible = hint.object3D.visible;
        hint.object3D.visible = false;
      } else if (hint && this.hintWasVisible) {
        hint.object3D.visible = true;
      }
      if (show) {
        this.page = window.quantumCoop?.active ? 'coop' : 'main';
        this.placeInFront(tracker.head);
        this.signature = '';
      } else {
        Object.values(this.lasers).forEach(({ line, dot }) => { line.visible = false; dot.visible = false; });
      }
    }
    if (!show) return;

    // Se o jogador virar (ou o rig girar ao entrar no VR), o painel volta para a frente.
    this.toPanel.subVectors(this.el.object3D.position, tracker.head.world).setY(0);
    this.forward.copy(tracker.head.forward).setY(0);
    if (this.toPanel.lengthSq() > 1e-6 && this.forward.lengthSq() > 1e-6 &&
      this.toPanel.angleTo(this.forward) > MENU_FOLLOW_ANGLE) {
      this.placeInFront(tracker.head);
    }

    this.buttons = this.layout();
    this.el.object3D.updateMatrixWorld(true);
    // Mantém o objeto do botão em foco entre quadros (layout recria a lista).
    ['left', 'right'].forEach((side) => {
      this.updateHand(side, tracker);
      const hovered = this.hover[side];
      if (hovered) this.hover[side] = this.buttons.find((b) => b.id === hovered.id) || null;
    });

    const signature = [
      this.page, this.hover.left?.id, this.hover.right?.id, this.buttons.map((b) => `${b.label}${b.disabled ? '!' : ''}`).join('|'),
      $('coop-code')?.value, $('coop-status')?.textContent, $('coop-voice')?.textContent,
    ].join('#');
    if (signature !== this.signature || time - this.lastDraw > 1000) {
      this.signature = signature;
      this.lastDraw = time;
      this.draw();
    }
  },
});
