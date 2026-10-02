/**
 * chess-4player.js — CHESS ARENA
 * Four-player cross-board chess engine
 * 14×14 grid · corners removed · 160 playable squares
 * Colors: red, blue, yellow, green (clockwise)
 * Free-for-All with points + elimination
 */

import { FOUR_PLAYER_RULES } from './config.js';

const COLOR_CODE = {
  red: 'r',
  blue: 'b',
  yellow: 'y',
  green: 'g'
};

const CODE_COLOR = {
  r: 'red',
  b: 'blue',
  y: 'yellow',
  g: 'green'
};

const PIECE_SCORE = () => ({ ...FOUR_PLAYER_RULES.scoring });

export class FourPlayerChess {
  constructor() {
    this.size = 14;
    this.colors = [...FOUR_PLAYER_RULES.colors]; // ['red','blue','yellow','green']
    this.turnIndex = 0;
    this.board = this._emptyBoard();
    this.eliminated = new Set();       // color names
    this.scores = { red: 0, blue: 0, yellow: 0, green: 0 };
    this.status = 'lobby';             // lobby | running | finished
    this.history = [];
    this.moveNumber = 0;
    this.winnerOrder = [];             // placement when finished
    this._setupStartingPosition();
  }

  // ─────────────────────────────────────────────
  // Geometry
  // ─────────────────────────────────────────────
  isPlayable(r, c) {
    if (r < 0 || r > 13 || c < 0 || c > 13) return false;
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

  // ─────────────────────────────────────────────
  // Starting position
  // Red  = south (rows 11–13, cols 3–10), pawns move decreasing row
  // Yellow = north (rows 0–2), pawns move increasing row
  // Blue = west (cols 0–2, rows 3–10), pawns move increasing col
  // Green = east (cols 11–13, rows 3–10), pawns move decreasing col
  // ─────────────────────────────────────────────
  _setupStartingPosition() {
    this.board = this._emptyBoard();

    const place = (r, c, piece) => {
      if (this.isPlayable(r, c)) this.board[r][c] = piece;
    };

    // RED (south) — faces north (dir: -row)
    const redBack = ['rR', 'rN', 'rB', 'rQ', 'rK', 'rB', 'rN', 'rR'];
    for (let i = 0; i < 8; i++) {
      place(13, 3 + i, redBack[i]);
      place(12, 3 + i, 'rP');
    }

    // YELLOW (north) — faces south (dir: +row)
    const yelBack = ['yR', 'yN', 'yB', 'yK', 'yQ', 'yB', 'yN', 'yR']; // K/Q mirrored for fairness option
    for (let i = 0; i < 8; i++) {
      place(0, 3 + i, yelBack[i]);
      place(1, 3 + i, 'yP');
    }

    // BLUE (west) — faces east (dir: +col)
    const bluBack = ['bR', 'bN', 'bB', 'bQ', 'bK', 'bB', 'bN', 'bR'];
    for (let i = 0; i < 8; i++) {
      place(3 + i, 0, bluBack[i]);
      place(3 + i, 1, 'bP');
    }

    // GREEN (east) — faces west (dir: -col)
    const grnBack = ['gR', 'gN', 'gB', 'gK', 'gQ', 'gB', 'gN', 'gR'];
    for (let i = 0; i < 8; i++) {
      place(3 + i, 13, grnBack[i]);
      place(3 + i, 12, 'gP');
    }
  }

  // Pawn forward direction per color
  _pawnDir(colorCode) {
    // returns { dr, dc }
    if (colorCode === 'r') return { dr: -1, dc: 0 }; // north
    if (colorCode === 'y') return { dr: 1, dc: 0 };  // south
    if (colorCode === 'b') return { dr: 0, dc: 1 };  // east
    if (colorCode === 'g') return { dr: 0, dc: -1 }; // west
    return { dr: 0, dc: 0 };
  }

  // Promotion rank check
  _isPromotionSquare(r, c, colorCode) {
    if (colorCode === 'r') return r === 0 || r === 1 || r === 2; // reach north arm
    if (colorCode === 'y') return r === 11 || r === 12 || r === 13;
    if (colorCode === 'b') return c === 11 || c === 12 || c === 13;
    if (colorCode === 'g') return c === 0 || c === 1 || c === 2;
    return false;
  }

  // Starting double-step ranks
  _isPawnStart(r, c, colorCode) {
    if (colorCode === 'r') return r === 12;
    if (colorCode === 'y') return r === 1;
    if (colorCode === 'b') return c === 1;
    if (colorCode === 'g') return c === 12;
    return false;
  }

  // ─────────────────────────────────────────────
  // Turn
  // ─────────────────────────────────────────────
  currentColor() {
    return this.colors[this.turnIndex];
  }

  currentCode() {
    return COLOR_CODE[this.currentColor()];
  }

  nextTurn() {
    if (this.status !== 'running') return;
    let guard = 0;
    do {
      this.turnIndex = (this.turnIndex + 1) % 4;
      guard++;
    } while (this.eliminated.has(this.colors[this.turnIndex]) && guard < 5);
  }

  // ─────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────
  findKing(colorCode) {
    for (let r = 0; r < 14; r++)
      for (let c = 0; c < 14; c++)
        if (this.board[r][c] === colorCode + 'K') return { r, c };
    return null;
  }

  isEnemy(piece, myCode) {
    if (!piece) return false;
    const code = piece[0];
    if (code === myCode) return false;
    // eliminated pieces become "dead" — still capturable for points or not
    return true;
  }

  isOwn(piece, myCode) {
    return piece && piece[0] === myCode;
  }

  isDeadColor(colorCode) {
    return this.eliminated.has(CODE_COLOR[colorCode]);
  }

  // ─────────────────────────────────────────────
  // Attack detection (for check)
  // ─────────────────────────────────────────────
  isSquareAttacked(r, c, byCode) {
    if (!this.isPlayable(r, c)) return false;

    // Pawns
    const dir = this._pawnDir(byCode);
    // capture diagonals relative to forward
    const captureOffsets = this._pawnCaptureOffsets(byCode);
    for (const { dr, dc } of captureOffsets) {
      const pr = r - dr, pc = c - dc; // square from which pawn would attack (r,c)
      if (this.isPlayable(pr, pc) && this.board[pr][pc] === byCode + 'P') return true;
    }

    // Knights
    for (const [dr, dc] of [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]]) {
      const nr = r + dr, nc = c + dc;
      if (this.isPlayable(nr, nc) && this.board[nr][nc] === byCode + 'N') return true;
    }

    // King
    for (let dr = -1; dr <= 1; dr++)
      for (let dc = -1; dc <= 1; dc++) {
        if (!dr && !dc) continue;
        const nr = r + dr, nc = c + dc;
        if (this.isPlayable(nr, nc) && this.board[nr][nc] === byCode + 'K') return true;
      }

    // Bishop / Queen diagonals
    for (const [dr, dc] of [[-1,-1],[-1,1],[1,-1],[1,1]]) {
      for (let i = 1; i < 14; i++) {
        const nr = r + dr * i, nc = c + dc * i;
        if (!this.isPlayable(nr, nc)) break;
        const p = this.board[nr][nc];
        if (!p) continue;
        if (p[0] === byCode && (p[1] === 'B' || p[1] === 'Q')) return true;
        break;
      }
    }

    // Rook / Queen ranks-files
    for (const [dr, dc] of [[-1,0],[1,0],[0,-1],[0,1]]) {
      for (let i = 1; i < 14; i++) {
        const nr = r + dr * i, nc = c + dc * i;
        if (!this.isPlayable(nr, nc)) break;
        const p = this.board[nr][nc];
        if (!p) continue;
        if (p[0] === byCode && (p[1] === 'R' || p[1] === 'Q')) return true;
        break;
      }
    }

    return false;
  }

