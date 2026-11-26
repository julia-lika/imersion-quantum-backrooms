// Conexão do modo cooperativo: navegador a navegador (WebRTC), sem servidor
// próprio. O PeerJS usa o serviço público de pareamento só para os dois se
// acharem pelo código da sala; dados e voz vão direto entre os dois.
//
// Transporte "local" (?transporte=local): duas abas do mesmo navegador
// conversam por BroadcastChannel. Serve para testar sem rede (sem voz).

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const PEER_PREFIX = 'quantum-backrooms-sala-';

export function randomRoomCode(random = Math.random) {
  return Array.from({ length: 4 }, () => ALPHABET[Math.floor(random() * ALPHABET.length)]).join('');
}

export function normalizeRoomCode(value) {
  return String(value || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4);
}

export function peerIdFor(code) {
  return `${PEER_PREFIX}${normalizeRoomCode(code).toLowerCase()}`;
}

function emitter() {
  const handlers = {};
  return {
    on(name, handler) {
      (handlers[name] ||= []).push(handler);
    },
    emit(name, payload) {
      (handlers[name] || []).forEach((handler) => {
        try {
          handler(payload);
        } catch (error) {
          console.error('[coop]', error);
        }
      });
    },
  };
}

function transportFromUrl() {
  return new URLSearchParams(location.search).get('transporte') === 'local' ? 'local' : 'peer';
}

// role: 'host' (operador) ou 'guest' (explorador).
export function createCoopLink({ role, code, transport = transportFromUrl(), stream = null }) {
  const events = emitter();
  const link = {
    role,
    code: normalizeRoomCode(code),
    transport,
    connected: false,
    on: events.on,
    send: () => {},
    startVoice: async () => false,
    setMuted: () => {},
    close: () => {},
    stream,
  };
  if (transport === 'local') return localLink(link, events);
  return peerLink(link, events);
}

function localLink(link, events) {
  const channel = new BroadcastChannel(`quantum-backrooms-coop-${link.code}`);
  const me = link.role;
  channel.onmessage = ({ data }) => {
    if (!data || data.from === me) return;
    if (data.kind === 'hello' && !link.connected) {
      link.connected = true;
      channel.postMessage({ from: me, kind: 'hello' });
      events.emit('open');
      return;
    }
    if (data.kind === 'bye') {
      link.connected = false;
      events.emit('close');
      return;
    }
    if (data.kind === 'msg') events.emit('message', data.payload);
  };
  link.send = (payload) => channel.postMessage({ from: me, kind: 'msg', payload });
  link.close = () => {
    channel.postMessage({ from: me, kind: 'bye' });
    channel.close();
  };
  window.addEventListener('beforeunload', link.close);
  events.emit('status', me === 'host' ? 'SALA ABERTA (TESTE LOCAL)' : 'PROCURANDO A SALA (TESTE LOCAL)');
  window.setTimeout(() => channel.postMessage({ from: me, kind: 'hello' }), 50);
  link.startVoice = async () => {
    events.emit('voice', { state: 'off', reason: 'teste local não tem voz' });
    return false;
  };
  return link;
}

// Servidores ICE: STUN descobre o endereço público de cada aparelho; TURN
// retransmite quando a conexão direta não fecha (NAT restrito, rede da
// faculdade, Wi-Fi com isolamento de clientes). Um TURN próprio pode ser passado
// pela URL: ?turn=turn:host:3478&turnuser=USUARIO&turnpass=SENHA (nos dois lados).
export function iceServersFromUrl(search = globalThis.location?.search || '') {
  const params = new URLSearchParams(search);
  const servers = [
    { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
    { urls: 'stun:stun.cloudflare.com:3478' },
    // TURN público do próprio PeerJS (gratuito, sem garantia de estar no ar).
    {
      urls: ['turn:eu-0.turn.peerjs.com:3478', 'turn:us-0.turn.peerjs.com:3478'],
      username: 'peerjs',
      credential: 'peerjsp',
    },
  ];
  const turn = params.get('turn');
  if (turn) {
    servers.unshift({ urls: turn.split(','), username: params.get('turnuser') || '', credential: params.get('turnpass') || '' });
  }
  return servers;
}

// Pede o microfone ANTES de abrir a conexão. Além da voz, isso ajuda a conexão
// na mesma rede: com o microfone liberado, o navegador mostra os endereços
// locais de verdade em vez de nomes .local, que o Quest nem sempre resolve.
// Não espera para sempre: sem resposta em `ms`, segue sem microfone.
export async function requestMicrophone(ms = 8000) {
  if (!navigator.mediaDevices?.getUserMedia) return null;
  const ask = navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    video: false,
  }).catch(() => null);
  const timer = new Promise((resolve) => { window.setTimeout(() => resolve(null), ms); });
  return Promise.race([ask, timer]);
}

