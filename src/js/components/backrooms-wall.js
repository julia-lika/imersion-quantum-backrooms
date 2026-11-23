import { getBoxFaceUvScales } from './box-uv.js';

AFRAME.registerComponent('backrooms-wall', {
  schema: {
    texture: { type: 'string', default: '#wall-texture' },
    repeat: { type: 'string', default: '1 2' },
    offset: { type: 'string', default: '0 0' },
    side: { type: 'string', default: 'double' },
    textured: { type: 'boolean', default: true },
    textureScale: { type: 'number', default: 1 },
  },

  init() {
    this.onObject3DSet = () => this.scaleBoxUv();
    this.el.addEventListener('object3dset', this.onObject3DSet);
    this.onTextureLoaded = () => this.scaleBoxUv();
    this.el.addEventListener('materialtextureloaded', this.onTextureLoaded);
  },

  remove() {
    this.el.removeEventListener('object3dset', this.onObject3DSet);
    this.el.removeEventListener('materialtextureloaded', this.onTextureLoaded);
  },

  update() {
    if (!this.data.textured) {
      this.el.setAttribute(
        'material',
        'color: #b99a57; roughness: 1; metalness: 0'
      );
      this.scaleBoxUv();
      return;
    }

    this.el.setAttribute(
      'material',
      `src: ${this.data.texture}; repeat: ${this.data.repeat}; offset: ${this.data.offset}; side: ${this.data.side}; color: #ffffff; roughness: 1`
    );
    this.scaleBoxUv();
  },

  scaleBoxUv() {
    const mesh = this.el.getObject3D('mesh');
    const geometryData = this.el.getAttribute('geometry');
    const geometry = mesh?.geometry;

    if (
      !mesh ||
      !geometry ||
      geometryData?.primitive !== 'box' ||
      !geometry.attributes.uv ||
      geometry.attributes.uv.count !== 24
    ) {
      return;
    }

    const width = Number(geometryData.width) || 1;
    const height = Number(geometryData.height) || 1;
    const depth = Number(geometryData.depth) || 1;
    const scale = Math.max(0.001, this.data.textureScale);
    const material = mesh.material;

    if (material?.map) {
      material.map.wrapS = THREE.RepeatWrapping;
      material.map.wrapT = THREE.RepeatWrapping;
      material.map.needsUpdate = true;
    }

    const uvKey = `${geometry.uuid}:${width}:${height}:${depth}:${scale}`;
    if (this.uvKey === uvKey) return;

    this.uvKey = uvKey;
    const faceSizes = getBoxFaceUvScales({
      width,
      height,
      depth,
      textureScale: this.data.textureScale,
    });
    const uv = geometry.attributes.uv;

    faceSizes.forEach(([faceWidth, faceHeight], faceIndex) => {
      const uScale = faceWidth / scale;
      const vScale = faceHeight / scale;
      const start = faceIndex * 4;

      for (let vertex = 0; vertex < 4; vertex += 1) {
        const index = start + vertex;
        uv.setXY(index, uv.getX(index) * uScale, uv.getY(index) * vScale);
      }
    });

    uv.needsUpdate = true;
  },
});
