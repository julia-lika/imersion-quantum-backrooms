// Luzes pontuais que acompanham o jogador, sempre nas luminárias mais próximas.
// Assim o Level 0 parece todo iluminado por fluorescentes sem pagar dezenas de
// luzes dinâmicas no Quest.
AFRAME.registerComponent('fixture-lights', {
  schema: {
    target: { type: 'selector' },
    count: { type: 'number', default: 2 },
    color: { type: 'color', default: '#fff1c4' },
    intensity: { type: 'number', default: 0.9 },
    distance: { type: 'number', default: 7 },
    height: { type: 'number', default: 2.6 },
    interval: { type: 'number', default: 250 },
  },

  init() {
    this.lights = [];
    this.lastUpdate = -Infinity;
    this.targetPosition = new THREE.Vector3();

    for (let index = 0; index < this.data.count; index += 1) {
      const light = document.createElement('a-entity');
      light.setAttribute('light', {
        type: 'point',
        color: this.data.color,
        intensity: this.data.intensity,
        distance: this.data.distance,
        decay: 1,
      });
      // A segunda luz pisca de vez em quando, como um reator velho.
      if (index === 1) {
        light.setAttribute('light-flicker', `min: ${this.data.intensity * 0.6}; max: ${this.data.intensity}; interval: 220`);
      }
      light.setAttribute('position', `0 ${this.data.height} 0`);
      this.el.appendChild(light);
      this.lights.push(light);
    }
  },

  tick(time) {
    if (time - this.lastUpdate < this.data.interval || !this.data.target) return;
    this.lastUpdate = time;

    const fixtures = window.quantumLightFixtures;
    if (!fixtures?.length) return;

    this.data.target.object3D.getWorldPosition(this.targetPosition);
    const { x, z } = this.targetPosition;
    const nearest = fixtures
      .map((fixture) => ({ fixture, distance: (fixture.x - x) ** 2 + (fixture.z - z) ** 2 }))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, this.lights.length);

    nearest.forEach(({ fixture }, index) => {
      this.lights[index].object3D.position.set(fixture.x, this.data.height, fixture.z);
    });
  },
});
