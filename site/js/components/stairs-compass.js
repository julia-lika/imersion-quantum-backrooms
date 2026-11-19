// Seta flutuante que aponta para as escadas depois da medição do QPS.
// As escadas ficam em outra parte do labirinto, atrás de paredes e com teto
// por cima, então sem uma pista o jogador nunca as vê aparecer.
// Fica presa à cabeça, na parte de baixo do campo de visão (funciona em VR e desktop).
AFRAME.registerComponent('stairs-compass', {
  init() {
    const geometry = new THREE.ConeGeometry(0.035, 0.13, 12);
    geometry.rotateX(Math.PI / 2); // ponta no eixo +Z, que é o que lookAt aponta
    this.material = new THREE.MeshBasicMaterial({
      color: 0x44ffcc,
      transparent: true,
      opacity: 0.9,
      depthTest: false,
      depthWrite: false,
      fog: false,
    });
    this.arrow = new THREE.Mesh(geometry, this.material);
    this.arrow.position.set(0, -0.2, -0.6);
    this.arrow.renderOrder = 999;
    this.arrow.frustumCulled = false;
    this.arrow.visible = false;
    this.el.object3D.add(this.arrow);

    this.target = new THREE.Vector3();
    this.stairsEl = null;
    this.onWorld = () => { this.stairsEl = null; };
    this.el.sceneEl.addEventListener('maze-world-updated', this.onWorld);
  },

  remove() {
    this.el.sceneEl.removeEventListener('maze-world-updated', this.onWorld);
    this.el.object3D.remove(this.arrow);
    this.arrow.geometry.dispose();
    this.material.dispose();
  },

  tick(time) {
    if (!this.stairsEl?.isConnected) {
      this.stairsEl = document.getElementById('stairs');
    }

    const visible = Boolean(this.stairsEl) && window.quantumPlayer?.active !== false;
    this.arrow.visible = visible;
    if (!visible) return;

    this.stairsEl.object3D.getWorldPosition(this.target);
    this.target.y = this.el.object3D.getWorldPosition(new THREE.Vector3()).y - 0.2;
    this.arrow.lookAt(this.target);
    this.arrow.scale.setScalar(1 + 0.12 * Math.sin(time * 0.006));
  },
});
