// Sala de briefing quântico do lobby: um telão com slides navegáveis.
// Desktop: clique nos botões (ou na metade esquerda/direita da tela) ou use [ e ].
// VR: toque os botões com a mão.
import { QUANTUM_SLIDES } from '../../content/quantum-slides.js';

const SLIDE_CANVAS = { width: 1280, height: 800 };
const GREEN = '#39ff88';
const DIM = '#1d8a4f';
const CYAN = '#44ffcc';
const PURPLE = '#b46bff';
const TOUCH_RADIUS = 0.12;
const KEY_RADIUS = 4;

function wrap(ctx, text, maxWidth) {
  const lines = [];
  text.split('\n').forEach((paragraph) => {
    if (!paragraph.trim()) {
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

// Diagramas simples, um por slide, desenhados na metade direita da tela.
const DIAGRAMS = {
  intro(ctx, box) {
    ctx.strokeStyle = GREEN;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(box.x + box.w / 2, box.y + box.h / 2, box.h * 0.32, 0, Math.PI * 2);
    ctx.stroke();
    ctx.font = 'bold 120px "Courier New", monospace';
    ctx.fillStyle = GREEN;
    ctx.textAlign = 'center';
    ctx.fillText('ψ', box.x + box.w / 2, box.y + box.h / 2 + 40);
    ctx.textAlign = 'left';
  },

  superposition(ctx, box, time) {
    const p1 = 0.5 + 0.35 * Math.sin(time * 0.0012);
    const bars = [['|0⟩', 1 - p1], ['|1⟩', p1]];
    const barWidth = box.w * 0.22;
    bars.forEach(([label, p], index) => {
      const x = box.x + box.w * (0.2 + index * 0.4);
      const h = box.h * 0.7 * p;
      ctx.fillStyle = index ? CYAN : GREEN;
      ctx.fillRect(x, box.y + box.h * 0.8 - h, barWidth, h);
      ctx.fillStyle = GREEN;
      ctx.font = 'bold 34px "Courier New", monospace';
      ctx.fillText(label, x + 20, box.y + box.h * 0.92);
      ctx.fillText(`${Math.round(p * 100)}%`, x + 10, box.y + box.h * 0.8 - h - 12);
    });
    ctx.font = '24px "Courier New", monospace';
    ctx.fillStyle = DIM;
    ctx.fillText('RY girando: a chance muda até medir', box.x, box.y + 30);
  },

  entanglement(ctx, box, time) {
    const count = 12;
    const step = box.w / count;
    const y = box.y + box.h * 0.5;
    ctx.strokeStyle = CYAN;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(box.x + step / 2, y);
    ctx.lineTo(box.x + box.w - step / 2, y);
    ctx.stroke();
    const pulse = Math.floor(time / 300) % count;
    for (let index = 0; index < count; index += 1) {
      const x = box.x + step * (index + 0.5);
      ctx.fillStyle = index <= pulse ? CYAN : '#0b2a1c';
      ctx.beginPath();
      ctx.arc(x, y, step * 0.32, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = GREEN;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = GREEN;
      ctx.font = '20px "Courier New", monospace';
      ctx.fillText(`q${index}`, x - 14, y + step * 0.75);
    }
    ctx.font = '24px "Courier New", monospace';
    ctx.fillStyle = DIM;
    ctx.fillText('CX em cadeia: cada qubit afeta o próximo', box.x, box.y + 30);
  },

  interference(ctx, box) {
    // Distribuição não uniforme (formato ilustrativo) contra a linha uniforme.
    const columns = 48;
    const width = box.w / columns;
    for (let index = 0; index < columns; index += 1) {
      const p = Math.abs(Math.sin(index * 0.7) * Math.cos(index * 0.23)) ** 2;
      const h = box.h * 0.7 * p;
      ctx.fillStyle = p > 0.5 ? CYAN : GREEN;
      ctx.fillRect(box.x + index * width, box.y + box.h * 0.85 - h, width - 2, h);
    }
    ctx.strokeStyle = PURPLE;
    ctx.setLineDash([10, 8]);
    ctx.beginPath();
    ctx.moveTo(box.x, box.y + box.h * 0.7);
    ctx.lineTo(box.x + box.w, box.y + box.h * 0.7);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.font = '24px "Courier New", monospace';
    ctx.fillStyle = PURPLE;
    ctx.fillText('sem interferência (uniforme)', box.x, box.y + box.h * 0.66);
    ctx.fillStyle = DIM;
    ctx.fillText('com interferência: picos e vales', box.x, box.y + 30);
  },

  measurement(ctx, box, time) {
    const rows = 7;
    const chosen = Math.floor(time / 1600) % rows;
    ctx.font = '30px "Courier New", monospace';
    for (let index = 0; index < rows; index += 1) {
      const bits = Array.from({ length: 12 }, (_, q) => ((index * 7 + q * 3 + (q * index)) % 5 < 2 ? '1' : '0')).join('');
      ctx.fillStyle = index === chosen ? CYAN : DIM;
      ctx.fillText(`${index === chosen ? '▶' : ' '} ${bits}`, box.x + 20, box.y + 90 + index * 52);
    }
    ctx.font = '24px "Courier New", monospace';
    ctx.fillStyle = GREEN;
    ctx.fillText('1024 shots gravados → 1 resultado', box.x, box.y + 30);
  },

  entropy(ctx, box) {
    const y = box.y + box.h * 0.55;
    const x0 = box.x + 20;
    const width = box.w - 40;
    ctx.fillStyle = '#0b2a1c';
    ctx.fillRect(x0, y - 20, width, 40);
    const gradient = ctx.createLinearGradient(x0, 0, x0 + width, 0);
    gradient.addColorStop(0, GREEN);
    gradient.addColorStop(1, PURPLE);
    ctx.fillStyle = gradient;
    ctx.fillRect(x0, y - 20, width * (7.6 / 12), 40);
    ctx.fillStyle = GREEN;
    ctx.font = '26px "Courier New", monospace';
    ctx.fillText('0 bits', x0, y + 60);
    ctx.fillText('12 bits', x0 + width - 100, y + 60);
    ctx.fillStyle = CYAN;
    ctx.fillText('andares gravados ≈ 7–8 bits', x0 + width * 0.25, y - 40);
    ctx.fillStyle = DIM;
    ctx.fillText('H = −Σ p · log₂ p', box.x, box.y + 30);
  },

  map(ctx, box) {
    ctx.font = 'bold 30px "Courier New", monospace';
    ctx.fillStyle = CYAN;
    ctx.fillText('010110101100', box.x, box.y + 60);
    ctx.fillStyle = GREEN;
    ctx.fillText('↓ semente', box.x + 40, box.y + 110);
    // Mini grade estilo BSP.
    const gx = box.x + 40;
    const gy = box.y + 140;
    const cell = Math.min(box.w - 80, box.h - 170) / 12;
    const walls = new Set(['5,0', '5,1', '5,2', '5,4', '5,5', '5,6', '5,7', '0,7', '1,7', '2,7', '4,7', '6,4', '7,4', '9,4', '10,4', '11,4', '8,9', '8,10', '8,11']);
    for (let z = 0; z < 12; z += 1) {
      for (let x = 0; x < 12; x += 1) {
        ctx.fillStyle = walls.has(`${x},${z}`) ? GREEN : '#0b2a1c';
        ctx.fillRect(gx + x * cell, gy + z * cell, cell - 2, cell - 2);
      }
    }
    ctx.fillStyle = '#ffd36b';
    ctx.fillRect(gx + 11 * cell, gy + 11 * cell, cell - 2, cell - 2);
  },

  superposedWall(ctx, box, time) {
    const open = Math.sin(time * 0.0016) > 0.35;
    const x = box.x + box.w * 0.35;
    ctx.fillStyle = '#0b2a1c';
    ctx.fillRect(box.x, box.y + 60, box.w, box.h - 80);
    ctx.fillStyle = open ? 'rgba(68,255,204,0.18)' : PURPLE;
    ctx.fillRect(x, box.y + 60, box.w * 0.3, box.h - 80);
    ctx.strokeStyle = open ? CYAN : PURPLE;
    ctx.lineWidth = 4;
    ctx.strokeRect(x, box.y + 60, box.w * 0.3, box.h - 80);
    ctx.font = 'bold 30px "Courier New", monospace';
    ctx.fillStyle = open ? CYAN : PURPLE;
    ctx.fillText(open ? 'PASSAGEM' : 'PAREDE', x + 10, box.y + box.h / 2);
    ctx.font = '24px "Courier New", monospace';
    ctx.fillStyle = DIM;
    ctx.fillText('|parede⟩ + |passagem⟩ até você entrar', box.x, box.y + 30);
  },

  tunneling(ctx, box) {
    const mid = box.x + box.w / 2;
    ctx.fillStyle = GREEN;
    ctx.fillRect(mid - 30, box.y + 70, 60, box.h - 100);
    ctx.strokeStyle = CYAN;
    ctx.lineWidth = 4;
    ctx.beginPath();
    for (let x = box.x; x < mid - 30; x += 4) {
      const y = box.y + box.h / 2 + Math.sin((x - box.x) * 0.06) * 70;
      if (x === box.x) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.beginPath();
    for (let x = mid + 30; x < box.x + box.w; x += 4) {
      const y = box.y + box.h / 2 + Math.sin((x - box.x) * 0.06) * 22;
      if (x === mid + 30) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.font = '24px "Courier New", monospace';
    ctx.fillStyle = DIM;
    ctx.fillText('a onda passa a barreira, menor', box.x, box.y + 30);
  },

  honesty(ctx, box) {
    ctx.font = 'bold 30px "Courier New", monospace';
    ctx.fillStyle = CYAN;
    ctx.fillText('QUÂNTICO', box.x, box.y + 70);
    ctx.font = '24px "Courier New", monospace';
    ['circuito de 12 qubits', 'amostragem dos resultados', 'entropia das medições']
      .forEach((line, index) => ctx.fillText(`✓ ${line}`, box.x, box.y + 110 + index * 34));
    ctx.font = 'bold 30px "Courier New", monospace';
    ctx.fillStyle = PURPLE;
    ctx.fillText('JOGO', box.x, box.y + 260);
    ctx.font = '24px "Courier New", monospace';
    ['entidade e sanidade', 'paredes oscilando', 'coerência/ruído do HUD']
      .forEach((line, index) => ctx.fillText(`◆ ${line}`, box.x, box.y + 300 + index * 34));
  },
};

AFRAME.registerComponent('quantum-slides', {
  schema: {
    player: { type: 'selector', default: '#player-head' },
    rig: { type: 'selector', default: '#player' },
    width: { type: 'number', default: 2.1 },
  },

  init() {
    this.index = 0;
    this.lastFlip = 0;
    this.world = new THREE.Vector3();
    this.headWorld = new THREE.Vector3();
    this.canvas = document.createElement('canvas');
    this.canvas.width = SLIDE_CANVAS.width;
    this.canvas.height = SLIDE_CANVAS.height;
    this.texture = new THREE.CanvasTexture(this.canvas);
    if ('colorSpace' in this.texture) this.texture.colorSpace = THREE.SRGBColorSpace;

    const height = this.data.width * (SLIDE_CANVAS.height / SLIDE_CANVAS.width);
    this.screen = document.createElement('a-plane');
    this.screen.classList.add('clickable');
    this.screen.setAttribute('width', this.data.width);
    this.screen.setAttribute('height', height);
    this.screen.setAttribute('material', 'shader: flat; color: #ffffff');
    this.screen.addEventListener('loaded', () => {
      const material = this.screen.getObject3D('mesh').material;
      material.map = this.texture;
      material.needsUpdate = true;
    });
    // Clique na metade esquerda volta, na direita avança.
    this.screen.addEventListener('click', (event) => {
      const uv = event.detail?.intersection?.uv;
      this.flip(uv && uv.x < 0.5 ? -1 : 1);
    });
    this.el.appendChild(this.screen);

    this.buttons = [
      this.createButton('◀', -1, -this.data.width / 2 + 0.16, -height / 2 - 0.16),
      this.createButton('▶', 1, this.data.width / 2 - 0.16, -height / 2 - 0.16),
    ];

    this.onKey = (event) => {
      if (event.repeat || (event.code !== 'BracketLeft' && event.code !== 'BracketRight')) return;
      if (!this.playerNear(KEY_RADIUS)) return;
      this.flip(event.code === 'BracketLeft' ? -1 : 1);
    };
    window.addEventListener('keydown', this.onKey);
    this.draw(0);
  },

  remove() {
    window.removeEventListener('keydown', this.onKey);
    this.texture.dispose();
  },

  createButton(label, direction, x, y) {
    const button = document.createElement('a-entity');
    button.setAttribute('position', `${x} ${y} 0.02`);
    const plate = document.createElement('a-box');
    plate.classList.add('clickable');
    plate.setAttribute('width', 0.26);
    plate.setAttribute('height', 0.2);
    plate.setAttribute('depth', 0.04);
    plate.setAttribute('material', `color: #06281a; emissive: ${GREEN}; emissiveIntensity: 0.35`);
    plate.addEventListener('click', (event) => {
      event.stopPropagation();
      this.flip(direction);
    });
    const text = document.createElement('a-entity');
    text.setAttribute('canvas-text', { value: label, color: GREEN, width: 0.3, overlay: false });
    text.setAttribute('position', '0 0 0.025');
    text.setAttribute('scale', '2.4 2.4 1');
    button.append(plate, text);
    this.el.appendChild(button);
    return { el: button, direction, touching: false };
  },

  playerNear(radius) {
    this.el.object3D.getWorldPosition(this.world);
    this.data.player?.object3D.getWorldPosition(this.headWorld);
    return Math.hypot(this.world.x - this.headWorld.x, this.world.z - this.headWorld.z) < radius;
  },

  flip(direction) {
    const now = performance.now();
    if (now - this.lastFlip < 350) return;
    this.lastFlip = now;
    this.index = (this.index + direction + QUANTUM_SLIDES.length) % QUANTUM_SLIDES.length;
    this.draw(this.el.sceneEl.time);
  },

  draw(time) {
    const slide = QUANTUM_SLIDES[this.index];
    const ctx = this.canvas.getContext('2d');
    const { width, height } = this.canvas;
    const pad = 48;

    ctx.fillStyle = '#020c07';
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    for (let y = 0; y < height; y += 4) ctx.fillRect(0, y, width, 2);
    ctx.strokeStyle = GREEN;
    ctx.lineWidth = 4;
    ctx.strokeRect(12, 12, width - 24, height - 24);

    ctx.fillStyle = GREEN;
    ctx.font = 'bold 54px "Courier New", monospace';
    ctx.fillText(slide.title, pad, pad + 46);
    ctx.font = '26px "Courier New", monospace';
    ctx.fillStyle = DIM;
    ctx.fillText(slide.subtitle, width - pad - ctx.measureText(slide.subtitle).width, pad + 40);
    ctx.fillRect(pad, pad + 70, width - pad * 2, 3);

    const textWidth = width * 0.5;
    ctx.font = '30px "Courier New", monospace';
    ctx.fillStyle = GREEN;
    wrap(ctx, slide.body, textWidth - pad).forEach((line, index) => {
      ctx.fillText(line, pad, pad + 130 + index * 40);
    });

    const box = { x: textWidth + 20, y: pad + 100, w: width - textWidth - pad - 20, h: height - pad * 2 - 160 };
    DIAGRAMS[slide.diagram]?.(ctx, box, time);

    // Paginação.
    ctx.font = '24px "Courier New", monospace';
    ctx.fillStyle = DIM;
    const dots = QUANTUM_SLIDES.map((_, index) => (index === this.index ? '●' : '○')).join(' ');
    ctx.fillText(dots, pad, height - pad);
    ctx.fillText('[ voltar   ] avançar', width - pad - 300, height - pad);
    this.texture.needsUpdate = true;
  },

  tick(time) {
    // Redesenha só por perto (diagramas animados) e checa toque das mãos no VR.
    if (!this.playerNear(6)) return;
    if (time - (this.lastDraw || 0) > 120) {
      this.lastDraw = time;
      this.draw(time);
    }

    const tracker = this.data.rig?.components['xr-hands'];
    if (!tracker?.inVr) return;
    this.buttons.forEach((button) => {
      button.el.object3D.getWorldPosition(this.world);
      const touching = ['left', 'right'].some((side) => (
        tracker.hands[side].tracked && tracker.hands[side].world.distanceTo(this.world) < TOUCH_RADIUS
      ));
      if (touching && !button.touching) this.flip(button.direction);
      button.touching = touching;
    });
  },
});
