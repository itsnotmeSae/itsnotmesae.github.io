const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const PORT = process.env.PORT || 3000;

// Serve static files from the 'client' directory
app.use(express.static(path.join(__dirname, '../client')));

// Store connected users
const users = {}; // { socketId: { username: '...', typing: false, lastMessageTime: 0 } }
const TYPING_TIMEOUT = 3000; // 3 seconds
const MESSAGE_RATE_LIMIT = 1000; // 1 message per second
const PROFANITY_LIST = ['fuck', 'shit', 'cunt', 'bitch', 'asshole', 'damn', 'hell']; // Simple profanity filter

// Helper to sanitize usernames and messages
function sanitizeInput(input) {
    return input.replace(/</g, '&lt;').replace(/>/g, '&gt;').trim();
}

function isValidUsername(username) {
    return username.length >= 3 && username.length <= 15 && /^[a-zA-Z0-9_]+$/.test(username);
}

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // Handle username selection
    socket.on('set username', (rawUsername, callback) => {
        const username = sanitizeInput(rawUsername);
        if (!isValidUsername(username)) {
            return callback({ success: false, message: 'Invalid username. Must be 3-15 alphanumeric characters or underscores.' });
        }
        if (Object.values(users).some(user => user.username === username)) {
            return callback({ success: false, message: 'Username already taken.' });
        }

        users[socket.id] = { username: username, typing: false, lastMessageTime: 0 };
        io.emit('user joined', username);
        io.emit('update users', Object.values(users).map(u => u.username));
        console.log(`User ${username} (${socket.id}) set their username.`);
        callback({ success: true, username: username });
    });

    // Handle chat messages
    socket.on('chat message', (rawMsg, callback) => {
        if (!users[socket.id]) {
            return callback({ success: false, message: 'Please set a username first.' });
        }

        const now = Date.now();
        if (now - users[socket.id].lastMessageTime < MESSAGE_RATE_LIMIT) {
            return callback({ success: false, message: 'You are sending messages too fast. Please wait.' });
        }

        let message = sanitizeInput(rawMsg);

        // Simple profanity filter
        PROFANITY_LIST.forEach(word => {
            const regex = new RegExp(`\\b${word}\\b`, 'gi');
            message = message.replace(regex, '***');
        });

        if (message.length === 0) {
            return callback({ success: false, message: 'Message cannot be empty.' });
        }

        users[socket.id].lastMessageTime = now;
        io.emit('chat message', { username: users[socket.id].username, message: message, timestamp: now });
        console.log(`Message from ${users[socket.id].username}: ${message}`);
        callback({ success: true });
    });

    // Handle typing indicator
    socket.on('typing', (isTyping) => {
        if (users[socket.id]) {
            users[socket.id].typing = isTyping;
            // Debounce typing events to avoid excessive emissions
            clearTimeout(users[socket.id].typingTimeout);
            if (isTyping) {
                users[socket.id].typingTimeout = setTimeout(() => {
                    if (users[socket.id]) {
                        users[socket.id].typing = false;
                        io.emit('update typing', Object.values(users).filter(u => u.typing).map(u => u.username));
                    }
                }, TYPING_TIMEOUT);
            }
            io.emit('update typing', Object.values(users).filter(u => u.typing).map(u => u.username));
        }
    });

    // Handle disconnect
    socket.on('disconnect', () => {
        if (users[socket.id]) {
            const username = users[socket.id].username;
            delete users[socket.id];
            io.emit('user left', username);
            io.emit('update users', Object.values(users).map(u => u.username));
            console.log(`User ${username} (${socket.id}) disconnected.`);
        }
        console.log('A user disconnected:', socket.id);
    });
});

server.listen(PORT, () => {
    console.log(`Server listening on *:${PORT}`);
});
