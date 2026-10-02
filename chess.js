/**
 * chess.js — CHESS ARENA
 * Complete 8×8 chess rules engine
 * FEN · Legal moves · Check · Checkmate · Stalemate
 * Castling · En passant · Promotion · Move history
 */

const FILES = 'abcdefgh';
const RANKS = '12345678';

const PIECE_VALUES = { P: 1, N: 3, B: 3, R: 5, Q: 9, K: 0 };

export class Chess {
  constructor(fen = null) {
    this.reset(fen);
  }

  // ─────────────────────────────────────────────
  // Reset / Load FEN
  // ─────────────────────────────────────────────
  reset(fen = null) {
    if (fen) {
      this.loadFen(fen);
    } else {
      this.board = this._emptyBoard();
      this._setupStart();
      this.turn = 'w';
      this.castling = { wK: true, wQ: true, bK: true, bQ: true };
      this.epSquare = null;          // {r,c} or null
      this.halfmove = 0;
      this.fullmove = 1;
      this.history = [];
      this.positionHistory = [];     // for threefold
    }
    this._recordPosition();
  }

  _emptyBoard() {
    return Array.from({ length: 8 }, () => Array(8).fill(null));
  }

  _setupStart() {
    const back = ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R'];
    for (let c = 0; c < 8; c++) {
      this.board[0][c] = 'b' + back[c];
      this.board[1][c] = 'bP';
      this.board[6][c] = 'wP';
      this.board[7][c] = 'w' + back[c];
    }
  }

  // ─────────────────────────────────────────────
  // FEN
  // ─────────────────────────────────────────────
  loadFen(fen) {
    const parts = fen.trim().split(/\s+/);
    if (parts.length < 4) throw new Error('Invalid FEN');

    const rows = parts[0].split('/');
    if (rows.length !== 8) throw new Error('Invalid FEN ranks');

    this.board = this._emptyBoard();
    for (let r = 0; r < 8; r++) {
      let c = 0;
      for (const ch of rows[r]) {
        if (ch >= '1' && ch <= '8') {
          c += parseInt(ch, 10);
        } else {
          const color = ch === ch.toUpperCase() ? 'w' : 'b';
          const type = ch.toUpperCase();
          this.board[r][c] = color + type;
          c++;
        }
      }
    }

    this.turn = parts[1] === 'b' ? 'b' : 'w';

    this.castling = { wK: false, wQ: false, bK: false, bQ: false };
    if (parts[2] !== '-') {
      for (const ch of parts[2]) {
        if (ch === 'K') this.castling.wK = true;
        if (ch === 'Q') this.castling.wQ = true;
        if (ch === 'k') this.castling.bK = true;
        if (ch === 'q') this.castling.bQ = true;
      }
    }

    this.epSquare = null;
    if (parts[3] !== '-') {
      const file = FILES.indexOf(parts[3][0]);
      const rank = RANKS.indexOf(parts[3][1]);
      if (file >= 0 && rank >= 0) this.epSquare = { r: 7 - rank, c: file };
    }

    this.halfmove = parts[4] ? parseInt(parts[4], 10) : 0;
    this.fullmove = parts[5] ? parseInt(parts[5], 10) : 1;
    this.history = [];
    this.positionHistory = [];
    this._recordPosition();
  }

  toFen() {
    let fen = '';
    for (let r = 0; r < 8; r++) {
      let empty = 0;
      for (let c = 0; c < 8; c++) {
        const p = this.board[r][c];
        if (!p) {
          empty++;
        } else {
          if (empty) { fen += empty; empty = 0; }
          const ch = p[1];
          fen += p[0] === 'w' ? ch : ch.toLowerCase();
        }
      }
      if (empty) fen += empty;
      if (r < 7) fen += '/';
    }

    fen += ' ' + this.turn;

    let cast = '';
    if (this.castling.wK) cast += 'K';
    if (this.castling.wQ) cast += 'Q';
    if (this.castling.bK) cast += 'k';
    if (this.castling.bQ) cast += 'q';
    fen += ' ' + (cast || '-');

    if (this.epSquare) {
      fen += ' ' + FILES[this.epSquare.c] + RANKS[7 - this.epSquare.r];
    } else {
      fen += ' -';
    }

    fen += ' ' + this.halfmove + ' ' + this.fullmove;
    return fen;
  }

