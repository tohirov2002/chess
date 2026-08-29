// ============================================
// CHESS ARENA — Complete Application
// ============================================

// ============================
// 1. UTILITY FUNCTIONS
// ============================

const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

const storage = {
    get: (k, d = null) => { try { const v = localStorage.getItem('ca_' + k); return v ? JSON.parse(v) : d; } catch { return d; } },
    set: (k, v) => { try { localStorage.setItem('ca_' + k, JSON.stringify(v)); } catch {} },
    remove: (k) => { try { localStorage.removeItem('ca_' + k); } catch {} }
};

// ============================
// 2. TOAST SYSTEM
// ============================

const Toast = {
    container: null,
    init() {
        this.container = document.getElementById('toastContainer');
    },
    show(msg, type = 'info', duration = 3000) {
        const t = document.createElement('div');
        t.className = `toast toast-${type}`;
        const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
        t.innerHTML = `
            <span class="toast-icon">${icons[type] || 'ℹ️'}</span>
            <span class="toast-message">${msg}</span>
            <span class="toast-close">✕</span>
        `;
        t.querySelector('.toast-close').onclick = () => this._remove(t);
        this.container.appendChild(t);
        setTimeout(() => this._remove(t), duration);
        return t;
    },
    _remove(t) {
        if (t.parentNode) { t.remove(); }
    },
    success(msg, d) { return this.show(msg, 'success', d); },
    error(msg, d) { return this.show(msg, 'error', d); },
    warning(msg, d) { return this.show(msg, 'warning', d); },
    info(msg, d) { return this.show(msg, 'info', d); }
};

// ============================
// 3. MODAL SYSTEM
// ============================

const Modal = {
    container: null,
    callbacks: {},
    init() {
        this.container = document.getElementById('modalContainer');
    },
    show({ title, subtitle = '', content = '', actions = [], onShow = null, onClose = null }) {
        this.close();
        const overlay = document.createElement('div');
        overlay.className = 'modal-container';
        overlay.style.display = 'flex';
        overlay.onclick = (e) => { if (e.target === overlay) this.close(); };

        const modal = document.createElement('div');
        modal.className = 'modal-content';
        let actionsHtml = actions.length ? `<div class="modal-actions">${actions.map(a =>
            `<button class="btn ${a.class || 'btn-secondary'}" data-action="${a.id || 'action'}">${a.label}</button>`
        ).join('')}</div>` : '';

        modal.innerHTML = `
            <button class="modal-close">&times;</button>
            ${title ? `<h2 class="modal-title">${title}</h2>` : ''}
            ${subtitle ? `<p class="modal-subtitle">${subtitle}</p>` : ''}
            <div class="modal-body">${content}</div>
            ${actionsHtml}
        `;
        modal.querySelector('.modal-close').onclick = () => this.close();

        modal.querySelectorAll('[data-action]').forEach(btn => {
            const action = actions.find(a => a.id === btn.dataset.action);
            if (action?.onClick) btn.onclick = action.onClick;
        });

        overlay.appendChild(modal);
        this.container.appendChild(overlay);
        this.container.style.display = 'flex';
        document.body.style.overflow = 'hidden';
        this.callbacks.onClose = onClose;
        if (onShow) onShow();
        return overlay;
    },
    close() {
        if (this.container.firstChild) {
            this.container.removeChild(this.container.firstChild);
        }
        this.container.style.display = 'none';
        document.body.style.overflow = '';
        if (this.callbacks.onClose) {
            this.callbacks.onClose();
            this.callbacks = {};
        }
    }
};

// ============================
// 4. AUTH SYSTEM
// ============================

const Auth = {
    _users: [],
    _current: null,

    init() {
        // Load mock users from storage
        this._users = storage.get('users', []);
        const session = storage.get('session');
        if (session) {
            const user = this._users.find(u => u.id === session.userId);
            if (user) {
                this._current = { ...user, token: session.token };
            } else {
                storage.remove('session');
            }
        }
    },

    register(username, email, password) {
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                if (!username || !email || password.length < 6) {
                    return reject(new Error('Please fill all fields correctly'));
                }
                if (this._users.find(u => u.email === email)) {
                    return reject(new Error('Email already registered'));
                }
                if (this._users.find(u => u.username === username)) {
                    return reject(new Error('Username taken'));
                }
                const user = {
                    id: 'u_' + Date.now(),
                    username,
                    email,
                    password: btoa(password), // simple hash (demo only)
                    rating: 1200,
                    games: 0,
                    wins: 0,
                    losses: 0,
                    draws: 0,
                    highestRating: 1200,
                    joinedAt: new Date().toISOString()
                };
                this._users.push(user);
                storage.set('users', this._users);
                const token = 'jwt_' + Date.now() + '_' + user.id;
                storage.set('session', { userId: user.id, token });
                this._current = { ...user, token };
                resolve(this._current);
            }, 500);
        });
    },

    login(email, password) {
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                const user = this._users.find(u => u.email === email);
                if (!user || btoa(password) !== user.password) {
                    return reject(new Error('Invalid credentials'));
                }
                const token = 'jwt_' + Date.now() + '_' + user.id;
                storage.set('session', { userId: user.id, token });
                this._current = { ...user, token };
                resolve(this._current);
            }, 500);
        });
    },

    logout() {
        storage.remove('session');
        this._current = null;
        updateAuthUI();
    },

    getUser() { return this._current; },
    isAuth() { return !!this._current; },
    getToken() { return this._current?.token || null; },

    updateUser(updates) {
        if (!this._current) return;
        const idx = this._users.findIndex(u => u.id === this._current.id);
        if (idx > -1) {
            this._users[idx] = { ...this._users[idx], ...updates };
            storage.set('users', this._users);
            this._current = { ...this._users[idx], token: this._current.token };
        }
    }
};

// ============================
// 5. CHESS ENGINE (Pure JS)
// ============================

class ChessEngine {
    constructor() {
        this.reset();
    }

    reset() {
        this.board = this.initBoard();
        this.turn = 'white';
        this.moveHistory = [];
        this.captured = { white: [], black: [] };
        this.status = 'playing';
        this.fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR';
        this.kingPos = { white: [7, 4], black: [0, 4] };
        this.castling = { whiteKing: true, whiteQueen: true, blackKing: true, blackQueen: true };
        this.enPassant = null;
        this.halfMoveClock = 0;
        this.fullMoveCount = 1;
        this.moveLog = [];
    }

    initBoard() {
        const b = Array(8).fill(null).map(() => Array(8).fill(null));
        const backRank = ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'];
        for (let c = 0; c < 8; c++) {
            b[0][c] = { type: backRank[c], color: 'black' };
            b[1][c] = { type: 'p', color: 'black' };
            b[6][c] = { type: 'p', color: 'white' };
            b[7][c] = { type: backRank[c], color: 'white' };
        }
        return b;
    }

    getPiece(r, c) {
        if (r < 0 || r > 7 || c < 0 || c > 7) return null;
        return this.board[r][c];
    }

    findKing(color) {
        for (let r = 0; r < 8; r++)
            for (let c = 0; c < 8; c++) {
                const p = this.board[r][c];
                if (p && p.type === 'k' && p.color === color) return [r, c];
            }
        return null;
    }

    inBounds(r, c) { return r >= 0 && r < 8 && c >= 0 && c < 8; }

