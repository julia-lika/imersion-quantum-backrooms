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
export function createCoopLink({ role, code, transport = transportFromUrl() }) {
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

function peerLink(link, events) {
  if (typeof window.Peer !== 'function') {
    window.setTimeout(() => events.emit('error', 'PeerJS não carregou (sem internet?)'), 0);
    return link;
  }
  const hostId = peerIdFor(link.code);
  const peer = link.role === 'host' ? new window.Peer(hostId) : new window.Peer();
  let connection = null;
  let localStream = null;
  let call = null;
  const audio = new Audio();
  audio.autoplay = true;

  function attach(conn) {
    if (connection && connection !== conn) connection.close();
    connection = conn;
    conn.on('open', () => {
      link.connected = true;
      events.emit('open');
    });
    conn.on('data', (payload) => events.emit('message', payload));
    conn.on('close', () => {
      if (connection !== conn) return;
      link.connected = false;
      events.emit('close');
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

  peer.on('open', () => {
    events.emit('status', link.role === 'host' ? 'SALA ABERTA — ESPERANDO O EXPLORADOR' : 'PROCURANDO A SALA');
    if (link.role === 'guest') attach(peer.connect(hostId, { reliable: true }));
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
    else if (type === 'peer-unavailable') events.emit('error', 'sala não encontrada: confira o código');
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
    call?.close();
    connection?.close();
    peer.destroy();
  };
  window.addEventListener('beforeunload', link.close);
  return link;
}
