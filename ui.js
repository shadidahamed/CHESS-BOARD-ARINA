/**
 * ui.js — CHESS ARENA
 * Pages, lobby, invite UI, toasts, modals
 * Style: dark graphite · warm gold · poetic · bilingual
 */

import { PRODUCT_NAME, QUOTES, TIME_CONTROL_PRESETS, AI_DIFFICULTY, AI_STYLES } from './config.js';

export class UI {
  constructor() {
    this.main = document.getElementById('main');
    this.nav = document.getElementById('nav');
    this.userMenu = document.getElementById('user-menu');
    this.toastEl = document.getElementById('toast');
    this.modalEl = document.getElementById('modal');
    this.connectionEl = document.getElementById('connection');
    this.quoteTimer = null;
  }

  // ─────────────────────────────────────────────
  // Shell
  // ─────────────────────────────────────────────
  renderNav(user) {
    if (!this.nav) return;
    const items = [
      { hash: '#/', label: 'Home' },
      { hash: '#/play', label: 'Play' },
      { hash: '#/ai', label: 'vs AI' },
      { hash: '#/private', label: '1v1' },
      { hash: '#/four', label: '4 Player' },
      { hash: '#/history', label: 'History' },
      { hash: '#/leaderboard', label: 'Ranks' },
      { hash: '#/rules', label: 'Rules' }
    ];
    this.nav.innerHTML = items.map(i =>
      `<a href="${i.hash}" class="nav-link">${i.label}</a>`
    ).join('');

    if (this.userMenu) {
      if (user) {
        this.userMenu.innerHTML = `
          <a href="#/profile" class="user-chip">
            <span class="user-name">${escapeHtml(user.display_name || user.username)}</span>
            <span class="user-rating">${user.rating ?? 1200}</span>
          </a>
          <button type="button" class="btn-text" id="btn-logout">Logout</button>
        `;
      } else {
        this.userMenu.innerHTML = `
          <a href="#/login" class="btn-text">Login</a>
          <a href="#/register" class="btn primary">Register</a>
        `;
      }
    }
  }

  setConnection(status) {
    if (!this.connectionEl) return;
    this.connectionEl.textContent =
      status === 'connected' ? 'Connected' :
      status === 'reconnecting' ? 'Reconnecting…' : 'Disconnected';
    this.connectionEl.className = 'connection ' + status;
  }

  toast(message, type = 'info') {
    if (!this.toastEl) return;
    this.toastEl.textContent = message;
    this.toastEl.className = 'toast show ' + type;
    clearTimeout(this._toastT);
    this._toastT = setTimeout(() => {
      this.toastEl.classList.remove('show');
    }, 3200);
  }

  showQuote(type = 'start') {
    const box = document.getElementById('quote-box');
    if (!box) return;
    const arr = QUOTES[type] || QUOTES.start;
    const text = arr[Math.floor(Math.random() * arr.length)];
    box.style.opacity = '0';
    clearTimeout(this.quoteTimer);
    this.quoteTimer = setTimeout(() => {
      box.textContent = text;
      box.style.opacity = '1';
    }, 180);
  }

  openModal(html) {
    if (!this.modalEl) return;
    this.modalEl.innerHTML = `<div class="modal-card">${html}</div>`;
    this.modalEl.classList.remove('hidden');
    this.modalEl.onclick = (e) => {
      if (e.target === this.modalEl) this.closeModal();
    };
  }

  closeModal() {
    if (!this.modalEl) return;
    this.modalEl.classList.add('hidden');
    this.modalEl.innerHTML = '';
  }

