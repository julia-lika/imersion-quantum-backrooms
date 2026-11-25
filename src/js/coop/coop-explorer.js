// Modo cooperativo, lado do EXPLORADOR (VR ou desktop). Liga a tela inicial ao
// operador: digita o código da sala, conecta, liga a voz e, dentro do jogo,
// manda a posição 10 vezes por segundo e aplica o que o operador decide.
import { createCoopLink, normalizeRoomCode } from './coop-net.js';

const PEERJS_URL = 'https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js';
const POS_MS = 100;
const $ = (id) => document.getElementById(id);

let link = null;
let posTimer = null;

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

function setStatus(text) {
  $('coop-status').textContent = text;
}

function game() {
  return window.quantumGame;
}

function sendPosition() {
  const tracker = $('player')?.components['xr-hands'];
  const world = window.quantumWorld;
  if (!link?.connected || !tracker || !world) return;
  const head = tracker.head.world;
  const forward = tracker.head.forward;
  const ghostEl = $('quantum-ghost');
  const ghost = ghostEl?.object3D.visible !== false && ghostEl
    ? {
      x: (ghostEl.object3D.position.x - world.origin) / world.cellSize,
      z: (ghostEl.object3D.position.z - world.origin) / world.cellSize,
    }
    : null;
  link.send({
    t: 'pos',
    x: (head.x - world.origin) / world.cellSize,
    z: (head.z - world.origin) / world.cellSize,
    dirX: forward.x,
    dirZ: forward.z,
    active: Boolean(window.quantumPlayer?.active) && window.quantumPlayer?.floor > 0,
    floor: window.quantumPlayer?.floor ?? 0,
    ghost,
  });
}

function handleMessage(message) {
  if (!message || typeof message !== 'object') return;
  switch (message.t) {
    case 'floor':
      window.quantumCoop.floor = message;
      if (game()?.started()) game().enterCoopFloor(message);
      setStatus(`CONECTADO À SALA ${link.code} — ANDAR ${String(message.floor).padStart(2, '0')} PRONTO. CLIQUE EM ENTRAR OU ENTRE EM VR`);
      $('start-game').textContent = 'ENTRAR COMO EXPLORADOR';
      break;
    case 'world':
      window.quantumCoop.floor = { ...window.quantumCoop.floor, ...message, t: 'floor' };
      game()?.applyCoopWorld(message);
      (message.fx || []).forEach((kind) => game()?.coopEffect(kind));
      break;
    case 'door':
      if (window.quantumCoop.floor) window.quantumCoop.floor = { ...window.quantumCoop.floor, door: message.index, doorBits: message.bits };
      game()?.coopDoorMeasured(message);
      break;
    case 'fx':
      game()?.coopEffect(message.kind);
      break;
    default:
      break;
  }
}

async function connect() {
  const code = normalizeRoomCode($('coop-code').value);
  if (code.length !== 4) {
    setStatus('O CÓDIGO TEM 4 LETRAS — está na tela do operador');
    return;
  }
  link?.close();
  $('coop-connect').disabled = true;
  setStatus('CONECTANDO...');
  try {
    await loadPeerJs();
  } catch (error) {
    setStatus(`ERRO: ${error.message}`);
    $('coop-connect').disabled = false;
    return;
  }
  link = createCoopLink({ role: 'guest', code });
  window.quantumCoop = {
    active: true,
    role: 'explorer',
    code,
    floor: null,
    send: (message) => link.send(message),
  };
  $('continue-game').hidden = true;
  link.on('status', setStatus);
  link.on('open', () => {
    setStatus(`CONECTADO À SALA ${code} — ESPERANDO O ANDAR`);
    link.send({ t: 'hello' });
    // A voz pede o microfone: o clique em CONECTAR já conta como gesto do usuário.
    link.startVoice();
    window.clearInterval(posTimer);
    posTimer = window.setInterval(sendPosition, POS_MS);
  });
  link.on('message', handleMessage);
  link.on('close', () => {
    setStatus('O OPERADOR DESCONECTOU');
    game()?.coopEffect?.('lost');
  });
  link.on('voice', ({ state, reason }) => {
    $('coop-voice').textContent = `VOZ: ${{ on: 'LIGADA', off: 'DESLIGADA', 'no-mic': 'SEM MICROFONE', blocked: 'BLOQUEADA' }[state] || state}${reason ? ` (${reason})` : ''}`;
  });
  link.on('error', (error) => {
    setStatus(`ERRO: ${error}`);
    $('coop-connect').disabled = false;
  });
}

function bind() {
  const panel = $('coop-panel');
  $('coop-open').addEventListener('click', () => {
    panel.hidden = !panel.hidden;
    if (!panel.hidden) $('coop-code').focus();
  });
  $('coop-connect').addEventListener('click', connect);
  $('coop-code').addEventListener('keydown', (event) => {
    if (event.key === 'Enter') connect();
  });
  // Mantém ?transporte=local no link do console (teste em duas abas).
  const local = new URLSearchParams(location.search).get('transporte') === 'local';
  if (local) $('coop-operator-link').href = 'operador.html?transporte=local';
  const room = normalizeRoomCode(new URLSearchParams(location.search).get('sala'));
  if (room.length === 4) {
    panel.hidden = false;
    $('coop-code').value = room;
  }
}

bind();
