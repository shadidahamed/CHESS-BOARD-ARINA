import { Board3D } from './board-3d.js';/**
 * app.js — CHESS ARENA
 * Router · Auth hooks · Game flows · Invite · AI · 4P entry
 */

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import {
  PRODUCT_NAME,
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  TIME_CONTROL_PRESETS,
  GAME_CONFIG
} from './config.js';
import { UI } from './ui.js';
import { Chess } from './chess.js';
import { FourPlayerChess } from './chess-fourplayer.js';
import { ChessAI } from './chess-ai.js';
import { createPrivateGame, joinByInvite } from './invitation.js';
import { subscribeToGame } from './realtime.js';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const ui = new UI();

let currentUser = null;
let profile = null;
let unsubGame = null;
let aiEngine = null;
let chess = null;
let chess4 = null;
let selectedSq = null;
let legalMoves = [];
let view3d = true;

// ─────────────────────────────────────────────
// Boot
// ─────────────────────────────────────────────
async function boot() {
  document.getElementById('logo')?.addEventListener('click', () => location.hash = '#/');

  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user) {
    currentUser = session.user;
    await loadProfile();
  }

  supabase.auth.onAuthStateChange(async (event, session) => {
    currentUser = session?.user ?? null;
    if (currentUser) await loadProfile();
    else profile = null;
    ui.renderNav(profile);
    route();
  });

  window.addEventListener('hashchange', route);
  ui.renderNav(profile);
  route();

  // Global logout
  document.body.addEventListener('click', async (e) => {
    if (e.target.id === 'btn-logout') {
      await supabase.auth.signOut();
      location.hash = '#/';
    }
  });
}

async function loadProfile() {
  if (!currentUser) return;
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', currentUser.id)
    .single();
  if (!error) profile = data;
}

// ─────────────────────────────────────────────
// Router
// ─────────────────────────────────────────────
function route() {
  cleanupGame();
  const hash = location.hash || '#/';
  const [path, query] = hash.replace(/^#/, '').split('?');
  const parts = path.split('/').filter(Boolean);
  const params = new URLSearchParams(query || location.search);

  // Invite deep link: ?game=ID&invite=TOKEN
  const inviteToken = params.get('invite') || new URLSearchParams(location.search).get('invite');
  const gameId = params.get('game') || new URLSearchParams(location.search).get('game');

  if (inviteToken && gameId) {
    handleInviteLanding(gameId, inviteToken);
    return;
  }

  const page = parts[0] || '';

  switch (page) {
    case '':
      ui.pageHome(profile);
      break;
    case 'play':
      ui.pagePlay();
      break;
    case 'ai':
      ui.pageAI();
      bindAIPage();
      break;
    case 'private':
      requireAuth(() => {
        ui.pagePrivate();
        bindPrivatePage();
      });
      break;
    case 'four':
      requireAuth(() => {
        ui.pageFour();
        bindFourPage();
      });
      break;
    case 'login':
      ui.pageLogin();
      bindLogin();
      break;
    case 'register':
      ui.pageRegister();
      bindRegister();
      break;
    case 'profile':
      requireAuth(() => ui.pageProfile(profile));
      break;
    case 'history':
      requireAuth(() => loadHistory());
      break;
    case 'leaderboard':
      loadLeaderboard();
      break;
    case 'rules':
      ui.pageRules();
      break;
    case 'settings':
      requireAuth(() => {
        ui.pageSettings(profile);
        bindSettings();
      });
      break;
    case 'game':
      requireAuth(() => openGame(parts[1]));
      break;
    default:
      ui.pageHome(profile);
  }
}

function requireAuth(fn) {
  if (!currentUser) {
    ui.toast('Login required', 'warn');
    location.hash = '#/login';
    return;
  }
  fn();
}

function cleanupGame() {
  if (unsubGame) {
    unsubGame();
    unsubGame = null;
  }
  if (aiEngine) {
    aiEngine.destroy();
    aiEngine = null;
  }
  selectedSq = null;
  legalMoves = [];
  chess = null;
  chess4 = null;
}

// ─────────────────────────────────────────────
// Auth forms
// ─────────────────────────────────────────────
function bindLogin() {
  const form = document.getElementById('form-login');
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    ui.pageLoading('Signing in…');
    const { error } = await supabase.auth.signInWithPassword({
      email: fd.get('email'),
      password: fd.get('password')
    });
    if (error) {
      ui.pageLogin();
      bindLogin();
      ui.toast(error.message, 'error');
      return;
    }
    location.hash = '#/';
  });
}

