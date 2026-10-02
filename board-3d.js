// board-3d.js
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/controls/OrbitControls.js';

export class Board3D {
  constructor(container) {
    this.container = container;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0f0f0f);
    this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    this.camera.position.set(0, 12, 14);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.container.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.maxPolarAngle = Math.PI / 2.2;
    this.controls.minDistance = 8;
    this.controls.maxDistance = 28;

    // lights
    const ambient = new THREE.AmbientLight(0xffffff, 0.45);
    this.scene.add(ambient);
    const dir = new THREE.DirectionalLight(0xfff0d0, 0.85);
    dir.position.set(5, 12, 8);
    this.scene.add(dir);

    this.pieceMeshes = new Map(); // key: "r,c" -> mesh
    this.boardGroup = new THREE.Group();
    this.scene.add(this.boardGroup);

    this._buildBoard();
    this._onResize();
    window.addEventListener('resize', () => this._onResize());
    this._animate();
  }

  _onResize() {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight || w;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  _buildBoard() {
    const size = 1;
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const isLight = (r + c) % 2 === 0;
        const geo = new THREE.BoxGeometry(size, 0.15, size);
        const mat = new THREE.MeshStandardMaterial({
          color: isLight ? 0xd4c4a8 : 0x5c4a32,
          roughness: 0.7
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(c - 3.5, 0, r - 3.5);
        mesh.userData = { r, c, type: 'square' };
        this.boardGroup.add(mesh);
      }
    }
  }

  // Simple procedural piece geometry
  _createPieceGeometry(type, color) {
    const group = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({
      color: color === 'w' ? 0xf5f0e6 : 0x2a2a2a,
      metalness: 0.15,
      roughness: 0.45
    });

    if (type === 'P') {
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 0.18, 16), mat);
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 0.35, 12), mat);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), mat);
      body.position.y = 0.25;
      head.position.y = 0.5;
      group.add(base, body, head);
    } else if (type === 'R') {
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 0.2, 8), mat);
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.55, 0.4), mat);
      body.position.y = 0.35;
      group.add(base, body);
    } else if (type === 'N') {
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.3, 0.18, 12), mat);
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.5, 0.4), mat);
      body.position.y = 0.35;
      group.add(base, body);
    } else if (type === 'B') {
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.3, 0.18, 12), mat);
      const body = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.7, 12), mat);
      body.position.y = 0.45;
      group.add(base, body);
    } else if (type === 'Q') {
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.34, 0.2, 12), mat);
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.26, 0.6, 12), mat);
      body.position.y = 0.4;
      const crown = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 10), mat);
      crown.position.y = 0.8;
      group.add(base, body, crown);
    } else if (type === 'K') {
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.34, 0.2, 12), mat);
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 0.65, 12), mat);
      body.position.y = 0.42;
      const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.28, 0.08), mat);
      const crossH = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.08, 0.08), mat);
      crossV.position.y = 0.9;
      crossH.position.y = 0.95;
      group.add(base, body, crossV, crossH);
    }
    return group;
  }

  setPosition(boardArray) {
    // clear old pieces
    for (const mesh of this.pieceMeshes.values()) {
      this.boardGroup.remove(mesh);
    }
    this.pieceMeshes.clear();

    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = boardArray[r][c];
        if (!p) continue;
        const color = p[0];
        const type = p[1];
        const mesh = this._createPieceGeometry(type, color);
        mesh.position.set(c - 3.5, 0.12, r - 3.5);
        mesh.userData = { r, c, piece: p };
        this.boardGroup.add(mesh);
        this.pieceMeshes.set(`${r},${c}`, mesh);
      }
    }
  }

  highlightSquares(squares, color = 0xc9a86c) {
    // simple emissive highlight can be added later
  }

  _animate() {
    requestAnimationFrame(() => this._animate());
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  destroy() {
    this.renderer.dispose();
    this.container.innerHTML = '';
  }
}
