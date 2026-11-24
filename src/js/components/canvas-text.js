// Texto desenhado em canvas com as fontes do sistema. Substitui o componente
// `text` do A-Frame, cuja fonte MSDF padrão não tem acentos ("estações" virava
// "estaes"). Mesmo esquema básico: value, align, color e width (em metros).
const CANVAS_TEXT_PX_PER_METER = 900;
const CANVAS_TEXT_FONT_PX = 30;
const CANVAS_TEXT_LINE_PX = 38;

AFRAME.registerComponent('canvas-text', {
  schema: {
    value: { type: 'string', default: '' },
    align: { type: 'string', default: 'center' },
    color: { type: 'color', default: '#ffffff' },
    width: { type: 'number', default: 1 },
    // true = sempre por cima (texto preso à câmera); false = respeita paredes.
    overlay: { type: 'boolean', default: true },
    // 'terminal' = fonte mono das estações explicativas, com fundo escuro.
    style: { type: 'string', default: 'sans' },
  },

  init() {
    this.canvas = document.createElement('canvas');
    this.texture = new THREE.CanvasTexture(this.canvas);
    if ('colorSpace' in this.texture) this.texture.colorSpace = THREE.SRGBColorSpace;
    this.material = new THREE.MeshBasicMaterial({
      map: this.texture,
      transparent: true,
      depthTest: this.data.overlay === false,
      depthWrite: false,
      fog: false,
    });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.material);
    this.mesh.renderOrder = this.data.overlay === false ? 0 : 999;
    this.el.setObject3D('canvas-text', this.mesh);
  },

  update() {
    const { value, align, color, width, style } = this.data;
    const terminal = style === 'terminal';
    const canvasWidth = Math.round(width * CANVAS_TEXT_PX_PER_METER);
    const ctx = this.canvas.getContext('2d');
    const font = terminal
      ? `bold ${CANVAS_TEXT_FONT_PX}px "Courier New", monospace`
      : `600 ${CANVAS_TEXT_FONT_PX}px system-ui, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`;
    ctx.font = font;

    const lines = this.wrap(ctx, value.replace(/\\n/g, '\n'), canvasWidth - 24);
    const canvasHeight = Math.max(1, lines.length) * CANVAS_TEXT_LINE_PX + 16;
    // O three.js aloca a textura com tamanho fixo: se o canvas muda de tamanho,
    // a textura antiga precisa ser descartada, senão sobra texto velho nela.
    if (this.canvas.width !== canvasWidth || this.canvas.height !== canvasHeight) this.texture.dispose();
    this.canvas.width = canvasWidth;
    this.canvas.height = canvasHeight;

    if (terminal && value) {
      // Mesmo visual dos painéis: fundo verde-escuro, borda e linhas de varredura.
      ctx.fillStyle = 'rgba(2, 18, 10, 0.82)';
      ctx.fillRect(0, 0, canvasWidth, this.canvas.height);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
      for (let y = 0; y < this.canvas.height; y += 4) ctx.fillRect(0, y, canvasWidth, 2);
      ctx.strokeStyle = 'rgba(57, 255, 136, 0.55)';
      ctx.lineWidth = 2;
      ctx.strokeRect(1, 1, canvasWidth - 2, this.canvas.height - 2);
    }

    ctx.font = font;
    ctx.textBaseline = 'middle';
    ctx.textAlign = align === 'left' ? 'left' : align === 'right' ? 'right' : 'center';
    const x = align === 'left' ? 12 : align === 'right' ? canvasWidth - 12 : canvasWidth / 2;
    ctx.shadowColor = terminal ? 'rgba(57, 255, 136, 0.45)' : 'rgba(0, 0, 0, 0.9)';
    ctx.shadowBlur = terminal ? 4 : 6;
    ctx.fillStyle = color;
    lines.forEach((line, index) => {
      ctx.fillText(line, x, 8 + CANVAS_TEXT_LINE_PX * (index + 0.5));
    });

    this.texture.needsUpdate = true;
    this.mesh.scale.set(width, (this.canvas.height / canvasWidth) * width, 1);
  },

  wrap(ctx, text, maxWidth) {
    const lines = [];
    text.split('\n').forEach((paragraph) => {
      let line = '';
      paragraph.split(' ').forEach((word) => {
        const next = line ? `${line} ${word}` : word;
        if (ctx.measureText(next).width > maxWidth && line) {
          lines.push(line);
          line = word;
        } else {
          line = next;
        }
      });
      lines.push(line);
    });
    return lines;
  },

  remove() {
    this.el.removeObject3D('canvas-text');
    this.texture.dispose();
    this.material.dispose();
    this.mesh.geometry.dispose();
  },
});

// Some com o texto depois de `delay` ms. Cada texto novo (canvas-text mudou)
// aparece de novo e reinicia a contagem. Usado nas dicas do canto inferior.
AFRAME.registerComponent('auto-hide', {
  schema: { delay: { type: 'number', default: 20000 } },

  init() {
    this.onChange = ({ detail }) => {
      if (detail.name === 'canvas-text') this.restart();
    };
    this.el.addEventListener('componentchanged', this.onChange);
    this.restart();
  },

  // persistent: texto fixo, não some. Ao sumir, avisa com `hint-expired`
  // (o lobby usa isso para voltar ao texto fixo dele).
  restart(persistent = false) {
    window.clearTimeout(this.timer);
    this.el.object3D.visible = true;
    if (persistent) return;
    this.timer = window.setTimeout(() => {
      this.el.object3D.visible = false;
      this.el.emit('hint-expired');
    }, this.data.delay);
  },

  remove() {
    window.clearTimeout(this.timer);
    this.el.removeEventListener('componentchanged', this.onChange);
    this.el.object3D.visible = true;
  },
});
