// Labirinto em tempo real: trechos que ninguém observa há algum tempo voltam à
// superposição e se reorganizam (ver js/decoherence.js). O que o jogador está
// vendo nunca muda; a troca vem com um aviso sutil (luz que oscila e zumbido).
import {
  NEAR_CELLS,
  UNOBSERVED_MS,
  SHIFT_COOLDOWN_MS,
  isSectorObserved,
  reshuffleSector,
  pickSectorSuperposed,
} from '../decoherence.js';
import { listRegions } from '../qubit-regions.js';

const CHECK_MS = 200;
const HINT_LIMIT = 2;

AFRAME.registerComponent('maze-decoherence', {
  schema: {
    rig: { type: 'selector', default: '#player' },
    enabled: { type: 'boolean', default: true },
  },

  init() {
    this.lastCheck = 0;
    this.lastShift = 0;
    this.shifts = 0;
    this.hints = 0;
    this.reset();
    this.onWorld = () => this.reset();
    this.el.sceneEl.addEventListener('maze-world-updated', this.onWorld);
    window.quantumDecoherence = {
      sectors: () => this.sectors,
      versions: () => ({ ...this.versions }),
      stats: () => ({ shifts: this.shifts, unseen: this.unseenSeconds() }),
      // Para testes: força a troca do setor mais esquecido, se puder.
      forceShift: (id) => this.shiftOne(performance.now(), true, id),
    };
  },

  remove() {
    this.el.sceneEl.removeEventListener('maze-world-updated', this.onWorld);
  },

  // Mapa novo (andar novo ou lobby): todos os setores começam "vistos agora".
  reset() {
    const world = window.quantumWorld;
    const now = performance.now();
    // Um setor por qubit: as 12 regiões da grade 3x4.
    this.sectors = world ? listRegions(world.size) : [];
    this.lastSeen = Object.fromEntries(this.sectors.map((sector) => [sector.id, now]));
    this.versions = Object.fromEntries(this.sectors.map((sector) => [sector.id, 0]));
    this.lastShift = now;
  },

  unseenSeconds() {
    const now = performance.now();
    return Object.fromEntries(Object.entries(this.lastSeen).map(([id, t]) => [id, Math.round((now - t) / 1000)]));
  },

  viewer() {
    const tracker = this.data.rig?.components['xr-hands'];
    const world = window.quantumWorld;
    if (!tracker || !world) return null;
    const { world: head, forward } = tracker.head;
    return {
      x: (head.x - world.origin) / world.cellSize,
      z: (head.z - world.origin) / world.cellSize,
      dirX: forward.x,
      dirZ: forward.z,
    };
  },

  tick(time) {
    if (!this.data.enabled || time - this.lastCheck < CHECK_MS) return;
    this.lastCheck = time;
    const world = window.quantumWorld;
    const player = window.quantumPlayer;
    // Lobby é fixo; pausa, menu e transição também congelam o labirinto.
    if (!world || !player?.active || !player.floor) return;

    const viewer = this.viewer();
    if (!viewer) return;
    const now = performance.now();
    const options = this.observeOptions(world);
    this.sectors.forEach((sector) => {
      if (isSectorObserved(world.maze, sector, viewer, options)) this.lastSeen[sector.id] = now;
    });
    this.viewerCache = viewer;
    if (now - this.lastShift >= SHIFT_COOLDOWN_MS) this.shiftOne(now);
  },

  // Efeito Zeno: o QPS mede sem parar tudo no raio dele, então nada ali evolui.
  // Os olhos também medem (campo de visão com linha de visão livre).
  observeOptions(world) {
    const player = window.quantumPlayer;
    return {
      transparent: (x, z) => world.superposed.has(`${x},${z}`),
      near: player?.hasQps ? Math.max(NEAR_CELLS, player.qpsRadius ?? 4) : NEAR_CELLS,
    };
  },

  protectedCells() {
    const world = window.quantumWorld;
    const mapEl = this.el.components['quantum-map'];
    const cells = [];
    // Porta medida: só a célula dela. Ainda indefinida: todas as posições possíveis.
    const info = mapEl?.mapInfo;
    const doors = mapEl?.data.stairsVisible || !info?.doorCandidates?.length ? [info?.stairs] : info.doorCandidates;
    doors.forEach((door) => door && cells.push({ x: door.x, z: door.z }));
    (mapEl?.itemCells || []).forEach((cell) => cell && cells.push(cell));
    const ghost = document.querySelector('[quantum-ghost]');
    if (ghost && world) {
      const position = ghost.object3D.position;
      cells.push(window.quantumPhysics.worldToCell(world, position.x, position.z));
    }
    if (this.viewerCache) cells.push({ x: Math.round(this.viewerCache.x), z: Math.round(this.viewerCache.z) });
    return cells;
  },

  shiftOne(now, force = false, onlyId = null) {
    const world = window.quantumWorld;
    const mapComponent = this.el.components['quantum-map'];
    const viewer = this.viewerCache || this.viewer();
    if (!world || !mapComponent || !viewer) return null;

    const options = this.observeOptions(world);
    const candidates = this.sectors
      .filter((sector) => !onlyId || sector.id === onlyId)
      .filter((sector) => force || now - this.lastSeen[sector.id] >= UNOBSERVED_MS)
      // Confere de novo na hora da troca: nada muda diante dos olhos nem
      // dentro do raio do QPS.
      .filter((sector) => !isSectorObserved(world.maze, sector, viewer, options))
      .sort((a, b) => this.lastSeen[a.id] - this.lastSeen[b.id]);
    const sector = candidates[0];
    if (!sector) return null;

    const floor = window.quantumPlayer?.floor ?? 1;
    const bitstring = window.drawFloorBitstring?.(floor) || '010110101100';
    const changed = reshuffleSector(world.maze, sector, bitstring, {
      protectedCells: this.protectedCells(),
      salt: this.shifts + 1,
    });
    this.lastShift = now;
    this.lastSeen[sector.id] = now;
    if (changed.length === 0) return null;

    // O mini-quadro do HUD passa a mostrar o bit novo desta região.
    const region = mapComponent.mapInfo?.regions?.[sector.qubit];
    if (region) {
      region.bit = bitstring[sector.qubit];
      region.type = region.bit === '1' ? 'sala aberta' : 'corredores';
    }
    const superposed = pickSectorSuperposed(world.maze, sector, bitstring, 1);
    mapComponent.applySectorChange(sector, superposed);
    this.shifts += 1;
    this.versions[sector.id] += 1;
    this.el.sceneEl.emit('maze-region-shifted', { sector, bitstring, changed: changed.length });
    this.signal();
    return { sector, bitstring, changed: changed.length };
  },

  // Aviso sutil: as luzes oscilam de leve e um zumbido grave passa.
  signal() {
    const scene = this.el.sceneEl;
    scene.emit('screen-effect', { type: 'flash', color: '#000000', duration: 650, peak: 0.28 });
    this.hum();
    if (this.hints < HINT_LIMIT) {
      this.hints += 1;
      scene.emit('interaction-hint', {
        text: 'ALGO MUDOU LONGE DE VOCÊ — sem ninguém medindo, o labirinto evoluiu e se reorganizou',
      });
    }
  },

  hum() {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      this.audio = this.audio || new AudioContext();
      const ctx = this.audio;
      if (ctx.state === 'suspended') ctx.resume();
      const start = ctx.currentTime;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.12, start + 0.35);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 1.8);
      gain.connect(ctx.destination);
      [55, 82.5, 110.6].forEach((frequency, index) => {
        const oscillator = ctx.createOscillator();
        oscillator.type = index === 0 ? 'sawtooth' : 'sine';
        oscillator.frequency.setValueAtTime(frequency, start);
        oscillator.frequency.linearRampToValueAtTime(frequency * 0.94, start + 1.8);
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 320;
        oscillator.connect(filter).connect(gain);
        oscillator.start(start);
        oscillator.stop(start + 1.9);
      });
    } catch {
      // Sem áudio (navegador bloqueou): o aviso visual basta.
    }
  },
});