// Quanto tempo o explorador espera a conexão abrir antes de desistir.
export const CONNECT_TIMEOUT_MS = 20000;

const ICE_LABELS = {
  new: 'iniciando',
  checking: 'negociando a rota entre os aparelhos',
  connected: 'rota encontrada',
  completed: 'rota encontrada',
  disconnected: 'rota caiu, tentando de novo',
  failed: 'nenhuma rota entre os aparelhos',
  closed: 'fechada',
};

function peerLink(link, events) {
  if (typeof window.Peer !== 'function') {
    window.setTimeout(() => events.emit('error', 'PeerJS não carregou (sem internet?)'), 0);
    return link;
  }
  const hostId = peerIdFor(link.code);
  const options = { config: { iceServers: iceServersFromUrl(), sdpSemantics: 'unified-plan' }, debug: 1 };
  // Servidor de pareamento próprio (testes): ?peerserver=localhost:9000/myapp
  const server = new URLSearchParams(location.search).get('peerserver');
  if (server) {
    const [hostPort, ...path] = server.split('/');
    const [host, port] = hostPort.split(':');
    Object.assign(options, { host, port: Number(port) || 443, path: `/${path.join('/')}`, secure: location.protocol === 'https:' });
  }
  const peer = link.role === 'host' ? new window.Peer(hostId, options) : new window.Peer(options);
  let connection = null;
  let localStream = link.stream;
  let call = null;
  let timeout = null;
  let iceState = null;
  let extended = false;
  const audio = new Audio();
  audio.autoplay = true;

  // Mostra em que pé está a negociação WebRTC (ajuda a saber se o problema é
  // o código da sala ou a rede).
  function watchIce(conn) {
    let tries = 0;
    const hook = () => {
      const pc = conn.peerConnection;
      if (!pc) {
        if (tries++ < 50) window.setTimeout(hook, 100);
        return;
      }
      const report = () => {
        const state = pc.iceConnectionState;
        iceState = state;
        events.emit('ice', state);
        if (!link.connected) {
          events.emit('status', link.role === 'host'
            ? `EXPLORADOR TENTANDO CONECTAR — ${ICE_LABELS[state] || state}`
            : `CHAMANDO A SALA — ${ICE_LABELS[state] || state}`);
        }
        if (state === 'failed' && !link.connected) {
          fail('nenhuma rota entre os aparelhos (a rede bloqueou a conexão direta). Tente os dois no mesmo Wi-Fi, ou o PC no roteador do celular');
        }
      };
      pc.addEventListener('iceconnectionstatechange', report);
      report();
    };
    hook();
  }

  function fail(reason) {
    window.clearTimeout(timeout);
    timeout = null;
    if (connection && !link.connected) {
      const stale = connection;
      connection = null;
      stale.close();
    }
    events.emit('error', reason);
  }

  function attach(conn) {
    if (connection && connection !== conn) connection.close();
    connection = conn;
    watchIce(conn);
    conn.on('open', () => {
      window.clearTimeout(timeout);
      timeout = null;
      link.connected = true;
      events.emit('open');
    });
    conn.on('data', (payload) => events.emit('message', payload));
    conn.on('close', () => {
      if (connection !== conn) return;
      const was = link.connected;
      link.connected = false;
      if (was) events.emit('close');
    });
    conn.on('error', (error) => events.emit('error', String(error?.type || error)));
  }

  function playRemote(remoteCall) {
    call = remoteCall;
    remoteCall.on('stream', (stream) => {
      audio.srcObject = stream;
      audio.play().catch(() => events.emit('voice', { state: 'blocked', reason: 'clique na página para liberar o áudio' }));
      events.emit('voice', { state: 'on' });
    });
    remoteCall.on('close', () => events.emit('voice', { state: 'off', reason: 'chamada encerrada' }));
  }

  async function microphone() {
    if (localStream) return localStream;
    localStream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      video: false,
    });
    return localStream;
  }

  // O explorador fica esperando no máximo CONNECT_TIMEOUT_MS, contados desde o
  // pedido ao servidor de pareamento.
  if (link.role === 'guest') {
    const onTimeout = () => {
      if (link.connected) return;
      // Ainda negociando a rota (às vezes o TURN demora): espera mais 20 s, uma vez.
      if (iceState === 'checking' && !extended) {
        extended = true;
        events.emit('status', 'CHAMANDO A SALA — a rota está demorando, esperando mais 20 s');
        timeout = window.setTimeout(onTimeout, CONNECT_TIMEOUT_MS);
        return;
      }
      let reason = 'o servidor de pareamento não respondeu em 20 s (sem internet ou bloqueado nesta rede)';
      if (peer.open && (!iceState || iceState === 'new')) {
        reason = 'o operador não respondeu: confira se ele clicou em SER O OPERADOR e está com a sala aberta, e recarregue as duas páginas (Ctrl+Shift+R)';
      } else if (peer.open) {
        reason = 'a sala respondeu, mas a rede não deixou a conexão fechar (Wi-Fi bloqueando WebRTC). Tente os dois no mesmo Wi-Fi ou o PC no roteador do celular. No mesmo navegador, use duas abas com ?transporte=local';
      }
      fail(reason);
    };
    timeout = window.setTimeout(onTimeout, CONNECT_TIMEOUT_MS);
  }

  peer.on('open', () => {
    events.emit('status', link.role === 'host' ? 'SALA ABERTA — ESPERANDO O EXPLORADOR' : 'PROCURANDO A SALA');
    // JSON puro: as mensagens já são objetos simples; evita o empacotamento
    // binário, que dá problema em alguns navegadores.
    if (link.role === 'guest' && !connection) attach(peer.connect(hostId, { reliable: true, serialization: 'json' }));
  });
  peer.on('connection', (conn) => {
    if (link.role === 'host') attach(conn);
  });
  // O operador atende a chamada de voz do explorador com o próprio microfone.
  peer.on('call', async (incoming) => {
    try {
      incoming.answer(await microphone());
    } catch {
      incoming.answer();
      events.emit('voice', { state: 'no-mic', reason: 'microfone negado: você ouve, mas não fala' });
    }
    playRemote(incoming);
  });
  peer.on('error', (error) => {
    const type = error?.type || String(error);
    if (type === 'unavailable-id') events.emit('error', 'código de sala em uso');
    else if (type === 'peer-unavailable') fail('sala não encontrada: confira o código e se o console do operador continua aberto');
    else if (type === 'network' || type === 'server-error' || type === 'socket-error') fail('sem contato com o servidor de pareamento (internet ou rede bloqueando)');
    else events.emit('error', type);
  });
  peer.on('disconnected', () => peer.reconnect?.());

  link.send = (payload) => {
    if (connection?.open) connection.send(payload);
  };
  // O explorador liga para o operador (o operador atende em peer.on('call')).
  link.startVoice = async () => {
    let stream;
    try {
      stream = await microphone();
    } catch {
      events.emit('voice', { state: 'no-mic', reason: 'microfone negado' });
      return false;
    }
    if (link.role === 'guest') playRemote(peer.call(hostId, stream));
    return true;
  };
  link.setMuted = (muted) => {
    localStream?.getAudioTracks().forEach((track) => { track.enabled = !muted; });
  };
  link.close = () => {
    window.clearTimeout(timeout);
    call?.close();
    connection?.close();
    peer.destroy();
  };
  window.addEventListener('beforeunload', link.close);
  return link;
}
