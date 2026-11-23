// Fase 0 (lobby de treinamento): móveis do furniture pack, o caderno com o
// briefing da missão e as placas que explicam as mecânicas.

// Peças do furniture_pack.glb (Sketchfab, CC BY 4.0). Cada objeto é um conjunto
// de nós "Object_N" do GLB; as unidades do arquivo são ~4,7x o tamanho real.
const FURNITURE_GROUPS = {
  sofa: [12],
  metalTable: [7],
  terminal: [0, 1, 2, 3, 6, 10, 11, 15, 16, 17, 18],
  desk: [9],
  blueChair: [13, 14],
  officeChair: [5, 8],
  armchair: [4],
};
const FURNITURE_SCALE = 0.214;

AFRAME.registerComponent('lobby-furniture', {
  schema: {
    source: { type: 'selector', default: '#furniture-source' },
  },

  init() {
    this.onLoaded = () => this.build();
    const source = this.data.source;
    if (source?.getObject3D('mesh')) this.build();
    else source?.addEventListener('model-loaded', this.onLoaded, { once: true });
  },

  remove() {
    this.data.source?.removeEventListener('model-loaded', this.onLoaded);
  },

  buildGroup(root, indices) {
    const source = this.data.source.object3D;
    source.updateMatrixWorld(true);
    const inverse = source.matrixWorld.clone().invert();
    const inner = new THREE.Group();

    indices.forEach((index) => {
      const node = root.getObjectByName(`Object_${index + 2}`);
      if (!node) return;
      const clone = node.clone();
      clone.visible = true;
      inverse.clone().multiply(node.matrixWorld).decompose(clone.position, clone.quaternion, clone.scale);
      inner.add(clone);
    });

    inner.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(inner);
    const center = box.getCenter(new THREE.Vector3());
    inner.position.set(-center.x, -box.min.y, -center.z);
    const group = new THREE.Group();
    group.add(inner);
    group.scale.setScalar(FURNITURE_SCALE);
    return group;
  },

  build() {
    const root = this.data.source?.getObject3D('mesh');
    const layout = this.el.lobbyLayout || [];
    if (!root || this.built) return;
    this.built = true;

    layout.forEach(({ piece, x, z, y = 0, rotation = 0 }) => {
      const indices = FURNITURE_GROUPS[piece];
      if (!indices) return;
      const group = this.buildGroup(root, indices);
      group.position.set(x, y, z);
      group.rotation.y = THREE.MathUtils.degToRad(rotation);
      this.el.object3D.add(group);
    });
  },
});