  // ─────────────────────────────────────────────
  // Pages
  // ─────────────────────────────────────────────
  pageHome(user) {
    const logged = !!user;
    this.main.innerHTML = `
      <section class="hero">
        <p class="eyebrow">${PRODUCT_NAME}</p>
        <h1>Play Chess.<br>Challenge Minds.<br>Build Your Game.</h1>
        <p class="hero-sub">
          প্রতিটি পদক্ষেপ একটা গল্প বলে।<br>
          The board is quiet. The first move is always the heaviest.
        </p>
        <div class="hero-actions">
          <a href="#/ai" class="btn primary">Play vs AI</a>
          <a href="#/private" class="btn">Challenge a Friend</a>
          <a href="#/four" class="btn">Four Player</a>
        </div>
        ${logged ? `
          <div class="hero-stats">
            <div><span>Rating</span><strong>${user.rating ?? 1200}</strong></div>
            <div><span>Points</span><strong>${user.total_points ?? 0}</strong></div>
            <div><span>Games</span><strong>${user.games_played ?? 0}</strong></div>
          </div>
        ` : `
          <div class="hero-actions secondary">
            <a href="#/register" class="btn primary">Create Account</a>
            <a href="#/login" class="btn">Login</a>
            <a href="#/rules" class="btn-text">Learn Rules</a>
          </div>
        `}
      </section>
    `;
  }

  pagePlay() {
    this.main.innerHTML = `
      <section class="page">
        <h2>Play</h2>
        <p class="muted">Choose how you want to enter the board.</p>
        <div class="card-grid">
          <a href="#/ai" class="mode-card">
            <h3>vs AI</h3>
            <p>Stockfish · difficulty · style · poetic quotes</p>
          </a>
          <a href="#/private" class="mode-card">
            <h3>Private 1v1</h3>
            <p>Invitation link · realtime · timers</p>
          </a>
          <a href="#/four" class="mode-card">
            <h3>Four Player</h3>
            <p>Cross board · 160 squares · FFA ranking</p>
          </a>
        </div>
      </section>
    `;
  }

  pageAI(opts = {}) {
    const diffs = Object.keys(AI_DIFFICULTY);
    const styles = Object.keys(AI_STYLES);
    this.main.innerHTML = `
      <section class="page game-page">
        <div class="game-sidebar">
          <h2>vs AI</h2>
          <label>Color
            <select id="ai-color">
              <option value="w">White</option>
              <option value="b">Black</option>
              <option value="random">Random</option>
            </select>
          </label>
          <label>Difficulty
            <select id="ai-diff">
              ${diffs.map(d => `<option value="${d}" ${d === 'Intermediate' ? 'selected' : ''}>${d}</option>`).join('')}
            </select>
          </label>
          <label>Style
            <select id="ai-style">
              ${styles.map(s => `<option value="${s}">${s}</option>`).join('')}
            </select>
          </label>
          <button type="button" class="btn primary" id="ai-start">Start Game</button>
          <div id="quote-box" class="quote-box">প্রতিটি পদক্ষেপ একটা গল্প বলে।</div>
          <div class="status" id="game-status">Ready</div>
        </div>
        <div class="board-area">
          <div id="board-3d" class="board-3d"></div>
          <div id="board-2d" class="board-2d hidden"></div>
          <div class="game-controls">
            <button type="button" id="btn-undo">Undo</button>
            <button type="button" id="btn-resign">Resign</button>
            <button type="button" id="btn-flip">Flip</button>
            <button type="button" id="btn-view2d">2D / 3D</button>
          </div>
        </div>
      </section>
    `;
  }

  pagePrivate() {
    const presets = Object.keys(TIME_CONTROL_PRESETS);
    this.main.innerHTML = `
      <section class="page">
        <h2>Private 1v1</h2>
        <p class="muted">Create a game. Share the link. Play in realtime.</p>
        <div class="form-card">
          <label>Your color
            <select id="p1-color">
              <option value="white">White</option>
              <option value="black">Black</option>
              <option value="random">Random</option>
            </select>
          </label>
          <label>Time control
            <select id="p1-time">
              ${presets.map(p => `<option value="${p}" ${p === '5+3' ? 'selected' : ''}>${p}</option>`).join('')}
            </select>
          </label>
          <button type="button" class="btn primary" id="btn-create-1v1">Create Invitation</button>
        </div>
        <div id="invite-panel" class="invite-panel hidden"></div>
      </section>
    `;
  }

