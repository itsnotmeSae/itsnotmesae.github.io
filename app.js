// ===========================
// Earth Games Chat - Client
// ===========================

// Set this to your local backend's address when the frontend is hosted
// elsewhere (e.g. GitHub Pages) and the backend runs on your machine.
// Leave as '' if frontend and backend are served from the same origin.
const API_BASE = window.API_BASE || 'http://localhost:3000';

// Configuration
const CONFIG = {
    TYPING_TIMEOUT: 3000,
    AUTO_SCROLL_THRESHOLD: 100,
    MAX_MESSAGE_LENGTH: 500,
};

// State Management
const state = {
    socket: null,
    username: null,
    isConnected: false,
    isTyping: false,
    typingTimeout: null,
    users: [],
    typingUsers: [],
    soundEnabled: true,
    authMode: 'login', // 'login' | 'register'
};

// DOM Elements
const elements = {
    messagesContainer: document.getElementById('messagesContainer'),
    messageInput: document.getElementById('messageInput'),
    sendButton: document.getElementById('sendButton'),
    emojiButton: document.getElementById('emojiButton'),
    emojiPicker: document.getElementById('emojiPicker'),
    usersList: document.getElementById('usersList'),
    onlineCount: document.getElementById('onlineCount'),
    playerCount: document.getElementById('playerCount'),
    statusIndicator: document.getElementById('statusIndicator'),
    typingIndicator: document.getElementById('typingIndicator'),
    typingUsers: document.getElementById('typingUsers'),
    charCount: document.getElementById('charCount'),
    soundToggle: document.getElementById('soundToggle'),
    notificationSound: document.getElementById('notificationSound'),

    // Auth
    authScreen: document.getElementById('authScreen'),
    mainContent: document.getElementById('mainContent'),
    authForm: document.getElementById('authForm'),
    authUsername: document.getElementById('authUsername'),
    authPassword: document.getElementById('authPassword'),
    authError: document.getElementById('authError'),
    authButton: document.getElementById('authButton'),
    authTitle: document.getElementById('authTitle'),
    authSubtitle: document.getElementById('authSubtitle'),
    loginTab: document.getElementById('loginTab'),
    registerTab: document.getElementById('registerTab'),
    logoutButton: document.getElementById('logoutButton'),
};

// ===========================
// Auth
// ===========================

function setAuthMode(mode) {
    state.authMode = mode;
    elements.authError.textContent = '';

    if (mode === 'login') {
        elements.loginTab.classList.add('active');
        elements.registerTab.classList.remove('active');
        elements.authTitle.textContent = 'Welcome Back';
        elements.authSubtitle.textContent = 'Log in to join the chat';
        elements.authButton.textContent = 'Log In';
        elements.authPassword.autocomplete = 'current-password';
    } else {
        elements.registerTab.classList.add('active');
        elements.loginTab.classList.remove('active');
        elements.authTitle.textContent = 'Create an Account';
        elements.authSubtitle.textContent = 'Register a new username to join';
        elements.authButton.textContent = 'Register';
        elements.authPassword.autocomplete = 'new-password';
    }
}

function showAuthError(message) {
    elements.authError.textContent = message;
    elements.authUsername.classList.add('shake');
    setTimeout(() => elements.authUsername.classList.remove('shake'), 300);
}

async function handleAuthSubmit(e) {
    e.preventDefault();

    const username = elements.authUsername.value.trim();
    const password = elements.authPassword.value;

    if (!username || !password) {
        showAuthError('Please fill in both fields.');
        return;
    }

    elements.authButton.disabled = true;
    const endpoint = state.authMode === 'login' ? `${API_BASE}/api/login` : `${API_BASE}/api/register`;

    try {
        const res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ username, password }),
        });
        const data = await res.json();

        if (!data.success) {
            showAuthError(data.message || 'Something went wrong.');
            elements.authButton.disabled = false;
            return;
        }

        state.username = data.username;
        enterChat();
    } catch (err) {
        console.error('Auth error:', err);
        showAuthError('Could not reach the server. Please try again.');
        elements.authButton.disabled = false;
    }
}

async function checkExistingSession() {
    try {
        const res = await fetch(`${API_BASE}/api/me`, { credentials: 'include' });
        const data = await res.json();
        if (data.loggedIn) {
            state.username = data.username;
            enterChat();
        }
    } catch (err) {
        // Not logged in / server unreachable yet; stay on auth screen.
        console.log('No existing session.');
    }
}