// Caderno sobre a mesa: clicar (mouse) ou encostar a mão (VR) abre o briefing.
AFRAME.registerComponent('lobby-notebook', {
  schema: {
    player: { type: 'selector', default: '#player-head' },
    rig: { type: 'selector', default: '#player' },
    touchRadius: { type: 'number', default: 0.22 },
    closeDistance: { type: 'number', default: 4 },
  },

  init() {
    this.open = false;
    this.lastToggle = 0;
    this.world = new THREE.Vector3();
    this.headWorld = new THREE.Vector3();
    this.buildNotebook();
    this.buildMessage();

    this.onClick = () => this.toggle();
    this.onKey = (event) => {
      if (event.code !== 'KeyE' || event.repeat) return;
      // Perto ou segurando uma Água de Amêndoa, E é da garrafa.
      if (window.quantumPlayer?.desktopWaterBusy && !this.open) return;
      this.el.object3D.getWorldPosition(this.world);
      this.data.player.object3D.getWorldPosition(this.headWorld);
      if (Math.hypot(this.world.x - this.headWorld.x, this.world.z - this.headWorld.z) < 2) this.toggle();
    };
    this.clickTargets.forEach((target) => target.addEventListener('click', this.onClick));
    window.addEventListener('keydown', this.onKey);
  },

  remove() {
    window.removeEventListener('keydown', this.onKey);
    if (window.quantumPlayer) window.quantumPlayer.briefingOpen = false;
  },

  buildNotebook() {
    // Notebook da Divisão Q: base com teclado e tela de terminal verde (a tela
    // fica virada para +Z local, a dobradiça na borda de trás).
    const base = document.createElement('a-box');
    base.classList.add('clickable');
    base.setAttribute('width', 0.34);
    base.setAttribute('height', 0.018);
    base.setAttribute('depth', 0.23);
    base.setAttribute('material', 'color: #1c1f22; metalness: 0.4; roughness: 0.5');
    this.el.appendChild(base);

    const keyboardCanvas = document.createElement('canvas');
    keyboardCanvas.width = 256;
    keyboardCanvas.height = 128;
    const keys = keyboardCanvas.getContext('2d');
    keys.fillStyle = '#15181a';
    keys.fillRect(0, 0, 256, 128);
    keys.fillStyle = '#2c3135';
    for (let row = 0; row < 5; row += 1) {
      for (let col = 0; col < 13; col += 1) keys.fillRect(14 + col * 18, 8 + row * 13, 15, 10);
    }
    keys.fillRect(70, 75, 116, 10);
    keys.fillStyle = '#23272a';
    keys.fillRect(92, 92, 72, 30);
    const keyboard = document.createElement('a-plane');
    keyboard.setAttribute('width', 0.32);
    keyboard.setAttribute('height', 0.21);
    keyboard.setAttribute('rotation', '-90 0 0');
    keyboard.setAttribute('position', '0 0.0095 0');
    keyboard.setAttribute('material', 'shader: flat; color: #ffffff');
    keyboard.addEventListener('loaded', () => {
      const texture = new THREE.CanvasTexture(keyboardCanvas);
      if ('colorSpace' in texture) texture.colorSpace = THREE.SRGBColorSpace;
      keyboard.getObject3D('mesh').material.map = texture;
      keyboard.getObject3D('mesh').material.needsUpdate = true;
    });
    this.el.appendChild(keyboard);

    const hinge = document.createElement('a-entity');
    hinge.setAttribute('position', '0 0.009 -0.112');
    hinge.setAttribute('rotation', '-14 0 0');
    const lid = document.createElement('a-box');
    lid.classList.add('clickable');
    lid.setAttribute('width', 0.34);
    lid.setAttribute('height', 0.22);
    lid.setAttribute('depth', 0.012);
    lid.setAttribute('position', '0 0.11 0');
    lid.setAttribute('material', 'color: #1c1f22; metalness: 0.4; roughness: 0.5');
    hinge.appendChild(lid);

    this.screenCanvas = document.createElement('canvas');
    this.screenCanvas.width = 512;
    this.screenCanvas.height = 320;
    this.screenTexture = new THREE.CanvasTexture(this.screenCanvas);
    if ('colorSpace' in this.screenTexture) this.screenTexture.colorSpace = THREE.SRGBColorSpace;
    this.drawScreen();
    const screen = document.createElement('a-plane');
    screen.classList.add('clickable');
    screen.setAttribute('width', 0.31);
    screen.setAttribute('height', 0.194);
    screen.setAttribute('position', '0 0.112 0.0065');
    screen.setAttribute('material', 'shader: flat; color: #ffffff');
    screen.addEventListener('loaded', () => {
      screen.getObject3D('mesh').material.map = this.screenTexture;
      screen.getObject3D('mesh').material.needsUpdate = true;
    });
    hinge.appendChild(screen);
    this.el.appendChild(hinge);

    // Brilho verde da tela sobre a mesa.
    const glow = document.createElement('a-entity');
    glow.setAttribute('light', 'type: point; color: #39ff88; intensity: 0.35; distance: 1.4');
    glow.setAttribute('position', '0 0.15 0.12');
    this.el.appendChild(glow);

    this.clickTargets = [base, lid, screen];

    // Anel verde pulsando para chamar atenção.
    const ring = document.createElement('a-ring');
    ring.setAttribute('radius-inner', 0.24);
    ring.setAttribute('radius-outer', 0.27);
    ring.setAttribute('rotation', '-90 0 0');
    ring.setAttribute('position', '0 -0.008 0');
    ring.setAttribute('material', 'color: #39ff88; shader: flat; transparent: true; opacity: 0.6');
    ring.setAttribute('animation', 'property: material.opacity; from: 0.15; to: 0.8; dir: alternate; loop: true; dur: 900');
    this.ring = ring;
    this.el.appendChild(ring);
  },

  drawScreen() {
    window.drawTerminal(this.screenCanvas, {
      title: 'DIVISÃO Q',
      subtitle: 'ESTAÇÃO 0',
      body: this.open
        ? 'ARQUIVO 0 ABERTO\nLendo relatório...'
        : 'ARQUIVO 0 // CONFIDENCIAL\nAGENTE M. VIDAL\n\n1 MENSAGEM NÃO LIDA',
      footer: this.open ? '> CLIQUE PARA FECHAR' : '> CLIQUE OU APERTE E',
      fontSize: 28,
      blink: true,
    });
    this.screenTexture.needsUpdate = true;
  },

  buildMessage() {
    this.message = document.createElement('a-entity');
    this.message.setAttribute('terminal-panel', {
      title: 'ARQUIVO 0 // CONFIDENCIAL',
      subtitle: 'DIVISÃO Q',
      body: [
        'AGENTE MARA VIDAL: DESAPARECIDA',
        '',
        'Último sinal: 72 horas atrás, no Level 0. Ela desceu para medir uma anomalia quântica e o Q-LINK dela parou de responder.',
        '',
        'Sua missão: atravessar os andares e encontrá-la. Siga os QPS, guarde a Água de Amêndoa e não encare a entidade.',
        '',
        'Precisamos ir atrás dela.',
      ].join('\\n'),
      footer: '> TOQUE OU CLIQUE NO COMPUTADOR PARA FECHAR',
      width: 1.3,
      height: 0.95,
      fontSize: 30,
      blink: false,
    });
    this.message.setAttribute('visible', false);
    this.message.setAttribute('position', '0 0.75 0');
    this.el.appendChild(this.message);
  },

  toggle() {
    const now = performance.now();
    if (now - this.lastToggle < 800) return;
    this.lastToggle = now;
    this.open = !this.open;
    this.message.object3D.visible = this.open;
    this.ring.object3D.visible = !this.open;
    this.drawScreen();
    // A seta para a porta só aparece depois do briefing e some com o painel aberto.
    if (window.quantumPlayer) {
      window.quantumPlayer.briefingOpen = this.open;
      if (this.open) window.quantumPlayer.briefingRead = true;
    }

    if (this.open) {
      // Vira o painel para o jogador.
      this.data.player.object3D.getWorldPosition(this.headWorld);
      this.message.object3D.getWorldPosition(this.world);
      this.message.object3D.lookAt(this.headWorld.x, this.world.y, this.headWorld.z);
      this.el.sceneEl.emit('lobby-briefing-opened');
    }
  },

  tick(time) {
    if (time - (this.lastScreenDraw || 0) > 500) {
      this.lastScreenDraw = time;
      this.drawScreen();
    }
    const tracker = this.data.rig?.components['xr-hands'];
    this.el.object3D.getWorldPosition(this.world);

    if (tracker?.inVr) {
      const touching = ['left', 'right'].some((side) => (
        tracker.hands[side].tracked && tracker.hands[side].world.distanceTo(this.world) < this.data.touchRadius
      ));
      if (touching && !this.touching) this.toggle();
      this.touching = touching;
    }

    if (this.open) {
      this.data.player.object3D.getWorldPosition(this.headWorld);
      const distance = Math.hypot(this.world.x - this.headWorld.x, this.world.z - this.headWorld.z);
      if (distance > this.data.closeDistance) this.toggle();
    }
  },
});

