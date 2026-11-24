// Monta o lobby (fase 0) a partir de js/content/lobby-content.js: móveis,
// notebook do briefing, telão de slides, TV da entidade, paredes de treino e placas.
import {
  LOBBY_COMPUTER,
  LOBBY_FURNITURE,
  LOBBY_GEAR,
  LOBBY_SIGNS,
  LOBBY_SLIDES,
  LOBBY_TRAINING_WALLS,
  LOBBY_TV,
} from '../../content/lobby-content.js?v=20261124-3';

// Rotação de uma peça presa a cada parede, com a frente virada para o salão.
const WALL_ROTATION = { left: 90, right: -90, far: 180 };

function lobbyFrame(origin, cellSize) {
  const at = (cell) => origin + cell * cellSize;
  const half = cellSize / 2;
  return {
    at,
    cellSize,
    walls: {
      left: at(0) + half + 0.02,
      right: at(11) + half - 0.02,
      far: at(17) + half - 0.02,
    },
  };
}

// Converte { wall, cellX, cellZ, inset } em posição no mundo.
function place(frame, { wall, cellX, cellZ, inset = 0 }) {
  const { at, walls } = frame;
  if (wall === 'left') return { x: walls.left + inset, z: at(cellZ) };
  if (wall === 'right') return { x: walls.right - inset, z: at(cellZ) };
  if (wall === 'far') return { x: at(cellX), z: walls.far - inset };
  return { x: at(cellX), z: at(cellZ) };
}

function append(parent, attributes) {
  const entity = document.createElement('a-entity');
  Object.entries(attributes).forEach(([name, value]) => entity.setAttribute(name, value));
  parent.appendChild(entity);
  return entity;
}

function addFurniture(parent, frame) {
  const furniture = document.createElement('a-entity');
  furniture.lobbyLayout = LOBBY_FURNITURE.map((item) => ({ ...item, ...place(frame, item) }));
  furniture.setAttribute('lobby-furniture', '');
  parent.appendChild(furniture);
}

function addComputer(parent, frame) {
  const { cellX, cellZ, edgeOffset, y, rotation } = LOBBY_COMPUTER;
  append(parent, {
    position: `${frame.at(cellX)} ${y} ${frame.at(cellZ) + edgeOffset}`,
    rotation: `0 ${rotation} 0`,
    'lobby-computer': '',
  });
}

function addSlides(parent, frame) {
  const { x, z } = place(frame, LOBBY_SLIDES);
  append(parent, {
    position: `${x + 0.03} ${LOBBY_SLIDES.y} ${z}`,
    rotation: `0 ${WALL_ROTATION[LOBBY_SLIDES.wall]} 0`,
    'quantum-slides': { width: LOBBY_SLIDES.width },
  });
}

function addTv(parent, frame) {
  const { x, z } = place(frame, LOBBY_TV);
  append(parent, {
    position: `${x} ${LOBBY_TV.y} ${z}`,
    rotation: `0 ${WALL_ROTATION[LOBBY_TV.wall]} 0`,
    'entity-tv': '',
  });
}

function addTrainingWalls(parent, frame) {
  LOBBY_TRAINING_WALLS.forEach(({ cellZ, cells, ...config }) => {
    append(parent, {
      position: `${frame.walls.right - 0.01} 0 ${frame.at(cellZ)}`,
      rotation: '0 -90 0',
      'training-wall': { ...config, width: frame.cellSize * cells - 0.1 },
    });
  });
}

function addSigns(parent, frame) {
  LOBBY_SIGNS.forEach((sign) => {
    const { x, z } = place(frame, sign);
    append(parent, {
      position: `${x} ${sign.y ?? 1.65} ${z}`,
      rotation: `0 ${WALL_ROTATION[sign.wall]} 0`,
      'terminal-panel': {
        title: sign.title,
        subtitle: sign.subtitle,
        body: sign.body.replace(/\n/g, '\\n'),
        width: 1.35,
        height: sign.height ?? 0.9,
        fontSize: 28,
      },
    });
  });
}

// Relógio (Q-LINK), óculos (Visor Zeta) e chip (QPS) sobre a mesa do canto,
// girando devagar, cada um com o nome flutuando em cima.
function addGear(parent, frame) {
  LOBBY_GEAR.items.forEach((item) => {
    const { x, z } = place(frame, { wall: LOBBY_GEAR.wall, cellX: item.cellX, inset: LOBBY_GEAR.inset });
    if (!item.labelOnly) addGearModel(parent, item, x, z);
    append(parent, {
      position: `${x} ${LOBBY_GEAR.y + 0.3} ${z}`,
      rotation: '0 180 0',
      'canvas-text': { value: item.label, color: '#39ff88', width: 0.32, overlay: false, style: 'terminal' },
    });
  });
}

function addGearModel(parent, item, x, z) {
  const holder = append(parent, {
    position: `${x} ${LOBBY_GEAR.y + item.lift} ${z}`,
    animation: 'property: rotation; to: 0 360 0; loop: true; dur: 16000; easing: linear',
  });
  const model = document.createElement('a-entity');
  model.setAttribute('gltf-model', item.model);
  model.setAttribute('scale', `${item.scale} ${item.scale} ${item.scale}`);
  holder.appendChild(model);
}

export function buildLobby(parent, origin, cellSize) {
  const frame = lobbyFrame(origin, cellSize);
  addFurniture(parent, frame);
  addComputer(parent, frame);
  addSlides(parent, frame);
  addTv(parent, frame);
  addTrainingWalls(parent, frame);
  addSigns(parent, frame);
  addGear(parent, frame);
}
