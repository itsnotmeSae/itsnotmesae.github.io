const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');

// ===========================
// Minimal cookie helpers (no external dependency required)
// ===========================

const cookie = {
    parse(header) {
        const result = {};
        if (!header) return result;
        header.split(';').forEach((pair) => {
            const idx = pair.indexOf('=');
            if (idx < 0) return;
            const key = pair.slice(0, idx).trim();
            const val = pair.slice(idx + 1).trim();
            if (!key) return;
            try {
                result[key] = decodeURIComponent(val);
            } catch (err) {
                result[key] = val;
            }
        });
        return result;
    },
    serialize(name, value, options = {}) {
        let str = `${name}=${encodeURIComponent(value)}`;
        if (options.maxAge !== undefined) str += `; Max-Age=${Math.floor(options.maxAge)}`;
        if (options.path) str += `; Path=${options.path}`;
        if (options.httpOnly) str += '; HttpOnly';
        if (options.sameSite) str += `; SameSite=${options.sameSite[0].toUpperCase()}${options.sameSite.slice(1)}`;
        if (options.secure) str += '; Secure';
        return str;
    },
};

const app = express();
const server = http.createServer(app);

// ===========================
// CORS (needed because the frontend on GitHub Pages is a different
// origin than this local backend)
// ===========================
// Set this to your Pages URL, e.g. 'https://itsnotmesae.github.io'
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || 'https://itsnotmesae.github.io';

app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
});

const io = socketIo(server, {
    cors: {
        origin: ALLOWED_ORIGIN,
        credentials: true,
    },
});

const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'users.json');
const SESSION_COOKIE = 'egc_session';
const SESSION_MAX_AGE = 1000 * 60 * 60 * 24 * 7; // 7 days

// ===========================
// Tiny JSON "database"
// ===========================
// NOTE: This is a simple file-based store meant for small/personal
// deployments. If you outgrow it, swap loadUsers/saveUsers for a real
// database (SQLite, Postgres, etc.) without touching the rest of the code.

function loadUsers() {
    try {
        const raw = fs.readFileSync(DB_FILE, 'utf8');
        return JSON.parse(raw);
    } catch (err) {
        return {}; // { usernameLower: { username, passwordHash, salt, createdAt } }
    }
}

function saveUsers(users) {
    fs.writeFileSync(DB_FILE, JSON.stringify(users, null, 2));
}

let usersDb = loadUsers();

// ===========================
// Password hashing (scrypt, built into Node - no extra deps)
// ===========================

function hashPassword(password, salt) {
    return crypto.scryptSync(password, salt, 64).toString('hex');
}

function createPasswordRecord(password) {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = hashPassword(password, salt);
    return { salt, hash };
}

function verifyPassword(password, salt, hash) {
    const attempt = hashPassword(password, salt);
    const a = Buffer.from(attempt, 'hex');
    const b = Buffer.from(hash, 'hex');
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
}

// ===========================
// Session store (in-memory)
// ===========================
// sessionId -> { username, expires }

const sessions = new Map();

function createSession(username) {
    const sessionId = crypto.randomBytes(32).toString('hex');
    sessions.set(sessionId, { username, expires: Date.now() + SESSION_MAX_AGE });
    return sessionId;
}

function getSession(sessionId) {
    const session = sessions.get(sessionId);
    if (!session) return null;
    if (Date.now() > session.expires) {
        sessions.delete(sessionId);
        return null;
    }
    return session;
}

function destroySession(sessionId) {
    sessions.delete(sessionId);
}

// Periodically clean up expired sessions
setInterval(() => {
    const now = Date.now();
    for (const [id, session] of sessions.entries()) {
        if (now > session.expires) sessions.delete(id);
    }
}, 1000 * 60 * 30);

// ===========================
// Validation helpers
// ===========================

function sanitizeInput(input) {
    return input.replace(/</g, '&lt;').replace(/>/g, '&gt;').trim();
}

