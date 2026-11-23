// Parede em superposição: alterna entre sólida e aberta. A olho nu parece uma
// parede comum; o Visor Zeta revela o estado e quando dá para atravessar.
// Se o jogador entra nela aberta, o estado colapsa em passagem (medição) e ela
// fica aberta, em ciano, até ele sair.
AFRAME.registerComponent('superposed-wall', {
  schema: {
    offset: { type: 'number', default: 0 },
    x: { type: 'int', default: -1 },
    z: { type: 'int', default: -1 },
  },

  tick() {
    const mesh = this.el.getObject3D('mesh');
    const physics = window.quantumPhysics;
    if (!mesh?.material || !physics) return;

    const collapsed = physics.isSuperposedCollapsed(window.quantumWorld, this.data.x, this.data.z);
    const open = collapsed || physics.isSuperposedOpen(this.data.offset, this.el.sceneEl.time / 1000);
    const visor = Boolean(window.quantumPlayer?.visor);
    const key = `${open}:${visor}:${collapsed}`;
    if (key === this.stateKey) return;

    this.stateKey = key;
    const material = mesh.material;
    // Colapsada (medida), ela fica translúcida mesmo sem o visor: o jogador está dentro.
    const seeThrough = visor || collapsed;
    material.transparent = seeThrough;
    material.opacity = seeThrough ? (open ? 0.12 : 0.7) : 1;
    material.depthWrite = !seeThrough;
    material.color.set(collapsed ? '#7fffe0' : (visor ? '#c9a3ff' : '#ffffff'));
    if (material.emissive) {
      material.emissive.set(collapsed ? '#0f6b5a' : (visor ? '#5a1a99' : '#000000'));
    }
    material.needsUpdate = true;
  },
});
