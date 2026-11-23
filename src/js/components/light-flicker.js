AFRAME.registerComponent('light-flicker', {
  schema: {
    min: { type: 'number', default: 0.55 },
    max: { type: 'number', default: 1.1 },
    interval: { type: 'number', default: 140 },
  },

  init() {
    this.baseIntensity = this.el.getAttribute('light').intensity || this.data.max;
    this.lastTick = 0;
  },

  tick(time) {
    if (time - this.lastTick < this.data.interval) return;
    this.lastTick = time;

    const glitch = Math.random() < 0.08;
    const intensity = glitch
      ? this.data.min * 0.18
      : this.data.min + Math.random() * (this.data.max - this.data.min);

    this.el.setAttribute('light', 'intensity', intensity);
  },
});
