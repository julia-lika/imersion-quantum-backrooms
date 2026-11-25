// Console do operador (desktop): é o host do modo cooperativo. Roda o mundo
// (coop-world.js), desenha o mapa completo do QPS e manda as mudanças para o
// explorador. Não tem visão de corredor: só o mapa, os avisos e a voz.
import '../map-generator.js';
import '../quantum-bank.js';
import { createCoopWorld } from './coop-world.js';
import { createCoopLink, normalizeRoomCode, randomRoomCode, requestMicrophone } from './coop-net.js?v=20261125-4';

const TICK_MS = 200;
const $ = (id) => document.getElementById(id);
const canvas = $('map');
const ctx = canvas.getContext('2d');

let world = null;
let link = null;
let explorerActive = false;
let lastSentVersion = -1;
let lastPosAt = 0;
let muted = false;
const alerts = new Map();

function log(text) {
  const item = document.createElement('li');
  const time = document.createElement('time');
  time.textContent = new Date().toLocaleTimeString('pt-BR');
  item.append(time, text);
  $('log').prepend(item);
  while ($('log').children.length > 60) $('log').lastChild.remove();
}

function drawBits(floor) {
  return window.drawFloorBitstring?.(floor) || window.sampleQuantumBitstring?.() || '010110101100';
}

function send(message) {
  link?.send(message);
}

function sendFloor(reason) {
  lastSentVersion = world.state.version;
  send({ t: 'floor', reason, ...world.snapshot() });
}

function sendWorld(fx = []) {
  if (world.state.version === lastSentVersion && fx.length === 0) return;
  lastSentVersion = world.state.version;
  send({ t: 'world', fx, ...world.snapshot() });
}

function setAlert(id, text, kind) {
  if (!text) {
    alerts.get(id)?.remove();
    alerts.delete(id);
    return;
  }
  let el = alerts.get(id);
  if (!el) {
    el = document.createElement('div');
    $('alerts').append(el);
    alerts.set(id, el);
  }
  el.className = `alert ${kind || ''}`;
  el.textContent = text;
}

function describe(event) {
  switch (event.type) {
    case 'warn':
      return event.trap
        ? `⚠ ${event.label} VAI COLAPSAR EM ${Math.round(event.ms / 1000)} s — o explorador está nesse trecho: tire-o de lá ou meça`
        : `${event.label} vai se reorganizar em ${Math.round(event.ms / 1000)} s`;
    case 'trapped':
      return `✖ ${event.label} COLAPSOU EM VOLTA DO EXPLORADOR — preso: Salto de Fase (palmas na parede / X) ou meça de novo`;
    case 'dodged':
      return `${event.label} colapsou, mas o explorador saiu a tempo`;
    case 'collapse':
      return `${event.label} se reorganizou (${event.changed} células)`;
    case 'cancelled':
      return event.reason === 'measured'
        ? `${event.label}: colapso cancelado pela medição`
        : `${event.label}: o explorador estava olhando, nada mudou`;
    case 'released':
      return event.reason === 'measured' ? 'Jaula desfeita pela medição' : 'O explorador saltou para fora da jaula';
    case 'door':
      return `PORTA MEDIDA — posição ${event.index + 1}/${event.total} (ciano no mapa)`;
    case 'measured':
      return `QPS mediu: ${event.regions.join(', ') || 'nada no raio'}`;
    default:
      return null;
  }
}

function handleEvents(events) {
  const fx = [];
  events.forEach((event) => {
    const text = describe(event);
    if (text) log(text);
    if (event.type === 'trapped') fx.push('trapped');
    if (event.type === 'collapse' || event.type === 'dodged') fx.push('shift');
    if (event.type === 'released') fx.push(event.reason === 'measured' ? 'released' : 'escaped');
    if (event.type === 'door') send({ t: 'door', index: event.index, bits: event.bits });
  });
  sendWorld(fx);
}

function tick() {
  if (!world) return;
  const now = performance.now();
  if (link?.connected && explorerActive && now - lastPosAt < 3000) {
    handleEvents(world.update(now));
  }
  renderPanel(now);
}