function isValidUsername(username) {
    return typeof username === 'string' && /^[a-zA-Z0-9_]{3,15}$/.test(username);
}

function isValidPassword(password) {
    return typeof password === 'string' && password.length >= 6 && password.length <= 100;
}

// ===========================
// Express middleware
// ===========================

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function getSessionFromReq(req) {
    const cookies = cookie.parse(req.headers.cookie || '');
    const sessionId = cookies[SESSION_COOKIE];
    if (!sessionId) return { sessionId: null, session: null };
    return { sessionId, session: getSession(sessionId) };
}

function requireAuth(req, res, next) {
    const { session } = getSessionFromReq(req);
    if (!session) {
        return res.status(401).json({ success: false, message: 'Not logged in.' });
    }
    req.username = session.username;
    next();
}

// ===========================
// Auth routes
// ===========================

// ===========================
// Session cookie options
// ===========================
// When the frontend is on a different origin (e.g. GitHub Pages) than this
// backend (e.g. your local machine), the cookie must be SameSite=None and
// Secure. Secure cookies require HTTPS -- Chrome/Edge treat "localhost" as a
// secure context and will accept this over plain HTTP for local testing;
// Firefox is stricter and may reject it. If that happens, test in Chrome, or
// run the backend behind HTTPS (e.g. via a tool like ngrok or a real host).
const CROSS_ORIGIN = process.env.CROSS_ORIGIN === 'true';

function sessionCookieOptions(maxAgeMs) {
    return {
        httpOnly: true,
        maxAge: maxAgeMs / 1000,
        path: '/',
        sameSite: CROSS_ORIGIN ? 'none' : 'lax',
        secure: CROSS_ORIGIN,
    };
}

app.post('/api/register', (req, res) => {
    const rawUsername = (req.body && req.body.username) || '';
    const password = (req.body && req.body.password) || '';

    const username = sanitizeInput(rawUsername);

    if (!isValidUsername(username)) {
        return res.status(400).json({ success: false, message: 'Username must be 3-15 alphanumeric characters or underscores.' });
    }
    if (!isValidPassword(password)) {
        return res.status(400).json({ success: false, message: 'Password must be at least 6 characters.' });
    }

    const key = username.toLowerCase();
    if (usersDb[key]) {
        return res.status(409).json({ success: false, message: 'That username is already taken.' });
    }

    const { salt, hash } = createPasswordRecord(password);
    usersDb[key] = {
        username, // preserves original casing for display
        passwordHash: hash,
        salt,
        createdAt: Date.now(),
    };
    saveUsers(usersDb);

    const sessionId = createSession(username);
    res.setHeader('Set-Cookie', cookie.serialize(SESSION_COOKIE, sessionId, sessionCookieOptions(SESSION_MAX_AGE)));

    res.json({ success: true, username });
});

app.post('/api/login', (req, res) => {
    const rawUsername = (req.body && req.body.username) || '';
    const password = (req.body && req.body.password) || '';
    const username = sanitizeInput(rawUsername);
    const key = username.toLowerCase();

    const record = usersDb[key];
    if (!record || !verifyPassword(password, record.salt, record.passwordHash)) {
        return res.status(401).json({ success: false, message: 'Incorrect username or password.' });
    }

    const sessionId = createSession(record.username);
    res.setHeader('Set-Cookie', cookie.serialize(SESSION_COOKIE, sessionId, sessionCookieOptions(SESSION_MAX_AGE)));

    res.json({ success: true, username: record.username });
});

app.post('/api/logout', (req, res) => {
    const { sessionId } = getSessionFromReq(req);
    if (sessionId) destroySession(sessionId);
    res.setHeader('Set-Cookie', cookie.serialize(SESSION_COOKIE, '', sessionCookieOptions(0)));
    res.json({ success: true });
});

app.get('/api/me', (req, res) => {
    const { session } = getSessionFromReq(req);
    if (!session) return res.json({ loggedIn: false });
    res.json({ loggedIn: true, username: session.username });
});