  pageFour() {
    const presets = Object.keys(TIME_CONTROL_PRESETS);
    this.main.innerHTML = `
      <section class="page">
        <h2>Four Player Chess</h2>
        <p class="muted">Cross board · 160 squares · Red → Blue → Yellow → Green</p>
        <div class="form-card">
          <label>Time control
            <select id="p4-time">
              ${presets.map(p => `<option value="${p}" ${p === '5+0' ? 'selected' : ''}>${p}</option>`).join('')}
            </select>
          </label>
          <button type="button" class="btn primary" id="btn-create-4p">Create 4-Player Lobby</button>
        </div>
        <div id="invite-panel" class="invite-panel hidden"></div>
      </section>
    `;
  }

  renderInvitePanel({ link, gameId, maxPlayers, players = [] }) {
    const panel = document.getElementById('invite-panel');
    if (!panel) return;
    panel.classList.remove('hidden');
    const slots = Array.from({ length: maxPlayers }, (_, i) => {
      const p = players[i];
      return `<div class="slot ${p ? 'filled' : 'empty'}">
        <span class="slot-num">${i + 1}</span>
        <span class="slot-name">${p ? escapeHtml(p.display_name || p.username || 'Player') : 'Waiting…'}</span>
        <span class="slot-color">${p ? (p.color || '') : ''}</span>
      </div>`;
    }).join('');

    panel.innerHTML = `
      <h3>Invitation ready</h3>
      <p class="muted">Copy and send. Game starts when all seats are filled.</p>
      <div class="invite-link-row">
        <input type="text" readonly id="invite-url" value="${escapeHtml(link)}" />
        <button type="button" class="btn primary" id="btn-copy-invite">Copy</button>
      </div>
      <div class="slots">${slots}</div>
      <div class="invite-actions">
        <button type="button" class="btn" id="btn-cancel-invite">Cancel</button>
        <button type="button" class="btn primary" id="btn-start-when-ready" disabled>Start when ready</button>
      </div>
    `;
  }

  pageLobbyJoin({ hostName, gameType, timeControl, status, canAccept }) {
    this.main.innerHTML = `
      <section class="page">
        <h2>Game Invitation</h2>
        <div class="form-card">
          <p><strong>Host:</strong> ${escapeHtml(hostName || '—')}</p>
          <p><strong>Type:</strong> ${escapeHtml(gameType || '—')}</p>
          <p><strong>Time:</strong> ${escapeHtml(timeControl || '—')}</p>
          <p><strong>Status:</strong> ${escapeHtml(status || '—')}</p>
          <div class="hero-actions">
            ${canAccept ? `
              <button type="button" class="btn primary" id="btn-accept-invite">Accept Invitation</button>
              <button type="button" class="btn" id="btn-decline-invite">Decline</button>
            ` : `<p class="muted">You cannot join this game.</p>`}
          </div>
        </div>
      </section>
    `;
  }

  pageGame1v1({ you, opponent, yourColor, timeYou, timeOpp, statusText }) {
    this.main.innerHTML = `
      <section class="page game-page">
        <div class="players-bar">
          <div class="player-card opp">
            <span class="name">${escapeHtml(opponent?.display_name || 'Opponent')}</span>
            <span class="clock" id="clock-opp">${formatTime(timeOpp)}</span>
          </div>
          <div class="player-card you">
            <span class="name">${escapeHtml(you?.display_name || 'You')}</span>
            <span class="clock" id="clock-you">${formatTime(timeYou)}</span>
            <span class="color-tag">${yourColor || ''}</span>
          </div>
        </div>
        <div id="quote-box" class="quote-box">The board is quiet.</div>
        <div class="board-area">
          <div id="board-3d" class="board-3d"></div>
          <div id="board-2d" class="board-2d hidden"></div>
        </div>
        <div class="status" id="game-status">${escapeHtml(statusText || '')}</div>
        <div class="game-controls">
          <button type="button" id="btn-resign">Resign</button>
          <button type="button" id="btn-draw">Offer Draw</button>
          <button type="button" id="btn-view2d">2D / 3D</button>
        </div>
      </section>
    `;
  }