function measure() {
  if (!world || !explorerActive) return;
  const result = world.measure(performance.now());
  if (!result.ok) return;
  send({ t: 'fx', kind: 'measure' });
  handleEvents(result.events);
}

function renderPanel(now) {
  const state = world.state;
  $('floor').textContent = String(state.floor).padStart(2, '0');
  $('bits').textContent = state.bitstring;
  $('door').textContent = state.measured
    ? `MEDIDA (${state.door + 1}/${state.doorCandidates.length})`
    : `EM SUPERPOSIÇÃO ENTRE ${state.doorCandidates.length} POSIÇÕES`;
  const explorer = state.explorer;
  const region = explorer && state.regions.find((r) => explorer.x >= r.minX - 0.5 && explorer.x <= r.maxX + 0.5 && explorer.z >= r.minZ - 0.5 && explorer.z <= r.maxZ + 0.5);
  $('where').textContent = explorer ? (region?.label || 'PASSAGEM') : '--';
  const cooldown = world.measureCooldown(now);
  $('measure').disabled = cooldown > 0 || !explorerActive;
  $('measure').textContent = cooldown > 0 ? `RECARREGANDO ${Math.ceil(cooldown / 1000)} s` : 'MEDIR COM O QPS (ESPAÇO)';
  $('measure-bar').firstElementChild.style.width = `${100 - (cooldown / 20000) * 100}%`;

  const pendingIds = new Set();
  state.pending.forEach((item) => {
    const id = `pending-${item.regionId}`;
    pendingIds.add(id);
    const left = Math.max(0, (item.at - now) / 1000).toFixed(1);
    setAlert(id, item.trap ? `⚠ ${item.label} COLAPSA EM ${left} s — EXPLORADOR DENTRO` : `${item.label} reorganiza em ${left} s`, item.trap ? 'trap' : '');
  });
  [...alerts.keys()].filter((id) => id.startsWith('pending-') && !pendingIds.has(id)).forEach((id) => setAlert(id, null));
  setAlert('cage', state.cage ? 'EXPLORADOR PRESO — peça o Salto de Fase (palmas numa parede da jaula) ou meça' : null, 'caged');
  $('waiting').hidden = Boolean(link?.connected && explorerActive);
  if (link?.connected && !explorerActive) $('waiting').innerHTML = 'EXPLORADOR CONECTADO<br /><br />ESPERANDO ELE ENTRAR NO JOGO';
}