    getPseudoLegalMoves(r, c) {
        const piece = this.board[r][c];
        if (!piece) return [];
        const { type, color } = piece;
        const moves = [];
        const enemy = color === 'white' ? 'black' : 'white';
        const dir = color === 'white' ? -1 : 1;
        const startRow = color === 'white' ? 6 : 1;

        // Pawn
        if (type === 'p') {
            // Forward
            const nr = r + dir;
            if (this.inBounds(nr, c) && !this.board[nr][c]) {
                moves.push([nr, c]);
                // Double move
                if (r === startRow && !this.board[r + 2 * dir][c]) {
                    moves.push([r + 2 * dir, c]);
                }
            }
            // Captures
            for (const dc of [-1, 1]) {
                const nc = c + dc;
                if (this.inBounds(nr, nc)) {
                    const target = this.board[nr][nc];
                    if (target && target.color === enemy) {
                        moves.push([nr, nc]);
                    }
                    // En passant
                    if (this.enPassant && this.enPassant[0] === nr && this.enPassant[1] === nc) {
                        moves.push([nr, nc]);
                    }
                }
            }
            return moves;
        }

        // Knight
        if (type === 'n') {
            const offsets = [
                [-2, -1],
                [-2, 1],
                [-1, -2],
                [-1, 2],
                [1, -2],
                [1, 2],
                [2, -1],
                [2, 1]
            ];
            for (const [dr, dc] of offsets) {
                const nr = r + dr,
                    nc = c + dc;
                if (this.inBounds(nr, nc)) {
                    const target = this.board[nr][nc];
                    if (!target || target.color === enemy) moves.push([nr, nc]);
                }
            }
            return moves;
        }

        // Bishop, Rook, Queen
        const dirs = [];
        if (type === 'b' || type === 'q') {
            dirs.push([-1, -1], [-1, 1], [1, -1], [1, 1]);
        }
        if (type === 'r' || type === 'q') {
            dirs.push([-1, 0], [1, 0], [0, -1], [0, 1]);
        }
        for (const [dr, dc] of dirs) {
            let nr = r + dr,
                nc = c + dc;
            while (this.inBounds(nr, nc)) {
                const target = this.board[nr][nc];
                if (target) {
                    if (target.color === enemy) moves.push([nr, nc]);
                    break;
                }
                moves.push([nr, nc]);
                nr += dr;
                nc += dc;
            }
        }
        // King
        if (type === 'k') {
            for (let dr = -1; dr <= 1; dr++)
                for (let dc = -1; dc <= 1; dc++) {
                    if (dr === 0 && dc === 0) continue;
                    const nr = r + dr,
                        nc = c + dc;
                    if (this.inBounds(nr, nc)) {
                        const target = this.board[nr][nc];
                        if (!target || target.color === enemy) moves.push([nr, nc]);
                    }
                }
            // Castling
            if (color === 'white' && r === 7 && c === 4) {
                if (this.castling.whiteKing && !this.board[7][5] && !this.board[7][6]) {
                    if (!this.isSquareAttacked(7, 4, 'black') && !this.isSquareAttacked(7, 5, 'black') && !this.isSquareAttacked(7, 6, 'black')) {
                        moves.push([7, 6]);
                    }
                }
                if (this.castling.whiteQueen && !this.board[7][1] && !this.board[7][2] && !this.board[7][3]) {
                    if (!this.isSquareAttacked(7, 4, 'black') && !this.isSquareAttacked(7, 3, 'black') && !this.isSquareAttacked(7, 2, 'black')) {
                        moves.push([7, 2]);
                    }
                }
            }
            if (color === 'black' && r === 0 && c === 4) {
                if (this.castling.blackKing && !this.board[0][5] && !this.board[0][6]) {
                    if (!this.isSquareAttacked(0, 4, 'white') && !this.isSquareAttacked(0, 5, 'white') && !this.isSquareAttacked(0, 6, 'white')) {
                        moves.push([0, 6]);
                    }
                }
                if (this.castling.blackQueen && !this.board[0][1] && !this.board[0][2] && !this.board[0][3]) {
                    if (!this.isSquareAttacked(0, 4, 'white') && !this.isSquareAttacked(0, 3, 'white') && !this.isSquareAttacked(0, 2, 'white')) {
                        moves.push([0, 2]);
                    }
                }
            }
        }
        return moves;
    }

    isSquareAttacked(r, c, byColor) {
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const p = this.board[row][col];
                if (p && p.color === byColor) {
                    const moves = this.getPseudoLegalMoves(row, col);
                    for (const [tr, tc] of moves) {
                        if (tr === r && tc === c) return true;
                    }
                }
            }
        }
        return false;
    }

    getLegalMoves(r, c) {
        const piece = this.board[r][c];
        if (!piece) return [];
        const pseudo = this.getPseudoLegalMoves(r, c);
        const legal = [];
        for (const [tr, tc] of pseudo) {
            // Simulate move
            const captured = this.board[tr][tc];
            const enPassantCapture = this.enPassant && this.enPassant[0] === tr && this.enPassant[1] === tc;
            const enPassantPawn = enPassantCapture ? this.board[r][tc] : null;

            this.board[tr][tc] = piece;
            this.board[r][c] = null;

            // Handle en passant capture
            if (enPassantCapture) {
                this.board[r][tc] = null;
            }

            // Handle castling
            const isCastling = piece.type === 'k' && Math.abs(c - tc) === 2;
            if (isCastling) {
                if (tc === 6) { this.board[r][5] = this.board[r][7];
                    this.board[r][7] = null; }
                if (tc === 2) { this.board[r][3] = this.board[r][0];
                    this.board[r][0] = null; }
            }

            // Check if king is in check
            const king = this.findKing(piece.color);
            const inCheck = king ? this.isSquareAttacked(king[0], king[1], piece.color === 'white' ? 'black' : 'white') : true;

            // Undo
            this.board[r][c] = piece;
            this.board[tr][tc] = captured;
            if (enPassantCapture) {
                this.board[r][tc] = enPassantPawn;
            }
            if (isCastling) {
                if (tc === 6) { this.board[r][7] = this.board[r][5];
                    this.board[r][5] = null; }
                if (tc === 2) { this.board[r][0] = this.board[r][3];
                    this.board[r][3] = null; }
            }

            if (!inCheck) {
                legal.push([tr, tc]);
            }
        }
        return legal;
    }

    getAllLegalMoves(color) {
        const moves = [];
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const p = this.board[r][c];
                if (p && p.color === color) {
                    const m = this.getLegalMoves(r, c);
                    for (const [tr, tc] of m) {
                        moves.push({ from: [r, c], to: [tr, tc] });
                    }
                }
            }
        }
        return moves;
    }

    makeMove(fromR, fromC, toR, toC) {
        const piece = this.board[fromR][fromC];
        if (!piece) return null;

        const legalMoves = this.getLegalMoves(fromR, fromC);
        const isValid = legalMoves.some(([r, c]) => r === toR && c === toC);
        if (!isValid) return null;

        const captured = this.board[toR][toC];
        const isEnPassant = this.enPassant && this.enPassant[0] === toR && this.enPassant[1] === toC;
        const isCastling = piece.type === 'k' && Math.abs(fromC - toC) === 2;
        const isPromotion = piece.type === 'p' && (toR === 0 || toR === 7);

        // Save state for undo
        const state = {
            from: [fromR, fromC],
            to: [toR, toC],
            piece,
            captured,
            enPassant: this.enPassant,
            castling: { ...this.castling },
            halfMoveClock: this.halfMoveClock,
            kingPos: { ...this.kingPos }
        };

        // Execute move
        this.board[toR][toC] = piece;
        this.board[fromR][fromC] = null;

        // En passant
        if (isEnPassant) {
            this.board[fromR][toC] = null;
        }

        // Castling
        if (isCastling) {
            if (toC === 6) {
                this.board[fromR][5] = this.board[fromR][7];
                this.board[fromR][7] = null;
            }
            if (toC === 2) {
                this.board[fromR][3] = this.board[fromR][0];
                this.board[fromR][0] = null;
            }
        }

        // Update king position
        if (piece.type === 'k') {
            this.kingPos[piece.color] = [toR, toC];
        }

        // Update castling rights
        if (piece.type === 'k') {
            if (piece.color === 'white') { this.castling.whiteKing = false;
                this.castling.whiteQueen = false; }
            if (piece.color === 'black') { this.castling.blackKing = false;
                this.castling.blackQueen = false; }
        }
        if (piece.type === 'r') {
            if (fromR === 7 && fromC === 0) this.castling.whiteQueen = false;
            if (fromR === 7 && fromC === 7) this.castling.whiteKing = false;
            if (fromR === 0 && fromC === 0) this.castling.blackQueen = false;
            if (fromR === 0 && fromC === 7) this.castling.blackKing = false;
        }
        if (captured && captured.type === 'r') {
            if (toR === 7 && toC === 0) this.castling.whiteQueen = false;
            if (toR === 7 && toC === 7) this.castling.whiteKing = false;
            if (toR === 0 && toC === 0) this.castling.blackQueen = false;
            if (toR === 0 && toC === 7) this.castling.blackKing = false;
        }

        // En passant
        this.enPassant = null;
        if (piece.type === 'p' && Math.abs(fromR - toR) === 2) {
            this.enPassant = [(fromR + toR) / 2, fromC];
        }

        // Half move clock
        this.halfMoveClock = (piece.type === 'p' || captured) ? 0 : this.halfMoveClock + 1;

        // Move log
        const notation = this.getNotation(fromR, fromC, toR, toC, piece, captured, isEnPassant, isCastling, isPromotion);
        this.moveLog.push({
            from: [fromR, fromC],
            to: [toR, toC],
            piece,
            captured,
            notation,
            isCastling,
            isEnPassant,
            isPromotion
        });

        // Promotion
        if (isPromotion) {
            // Return promotion info
            return { ...state, promotion: true };
        }

        // Switch turn
        this.turn = this.turn === 'white' ? 'black' : 'white';
        this.fullMoveCount += this.turn === 'white' ? 0 : 1;

        // Update status
        this.updateStatus();

        return state;
    }

    promote(toR, toC, type) {
        const piece = this.board[toR][toC];
        if (!piece || piece.type !== 'p') return false;
        piece.type = type;
        this.turn = this.turn === 'white' ? 'black' : 'white';
        this.fullMoveCount += this.turn === 'white' ? 0 : 1;
        this.updateStatus();
        return true;
    }

    updateStatus() {
        const color = this.turn;
        const moves = this.getAllLegalMoves(color);
        const king = this.findKing(color);
        const inCheck = king ? this.isSquareAttacked(king[0], king[1], color === 'white' ? 'black' : 'white') : false;

        if (moves.length === 0) {
            if (inCheck) {
                this.status = 'checkmate';
            } else {
                this.status = 'stalemate';
            }
        } else if (inCheck) {
            this.status = 'check';
        } else {
            this.status = 'playing';
        }

        // Draw conditions (simplified)
        if (this.halfMoveClock >= 100) {
            this.status = 'draw';
        }
        // Insufficient material (simplified)
        const pieces = [];
        for (let r = 0; r < 8; r++)
            for (let c = 0; c < 8; c++) {
                const p = this.board[r][c];
                if (p) pieces.push(p);
            }
        if (pieces.length === 2) this.status = 'draw';
        if (pieces.length === 3 && pieces.some(p => p.type === 'b' || p.type === 'n')) this.status = 'draw';
    }

    getNotation(fromR, fromC, toR, toC, piece, captured, enPassant, castling, promotion) {
        const files = 'abcdefgh';
        const ranks = '87654321';
        const from = files[fromC] + ranks[fromR];
        const to = files[toC] + ranks[toR];

        if (castling) {
            return toC === 6 ? 'O-O' : 'O-O-O';
        }

        let n = '';
        const p = piece.type.toUpperCase();
        if (p !== 'P') n += p;
        if (captured || enPassant) n += 'x';
        n += to;
        if (promotion) n += '=Q';
        if (this.status === 'checkmate') n += '#';
        else if (this.status === 'check') n += '+';
        return n;
    }

    getFen() {
        let fen = '';
        for (let r = 0; r < 8; r++) {
            let empty = 0;
            for (let c = 0; c < 8; c++) {
                const p = this.board[r][c];
                if (p) {
                    if (empty) { fen += empty;
                        empty = 0; }
                    const sym = p.type.toUpperCase();
                    fen += p.color === 'white' ? sym : sym.toLowerCase();
                } else {
                    empty++;
                }
            }
            if (empty) fen += empty;
            if (r < 7) fen += '/';
        }
        fen += ' ' + (this.turn === 'white' ? 'w' : 'b');
        fen += ' ' + this.getCastlingFen();
        fen += ' ' + (this.enPassant ? String.fromCharCode(97 + this.enPassant[1]) + (8 - this.enPassant[0]) : '-');
        fen += ' ' + this.halfMoveClock;
        fen += ' ' + this.fullMoveCount;
        return fen;
    }

    getCastlingFen() {
        let s = '';
        if (this.castling.whiteKing) s += 'K';
        if (this.castling.whiteQueen) s += 'Q';
        if (this.castling.blackKing) s += 'k';
        if (this.castling.blackQueen) s += 'q';
        return s || '-';
    }

    clone() {
        const e = new ChessEngine();
        e.board = this.board.map(row => row.map(p => p ? { ...p } : null));
        e.turn = this.turn;
        e.status = this.status;
        e.castling = { ...this.castling };
        e.enPassant = this.enPassant ? [...this.enPassant] : null;
        e.halfMoveClock = this.halfMoveClock;
        e.fullMoveCount = this.fullMoveCount;
        e.kingPos = { white: [...this.kingPos.white], black: [...this.kingPos.black] };
        e.moveLog = this.moveLog.map(m => ({ ...m }));
        return e;
    }
}