function bindRegister() {
  const form = document.getElementById('form-register');
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const username = String(fd.get('username')).trim();
    const display_name = String(fd.get('display_name')).trim();
    ui.pageLoading('Creating account…');
    const { data, error } = await supabase.auth.signUp({
      email: fd.get('email'),
      password: fd.get('password'),
      options: {
        data: { username, display_name }
      }
    });
    if (error) {
      ui.pageRegister();
      bindRegister();
      ui.toast(error.message, 'error');
      return;
    }
    ui.toast('Account created. Check email if confirmation is required.', 'info');
    location.hash = '#/';
  });
}

function bindSettings() {
  document.getElementById('form-settings')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const display_name = String(fd.get('display_name')).trim();
    const { error } = await supabase
      .from('profiles')
      .update({ display_name })
      .eq('id', currentUser.id);
    if (error) ui.toast(error.message, 'error');
    else {
      await loadProfile();
      ui.toast('Saved', 'info');
      ui.renderNav(profile);
    }
    // local prefs
    localStorage.setItem('ca_theme', fd.get('theme'));
    localStorage.setItem('ca_sound', fd.get('sound'));
  });
}

// ─────────────────────────────────────────────
// AI game
// ─────────────────────────────────────────────

let board3d = null;

async function startAIGame() {
  const colorSel = document.getElementById('ai-color')?.value || 'w';
  const diff = document.getElementById('ai-diff')?.value || 'Intermediate';
  const style = document.getElementById('ai-style')?.value || 'Balanced';

  let humanColor = colorSel;
  if (colorSel === 'random') humanColor = Math.random() < 0.5 ? 'w' : 'b';

  chess = new Chess();
  aiEngine = new ChessAI();
  await aiEngine.init();

  ui.showQuote('start');
  selectedSq = null;
  legalMoves = [];
  window.__aiCtx = { humanColor, diff, style };
  window.__lastMove = null;

  // destroy previous 3d
  if (board3d) {
  board3d.destroy();
  board3d = null;
}

  const container = document.getElementById('board-3d');
  const board2d = document.getElementById('board-2d');
  if (container) {
    container.classList.remove('hidden');
    if (board2d) board2d.classList.add('hidden');

    board3d = new Board3D(container, {
      flipped: humanColor === 'b',
      onSquareClick: (r, c) => onBoardClick3D(r, c, humanColor)
    });
  }

  refreshBoard3D(humanColor);

  document.getElementById('btn-undo')?.addEventListener('click', () => {
    if (!chess) return;
    chess.undo();
    if (chess.turn !== humanColor) chess.undo();
    window.__lastMove = null;
    selectedSq = null;
    legalMoves = [];
    refreshBoard3D(humanColor);
  });

  document.getElementById('btn-resign')?.addEventListener('click', () => {
    document.getElementById('game-status').textContent = 'You resigned';
    ui.showQuote('mate');
    chess = null;
  });

  document.getElementById('btn-flip')?.addEventListener('click', () => {
    if (board3d) {
      board3d.setFlipped(!board3d.flipped);
      refreshBoard3D(humanColor);
    }
  });

  document.getElementById('btn-view2d')?.addEventListener('click', () => {
    view3d = !view3d;
    if (view3d) {
      container?.classList.remove('hidden');
      board2d?.classList.add('hidden');
      refreshBoard3D(humanColor);
    } else {
      container?.classList.add('hidden');
      board2d?.classList.remove('hidden');
      renderBoard2D(humanColor);
    }
  });

  aiEngine.onMove = (uci) => {
    if (!chess) return;
    const res = chess.moveUci(uci);
    if (res) {
      window.__lastMove = { from: res.from, to: res.to };
      quoteCapture(res);
      selectedSq = null;
      legalMoves = [];
      refreshBoard3D(humanColor);
      if (!view3d) renderBoard2D(humanColor);
      checkGameEnd();
    }
  };

  if (chess.turn !== humanColor) {
    document.getElementById('game-status').textContent = 'AI thinking…';
    aiEngine.think(chess.toFen(), diff, style);
  } else {
    document.getElementById('game-status').textContent = 'Your move';
  }
}