  // ─────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────
  inBounds(r, c) {
    return r >= 0 && r < 8 && c >= 0 && c < 8;
  }

  squareToAlg(r, c) {
    return FILES[c] + RANKS[7 - r];
  }

  algToSquare(alg) {
    const c = FILES.indexOf(alg[0]);
    const r = 7 - RANKS.indexOf(alg[1]);
    return { r, c };
  }

  findKing(color) {
    for (let r = 0; r < 8; r++)
      for (let c = 0; c < 8; c++)
        if (this.board[r][c] === color + 'K') return { r, c };
    return null;
  }

  // ─────────────────────────────────────────────
  // Attack detection
  // ─────────────────────────────────────────────
  isSquareAttacked(r, c, byColor) {
    // Pawns
    const pawnDir = byColor === 'w' ? 1 : -1;
    for (const dc of [-1, 1]) {
      const pr = r + pawnDir, pc = c + dc;
      if (this.inBounds(pr, pc) && this.board[pr][pc] === byColor + 'P') return true;
    }

    // Knights
    const knightJumps = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
    for (const [dr, dc] of knightJumps) {
      const nr = r + dr, nc = c + dc;
      if (this.inBounds(nr, nc) && this.board[nr][nc] === byColor + 'N') return true;
    }

    // King
    for (let dr = -1; dr <= 1; dr++)
      for (let dc = -1; dc <= 1; dc++) {
        if (!dr && !dc) continue;
        const nr = r + dr, nc = c + dc;
        if (this.inBounds(nr, nc) && this.board[nr][nc] === byColor + 'K') return true;
      }

    // Sliding: bishop/queen diagonals
    for (const [dr, dc] of [[-1,-1],[-1,1],[1,-1],[1,1]]) {
      for (let i = 1; i < 8; i++) {
        const nr = r + dr * i, nc = c + dc * i;
        if (!this.inBounds(nr, nc)) break;
        const p = this.board[nr][nc];
        if (!p) continue;
        if (p[0] === byColor && (p[1] === 'B' || p[1] === 'Q')) return true;
        break;
      }
    }

    // Sliding: rook/queen ranks/files
    for (const [dr, dc] of [[-1,0],[1,0],[0,-1],[0,1]]) {
      for (let i = 1; i < 8; i++) {
        const nr = r + dr * i, nc = c + dc * i;
        if (!this.inBounds(nr, nc)) break;
        const p = this.board[nr][nc];
        if (!p) continue;
        if (p[0] === byColor && (p[1] === 'R' || p[1] === 'Q')) return true;
        break;
      }
    }

    return false;
  }

  isInCheck(color = this.turn) {
    const k = this.findKing(color);
    if (!k) return true;
    return this.isSquareAttacked(k.r, k.c, color === 'w' ? 'b' : 'w');
  }

