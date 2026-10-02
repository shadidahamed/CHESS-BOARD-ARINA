/**
 * board-3d.js — CHESS ARENA
 * Three.js 3D board · procedural pieces · click-to-move via raycasting
 */

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/controls/OrbitControls.js';

const LIGHT_SQ = 0xd4c4a8;
const DARK_SQ = 0x5c4a32;
const SELECT = 0xc9a86c;
const LEGAL = 0x8a7349;
const LAST = 0xb8860b;
const CHECK = 0xb03a3a;

export class Board3D {
  /**
   * @param {HTMLElement} container
   * @param {object} opts
   * @param {(r:number,c:number)=>void} opts.onSquareClick
   */
  constructor(container, opts = {}) {
    this.container = container;
    this.onSquareClick = opts.onSquareClick || (() => {});
    this.flipped = !!opts.flipped;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0f0f0f);

    this.camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    this.camera.position.set(0, 11, 13);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.container.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.maxPolarAngle = Math.PI / 2.15;
    this.controls.minDistance = 9;
    this.controls.maxDistance = 26;
    this.controls.target.set(0, 0, 0);

    // Lights
    this.scene.add(new THREE.AmbientLight(0xfff5e6, 0.5));
    const key = new THREE.DirectionalLight(0xffe8c8, 0.9);
    key.position.set(6, 14, 8);
    key.castShadow = true;
    this.scene.add(key);
    const fill = new THREE.DirectionalLight(0xa0b0c0, 0.25);
    fill.position.set(-8, 6, -4);
    this.scene.add(fill);

    this.boardGroup = new THREE.Group();
    this.scene.add(this.boardGroup);

    this.squareMeshes = []; // [r][c]
    this.pieceMeshes = new Map(); // "r,c" -> Group
    this.highlightMeshes = [];
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();

    this._buildSquares();
    this._onResize();
    this._bindInput();

    this._resizeObs = new ResizeObserver(() => this._onResize());
    this._resizeObs.observe(this.container);