// ============================
// 6. STOCKFISH AI (Mock)
// ============================

class StockfishAI {
    constructor(difficulty = 'medium') {
        this.difficulty = difficulty;
        this.thinking = false;
        this.depths = { easy: 1, medium: 2, hard: 4 };
    }

    getBestMove(engine, color) {
        const moves = engine.getAllLegalMoves(color);
        if (moves.length === 0) return null;

        const depth = this.depths[this.difficulty] || 2;

        // Score each move with minimax
        const scored = moves.map(m => {
            const copy = engine.clone();
            const result = copy.makeMove(m.from[0], m.from[1], m.to[0], m.to[1]);
            if (!result) return { move: m, score: -9999 };

            // If promotion, assume queen
            if (result.promotion) {
                copy.promote(m.to[0], m.to[1], 'q');
            }

            let score = this.evaluate(copy, color);
            // Recursive lookahead
            if (depth > 1) {
                const enemyMoves = copy.getAllLegalMoves(color === 'white' ? 'black' : 'white');
                if (enemyMoves.length > 0) {
                    let bestEnemy = -9999;
                    for (const em of enemyMoves.slice(0, 10)) {
                        const c2 = copy.clone();
                        const r2 = c2.makeMove(em.from[0], em.from[1], em.to[0], em.to[1]);
                        if (r2) {
                            if (r2.promotion) c2.promote(em.to[0], em.to[1], 'q');
                            const s2 = this.evaluate(c2, color);
                            if (s2 > bestEnemy) bestEnemy = s2;
                        }
                    }
                    score = score - bestEnemy * 0.3;
                }
            }

            return { move: m, score };
        });

        // Sort by score descending
        scored.sort((a, b) => b.score - a.score);

        // Add some randomness based on difficulty
        const topN = this.difficulty === 'easy' ? Math.min(6, scored.length) :
            this.difficulty === 'medium' ? Math.min(3, scored.length) : 1;

        const pick = scored.slice(0, topN);
        const idx = Math.floor(Math.random() * pick.length);

        return pick[idx]?.move || null;
    }

    evaluate(engine, color) {
        const pieceValues = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000 };
        let score = 0;

        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const p = engine.board[r][c];
                if (p) {
                    const val = pieceValues[p.type] || 0;
                    const sign = p.color === color ? 1 : -1;
                    // Position bonuses (simplified)
                    let bonus = 0;
                    if (p.type === 'p') {
                        const row = p.color === 'white' ? 7 - r : r;
                        bonus = row * 5;
                    }
                    if (p.type === 'k') {
                        bonus = engine.isSquareAttacked(r, c, p.color === 'white' ? 'black' : 'white') ? -50 : 0;
                    }
                    score += sign * (val + bonus);
                }
            }
        }
        // Mobility bonus
        const moves = engine.getAllLegalMoves(color);
        const enemyMoves = engine.getAllLegalMoves(color === 'white' ? 'black' : 'white');
        score += (moves.length - enemyMoves.length) * 5;

        return score;
    }
}

// ============================
// 7. BOARD RENDERER
// ============================

class BoardRenderer {
    constructor(container, options = {}) {
        this.container = container;
        this.engine = options.engine || new ChessEngine();
        this.orientation = options.orientation || 'white';
        this.onMove = options.onMove || null;
        this.onPromotion = options.onPromotion || null;
        this.selected = null;
        this.legalMoves = [];
        this.lastMove = null;
        this.pieceImages = {};
        this.isAIThinking = false;
        this.render();
        this.loadPieces();
    }

    loadPieces() {
        // SVG pieces as inline data (using Unicode fallback)
        const pieceMap = {
            'white': { 'k': '♔', 'q': '♕', 'r': '♖', 'b': '♗', 'n': '♘', 'p': '♙' },
            'black': { 'k': '♚', 'q': '♛', 'r': '♜', 'b': '♝', 'n': '♞', 'p': '♟' }
        };
        this.pieceMap = pieceMap;
    }

