// QPS como mapa. Pegar o QPS é medir: ele grava a planta do andar naquele
// instante. Depois, os trechos que ninguém observa se reorganizam (decoerência)
// e o mapa vai ficando desatualizado: esses setores aparecem chiando, como
// estática, até uma nova leitura.
//
// VR: aparece ao olhar para o pulso direito; pinça com a mão esquerda perto
// dele faz uma nova leitura. Desktop: M abre/fecha, R faz uma nova leitura.
const MAP_PANEL_WIDTH = 0.2;
const MAP_PANEL_HEIGHT = 0.24;
const MAP_LOOK_ANGLE = THREE.MathUtils.degToRad(28);
const MAP_LOOK_DISTANCE = 0.7;
const MAP_REREAD_REACH = 0.16;
const MAP_REDRAW_MS = 180;
const MAP_GREEN = '#39ff88';
const MAP_DIM = 'rgba(57, 255, 136, 0.45)';
const MAP_FAINT = 'rgba(57, 255, 136, 0.12)';
const MAP_MONO = '"Courier New", ui-monospace, monospace';

AFRAME.registerComponent('qps-map', {
  schema: {
    hand: { type: 'string', default: 'right' },
    toggleKey: { type: 'string', default: 'KeyM' },
    rereadKey: { type: 'string', default: 'KeyR' },
  },

  init() {
    this.snapshot = null;
    this.hasQps = false;
    this.opacity = 0;
    this.desktopOpen = false;
    this.lastDraw = 0;
    this.target = new THREE.Vector3();
    this.toPanel = new THREE.Vector3();
    this.forward = new THREE.Vector3();

    this.canvas = document.createElement('canvas');
    this.canvas.width = 600;
    this.canvas.height = 720;
    this.texture = new THREE.CanvasTexture(this.canvas);
    if ('colorSpace' in this.texture) this.texture.colorSpace = THREE.SRGBColorSpace;
    this.material = new THREE.MeshBasicMaterial({
      map: this.texture, transparent: true, opacity: 0, toneMapped: false, fog: false, depthWrite: false,
    });
    this.panel = new THREE.Mesh(new THREE.PlaneGeometry(MAP_PANEL_WIDTH, MAP_PANEL_HEIGHT), this.material);
    this.panel.renderOrder = 900;
    this.el.setObject3D('mesh', this.panel);
    this.el.object3D.visible = false;

    // Pegar o QPS (de treino ou de verdade) = primeira leitura.
    this.onQps = () => {
      this.hasQps = true;
      this.desktopOpen = true;
      this.takeReading();
    };
    // Andar novo: o QPS fica para trás e o mapa some.
    this.onWorld = ({ detail }) => {
      const floor = window.quantumPlayer?.floor ?? 0;
      if (floor !== this.floor) {
        this.floor = floor;
        this.hasQps = false;
        this.snapshot = null;
      }
      if (detail?.lobby && this.snapshot) this.takeReading();
    };
    this.onGranted = () => this.takeReading();
    this.onKey = (event) => {
      if (event.repeat || !window.quantumPlayer?.active) return;
      if (event.code === this.data.toggleKey) {
        this.desktopOpen = !this.desktopOpen;
        if (this.desktopOpen) this.draw();
      }
      if (event.code === this.data.rereadKey) this.requestReading();
    };
    this.onPinch = ({ detail }) => {
      if (detail.hand === this.data.hand || this.opacity < 0.5) return;
      const tracker = this.el.parentEl?.components['xr-hands'];
      const other = tracker?.hands[detail.hand];
      if (!other?.tracked) return;
      this.el.object3D.getWorldPosition(this.target);
      if (other.world.distanceTo(this.target) < MAP_REREAD_REACH) this.requestReading();
    };

    const scene = this.el.sceneEl;
    scene.addEventListener('qps-collected', this.onQps);
    scene.addEventListener('maze-world-updated', this.onWorld);
    scene.addEventListener('qps-reading-granted', this.onGranted);
    this.el.parentEl?.addEventListener('hand-pinchstart', this.onPinch);
    window.addEventListener('keydown', this.onKey);
    window.quantumQpsMap = {
      state: () => ({
        hasQps: this.hasQps,
        reading: Boolean(this.snapshot),
        stale: this.staleSectors().map((sector) => sector.id),
        open: this.opacity > 0.5,
      }),
    };
    this.draw();
  },

  remove() {
    const scene = this.el.sceneEl;
    scene.removeEventListener('qps-collected', this.onQps);
    scene.removeEventListener('maze-world-updated', this.onWorld);
    scene.removeEventListener('qps-reading-granted', this.onGranted);
    this.el.parentEl?.removeEventListener('hand-pinchstart', this.onPinch);
    window.removeEventListener('keydown', this.onKey);
    this.el.removeObject3D('mesh');
    this.panel.geometry.dispose();
    this.material.dispose();
    this.texture.dispose();
  },

  // Nova leitura custa energia: quem decide é o estado do jogo (phase-zero).
  requestReading() {
    if (!this.hasQps) {
      this.el.sceneEl.emit('interaction-hint', { text: 'SEM QPS — encontre o QPS do andar para ter um mapa' });
      return;
    }
    this.el.sceneEl.emit('qps-reading-request');
  },

  takeReading() {
    const world = window.quantumWorld;
    if (!world) return;
    this.snapshot = {
      maze: world.maze.map((row) => [...row]),
      superposed: new Set(world.superposed.keys()),
      versions: window.quantumDecoherence?.versions() || {},
      time: Date.now(),
    };
    this.draw();
  },

  staleSectors() {
    if (!this.snapshot || !window.quantumDecoherence) return [];
    const now = window.quantumDecoherence.versions();
    return window.quantumDecoherence.sectors()
      .filter((sector) => (now[sector.id] ?? 0) !== (this.snapshot.versions[sector.id] ?? 0));
  },

  draw() {
    const ctx = this.canvas.getContext('2d');
    const { width, height } = this.canvas;
    const pad = 26;
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = 'rgba(4, 12, 7, 0.93)';
    ctx.fillRect(4, 4, width - 8, height - 8);
    ctx.strokeStyle = MAP_DIM;
    ctx.lineWidth = 2;
    ctx.strokeRect(4, 4, width - 8, height - 8);

    ctx.textBaseline = 'top';
    ctx.fillStyle = MAP_GREEN;
    ctx.font = `bold 28px ${MAP_MONO}`;
    ctx.fillText('QPS // MAPA', pad, pad);
    ctx.font = `20px ${MAP_MONO}`;
    ctx.fillStyle = MAP_DIM;

    const world = window.quantumWorld;
    const snapshot = this.snapshot;
    if (!snapshot || !world) {
      ctx.fillText('PLANTA DO ANDAR NA HORA DA MEDIÇÃO', pad, pad + 36);
      ctx.fillStyle = MAP_GREEN;
      ctx.font = `bold 24px ${MAP_MONO}`;
      ctx.fillText('SEM LEITURA', pad, height / 2 - 40);
      ctx.font = `18px ${MAP_MONO}`;
      ctx.fillStyle = MAP_DIM;
      ctx.fillText('Encontre o QPS do andar.', pad, height / 2);
      ctx.fillText('Pegar o QPS = medir = mapa.', pad, height / 2 + 28);
      this.texture.needsUpdate = true;
      return;
    }

    const stale = this.staleSectors();
    const ageSeconds = Math.round((Date.now() - snapshot.time) / 1000);
    ctx.fillStyle = stale.length ? '#ffb347' : MAP_GREEN;
    ctx.fillText(`LEITURA HÁ ${ageSeconds}s // ${stale.length ? `${stale.length} TRECHO(S) MUDARAM` : 'ATUALIZADO'}`, pad, pad + 36);

    const size = snapshot.maze.length;
    const top = pad + 70;
    const cell = Math.floor((width - pad * 2) / size);
    const left = Math.round((width - cell * size) / 2);
    snapshot.maze.forEach((row, z) => {
      row.forEach((value, x) => {
        const px = left + x * cell;
        const pz = top + z * cell;
        if (snapshot.superposed.has(`${x},${z}`)) {
          ctx.fillStyle = 'rgba(167, 139, 250, 0.7)';
        } else if (value === '#' || value === 'F') {
          ctx.fillStyle = 'rgba(57, 255, 136, 0.8)';
        } else {
          ctx.fillStyle = 'rgba(57, 255, 136, 0.07)';
        }
        ctx.fillRect(px, pz, cell - 1, cell - 1);
      });
    });

    // Setores que mudaram depois da leitura: estática piscando por cima.
    stale.forEach((sector) => {
      for (let z = sector.minZ; z <= sector.maxZ; z += 1) {
        for (let x = sector.minX; x <= sector.maxX; x += 1) {
          ctx.fillStyle = `rgba(57, 255, 136, ${(0.08 + Math.random() * 0.45).toFixed(2)})`;
          ctx.fillRect(left + x * cell, top + z * cell, cell - 1, cell - 1);
        }
      }
      ctx.fillStyle = 'rgba(4, 12, 7, 0.75)';
      const cx = left + ((sector.minX + sector.maxX + 1) / 2) * cell;
      const cz = top + ((sector.minZ + sector.maxZ + 1) / 2) * cell;
      ctx.fillRect(cx - 18, cz - 18, 36, 36);
      ctx.fillStyle = MAP_GREEN;
      ctx.font = `bold 30px ${MAP_MONO}`;
      ctx.textAlign = 'center';
      ctx.fillText('?', cx, cz - 15);
      ctx.textAlign = 'left';
    });

    // Porta (quando já revelada) e posição atual do jogador.
    const mapInfo = document.querySelector('#quantum-map')?.components['quantum-map'];
    const stairs = mapInfo?.mapInfo?.stairs;
    if (stairs && (mapInfo.data.stairsVisible || mapInfo.mapInfo.lobby)) {
      ctx.fillStyle = '#e3cc4b';
      ctx.fillRect(left + stairs.x * cell - 2, top + stairs.z * cell - 2, cell + 3, cell + 3);
    }
    const tracker = this.el.parentEl?.components['xr-hands'];
    if (tracker) {
      const px = left + ((tracker.head.world.x - world.origin) / world.cellSize + 0.5) * cell;
      const pz = top + ((tracker.head.world.z - world.origin) / world.cellSize + 0.5) * cell;
      const angle = Math.atan2(tracker.head.forward.z, tracker.head.forward.x);
      ctx.save();
      ctx.translate(px, pz);
      ctx.rotate(angle);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(cell * 0.9, 0);
      ctx.lineTo(-cell * 0.5, cell * 0.55);
      ctx.lineTo(-cell * 0.5, -cell * 0.55);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    const legendY = top + cell * size + 14;
    ctx.font = `18px ${MAP_MONO}`;
    ctx.fillStyle = MAP_DIM;
    ctx.fillText('■ PAREDE   ■ SUPERPOSIÇÃO   ■ PORTA   ? MUDOU', pad, legendY);
    ctx.fillText(tracker?.inVr ? 'PINÇA AQUI COM A OUTRA MÃO: NOVA LEITURA' : '[R] NOVA LEITURA   [M] FECHA', pad, legendY + 24);
    this.texture.needsUpdate = true;
  },

  tick(time, delta) {
    const tracker = this.el.parentEl?.components['xr-hands'];
    if (!tracker) return;
    const head = tracker.head;
    const hand = tracker.hands[this.data.hand];
    let show = false;

    if (tracker.inVr) {
      if (hand?.tracked) {
        this.el.object3D.position.copy(hand.position).add({ x: 0, y: 0.09, z: 0 });
        this.el.object3D.getWorldPosition(this.target);
        this.toPanel.subVectors(this.target, head.world);
        show = this.toPanel.length() < MAP_LOOK_DISTANCE && this.toPanel.angleTo(head.forward) < MAP_LOOK_ANGLE;
        this.el.object3D.lookAt(head.world);
      }
    } else if (this.desktopOpen) {
      // Desktop: canto inferior direito do campo de visão (o Q-LINK fica à esquerda).
      this.forward.copy(head.forward).setY(0).normalize();
      const right = new THREE.Vector3(-this.forward.z, 0, this.forward.x);
      this.target.copy(head.world)
        .addScaledVector(head.forward, 0.42)
        .addScaledVector(right, 0.15)
        .add({ x: 0, y: 0.01, z: 0 });
      this.el.object3D.position.copy(this.el.object3D.parent.worldToLocal(this.target.clone()));
      this.el.object3D.lookAt(head.world);
      show = true;
    }

    const step = Math.min(1, (delta / 1000) * 6);
    this.opacity += ((show ? 1 : 0) - this.opacity) * step;
    if (this.opacity > 0.05 && time - this.lastDraw > MAP_REDRAW_MS) {
      this.lastDraw = time;
      this.draw();
    }
    this.material.opacity = this.opacity;
    this.el.object3D.visible = this.opacity > 0.02;
  },
});