function enterChat() {
    elements.authScreen.style.display = 'none';
    elements.mainContent.style.display = 'flex';
    elements.logoutButton.style.display = 'inline-block';
    elements.authButton.disabled = false;
    initializeSocket();
    elements.messageInput.focus();
    addSystemMessage(`You joined as ${state.username}`);
}

async function handleLogout() {
    try {
        await fetch(`${API_BASE}/api/logout`, { method: 'POST', credentials: 'include' });
    } catch (err) {
        console.error('Logout error:', err);
    }

    if (state.socket) {
        state.socket.disconnect();
        state.socket = null;
    }

    state.username = null;
    elements.messagesContainer.innerHTML = `
        <div class="welcome-message">
            <div class="welcome-icon">⛏️</div>
            <h2>Welcome to Earth Games Chat</h2>
            <p>A Minecraft-inspired chat experience</p>
        </div>
    `;
    elements.authUsername.value = '';
    elements.authPassword.value = '';
    elements.mainContent.style.display = 'none';
    elements.authScreen.style.display = 'flex';
    elements.logoutButton.style.display = 'none';
    setAuthMode('login');
}

// ===========================
// Socket.IO Connection
// ===========================

function initializeSocket() {
    state.socket = io(API_BASE, { withCredentials: true });

    state.socket.on('connect', () => {
        state.isConnected = true;
        updateConnectionStatus(true);
    });

    state.socket.on('connect_error', (err) => {
        console.error('Connection error:', err.message);
        if (err.message === 'unauthorized') {
            addSystemMessage('Your session expired. Please log in again.');
            handleLogout();
        }
    });

    state.socket.on('disconnect', () => {
        state.isConnected = false;
        updateConnectionStatus(false);
        addSystemMessage('Connection lost. Attempting to reconnect...');
    });

    state.socket.on('chat message', (data) => {
        displayMessage(data.username, data.message, data.timestamp);
        if (data.username !== state.username) {
            playNotificationSound();
        }
    });

    state.socket.on('user joined', (username) => {
        if (username !== state.username) {
            addSystemMessage(`${username} joined the game`);
        }
    });

    state.socket.on('user left', (username) => {
        addSystemMessage(`${username} left the game`);
    });

    state.socket.on('update users', (users) => {
        state.users = users;
        updateUsersList();
        updateOnlineCount();
    });

    state.socket.on('update typing', (typingUsers) => {
        state.typingUsers = typingUsers.filter((u) => u !== state.username);
        updateTypingIndicator();
    });
}

// ===========================
// Message Handling
// ===========================

function sendMessage() {
    const message = elements.messageInput.value.trim();

    if (!message) return;

    if (message.length > CONFIG.MAX_MESSAGE_LENGTH) {
        addSystemMessage(`Message is too long (max ${CONFIG.MAX_MESSAGE_LENGTH} characters)`);
        return;
    }

    if (!state.socket || !state.isConnected) {
        addSystemMessage('Not connected to server. Please wait...');
        return;
    }

    state.socket.emit('chat message', message, (response) => {
        if (response.success) {
            elements.messageInput.value = '';
            updateCharCount();
            stopTyping();
        } else {
            addSystemMessage(`Error: ${response.message}`);
        }
    });
}

function displayMessage(username, message, timestamp) {
    const messageElement = document.createElement('div');
    messageElement.className = 'message';

    const timeString = new Date(timestamp).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    });

    messageElement.innerHTML = `
        <div class="message-header">
            <span class="message-username">${escapeHtml(username)}</span>
            <span class="message-timestamp">${timeString}</span>
        </div>
        <div class="message-content">${escapeHtml(message)}</div>
    `;

    elements.messagesContainer.appendChild(messageElement);
    autoScroll();
}

function addSystemMessage(message) {
    const messageElement = document.createElement('div');
    messageElement.className = 'system-message';
    messageElement.textContent = message;
    elements.messagesContainer.appendChild(messageElement);
    autoScroll();
}

// ===========================
// Typing Indicator
// ===========================

function startTyping() {
    if (!state.isTyping && state.socket && state.isConnected) {
        state.isTyping = true;
        state.socket.emit('typing', true);
    }

    clearTimeout(state.typingTimeout);
    state.typingTimeout = setTimeout(() => {
        stopTyping();
    }, CONFIG.TYPING_TIMEOUT);
}

function stopTyping() {
    if (state.isTyping && state.socket && state.isConnected) {
        state.isTyping = false;
        state.socket.emit('typing', false);
    }
    clearTimeout(state.typingTimeout);
}