    render() {
        this.container.innerHTML = '';
        const board = document.createElement('div');
        board.className = 'chess-board';

        const files = 'abcdefgh';
        const ranks = '87654321';

        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const row = this.orientation === 'white' ? 7 - r : r;
                const col = this.orientation === 'white' ? c : 7 - c;

                const sq = document.createElement('div');
                const isLight = (row + col) % 2 === 0;
                sq.className = `square ${isLight ? 'square-light' : 'square-dark'}`;
                sq.dataset.row = row;
                sq.dataset.col = col;

                // Coordinates
                if (col === 0) {
                    const rank = document.createElement('span');
                    rank.className = 'coord coord-rank';
                    rank.textContent = ranks[row];
                    sq.appendChild(rank);
                }
                if (row === 7) {
                    const file = document.createElement('span');
                    file.className = 'coord coord-file';
                    file.textContent = files[col];
                    sq.appendChild(file);
                }

                // Piece
                const p = this.engine.board[row][col];
                if (p) {
                    const span = document.createElement('span');
                    span.className = 'piece';
                    const symbol = this.pieceMap[p.color][p.type];
                    span.textContent = symbol;
                    span.style.fontSize = '3.5rem';
                    span.style.lineHeight = '1';
                    span.style.userSelect = 'none';
                    span.dataset.piece = p.type;
                    span.dataset.color = p.color;
                    sq.appendChild(span);
                }

                // Legal move indicators
                const isLegal = this.legalMoves.some(([tr, tc]) => tr === row && tc === col);
                if (isLegal) {
                    if (this.engine.board[row][col]) {
                        const ind = document.createElement('div');
                        ind.className = 'legal-capture';
                        sq.appendChild(ind);
                    } else {
                        const ind = document.createElement('div');
                        ind.className = 'legal-move';
                        sq.appendChild(ind);
                    }
                }

                // Last move highlight
                if (this.lastMove) {
                    if ((this.lastMove.from[0] === row && this.lastMove.from[1] === col) ||
                        (this.lastMove.to[0] === row && this.lastMove.to[1] === col)) {
                        sq.classList.add(isLight ? 'last-move-light' : 'last-move-dark');
                    }
                }

                // Selected
                if (this.selected && this.selected[0] === row && this.selected[1] === col) {
                    sq.classList.add('selected');
                }

                // Check indicator
                const king = this.engine.findKing(this.engine.turn);
                if (king && king[0] === row && king[1] === col && this.engine.status === 'check') {
                    const ind = document.createElement('div');
                    ind.className = 'check-indicator';
                    sq.appendChild(ind);
                }

                sq.addEventListener('click', () => this.handleClick(row, col));
                board.appendChild(sq);
            }
        }

        this.container.appendChild(board);
    }

    handleClick(row, col) {
        if (this.isAIThinking) return;

        const piece = this.engine.board[row][col];

        // If a piece is selected and this is a legal move
        if (this.selected) {
            const isLegal = this.legalMoves.some(([tr, tc]) => tr === row && tc === col);
            if (isLegal) {
                this.makeMove(this.selected[0], this.selected[1], row, col);
                return;
            }
        }

        // Select piece
        if (piece) {
            const currentTurn = this.engine.turn;
            if (piece.color === currentTurn) {
                const moves = this.engine.getLegalMoves(row, col);
                if (moves.length > 0) {
                    this.selected = [row, col];
                    this.legalMoves = moves;
                    this.render();
                    return;
                }
            }
        }

        // Deselect
        this.selected = null;
        this.legalMoves = [];
        this.render();
    }

    makeMove(fromR, fromC, toR, toC) {
        const result = this.engine.makeMove(fromR, fromC, toR, toC);
        if (!result) {
            Toast.error('Illegal move!');
            return;
        }

        this.selected = null;
        this.legalMoves = [];
        this.lastMove = { from: [fromR, fromC], to: [toR, toC] };
        this.render();

        // Promotion
        if (result.promotion) {
            this.showPromotion(toR, toC);
            return;
        }

        // Check game status
        this.checkGameStatus();

        if (this.onMove) {
            const files = 'abcdefgh';
            const from = files[fromC] + (8 - fromR);
            const to = files[toC] + (8 - toR);
            this.onMove(from, to);
        }
    }

    showPromotion(row, col) {
        const container = this.container;
        const modal = document.createElement('div');
        modal.className = 'promotion-modal';
        const options = document.createElement('div');
        options.className = 'promotion-options';

        const color = this.engine.board[row][col].color;
        const types = ['q', 'r', 'b', 'n'];
        const labels = { q: '♛', r: '♜', b: '♝', n: '♞' };

        for (const type of types) {
            const btn = document.createElement('div');
            btn.className = 'promotion-option';
            const symbol = color === 'white' ? labels[type].toUpperCase() : labels[type];
            btn.textContent = symbol;
            btn.style.fontSize = '2.5rem';
            btn.onclick = () => {
                this.engine.promote(row, col, type);
                modal.remove();
                this.render();
                this.checkGameStatus();
                if (this.onMove) {
                    this.onMove('promotion', 'promotion');
                }
            };
            options.appendChild(btn);
        }

        modal.appendChild(options);
        container.appendChild(modal);
    }

    checkGameStatus() {
        const status = this.engine.status;
        if (status === 'checkmate') {
            const winner = this.engine.turn === 'white' ? 'Black' : 'White';
            Toast.success(`🏆 Checkmate! ${winner} wins!`);
            setTimeout(() => this.showGameOver('checkmate', winner), 300);
        } else if (status === 'stalemate') {
            Toast.warning('🤝 Stalemate! Draw.');
            setTimeout(() => this.showGameOver('stalemate', null), 300);
        } else if (status === 'draw') {
            Toast.info('🤝 Draw!');
            setTimeout(() => this.showGameOver('draw', null), 300);
        } else if (status === 'check') {
            Toast.warning('⚠️ Check!');
        }
    }

    showGameOver(type, winner) {
        const title = type === 'checkmate' ? `🏆 ${winner} wins!` :
            type === 'stalemate' ? '🤝 Stalemate!' : '🤝 Draw!';
        const subtitle = `${this.engine.moveLog.length} moves played`;

        Modal.show({
            title: '♛ Game Over',
            content: `
                <div style="text-align:center;padding:12px 0;">
                    <div style="font-size:3rem;margin-bottom:6px;">${type === 'checkmate' ? '🏆' : '🤝'}</div>
                    <h3 style="font-size:1.2rem;">${title}</h3>
                    <p style="color:var(--text-secondary);">${subtitle}</p>
                    <div style="display:flex;gap:10px;justify-content:center;margin-top:16px;flex-wrap:wrap;">
                        <button class="btn btn-primary" id="rematchBtn">🔄 Rematch</button>
                        <button class="btn btn-secondary" id="homeBtn">🏠 Menu</button>
                    </div>
                </div>
            `,
            onShow: () => {
                document.getElementById('rematchBtn')?.addEventListener('click', () => {
                    Modal.close();
                    this.resetGame();
                });
                document.getElementById('homeBtn')?.addEventListener('click', () => {
                    Modal.close();
                    navigate('home');
                });
            }
        });
    }

    resetGame() {
        this.engine.reset();
        this.selected = null;
        this.legalMoves = [];
        this.lastMove = null;
        this.isAIThinking = false;
        this.render();
        updateUI();
    }

    setOrientation(orientation) {
        this.orientation = orientation;
        this.render();
    }

    setEngine(engine) {
        this.engine = engine;
        this.selected = null;
        this.legalMoves = [];
        this.lastMove = null;
        this.render();
    }
}

// ============================
// 8. PAGE NAVIGATION// ============================

let currentPage = 'home';
let boardRenderer = null;
let aiEngine = new StockfishAI('medium');
let gameEngine = new ChessEngine();
let playerColor = 'white';
let difficulty = 'medium';
let onlineGame = { roomCode: null, isHost: false, opponent: null, myColor: null, gameStarted: false };

function navigate(page) {
    currentPage = page;
    const container = document.getElementById('pageContainer');
    container.innerHTML = '';
    container.className = 'page-enter';

    // Update nav
    document.querySelectorAll('.nav-link').forEach(el => {
        el.classList.toggle('active', el.dataset.page === page);
    });

    switch (page) {
        case 'home':
            renderHome(container);
            break;
        case 'computer':
            renderComputer(container);
            break;
        case 'online':
            renderOnline(container);
            break;
        case 'leaderboard':
            renderLeaderboard(container);
            break;
        case 'profile':
            renderProfile(container);
            break;
        default:
            renderHome(container);
    }
}

// ============================
// 9. HOME PAGE
// ============================

function renderHome(container) {
    container.innerHTML = `
        <section class="hero">
            <div class="container">
                <h1 class="hero-title">
                    Master the board.<br>
                    <span class="highlight">Beat your mind.</span>
                </h1>
                <p class="hero-subtitle">
                    Play chess against powerful AI or challenge your friends online.
                </p>
                <div class="hero-actions">
                    <button class="btn btn-primary btn-lg" onclick="navigate('computer')">🤖 Play vs Computer</button>
                    <button class="btn btn-secondary btn-lg" onclick="navigate('online')">👥 Play with Friend</button>
                </div>
            </div>
        </section>
        <div class="container">
            <div class="features-grid">
                <div class="card feature-card">
                    <div class="feature-icon">🧠</div>
                    <h3 class="feature-title">AI Opponent</h3>
                    <p class="feature-desc">Multiple difficulty levels</p>
                </div>
                <div class="card feature-card">
                    <div class="feature-icon">🌐</div>
                    <h3 class="feature-title">Online Play</h3>
                    <p class="feature-desc">Play with friends in real-time</p>
                </div>
                <div class="card feature-card">
                    <div class="feature-icon">📊</div>
                    <h3 class="feature-title">Leaderboard</h3>
                    <p class="feature-desc">Track your progress</p>
                </div>
                <div class="card feature-card">
                    <div class="feature-icon">🎯</div>
                    <h3 class="feature-title">Analysis</h3>
                    <p class="feature-desc">Review your games</p>
                </div>
            </div>
        </div>
    `;
    updateUI();
}

// ============================
// 10. COMPUTER PAGE
// ============================

