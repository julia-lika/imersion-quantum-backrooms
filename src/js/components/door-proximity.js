// O clipe "open" da door yellow abre até ~100° em 1,2 s e fecha de novo até 2,4 s.
// A porta abre quando o jogador chega perto e toca a metade de fechar quando ele
// se afasta; voltando no meio do fechamento, ela reabre de onde estava.
const DOOR_OPEN_END = 1.2;
const DOOR_CLOSE_END = 2.4;

AFRAME.registerComponent('door-proximity-animation', {
  schema: {
    target: { type: 'selector' },
    radius: { type: 'number', default: 2.5 },
    closeMargin: { type: 'number', default: 0.8 },
  },

  init() {
    this.state = 'closed';
    this.time = 0;
    this.playerPosition = new THREE.Vector3();
    this.doorPosition = new THREE.Vector3();
    this.onModelLoaded = () => this.setupMixer();
    this.el.addEventListener('model-loaded', this.onModelLoaded);
    if (this.el.getObject3D('mesh')) this.setupMixer();
  },

  remove() {
    this.el.removeEventListener('model-loaded', this.onModelLoaded);
    this.mixer?.stopAllAction();
  },

  setupMixer() {
    const mesh = this.el.getObject3D('mesh');
    const clip = mesh?.animations?.find((item) => item.name === 'open') || mesh?.animations?.[0];
    if (!clip) return;
    this.mixer = new THREE.AnimationMixer(mesh);
    this.action = this.mixer.clipAction(clip);
    this.action.setLoop(THREE.LoopOnce, 1);
    this.action.clampWhenFinished = true;
    this.action.play();
    this.action.paused = true;
    this.applyTime(0);
  },

  applyTime(time) {
    this.time = time;
    this.action.time = time;
    this.mixer.update(0);
  },

  tick(time, delta) {
    const target = this.data.target;
    if (!target || !this.action) return;

    this.el.object3D.getWorldPosition(this.doorPosition);
    target.object3D.getWorldPosition(this.playerPosition);
    const distance = Math.hypot(
      this.doorPosition.x - this.playerPosition.x,
      this.doorPosition.z - this.playerPosition.z
    );

    if (distance <= this.data.radius && (this.state === 'closed' || this.state === 'closing')) {
      // Reabre a partir do ângulo atual (a metade de fechar é o espelho da de abrir).
      if (this.state === 'closing') this.applyTime(DOOR_CLOSE_END - this.time);
      this.state = 'opening';
    } else if (distance > this.data.radius + this.data.closeMargin && (this.state === 'open' || this.state === 'opening')) {
      if (this.state === 'opening') this.applyTime(DOOR_CLOSE_END - this.time);
      this.state = 'closing';
    }

    const dt = Math.min(0.1, delta / 1000);
    if (this.state === 'opening') {
      const next = Math.min(DOOR_OPEN_END, this.time + dt);
      this.applyTime(next);
      if (next >= DOOR_OPEN_END) this.state = 'open';
    } else if (this.state === 'closing') {
      const next = Math.min(DOOR_CLOSE_END, this.time + dt);
      this.applyTime(next);
      if (next >= DOOR_CLOSE_END) {
        this.state = 'closed';
        this.applyTime(0);
      }
    }
  },
});