// ---------- mapa ----------
function draw(now) {
  window.requestAnimationFrame(draw);
  if (!world) return;
  const state = world.state;
  const size = state.size;
  const cell = canvas.width / size;
  const px = (x) => x * cell + cell / 2;
  ctx.fillStyle = '#020201';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let z = 0; z < size; z += 1) {
    for (let x = 0; x < size; x += 1) {
      const solid = state.maze[z][x] === '#';
      const superposed = state.superposed.has(`${x},${z}`);
      if (superposed) {
        ctx.fillStyle = `rgba(196, 92, 255, ${0.55 + 0.3 * Math.sin(now / 300 + (state.superposed.get(`${x},${z}`) || 0))})`;
        ctx.fillRect(x * cell + 1, z * cell + 1, cell - 2, cell - 2);
      } else if (solid) {
        ctx.fillStyle = '#8a7444';
        ctx.fillRect(x * cell, z * cell, cell, cell);
      } else {
        ctx.fillStyle = '#14120a';
        ctx.fillRect(x * cell + 0.5, z * cell + 0.5, cell - 1, cell - 1);
      }
    }
  }

  // Colapsos pendentes: o trecho pisca em laranja (ou vermelho, armadilha).
  state.pending.forEach((item) => {
    const region = state.regions.find((r) => r.id === item.regionId);
    if (!region) return;
    const total = item.at - item.since;
    const progress = Math.min(1, Math.max(0, 1 - (item.at - performance.now()) / total));
    const pulse = 0.25 + 0.25 * Math.sin(now / (item.trap ? 90 : 180)) + progress * 0.25;
    ctx.fillStyle = item.trap ? `rgba(255, 40, 60, ${pulse})` : `rgba(255, 170, 60, ${pulse * 0.6})`;
    ctx.fillRect(region.minX * cell, region.minZ * cell, (region.maxX - region.minX + 1) * cell, (region.maxZ - region.minZ + 1) * cell);
  });

  // Jaula: contorno vermelho.
  if (state.cage) {
    const { x, z } = state.cage.center;
    ctx.strokeStyle = '#ff4d5e';
    ctx.lineWidth = 3;
    ctx.setLineDash([]);
    ctx.strokeRect((x - 2) * cell, (z - 2) * cell, cell * 5, cell * 5);
  }

  // Regiões (um qubit cada): rótulo e tipo.
  ctx.font = `bold ${Math.round(cell * 0.62)}px "Courier New", monospace`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  state.regions.forEach((region) => {
    ctx.strokeStyle = 'rgba(57, 255, 136, 0.18)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(region.minX * cell, region.minZ * cell, (region.maxX - region.minX + 1) * cell, (region.maxZ - region.minZ + 1) * cell);
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(57, 255, 136, 0.75)';
    ctx.fillText(region.label, region.minX * cell + 4, region.minZ * cell + 3);
    ctx.fillStyle = 'rgba(57, 255, 136, 0.4)';
    ctx.font = `${Math.round(cell * 0.42)}px "Courier New", monospace`;
    ctx.fillText(region.bit === '1' ? 'q=1 sala' : 'q=0 corr.', region.minX * cell + 4, region.minZ * cell + cell * 0.75);
    ctx.font = `bold ${Math.round(cell * 0.62)}px "Courier New", monospace`;
  });

  // Porta: posições possíveis (amarelo tracejado) ou a medida (ciano).
  state.doorCandidates.forEach((door, index) => {
    const chosen = state.measured && index === state.door;
    if (state.measured && !chosen) return;
    ctx.strokeStyle = chosen ? '#44ffcc' : '#ffd23c';
    ctx.fillStyle = chosen ? 'rgba(68, 255, 204, 0.35)' : 'rgba(255, 210, 60, 0.12)';
    ctx.lineWidth = chosen ? 3 : 2;
    ctx.setLineDash(chosen ? [] : [5, 4]);
    ctx.beginPath();
    ctx.arc(px(door.x), px(door.z), cell * 0.42, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.setLineDash([]);
  });

  const explorer = state.explorer;
  if (explorer) {
    const ex = px(explorer.x);
    const ez = px(explorer.z);
    // Raio do QPS.
    ctx.strokeStyle = 'rgba(68, 255, 204, 0.35)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([3, 5]);
    ctx.beginPath();
    ctx.arc(ex, ez, 4 * cell, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    // Cone de visão (para dizer "à sua esquerda" / "atrás de você").
    const angle = Math.atan2(explorer.dirZ, explorer.dirX);
    ctx.fillStyle = 'rgba(57, 255, 136, 0.12)';
    ctx.beginPath();
    ctx.moveTo(ex, ez);
    ctx.arc(ex, ez, cell * 3.2, angle - 0.6, angle + 0.6);
    ctx.closePath();
    ctx.fill();
    // Seta.
    ctx.save();
    ctx.translate(ex, ez);
    ctx.rotate(angle);
    ctx.fillStyle = '#39ff88';
    ctx.beginPath();
    ctx.moveTo(cell * 0.55, 0);
    ctx.lineTo(-cell * 0.35, cell * 0.32);
    ctx.lineTo(-cell * 0.2, 0);
    ctx.lineTo(-cell * 0.35, -cell * 0.32);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // Entidade: o QPS só a detecta dentro do raio de medição.
  const ghost = state.ghost;
  if (ghost && explorer && Math.hypot(ghost.x - explorer.x, ghost.z - explorer.z) <= 4) {
    ctx.fillStyle = `rgba(255, 60, 80, ${0.6 + 0.4 * Math.sin(now / 120)})`;
    ctx.beginPath();
    ctx.arc(px(ghost.x), px(ghost.z), cell * 0.36, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ---------- rede ----------
function handleMessage(message) {
  if (!message || typeof message !== 'object') return;
  const now = performance.now();
  switch (message.t) {
    case 'hello':
      sendFloor('start');
      break;
    case 'pos': {
      if (![message.x, message.z, message.dirX, message.dirZ].every(Number.isFinite)) return;
      const wasActive = explorerActive;
      explorerActive = Boolean(message.active) && message.floor === world.state.floor;
      lastPosAt = now;
      const ghost = message.ghost && Number.isFinite(message.ghost.x) ? message.ghost : null;
      if (explorerActive) world.setExplorer({ x: message.x, z: message.z, dirX: message.dirX, dirZ: message.dirZ }, ghost);
      if (explorerActive && !wasActive) {
        world.startClock(now);
        log('O explorador entrou no andar');
      }
      break;
    }
    case 'stairs':
      if (world.nextFloor(now)) {
        explorerActive = false;
        log(`O explorador desceu: ANDAR ${String(world.state.floor).padStart(2, '0')}`);
        sendFloor('stairs');
      }
      break;
    case 'sanity-lost':
      world.restart(now);
      explorerActive = false;
      log('O explorador perdeu a sanidade: de volta ao ANDAR 01');
      sendFloor('sanity');
      break;
    default:
      break;
  }
}

let micStream = null;

function openRoom(code) {
  $('room-code').textContent = code;
  const params = new URLSearchParams(location.search);
  params.set('sala', code);
  history.replaceState(null, '', `${location.pathname}?${params}`);
  link = createCoopLink({ role: 'host', code, stream: micStream });
  link.on('status', (text) => { $('link-status').textContent = text; });
  link.on('open', () => {
    $('link-status').textContent = 'EXPLORADOR CONECTADO';
    log('Explorador conectado');
    sendFloor('start');
  });
  link.on('close', () => {
    $('link-status').textContent = 'EXPLORADOR DESCONECTOU — ESPERANDO VOLTAR';
    explorerActive = false;
    log('Explorador desconectou');
  });
  link.on('message', handleMessage);
  link.on('voice', ({ state, reason }) => {
    $('voice-status').textContent = `VOZ: ${{ on: 'LIGADA', off: 'DESLIGADA', 'no-mic': 'SEM MICROFONE', blocked: 'BLOQUEADA' }[state] || state}${reason ? ` (${reason})` : ''}`;
    if (state === 'on') $('mute').disabled = false;
  });
  link.on('error', (error) => {
    if (error === 'código de sala em uso') {
      link.close();
      openRoom(randomRoomCode());
      return;
    }
    // A sala continua aberta: o explorador pode tentar de novo.
    const text = error === 'webrtc' ? 'a conexão com o explorador não fechou (rede bloqueando)' : error;
    $('link-status').textContent = `TENTATIVA FALHOU: ${text} — A SALA CONTINUA ABERTA`;
    log(`Erro de conexão: ${text}`);
  });
}

function bindUi() {
  $('measure').addEventListener('click', measure);
  $('mic').addEventListener('click', async () => {
    const ok = await link?.startVoice();
    $('mic').textContent = ok ? 'MICROFONE LIGADO' : 'SEM MICROFONE';
    $('mute').disabled = !ok;
  });
  const toggleMute = () => {
    muted = !muted;
    link?.setMuted(muted);
    $('mute').textContent = muted ? 'DESMUTAR (V)' : 'MUTAR (V)';
  };
  $('mute').addEventListener('click', toggleMute);
  document.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    if (event.code === 'Space') {
      event.preventDefault();
      measure();
    }
    if (event.code === 'KeyV' && !$('mute').disabled) toggleMute();
  });
}

async function start() {
  await window.quantumBank?.ready;
  world = createCoopWorld({ drawBits, now: performance.now() });
  window.coopOperator = { world: () => world, link: () => link };
  bindUi();
  $('link-status').textContent = 'PERMITA O MICROFONE (VOZ E CONEXÃO NA MESMA REDE)...';
  micStream = await requestMicrophone();
  if (micStream) {
    $('mic').textContent = 'MICROFONE LIGADO';
    $('mute').disabled = false;
  }
  const code = normalizeRoomCode(new URLSearchParams(location.search).get('sala'));
  openRoom(code.length === 4 ? code : randomRoomCode());
  log(`Andar ${String(world.state.floor).padStart(2, '0')} gerado da string ${world.state.bitstring}`);
  window.setInterval(tick, TICK_MS);
  window.requestAnimationFrame(draw);
}

start();
