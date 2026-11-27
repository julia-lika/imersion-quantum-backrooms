// Parede em superposição: um qubit simulado (ver js/wall-quantum.js).
// A olho nu parece uma parede comum. Com o Visor Zeta, você vê a chance de ela
// dar PASSAGEM se for medida agora: quanto mais transparente, mais provável.
// Encostar mede: deu passagem, ela fica ciano e aberta até você sair; deu
// parede, fica vermelha e sólida enquanto você encostar.
AFRAME.registerComponent('superposed-wall', {
  schema: {
    offset: { type: 'number', default: 0 },
    x: { type: 'int', default: -1 },
    z: { type: 'int', default: -1 },
  },

  tick() {
    const mesh = this.el.getObject3D('mesh');
    const physics = window.quantumPhysics;
    const world = window.quantumWorld;
    if (!mesh?.material || !physics || !world) return;

    const key = `${this.data.x},${this.data.z}`;
    const open = world.collapsed?.has(key);
    const closed = world.measuredClosed?.has(key);
    const visor = Boolean(window.quantumPlayer?.visor);
    // Probabilidade em passos de 5% para não refazer o material a cada quadro.
    const probability = visor ? Math.round(physics.superposedOpenProbability(world, this.data.x, this.data.z) * 20) / 20 : 0;
    const state = `${open}:${closed}:${visor}:${probability}`;
    if (state === this.stateKey) return;

    this.stateKey = state;
    const material = mesh.material;
    const seeThrough = visor || open;
    material.transparent = seeThrough;
    material.opacity = open ? 0.12 : (visor ? 0.85 - 0.75 * probability : 1);
    material.depthWrite = !seeThrough;
    let color = '#ffffff';
    let emissive = '#000000';
    if (open) { color = '#7fffe0'; emissive = '#0f6b5a'; }
    else if (closed && visor) { color = '#ff8a7a'; emissive = '#6b1a10'; }
    else if (visor) { color = '#c9a3ff'; emissive = '#5a1a99'; }
    material.color.set(color);
    if (material.emissive) material.emissive.set(emissive);
    material.needsUpdate = true;
  },
});