  _pawnCaptureOffsets(colorCode) {
    // relative to pawn's forward direction, left/right diagonals
    if (colorCode === 'r') return [{ dr: -1, dc: -1 }, { dr: -1, dc: 1 }];
    if (colorCode === 'y') return [{ dr: 1, dc: -1 }, { dr: 1, dc: 1 }];
    if (colorCode === 'b') return [{ dr: -1, dc: 1 }, { dr: 1, dc: 1 }];
    if (colorCode === 'g') return [{ dr: -1, dc: -1 }, { dr: 1, dc: -1 }];
    return [];
  }

  isInCheck(colorCode) {
    if (this.isDeadColor(colorCode)) return false;
    const k = this.findKing(colorCode);
    if (!k) return true; // king missing = eliminated
    // attacked by any living enemy
    for (const code of ['r', 'b', 'y', 'g']) {
      if (code === colorCode) continue;
      if (this.isDeadColor(code)) continue;
      if (this.isSquareAttacked(k.r, k.c, code)) return true;
    }
    return false;
  }

  // ─────────────────────────────────────────────
  // Pseudo-legal moves
  // ─────────────────────────────────────────────
  _pseudoMoves(r, c) {
    const piece = this.board[r][c];
    if (!piece) return [];
    const code = piece[0];
    const type = piece[1];
    if (this.isDeadColor(code)) return [];

    const moves = [];

    const add = (nr, nc, extra = {}) => {
      if (!this.isPlayable(nr, nc)) return;
      const target = this.board[nr][nc];
      if (target && target[0] === code) return; // own piece
      moves.push({
        from: { r, c },
        to: { r: nr, c: nc },
        piece,
        capture: target || null,
        ...extra
      });
    };

    if (type === 'P') {
      const { dr, dc } = this._pawnDir(code);
      const fr = r + dr, fc = c + dc;

      // single step
      if (this.isPlayable(fr, fc) && !this.board[fr][fc]) {
        if (this._isPromotionSquare(fr, fc, code)) {
          for (const promo of ['Q', 'R', 'B', 'N']) {
            add(fr, fc, { promotion: promo });
          }
        } else {
          add(fr, fc);
          // double step from start
          if (this._isPawnStart(r, c, code)) {
            const fr2 = r + 2 * dr, fc2 = c + 2 * dc;
            if (this.isPlayable(fr2, fc2) && !this.board[fr2][fc2]) {
              add(fr2, fc2, { doublePawn: true });
            }
          }
        }
      }

      // captures
      for (const off of this._pawnCaptureOffsets(code)) {
        const nr = r + off.dr, nc = c + off.dc;
        if (!this.isPlayable(nr, nc)) continue;
        const target = this.board[nr][nc];
        if (target && target[0] !== code) {
          if (this._isPromotionSquare(nr, nc, code)) {
            for (const promo of ['Q', 'R', 'B', 'N']) {
              add(nr, nc, { promotion: promo });
            }
          } else {
            add(nr, nc);
          }
        }
      }
    }

    if (type === 'N') {
      for (const [dr, dc] of [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]]) {
        add(r + dr, c + dc);
      }
    }

