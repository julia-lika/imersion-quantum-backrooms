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
      if (event.code !== 'KeyE') return;
      this.el.object3D.getWorldPosition(this.world);
      this.data.player.object3D.getWorldPosition(this.headWorld);
      if (Math.hypot(this.world.x - this.headWorld.x, this.world.z - this.headWorld.z) < 2) this.toggle();
    };
    this.cover.addEventListener('click', this.onClick);
    window.addEventListener('keydown', this.onKey);
  },

  remove() {
    window.removeEventListener('keydown', this.onKey);
    if (window.quantumPlayer) window.quantumPlayer.briefingOpen = false;
  },

  buildNotebook() {
    // Caderno: capa vinho com etiqueta "CONFIDENCIAL" e miolo de papel.
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 320;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#5a1620';
    ctx.fillRect(0, 0, 256, 320);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    for (let y = 0; y < 320; y += 3) ctx.fillRect(0, y, 256, 1);
    ctx.fillStyle = '#e8dfc4';
    ctx.fillRect(40, 90, 176, 70);
    ctx.fillStyle = '#5a1620';
    ctx.font = 'bold 22px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('CONFIDENCIAL', 128, 122);
    ctx.font = '16px "Courier New", monospace';
    ctx.fillText('AGENTE M. VIDAL', 128, 146);
    ctx.fillStyle = '#c9a45a';
    for (let y = 20; y < 320; y += 22) ctx.fillRect(10, y, 12, 6);
    const coverTexture = new THREE.CanvasTexture(canvas);
    if ('colorSpace' in coverTexture) coverTexture.colorSpace = THREE.SRGBColorSpace;

    this.cover = document.createElement('a-box');
    this.cover.classList.add('clickable');
    this.cover.setAttribute('width', 0.22);
    this.cover.setAttribute('height', 0.025);
    this.cover.setAttribute('depth', 0.29);
    this.cover.setAttribute('material', 'color: #e9e2cc; roughness: 0.9');
    this.cover.addEventListener('loaded', () => {
      const mesh = this.cover.getObject3D('mesh');
      const paper = new THREE.MeshStandardMaterial({ color: '#e9e2cc', roughness: 0.9 });
      const top = new THREE.MeshStandardMaterial({ map: coverTexture, roughness: 0.7 });
      const side = new THREE.MeshStandardMaterial({ color: '#4a121a', roughness: 0.8 });
      // Ordem das faces do BoxGeometry: +x, -x, +y, -y, +z, -z.
      mesh.material = [paper, side, top, side, paper, paper];
    });
    this.el.appendChild(this.cover);

    // Anel verde pulsando para chamar atenção.
    const ring = document.createElement('a-ring');
    ring.setAttribute('radius-inner', 0.2);
    ring.setAttribute('radius-outer', 0.23);
    ring.setAttribute('rotation', '-90 0 0');
    ring.setAttribute('position', '0 -0.011 0');
    ring.setAttribute('material', 'color: #39ff88; shader: flat; transparent: true; opacity: 0.6');
    ring.setAttribute('animation', 'property: material.opacity; from: 0.15; to: 0.8; dir: alternate; loop: true; dur: 900');
    this.ring = ring;
    this.el.appendChild(ring);
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
        'Sua missão: atravessar os andares e encontrá-la. Siga os QPS, guarde a Almond Water e não encare a entidade.',
        '',
        'Precisamos ir atrás dela.',
      ].join('\\n'),
      footer: '> TOQUE OU CLIQUE NO CADERNO PARA FECHAR',
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

  tick() {
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