  pageGame4p({ players, statusText }) {
    const cards = (players || []).map(p => `
      <div class="player-card four ${p.eliminated ? 'eliminated' : ''} ${p.isTurn ? 'turn' : ''}">
        <span class="color-dot" style="background:${colorHex(p.color)}"></span>
        <span class="name">${escapeHtml(p.display_name || p.color)}</span>
        <span class="clock">${formatTime(p.remaining_time)}</span>
        <span class="pts">${p.points ?? 0} pts</span>
      </div>
    `).join('');

    this.main.innerHTML = `
      <section class="page game-page four">
        <div class="players-four">${cards}</div>
        <div id="quote-box" class="quote-box">চার দিক থেকে এক গল্প।</div>
        <div class="board-area">
          <div id="board-4p" class="board-4p"></div>
        </div>
        <div class="status" id="game-status">${escapeHtml(statusText || '')}</div>
        <div class="game-controls">
          <button type="button" id="btn-resign">Resign</button>
        </div>
      </section>
    `;
  }

  pageLogin() {
    this.main.innerHTML = `
      <section class="page auth">
        <h2>Login</h2>
        <form id="form-login" class="form-card">
          <label>Email <input type="email" name="email" required autocomplete="email" /></label>
          <label>Password <input type="password" name="password" required autocomplete="current-password" /></label>
          <button type="submit" class="btn primary">Login</button>
          <p class="muted">No account? <a href="#/register">Register</a></p>
        </form>
      </section>
    `;
  }

  pageRegister() {
    this.main.innerHTML = `
      <section class="page auth">
        <h2>Create Account</h2>
        <form id="form-register" class="form-card">
          <label>Username <input type="text" name="username" required minlength="3" maxlength="24" pattern="[a-zA-Z0-9_]+" /></label>
          <label>Display name <input type="text" name="display_name" required maxlength="40" /></label>
          <label>Email <input type="email" name="email" required autocomplete="email" /></label>
          <label>Password <input type="password" name="password" required minlength="6" autocomplete="new-password" /></label>
          <button type="submit" class="btn primary">Register</button>
          <p class="muted">Already have an account? <a href="#/login">Login</a></p>
        </form>
      </section>
    `;
  }

  pageProfile(profile) {
    if (!profile) {
      this.main.innerHTML = `<section class="page"><p>Please <a href="#/login">login</a>.</p></section>`;
      return;
    }
    const wp = profile.games_played
      ? Math.round((profile.wins / profile.games_played) * 100)
      : 0;
    this.main.innerHTML = `
      <section class="page profile">
        <h2>${escapeHtml(profile.display_name)}</h2>
        <p class="muted">@${escapeHtml(profile.username)}</p>
        <div class="hero-stats">
          <div><span>Rating</span><strong>${profile.rating}</strong></div>
          <div><span>Points</span><strong>${profile.total_points}</strong></div>
          <div><span>Win %</span><strong>${wp}%</strong></div>
        </div>
        <div class="stat-grid">
          <div>Wins <strong>${profile.wins}</strong></div>
          <div>Losses <strong>${profile.losses}</strong></div>
          <div>Draws <strong>${profile.draws}</strong></div>
          <div>Games <strong>${profile.games_played}</strong></div>
          <div>4P Wins <strong>${profile.four_player_wins || 0}</strong></div>
        </div>
        <a href="#/settings" class="btn">Settings</a>
      </section>
    `;
  }