// ===========================
// Socket.IO - Chat logic
// ===========================

const onlineUsers = {}; // socketId -> { username, typing, lastMessageTime, typingTimeout }
const TYPING_TIMEOUT = 3000;
const MESSAGE_RATE_LIMIT = 1000;
const PROFANITY_LIST = ['fuck', 'shit', 'cunt', 'bitch', 'asshole', 'damn', 'hell'];

function isUsernameOnline(username) {
    return Object.values(onlineUsers).some(
        (u) => u.username.toLowerCase() === username.toLowerCase()
    );
}

io.use((socket, next) => {
    // Authenticate the socket using the session cookie set at login/register
    const cookies = cookie.parse(socket.handshake.headers.cookie || '');
    const sessionId = cookies[SESSION_COOKIE];
    const session = sessionId ? getSession(sessionId) : null;

    if (!session) {
        return next(new Error('unauthorized'));
    }

    socket.username = session.username;
    next();
});

io.on('connection', (socket) => {
    console.log(`Authenticated connection: ${socket.username} (${socket.id})`);

    if (isUsernameOnline(socket.username)) {
        // Same account logged in from elsewhere; still allow multiple tabs/devices,
        // just don't duplicate the "joined" system message spam.
    } else {
        io.emit('user joined', socket.username);
    }

    onlineUsers[socket.id] = { username: socket.username, typing: false, lastMessageTime: 0 };
    io.emit('update users', [...new Set(Object.values(onlineUsers).map((u) => u.username))]);

    socket.emit('welcome', { username: socket.username });

    socket.on('chat message', (rawMsg, callback) => {
        callback = typeof callback === 'function' ? callback : () => {};
        const user = onlineUsers[socket.id];
        if (!user) {
            return callback({ success: false, message: 'Session not recognized. Please refresh.' });
        }

        const now = Date.now();
        if (now - user.lastMessageTime < MESSAGE_RATE_LIMIT) {
            return callback({ success: false, message: 'You are sending messages too fast. Please wait.' });
        }

        if (typeof rawMsg !== 'string') {
            return callback({ success: false, message: 'Invalid message.' });
        }

        let message = sanitizeInput(rawMsg);

        PROFANITY_LIST.forEach((word) => {
            const regex = new RegExp(`\\b${word}\\b`, 'gi');
            message = message.replace(regex, '***');
        });

        if (message.length === 0) {
            return callback({ success: false, message: 'Message cannot be empty.' });
        }
        if (message.length > 500) {
            return callback({ success: false, message: 'Message is too long (max 500 characters).' });
        }

        user.lastMessageTime = now;
        io.emit('chat message', { username: user.username, message, timestamp: now });
        callback({ success: true });
    });

    socket.on('typing', (isTyping) => {
        const user = onlineUsers[socket.id];
        if (!user) return;

        user.typing = !!isTyping;
        clearTimeout(user.typingTimeout);
        if (user.typing) {
            user.typingTimeout = setTimeout(() => {
                if (onlineUsers[socket.id]) {
                    onlineUsers[socket.id].typing = false;
                    io.emit('update typing', Object.values(onlineUsers).filter((u) => u.typing).map((u) => u.username));
                }
            }, TYPING_TIMEOUT);
        }
        io.emit('update typing', Object.values(onlineUsers).filter((u) => u.typing).map((u) => u.username));
    });

    socket.on('disconnect', () => {
        const user = onlineUsers[socket.id];
        if (user) {
            clearTimeout(user.typingTimeout);
            delete onlineUsers[socket.id];
            if (!isUsernameOnline(user.username)) {
                io.emit('user left', user.username);
            }
            io.emit('update users', [...new Set(Object.values(onlineUsers).map((u) => u.username))]);
            console.log(`${user.username} disconnected (${socket.id})`);
        }
    });
});

server.listen(PORT, () => {
    console.log(`Earth Games Chat server listening on *:${PORT}`);
});