function refreshBoard3D(humanColor) {
  if (!board3d || !chess) return;

  let checkKing = null;
  if (chess.isInCheck()) {
    checkKing = chess.findKing(chess.turn);
  }

  board3d.setPosition(chess.getBoard(), {
    selected: selectedSq,
    legal: legalMoves,
    lastMove: window.__lastMove,
    checkKing
  });
}

function onBoardClick3D(r, c, humanColor) {
  if (!chess || chess.turn !== humanColor) return;

  const piece = chess.board[r][c];

  if (selectedSq) {
    const move = legalMoves.find(m => m.to.r === r && m.to.c === c);
    if (move) {
      const res = chess.move(
        { r: selectedSq.r, c: selectedSq.c },
        { r, c }
      );
      selectedSq = null;
      legalMoves = [];
      if (res) {
        window.__lastMove = { from: res.from, to: res.to };
        quoteCapture(res);
      }
      refreshBoard3D(humanColor);
      if (!view3d) renderBoard2D(humanColor);
      if (checkGameEnd()) return;

      const ctx = window.__aiCtx;
      document.getElementById('game-status').textContent = 'AI thinking…';
      aiEngine?.think(chess.toFen(), ctx?.diff, ctx?.style);
      return;
    }
  }

  if (piece && piece[0] === humanColor) {
    selectedSq = { r, c };
    legalMoves = chess.getLegalMoves(r, c);
  } else {
    selectedSq = null;
    legalMoves = [];
  }
  refreshBoard3D(humanColor);
  if (!view3d) renderBoard2D(humanColor);
}

function quoteCapture(res) {
  if (!res?.capture) return;
  const t = res.capture[1];
  if (t === 'Q') ui.showQuote('queen');
  else if (t === 'R') ui.showQuote('rook');
  else if (t === 'N') ui.showQuote('knight');
  else if (t === 'B') ui.showQuote('bishop');
  else if (t === 'P') ui.showQuote('pawn');
}
  // For now render 2D grid; 3D integration in next file
  renderBoard2D(humanColor);

  document.getElementById('btn-undo')?.addEventListener('click', () => {
    if (!chess) return;
    chess.undo();
    if (humanColor === 'w' && chess.turn === 'b') chess.undo();
    if (humanColor === 'b' && chess.turn === 'w') chess.undo();
    renderBoard2D(humanColor);
  });

  document.getElementById('btn-resign')?.addEventListener('click', () => {
    document.getElementById('game-status').textContent = 'You resigned';
    ui.showQuote('mate');
    chess = null;
  });

  document.getElementById('btn-flip')?.addEventListener('click', () => {
    // simple re-render flipped flag could be added
    renderBoard2D(humanColor);
  });

  aiEngine.onMove = (uci) => {
    if (!chess) return;
    const res = chess.moveUci(uci);
    if (res) {
      if (res.capture) {
        const t = res.capture[1];
        if (t === 'Q') ui.showQuote('queen');
        else if (t === 'R') ui.showQuote('rook');
        else if (t === 'N') ui.showQuote('knight');
        else if (t === 'B') ui.showQuote('bishop');
        else if (t === 'P') ui.showQuote('pawn');
      }
      renderBoard2D(humanColor);
      checkGameEnd();
    }
  };

  if (chess.turn !== humanColor) {
    document.getElementById('game-status').textContent = 'AI thinking…';
    aiEngine.think(chess.toFen(), diff, style);
  } else {
    document.getElementById('game-status').textContent = 'Your move';
  }

  // store for click handler
  window.__aiCtx = { humanColor, diff, style };
}

