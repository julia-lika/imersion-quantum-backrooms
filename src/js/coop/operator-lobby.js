// Modo duo, lado do OPERADOR, dentro do jogo: ele fica no lobby (desktop com
// WASD e mouse, ou VR) e não desce. Sobre o balcão, um monitor mostra o andar
// do explorador, a IA e a sala; a VARREDURA é um botão no fundo do salão: é
// preciso correr até lá para apertar (E, clique ou encostar a mão no VR).
// A lógica de rede e do mundo fica em coop-host.js.
import { createCoopHost } from './coop-host.js?v=20261125-op1';
import { drawOperatorMap } from './operator-map.js?v=20261125-op1';
import { normalizeRoomCode } from './coop-net.js?v=20261125-4';
import { COOP } from './coop-world.js?v=20261125-ai2';

const PEERJS_URL = 'https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js';
const $ = (id) => document.getElementById(id);

// Monitor no lugar da placa de boas-vindas (sobre o balcão, de frente para o
// spawn). Botão da varredura no fundo do salão, perto da estação do QPS.
const MONITOR = { cellX: 3.15, cellZ: 1.35, y: 1.74, width: 2.0, rotation: -90 };
const STATION = { x: 3, z: 10 };
const CANVAS_W = 1280;
const CANVAS_H = 800;
const PRESS_DISTANCE = 1.7;
const TOUCH_RADIUS = 0.24;
const REDRAW_MS = 160;

let host = null;

function loadPeerJs() {
  if (typeof window.Peer === 'function' || new URLSearchParams(location.search).get('transporte') === 'local') {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = PEERJS_URL;
    script.onload = resolve;
    script.onerror = () => reject(new Error('PeerJS não carregou'));
    document.head.append(script);
  });
}

function scene() {
  return document.querySelector('a-scene');
}

function hint(text) {
  scene()?.emit('interaction-hint', { text });
}

function regionOf(state, point) {
  if (!point) return '--';
  let best = null;
  state.regions.forEach((region) => {
    const dx = Math.max(region.minX - point.x, 0, point.x - region.maxX);
    const dz = Math.max(region.minZ - point.z, 0, point.z - region.maxZ);
    const d = Math.hypot(dx, dz);
    if (!best || d < best.d) best = { d, label: region.label };
  });
  return best?.label || '?';
}

function wrap(ctx, text, maxWidth) {
  const lines = [];
  let line = '';
  String(text).split(/\s+/).forEach((word) => {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  });
  if (line) lines.push(line);
  return lines;
}

function toggleMute() {
  if (!host) return;
  const muted = host.toggleMute();
  window.quantumCoop.muted = muted;
  scene()?.emit('coop-mute-changed', { muted });
  hint(muted ? 'SEU MICROFONE ESTÁ MUDO — o explorador não ouve você (V desmuta)' : 'MICROFONE ABERTO — o explorador ouve você');
}

