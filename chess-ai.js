// chess-ai.js
import { AI_DIFFICULTY, AI_STYLES } from './config.js';

export class ChessAI {
  constructor() {
    this.worker = null;
    this.ready = false;
    this.thinking = false;
    this.onMove = null;
  }

  async init() {
    // User must place stockfish files in /engine/
    // Recommended: stockfish-nnue-16.js + .wasm from nmrugg/stockfish.js (lite single)
    return new Promise((resolve, reject) => {
      try {
        this.worker = new Worker('./engine/stockfish.js');
        this.worker.onmessage = (e) => this._handle(e.data);
        this.worker.postMessage('uci');
        this.worker.postMessage('isready');
        this.ready = true;
        resolve();
      } catch (err) {
        console.warn('Stockfish load failed, falling back to simple AI', err);
        this.ready = false;
        resolve();
      }
    });
  }

  _handle(line) {
    if (typeof line !== 'string') return;
    if (line.startsWith('bestmove')) {
      this.thinking = false;
      const parts = line.split(' ');
      const move = parts[1];
      if (move && move !== '(none)' && this.onMove) {
        this.onMove(move); // e.g. "e2e4"
      }
    }
  }

  /**
   * @param {string} fen
   * @param {string} difficultyKey  e.g. "Advanced"
   * @param {string} styleKey       e.g. "Aggressive"
   */
  think(fen, difficultyKey = 'Intermediate', styleKey = 'Balanced') {
    if (!this.ready || !this.worker) {
      // fallback handled by caller
      return;
    }
    if (this.thinking) {
      this.worker.postMessage('stop');
    }
    this.thinking = true;
    const diff = AI_DIFFICULTY[difficultyKey] || AI_DIFFICULTY.Intermediate;
    const style = AI_STYLES[styleKey] || AI_STYLES.Balanced;

    this.worker.postMessage('position fen ' + fen);
    // multipv for style selection layer
    this.worker.postMessage('setoption name MultiPV value ' + (diff.multipv || 1));
    this.worker.postMessage('go depth ' + diff.depth);
  }

  stop() {
    if (this.worker && this.thinking) {
      this.worker.postMessage('stop');
      this.thinking = false;
    }
  }

  destroy() {
    this.stop();
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
  }
}
