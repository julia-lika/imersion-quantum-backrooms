// Telão de slides do lobby: computação quântica do zero, no visual da
// apresentação do projeto (fundo escuro, creme ou amarelo, cartões arredondados,
// ilustrações de moedas e gatos). O conteúdo está em js/content/quantum-slides.js.
// Desktop: clique nos botões (ou na metade esquerda/direita da tela) ou use [ e ].
// VR: toque os botões com a mão.
import { QUANTUM_SLIDES, SLIDE_IMAGES } from '../../content/quantum-slides.js?v=20261124-2';

const CANVAS = { width: 1600, height: 900 };
const PAD = 72;
const TOUCH_RADIUS = 0.12;
const KEY_RADIUS = 4;
const FONT = 'Arial, "Helvetica Neue", Helvetica, sans-serif';
const KICKER = 'COMPUTAÇÃO QUÂNTICA DO ZERO';

const THEMES = {
  dark: { bg: '#15130b', card: '#26230f', text: '#efe9c9', kicker: '#e3cc4b', muted: '#bdb690', accent: '#a78bfa', line: '#3a3518' },
  cream: { bg: '#efe9c9', card: '#e1d8aa', text: '#15130b', kicker: '#7a6a12', muted: '#5f5836', accent: '#8b5cf6', line: '#c9bf8c' },
  yellow: { bg: '#e3cc4b', card: '#d6bd38', text: '#15130b', kicker: '#15130b', muted: '#4a4220', accent: '#6d3fd6', line: '#b9a22c' },
};

const images = {};
function loadImages(onLoad) {
  Object.entries(SLIDE_IMAGES).forEach(([key, src]) => {
    const image = new Image();
    image.onload = onLoad;
    image.src = src;
    images[key] = image;
  });
}

