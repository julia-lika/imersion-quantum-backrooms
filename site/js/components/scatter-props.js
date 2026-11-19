AFRAME.registerComponent('scatter-props', {
  schema: {
    maxObjects: { type: 'number', default: 48 },
    seed: { type: 'number', default: 17 },
  },

  init() {
    this.el.addEventListener('model-loaded', () => this.scatter());
  },

  random() {
    this.data.seed = (this.data.seed * 1664525 + 1013904223) % 4294967296;
    return this.data.seed / 4294967296;
  },

  shuffle(items) {
    const shuffled = [...items];
    for (let index = shuffled.length - 1; index > 0; index -= 1) {
      const target = Math.floor(this.random() * (index + 1));
      [shuffled[index], shuffled[target]] = [shuffled[target], shuffled[index]];
    }
    return shuffled;
  },

  scatter() {
    const root = this.el.getObject3D('mesh');
    if (!root) return;

    const objects = root.children.filter((child) => child.visible !== false);
    const floorSlots = [
      [-4.3, 0, -4.4], [-2.1, 0, -4.2], [2.1, 0, -4.3], [4.2, 0, -4.4],
      [-4.1, 0, -2.2], [-2.2, 0, -2.0], [2.2, 0, -2.1], [4.1, 0, -2.0],
      [-4.3, 0, 0.2], [-2.1, 0, 0.4], [2.1, 0, 0.3], [4.3, 0, 0.2],
      [-4.0, 0, 2.1], [-2.2, 0, 2.0], [2.2, 0, 2.0], [4.0, 0, 2.1],
    ];
    const wallSlots = [
      [-5.7, 1.8, -4.3, 90], [-5.7, 2.2, -1.8, 90], [-5.7, 1.7, 1.0, 90],
      [5.7, 2.0, -4.0, -90], [5.7, 1.8, -1.2, -90], [5.7, 2.1, 1.8, -90],
      [-3.8, 1.9, -5.7, 0], [-1.0, 2.2, -5.7, 0], [2.0, 1.8, -5.7, 0],
      [4.2, 2.0, -5.7, 0],
    ];

    const floorQueue = this.shuffle(floorSlots);
    const wallQueue = this.shuffle(wallSlots);
    let floorIndex = 0;
    let wallIndex = 0;

    this.shuffle(objects).forEach((object, index) => {
      if (index >= this.data.maxObjects) {
        object.visible = false;
        return;
      }

      const name = object.name || '';
      const isWallObject = /CCTV|Warning|Door|Security|Partition/i.test(name);
      const slot = isWallObject && wallIndex < wallQueue.length
        ? wallQueue[wallIndex++]
        : floorQueue[floorIndex++ % floorQueue.length];

      object.visible = true;
      object.position.set(slot[0], slot[1], slot[2]);
      object.rotation.y = THREE.MathUtils.degToRad(slot[3] || Math.round(this.random() * 360));
    });

    console.info(`[scatter-props] ${Math.min(objects.length, this.data.maxObjects)} objetos distribuídos`);
  },
});
