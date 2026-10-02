// chess-4player.js
import { FOUR_PLAYER_RULES } from './config.js';

/**
 * 14x14 grid, corners removed → 160 playable squares.
 * Coordinates: row 0..13, col 0..13
 * Playable if NOT in the four corner 3x3 blocks.
 */
export class FourPlayerChess {
  constructor() {
    this.size = 14;
    this.colors = FOUR_PLAYER_RULES.colors; // red blue yellow green
    this.turnIndex = 0;
    this.board = this._emptyBoard();
    this.eliminated = new Set();
    this.scores = { red: 0, blue: 0, yellow: 0, green: 0 };
    this.status = 'lobby';
    this._setupStartingPosition();
  }

  isPlayable(r, c) {
    if (r < 0 || r > 13 || c < 0 || c > 13) return false;
    // remove four 3x3 corners
    const inCorner =
      (r <= 2 && c <= 2) ||
      (r <= 2 && c >= 11) ||
      (r >= 11 && c <= 2) ||
      (r >= 11 && c >= 11);
    return !inCorner;
  }

  _emptyBoard() {
    const b = [];
    for (let r = 0; r < 14; r++) {
      b[r] = [];
      for (let c = 0; c < 14; c++) b[r][c] = null;
    }
    return b;
  }

  _setupStartingPosition() {
    // Simplified classic 4-player setup
    // Red (bottom, rows 11-13, cols 3-10) facing up
    // Blue (left) , Yellow (top), Green (right)
    // Full piece placement is long; this is the structural skeleton.
    // Pawns + back rank for each army.
    const place = (r, c, piece) => {
      if (this.isPlayable(r, c)) this.board[r][c] = piece;
    };

    // RED (south) — color code 'r'
    const redBack = ['rR','rN','rB','rQ','rK','rB','rN','rR'];
    for (let i = 0; i < 8; i++) place(13, 3 + i, redBack[i]);
    for (let i = 0; i < 8; i++) place(12, 3 + i, 'rP');

    // YELLOW (north) — 'y'
    const yelBack = ['yR','yN','yB','yQ','yK','yB','yN','yR'];
    for (let i = 0; i < 8; i++) place(0, 3 + i, yelBack[i]);
    for (let i = 0; i < 8; i++) place(1, 3 + i, 'yP');

    // BLUE (west) — 'b'
    const bluBack = ['bR','bN','bB','bQ','bK','bB','bN','bR'];
    for (let i = 0; i < 8; i++) place(3 + i, 0, bluBack[i]);
    for (let i = 0; i < 8; i++) place(3 + i, 1, 'bP');

    // GREEN (east) — 'g'
    const grnBack = ['gR','gN','gB','gQ','gK','gB','gN','gR'];
    for (let i = 0; i < 8; i++) place(3 + i, 13, grnBack[i]);
    for (let i = 0; i < 8; i++) place(3 + i, 12, 'gP');
  }

  currentColor() {
    return this.colors[this.turnIndex];
  }

  nextTurn() {
    do {
      this.turnIndex = (this.turnIndex + 1) % 4;
    } while (this.eliminated.has(this.colors[this.turnIndex]));
  }

  // Legal move generation, check detection, elimination, scoring
  // must be expanded fully (same pattern as 8x8 but with 4 colors + orientation)
  // This file is the authoritative place for 4p rules.
}