function renderBoard2D(humanColor) {
  const el = document.getElementById('board-2d');
  if (!el || !chess) return;
  el.classList.remove('hidden');
  const board3 = document.getElementById('board-3d');
  if (board3) board3.classList.add('hidden');

  const flipped = humanColor === 'b';
  el.innerHTML = '';
  el.className = 'board-2d';

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const dr = flipped ? 7 - r : r;
      const dc = flipped ? 7 - c : c;
      const sq = document.createElement('div');
      sq.className = 'sq ' + ((dr + dc) % 2 === 0 ? 'light' : 'dark');
      const piece = chess.board[dr][dc];
      if (piece) sq.textContent = pieceGlyph(piece);

      if (selectedSq && selectedSq.r === dr && selectedSq.c === dc)
        sq.classList.add('selected');

      const isLegal = legalMoves.some(m => m.to.r === dr && m.to.c === dc);
      if (isLegal) sq.classList.add(chess.board[dr][dc] ? 'capture' : 'legal');

      sq.onclick = () => onBoardClick(dr, dc, humanColor);
      el.appendChild(sq);
    }
  }
}

function pieceGlyph(p) {
  const map = {
    wK: '♔', wQ: '♕', wR: '♖', wB: '♗', wN: '♘', wP: '♙',
    bK: '♚', bQ: '♛', bR: '♜', bB: '♝', bN: '♞', bP: '♟'
  };
  return map[p] || '';
}

function onBoardClick(r, c, humanColor) {
  if (!chess || chess.turn !== humanColor) return;

  const piece = chess.board[r][c];

  if (selectedSq) {
    const move = legalMoves.find(m => m.to.r === r && m.to.c === c);
    if (move) {
      const res = chess.move({ r: selectedSq.r, c: selectedSq.c }, { r, c });
      selectedSq = null;
      legalMoves = [];
      if (res?.capture) {
        const t = res.capture[1];
        if (t === 'Q') ui.showQuote('queen');
        else if (t === 'R') ui.showQuote('rook');
        else if (t === 'P') ui.showQuote('pawn');
      }
      renderBoard2D(humanColor);
      if (checkGameEnd()) return;

      const ctx = window.__aiCtx;
      document.getElementById('game-status').textContent = 'AI thinking…';
      aiEngine?.think(chess.toFen(), ctx?.diff, ctx?.style);
      return;
    }
  }

  if (piece && piece[0] === humanColor) {
    selectedSq = { r, c };
    legalMoves = chess.getLegalMoves(r, c);
  } else {
    selectedSq = null;
    legalMoves = [];
  }
  renderBoard2D(humanColor);
}

function checkGameEnd() {
  if (!chess) return false;
  const end = chess.gameResult();
  if (end) {
    document.getElementById('game-status').textContent =
      end.reason === 'checkmate'
        ? (end.result === '1-0' ? 'Checkmate — White wins' : 'Checkmate — Black wins')
        : `Draw (${end.reason})`;
    ui.showQuote('mate');
    return true;
  }
  if (chess.isInCheck()) ui.showQuote('check');
  document.getElementById('game-status').textContent =
    chess.turn === (window.__aiCtx?.humanColor || 'w') ? 'Your move' : 'AI thinking…';
  return false;
}

// ─────────────────────────────────────────────
// Private 1v1
// ─────────────────────────────────────────────
function bindPrivatePage() {
  document.getElementById('btn-create-1v1')?.addEventListener('click', async () => {
    try {
      const color = document.getElementById('p1-color')?.value || 'white';
      const tc = document.getElementById('p1-time')?.value || '5+3';
      const preset = TIME_CONTROL_PRESETS[tc] || { initial: 300, increment: 3 };

      ui.toast('Creating game…');
      const { game, link } = await createPrivateGame(currentUser.id, {
        fourPlayer: false,
        color,
        initial: preset.initial,
        increment: preset.increment
      });

      ui.renderInvitePanel({
        link,
        gameId: game.id,
        maxPlayers: 2,
        players: [{ display_name: profile?.display_name, color: color === 'random' ? 'white' : color }]
      });

      document.getElementById('btn-copy-invite')?.addEventListener('click', () => {
        navigator.clipboard.writeText(link);
        ui.toast('Link copied');
      });

      document.getElementById('btn-cancel-invite')?.addEventListener('click', async () => {
        await supabase.from('games').update({ status: 'aborted' }).eq('id', game.id);
        location.hash = '#/private';
      });

      unsubGame = subscribeToGame(game.id, {
        onPlayers: async () => {
          const { data: players } = await supabase
            .from('game_players')
            .select('*, profiles(display_name, username)')
            .eq('game_id', game.id);
          const mapped = (players || []).map(p => ({
            display_name: p.profiles?.display_name,
            username: p.profiles?.username,
            color: p.color
          }));
          ui.renderInvitePanel({ link, gameId: game.id, maxPlayers: 2, players: mapped });
          if (mapped.length >= 2) {
            location.hash = `#/game/${game.id}`;
          }
        }
      });
    } catch (err) {
      ui.toast(err.message || 'Failed to create game', 'error');
    }
  });
}

