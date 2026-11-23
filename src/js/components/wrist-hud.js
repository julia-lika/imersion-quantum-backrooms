// Q-LINK de pulso. Só aparece quando o jogador olha para o pulso esquerdo (VR)
// ou aperta H (desktop, o painel sobe para o campo de visão). Visual de
// telemetria: fundo quase preto, texto verde fósforo, rótulos espaçados,
// leituras grandes e barras segmentadas, desenhado em canvas.
const PANEL_WIDTH = 0.22;
const PANEL_HEIGHT = 0.15;
const LOOK_ANGLE = THREE.MathUtils.degToRad(28);
const LOOK_DISTANCE = 0.7;
const GREEN = '#39ff88';
const GREEN_DIM = 'rgba(57, 255, 136, 0.45)';
const GREEN_FAINT = 'rgba(57, 255, 136, 0.14)';
const RED = '#ff5a6e';
const AMBER = '#ffb347';

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function spacedText(ctx, text, x, y, spacing) {
  let cursor = x;
  [...text].forEach((char) => {
    ctx.fillText(char, cursor, y);
    cursor += ctx.measureText(char).width + spacing;
  });
  return cursor;
}

AFRAME.registerComponent('wrist-hud', {
  schema: {
    hand: { type: 'string', default: 'left' },
    key: { type: 'string', default: 'KeyH' },
  },

  init() {
    this.state = { floor: 0, sanity: 100, energy: 100, visor: false, objective: '' };
    this.opacity = 0;
    this.desktopOpen = false;
    this.toHand = new THREE.Vector3();
    this.target = new THREE.Vector3();
    this.forward = new THREE.Vector3();

    this.canvas = document.createElement('canvas');
    this.canvas.width = 704;
    this.canvas.height = 480;
    this.texture = new THREE.CanvasTexture(this.canvas);
    if ('colorSpace' in this.texture) this.texture.colorSpace = THREE.SRGBColorSpace;
    this.material = new THREE.MeshBasicMaterial({
      map: this.texture,
      transparent: true,
      opacity: 0,
      toneMapped: false,
      fog: false,
      depthWrite: false,
    });
    this.panel = new THREE.Mesh(new THREE.PlaneGeometry(PANEL_WIDTH, PANEL_HEIGHT), this.material);
    this.panel.renderOrder = 900;
    this.el.setObject3D('mesh', this.panel);
    this.el.object3D.visible = false;
    this.draw();

    this.onSurvival = ({ detail }) => {
      this.state = { ...this.state, ...detail };
      if (this.opacity > 0.01) this.draw();
    };
    this.onKey = (event) => {
      if (event.code !== this.data.key || event.repeat) return;
      this.desktopOpen = !this.desktopOpen;
      if (this.desktopOpen) this.draw();
    };
    this.el.sceneEl.addEventListener('survival-updated', this.onSurvival);
    window.addEventListener('keydown', this.onKey);
  },

  remove() {
    this.el.sceneEl.removeEventListener('survival-updated', this.onSurvival);
    window.removeEventListener('keydown', this.onKey);
    this.el.removeObject3D('mesh');
    this.panel.geometry.dispose();
    this.material.dispose();
    this.texture.dispose();
  },

  draw() {
    const ctx = this.canvas.getContext('2d');
    const { width, height } = this.canvas;
    const { floor, sanity, energy, visor, objective } = this.state;
    const ghost = window.quantumPlayer?.ghost || {};
    const pad = 30;
    const mono = '"Courier New", ui-monospace, monospace';

    ctx.clearRect(0, 0, width, height);

    // Corpo do aparelho.
    roundRect(ctx, 4, 4, width - 8, height - 8, 22);
    ctx.fillStyle = 'rgba(4, 12, 7, 0.92)';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = GREEN_DIM;
    ctx.stroke();
    roundRect(ctx, 14, 14, width - 28, height - 28, 14);
    ctx.lineWidth = 1;
    ctx.strokeStyle = GREEN_FAINT;
    ctx.stroke();

    // Linhas de varredura.
    ctx.save();
    roundRect(ctx, 14, 14, width - 28, height - 28, 14);
    ctx.clip();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
    for (let y = 14; y < height; y += 4) ctx.fillRect(0, y, width, 1.5);
    ctx.restore();

    ctx.textBaseline = 'top';
    ctx.shadowColor = GREEN;

    // Cabeçalho: marca + andar em etiqueta.
    ctx.fillStyle = GREEN;
    ctx.shadowBlur = 8;
    ctx.font = `bold 26px ${mono}`;
    spacedText(ctx, 'Q-LINK', pad + 6, pad + 2, 6);
    ctx.shadowBlur = 0;
    ctx.fillStyle = GREEN_DIM;
    ctx.font = `15px ${mono}`;
    spacedText(ctx, 'TELEMETRIA DO AGENTE', pad + 6, pad + 34, 4);

    const floorLabel = Number(floor) === 0 ? 'LOBBY' : `ANDAR ${String(floor).padStart(2, '0')}`;
    ctx.font = `bold 20px ${mono}`;
    const tagWidth = ctx.measureText(floorLabel).width + 34;
    roundRect(ctx, width - pad - tagWidth, pad + 4, tagWidth, 36, 6);
    ctx.strokeStyle = GREEN;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = GREEN;
    ctx.fillText(floorLabel, width - pad - tagWidth + 17, pad + 13);

    ctx.fillStyle = GREEN_FAINT;
    ctx.fillRect(pad, pad + 62, width - pad * 2, 2);

    // Duas leituras grandes com barras segmentadas.
    const gauge = (label, value, x, w) => {
      const level = Math.max(0, Math.min(100, value));
      const color = level < 25 ? RED : (level < 50 ? AMBER : GREEN);
      ctx.fillStyle = GREEN_DIM;
      ctx.font = `15px ${mono}`;
      spacedText(ctx, label, x, pad + 80, 4);
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 12;
      ctx.font = `bold 58px ${mono}`;
      const number = String(Math.round(level));
      ctx.fillText(number, x, pad + 102);
      const numberWidth = ctx.measureText(number).width;
      ctx.shadowBlur = 0;
      ctx.font = `bold 24px ${mono}`;
      ctx.fillText('%', x + numberWidth + 4, pad + 130);
      const segments = 14;
      const gap = 4;
      const segmentWidth = (w - gap * (segments - 1)) / segments;
      for (let index = 0; index < segments; index += 1) {
        ctx.fillStyle = index < Math.round((level / 100) * segments) ? color : GREEN_FAINT;
        ctx.fillRect(x + index * (segmentWidth + gap), pad + 172, segmentWidth, 16);
      }
    };
    const column = (width - pad * 2 - 30) / 2;
    gauge('SANIDADE', sanity, pad, column);
    gauge('ENERGIA', energy, pad + column + 30, column);

    ctx.fillStyle = GREEN_FAINT;
    ctx.fillRect(pad, pad + 208, width - pad * 2, 2);

    // Estado do visor e da entidade.
    const chip = (label, value, active, x, y, color = GREEN) => {
      ctx.font = `15px ${mono}`;
      ctx.fillStyle = GREEN_DIM;
      spacedText(ctx, label, x, y, 3);
      ctx.font = `bold 20px ${mono}`;
      ctx.fillStyle = active ? color : GREEN_DIM;
      ctx.shadowColor = color;
      ctx.shadowBlur = active ? 8 : 0;
      ctx.fillText(value, x, y + 22);
      ctx.shadowBlur = 0;
    };
    chip('VISOR ZETA', visor ? '● ATIVO' : '○ DESLIG.', visor, pad, pad + 224, '#c9a3ff');
    const distance = Number.isFinite(ghost.distance) ? `${(ghost.distance * 1.05).toFixed(1)} M` : '--';
    const entity = Number(floor) === 0
      ? 'AUSENTE'
      : (ghost.hunting ? `CAÇANDO ${distance}` : `LONGE ${distance}`);
    chip('ENTIDADE', entity, Boolean(ghost.hunting), pad + column + 30, pad + 224, RED);

    // Objetivo com marcador de alerta.
    const objectiveY = pad + 286;
    roundRect(ctx, pad, objectiveY, width - pad * 2, 64, 8);
    ctx.fillStyle = 'rgba(57, 255, 136, 0.07)';
    ctx.fill();
    ctx.strokeStyle = GREEN_FAINT;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = GREEN;
    ctx.font = `bold 30px ${mono}`;
    ctx.fillText('!', pad + 16, objectiveY + 16);
    ctx.font = `14px ${mono}`;
    ctx.fillStyle = GREEN_DIM;
    spacedText(ctx, 'OBJETIVO', pad + 48, objectiveY + 10, 3);
    ctx.font = `bold 19px ${mono}`;
    ctx.fillStyle = GREEN;
    ctx.fillText(String(objective || 'AGUARDANDO SINAL').toUpperCase().slice(0, 44), pad + 48, objectiveY + 32);

    // Rodapé.
    ctx.font = `13px ${mono}`;
    ctx.fillStyle = GREEN_DIM;
    const stamp = new Date().toTimeString().slice(0, 8);
    spacedText(ctx, `LINK ATIVO // ${stamp}`, pad, height - pad - 14, 2);
    const hint = '[H] FECHA NO DESKTOP';
    const hintWidth = ctx.measureText(hint).width + hint.length * 2;
    spacedText(ctx, hint, width - pad - hintWidth, height - pad - 14, 2);

    this.texture.needsUpdate = true;
  },

  tick(time, delta) {
    const tracker = this.el.parentEl?.components['xr-hands'];
    if (!tracker) return;
    const head = tracker.head;
    const hand = tracker.hands[this.data.hand];
    let show = false;

    if (tracker.inVr) {
      if (hand?.tracked) {
        // Visível só quando o pulso está no centro do olhar e perto do rosto.
        this.el.object3D.position.copy(hand.position).add({ x: 0, y: 0.08, z: 0 });
        this.el.object3D.getWorldPosition(this.target);
        this.toHand.subVectors(this.target, head.world);
        show = this.toHand.length() < LOOK_DISTANCE && this.toHand.angleTo(head.forward) < LOOK_ANGLE;
        this.el.object3D.lookAt(head.world);
      }
    } else if (this.desktopOpen) {
      // Desktop: o painel aparece no canto inferior esquerdo do campo de visão.
      this.forward.copy(head.forward).setY(0).normalize();
      const right = new THREE.Vector3(-this.forward.z, 0, this.forward.x);
      this.target.copy(head.world)
        .addScaledVector(head.forward, 0.42)
        .addScaledVector(right, -0.11)
        .add({ x: 0, y: -0.09, z: 0 });
      this.el.object3D.position.copy(this.el.object3D.parent.worldToLocal(this.target.clone()));
      this.el.object3D.lookAt(head.world);
      show = true;
    }

    // Aparece e some com um fade curto.
    const step = Math.min(1, (delta / 1000) * 6);
    const previous = this.opacity;
    this.opacity += ((show ? 1 : 0) - this.opacity) * step;
    if (show && previous < 0.05) this.draw();
    this.material.opacity = this.opacity;
    this.el.object3D.visible = this.opacity > 0.02;
  },
});
