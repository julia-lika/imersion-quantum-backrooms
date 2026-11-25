// Host do modo duo (o OPERADOR): roda o mundo e a IA (coop-world.js), conversa
// com o explorador pela rede (coop-net.js) e guarda o que as telas mostram
// (registro, avisos, recarga da varredura). Não desenha nada: o monitor do
// lobby (operator-lobby.js) lê o estado daqui.
import { createCoopWorld } from './coop-world.js?v=20261125-ai2';
import { createCoopLink, randomRoomCode, requestMicrophone } from './coop-net.js?v=20261125-4';

const TICK_MS = 200;

// No duo o andar é sorteado de forma clássica (o quântico é do modo solo).
function drawBits() {
  return Array.from({ length: 12 }, () => (Math.random() < 0.5 ? '0' : '1')).join('');
}

export function describeEvent(event) {
  switch (event.type) {
    case 'warn':
      return event.kind === 'cage'
        ? `IA VAI CERCAR O EXPLORADOR EM ${Math.round(event.ms / 1000)} s (${event.label})`
        : `IA vai fechar um corredor em ${event.label} em ${Math.round(event.ms / 1000)} s`;
    case 'trapped':
      return `A IA CERCOU O EXPLORADOR EM ${event.label}: Salto de Fase ou varredura`;
    case 'blocked':
      return `A IA fechou um corredor em ${event.label}`;
    case 'dodged':
      return `A IA tentou fechar ${event.label}, mas o explorador já tinha passado`;
    case 'expired':
      return `A parede da IA em ${event.label} se desfez`;
    case 'cancelled':
      return `Varredura cancelou a jogada da IA em ${event.label}`;
    case 'released':
      return event.reason === 'scan' ? 'Jaula desfeita pela varredura' : 'O explorador saltou para fora da jaula';
    case 'scanned':
      return 'Varredura feita: a IA perdeu a vez';
    default:
      return null;
  }
}

export async function createCoopHost({ code = randomRoomCode(), onChange = () => {} } = {}) {
  const world = createCoopWorld({ drawBits, now: performance.now() });
  const host = {
    world,
    link: null,
    code,
    status: 'ABRINDO A SALA...',
    voice: 'DESLIGADA',
    explorerActive: false,
    explorerMuted: false,
    muted: false,
    logLines: [],
    lastPosAt: 0,
    lastSentVersion: -1,
    mic: null,
  };

  function log(text) {
    host.logLines.unshift({ time: new Date().toLocaleTimeString('pt-BR'), text });
    host.logLines.length = Math.min(host.logLines.length, 40);
    onChange('log', text);
  }

  function send(message) {
    host.link?.send(message);
  }

  function sendFloor(reason) {
    host.lastSentVersion = world.state.version;
    send({ t: 'floor', reason, ...world.snapshot() });
  }

  function sendWorld(fx = []) {
    if (world.state.version === host.lastSentVersion && fx.length === 0) return;
    host.lastSentVersion = world.state.version;
    send({ t: 'world', fx, ...world.snapshot() });
  }

  function handleEvents(events) {
    const fx = [];
    events.forEach((event) => {
      const text = describeEvent(event);
      if (text) log(text);
      if (event.type === 'warn') onChange('warn', event);
      if (event.type === 'trapped') fx.push('trapped');
      if (event.type === 'blocked') fx.push('blocked');
      if (event.type === 'released') fx.push(event.reason === 'scan' ? 'released' : 'escaped');
    });
    sendWorld(fx);
  }

  function handleMessage(message) {
    if (!message || typeof message !== 'object') return;
    const now = performance.now();
    switch (message.t) {
      case 'hello':
        sendFloor('start');
        break;
      case 'pos': {
        if (![message.x, message.z, message.dirX, message.dirZ].every(Number.isFinite)) return;
        const wasActive = host.explorerActive;
        host.explorerActive = Boolean(message.active) && message.floor === world.state.floor;
        host.lastPosAt = now;
        const ghost = message.ghost && Number.isFinite(message.ghost.x) ? message.ghost : null;
        if (host.explorerActive) world.setExplorer({ x: message.x, z: message.z, dirX: message.dirX, dirZ: message.dirZ }, ghost);
        if (host.explorerActive && !wasActive) {
          world.startClock(now);
          log('O explorador entrou no andar');
        }
        break;
      }
      case 'stairs':
        if (world.nextFloor(now)) {
          host.explorerActive = false;
          log(`O explorador desceu: ANDAR ${String(world.state.floor).padStart(2, '0')}`);
          sendFloor('stairs');
        }
        break;
      case 'mute':
        host.explorerMuted = Boolean(message.muted);
        log(host.explorerMuted ? 'O explorador mutou o microfone' : 'O explorador abriu o microfone');
        break;
      case 'sanity-lost':
        world.restart(now);
        host.explorerActive = false;
        log('O explorador perdeu a sanidade: de volta ao ANDAR 01');
        sendFloor('sanity');
        break;
      default:
        break;
    }
  }

  function openRoom(roomCode) {
    host.code = roomCode;
    host.link = createCoopLink({ role: 'host', code: roomCode, stream: host.mic });
    const link = host.link;
    link.on('status', (text) => { host.status = text; });
    link.on('open', () => {
      host.status = 'EXPLORADOR CONECTADO';
      log('Explorador conectado');
      sendFloor('start');
    });
    link.on('close', () => {
      host.status = 'EXPLORADOR DESCONECTOU — ESPERANDO VOLTAR';
      host.explorerActive = false;
      log('Explorador desconectou');
    });
    link.on('message', handleMessage);
    link.on('voice', ({ state }) => {
      host.voice = { on: 'LIGADA', off: 'DESLIGADA', 'no-mic': 'SEM MICROFONE', blocked: 'BLOQUEADA' }[state] || state;
    });
    link.on('error', (error) => {
      if (error === 'código de sala em uso') {
        link.close();
        openRoom(randomRoomCode());
        onChange('code', host.code);
        return;
      }
      const text = error === 'webrtc' ? 'a conexão com o explorador não fechou (rede bloqueando)' : error;
      host.status = `TENTATIVA FALHOU: ${text} — A SALA CONTINUA ABERTA`;
      log(`Erro de conexão: ${text}`);
    });
  }

  host.connected = () => Boolean(host.link?.connected);
  host.playing = () => host.connected() && host.explorerActive && performance.now() - host.lastPosAt < 3000;
  host.scanCooldown = () => world.scanCooldown(performance.now());

  // VARREDURA: cancela a próxima jogada da IA e desfaz a jaula.
  host.scan = () => {
    if (!host.playing()) return { ok: false, reason: 'sem explorador no andar' };
    const result = world.scan(performance.now());
    if (!result.ok) return { ok: false, reason: 'recarregando' };
    send({ t: 'fx', kind: 'measure' });
    handleEvents(result.events);
    return { ok: true };
  };

  host.toggleMute = () => {
    host.muted = !host.muted;
    host.link?.setMuted(host.muted);
    return host.muted;
  };

  host.mic = await requestMicrophone();
  if (host.mic) host.voice = 'MICROFONE PRONTO';
  openRoom(code);
  log('Sala aberta. A IA começa a jogar uns 20 s depois que o explorador entrar no andar');
  window.setInterval(() => {
    if (host.playing()) handleEvents(world.update(performance.now()));
  }, TICK_MS);
  return host;
}
