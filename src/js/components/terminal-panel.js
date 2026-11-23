// Painéis de terminal desenhados em canvas: texto verde em fundo escuro, com
// moldura, linhas de varredura e cabeçalho. Não dependem da fonte MSDF da CDN
// do A-Frame e servem para as placas do lobby, o caderno e o painel do pulso.
(function registerTerminalPanel() {
  const GREEN = '#39ff88';
  const DIM = '#1d8a4f';

  function wrapText(ctx, text, maxWidth) {
    const lines = [];
    String(text).split('\n').forEach((paragraph) => {
      if (paragraph.trim() === '') {
        lines.push('');
        return;
      }
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
  }

  // Desenha o painel inteiro. `bars` = [{ label, value (0-100) }] opcional.
  function drawTerminal(canvas, {
    title = 'Q-LINK',
    subtitle = '',
    body = '',
    bars = [],
    accent = GREEN,
    fontSize = 30,
    footer = '',
    blink = true,
  } = {}) {
    const ctx = canvas.getContext('2d');
    const { width, height } = canvas;
    const pad = Math.round(width * 0.045);

    ctx.clearRect(0, 0, width, height);
    const background = ctx.createLinearGradient(0, 0, 0, height);
    background.addColorStop(0, 'rgba(2, 18, 10, 0.94)');
    background.addColorStop(1, 'rgba(1, 8, 5, 0.96)');
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, width, height);

    // Grade sutil e linhas de varredura.
    ctx.strokeStyle = 'rgba(57, 255, 136, 0.05)';
    ctx.lineWidth = 1;
    for (let x = 0; x < width; x += 32) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
    }
    ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
    for (let y = 0; y < height; y += 4) ctx.fillRect(0, y, width, 2);

    // Moldura com cantos destacados.
    ctx.strokeStyle = DIM;
    ctx.lineWidth = 3;
    ctx.strokeRect(6, 6, width - 12, height - 12);
    ctx.strokeStyle = accent;
    ctx.lineWidth = 5;
    const corner = Math.round(width * 0.06);
    [[6, 6, 1, 1], [width - 6, 6, -1, 1], [6, height - 6, 1, -1], [width - 6, height - 6, -1, -1]]
      .forEach(([x, y, sx, sy]) => {
        ctx.beginPath();
        ctx.moveTo(x + corner * sx, y);
        ctx.lineTo(x, y);
        ctx.lineTo(x, y + corner * sy);
        ctx.stroke();
      });

    ctx.shadowColor = accent;
    ctx.shadowBlur = 10;
    ctx.fillStyle = accent;
    ctx.textBaseline = 'top';
    ctx.font = `bold ${Math.round(fontSize * 1.15)}px "Courier New", monospace`;
    ctx.fillText(title, pad, pad);
    if (subtitle) {
      ctx.font = `${Math.round(fontSize * 0.7)}px "Courier New", monospace`;
      ctx.fillStyle = DIM;
      ctx.shadowBlur = 0;
      const width2 = ctx.measureText(subtitle).width;
      ctx.fillText(subtitle, width - pad - width2, pad + fontSize * 0.25);
    }

    let y = pad + fontSize * 1.6;
    ctx.strokeStyle = DIM;
    ctx.lineWidth = 2;
    ctx.shadowBlur = 0;
    ctx.beginPath(); ctx.moveTo(pad, y); ctx.lineTo(width - pad, y); ctx.stroke();
    y += fontSize * 0.6;

    ctx.font = `${fontSize}px "Courier New", monospace`;
    ctx.fillStyle = accent;
    ctx.shadowColor = accent;
    ctx.shadowBlur = 6;
    const lines = wrapText(ctx, body, width - pad * 2);
    lines.forEach((line) => {
      ctx.fillText(line, pad, y);
      y += fontSize * 1.28;
    });

    bars.forEach(({ label, value }) => {
      y += fontSize * 0.2;
      const barX = pad + fontSize * 6.2;
      const barWidth = width - pad - barX;
      ctx.shadowBlur = 0;
      ctx.fillStyle = accent;
      ctx.fillText(label, pad, y);
      ctx.strokeStyle = DIM;
      ctx.strokeRect(barX, y + 2, barWidth, fontSize * 0.8);
      const level = Math.max(0, Math.min(100, value)) / 100;
      ctx.fillStyle = level < 0.25 ? '#ff5a6e' : accent;
      const segments = 20;
      for (let index = 0; index < Math.round(level * segments); index += 1) {
        ctx.fillRect(barX + 3 + index * (barWidth / segments), y + 5, barWidth / segments - 4, fontSize * 0.8 - 6);
      }
      y += fontSize * 1.3;
    });

    if (footer || blink) {
      ctx.font = `${Math.round(fontSize * 0.75)}px "Courier New", monospace`;
      ctx.fillStyle = DIM;
      ctx.shadowBlur = 0;
      const cursor = blink && Math.floor(performance.now() / 500) % 2 === 0 ? ' _' : '';
      ctx.fillText(`${footer}${cursor}`, pad, height - pad - fontSize * 0.75);
    }
    ctx.shadowBlur = 0;
  }

  window.drawTerminal = drawTerminal;

  AFRAME.registerComponent('terminal-panel', {
    schema: {
      title: { type: 'string', default: 'Q-LINK' },
      subtitle: { type: 'string', default: '' },
      body: { type: 'string', default: '' },
      footer: { type: 'string', default: '' },
      width: { type: 'number', default: 1.4 },
      height: { type: 'number', default: 0.9 },
      resolution: { type: 'number', default: 1024 },
      fontSize: { type: 'number', default: 30 },
      blink: { type: 'boolean', default: false },
    },

    init() {
      this.canvas = document.createElement('canvas');
      this.texture = new THREE.CanvasTexture(this.canvas);
      if ('colorSpace' in this.texture) this.texture.colorSpace = THREE.SRGBColorSpace;
      this.material = new THREE.MeshBasicMaterial({ map: this.texture, transparent: true, toneMapped: false });
      this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.material);
      this.el.setObject3D('mesh', this.mesh);
      this.lastBlink = -1;
    },

    update() {
      const { width, height, resolution } = this.data;
      this.canvas.width = resolution;
      this.canvas.height = Math.round(resolution * (height / width));
      this.mesh.scale.set(width, height, 1);
      this.draw();
    },

    draw() {
      // O texto da placa vem com "\n" escrito no atributo; converte para quebra de linha.
      const body = this.data.body.replace(/\\n/g, '\n');
      drawTerminal(this.canvas, { ...this.data, body });
      this.texture.needsUpdate = true;
    },

    tick(time) {
      if (!this.data.blink || !this.el.object3D.visible) return;
      const phase = Math.floor(time / 500) % 2;
      if (phase === this.lastBlink) return;
      this.lastBlink = phase;
      this.draw();
    },

    remove() {
      this.el.removeObject3D('mesh');
      this.mesh.geometry.dispose();
      this.texture.dispose();
      this.material.dispose();
    },
  });
}());
