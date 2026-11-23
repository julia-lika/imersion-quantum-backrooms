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
  },

  init() {
    this.canvas = document.createElement('canvas');
    this.texture = new THREE.CanvasTexture(this.canvas);
    if ('colorSpace' in this.texture) this.texture.colorSpace = THREE.SRGBColorSpace;
    this.material = new THREE.MeshBasicMaterial({
      map: this.texture,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      fog: false,
    });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.material);
    this.mesh.renderOrder = 999;
    this.el.setObject3D('canvas-text', this.mesh);
  },

  update() {
    const { value, align, color, width } = this.data;
    const canvasWidth = Math.round(width * CANVAS_TEXT_PX_PER_METER);
    const ctx = this.canvas.getContext('2d');
    const font = `600 ${CANVAS_TEXT_FONT_PX}px system-ui, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`;
    ctx.font = font;

    const lines = this.wrap(ctx, value.replace(/\\n/g, '\n'), canvasWidth - 24);
    this.canvas.width = canvasWidth;
    this.canvas.height = Math.max(1, lines.length) * CANVAS_TEXT_LINE_PX + 16;

    ctx.font = font;
    ctx.textBaseline = 'middle';
    ctx.textAlign = align === 'left' ? 'left' : align === 'right' ? 'right' : 'center';
    const x = align === 'left' ? 12 : align === 'right' ? canvasWidth - 12 : canvasWidth / 2;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
    ctx.shadowBlur = 6;
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