  // ─────────────────────────────────────────────
  // Pseudo-legal moves (before check filter)
  // ─────────────────────────────────────────────
  _pseudoMoves(r, c) {
    const piece = this.board[r][c];
    if (!piece) return [];
    const color = piece[0];
    const type = piece[1];
    const moves = [];

    const add = (nr, nc, extra = {}) => {
      if (!this.inBounds(nr, nc)) return;
      const target = this.board[nr][nc];
      if (target && target[0] === color) return;
      moves.push({
        from: { r, c },
        to: { r: nr, c: nc },
        piece,
        capture: target || null,
        ...extra
      });
    };

    if (type === 'P') {
      const dir = color === 'w' ? -1 : 1;
      const startRank = color === 'w' ? 6 : 1;
      const promoRank = color === 'w' ? 0 : 7;

      // forward
      if (this.inBounds(r + dir, c) && !this.board[r + dir][c]) {
        if (r + dir === promoRank) {
          for (const promo of ['Q', 'R', 'B', 'N']) {
            add(r + dir, c, { promotion: promo });
          }
        } else {
          add(r + dir, c);
          if (r === startRank && !this.board[r + 2 * dir][c]) {
            add(r + 2 * dir, c, { doublePawn: true });
          }
        }
      }

      // captures
      for (const dc of [-1, 1]) {
        const nr = r + dir, nc = c + dc;
        if (!this.inBounds(nr, nc)) continue;
        const target = this.board[nr][nc];
        if (target && target[0] !== color) {
          if (nr === promoRank) {
            for (const promo of ['Q', 'R', 'B', 'N']) {
              add(nr, nc, { promotion: promo });
            }
          } else {
            add(nr, nc);
          }
        }
        // en passant
        if (this.epSquare && this.epSquare.r === nr && this.epSquare.c === nc) {
          add(nr, nc, { enPassant: true });
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
        for (let i = 1; i < 8; i++) {
          const nr = r + dr * i, nc = c + dc * i;
          if (!this.inBounds(nr, nc)) break;
          const target = this.board[nr][nc];
          if (!target) {
            add(nr, nc);
          } else {
            if (target[0] !== color) add(nr, nc);
            break;
          }
        }
      }
    }

    if (type === 'R' || type === 'Q') {
      for (const [dr, dc] of [[-1,0],[1,0],[0,-1],[0,1]]) {
        for (let i = 1; i < 8; i++) {
          const nr = r + dr * i, nc = c + dc * i;
          if (!this.inBounds(nr, nc)) break;
          const target = this.board[nr][nc];
          if (!target) {
            add(nr, nc);
          } else {
            if (target[0] !== color) add(nr, nc);
            break;
          }
        }
      }
    }

    if (type === 'K') {
      for (let dr = -1; dr <= 1; dr++)
        for (let dc = -1; dc <= 1; dc++)
          if (dr || dc) add(r + dr, c + dc);

      // Castling
      if (!this.isInCheck(color)) {
        const rank = color === 'w' ? 7 : 0;
        if (r === rank && c === 4) {
          // kingside
          if (this.castling[color + 'K'] &&
              !this.board[rank][5] && !this.board[rank][6] &&
              this.board[rank][7] === color + 'R' &&
              !this.isSquareAttacked(rank, 5, color === 'w' ? 'b' : 'w') &&
              !this.isSquareAttacked(rank, 6, color === 'w' ? 'b' : 'w')) {
            add(rank, 6, { castle: 'K' });
          }
          // queenside
          if (this.castling[color + 'Q'] &&
              !this.board[rank][3] && !this.board[rank][2] && !this.board[rank][1] &&
              this.board[rank][0] === color + 'R' &&
              !this.isSquareAttacked(rank, 3, color === 'w' ? 'b' : 'w') &&
              !this.isSquareAttacked(rank, 2, color === 'w' ? 'b' : 'w')) {
            add(rank, 2, { castle: 'Q' });
          }
        }
      }
    }

    return moves;
  }

  // ─────────────────────────────────────────────
  // Legal moves (filter checks)
  // ─────────────────────────────────────────────
  getLegalMoves(r, c) {
    const piece = this.board[r][c];
    if (!piece || piece[0] !== this.turn) return [];

    const pseudo = this._pseudoMoves(r, c);
    const legal = [];

    for (const m of pseudo) {
      this._makeTemp(m);
      if (!this.isInCheck(this.turn)) legal.push(m);
      this._undoTemp(m);
    }
    return legal;
  }

  getAllLegalMoves(color = this.turn) {
    const all = [];
    for (let r = 0; r < 8; r++)
      for (let c = 0; c < 8; c++)
        if (this.board[r][c] && this.board[r][c][0] === color)
          all.push(...this.getLegalMoves(r, c));
    return all;
  }

  // Temporary make/undo for legality test (no history side-effects)
  _makeTemp(m) {
    m._saved = {
      fromPiece: this.board[m.from.r][m.from.c],
      toPiece: this.board[m.to.r][m.to.c],
      ep: this.epSquare,
      castling: { ...this.castling }
    };

    this.board[m.to.r][m.to.c] = m.promotion
      ? m.piece[0] + m.promotion
      : m.piece;
    this.board[m.from.r][m.from.c] = null;

    if (m.enPassant) {
      const capR = m.from.r;
      m._saved.epCaptured = this.board[capR][m.to.c];
      this.board[capR][m.to.c] = null;
    }

    if (m.castle) {
      const rank = m.from.r;
      if (m.castle === 'K') {
        this.board[rank][5] = this.board[rank][7];
        this.board[rank][7] = null;
      } else {
        this.board[rank][3] = this.board[rank][0];
        this.board[rank][0] = null;
      }
    }
  }

  _undoTemp(m) {
    this.board[m.from.r][m.from.c] = m._saved.fromPiece;
    this.board[m.to.r][m.to.c] = m._saved.toPiece;
    this.epSquare = m._saved.ep;
    this.castling = m._saved.castling;

    if (m.enPassant && m._saved.epCaptured !== undefined) {
      this.board[m.from.r][m.to.c] = m._saved.epCaptured;
    }

    if (m.castle) {
      const rank = m.from.r;
      if (m.castle === 'K') {
        this.board[rank][7] = this.board[rank][5];
        this.board[rank][5] = null;
      } else {
        this.board[rank][0] = this.board[rank][3];
        this.board[rank][3] = null;
      }
    }
  }

  // ─────────────────────────────────────────────
  // Make move (permanent)
  // ─────────────────────────────────────────────
  move(from, to, promotion = 'Q') {
    // from/to can be {r,c} or algebraic "e2"
    if (typeof from === 'string') from = this.algToSquare(from);
    if (typeof to === 'string') to = this.algToSquare(to);

    const legal = this.getLegalMoves(from.r, from.c);
    let m = legal.find(x => x.to.r === to.r && x.to.c === to.c);

    if (!m) return null;

    // if promotion needed and multiple options, pick requested
    if (m.promotion) {
      m = legal.find(x =>
        x.to.r === to.r && x.to.c === to.c && x.promotion === promotion
      ) || m;
    }

    return this._applyMove(m);
  }

  /** Apply UCI move string e.g. "e2e4" or "e7e8q" */
  moveUci(uci) {
    if (!uci || uci.length < 4) return null;
    const from = this.algToSquare(uci.slice(0, 2));
    const to = this.algToSquare(uci.slice(2, 4));
    const promo = uci[4] ? uci[4].toUpperCase() : 'Q';
    return this.move(from, to, promo);
  }

  _applyMove(m) {
    const snapshot = {
      board: this.board.map(row => [...row]),
      turn: this.turn,
      castling: { ...this.castling },
      epSquare: this.epSquare ? { ...this.epSquare } : null,
      halfmove: this.halfmove,
      fullmove: this.fullmove
    };

    const piece = m.piece;
    const color = piece[0];

    // halfmove clock
    if (piece[1] === 'P' || m.capture || m.enPassant) this.halfmove = 0;
    else this.halfmove++;

    // execute
    this.board[m.to.r][m.to.c] = m.promotion ? color + m.promotion : piece;
    this.board[m.from.r][m.from.c] = null;

    if (m.enPassant) {
      this.board[m.from.r][m.to.c] = null;
    }

    if (m.castle) {
      const rank = m.from.r;
      if (m.castle === 'K') {
        this.board[rank][5] = this.board[rank][7];
        this.board[rank][7] = null;
      } else {
        this.board[rank][3] = this.board[rank][0];
        this.board[rank][0] = null;
      }
    }

    // castling rights
    if (piece[1] === 'K') {
      this.castling[color + 'K'] = false;
      this.castling[color + 'Q'] = false;
    }
    if (piece[1] === 'R') {
      if (m.from.r === (color === 'w' ? 7 : 0)) {
        if (m.from.c === 0) this.castling[color + 'Q'] = false;
        if (m.from.c === 7) this.castling[color + 'K'] = false;
      }
    }
    // captured rook
    if (m.capture && m.capture[1] === 'R') {
      const opp = color === 'w' ? 'b' : 'w';
      const rank = opp === 'w' ? 7 : 0;
      if (m.to.r === rank) {
        if (m.to.c === 0) this.castling[opp + 'Q'] = false;
        if (m.to.c === 7) this.castling[opp + 'K'] = false;
      }
    }

    // en passant target
    this.epSquare = null;
    if (m.doublePawn) {
      this.epSquare = { r: (m.from.r + m.to.r) >> 1, c: m.from.c };
    }

    // notation
    const notation = this._toNotation(m);

    // turn
    this.turn = color === 'w' ? 'b' : 'w';
    if (this.turn === 'w') this.fullmove++;

    const result = {
      ...m,
      notation,
      fen: this.toFen(),
      san: notation
    };

    this.history.push({ move: result, snapshot });
    this._recordPosition();

    return result;
  }

  _toNotation(m) {
    if (m.castle === 'K') return 'O-O';
    if (m.castle === 'Q') return 'O-O-O';

    const piece = m.piece[1] === 'P' ? '' : m.piece[1];
    const capture = (m.capture || m.enPassant) ? 'x' : '';
    const dest = this.squareToAlg(m.to.r, m.to.c);
    let promo = m.promotion ? '=' + m.promotion : '';

    // disambiguation (simple)
    let dis = '';
    if (m.piece[1] !== 'P' && m.piece[1] !== 'K') {
      const others = this.getAllLegalMoves(m.piece[0]).filter(x =>
        x.piece === m.piece &&
        x.to.r === m.to.r && x.to.c === m.to.c &&
        (x.from.r !== m.from.r || x.from.c !== m.from.c)
      );
      if (others.length) {
        const sameFile = others.some(x => x.from.c === m.from.c);
        const sameRank = others.some(x => x.from.r === m.from.r);
        if (!sameFile) dis = FILES[m.from.c];
        else if (!sameRank) dis = RANKS[7 - m.from.r];
        else dis = FILES[m.from.c] + RANKS[7 - m.from.r];
      }
    }

    if (m.piece[1] === 'P' && (m.capture || m.enPassant)) {
      return FILES[m.from.c] + 'x' + dest + promo;
    }

    return piece + dis + capture + dest + promo;
  }

  undo() {
    if (!this.history.length) return null;
    const last = this.history.pop();
    this.board = last.snapshot.board;
    this.turn = last.snapshot.turn;
    this.castling = last.snapshot.castling;
    this.epSquare = last.snapshot.epSquare;
    this.halfmove = last.snapshot.halfmove;
    this.fullmove = last.snapshot.fullmove;
    this.positionHistory.pop();
    return last.move;
  }

  // ─────────────────────────────────────────────
  // Game end
  // ─────────────────────────────────────────────
  isCheckmate(color = this.turn) {
    return this.isInCheck(color) && this.getAllLegalMoves(color).length === 0;
  }

  isStalemate(color = this.turn) {
    return !this.isInCheck(color) && this.getAllLegalMoves(color).length === 0;
  }

  isDraw() {
    if (this.isStalemate()) return true;
    if (this.halfmove >= 100) return true; // 50-move rule
    if (this._isInsufficientMaterial()) return true;
    if (this._isThreefold()) return true;
    return false;
  }

  gameResult() {
    if (this.isCheckmate('w')) return { result: '0-1', reason: 'checkmate' };
    if (this.isCheckmate('b')) return { result: '1-0', reason: 'checkmate' };
    if (this.isStalemate()) return { result: '1/2-1/2', reason: 'stalemate' };
    if (this.halfmove >= 100) return { result: '1/2-1/2', reason: 'fifty-move' };
    if (this._isInsufficientMaterial()) return { result: '1/2-1/2', reason: 'insufficient' };
    if (this._isThreefold()) return { result: '1/2-1/2', reason: 'threefold' };
    return null;
  }

  _isInsufficientMaterial() {
    const pieces = [];
    for (let r = 0; r < 8; r++)
      for (let c = 0; c < 8; c++)
        if (this.board[r][c]) pieces.push(this.board[r][c]);

    const nonKing = pieces.filter(p => p[1] !== 'K');
    if (nonKing.length === 0) return true; // K vs K
    if (nonKing.length === 1 && (nonKing[0][1] === 'N' || nonKing[0][1] === 'B')) return true;
    if (nonKing.length === 2 &&
        nonKing[0][1] === 'B' && nonKing[1][1] === 'B' &&
        nonKing[0][0] !== nonKing[1][0]) {
      // opposite color bishops — approximate
      return true;
    }
    return false;
  }

  _recordPosition() {
    // simplified key: board + turn + castling + ep
    const key = this.toFen().split(' ').slice(0, 4).join(' ');
    this.positionHistory.push(key);
  }

  _isThreefold() {
    const key = this.positionHistory[this.positionHistory.length - 1];
    return this.positionHistory.filter(k => k === key).length >= 3;
  }

  // ─────────────────────────────────────────────
  // Board copy / export
  // ─────────────────────────────────────────────
  getBoard() {
    return this.board.map(row => [...row]);
  }

  clone() {
    const c = new Chess();
    c.board = this.board.map(row => [...row]);
    c.turn = this.turn;
    c.castling = { ...this.castling };
    c.epSquare = this.epSquare ? { ...this.epSquare } : null;
    c.halfmove = this.halfmove;
    c.fullmove = this.fullmove;
    c.history = [...this.history];
    c.positionHistory = [...this.positionHistory];
    return c;
  }
}

export default Chess;