function wrap(ctx, text, maxWidth) {
  const lines = [];
  String(text).split('\n').forEach((paragraph) => {
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

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Escreve um bloco de texto e devolve a altura usada.
function textBlock(ctx, text, x, y, width, { size, color, bold = false, lineHeight = 1.32 }) {
  ctx.font = `${bold ? 'bold ' : ''}${size}px ${FONT}`;
  ctx.fillStyle = color;
  const lines = wrap(ctx, text, width);
  lines.forEach((line, index) => ctx.fillText(line, x, y + size + index * size * lineHeight));
  return lines.length * size * lineHeight;
}

function measureText(ctx, text, width, size, bold = false, lineHeight = 1.32) {
  ctx.font = `${bold ? 'bold ' : ''}${size}px ${FONT}`;
  return wrap(ctx, text, width).length * size * lineHeight;
}

// Diagramas desenhados no canvas, nas cores do tema.
const DIAGRAMS = {
  switches(ctx, box, theme, time) {
    const bits = '010110101100';
    const step = box.w / bits.length;
    const pulse = Math.floor(time / 900) % bits.length;
    [...bits].forEach((bit, index) => {
      const on = bit === '1';
      const x = box.x + step * (index + 0.5);
      const y = box.y + box.h * 0.42;
      ctx.fillStyle = on ? theme.kicker : theme.line;
      ctx.beginPath();
      ctx.arc(x, y, step * 0.34, 0, Math.PI * 2);
      ctx.fill();
      if (on) {
        ctx.strokeStyle = theme.kicker;
        ctx.globalAlpha = 0.35;
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.arc(x, y, step * 0.46, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
      ctx.font = `bold ${Math.round(step * 0.5)}px ${FONT}`;
      ctx.fillStyle = index === pulse ? theme.accent : theme.text;
      ctx.textAlign = 'center';
      ctx.fillText(bit, x, box.y + box.h * 0.9);
      ctx.textAlign = 'left';
    });
  },

  doubling(ctx, box, theme) {
    const max = 12;
    const width = box.w / max;
    for (let bits = 1; bits <= max; bits += 1) {
      // Escala logarítmica: cada bit dobra, então a barra cresce em degraus iguais.
      const h = (box.h - 50) * (bits / max);
      ctx.fillStyle = bits === max ? theme.accent : theme.kicker;
      ctx.fillRect(box.x + (bits - 1) * width + 4, box.y + box.h - 30 - h, width - 8, h);
      ctx.font = `16px ${FONT}`;
      ctx.fillStyle = theme.muted;
      ctx.textAlign = 'center';
      ctx.fillText(String(2 ** bits), box.x + (bits - 0.5) * width, box.y + box.h - 34 - h);
      ctx.fillText(`${bits}`, box.x + (bits - 0.5) * width, box.y + box.h - 6);
      ctx.textAlign = 'left';
    }
  },

  superposition(ctx, box, theme, time) {
    const heads = 0.5 + 0.3 * Math.sin(time * 0.0012);
    [['CARA', heads], ['COROA', 1 - heads]].forEach(([label, p], index) => {
      const w = box.w * 0.3;
      const x = box.x + box.w * (0.12 + index * 0.46);
      const h = (box.h - 70) * p;
      ctx.fillStyle = index ? theme.accent : theme.kicker;
      roundRect(ctx, x, box.y + box.h - 40 - h, w, h, 10);
      ctx.fill();
      ctx.font = `bold 26px ${FONT}`;
      ctx.fillStyle = theme.text;
      ctx.textAlign = 'center';
      ctx.fillText(`${Math.round(p * 100)}%`, x + w / 2, box.y + box.h - 50 - h);
      ctx.font = `bold 20px ${FONT}`;
      ctx.fillText(label, x + w / 2, box.y + box.h - 10);
      ctx.textAlign = 'left';
    });
  },

  entropy(ctx, box, theme) {
    const y = box.y + box.h * 0.45;
    roundRect(ctx, box.x, y, box.w, 34, 17);
    ctx.fillStyle = theme.line;
    ctx.fill();
    roundRect(ctx, box.x, y, box.w * (7.6 / 12), 34, 17);
    ctx.fillStyle = theme.kicker;
    ctx.fill();
    ctx.font = `bold 20px ${FONT}`;
    ctx.fillStyle = theme.text;
    ctx.fillText('0', box.x, y + 70);
    ctx.textAlign = 'right';
    ctx.fillText('12 bits', box.x + box.w, y + 70);
    ctx.textAlign = 'center';
    ctx.fillStyle = theme.accent;
    ctx.fillText('andares ≈ 7–8', box.x + box.w * (7.6 / 12), y - 18);
    ctx.textAlign = 'left';
  },

  map(ctx, box, theme) {
    ctx.font = `bold 30px ${FONT}`;
    ctx.fillStyle = theme.accent;
    ctx.fillText('010110101100', box.x, box.y + 32);
    const cell = Math.min(box.w, box.h - 56) / 12;
    const gx = box.x + (box.w - cell * 12) / 2;
    const gy = box.y + 52;
    const walls = new Set(['5,0', '5,1', '5,2', '5,5', '5,6', '5,7', '0,7', '1,7', '2,7', '6,4', '7,4', '9,4', '10,4', '11,4', '8,9', '8,10', '8,11', '2,3', '9,7']);
    for (let z = 0; z < 12; z += 1) {
      for (let x = 0; x < 12; x += 1) {
        ctx.fillStyle = walls.has(`${x},${z}`) ? theme.text : theme.line;
        ctx.fillRect(gx + x * cell + 1, gy + z * cell + 1, cell - 2, cell - 2);
      }
    }
    ctx.fillStyle = theme.kicker;
    ctx.fillRect(gx + 11 * cell + 1, gy + 11 * cell + 1, cell - 2, cell - 2);
  },

  superposedWall(ctx, box, theme, time) {
    const open = Math.sin(time * 0.0016) > 0.35;
    const w = box.w * 0.34;
    const x = box.x + (box.w - w) / 2;
    ctx.fillStyle = theme.line;
    ctx.fillRect(box.x, box.y + 10, (box.w - w) / 2, box.h - 20);
    ctx.fillRect(x + w, box.y + 10, (box.w - w) / 2, box.h - 20);
    ctx.globalAlpha = open ? 0.25 : 1;
    ctx.fillStyle = theme.accent;
    ctx.fillRect(x, box.y + 10, w, box.h - 20);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = theme.accent;
    ctx.lineWidth = 4;
    ctx.strokeRect(x, box.y + 10, w, box.h - 20);
    ctx.font = `bold 26px ${FONT}`;
    ctx.fillStyle = open ? theme.accent : theme.bg;
    ctx.textAlign = 'center';
    ctx.fillText(open ? 'PASSAGEM' : 'PAREDE', x + w / 2, box.y + box.h / 2 + 10);
    ctx.textAlign = 'left';
  },

  qpsMap(ctx, box, theme, time) {
    // Mini mapa do QPS: paredes, porta, jogador e um setor chiando.
    const grid = [
      '###########',
      '#.....#...#',
      '#.###.#.#.#',
      '#.#.....#.#',
      '#.#.###.#.#',
      '#...#.....#',
      '###.#.###.#',
      '#.....#...#',
      '###########',
    ];
    const cell = Math.floor(Math.min(box.w / grid[0].length, box.h / grid.length));
    const left = box.x + (box.w - cell * grid[0].length) / 2;
    const top = box.y + (box.h - cell * grid.length) / 2;
    ctx.fillStyle = '#04120a';
    ctx.fillRect(left - 10, top - 10, cell * grid[0].length + 20, cell * grid.length + 20);
    const tick = Math.floor((time || 0) / 150);
    grid.forEach((row, z) => [...row].forEach((value, x) => {
      const stale = x >= 6 && z >= 4 && z <= 7;
      let alpha = value === '#' ? 0.8 : 0.08;
      if (stale) alpha = 0.1 + (((x * 7 + z * 13 + tick * 5) % 9) / 9) * 0.45;
      ctx.fillStyle = `rgba(57, 255, 136, ${alpha})`;
      ctx.fillRect(left + x * cell, top + z * cell, cell - 2, cell - 2);
    }));
    ctx.fillStyle = '#e3cc4b';
    ctx.fillRect(left + 9 * cell, top + 8 * cell, cell - 2, cell - 2);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(left + 1.5 * cell, top + 1.5 * cell, cell * 0.32, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#39ff88';
    ctx.font = `bold ${Math.round(cell * 0.9)}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText('?', left + 8 * cell, top + 6.35 * cell);
    ctx.textAlign = 'left';
  },

  // Três portas clássicas com as tabelas-verdade ao lado.
  logicGates(ctx, box, theme) {
    const gates = [
      { name: 'NOT', inputs: 1, rows: [['0', '1'], ['1', '0']] },
      { name: 'AND', inputs: 2, rows: [['0 0', '0'], ['0 1', '0'], ['1 0', '0'], ['1 1', '1']] },
      { name: 'OR', inputs: 2, rows: [['0 0', '0'], ['0 1', '1'], ['1 0', '1'], ['1 1', '1']] },
    ];
    const rowH = box.h / 3;
    gates.forEach((gate, index) => {
      const y = box.y + index * rowH;
      const mid = y + rowH / 2;
      const gx = box.x + 40;
      const gw = 110;
      const gh = Math.min(70, rowH * 0.6);
      ctx.strokeStyle = theme.text;
      ctx.lineWidth = 3;
      const ins = gate.inputs === 1 ? [mid] : [mid - gh * 0.25, mid + gh * 0.25];
      ins.forEach((iy) => { ctx.beginPath(); ctx.moveTo(box.x, iy); ctx.lineTo(gx, iy); ctx.stroke(); });
      ctx.beginPath(); ctx.moveTo(gx + gw, mid); ctx.lineTo(gx + gw + 40, mid); ctx.stroke();
      ctx.fillStyle = theme.kicker;
      ctx.fillRect(gx, mid - gh / 2, gw, gh);
      ctx.fillStyle = theme.bg;
      ctx.font = `bold 28px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText(gate.name, gx + gw / 2, mid + 10);
      // Tabela-verdade: entrada → saída.
      const tx = gx + gw + 70;
      const lineH = Math.min(36, (rowH - 12) / gate.rows.length);
      ctx.font = `28px ${FONT}`;
      ctx.textAlign = 'left';
      gate.rows.forEach(([input, output], r) => {
        const ry = mid - (gate.rows.length * lineH) / 2 + r * lineH + lineH * 0.75;
        ctx.fillStyle = theme.muted;
        ctx.fillText(`${input}  →`, tx, ry);
        ctx.fillStyle = output === '1' ? theme.accent : theme.text;
        ctx.font = `bold 28px ${FONT}`;
        ctx.fillText(output, tx + 120, ry);
        ctx.font = `28px ${FONT}`;
      });
    });
    ctx.textAlign = 'left';
  },

  // Circuito de 2 qubits: H no primeiro, CNOT, e medição dos dois.
  circuit(ctx, box, theme) {
    const wires = [box.y + box.h * 0.32, box.y + box.h * 0.68];
    const x0 = box.x + 70;
    const x1 = box.x + box.w - 20;
    ctx.strokeStyle = theme.text;
    ctx.lineWidth = 3;
    ctx.font = `bold 26px ${FONT}`;
    ctx.textAlign = 'right';
    wires.forEach((y, index) => {
      ctx.fillStyle = theme.text;
      ctx.fillText(`q${index}`, box.x + 50, y + 9);
      ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke();
    });
    ctx.textAlign = 'center';
    const size = 64;
    const box_ = (x, y, label, color) => {
      ctx.fillStyle = color;
      ctx.fillRect(x - size / 2, y - size / 2, size, size);
      ctx.fillStyle = theme.bg;
      ctx.font = `bold 30px ${FONT}`;
      ctx.fillText(label, x, y + 11);
    };
    const span = x1 - x0;
    // H
    box_(x0 + span * 0.18, wires[0], 'H', theme.kicker);
    // CNOT: ponto no controle, ⊕ no alvo.
    const cx = x0 + span * 0.45;
    ctx.beginPath(); ctx.moveTo(cx, wires[0]); ctx.lineTo(cx, wires[1]); ctx.stroke();
    ctx.fillStyle = theme.text;
    ctx.beginPath(); ctx.arc(cx, wires[0], 11, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx, wires[1], 24, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx - 24, wires[1]); ctx.lineTo(cx + 24, wires[1]);
    ctx.moveTo(cx, wires[1] - 24); ctx.lineTo(cx, wires[1] + 24); ctx.stroke();
    // Medidores.
    const mx = x0 + span * 0.78;
    wires.forEach((y) => {
      ctx.fillStyle = theme.accent;
      ctx.fillRect(mx - size / 2, y - size / 2, size, size);
      ctx.strokeStyle = theme.bg;
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(mx, y + 12, 20, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(mx, y + 12); ctx.lineTo(mx + 14, y - 14); ctx.stroke();
      ctx.strokeStyle = theme.text;
    });
    ctx.font = `24px ${FONT}`;
    ctx.fillStyle = theme.muted;
    ctx.fillText('gira a moeda', x0 + span * 0.18, wires[0] - 48);
    ctx.fillText('amarra as duas', cx, wires[0] - 48);
    ctx.fillText('abre a caixa', mx, wires[0] - 48);
    ctx.font = `bold 26px ${FONT}`;
    ctx.fillStyle = theme.text;
    ctx.fillText('00 ou 11', x0 + span * 0.97 - 30, wires[1] + 70);
    ctx.textAlign = 'left';
  },

  tunneling(ctx, box, theme) {
    const mid = box.x + box.w / 2;
    ctx.fillStyle = theme.text;
    ctx.fillRect(mid - 24, box.y + 10, 48, box.h - 20);
    ctx.lineWidth = 5;
    ctx.strokeStyle = theme.kicker;
    ctx.beginPath();
    for (let x = box.x; x <= mid - 24; x += 4) {
      const y = box.y + box.h / 2 + Math.sin((x - box.x) * 0.05) * box.h * 0.32;
      if (x === box.x) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.strokeStyle = theme.accent;
    ctx.beginPath();
    for (let x = mid + 24; x <= box.x + box.w; x += 4) {
      const y = box.y + box.h / 2 + Math.sin((x - box.x) * 0.05) * box.h * 0.1;
      if (x === mid + 24) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
  },
};

function drawVisual(ctx, card, box, theme, time) {
  if (card.image) {
    const image = images[card.image];
    if (!image?.complete || !image.naturalWidth) return;
    const scale = Math.min(box.w / image.naturalWidth, box.h / image.naturalHeight);
    const w = image.naturalWidth * scale;
    const h = image.naturalHeight * scale;
    ctx.drawImage(image, box.x + (box.w - w) / 2, box.y + (box.h - h) / 2, w, h);
  } else if (card.diagram) {
    DIAGRAMS[card.diagram]?.(ctx, box, theme, time);
  }
}

function drawCard(ctx, card, rect, theme, time) {
  const inner = 28;
  const x = rect.x + inner;
  const width = rect.w - inner * 2;
  let y = rect.y + inner - 6;
  const bottom = rect.y + rect.h - inner;

  roundRect(ctx, rect.x, rect.y, rect.w, rect.h, 16);
  ctx.fillStyle = theme.card;
  ctx.fill();

  if (card.label) y += textBlock(ctx, card.label, x, y, width, { size: 22, color: theme.kicker, bold: true }) + 10;
  if (card.heading) y += textBlock(ctx, card.heading, x, y, width, { size: 38, color: theme.text, bold: true, lineHeight: 1.2 }) + 16;

  const hasVisual = Boolean(card.image || card.diagram);
  // Texto grande para ler no VR: maior quando o card não divide espaço com imagem.
  const textSize = hasVisual ? 29 : 33;
  const textHeight = card.text ? measureText(ctx, card.text, width, textSize) : 0;
  const captionHeight = card.caption ? measureText(ctx, card.caption, width, 22) + 10 : 0;

  if (hasVisual) {
    const space = bottom - y - textHeight - captionHeight - (card.text ? 16 : 0);
    drawVisual(ctx, card, { x, y, w: width, h: Math.max(60, space) }, theme, time);
    y += Math.max(60, space) + (card.text ? 16 : 0);
  }
  if (card.text) y += textBlock(ctx, card.text, x, y, width, { size: textSize, color: theme.text });
  if (card.caption) textBlock(ctx, card.caption, x, bottom - captionHeight + 6, width, { size: 22, color: theme.muted });
}

function drawArrow(ctx, x, y, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x - 22, y - 5, 30, 10);
  ctx.beginPath();
  ctx.moveTo(x + 8, y - 14);
  ctx.lineTo(x + 26, y);
  ctx.lineTo(x + 8, y + 14);
  ctx.closePath();
  ctx.fill();
}

function drawTable(ctx, rows, rect, theme) {
  const rowHeight = Math.min(96, rect.h / rows.length);
  const columns = rows[0].length;
  // 2 colunas: 38% / 62%. 3 colunas: rótulo estreito e duas iguais.
  const widths = columns === 2 ? [0.38, 0.62] : [0.22, 0.39, 0.39];
  const starts = widths.map((_, index) => rect.x + rect.w * widths.slice(0, index).reduce((sum, w) => sum + w, 0));
  rows.forEach((row, index) => {
    const y = rect.y + index * rowHeight;
    ctx.fillStyle = index === 0 ? theme.card : (index % 2 ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)');
    ctx.fillRect(rect.x, y, rect.w, rowHeight);
    ctx.strokeStyle = theme.line;
    ctx.lineWidth = 2;
    ctx.strokeRect(rect.x, y, rect.w, rowHeight);
    starts.slice(1).forEach((x) => {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + rowHeight);
      ctx.stroke();
    });
    row.forEach((text, column) => {
      const bold = index === 0 || (columns > 2 && column === 0);
      let size = 32;
      const maxWidth = rect.w * widths[column] - 30;
      ctx.font = `${bold ? 'bold ' : ''}${size}px ${FONT}`;
      while (size > 20 && ctx.measureText(text).width > maxWidth) {
        size -= 2;
        ctx.font = `${bold ? 'bold ' : ''}${size}px ${FONT}`;
      }
      ctx.fillStyle = theme.text;
      ctx.fillText(text, starts[column] + 16, y + rowHeight / 2 + size * 0.35);
    });
  });
}

export function drawSlide(ctx, slide, index, total, time) {
  const theme = THEMES[slide.theme] || THEMES.dark;
  const { width, height } = ctx.canvas;
  ctx.fillStyle = theme.bg;
  ctx.fillRect(0, 0, width, height);

  textBlock(ctx, `${KICKER} · ${index + 1} DE ${total}`, PAD, PAD - 30, width - PAD * 2, { size: 22, color: theme.kicker, bold: true });
  const titleHeight = textBlock(ctx, slide.title, PAD, PAD + 4, width - PAD * 2, { size: 52, color: theme.text, bold: true, lineHeight: 1.12 });

  const footerY = height - PAD + 30;
  const noteHeight = slide.note ? measureText(ctx, slide.note, width - PAD * 2 - 56, 27) + 44 : 0;
  const top = PAD + 4 + titleHeight + 30;
  const bottom = footerY - 34 - (noteHeight ? noteHeight + 22 : 0);

  if (slide.table) {
    drawTable(ctx, slide.table, { x: PAD, y: top, w: width - PAD * 2, h: bottom - top }, theme);
  } else if (slide.cards) {
    const gap = slide.flow ? 70 : 28;
    const count = slide.cards.length;
    const cardWidth = (width - PAD * 2 - gap * (count - 1)) / count;
    slide.cards.forEach((card, cardIndex) => {
      const x = PAD + cardIndex * (cardWidth + gap);
      drawCard(ctx, card, { x, y: top, w: cardWidth, h: bottom - top }, theme, time);
      if (slide.flow && cardIndex < count - 1) drawArrow(ctx, x + cardWidth + gap / 2 - 2, top + (bottom - top) / 2, theme.kicker);
    });
  }

  if (slide.note) {
    const y = bottom + 22;
    roundRect(ctx, PAD, y, width - PAD * 2, noteHeight, 16);
    ctx.fillStyle = theme.card;
    ctx.fill();
    textBlock(ctx, slide.note, PAD + 28, y + 16, width - PAD * 2 - 56, { size: 27, color: theme.text });
  }

  ctx.font = `20px ${FONT}`;
  ctx.fillStyle = theme.muted;
  ctx.fillText('Quantum Backrooms VR · Lobby de treinamento · [ voltar   ] avançar', PAD, footerY);
  ctx.textAlign = 'right';
  ctx.fillText(String(index + 1), width - PAD, footerY);
  ctx.textAlign = 'left';
}

AFRAME.registerComponent('quantum-slides', {
  schema: {
    player: { type: 'selector', default: '#player-head' },
    rig: { type: 'selector', default: '#player' },
    width: { type: 'number', default: 2.6 },
  },

  init() {
    this.index = 0;
    this.lastFlip = 0;
    this.world = new THREE.Vector3();
    this.headWorld = new THREE.Vector3();
    this.canvas = document.createElement('canvas');
    this.canvas.width = CANVAS.width;
    this.canvas.height = CANVAS.height;
    this.texture = new THREE.CanvasTexture(this.canvas);
    if ('colorSpace' in this.texture) this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = 4;
    loadImages(() => this.draw(this.el.sceneEl.time));

    const height = this.data.width * (CANVAS.height / CANVAS.width);
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

    // Moldura escura em volta do telão.
    const frame = document.createElement('a-box');
    frame.setAttribute('width', this.data.width + 0.08);
    frame.setAttribute('height', height + 0.08);
    frame.setAttribute('depth', 0.03);
    frame.setAttribute('position', '0 0 -0.02');
    frame.setAttribute('material', 'color: #0d0b06; roughness: 0.8');
    this.el.appendChild(frame);

    this.buttons = [
      this.createButton('◀', -1, -this.data.width / 2 + 0.16, -height / 2 - 0.17),
      this.createButton('▶', 1, this.data.width / 2 - 0.16, -height / 2 - 0.17),
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
    plate.setAttribute('material', 'color: #26230f; emissive: #e3cc4b; emissiveIntensity: 0.25');
    plate.addEventListener('click', (event) => {
      event.stopPropagation();
      this.flip(direction);
    });
    const text = document.createElement('a-entity');
    text.setAttribute('canvas-text', { value: label, color: '#e3cc4b', width: 0.3, overlay: false });
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
    drawSlide(this.canvas.getContext('2d'), QUANTUM_SLIDES[this.index], this.index, QUANTUM_SLIDES.length, time);
    this.texture.needsUpdate = true;
  },

  tick(time) {
    // Redesenha só por perto (diagramas animados) e checa toque das mãos no VR.
    if (!this.playerNear(6)) return;
    if (time - (this.lastDraw || 0) > 150) {
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