// ---------- monitor e botão (um componente na cena) ----------
AFRAME.registerComponent('operator-lobby', {
  init() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = CANVAS_W;
    this.canvas.height = CANVAS_H;
    this.ctx = this.canvas.getContext('2d');
    this.lastDraw = 0;
    this.lastPress = 0;
    this.touching = { left: false, right: false };
    this.flashUntil = 0;
    this.head = new THREE.Vector3();
    this.buttonWorld = new THREE.Vector3();
    this.buildMonitor();
    this.buildStation();

    this.onWorld = ({ detail }) => this.placeInLobby(Boolean(detail?.lobby));
    this.onKey = (event) => {
      if (event.code !== 'KeyE' || event.repeat || !this.el.object3D.visible) return;
      if (event.target instanceof HTMLInputElement) return;
      if (this.distanceToButton() < PRESS_DISTANCE) this.press('tecla');
    };
    this.onClick = () => {
      if (this.distanceToButton() < PRESS_DISTANCE + 0.6) this.press('clique');
      else hint('VARREDURA — chegue mais perto do botão para apertar');
    };
    this.el.sceneEl.addEventListener('maze-world-updated', this.onWorld);
    window.addEventListener('keydown', this.onKey);
    this.button.addEventListener('click', this.onClick);
    this.placeInLobby(Boolean(window.quantumWorld && window.quantumPlayer?.floor === 0));
  },

  remove() {
    this.el.sceneEl.removeEventListener('maze-world-updated', this.onWorld);
    window.removeEventListener('keydown', this.onKey);
  },

  buildMonitor() {
    const monitor = document.createElement('a-entity');
    const height = MONITOR.width * (CANVAS_H / CANVAS_W);
    const frame = document.createElement('a-box');
    frame.setAttribute('width', MONITOR.width + 0.08);
    frame.setAttribute('height', height + 0.08);
    frame.setAttribute('depth', 0.05);
    frame.setAttribute('position', '0 0 -0.03');
    frame.setAttribute('material', 'color: #15171a; metalness: 0.5; roughness: 0.45');
    monitor.appendChild(frame);
    const stand = document.createElement('a-cylinder');
    stand.setAttribute('radius', 0.035);
    stand.setAttribute('height', 0.62);
    stand.setAttribute('position', `0 ${-height / 2 - 0.3} -0.05`);
    stand.setAttribute('material', 'color: #15171a; metalness: 0.6; roughness: 0.4');
    monitor.appendChild(stand);
    this.texture = new THREE.CanvasTexture(this.canvas);
    if ('colorSpace' in this.texture) this.texture.colorSpace = THREE.SRGBColorSpace;
    const screen = new THREE.Mesh(
      new THREE.PlaneGeometry(MONITOR.width, height),
      new THREE.MeshBasicMaterial({ map: this.texture, toneMapped: false }),
    );
    monitor.object3D.add(screen);
    const glow = document.createElement('a-entity');
    glow.setAttribute('light', 'type: point; color: #8fd8ff; intensity: 0.35; distance: 3');
    glow.setAttribute('position', '0 0 0.4');
    monitor.appendChild(glow);
    this.el.appendChild(monitor);
    this.monitor = monitor;
  },

  buildStation() {
    const station = document.createElement('a-entity');
    const pedestal = document.createElement('a-cylinder');
    pedestal.setAttribute('radius', 0.26);
    pedestal.setAttribute('height', 0.96);
    pedestal.setAttribute('position', '0 0.48 0');
    pedestal.setAttribute('material', 'color: #23262a; metalness: 0.55; roughness: 0.4');
    station.appendChild(pedestal);
    const rim = document.createElement('a-cylinder');
    rim.setAttribute('radius', 0.2);
    rim.setAttribute('height', 0.03);
    rim.setAttribute('position', '0 0.975 0');
    rim.setAttribute('material', 'color: #e8c547; metalness: 0.3; roughness: 0.5');
    station.appendChild(rim);
    const button = document.createElement('a-cylinder');
    button.classList.add('clickable');
    button.setAttribute('radius', 0.15);
    button.setAttribute('height', 0.07);
    button.setAttribute('position', '0 1.02 0');
    button.setAttribute('material', 'color: #39ff88; emissive: #39ff88; emissiveIntensity: 0.6');
    station.appendChild(button);
    this.button = button;

    this.labelCanvas = document.createElement('canvas');
    this.labelCanvas.width = 512;
    this.labelCanvas.height = 256;
    this.labelTexture = new THREE.CanvasTexture(this.labelCanvas);
    if ('colorSpace' in this.labelTexture) this.labelTexture.colorSpace = THREE.SRGBColorSpace;
    this.label = new THREE.Mesh(
      new THREE.PlaneGeometry(0.8, 0.4),
      new THREE.MeshBasicMaterial({ map: this.labelTexture, transparent: true, toneMapped: false, side: THREE.DoubleSide }),
    );
    this.label.position.set(0, 1.62, 0);
    station.object3D.add(this.label);

    const light = document.createElement('a-entity');
    light.setAttribute('light', 'type: point; color: #39ff88; intensity: 0.5; distance: 2.6');
    light.setAttribute('position', '0 1.3 0');
    station.appendChild(light);
    this.stationLight = light;
    this.el.appendChild(station);
    this.station = station;
    this.labelState = '';
  },

  placeInLobby(lobby) {
    this.el.object3D.visible = lobby;
    const world = window.quantumWorld;
    if (!lobby || !world) return;
    const at = (cell) => world.origin + cell * world.cellSize;
    this.monitor.object3D.position.set(at(MONITOR.cellX), MONITOR.y, at(MONITOR.cellZ));
    this.monitor.object3D.rotation.set(0, THREE.MathUtils.degToRad(MONITOR.rotation), 0);
    this.station.object3D.position.set(at(STATION.x), 0, at(STATION.z));
    // O pedestal é sólido (como os móveis do lobby).
    if (Array.isArray(world.maze[STATION.z])) world.maze[STATION.z][STATION.x] = 'F';
    this.hideWelcomeSign();
  },

  // A placa de boas-vindas (FASE 0 // LOBBY) dá lugar ao monitor.
  hideWelcomeSign() {
    document.querySelectorAll('[terminal-panel]').forEach((el) => {
      const title = el.getAttribute('terminal-panel')?.title || '';
      if (title.includes('FASE 0')) el.object3D.visible = false;
    });
  },

  distanceToButton() {
    const head = document.getElementById('player-head');
    if (!head) return Infinity;
    head.object3D.getWorldPosition(this.head);
    this.button.object3D.getWorldPosition(this.buttonWorld);
    return Math.hypot(this.head.x - this.buttonWorld.x, this.head.z - this.buttonWorld.z);
  },

  press(source) {
    const now = performance.now();
    if (now - this.lastPress < 600 || !host) return;
    this.lastPress = now;
    const result = host.scan();
    window.coopOperatorStats = { presses: (window.coopOperatorStats?.presses ?? 0) + 1, last: result, source };
    if (result.ok) {
      this.flashUntil = now + 900;
      this.el.sceneEl.emit('screen-effect', { type: 'flash', color: '#39ff88', duration: 400, peak: 0.25 });
      hint('VARREDURA FEITA — a IA perdeu a vez (e a jaula, se houver, se desfez). Volte ao monitor');
    } else if (result.reason === 'recarregando') {
      hint(`VARREDURA RECARREGANDO — ${Math.ceil(host.scanCooldown() / 1000)} s`);
    } else {
      hint('VARREDURA — ainda não há explorador no andar');
    }
  },

  tick(time) {
    if (!host || !this.el.object3D.visible) return;
    this.updateHands();
    this.faceLabel();
    if (time - this.lastDraw < REDRAW_MS) return;
    this.lastDraw = time;
    if (window.quantumWorld?.maze[STATION.z]?.[STATION.x] !== 'F') this.placeInLobby(true);
    this.hideWelcomeSign();
    this.drawMonitor(performance.now());
    this.drawStation(performance.now());
  },

  // VR: encostar a mão no botão aperta (só na borda: encostar de novo repete).
  updateHands() {
    const tracker = document.getElementById('player')?.components['xr-hands'];
    if (!tracker) return;
    this.button.object3D.getWorldPosition(this.buttonWorld);
    ['left', 'right'].forEach((side) => {
      const hand = tracker.hands?.[side];
      const touching = Boolean(hand?.tracked && hand.world && hand.world.distanceTo(this.buttonWorld) < TOUCH_RADIUS);
      if (touching && !this.touching[side]) this.press('mão');
      this.touching[side] = touching;
    });
  },

  faceLabel() {
    const head = document.getElementById('player-head');
    if (!head) return;
    head.object3D.getWorldPosition(this.head);
    this.station.object3D.getWorldPosition(this.buttonWorld);
    this.label.rotation.y = Math.atan2(this.head.x - this.buttonWorld.x, this.head.z - this.buttonWorld.z);
  },

  drawStation(now) {
    const cooldown = host.scanCooldown();
    const playing = host.playing();
    const flash = now < this.flashUntil;
    const stateKey = `${flash}|${playing}|${Math.ceil(cooldown / 1000)}`;
    if (stateKey === this.labelState) return;
    this.labelState = stateKey;
    const ready = cooldown <= 0 && playing;
    const color = flash ? '#ffffff' : (ready ? '#39ff88' : (cooldown > 0 ? '#ff4d5e' : '#d8bc75'));
    this.button.setAttribute('material', `color: ${color}; emissive: ${color}; emissiveIntensity: ${ready || flash ? 0.8 : 0.25}`);
    this.stationLight.setAttribute('light', 'color', color);
    const ctx = this.labelCanvas.getContext('2d');
    ctx.clearRect(0, 0, 512, 256);
    ctx.fillStyle = 'rgba(4, 8, 6, 0.86)';
    ctx.fillRect(0, 0, 512, 256);
    ctx.strokeStyle = color;
    ctx.lineWidth = 6;
    ctx.strokeRect(3, 3, 506, 250);
    ctx.textAlign = 'center';
    ctx.fillStyle = color;
    ctx.font = 'bold 64px "Courier New", monospace';
    ctx.fillText('VARREDURA', 256, 92);
    ctx.font = 'bold 34px "Courier New", monospace';
    let line = 'PRONTA — APERTE';
    if (flash) line = 'FEITA!';
    else if (cooldown > 0) line = `RECARREGANDO ${Math.ceil(cooldown / 1000)} s`;
    else if (!playing) line = 'SEM EXPLORADOR';
    ctx.fillText(line, 256, 158);
    ctx.font = '24px "Courier New", monospace';
    ctx.fillStyle = '#d8bc75';
    ctx.fillText('E, CLIQUE OU ENCOSTE A MÃO', 256, 214);
    this.labelTexture.needsUpdate = true;
  },

  drawMonitor(now) {
    const ctx = this.ctx;
    const state = host.world.state;
    ctx.fillStyle = '#050504';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    const mapSize = 760;
    drawOperatorMap(ctx, state, { x: 20, y: 20, size: mapSize }, now);

    const playing = host.playing();
    if (!playing) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.78)';
      ctx.fillRect(20, 20, mapSize, mapSize);
      ctx.textAlign = 'center';
      ctx.fillStyle = '#d8bc75';
      ctx.font = 'bold 34px "Courier New", monospace';
      ctx.fillText('CÓDIGO DA SALA', 400, 290);
      ctx.fillStyle = '#ffe69b';
      ctx.font = 'bold 150px "Courier New", monospace';
      ctx.fillText(host.code, 400, 440);
      ctx.font = '28px "Courier New", monospace';
      ctx.fillStyle = '#d8bc75';
      const waiting = host.connected()
        ? 'EXPLORADOR CONECTADO — ESPERANDO ELE ENTRAR NO JOGO'
        : 'O EXPLORADOR DIGITA ESTE CÓDIGO NA TELA INICIAL';
      wrap(ctx, waiting, 680).forEach((line, index) => ctx.fillText(line, 400, 520 + index * 38));
    }

    // Painel lateral.
    const x = 806;
    const w = CANVAS_W - x - 20;
    let y = 50;
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffe69b';
    ctx.font = 'bold 30px "Courier New", monospace';
    ctx.fillText('CONSOLE DO OPERADOR', x, y);
    y += 42;
    ctx.font = '24px "Courier New", monospace';
    ctx.fillStyle = '#d8bc75';
    ctx.fillText(`SALA ${host.code}`, x, y);
    y += 34;
    ctx.font = '20px "Courier New", monospace';
    wrap(ctx, host.status, w).slice(0, 2).forEach((line) => { ctx.fillText(line, x, y); y += 26; });
    y += 6;
    ctx.fillText(`VOZ: ${host.voice}`, x, y);
    y += 28;
    ctx.fillStyle = host.explorerMuted ? '#ff4d5e' : '#39ff88';
    ctx.fillText(`MIC DO EXPLORADOR: ${host.explorerMuted ? 'MUDO' : 'ABERTO'}`, x, y);
    y += 28;
    ctx.fillStyle = host.muted ? '#ff4d5e' : '#d8bc75';
    ctx.fillText(`SEU MIC: ${host.muted ? 'MUDO' : 'ABERTO'} (V)`, x, y);
    y += 40;

    ctx.fillStyle = '#d8bc75';
    ctx.font = 'bold 24px "Courier New", monospace';
    const door = state.doorCandidates[state.door];
    ctx.fillText(`ANDAR ${String(state.floor).padStart(2, '0')}`, x, y);
    y += 32;
    ctx.font = '22px "Courier New", monospace';
    ctx.fillText(`PORTA: ${door ? regionOf(state, door) : '--'} (ciano)`, x, y);
    y += 30;
    ctx.fillText(`EXPLORADOR: ${playing ? regionOf(state, state.explorer) : '--'}`, x, y);
    y += 30;
    ctx.fillText(`PAREDES DA IA: ${state.aiWalls.length}`, x, y);
    y += 40;

    // Alertas da IA (o que o explorador não vê).
    const alerts = [];
    state.pending.forEach((item) => {
      const left = Math.max(0, (item.at - now) / 1000).toFixed(1);
      alerts.push({
        color: item.kind === 'cage' ? '#c45cff' : '#ff4d5e',
        text: item.kind === 'cage' ? `IA VAI CERCAR O EXPLORADOR EM ${left} s` : `IA FECHA ${item.label} EM ${left} s`,
      });
    });
    if (state.cage) alerts.push({ color: '#c45cff', text: 'EXPLORADOR CERCADO: Salto de Fase ou varredura' });
    ctx.font = 'bold 22px "Courier New", monospace';
    alerts.slice(0, 3).forEach((alert) => {
      const blink = Math.floor(now / 350) % 2 === 0;
      ctx.fillStyle = blink ? alert.color : '#5a2a30';
      wrap(ctx, `⚠ ${alert.text}`, w).forEach((line) => { ctx.fillText(line, x, y); y += 28; });
      y += 4;
    });
    if (!alerts.length) {
      ctx.fillStyle = '#6f613f';
      ctx.fillText('IA: sem jogada marcada', x, y);
      y += 32;
    }
    y += 8;

    // Varredura: fica no fundo do salão.
    const cooldown = host.scanCooldown();
    ctx.fillStyle = cooldown > 0 ? '#ff4d5e' : (playing ? '#39ff88' : '#6f613f');
    ctx.font = 'bold 24px "Courier New", monospace';
    ctx.fillText(cooldown > 0 ? `VARREDURA: ${Math.ceil(cooldown / 1000)} s` : 'VARREDURA: PRONTA', x, y);
    y += 14;
    ctx.fillStyle = '#2a261a';
    ctx.fillRect(x, y, w, 12);
    ctx.fillStyle = cooldown > 0 ? '#ff4d5e' : '#39ff88';
    ctx.fillRect(x, y, w * (1 - cooldown / COOP.scanCooldownMs), 12);
    y += 34;
    ctx.fillStyle = '#d8bc75';
    ctx.font = '19px "Courier New", monospace';
    wrap(ctx, 'O botão fica no FUNDO DO SALÃO: corra até lá. Cancela a próxima jogada da IA e desfaz a jaula.', w)
      .forEach((line) => { ctx.fillText(line, x, y); y += 24; });
    y += 12;

    // Últimas linhas do registro.
    ctx.font = '17px "Courier New", monospace';
    ctx.fillStyle = '#8a7a52';
    for (const entry of host.logLines.slice(0, 6)) {
      const lines = wrap(ctx, `${entry.time} ${entry.text}`, w);
      if (y + lines.length * 21 > CANVAS_H - 12) break;
      lines.forEach((line) => { ctx.fillText(line, x, y); y += 21; });
    }
    this.texture.needsUpdate = true;
  },
});

