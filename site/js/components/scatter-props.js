// Espalha os objetos do pack Vol. 2 pelo labirinto atual: móveis encostados nas
// paredes e câmeras/placas presas nelas. Redistribui a cada novo andar/colapso
// para nada ficar dentro de uma parede.
const WALL_OBJECT = /CCTV|Warning|Door|Security|Alarm/i;
const DIRECTIONS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

AFRAME.registerComponent('scatter-props', {
  schema: {
    maxObjects: { type: 'number', default: 22 },
    seed: { type: 'number', default: 17 },
  },

  init() {
    this.stairs = null;
    this.items = [];
    this.onModel = () => this.scatter();
    this.onWorld = ({ detail }) => {
      this.stairs = detail?.stairs || null;
      this.items = detail?.items || [];
      this.scatter();
    };
    this.el.addEventListener('model-loaded', this.onModel);
    this.el.sceneEl.addEventListener('maze-world-updated', this.onWorld);
  },

  remove() {
    this.el.removeEventListener('model-loaded', this.onModel);
    this.el.sceneEl.removeEventListener('maze-world-updated', this.onWorld);
  },

  createRandom(text) {
    let seed = this.data.seed;
    for (const char of text) seed = (seed * 31 + char.charCodeAt(0)) % 4294967296;
    return () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };
  },

  shuffle(items, random) {
    const shuffled = [...items];
    for (let index = shuffled.length - 1; index > 0; index -= 1) {
      const target = Math.floor(random() * (index + 1));
      [shuffled[index], shuffled[target]] = [shuffled[target], shuffled[index]];
    }
    return shuffled;
  },

  // Células livres encostadas em uma parede fixa, longe da entrada e da porta.
  wallCells(world) {
    const { maze } = world;
    const cells = [];

    maze.forEach((row, z) => {
      row.forEach((cell, x) => {
        if (cell !== '.' || (x <= 3 && z <= 3)) return;
        if (this.stairs && Math.abs(this.stairs.x - x) + Math.abs(this.stairs.z - z) <= 1) return;
        if (this.items.some((item) => item.x === x && item.z === z)) return;

        const walls = DIRECTIONS.filter(([dx, dz]) => (
          maze[z + dz]?.[x + dx] === '#' && !world.superposed.has(`${x + dx},${z + dz}`)
        ));
        if (walls.length > 0) cells.push({ x, z, walls });
      });
    });

    return cells;
  },

  scatter() {
    const root = this.el.getObject3D('mesh');
    const world = window.quantumWorld;
    const physics = window.quantumPhysics;
    if (!root || !world || !physics) return;

    const random = this.createRandom(world.maze.map((row) => row.join('')).join(''));
    const objects = this.shuffle(root.children, random);
    const cells = this.shuffle(this.wallCells(world), random);
    const half = world.cellSize / 2;
    let placed = 0;

    objects.forEach((object) => {
      const cell = placed < this.data.maxObjects ? cells[placed] : null;
      if (!cell) {
        object.visible = false;
        return;
      }

      placed += 1;
      const [dx, dz] = cell.walls[Math.floor(random() * cell.walls.length)];
      const center = physics.cellToWorld(world, cell.x, cell.z);
      const mounted = WALL_OBJECT.test(object.name || '');
      const inset = mounted ? 0.04 : 0.32;
      const facing = Math.atan2(-dx, -dz);

      object.visible = true;
      object.position.set(
        center.x + dx * (half - inset),
        mounted && !/Door/i.test(object.name) ? 1.6 + random() * 0.5 : 0,
        center.z + dz * (half - inset)
      );
      object.rotation.y = mounted ? facing : facing + (random() - 0.5) * 1.2;
    });

    console.info(`[scatter-props] ${placed} objetos distribuídos`);
  },
});