function updateTypingIndicator() {
    if (state.typingUsers.length === 0) {
        elements.typingIndicator.classList.add('hidden');
    } else {
        elements.typingIndicator.classList.remove('hidden');
        const verb = state.typingUsers.length === 1 ? 'is' : 'are';
        elements.typingUsers.textContent = `${state.typingUsers.join(', ')} ${verb} typing`;
    }
}

// ===========================
// UI Updates
// ===========================

function updateConnectionStatus(connected) {
    elements.statusIndicator.classList.toggle('connected', connected);
}

function updateUsersList() {
    elements.usersList.innerHTML = '';

    if (state.users.length === 0) {
        elements.usersList.innerHTML = '<div class="no-users">No players online</div>';
        return;
    }

    state.users.forEach((username) => {
        const userElement = document.createElement('div');
        userElement.className = 'user-item';
        if (username === state.username) {
            userElement.classList.add('is-you');
            userElement.textContent = `${username} (you)`;
        } else {
            userElement.textContent = username;
        }
        elements.usersList.appendChild(userElement);
    });
}

function updateOnlineCount() {
    const count = state.users.length;
    elements.onlineCount.textContent = `${count} Online`;
    elements.playerCount.textContent = count;
}

function updateCharCount() {
    const length = elements.messageInput.value.length;
    elements.charCount.textContent = length;
}

// ===========================
// Auto-scroll
// ===========================

function autoScroll() {
    const container = elements.messagesContainer;
    container.scrollTop = container.scrollHeight;
}

// ===========================
// Emoji Picker
// ===========================

function toggleEmojiPicker() {
    elements.emojiPicker.classList.toggle('active');
}

function closeEmojiPicker() {
    elements.emojiPicker.classList.remove('active');
}

function insertEmoji(emoji) {
    const start = elements.messageInput.selectionStart;
    const end = elements.messageInput.selectionEnd;
    const text = elements.messageInput.value;

    elements.messageInput.value = text.substring(0, start) + emoji + text.substring(end);
    elements.messageInput.focus();
    elements.messageInput.selectionStart = elements.messageInput.selectionEnd = start + emoji.length;
    updateCharCount();
    closeEmojiPicker();
}

// ===========================
// Sound Notifications
// ===========================

function playNotificationSound() {
    if (state.soundEnabled && elements.notificationSound) {
        try {
            elements.notificationSound.currentTime = 0;
            elements.notificationSound.play().catch(() => {});
        } catch (error) {
            console.error('Error playing notification sound:', error);
        }
    }
}

// ===========================
// Utility Functions
// ===========================

function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;',
    };
    return text.replace(/[&<>"']/g, (char) => map[char]);
}

// ===========================
// Event Listeners
// ===========================

function setupEventListeners() {
    // Auth
    elements.authForm.addEventListener('submit', handleAuthSubmit);
    elements.loginTab.addEventListener('click', () => setAuthMode('login'));
    elements.registerTab.addEventListener('click', () => setAuthMode('register'));
    elements.logoutButton.addEventListener('click', handleLogout);

    // Message Input
    elements.messageInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    elements.messageInput.addEventListener('input', () => {
        updateCharCount();
        if (elements.messageInput.value.trim()) {
            startTyping();
        }
    });

    elements.messageInput.addEventListener('blur', () => {
        stopTyping();
    });

    // Send Button
    elements.sendButton.addEventListener('click', sendMessage);

    // Emoji Button
    elements.emojiButton.addEventListener('click', toggleEmojiPicker);

    document.querySelectorAll('.emoji-item').forEach((item) => {
        item.addEventListener('click', () => {
            const emoji = item.getAttribute('data-emoji');
            insertEmoji(emoji);
        });
    });

    document.addEventListener('click', (e) => {
        if (
            !elements.emojiPicker.contains(e.target) &&
            !elements.emojiButton.contains(e.target)
        ) {
            closeEmojiPicker();
        }
    });

    // Sound Toggle
    elements.soundToggle.addEventListener('change', (e) => {
        state.soundEnabled = e.target.checked;
        localStorage.setItem('earthgames-sound-enabled', JSON.stringify(state.soundEnabled));
    });
}

// ===========================
// Initialization
// ===========================

function initialize() {
    setupEventListeners();

    const savedSoundPreference = localStorage.getItem('earthgames-sound-enabled');
    if (savedSoundPreference !== null) {
        state.soundEnabled = JSON.parse(savedSoundPreference);
        elements.soundToggle.checked = state.soundEnabled;
    }

    checkExistingSession();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
} else {
    initialize();
}