// ─────────────────────────────────────────────
// Four player lobby
// ─────────────────────────────────────────────
function bindFourPage() {
  document.getElementById('btn-create-4p')?.addEventListener('click', async () => {
    try {
      const tc = document.getElementById('p4-time')?.value || '5+0';
      const preset = TIME_CONTROL_PRESETS[tc] || { initial: 300, increment: 0 };

      const { game, link } = await createPrivateGame(currentUser.id, {
        fourPlayer: true,
        initial: preset.initial,
        increment: preset.increment
      });

      ui.renderInvitePanel({
        link,
        gameId: game.id,
        maxPlayers: 4,
        players: [{ display_name: profile?.display_name, color: 'red' }]
      });

      document.getElementById('btn-copy-invite')?.addEventListener('click', () => {
        navigator.clipboard.writeText(link);
        ui.toast('Link copied');
      });

      unsubGame = subscribeToGame(game.id, {
        onPlayers: async () => {
          const { data: players } = await supabase
            .from('game_players')
            .select('*, profiles(display_name, username)')
            .eq('game_id', game.id)
            .order('seat');
          const mapped = (players || []).map(p => ({
            display_name: p.profiles?.display_name,
            color: p.color
          }));
          ui.renderInvitePanel({ link, gameId: game.id, maxPlayers: 4, players: mapped });
          if (mapped.length >= 4) {
            await supabase.from('games').update({ status: 'running', started_at: new Date().toISOString() }).eq('id', game.id);
            location.hash = `#/game/${game.id}`;
          }
        }
      });
    } catch (err) {
      ui.toast(err.message || 'Failed', 'error');
    }
  });
}

// ─────────────────────────────────────────────
// Invite landing
// ─────────────────────────────────────────────
async function handleInviteLanding(gameId, token) {
  ui.pageLoading('Checking invitation…');
  try {
    if (!currentUser) {
      sessionStorage.setItem('pending_invite', JSON.stringify({ gameId, token }));
      ui.toast('Login to accept invitation');
      location.hash = '#/login';
      return;
    }

    const { data: inv } = await supabase
      .from('invitations')
      .select('*, games(*, profiles:host_id(display_name))')
      .eq('token', token)
      .maybeSingle();

    if (!inv || inv.status !== 'active') {
      ui.pageError('Invalid or expired invitation.');
      return;
    }

    const game = inv.games;
    ui.pageLobbyJoin({
      hostName: game?.profiles?.display_name,
      gameType: game?.game_type,
      timeControl: `${game?.time_control}+${game?.increment}`,
      status: game?.status,
      canAccept: game?.status === 'lobby' || game?.status === 'waiting'
    });

    document.getElementById('btn-accept-invite')?.addEventListener('click', async () => {
      try {
        await joinByInvite(token, currentUser.id);
        ui.toast('Joined');
        location.hash = `#/game/${gameId}`;
      } catch (err) {
        ui.toast(err.message, 'error');
      }
    });

    document.getElementById('btn-decline-invite')?.addEventListener('click', () => {
      location.hash = '#/';
    });
  } catch (err) {
    ui.pageError(err.message || 'Invitation error');
  }
}

