// Relógio de pulso: o HUD do desktop não aparece no headset, então a
// telemetria fica no pulso esquerdo e vira para o rosto do jogador.
AFRAME.registerComponent('wrist-hud', {
  schema: {
    hand: { type: 'string', default: 'left' },
  },

  init() {
    this.headWorld = new THREE.Vector3();
    this.el.setAttribute('visible', 'false');

    const panel = document.createElement('a-plane');
    panel.setAttribute('width', '0.2');
    panel.setAttribute('height', '0.12');
    panel.setAttribute('material', 'color: #080804; opacity: 0.82; transparent: true; shader: flat');
    this.el.appendChild(panel);

    this.text = document.createElement('a-text');
    this.text.setAttribute('value', '');
    this.text.setAttribute('color', '#ffe69b');
    this.text.setAttribute('width', '0.19');
    this.text.setAttribute('wrap-count', '26');
    this.text.setAttribute('anchor', 'left');
    this.text.setAttribute('position', '-0.092 0 0.002');
    this.el.appendChild(this.text);

    this.onSurvival = ({ detail }) => {
      this.text.setAttribute('value', [
        `FLOOR ${String(detail.floor).padStart(2, '0')}`,
        `SANITY ${Math.round(detail.sanity)}%`,
        `ENERGY ${Math.round(detail.energy)}%`,
        detail.visor ? 'ZETA VISOR ON' : 'ZETA VISOR OFF',
        detail.objective,
      ].join('\n'));
    };
    this.el.sceneEl.addEventListener('survival-updated', this.onSurvival);
  },

  remove() {
    this.el.sceneEl.removeEventListener('survival-updated', this.onSurvival);
  },

  tick() {
    const tracker = this.el.parentEl?.components['xr-hands'];
    const hand = tracker?.hands[this.data.hand];
    const visible = Boolean(tracker?.inVr && hand?.tracked);
    this.el.object3D.visible = visible;
    if (!visible) return;

    this.el.object3D.position.copy(hand.position).add({ x: 0, y: 0.09, z: 0 });
    this.el.object3D.lookAt(tracker.head.world);
  },
});
