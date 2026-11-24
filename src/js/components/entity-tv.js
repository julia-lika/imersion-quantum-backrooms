// TV do lobby: uma "câmera de segurança" mostrando a entidade andando por um
// corredor do Level 0. A imagem vem de uma mini cena renderizada numa textura
// pequena (256x192, ~15 fps) e só quando o jogador está por perto.
const TV_RENDER_SIZE = { width: 256, height: 192 };
const TV_FRAME_MS = 66;
const TV_ACTIVE_DISTANCE = 9;
const TV_WALK_SPEED = 0.9;
const TV_CORRIDOR = { near: -1.2, far: -11 };

function tvTextureFrom(selector, repeatX, repeatY) {
  const image = document.querySelector(selector);
  if (!image) return null;
  const texture = new THREE.Texture(image);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeatX, repeatY);
  if ('colorSpace' in texture) texture.colorSpace = THREE.SRGBColorSpace;
  const update = () => { texture.needsUpdate = true; };
  if (image.complete) update(); else image.addEventListener('load', update, { once: true });
  return texture;
}

AFRAME.registerComponent('entity-tv', {
  schema: {
    player: { type: 'selector', default: '#player-head' },
    model: { type: 'string', default: 'assets/models/bacteria-backrooms.glb' },
  },

  init() {
    this.world = new THREE.Vector3();
    this.headWorld = new THREE.Vector3();
    this.lastFrame = 0;
    this.walkZ = TV_CORRIDOR.far;

    this.target = new THREE.WebGLRenderTarget(TV_RENDER_SIZE.width, TV_RENDER_SIZE.height);
    this.buildMiniScene();
    this.buildTv();
    this.loadEntity();
  },

  remove() {
    this.target.dispose();
    this.disposables.forEach((item) => item.dispose());
    this.overlayTexture?.dispose();
  },

  buildMiniScene() {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#050402');
    scene.fog = new THREE.FogExp2('#050402', 0.16);
    this.miniScene = scene;
    this.disposables = [];

    const width = 2.2;
    const height = 2.8;
    const length = 14;
    const wall = new THREE.MeshLambertMaterial({ map: tvTextureFrom('#wall-texture', 6, 1.4), color: '#b8a865' });
    const floor = new THREE.MeshLambertMaterial({ map: tvTextureFrom('#floor-texture', 2, 12), color: '#8a7a45' });
    const ceiling = new THREE.MeshLambertMaterial({ map: tvTextureFrom('#ceiling-texture', 2, 12), color: '#9a9070' });
    const plane = new THREE.PlaneGeometry(1, 1);
    this.disposables.push(wall, floor, ceiling, plane);

    const add = (material, sx, sy, position, rotation) => {
      const mesh = new THREE.Mesh(plane, material);
      mesh.scale.set(sx, sy, 1);
      mesh.position.set(...position);
      mesh.rotation.set(...rotation);
      scene.add(mesh);
    };
    const mid = -length / 2;
    add(floor, width, length, [0, 0, mid], [-Math.PI / 2, 0, 0]);
    add(ceiling, width, length, [0, height, mid], [Math.PI / 2, 0, 0]);
    add(wall, length, height, [-width / 2, height / 2, mid], [0, Math.PI / 2, 0]);
    add(wall, length, height, [width / 2, height / 2, mid], [0, -Math.PI / 2, 0]);
    add(wall, width, height, [0, height / 2, -length], [0, 0, 0]);

    // Painéis de luz no teto, um deles piscando.
    const panelMaterial = new THREE.MeshBasicMaterial({ color: '#fff3c4' });
    this.disposables.push(panelMaterial);
    this.flicker = [];
    for (let z = -2; z > -length; z -= 3) {
      const panel = new THREE.Mesh(plane, panelMaterial);
      panel.scale.set(0.6, 1.1, 1);
      panel.position.set(0, height - 0.01, z);
      panel.rotation.x = Math.PI / 2;
      scene.add(panel);
      const light = new THREE.PointLight('#ffe6a8', 1.4, 5, 1.6);
      light.position.set(0, height - 0.3, z);
      scene.add(light);
      this.flicker.push(light);
    }
    scene.add(new THREE.AmbientLight('#4a4025', 0.6));

    // Câmera de segurança alta, num canto, olhando o corredor.
    this.camera = new THREE.PerspectiveCamera(62, TV_RENDER_SIZE.width / TV_RENDER_SIZE.height, 0.1, 30);
    this.camera.position.set(0.7, 2.45, 0.2);
    this.camera.lookAt(-0.1, 1.0, -6);
  },

  loadEntity() {
    const loader = new THREE.GLTFLoader();
    loader.load(this.data.model, (gltf) => {
      const root = gltf.scene;
      root.traverse((object) => {
        if (!object.isMesh) return;
        object.geometry.computeBoundingBox();
        const size = object.geometry.boundingBox.getSize(new THREE.Vector3());
        // Mesmo Torus fora de escala que a entidade principal esconde.
        if (Math.max(size.x, size.y, size.z) > 30) object.visible = false;
        object.frustumCulled = false;
      });
      root.scale.setScalar(0.18);
      root.position.y = 2;
      this.entity = new THREE.Group();
      // Corpo com o andar assustador (gira, manca, treme e congela).
      this.body = new THREE.Group();
      this.body.add(root);
      this.entity.add(this.body);
      this.gait = window.creepyGait?.create(performance.now());
      // Luz fraca junto da entidade para ela se destacar na imagem escura.
      const rim = new THREE.PointLight('#d8c8ff', 1.2, 3, 1.5);
      rim.position.set(0.4, 1.6, 0.8);
      this.entity.add(rim);
      this.entity.position.set(0, 0, this.walkZ);
      this.miniScene.add(this.entity);
    });
  },

  buildTv() {
    // Gabinete de TV de tubo preso à parede, com a imagem da câmera na tela.
    const cabinet = document.createElement('a-box');
    cabinet.setAttribute('width', 0.98);
    cabinet.setAttribute('height', 0.74);
    cabinet.setAttribute('depth', 0.34);
    cabinet.setAttribute('position', '0 0 -0.17');
    cabinet.setAttribute('material', 'color: #1a1a17; roughness: 0.6');
    this.el.appendChild(cabinet);

    const screen = document.createElement('a-plane');
    screen.setAttribute('width', 0.84);
    screen.setAttribute('height', 0.63);
    screen.setAttribute('position', '-0.02 0 0.002');
    screen.setAttribute('material', 'shader: flat; color: #ffffff');
    screen.addEventListener('loaded', () => {
      const material = screen.getObject3D('mesh').material;
      material.map = this.target.texture;
      material.needsUpdate = true;
    });
    this.el.appendChild(screen);

    // Camada de ruído, linhas e legenda "CAM 03" por cima da imagem.
    this.overlayCanvas = document.createElement('canvas');
    this.overlayCanvas.width = 256;
    this.overlayCanvas.height = 192;
    this.overlayTexture = new THREE.CanvasTexture(this.overlayCanvas);
    const overlay = document.createElement('a-plane');
    overlay.setAttribute('width', 0.84);
    overlay.setAttribute('height', 0.63);
    overlay.setAttribute('position', '-0.02 0 0.004');
    overlay.setAttribute('material', 'shader: flat; transparent: true; color: #ffffff');
    overlay.addEventListener('loaded', () => {
      const material = overlay.getObject3D('mesh').material;
      material.map = this.overlayTexture;
      material.needsUpdate = true;
    });
    this.el.appendChild(overlay);

    // Botões e LED ao lado da tela.
    const led = document.createElement('a-circle');
    led.setAttribute('radius', 0.008);
    led.setAttribute('position', '0.45 -0.29 0.002');
    led.setAttribute('material', 'shader: flat; color: #ff3030');
    led.setAttribute('animation', 'property: material.opacity; from: 0.2; to: 1; dir: alternate; loop: true; dur: 700');
    this.el.appendChild(led);

    const glow = document.createElement('a-entity');
    glow.setAttribute('light', 'type: point; color: #9fb8a0; intensity: 0.3; distance: 1.6');
    glow.setAttribute('position', '0 0 0.25');
    this.el.appendChild(glow);
  },

  drawOverlay(time) {
    const ctx = this.overlayCanvas.getContext('2d');
    const { width, height } = this.overlayCanvas;
    ctx.clearRect(0, 0, width, height);
    for (let y = 0; y < height; y += 3) {
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      ctx.fillRect(0, y, width, 1);
    }
    for (let i = 0; i < 220; i += 1) {
      const shade = Math.random() * 255;
      ctx.fillStyle = `rgba(${shade},${shade},${shade},0.16)`;
      ctx.fillRect(Math.random() * width, Math.random() * height, 2, 1);
    }
    if (Math.random() < 0.05) {
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.fillRect(0, Math.random() * height, width, 6 + Math.random() * 10);
    }
    const vignette = ctx.createRadialGradient(width / 2, height / 2, height * 0.35, width / 2, height / 2, width * 0.62);
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(1, 'rgba(0,0,0,0.7)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, width, height);

    ctx.font = 'bold 12px "Courier New", monospace';
    ctx.fillStyle = 'rgba(230,255,230,0.85)';
    ctx.fillText('CAM 03 // NÍVEL 0', 10, 18);
    const seconds = Math.floor(time / 1000);
    const clock = [Math.floor(seconds / 3600) + 3, Math.floor(seconds / 60) % 60, seconds % 60]
      .map((value) => String(value).padStart(2, '0')).join(':');
    ctx.fillText(clock, width - 72, height - 10);
    if (Math.floor(time / 600) % 2 === 0) {
      ctx.fillStyle = '#ff3a3a';
      ctx.beginPath();
      ctx.arc(width - 46, 14, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillText('REC', width - 38, 18);
    }
    this.overlayTexture.needsUpdate = true;
  },

  tick(time, delta) {
    if (time - this.lastFrame < TV_FRAME_MS) return;
    const elapsed = Math.min(0.2, (time - this.lastFrame) / 1000);
    this.lastFrame = time;

    this.el.object3D.getWorldPosition(this.world);
    this.data.player?.object3D.getWorldPosition(this.headWorld);
    if (this.world.distanceTo(this.headWorld) > TV_ACTIVE_DISTANCE) return;

    // A entidade vem do fundo do corredor até perto da câmera e recomeça.
    if (this.entity) {
      // Anda em zigue-zague: o corpo vira para a direção do passo.
      const sway = Math.sin(time * 0.0021);
      const pose = this.gait
        ? window.creepyGait.update(this.gait, time, elapsed * 1000, { moving: true, targetYaw: Math.cos(time * 0.0021) * 0.45 })
        : null;
      if (!pose?.frozen) this.walkZ += TV_WALK_SPEED * elapsed * (pose?.catchUp ?? 1);
      if (this.walkZ > TV_CORRIDOR.near) this.walkZ = TV_CORRIDOR.far;
      this.entity.position.set(sway * 0.25, 0, this.walkZ);
      if (pose) window.creepyGait.apply(this.body, pose);
    }
    this.flicker.forEach((light, index) => {
      light.intensity = index === 1 && Math.random() < 0.3 ? 0.15 : 1.4;
    });

    this.drawOverlay(time);
    this.renderFeed();
  },

  renderFeed() {
    const renderer = this.el.sceneEl.renderer;
    const previousTarget = renderer.getRenderTarget();
    const xrEnabled = renderer.xr.enabled;
    // Em VR a renderização fora da sessão precisa do XR desligado por um instante.
    renderer.xr.enabled = false;
    renderer.setRenderTarget(this.target);
    renderer.render(this.miniScene, this.camera);
    renderer.setRenderTarget(previousTarget);
    renderer.xr.enabled = xrEnabled;
  },
});