  pageHistory(games = []) {
    if (!games.length) {
      this.main.innerHTML = `
        <section class="page">
          <h2>History</h2>
          <p class="empty">No games yet. প্রতিটি গল্প একদিন শুরু হয়।</p>
        </section>`;
      return;
    }
    const rows = games.map(g => `
      <a href="#/replay/${g.id}" class="history-row">
        <span>${formatDate(g.ended_at || g.created_at)}</span>
        <span>${escapeHtml(g.game_type)}</span>
        <span>${escapeHtml(g.result || '—')}</span>
      </a>
    `).join('');
    this.main.innerHTML = `
      <section class="page">
        <h2>History</h2>
        <div class="history-list">${rows}</div>
      </section>`;
  }

  pageLeaderboard(rows = []) {
    if (!rows.length) {
      this.main.innerHTML = `
        <section class="page">
          <h2>Leaderboard</h2>
          <p class="empty">No rankings yet.</p>
        </section>`;
      return;
    }
    const list = rows.map((r, i) => `
      <div class="rank-row">
        <span class="rank">#${i + 1}</span>
        <span class="name">${escapeHtml(r.display_name || r.username)}</span>
        <span class="rating">${r.rating}</span>
        <span class="points">${r.total_points} pts</span>
      </div>
    `).join('');
    this.main.innerHTML = `
      <section class="page">
        <h2>Leaderboard</h2>
        <div class="rank-list">${list}</div>
      </section>`;
  }

  pageRules() {
    this.main.innerHTML = `
      <section class="page rules">
        <h2>Rules</h2>
        <article>
          <h3>Normal & AI Chess</h3>
          <p>Standard chess. Castling, en passant, promotion, checkmate, stalemate, fifty-move, threefold.</p>
          <p>সাধারণ দাবা। ক্যাসলিং, এন প্যাসান্ট, প্রমোশন, চেকমেট।</p>
        </article>
        <article>
          <h3>Private 1v1</h3>
          <p>Invitation link. Only invited players. Realtime sync. Timers are authoritative.</p>
        </article>
        <article>
          <h3>Four Player</h3>
          <p>Cross board, 160 squares. Turn: Red → Blue → Yellow → Green. Points for captures and checkmates. Last standing / highest score ranks first.</p>
          <p>চার রঙ। ক্রসবোর্ড। স্কোর ও এলিমিনেশন দিয়ে র‍্যাঙ্ক।</p>
        </article>
        <article>
          <h3>Points & Rating</h3>
          <p>Points accumulate from results. Rating is competitive (1v1). Finalization is once per game.</p>
        </article>
      </section>`;
  }

  pageSettings(profile) {
    this.main.innerHTML = `
      <section class="page">
        <h2>Settings</h2>
        <form id="form-settings" class="form-card">
          <label>Display name
            <input type="text" name="display_name" value="${escapeHtml(profile?.display_name || '')}" maxlength="40" />
          </label>
          <label>Theme
            <select name="theme">
              <option value="dark">Dark</option>
              <option value="light">Light</option>
            </select>
          </label>
          <label>Sound
            <select name="sound">
              <option value="on">On</option>
              <option value="off">Off</option>
            </select>
          </label>
          <button type="submit" class="btn primary">Save</button>
        </form>
      </section>`;
  }

  pageLoading(text = 'Loading…') {
    this.main.innerHTML = `<section class="page loading"><p>${escapeHtml(text)}</p></section>`;
  }

  pageError(message) {
    this.main.innerHTML = `
      <section class="page">
        <h2>Something went wrong</h2>
        <p class="muted">${escapeHtml(message)}</p>
        <a href="#/" class="btn">Home</a>
      </section>`;
  }
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatTime(sec) {
  if (sec == null || isNaN(sec)) return '—';
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
}

function formatDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function colorHex(name) {
  const map = { red: '#c44', blue: '#48c', yellow: '#cc4', green: '#4a4', white: '#eee', black: '#333' };
  return map[name] || '#888';
}

export default UI;