    this._alive = true;
    this._animate();
  }

  // ─────────────────────────────────────────────
  // Board squares
  // ─────────────────────────────────────────────
  _buildSquares() {
    this.squareMeshes = Array.from({ length: 8 }, () => Array(8).fill(null));
    const geo = new THREE.BoxGeometry(1, 0.18, 1);

    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const isLight = (r + c) % 2 === 0;
        const mat = new THREE.MeshStandardMaterial({
          color: isLight ? LIGHT_SQ : DARK_SQ,
          roughness: 0.75,
          metalness: 0.05
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(c - 3.5, 0, r - 3.5);
        mesh.receiveShadow = true;
        mesh.userData = { type: 'square', r, c, baseColor: isLight ? LIGHT_SQ : DARK_SQ };
        this.boardGroup.add(mesh);
        this.squareMeshes[r][c] = mesh;
      }
    }

    // thin frame
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x8a7349, roughness: 0.2, metalness: 0.4 });
    const frame = new THREE.Mesh(new THREE.BoxGeometry(8.4, 0.12, 8.4), frameMat);
    frame.position.y = -0.06;
    this.boardGroup.add(frame);
  }

  // ─────────────────────────────────────────────
  // Pieces (procedural)
  // ─────────────────────────────────────────────
  _pieceMaterial(color) {
    return new THREE.MeshStandardMaterial({
      color: color === 'w' ? 0xf2ebe0 : 0x1e1e1e,
      roughness: 0.4,
      metalness: color === 'w' ? 0.12 : 0.25
    });
  }

  _createPiece(type, color) {
    const g = new THREE.Group();
    const mat = this._pieceMaterial(color);

    const add = (mesh, y = 0) => {
      mesh.position.y = y;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      g.add(mesh);
    };

    if (type === 'P') {
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 0.14, 16), mat), 0.07);
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.17, 0.32, 12), mat), 0.28);
      add(new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 10), mat), 0.52);
    } else if (type === 'R') {
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.3, 0.14, 8), mat), 0.07);
      add(new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.5, 0.38), mat), 0.38);
      add(new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.1, 0.44), mat), 0.68);
    } else if (type === 'N') {
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.28, 0.14, 12), mat), 0.07);
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.42, 0.38), mat);
      body.rotation.y = Math.PI / 8;
      add(body, 0.36);
      add(new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.2, 0.28), mat), 0.62);
    } else if (type === 'B') {
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.28, 0.14, 12), mat), 0.07);
      add(new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.65, 12), mat), 0.45);
      add(new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), mat), 0.82);
    } else if (type === 'Q') {
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 0.14, 12), mat), 0.07);
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.24, 0.55, 12), mat), 0.42);
      add(new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), mat), 0.78);
      add(new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 8), mat), 0.96);
    } else if (type === 'K') {
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 0.14, 12), mat), 0.07);
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.26, 0.6, 12), mat), 0.44);
      add(new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.28, 0.08), mat), 0.9);
      add(new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.08, 0.08), mat), 0.94);
    }

    return g;
  }

  /**
   * @param {string[][]} board  8x8 array of "wK" | "bP" | null
   * @param {object} [meta]
   * @param {{r,c}|null} meta.selected
   * @param {Array<{to:{r,c}}>} meta.legal
   * @param {{from:{r,c},to:{r,c}}|null} meta.lastMove
   * @param {{r,c}|null} meta.checkKing
   */
  setPosition(board, meta = {}) {
    // clear pieces
    for (const mesh of this.pieceMeshes.values()) {
      this.boardGroup.remove(mesh);
    }
    this.pieceMeshes.clear();

    // reset square colors
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const sq = this.squareMeshes[r][c];
        sq.material.color.setHex(sq.userData.baseColor);
        sq.material.emissive?.setHex(0x000000);
      }
    }

    // last move
    if (meta.lastMove) {
      this._tintSquare(meta.lastMove.from.r, meta.lastMove.from.c, LAST, 0.25);
      this._tintSquare(meta.lastMove.to.r, meta.lastMove.to.c, LAST, 0.35);
    }

    // legal
    if (meta.legal) {
      for (const m of meta.legal) {
        this._tintSquare(m.to.r, m.to.c, LEGAL, 0.4);
      }
    }

    // selected
    if (meta.selected) {
      this._tintSquare(meta.selected.r, meta.selected.c, SELECT, 0.5);
    }

    // check
    if (meta.checkKing) {
      this._tintSquare(meta.checkKing.r, meta.checkKing.c, CHECK, 0.55);
    }

    // place pieces
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = board[r][c];
        if (!p) continue;
        const mesh = this._createPiece(p[1], p[0]);
        const pos = this._sqToWorld(r, c);
        mesh.position.set(pos.x, 0.09, pos.z);
        mesh.userData = { type: 'piece', r, c, piece: p };
        this.boardGroup.add(mesh);
        this.pieceMeshes.set(`${r},${c}`, mesh);
      }
    }

    // board orientation
    this.boardGroup.rotation.y = this.flipped ? Math.PI : 0;
  }

  _tintSquare(r, c, hex, intensity = 0.4) {
    if (r < 0 || r > 7 || c < 0 || c > 7) return;
    const sq = this.squareMeshes[r][c];
    const base = new THREE.Color(sq.userData.baseColor);
    const tint = new THREE.Color(hex);
    base.lerp(tint, intensity);
    sq.material.color.copy(base);
  }

  _sqToWorld(r, c) {
    return { x: c - 3.5, z: r - 3.5 };
  }

  setFlipped(flipped) {
    this.flipped = !!flipped;
    this.boardGroup.rotation.y = this.flipped ? Math.PI : 0;
  }

  // ─────────────────────────────────────────────
  // Input — click / tap square
  // ─────────────────────────────────────────────
  _bindInput() {
    const el = this.renderer.domElement;

    // distinguish click vs orbit drag
    let downX = 0, downY = 0, downT = 0;

    el.addEventListener('pointerdown', (e) => {
      downX = e.clientX;
      downY = e.clientY;
      downT = Date.now();
    });

    el.addEventListener('pointerup', (e) => {
      const dx = e.clientX - downX;
      const dy = e.clientY - downY;
      const dt = Date.now() - downT;
      if (Math.hypot(dx, dy) > 6 || dt > 500) return; // was a drag
      this._handlePointer(e);
    });
  }

  _handlePointer(e) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.pointer, this.camera);

    // intersect squares + pieces
    const targets = [];
    for (let r = 0; r < 8; r++)
      for (let c = 0; c < 8; c++)
        targets.push(this.squareMeshes[r][c]);
    for (const mesh of this.pieceMeshes.values()) {
      mesh.traverse(ch => {
        if (ch.isMesh) targets.push(ch);
      });
    }

    const hits = this.raycaster.intersectObjects(targets, false);
    if (!hits.length) return;

    let obj = hits[0].object;
    // walk up to userData
    while (obj && !obj.userData?.type) obj = obj.parent;
    if (!obj) return;

    let r = obj.userData.r;
    let c = obj.userData.c;

    // if board is flipped, visual rotation is 180° but logical coords stay same
    // userData already stores logical r,c
    if (typeof r === 'number' && typeof c === 'number') {
      this.onSquareClick(r, c);
    }
  }

  // ─────────────────────────────────────────────
  // Lifecycle
  // ─────────────────────────────────────────────
  _onResize() {
    const w = this.container.clientWidth || 320;
    const h = this.container.clientHeight || w;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
  }

  _animate() {
    if (!this._alive) return;
    requestAnimationFrame(() => this._animate());
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  destroy() {
    this._alive = false;
    this._resizeObs?.disconnect();
    this.controls.dispose();
    this.renderer.dispose();
    this.container.innerHTML = '';
  }
}

export default Board3D;