function renderComputer(container) {
    const user = Auth.getUser();
    const username = user?.username || 'You';

    // Check if we need to show settings first
    const settings = storage.get('computerSettings');
    if (!settings || !settings.difficulty || !settings.color) {
        showComputerSettings(() => renderComputer(container));
        return;
    }

    difficulty = settings.difficulty || 'medium';
    playerColor = settings.color || 'white';

    gameEngine = new ChessEngine();
    aiEngine = new StockfishAI(difficulty);

    container.innerHTML = `
        <div class="container" style="padding:16px 0;">
            <div class="flex-between" style="flex-wrap:wrap;gap:8px;margin-bottom:12px;">
                <h2 style="font-size:1.3rem;font-weight:700;">🤖 Play vs Computer</h2>
                <div style="display:flex;gap:6px;flex-wrap:wrap;">
                    <button class="btn btn-sm btn-secondary" onclick="resetComputerGame()">🔄 New Game</button>
                    <button class="btn btn-sm btn-secondary" onclick="showComputerSettings(() => renderComputer(document.getElementById('pageContainer')))">⚙ Settings</button>
                </div>
            </div>

            <div class="game-layout">
                <div>
                    <div class="player-area">
                        <div>
                            <span class="player-name">♟ Computer</span>
                            <span class="player-rating">${difficulty}</span>
                        </div>
                        <span class="timer-display" id="blackTimer">--</span>
                    </div>

                    <div class="board-wrapper">
                        <div class="board-container" id="boardContainer"></div>
                    </div>

                    <div class="player-area" style="margin-top:6px;">
                        <div>
                            <span class="player-name">♟ ${username}</span>
                            <span class="player-rating">${user?.rating || 1200}</span>
                        </div>
                        <span class="timer-display" id="whiteTimer">--</span>
                    </div>

                    <div class="status-message" id="statusMessage">
                        <span>Game started</span>
                    </div>
                </div>

                <div class="game-sidebar">
                    <div class="card" style="padding:12px;">
                        <h4 style="font-size:0.8rem;font-weight:600;margin-bottom:6px;">Move History</h4>
                        <div class="move-history" id="moveHistory">
                            <div class="empty">No moves yet</div>
                        </div>
                    </div>

                    <div class="card" style="padding:12px;margin-top:10px;">
                        <div class="game-controls">
                            <button class="btn btn-sm btn-secondary" onclick="undoComputerMove()">↶ Undo</button>
                            <button class="btn btn-sm btn-secondary" onclick="showHint()">💡 Hint</button>
                            <button class="btn btn-sm btn-danger" onclick="resignComputerGame()">🏳 Resign</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Initialize board
    setTimeout(() => {
        const boardContainer = document.getElementById('boardContainer');
        boardRenderer = new BoardRenderer(boardContainer, {
            engine: gameEngine,
            orientation: playerColor,
            onMove: (from, to) => {
                updateMoveHistory();
                updateStatusMessage('Computer is thinking...');
                // AI move after delay
                setTimeout(() => makeAIMove(), 400 + Math.random() * 600);
            }
        });
        boardRenderer.isAIThinking = false;

        // If playing as black, AI moves first
        if (playerColor === 'black') {
            setTimeout(() => makeAIMove(), 600);
        }

        updateUI();
    }, 50);
}

function makeAIMove() {
    if (!boardRenderer || boardRenderer.isAIThinking) return;
    if (gameEngine.status === 'checkmate' || gameEngine.status === 'stalemate' || gameEngine.status === 'draw') return;

    const color = gameEngine.turn;
    const aiColor = playerColor === 'white' ? 'black' : 'white';

    if (color !== aiColor) return;

    boardRenderer.isAIThinking = true;
    updateStatusMessage('Computer is thinking...');

    setTimeout(() => {
        const move = aiEngine.getBestMove(gameEngine, aiColor);
        if (!move) {
            boardRenderer.isAIThinking = false;
            return;
        }

        const fromR = move.from[0],
            fromC = move.from[1];
        const toR = move.to[0],
            toC = move.to[1];

        const result = gameEngine.makeMove(fromR, fromC, toR, toC);
        if (result) {
            boardRenderer.render();
            updateMoveHistory();
            updateStatusMessage(gameEngine.turn === playerColor ? 'Your turn' : 'Computer is thinking...');

            // Check game over
            if (gameEngine.status === 'checkmate') {
                const winner = gameEngine.turn === 'white' ? 'Black' : 'White';
                Toast.success(`🏆 Checkmate! ${winner} wins!`);
                boardRenderer.showGameOver('checkmate', winner);
            } else if (gameEngine.status === 'stalemate') {
                Toast.warning('🤝 Stalemate!');
                boardRenderer.showGameOver('stalemate', null);
            } else if (gameEngine.status === 'draw') {
                Toast.info('🤝 Draw!');
                boardRenderer.showGameOver('draw', null);
            }

            boardRenderer.isAIThinking = false;

            // If game still going and it's AI's turn again
            if (gameEngine.turn === aiColor && gameEngine.status === 'playing') {
                setTimeout(() => makeAIMove(), 500);
            }
        } else {
            boardRenderer.isAIThinking = false;
        }
    }, 300 + Math.random() * 400);
}

function resetComputerGame() {
    if (boardRenderer) {
        boardRenderer.resetGame();
        updateMoveHistory();
        updateStatusMessage('Game started');
        if (playerColor === 'black') {
            setTimeout(() => makeAIMove(), 500);
        }
    }
}

function undoComputerMove() {
    if (!boardRenderer) return;
    if (boardRenderer.isAIThinking) {
        Toast.warning('Computer is thinking...');
        return;
    }
    // Simplified undo - just reset
    Toast.info('Undo feature: restarting game');
    resetComputerGame();
}

function showHint() {
    if (!boardRenderer || boardRenderer.isAIThinking) return;
    const color = gameEngine.turn;
    const moves = gameEngine.getAllLegalMoves(color);
    if (moves.length === 0) return;
    const move = moves[Math.floor(Math.random() * moves.length)];
    if (move) {
        const files = 'abcdefgh';
        const from = files[move.from[1]] + (8 - move.from[0]);
        const to = files[move.to[1]] + (8 - move.to[0]);
        Toast.info(`💡 Try ${from} → ${to}`);
    }
}

function resignComputerGame() {
    Modal.show({
        title: '🏳 Resign?',
        content: `
            <p style="text-align:center;color:var(--text-secondary);">Are you sure you want to resign?</p>
            <div style="display:flex;gap:10px;justify-content:center;margin-top:14px;">
                <button class="btn btn-danger" id="confirmResignBtn">Yes, Resign</button>
                <button class="btn btn-secondary" id="cancelResignBtn">Cancel</button>
            </div>
        `,
        onShow: () => {
            document.getElementById('confirmResignBtn')?.addEventListener('click', () => {
                Modal.close();
                Toast.info('You resigned');
                boardRenderer?.showGameOver('resignation', 'Computer');
            });
            document.getElementById('cancelResignBtn')?.addEventListener('click', Modal.close);
        }
    });
}

function showComputerSettings(callback) {
    const settings = storage.get('computerSettings') || { difficulty: 'medium', color: 'white' };

    Modal.show({
        title: '⚙ Game Settings',
        content: `
            <div style="display:flex;flex-direction:column;gap:14px;">
                <div>
                    <label style="font-weight:500;display:block;margin-bottom:4px;">Difficulty</label>
                    <div style="display:flex;gap:6px;">
                        ${['easy','medium','hard'].map(d =>
                            `<button class="btn btn-sm ${settings.difficulty === d ? 'btn-primary' : 'btn-secondary'}" data-diff="${d}">
                                ${d.charAt(0).toUpperCase()+d.slice(1)}
                            </button>`
                        ).join('')}
                    </div>
                </div>
                <div>
                    <label style="font-weight:500;display:block;margin-bottom:4px;">Play as</label>
                    <div style="display:flex;gap:6px;">
                        ${['white','black'].map(c =>
                            `<button class="btn btn-sm ${settings.color === c ? 'btn-primary' : 'btn-secondary'}" data-color="${c}">
                                ${c.charAt(0).toUpperCase()+c.slice(1)}
                            </button>`
                        ).join('')}
                    </div>
                </div>
            </div>
        `,
        actions: [
            { id: 'apply', label: 'Apply', class: 'btn-primary', onClick: () => {
                const diff = document.querySelector('[data-diff].btn-primary')?.dataset.diff || 'medium';
                const color = document.querySelector('[data-color].btn-primary')?.dataset.color || 'white';
                storage.set('computerSettings', { difficulty: diff, color });
                Modal.close();
                if (callback) callback();
                else navigate('computer');
            }}
        ],
        onShow: () => {
            document.querySelectorAll('[data-diff]').forEach(el => {
                el.onclick = () => {
                    document.querySelectorAll('[data-diff]').forEach(b =>
                        b.className = `btn btn-sm ${b.dataset.diff === el.dataset.diff ? 'btn-primary' : 'btn-secondary'}`
                    );
                };
            });
            document.querySelectorAll('[data-color]').forEach(el => {
                el.onclick = () => {
                    document.querySelectorAll('[data-color]').forEach(b =>
                        b.className = `btn btn-sm ${b.dataset.color === el.dataset.color ? 'btn-primary' : 'btn-secondary'}`
                    );
                };
            });
        }
    });
}

function updateMoveHistory() {
    const container = document.getElementById('moveHistory');
    if (!container) return;
    const moves = gameEngine.moveLog;
    if (moves.length === 0) {
        container.innerHTML = '<div class="empty">No moves yet</div>';
        return;
    }
    let html = '';
    for (let i = 0; i < moves.length; i += 2) {
        const num = Math.floor(i / 2) + 1;
        const w = moves[i]?.notation || '';
        const b = moves[i + 1]?.notation || '';
        html += `<div class="move-row">
            <span class="num">${num}.</span>
            <span class="white">${w}</span>
            <span class="black">${b}</span>
        </div>`;
    }
    container.innerHTML = html;
    container.scrollTop = container.scrollHeight;
}

function updateStatusMessage(msg) {
    const el = document.getElementById('statusMessage');
    if (el) {
        const span = el.querySelector('span') || el;
        span.textContent = msg || (gameEngine.turn === playerColor ? 'Your turn' : 'Computer is thinking...');
    }
}

// ============================
// 11. ONLINE PAGE
// ============================

let onlineRoomCode = null;
let onlineIsHost = false;
let onlineOpponent = null;
let onlineMyColor = null;
let onlineGameStarted = false;
let onlineBoard = null;
let onlineEngine = new ChessEngine();

function renderOnline(container) {
    if (!Auth.isAuth()) {
        container.innerHTML = `
            <div class="container" style="padding:60px 0;text-align:center;">
                <div style="font-size:3rem;margin-bottom:12px;">🔒</div>
                <h2 style="font-size:1.4rem;">Please Login</h2>
                <p style="color:var(--text-secondary);margin-bottom:16px;">Login to play online with friends</p>
                <button class="btn btn-primary" onclick="document.getElementById('authBtn').click()">Login</button>
            </div>
        `;
        return;
    }

    // Check if we're in a game
    if (onlineGameStarted) {
        renderOnlineGame(container);
        return;
    }

    container.innerHTML = `
        <div class="container" style="padding:32px 0;">
            <h2 style="font-size:1.5rem;font-weight:700;text-align:center;margin-bottom:4px;">👥 Play with Friend</h2>
            <p style="text-align:center;color:var(--text-secondary);margin-bottom:24px;">Create a room or join with a code</p>

            <div style="max-width:420px;margin:0 auto;">
                <div class="card" style="text-align:center;padding:28px;">
                    <button class="btn btn-primary btn-lg btn-block" id="createRoomBtn" style="margin-bottom:12px;">
                        🚀 Create Room
                    </button>
                    <div style="position:relative;margin:16px 0;">
                        <hr style="border-color:var(--border-color);">
                        <span style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);background:var(--bg-card);padding:0 10px;color:var(--text-muted);font-size:0.8rem;">or</span>
                    </div>
                    <div style="display:flex;gap:8px;">
                        <input type="text" id="roomCodeInput" class="input" placeholder="Enter room code" style="flex:1;text-align:center;text-transform:uppercase;letter-spacing:2px;font-weight:600;" maxlength="6" />
                        <button class="btn btn-secondary" id="joinRoomBtn">Join</button>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.getElementById('createRoomBtn')?.addEventListener('click', createOnlineRoom);
    document.getElementById('joinRoomBtn')?.addEventListener('click', joinOnlineRoom);
    document.getElementById('roomCodeInput')?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') document.getElementById('joinRoomBtn').click();
    });
}

