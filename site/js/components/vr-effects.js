// Efeitos de tela para VR.
// Os efeitos de "loucura" do desktop são CSS (body::after, filter no canvas) e o
// headset só mostra o canvas 3D, então lá eles nunca aparecem. Este componente
// desenha o equivalente dentro da cena, preso à cabeça: vinhetas e um véu.
//
// Leitura contínua: window.quantumPlayer.effects = { contact, visor, madness }
//   contact 0..1 (proximidade da entidade), visor boolean, madness 0..1 (1 - sanidade)
// Eventos pontuais na cena: 'screen-effect' { type: 'flash' | 'fade' | 'blink', color, duration, peak }
// O Quest tem ~50° de meio-campo por olho. Com o plano a 0,35 m, 1,1 de lado cobre
// ~58°, então a borda opaca da vinheta cai dentro do que o jogador realmente vê.
const VIGNETTE_SIZE = 1.1;

function createVignetteTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext('2d');
  const gradient = context.createRadialGradient(128, 128, 16, 128, 128, 128);
  gradient.addColorStop(0, 'rgba(255,255,255,0)');
  gradient.addColorStop(1, 'rgba(255,255,255,1)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(canvas);
}

function createOverlay(geometry, color, texture, side = THREE.DoubleSide) {
  const material = new THREE.MeshBasicMaterial({
    color,
    map: texture || null,
    transparent: true,
    opacity: 0,
    depthTest: false,
    depthWrite: false,
    fog: false,
    side,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.renderOrder = 1000;
  mesh.frustumCulled = false;
  mesh.visible = false;
  return mesh;
}

AFRAME.registerComponent('vr-effects', {
  init() {
    this.texture = createVignetteTexture();
    this.plane = new THREE.PlaneGeometry(VIGNETTE_SIZE, VIGNETTE_SIZE);
    this.sphere = new THREE.SphereGeometry(0.4, 16, 12);

    this.vignettes = {
      contact: createOverlay(this.plane, 0x8a0016, this.texture),
      visor: createOverlay(this.plane, 0x9646ff, this.texture),
      madness: createOverlay(this.plane, 0x000000, this.texture),
    };
    this.vignettes.contact.position.z = -0.35;
    this.vignettes.visor.position.z = -0.36;
    this.vignettes.madness.position.z = -0.37;
    Object.values(this.vignettes).forEach((mesh) => this.el.object3D.add(mesh));

    // Tinta vermelha uniforme: a vinheta sozinha some nas bordas do campo de visão.
    this.contactTint = createOverlay(this.sphere, 0x8a0016, null, THREE.BackSide);
    this.el.object3D.add(this.contactTint);

    // Véu de tela cheia para clarões e fades (uma esfera ao redor da cabeça).
    this.veil = createOverlay(this.sphere, 0x000000, null, THREE.BackSide);
    this.el.object3D.add(this.veil);

    this.levels = { contact: 0, visor: 0, madness: 0 };
    this.timed = null;

    this.onEffect = ({ detail }) => {
      this.timed = { ...detail, start: this.el.sceneEl.time };
      this.veil.material.color.set(detail.color || '#000000');
    };
    this.el.sceneEl.addEventListener('screen-effect', this.onEffect);
  },

  remove() {
    this.el.sceneEl.removeEventListener('screen-effect', this.onEffect);
    [...Object.values(this.vignettes), this.contactTint, this.veil].forEach((mesh) => {
      this.el.object3D.remove(mesh);
      mesh.material.dispose();
    });
    this.texture.dispose();
    this.plane.dispose();
    this.sphere.dispose();
  },

  tick(time, delta) {
    const inVr = this.el.sceneEl.is('vr-mode');
    const fx = window.quantumPlayer?.effects || {};
    const target = inVr
      ? {
        contact: fx.contact ?? 0,
        visor: fx.visor ? 0.4 : 0,
        // Só incomoda de verdade quando a sanidade fica baixa.
        madness: Math.max(0, ((fx.madness ?? 0) - 0.3) / 0.7),
      }
      : { contact: 0, visor: 0, madness: 0 };

    const smoothing = Math.min(1, (delta / 1000) * 6);
    Object.keys(this.levels).forEach((key) => {
      this.levels[key] += (target[key] - this.levels[key]) * smoothing;
    });

    // Pulso lento (cerca de 1,3 Hz), sem piscar.
    const pulse = 0.85 + 0.15 * Math.sin(time * 0.008);
    this.setOpacity(this.vignettes.contact, Math.min(1, this.levels.contact * 1.3) * pulse);
    this.setOpacity(this.contactTint, this.levels.contact * 0.4 * pulse);
    this.setOpacity(this.vignettes.visor, this.levels.visor);
    this.setOpacity(this.vignettes.madness, this.levels.madness * 0.7);
    this.setOpacity(this.veil, inVr ? this.timedOpacity() : 0);
  },

  setOpacity(mesh, opacity) {
    mesh.material.opacity = opacity;
    mesh.visible = opacity > 0.01;
  },

  timedOpacity() {
    if (!this.timed) return 0;

    const elapsed = this.el.sceneEl.time - this.timed.start;
    const duration = this.timed.duration || 500;
    const t = elapsed / duration;
    if (t >= 1) {
      this.timed = null;
      return 0;
    }

    if (this.timed.type === 'blink') {
      // Mesma curva das pálpebras do desktop: fecha devagar, segura, reabre piscando.
      const smooth = (value) => value * value * (3 - 2 * value);
      if (t < 0.38) return smooth(t / 0.38);
      if (t < 0.54) return 1;
      if (t < 0.7) return 1 - 0.7 * smooth((t - 0.54) / 0.16);
      if (t < 0.78) return 0.3 + 0.35 * smooth((t - 0.7) / 0.08);
      return 0.65 * (1 - smooth((t - 0.78) / 0.22));
    }

    if (this.timed.type === 'fade') {
      // Mesma curva do fade em CSS: sobe até 28%, segura até 76%, desce.
      if (t < 0.28) return t / 0.28;
      if (t < 0.76) return 1;
      return (1 - t) / 0.24;
    }

    return (this.timed.peak ?? 0.6) * (1 - t);
  },
});