// Marca uma parede de treino do lobby para ficar impossível de não ver: campo
// listrado brilhante na parede, moldura, faixa no chão com a tecla e um aviso
// quando o jogador chega perto. A frente (+Z local) aponta para dentro da sala.
AFRAME.registerComponent('training-wall', {
  schema: {
    player: { type: 'selector', default: '#player-head' },
    color: { type: 'color', default: '#44ffcc' },
    title: { type: 'string', default: 'ATRAVESSE AQUI' },
    floorText: { type: 'string', default: 'SALTO DE FASE — APERTE X' },
    hint: { type: 'string', default: '' },
    width: { type: 'number', default: 2 },
    height: { type: 'number', default: 1.8 },
    hintRadius: { type: 'number', default: 1.8 },
  },

  init() {
    const { color, width, height } = this.data;
    this.world = new THREE.Vector3();
    this.headWorld = new THREE.Vector3();
    this.near = false;

    // Campo listrado que desliza: deixa claro que a parede "não é normal".
    this.fieldCanvas = document.createElement('canvas');
    this.fieldCanvas.width = 256;
    this.fieldCanvas.height = 256;
    this.fieldTexture = new THREE.CanvasTexture(this.fieldCanvas);
    this.fieldTexture.wrapS = THREE.RepeatWrapping;
    this.fieldTexture.wrapT = THREE.RepeatWrapping;
    this.fieldTexture.repeat.set(width / 0.6, height / 0.6);
    this.drawField();
    const field = new THREE.Mesh(
      new THREE.PlaneGeometry(width, height),
      new THREE.MeshBasicMaterial({ map: this.fieldTexture, transparent: true, opacity: 0.55, depthWrite: false, fog: false })
    );
    field.position.set(0, height / 2 + 0.06, 0.012);
    this.field = field;
    this.el.object3D.add(field);

    // Moldura brilhante.
    const frameMaterial = new THREE.MeshBasicMaterial({ color, fog: false });
    const bar = (w, h, x, y) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.03), frameMaterial);
      mesh.position.set(x, y, 0.02);
      this.el.object3D.add(mesh);
    };
    const top = height + 0.06;
    bar(width + 0.06, 0.05, 0, top);
    bar(width + 0.06, 0.05, 0, 0.06);
    bar(0.05, height, -width / 2, height / 2 + 0.06);
    bar(0.05, height, width / 2, height / 2 + 0.06);
    this.frameMaterial = frameMaterial;

    // Letreiro grande no meio do campo.
    const label = document.createElement('a-entity');
    label.setAttribute('canvas-text', { value: this.data.title, color: '#ffffff', width: 1.5, align: 'center', overlay: false });
    label.setAttribute('position', `0 ${height * 0.62} 0.03`);
    label.setAttribute('scale', '2.2 2.2 1');
    this.el.appendChild(label);

    // Faixa no chão com a tecla.
    const plateCanvas = document.createElement('canvas');
    plateCanvas.width = 512;
    plateCanvas.height = 160;
    const ctx = plateCanvas.getContext('2d');
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 0, 512, 160);
    ctx.strokeStyle = color;
    ctx.lineWidth = 8;
    ctx.setLineDash([26, 14]);
    ctx.strokeRect(8, 8, 496, 144);
    ctx.fillStyle = color;
    ctx.font = 'bold 40px system-ui, Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.data.floorText, 256, 80);
    const plateTexture = new THREE.CanvasTexture(plateCanvas);
    if ('colorSpace' in plateTexture) plateTexture.colorSpace = THREE.SRGBColorSpace;
    const plate = new THREE.Mesh(
      new THREE.PlaneGeometry(width, width * (160 / 512)),
      new THREE.MeshBasicMaterial({ map: plateTexture, transparent: true, depthWrite: false, fog: false })
    );
    plate.rotation.x = -Math.PI / 2;
    plate.position.set(0, 0.012, 0.55);
    this.el.object3D.add(plate);

    const glow = document.createElement('a-entity');
    glow.setAttribute('light', `type: point; color: ${color}; intensity: 0.7; distance: 3`);
    glow.setAttribute('position', `0 ${height * 0.6} 0.6`);
    this.el.appendChild(glow);
  },

  drawField() {
    const ctx = this.fieldCanvas.getContext('2d');
    ctx.clearRect(0, 0, 256, 256);
    ctx.strokeStyle = this.data.color;
    ctx.lineWidth = 22;
    ctx.globalAlpha = 0.8;
    for (let i = -512; i < 768; i += 64) {
      ctx.beginPath();
      ctx.moveTo(i, 256);
      ctx.lineTo(i + 256, 0);
      ctx.stroke();
    }
    this.fieldTexture.needsUpdate = true;
  },

  tick(time) {
    this.fieldTexture.offset.x = (time * 0.00025) % 1;
    this.field.material.opacity = 0.35 + 0.25 * (0.5 + 0.5 * Math.sin(time * 0.004));

    if (!this.data.hint || !this.data.player) return;
    this.el.object3D.getWorldPosition(this.world);
    this.data.player.object3D.getWorldPosition(this.headWorld);
    const near = Math.hypot(this.world.x - this.headWorld.x, this.world.z - this.headWorld.z) < this.data.hintRadius;
    if (near && !this.near) this.el.sceneEl.emit('interaction-hint', { text: this.data.hint });
    this.near = near;
  },
});
