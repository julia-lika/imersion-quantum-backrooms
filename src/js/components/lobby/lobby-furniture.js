// Fase 0 (lobby de treinamento): móveis do furniture pack clonados do GLB.

// Peças do furniture_pack.glb (Sketchfab, CC BY 4.0). Cada objeto é um conjunto
// de nós "Object_N" do GLB; as unidades do arquivo são ~4,7x o tamanho real.
const FURNITURE_GROUPS = {
  sofa: [12],
  metalTable: [7],
  terminal: [0, 1, 2, 3, 6, 10, 11, 15, 16, 17, 18],
  desk: [9],
  blueChair: [13, 14],
  officeChair: [5, 8],
  armchair: [4],
};
const FURNITURE_SCALE = 0.214;

AFRAME.registerComponent('lobby-furniture', {
  schema: {
    source: { type: 'selector', default: '#furniture-source' },
  },

  init() {
    this.onLoaded = () => this.build();
    const source = this.data.source;
    if (source?.getObject3D('mesh')) this.build();
    else source?.addEventListener('model-loaded', this.onLoaded, { once: true });
  },

  remove() {
    this.data.source?.removeEventListener('model-loaded', this.onLoaded);
  },

  buildGroup(root, indices) {
    const source = this.data.source.object3D;
    source.updateMatrixWorld(true);
    const inverse = source.matrixWorld.clone().invert();
    const inner = new THREE.Group();

    indices.forEach((index) => {
      const node = root.getObjectByName(`Object_${index + 2}`);
      if (!node) return;
      const clone = node.clone();
      clone.visible = true;
      inverse.clone().multiply(node.matrixWorld).decompose(clone.position, clone.quaternion, clone.scale);
      inner.add(clone);
    });

    inner.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(inner);
    const center = box.getCenter(new THREE.Vector3());
    inner.position.set(-center.x, -box.min.y, -center.z);
    const group = new THREE.Group();
    group.add(inner);
    group.scale.setScalar(FURNITURE_SCALE);
    return group;
  },

  build() {
    const root = this.data.source?.getObject3D('mesh');
    const layout = this.el.lobbyLayout || [];
    if (!root || this.built) return;
    this.built = true;

    layout.forEach(({ piece, x, z, y = 0, rotation = 0, scale }) => {
      const indices = FURNITURE_GROUPS[piece];
      if (!indices) return;
      const group = this.buildGroup(root, indices);
      // Escala extra por eixo (ex.: mesas menores das estações de equipamento).
      if (scale) group.scale.multiply(new THREE.Vector3(...scale));
      group.position.set(x, y, z);
      group.rotation.y = THREE.MathUtils.degToRad(rotation);
      this.el.object3D.add(group);
    });
  },
});