// ---------- tela inicial: SER O OPERADOR ----------
function setStatus(text) {
  const status = $('coop-status');
  if (status) status.textContent = text;
}

async function startOperator() {
  if (host || window.quantumCoop?.active) return;
  const button = $('coop-host');
  button.disabled = true;
  $('coop-connect').disabled = true;
  setStatus('ABRINDO A SALA...');
  try {
    await loadPeerJs();
  } catch (error) {
    setStatus(`ERRO: ${error.message}`);
    button.disabled = false;
    $('coop-connect').disabled = false;
    return;
  }
  window.quantumCoop = { active: true, role: 'operator', code: null, muted: false, toggleMute };
  setStatus('PERMITA O MICROFONE (VOZ E CONEXÃO NA MESMA REDE)...');
  const room = normalizeRoomCode(new URLSearchParams(location.search).get('sala'));
  host = await createCoopHost({
    ...(room.length === 4 ? { code: room } : {}),
    onChange: (kind, payload) => {
      if (kind === 'code') window.quantumCoop.code = payload;
      if (kind === 'log' && window.quantumPlayer?.active) hint(`OPERADOR — ${payload}`);
    },
  });
  window.quantumCoop.code = host.code;
  window.coopOperator = host;
  $('coop-voice').textContent = `VOZ: ${host.voice}`;
  setStatus(`SALA ${host.code} ABERTA — VOCÊ É O OPERADOR`);
  $('continue-game').hidden = true;
  // O painel do circuito e a string medida são do modo solo (quântico).
  scene().addEventListener('lobby-entered', () => {
    $('phase-telemetry').hidden = true;
    $('hud').hidden = true;
  });
  const entity = document.createElement('a-entity');
  entity.id = 'operator-lobby';
  entity.setAttribute('operator-lobby', '');
  scene().appendChild(entity);
  $('start-game').click();
  $('hud').hidden = true;
}

function bind() {
  $('coop-host')?.addEventListener('click', startOperator);
  // operador.html redireciona para cá com ?operador: abre o painel do duo.
  if (new URLSearchParams(location.search).has('operador')) {
    $('coop-panel').hidden = false;
    $('coop-host')?.focus();
  }
}

bind();
