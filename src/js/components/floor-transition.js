AFRAME.registerComponent('floor-transition', {
  schema: {
    target: { type: 'selector' },
    radius: { type: 'number', default: 1.15 },
  },

  init() {
    this.triggered = false;
    this.triggerPosition = new THREE.Vector3();
    this.targetPosition = new THREE.Vector3();
  },

  tick() {
    const target = this.data.target;
    if (!target || this.triggered) return;

    this.el.object3D.getWorldPosition(this.triggerPosition);
    target.object3D.getWorldPosition(this.targetPosition);
    const distance = Math.hypot(
      this.triggerPosition.x - this.targetPosition.x,
      this.triggerPosition.z - this.targetPosition.z
    );

    if (distance <= this.data.radius) {
      this.triggered = true;
      this.el.sceneEl.emit('stairs-reached', {
        source: this.el,
        floor: this.el.sceneEl.getAttribute('data-floor'),
      });
    }
  },

  reset() {
    this.triggered = false;
  },
});