function createOnlineRoom() {
    const code = generateRoomCode();
    onlineRoomCode = code;
    onlineIsHost = true;
    onlineGameStarted = true;
    onlineMyColor = 'white';
    onlineOpponent = { username: 'Waiting...', rating: 0 };

    Toast.success(`Room created: ${code}`);

    // Show room code modal
    Modal.show({
        title: '🏠 Room Created',
        content: `
            <div style="text-align:center;padding:8px 0;">
                <p style="color:var(--text-secondary);margin-bottom:8px;">Share this code with your friend</p>
                <div class="room-code-display">${code}</div>
                <button class="btn btn-primary mt-2" id="copyRoomCode">📋 Copy Code</button>
                <p style="color:var(--text-muted);font-size:0.8rem;margin-top:12px;">Waiting for opponent to join...</p>
                <div class="spinner"></div>
            </div>
        `,
        onShow: () => {
            document.getElementById('copyRoomCode')?.addEventListener('click', () => {
                navigator.clipboard?.writeText(code).then(() => {
                    Toast.success('Code copied!');
                }).catch(() => {
                    const input = document.createElement('input');
                    input.value = code;
                    document.body.appendChild(input);
                    input.select();
                    document.execCommand('copy');
                    document.body.removeChild(input);
                    Toast.success('Code copied!');
                });
            });

            // Simulate opponent joining after 3-6 seconds
            setTimeout(() => {
                if (onlineGameStarted) {
                    onlineOpponent = { username: 'Friend', rating: 1250 };
                    Modal.close();
                    Toast.success('Opponent joined!');
                    renderOnlineGame(document.getElementById('pageContainer'));
                }
            }, 3000 + Math.random() * 3000);
        }
    });

    renderOnlineGame(document.getElementById('pageContainer'));
}

function joinOnlineRoom() {
    const input = document.getElementById('roomCodeInput');
    const code = input.value.trim().toUpperCase();
    if (!code) {
        Toast.warning('Please enter a room code');
        return;
    }

    onlineRoomCode = code;
    onlineIsHost = false;
    onlineGameStarted = true;
    onlineMyColor = 'black';
    onlineOpponent = { username: 'Host', rating: 1300 };

    Toast.success(`Joined room ${code}`);

    // Simulate game start
    setTimeout(() => {
        renderOnlineGame(document.getElementById('pageContainer'));
        Toast.info('Game started! You are Black.');
    }, 500);
}

function generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
}

