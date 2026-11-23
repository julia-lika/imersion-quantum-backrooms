// Notebook do briefing sobre a mesa: clicar, apertar E por perto ou encostar a
// mão (VR) abre o arquivo da agente desaparecida.
AFRAME.registerComponent('lobby-computer', {
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
    this.buildComputer();
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

  buildComputer() {
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
