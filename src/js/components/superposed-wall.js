// Parede em superposição: alterna entre sólida e aberta. A olho nu parece uma
// parede comum; o Zeta Visor revela o estado e quando dá para atravessar.
AFRAME.registerComponent('superposed-wall', {
  schema: {
    offset: { type: 'number', default: 0 },
  },

  tick() {
    const mesh = this.el.getObject3D('mesh');
    const physics = window.quantumPhysics;
    if (!mesh?.material || !physics) return;

    const open = physics.isSuperposedOpen(this.data.offset, this.el.sceneEl.time / 1000);
    const visor = Boolean(window.quantumPlayer?.visor);
    const key = `${open}:${visor}`;
    if (key === this.stateKey) return;

    this.stateKey = key;
    const material = mesh.material;
    material.transparent = visor;
    material.opacity = visor ? (open ? 0.12 : 0.7) : 1;
    material.depthWrite = !visor;
    material.color.set(visor ? '#c9a3ff' : '#ffffff');
    if (material.emissive) {
      material.emissive.set(visor ? '#5a1a99' : '#000000');
    }
    material.needsUpdate = true;
  },
});
