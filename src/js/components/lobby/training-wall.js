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