async function openGame(gameId) {
  if (!gameId) return;
  ui.pageLoading('Loading game…');
  const { data: game, error } = await supabase
    .from('games')
    .select('*')
    .eq('id', gameId)
    .single();
  if (error || !game) {
    ui.pageError('Game not found');
    return;
  }

  const { data: players } = await supabase
    .from('game_players')
    .select('*, profiles(display_name, username)')
    .eq('game_id', gameId);

  if (game.game_type === 'private_4p') {
    chess4 = game.position_state?.board
      ? FourPlayerChess.fromJSON(game.position_state)
      : new FourPlayerChess();
    if (game.status === 'running' || players?.length >= 4) chess4.start();

    ui.pageGame4p({
      players: (players || []).map(p => ({
        display_name: p.profiles?.display_name,
        color: p.color,
        remaining_time: p.remaining_time,
        points: p.points,
        eliminated: p.status === 'eliminated',
        isTurn: chess4.currentColor() === p.color
      })),
      statusText: `Turn: ${chess4.currentColor()}`
    });
    // 4p board render placeholder — full UI in 3D/2D step
    renderFourBoard();
  } else {
    chess = new Chess(game.position_state?.fen || undefined);
    const you = players?.find(p => p.user_id === currentUser.id);
    const opp = players?.find(p => p.user_id !== currentUser.id);
    ui.pageGame1v1({
      you: you?.profiles,
      opponent: opp?.profiles,
      yourColor: you?.color,
      timeYou: you?.remaining_time,
      timeOpp: opp?.remaining_time,
      statusText: game.status
    });
    renderBoard2D(you?.color === 'black' ? 'b' : 'w');
  }

  unsubGame = subscribeToGame(gameId, {
    onMove: () => openGame(gameId),
    onGame: () => openGame(gameId),
    onPlayers: () => openGame(gameId)
  });
}

function renderFourBoard() {
  const el = document.getElementById('board-4p');
  if (!el || !chess4) return;
  el.innerHTML = '';
  el.className = 'board-4p';
  // compact visual: only playable cells as grid is large — CSS will size
  for (let r = 0; r < 14; r++) {
    for (let c = 0; c < 14; c++) {
      const cell = document.createElement('div');
      if (!chess4.isPlayable(r, c)) {
        cell.className = 'sq4 void';
      } else {
        cell.className = 'sq4 ' + ((r + c) % 2 === 0 ? 'light' : 'dark');
        const p = chess4.board[r][c];
        if (p) cell.textContent = fourGlyph(p);
        cell.onclick = () => onFourClick(r, c);
      }
      el.appendChild(cell);
    }
  }
}

function fourGlyph(p) {
  const type = p[1];
  const map = { K: '♚', Q: '♛', R: '♜', B: '♝', N: '♞', P: '♟' };
  return map[type] || p;
}

function onFourClick(r, c) {
  if (!chess4 || chess4.status !== 'running') return;
  // only own color — need seat mapping; simplified: allow current turn pieces
  const code = chess4.currentCode();
  const piece = chess4.board[r][c];

  if (selectedSq) {
    const moves = chess4.getLegalMoves(selectedSq.r, selectedSq.c);
    const m = moves.find(x => x.to.r === r && x.to.c === c);
    if (m) {
      chess4.move(selectedSq.r, selectedSq.c, r, c);
      selectedSq = null;
      renderFourBoard();
      document.getElementById('game-status').textContent = `Turn: ${chess4.currentColor()}`;
      return;
    }
  }

  if (piece && piece[0] === code) {
    selectedSq = { r, c };
  } else {
    selectedSq = null;
  }
  renderFourBoard();
}

// ─────────────────────────────────────────────
// History / Leaderboard
// ─────────────────────────────────────────────
async function loadHistory() {
  ui.pageLoading('Loading history…');
  const { data } = await supabase
    .from('games')
    .select('id, game_type, result, created_at, ended_at, status')
    .or(`host_id.eq.${currentUser.id}`)
    .order('created_at', { ascending: false })
    .limit(50);
  // also games where user is player
  const { data: gp } = await supabase
    .from('game_players')
    .select('game_id, games(id, game_type, result, created_at, ended_at, status)')
    .eq('user_id', currentUser.id)
    .limit(50);

  const map = new Map();
  (data || []).forEach(g => map.set(g.id, g));
  (gp || []).forEach(row => {
    if (row.games) map.set(row.games.id, row.games);
  });
  ui.pageHistory([...map.values()]);
}

async function loadLeaderboard() {
  ui.pageLoading('Loading ranks…');
  const { data } = await supabase
    .from('profiles')
    .select('username, display_name, rating, total_points, games_played')
    .order('rating', { ascending: false })
    .limit(50);
  ui.pageLeaderboard(data || []);
}

// ─────────────────────────────────────────────
boot();