    if (type === 'B' || type === 'Q') {
      for (const [dr, dc] of [[-1,-1],[-1,1],[1,-1],[1,1]]) {
        for (let i = 1; i < 14; i++) {
          const nr = r + dr * i, nc = c + dc * i;
          if (!this.isPlayable(nr, nc)) break;
          const target = this.board[nr][nc];
          if (!target) add(nr, nc);
          else {
            if (target[0] !== code) add(nr, nc);
            break;
          }
        }
      }
    }

    if (type === 'R' || type === 'Q') {
      for (const [dr, dc] of [[-1,0],[1,0],[0,-1],[0,1]]) {
        for (let i = 1; i < 14; i++) {
          const nr = r + dr * i, nc = c + dc * i;
          if (!this.isPlayable(nr, nc)) break;
          const target = this.board[nr][nc];
          if (!target) add(nr, nc);
          else {
            if (target[0] !== code) add(nr, nc);
            break;
          }
        }
      }
    }

    if (type === 'K') {
      for (let dr = -1; dr <= 1; dr++)
        for (let dc = -1; dc <= 1; dc++)
          if (dr || dc) add(r + dr, c + dc);
      // Castling omitted in 4p FFA for simplicity (can be added later)
    }

    return moves;
  }

  // ─────────────────────────────────────────────
  // Legal moves (must not leave own king in check)
  // ─────────────────────────────────────────────
  getLegalMoves(r, c) {
    const piece = this.board[r][c];
    if (!piece) return [];
    const code = piece[0];
    if (CODE_COLOR[code] !== this.currentColor()) return [];
    if (this.isDeadColor(code)) return [];

    const pseudo = this._pseudoMoves(r, c);
    const legal = [];

    for (const m of pseudo) {
      this._makeTemp(m);
      if (!this.isInCheck(code)) legal.push(m);
      this._undoTemp(m);
    }
    return legal;
  }

  getAllLegalMoves(colorCode = this.currentCode()) {
    const all = [];
    for (let r = 0; r < 14; r++)
      for (let c = 0; c < 14; c++)
        if (this.board[r][c] && this.board[r][c][0] === colorCode)
          all.push(...this.getLegalMoves(r, c));
    return all;
  }

  _makeTemp(m) {
    m._saved = {
      fromPiece: this.board[m.from.r][m.from.c],
      toPiece: this.board[m.to.r][m.to.c]
    };
    this.board[m.to.r][m.to.c] = m.promotion
      ? m.piece[0] + m.promotion
      : m.piece;
    this.board[m.from.r][m.from.c] = null;
  }

  _undoTemp(m) {
    this.board[m.from.r][m.from.c] = m._saved.fromPiece;
    this.board[m.to.r][m.to.c] = m._saved.toPiece;
  }

  // ─────────────────────────────────────────────
  // Apply move
  // ─────────────────────────────────────────────
  move(fromR, fromC, toR, toC, promotion = 'Q') {
    if (this.status !== 'running') return null;

    const legal = this.getLegalMoves(fromR, fromC);
    let m = legal.find(x => x.to.r === toR && x.to.c === toC);
    if (!m) return null;

    if (m.promotion) {
      m = legal.find(x =>
        x.to.r === toR && x.to.c === toC && x.promotion === promotion
      ) || m;
    }

    return this._applyMove(m);
  }

  _applyMove(m) {
    const snapshot = {
      board: this.board.map(row => [...row]),
      turnIndex: this.turnIndex,
      scores: { ...this.scores },
      eliminated: new Set(this.eliminated)
    };

    const code = m.piece[0];
    const color = CODE_COLOR[code];
    const scoring = PIECE_SCORE();

    // capture scoring
    if (m.capture) {
      const capType = m.capture[1];
      const capCode = m.capture[0];
      // dead pieces give no points (optional rule)
      if (!this.isDeadColor(capCode)) {
        const pts = scoring[capType.toLowerCase()] ?? scoring[this._typeKey(capType)] ?? 0;
        this.scores[color] += pts;
      }
    }

    // execute board change
    this.board[m.to.r][m.to.c] = m.promotion ? code + m.promotion : m.piece;
    this.board[m.from.r][m.from.c] = null;

    this.moveNumber++;
    const notation = this._notation(m);

    const result = {
      ...m,
      notation,
      color,
      moveNumber: this.moveNumber,
      scores: { ...this.scores }
    };

    this.history.push({ move: result, snapshot });

    // check eliminations after move
    this._checkEliminations(code);

    // next turn
    this.nextTurn();

    // end game if ≤1 alive
    this._checkGameEnd();

    return result;
  }

  _typeKey(t) {
    const map = { P: 'pawn', N: 'knight', B: 'bishop', R: 'rook', Q: 'queen', K: 'king' };
    return map[t] || t;
  }

  _notation(m) {
    const from = `${m.from.r},${m.from.c}`;
    const to = `${m.to.r},${m.to.c}`;
    const cap = m.capture ? 'x' : '-';
    const promo = m.promotion ? '=' + m.promotion : '';
    return `${m.piece}${cap}${to}${promo}`;
  }

  // ─────────────────────────────────────────────
  // Elimination
  // ─────────────────────────────────────────────
  _checkEliminations(moverCode) {
    const scoring = PIECE_SCORE();

    for (const code of ['r', 'b', 'y', 'g']) {
      if (code === moverCode) continue;
      const color = CODE_COLOR[code];
      if (this.eliminated.has(color)) continue;

      const king = this.findKing(code);
      if (!king) {
        // king captured — eliminate
        this._eliminate(color, 'king_captured', moverCode);
        continue;
      }

      // checkmate: in check and no legal moves
      if (this.isInCheck(code)) {
        // temporarily set turn sense for getAllLegalMoves
        const savedIndex = this.turnIndex;
        this.turnIndex = this.colors.indexOf(color);
        const hasMoves = this.getAllLegalMoves(code).length > 0;
        this.turnIndex = savedIndex;

        if (!hasMoves) {
          this._eliminate(color, 'checkmate', moverCode);
        }
      }
    }
  }

  _eliminate(color, reason, byCode) {
    if (this.eliminated.has(color)) return;

    this.eliminated.add(color);
    this.winnerOrder.unshift(color); // last eliminated = higher place later

    const scoring = PIECE_SCORE();
    const byColor = CODE_COLOR[byCode];

    if (reason === 'checkmate') {
      this.scores[byColor] = (this.scores[byColor] || 0) + (scoring.checkmate || 20);
    }
    this.scores[byColor] = (this.scores[byColor] || 0) + (scoring.elimination || 10);

    // pieces become "dead" — visually grey; still on board, capturable optionally
    // (we keep them; isDeadColor handles scoring)
  }

  resign(color) {
    if (this.eliminated.has(color)) return;
    this._eliminate(color, 'resign', this.currentCode());
    this.nextTurn();
    this._checkGameEnd();
  }

  timeout(color) {
    if (this.eliminated.has(color)) return;
    this._eliminate(color, 'timeout', this.currentCode());
    this.nextTurn();
    this._checkGameEnd();
  }

  // ─────────────────────────────────────────────
  // Game end & placement
  // ─────────────────────────────────────────────
  _checkGameEnd() {
    const alive = this.colors.filter(c => !this.eliminated.has(c));
    if (alive.length <= 1) {
      this.status = 'finished';
      // final ranking: survivors first by score, then elimination order
      const ranking = this._computeRanking();
      this.winnerOrder = ranking;
      // survival bonus
      const scoring = PIECE_SCORE();
      for (const c of alive) {
        this.scores[c] += scoring.survivalBonus || 5;
      }
    }
  }

  _computeRanking() {
    // 1st = last standing or highest score among survivors
    // then by score, then by who survived longer
    const all = [...this.colors];
    all.sort((a, b) => {
      const aDead = this.eliminated.has(a) ? 1 : 0;
      const bDead = this.eliminated.has(b) ? 1 : 0;
      if (aDead !== bDead) return aDead - bDead; // living first
      return (this.scores[b] || 0) - (this.scores[a] || 0);
    });
    return all; // [1st, 2nd, 3rd, 4th]
  }

  getRanking() {
    if (this.status !== 'finished') return this._computeRanking();
    return this.winnerOrder;
  }

  getPlacement() {
    const order = this.getRanking();
    const map = {};
    order.forEach((color, i) => {
      map[color] = {
        place: i + 1,
        points: this.scores[color] || 0,
        eliminated: this.eliminated.has(color)
      };
    });
    return map;
  }

  // ─────────────────────────────────────────────
  // Start / state
  // ─────────────────────────────────────────────
  start() {
    this.status = 'running';
    this.turnIndex = 0; // red starts
    this.moveNumber = 0;
  }

  getBoard() {
    return this.board.map(row => [...row]);
  }

  getState() {
    return {
      board: this.getBoard(),
      turn: this.currentColor(),
      turnIndex: this.turnIndex,
      scores: { ...this.scores },
      eliminated: [...this.eliminated],
      status: this.status,
      moveNumber: this.moveNumber,
      ranking: this.status === 'finished' ? this.getRanking() : null,
      placement: this.status === 'finished' ? this.getPlacement() : null
    };
  }

  // Serialize for Supabase position_state
  toJSON() {
    return {
      board: this.board,
      turnIndex: this.turnIndex,
      scores: this.scores,
      eliminated: [...this.eliminated],
      status: this.status,
      moveNumber: this.moveNumber,
      winnerOrder: this.winnerOrder
    };
  }

  static fromJSON(data) {
    const g = new FourPlayerChess();
    g.board = data.board;
    g.turnIndex = data.turnIndex;
    g.scores = data.scores;
    g.eliminated = new Set(data.eliminated || []);
    g.status = data.status;
    g.moveNumber = data.moveNumber || 0;
    g.winnerOrder = data.winnerOrder || [];
    return g;
  }

  // Coordinate label for UI (optional)
  squareLabel(r, c) {
    return `${r},${c}`;
  }
}

export default FourPlayerChess;