function renderOnlineGame(container) {
    const user = Auth.getUser();
    const username = user?.username || 'You';

    onlineEngine = new ChessEngine();

    container.innerHTML = `
        <div class="container" style="padding:12px 0;">
            <div class="flex-between" style="flex-wrap:wrap;gap:8px;margin-bottom:10px;">
                <div>
                    <h3 style="font-size:1.1rem;">Room: <span style="color:var(--accent);font-weight:700;">${onlineRoomCode}</span></h3>
                    <p style="color:var(--text-secondary);font-size:0.8rem;" id="onlineStatus">Playing</p>
                </div>
                <button class="btn btn-sm btn-danger" onclick="leaveOnlineRoom()">Leave Room</button>
            </div>

            <div class="game-layout">
                <div>
                    <div class="player-area">
                        <div>
                            <span class="player-name">♟ ${onlineOpponent?.username || 'Opponent'}</span>
                            <span class="player-rating">${onlineOpponent?.rating || 1200}</span>
                        </div>
                        <span class="timer-display" id="blackTimer">--</span>
                    </div>

                    <div class="board-wrapper">
                        <div class="board-container" id="boardContainer"></div>
                    </div>

                    <div class="player-area" style="margin-top:6px;">
                        <div>
                            <span class="player-name">♟ ${username}</span>
                            <span class="player-rating">${user?.rating || 1200}</span>
                        </div>
                        <span class="timer-display" id="whiteTimer">--</span>
                    </div>

                    <div class="status-message" id="statusMessage">
                        <span>${onlineMyColor === 'white' ? 'Your turn' : 'Opponent\'s turn'}</span>
                    </div>
                </div>

                <div class="game-sidebar">
                    <div class="card" style="padding:12px;">
                        <h4 style="font-size:0.8rem;font-weight:600;margin-bottom:6px;">Move History</h4>
                        <div class="move-history" id="moveHistory">
                            <div class="empty">No moves yet</div>
                        </div>
                    </div>

                    <div class="card" style="padding:12px;margin-top:10px;">
                        <div class="game-controls">
                            <button class="btn btn-sm btn-secondary" onclick="offerDraw()">🤝 Draw</button>
                            <button class="btn btn-sm btn-danger" onclick="resignOnlineGame()">🏳 Resign</button>
                        </div>
                    </div>

                    <div class="card" style="padding:12px;margin-top:10px;">
                        <h4 style="font-size:0.8rem;font-weight:600;margin-bottom:4px;">Chat</h4>
                        <div id="chatMessages" style="max-height:80px;overflow-y:auto;font-size:0.8rem;line-height:1.6;background:var(--bg-secondary);border-radius:var(--radius-sm);padding:6px 8px;margin-bottom:6px;">
                            <div style="color:var(--text-muted);text-align:center;">Say hello!</div>
                        </div>
                        <div style="display:flex;gap:6px;">
                            <input type="text" id="chatInput" class="input" placeholder="Message..." style="flex:1;padding:4px 10px;font-size:0.8rem;" maxlength="60" />
                            <button class="btn btn-sm btn-primary" id="sendChatBtn">Send</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Setup board
    setTimeout(() => {
        const boardContainer = document.getElementById('boardContainer');
        onlineBoard = new BoardRenderer(boardContainer, {
            engine: onlineEngine,
            orientation: onlineMyColor,
            onMove: (from, to) => {
                updateOnlineMoveHistory();
                updateOnlineStatus('Opponent\'s turn');
                // Simulate opponent move
                setTimeout(() => simulateOpponentMove(), 600 + Math.random() * 800);
            }
        });

        updateOnlineUI();

        // Chat
        document.getElementById('sendChatBtn')?.addEventListener('click', sendChatMessage);
        document.getElementById('chatInput')?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') sendChatMessage();
        });
    }, 50);
}

function simulateOpponentMove() {
    if (!onlineBoard || onlineEngine.status !== 'playing') return;

    const color = onlineEngine.turn;
    const opponentColor = onlineMyColor === 'white' ? 'black' : 'white';
    if (color !== opponentColor) return;

    const moves = onlineEngine.getAllLegalMoves(opponentColor);
    if (moves.length === 0) return;

    const move = moves[Math.floor(Math.random() * Math.min(moves.length, 8))];
    if (!move) return;

    const result = onlineEngine.makeMove(move.from[0], move.from[1], move.to[0], move.to[1]);
    if (result) {
        onlineBoard.render();
        updateOnlineMoveHistory();
        updateOnlineStatus('Your turn');

        if (onlineEngine.status === 'checkmate') {
            Toast.success('🏆 You win!');
            showOnlineGameOver('checkmate', 'You');
        } else if (onlineEngine.status === 'stalemate' || onlineEngine.status === 'draw') {
            Toast.info('🤝 Draw!');
            showOnlineGameOver('draw', null);
        }
    }
}

function updateOnlineStatus(msg) {
    const el = document.getElementById('statusMessage');
    if (el) {
        const span = el.querySelector('span') || el;
        span.textContent = msg || (onlineEngine.turn === onlineMyColor ? 'Your turn' : 'Opponent\'s turn');
    }
}

function updateOnlineMoveHistory() {
    const container = document.getElementById('moveHistory');
    if (!container) return;
    const moves = onlineEngine.moveLog;
    if (moves.length === 0) {
        container.innerHTML = '<div class="empty">No moves yet</div>';
        return;
    }
    let html = '';
    for (let i = 0; i < moves.length; i += 2) {
        const num = Math.floor(i / 2) + 1;
        const w = moves[i]?.notation || '';
        const b = moves[i + 1]?.notation || '';
        html += `<div class="move-row">
            <span class="num">${num}.</span>
            <span class="white">${w}</span>
            <span class="black">${b}</span>
        </div>`;
    }
    container.innerHTML = html;
    container.scrollTop = container.scrollHeight;
}

function updateOnlineUI() {
    updateOnlineStatus();
    updateOnlineMoveHistory();
}

function sendChatMessage() {
    const input = document.getElementById('chatInput');
    const msg = input.value.trim();
    if (!msg) return;

    const container = document.getElementById('chatMessages');
    const div = document.createElement('div');
    div.innerHTML = `<strong>You:</strong> ${msg}`;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
    input.value = '';

    // Simulate opponent response
    setTimeout(() => {
        const responses = ['Good move!', 'Nice!', 'Interesting...', 'Hmm', '👍', 'Well played!'];
        const div2 = document.createElement('div');
        div2.innerHTML = `<strong>${onlineOpponent?.username || 'Opponent'}:</strong> ${responses[Math.floor(Math.random() * responses.length)]}`;
        container.appendChild(div2);
        container.scrollTop = container.scrollHeight;
    }, 1000 + Math.random() * 1500);
}

function offerDraw() {
    Toast.info('Draw offer sent to opponent');
    setTimeout(() => {
        if (Math.random() < 0.5) {
            Toast.success('Opponent accepted the draw!');
            showOnlineGameOver('draw', null);
        } else {
            Toast.info('Opponent declined the draw');
        }
    }, 1500);
}

function resignOnlineGame() {
    Modal.show({
        title: '🏳 Resign?',
        content: `
            <p style="text-align:center;color:var(--text-secondary);">Are you sure you want to resign?</p>
            <div style="display:flex;gap:10px;justify-content:center;margin-top:14px;">
                <button class="btn btn-danger" id="confirmResignBtn">Yes, Resign</button>
                <button class="btn btn-secondary" id="cancelResignBtn">Cancel</button>
            </div>
        `,
        onShow: () => {
            document.getElementById('confirmResignBtn')?.addEventListener('click', () => {
                Modal.close();
                Toast.info('You resigned');
                showOnlineGameOver('resignation', 'Opponent');
            });
            document.getElementById('cancelResignBtn')?.addEventListener('click', Modal.close);
        }
    });
}

function showOnlineGameOver(type, winner) {
    const title = type === 'checkmate' ? `🏆 ${winner} wins!` :
        type === 'resignation' ? `🏆 ${winner} wins!` :
        '🤝 Draw!';
    const subtitle = `${onlineEngine.moveLog.length} moves played`;

    Modal.show({
        title: '♛ Game Over',
        content: `
            <div style="text-align:center;padding:12px 0;">
                <div style="font-size:3rem;margin-bottom:6px;">${type === 'checkmate' ? '🏆' : type === 'resignation' ? '🏆' : '🤝'}</div>
                <h3 style="font-size:1.2rem;">${title}</h3>
                <p style="color:var(--text-secondary);">${subtitle}</p>
                <div style="display:flex;gap:10px;justify-content:center;margin-top:16px;flex-wrap:wrap;">
                    <button class="btn btn-primary" id="rematchBtn">🔄 Rematch</button>
                    <button class="btn btn-secondary" id="homeBtn">🏠 Menu</button>
                </div>
            </div>
        `,
        onShow: () => {
            document.getElementById('rematchBtn')?.addEventListener('click', () => {
                Modal.close();
                resetOnlineGame();
            });
            document.getElementById('homeBtn')?.addEventListener('click', () => {
                Modal.close();
                leaveOnlineRoom();
                navigate('home');
            });
        }
    });
}

function resetOnlineGame() {
    onlineEngine = new ChessEngine();
    if (onlineBoard) {
        onlineBoard.setEngine(onlineEngine);
        onlineBoard.render();
    }
    updateOnlineUI();
    Toast.success('Rematch started!');
    if (onlineMyColor === 'black') {
        setTimeout(() => simulateOpponentMove(), 500);
    }
}

function leaveOnlineRoom() {
    onlineRoomCode = null;
    onlineIsHost = false;
    onlineOpponent = null;
    onlineMyColor = null;
    onlineGameStarted = false;
    onlineBoard = null;
    onlineEngine = new ChessEngine();
    navigate('online');
    Toast.info('Left the room');
}

// ============================
// 12. LEADERBOARD PAGE
// ============================

function renderLeaderboard(container) {
    const players = generateLeaderboardData();

    container.innerHTML = `
        <div class="container" style="padding:24px 0;">
            <h2 style="font-size:1.5rem;font-weight:700;text-align:center;margin-bottom:4px;">🏆 Leaderboard</h2>
            <p style="text-align:center;color:var(--text-secondary);margin-bottom:20px;">Top players around the world</p>

            <div style="max-width:660px;margin:0 auto;">
                <div class="card" style="overflow:hidden;padding:0;">
                    <div style="overflow-x:auto;">
                        <table class="leaderboard-table">
                            <thead>
                                <tr>
                                    <th>#</th>
                                    <th>Player</th>
                                    <th style="text-align:center;">Rating</th>
                                    <th style="text-align:center;">Games</th>
                                    <th style="text-align:center;">Win Rate</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${players.map((p, i) => `
                                    <tr>
                                        <td class="${i < 3 ? 'rank-' + (i+1) : ''}">${i + 1}</td>
                                        <td>
                                            <div style="display:flex;align-items:center;gap:6px;">
                                                <span>♟</span>
                                                <span>${p.username}</span>
                                                ${p.isOnline ? '<span style="width:6px;height:6px;border-radius:50%;background:var(--success);display:inline-block;"></span>' : ''}
                                            </div>
                                        </td>
                                        <td style="text-align:center;font-weight:600;">${p.rating}</td>
                                        <td style="text-align:center;color:var(--text-secondary);">${p.games}</td>
                                        <td style="text-align:center;color:var(--text-secondary);">${p.winRate}%</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    `;
    updateUI();
}

function generateLeaderboardData() {
    const names = ['Grandmaster', 'ChessWizard', 'KnightRider', 'QueenGambit', 'BishopMaster',
        'RookDefender', 'PawnStar', 'KingSlayer', 'CheckmatePro', 'EndgameKing',
        'TacticalMind', 'PositionalMaster', 'BlitzKing', 'RapidPlayer', 'ClassicalChamp'
    ];
    return names.map((name, i) => ({
        username: name,
        rating: 1200 + Math.floor(Math.random() * 800) - Math.floor(i * 8),
        games: 50 + Math.floor(Math.random() * 200),
        winRate: Math.round(40 + Math.random() * 35),
        isOnline: Math.random() > 0.7
    })).sort((a, b) => b.rating - a.rating);
}

// ============================
// 13. PROFILE PAGE
// ============================

function renderProfile(container) {
    const user = Auth.getUser();

    if (!user) {
        container.innerHTML = `
            <div class="container" style="padding:60px 0;text-align:center;">
                <div style="font-size:3rem;margin-bottom:12px;">🔒</div>
                <h2 style="font-size:1.4rem;">Please Login</h2>
                <p style="color:var(--text-secondary);margin-bottom:16px;">Login to view your profile</p>
                <button class="btn btn-primary" onclick="document.getElementById('authBtn').click()">Login</button>
            </div>
        `;
        return;
    }

    const wins = user.wins || 0;
    const losses = user.losses || 0;
    const draws = user.draws || 0;
    const games = user.games || 0;
    const winRate = games > 0 ? Math.round(wins / games * 100) : 0;

    container.innerHTML = `
        <div class="container" style="padding:24px 0;">
            <div style="max-width:480px;margin:0 auto;">
                <div class="card" style="text-align:center;padding:28px;">
                    <div style="font-size:3.5rem;margin-bottom:4px;">♟</div>
                    <h2 style="font-size:1.4rem;font-weight:700;">${user.username}</h2>
                    <p style="color:var(--text-secondary);font-size:0.8rem;">
                        ${user.joinedAt ? 'Joined ' + new Date(user.joinedAt).toLocaleDateString() : 'Member'}
                    </p>
                    <div class="profile-stats" style="margin-top:16px;">
                        <div class="stat">
                            <div class="stat-value">${user.rating || 1200}</div>
                            <div class="stat-label">Rating</div>
                        </div>
                        <div class="stat">
                            <div class="stat-value">${games}</div>
                            <div class="stat-label">Games</div>
                        </div>
                        <div class="stat">
                            <div class="stat-value">${winRate}%</div>
                            <div class="stat-label">Win Rate</div>
                        </div>
                    </div>
                </div>

                <div class="card" style="margin-top:12px;">
                    <h3 style="font-size:0.95rem;font-weight:600;margin-bottom:10px;">📊 Detailed Stats</h3>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
                        <div style="padding:8px 12px;background:var(--bg-secondary);border-radius:var(--radius-sm);">
                            <div style="font-size:0.7rem;color:var(--text-secondary);">Wins</div>
                            <div style="font-weight:600;">${wins}</div>
                        </div>
                        <div style="padding:8px 12px;background:var(--bg-secondary);border-radius:var(--radius-sm);">
                            <div style="font-size:0.7rem;color:var(--text-secondary);">Losses</div>
                            <div style="font-weight:600;">${losses}</div>
                        </div>
                        <div style="padding:8px 12px;background:var(--bg-secondary);border-radius:var(--radius-sm);">
                            <div style="font-size:0.7rem;color:var(--text-secondary);">Draws</div>
                            <div style="font-weight:600;">${draws}</div>
                        </div>
                        <div style="padding:8px 12px;background:var(--bg-secondary);border-radius:var(--radius-sm);">
                            <div style="font-size:0.7rem;color:var(--text-secondary);">Highest Rating</div>
                            <div style="font-weight:600;">${user.highestRating || user.rating || 1200}</div>
                        </div>
                    </div>
                </div>

                <button class="btn btn-danger btn-block mt-2" id="logoutBtn">🚪 Logout</button>
            </div>
        </div>
    `;

    document.getElementById('logoutBtn')?.addEventListener('click', () => {
        Auth.logout();
        Toast.success('Logged out');
        navigate('home');
    });

    updateUI();
}

// ============================
// 14. UI HELPERS
// ============================

function updateUI() {
    const user = Auth.getUser();
    const authBtn = document.getElementById('authBtn');
    if (user) {
        authBtn.textContent = user.username;
        authBtn.className = 'btn btn-secondary btn-sm';
    } else {
        authBtn.textContent = 'Login';
        authBtn.className = 'btn btn-primary btn-sm';
    }
}

function updateAuthUI() {
    updateUI();
}

// ============================
// 15. NAVIGATION SETUP
// ============================

// Make functions globally accessible
window.navigate = navigate;
window.resetComputerGame = resetComputerGame;
window.undoComputerMove = undoComputerMove;
window.showHint = showHint;
window.resignComputerGame = resignComputerGame;
window.showComputerSettings = showComputerSettings;
window.leaveOnlineRoom = leaveOnlineRoom;
window.offerDraw = offerDraw;
window.resignOnlineGame = resignOnlineGame;

// ============================
// 16. INITIALIZATION
// ============================

document.addEventListener('DOMContentLoaded', function() {
    // Initialize systems
    Toast.init();
    Modal.init();
    Auth.init();

    // Theme toggle
    const themeToggle = document.getElementById('themeToggle');
    const theme = storage.get('theme', 'dark');
    document.documentElement.setAttribute('data-theme', theme);
    themeToggle.textContent = theme === 'dark' ? '☀️' : '🌙';
    themeToggle.addEventListener('click', () => {
        const current = document.documentElement.getAttribute('data-theme');
        const next = current === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        storage.set('theme', next);
        themeToggle.textContent = next === 'dark' ? '☀️' : '🌙';
    });

    // Auth button
    document.getElementById('authBtn').addEventListener('click', () => {
        if (Auth.isAuth()) {
            Auth.logout();
            Toast.success('Logged out');
            updateUI();
            navigate(currentPage);
        } else {
            showAuthModal();
        }
    });

    // Mobile menu
    const mobileBtn = document.getElementById('mobileMenuBtn');
    const navLinks = document.getElementById('navLinks');
    mobileBtn.addEventListener('click', () => {
        navLinks.classList.toggle('open');
    });

    // Navigation links
    document.querySelectorAll('.nav-link').forEach(el => {
        el.addEventListener('click', (e) => {
            e.preventDefault();
            const page = el.dataset.page;
            if (page) {
                navigate(page);
                navLinks.classList.remove('open');
            }
        });
    });

    // Brand click
    document.querySelector('.nav-brand').addEventListener('click', () => {
        navigate('home');
        navLinks.classList.remove('open');
    });

    // Load home page
    navigate('home');
});

// ============================
// 17. AUTH MODAL
// ============================

function showAuthModal() {
    Modal.show({
        title: 'Welcome Back',
        subtitle: 'Login to your Chess Arena account',
        content: `
            <form id="authForm" class="auth-form">
                <div class="form-group">
                    <label>Email</label>
                    <input type="email" id="authEmail" class="input" placeholder="Enter your email..." required />
                </div>
                <div class="form-group">
                    <label>Password</label>
                    <input type="password" id="authPassword" class="input" placeholder="Enter your password..." required minlength="6" />
                </div>
                <div style="display:flex;gap:8px;margin-top:12px;">
                    <button type="submit" class="btn btn-primary" style="flex:1;" id="authSubmitBtn">Login</button>
                    <button type="button" class="btn btn-secondary" id="authToggleBtn">Register</button>
                </div>
            </form>
        `,
        onShow: () => {
            let isLogin = true;
            const form = document.getElementById('authForm');
            const submitBtn = document.getElementById('authSubmitBtn');
            const toggleBtn = document.getElementById('authToggleBtn');
            const emailInput = document.getElementById('authEmail');
            const passInput = document.getElementById('authPassword');

            toggleBtn.textContent = 'Register';

            toggleBtn.onclick = () => {
                isLogin = !isLogin;
                submitBtn.textContent = isLogin ? 'Login' : 'Create Account';
                toggleBtn.textContent = isLogin ? 'Register' : 'Login';
                document.querySelector('.modal-title').textContent = isLogin ? 'Welcome Back' : 'Create Account';
                document.querySelector('.modal-subtitle').textContent = isLogin ? 'Login to your Chess Arena account' : 'Join Chess Arena and start playing';
            };

            form.onsubmit = async (e) => {
                e.preventDefault();
                const email = emailInput.value;
                const password = passInput.value;

                try {
                    if (isLogin) {
                        await Auth.login(email, password);
                        Toast.success('Welcome back!');
                    } else {
                        const username = email.split('@')[0] || 'Player_' + Math.floor(Math.random() * 1000);
                        await Auth.register(username, email, password);
                        Toast.success('Account created! Welcome to Chess Arena.');
                    }
                    Modal.close();
                    updateUI();
                    navigate(currentPage);
                } catch (error) {
                    Toast.error(error.message || 'Authentication failed');
                }
            };
        }
    });
}

// ============================
// 18. KEYBOARD SHORTCUTS
// ============================

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        Modal.close();
    }
    if (e.ctrlKey && e.key === 'r') {
        e.preventDefault();
        if (currentPage === 'computer') resetComputerGame();
        if (currentPage === 'online') resetOnlineGame();
    }
    if (e.ctrlKey && e.key === 'h') {
        e.preventDefault();
        if (currentPage === 'computer') showHint();
    }
});