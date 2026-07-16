// ===========================
// Earth Games Chat - Client
// ===========================

// Configuration
const CONFIG = {
    TYPING_TIMEOUT: 3000,
    AUTO_SCROLL_THRESHOLD: 100,
    MAX_MESSAGE_LENGTH: 500,
    RECONNECT_INTERVAL: 5000,
    NOTIFICATION_TIMEOUT: 5000,
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
    lastScrollPosition: 0,
};

// DOM Elements
const elements = {
    container: document.querySelector('.container'),
    messagesContainer: document.getElementById('messagesContainer'),
    messageInput: document.getElementById('messageInput'),
    sendButton: document.getElementById('sendButton'),
    emojiButton: document.getElementById('emojiButton'),
    emojiPicker: document.getElementById('emojiPicker'),
    usersList: document.getElementById('usersList'),
    onlineCount: document.getElementById('onlineCount'),
    playerCount: document.getElementById('playerCount'),
    usernameModal: document.getElementById('usernameModal'),
    usernameInput: document.getElementById('usernameInput'),
    usernameButton: document.getElementById('usernameButton'),
    usernameError: document.getElementById('usernameError'),
    chatInputArea: document.getElementById('chatInputArea'),
    statusIndicator: document.getElementById('statusIndicator'),
    typingIndicator: document.getElementById('typingIndicator'),
    typingUsers: document.getElementById('typingUsers'),
    charCount: document.getElementById('charCount'),
    soundToggle: document.getElementById('soundToggle'),
    notificationSound: document.getElementById('notificationSound'),
};

// ===========================
// Socket.IO Connection
// ===========================

function initializeSocket() {
    state.socket = io();

    state.socket.on('connect', () => {
        console.log('Connected to server');
        state.isConnected = true;
        updateConnectionStatus(true);
    });

    state.socket.on('disconnect', () => {
        console.log('Disconnected from server');
        state.isConnected = false;
        updateConnectionStatus(false);
        addSystemMessage('Connection lost. Attempting to reconnect...');
    });

    state.socket.on('chat message', (data) => {
        displayMessage(data.username, data.message, data.timestamp);
        playNotificationSound();
    });

    state.socket.on('user joined', (username) => {
        addSystemMessage(`${username} joined the game`);
        playNotificationSound();
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
        state.typingUsers = typingUsers;
        updateTypingIndicator();
    });

    state.socket.on('error', (error) => {
        console.error('Socket error:', error);
        addSystemMessage('An error occurred. Please try again.');
    });
}

// ===========================
// Username Management
// ===========================

function setUsername() {
    const rawUsername = elements.usernameInput.value.trim();

    if (!rawUsername) {
        showUsernameError('Please enter a username');
        return;
    }

    state.socket.emit('set username', rawUsername, (response) => {
        if (response.success) {
            state.username = response.username;
            elements.usernameModal.style.display = 'none';
            elements.chatInputArea.style.display = 'flex';
            elements.messageInput.focus();
            addSystemMessage(`You joined as ${state.username}`);
        } else {
            showUsernameError(response.message);
        }
    });
}

function showUsernameError(message) {
    elements.usernameError.textContent = message;
    elements.usernameInput.classList.add('shake');
    setTimeout(() => {
        elements.usernameInput.classList.remove('shake');
    }, 300);
}

// ===========================
// Message Handling
// ===========================

function sendMessage() {
    const message = elements.messageInput.value.trim();

    if (!message) {
        return;
    }

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
        const typingText = state.typingUsers.join(', ') + ' is typing';
        elements.typingUsers.textContent = typingText;
    }
}

// ===========================
// UI Updates
// ===========================

function updateConnectionStatus(connected) {
    if (connected) {
        elements.statusIndicator.classList.add('connected');
        elements.statusIndicator.textContent = '●';
    } else {
        elements.statusIndicator.classList.remove('connected');
        elements.statusIndicator.textContent = '●';
    }
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
        userElement.textContent = username;
        elements.usersList.appendChild(userElement);
    });
}

function updateOnlineCount() {
    const count = state.users.length;
    elements.onlineCount.textContent = `${count} ${count === 1 ? 'Online' : 'Online'}`;
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

function shouldAutoScroll() {
    const container = elements.messagesContainer;
    return (
        container.scrollHeight - container.scrollTop - container.clientHeight <
        CONFIG.AUTO_SCROLL_THRESHOLD
    );
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
            elements.notificationSound.play().catch(() => {
                // Silently fail if audio can't play (browser restrictions)
            });
        } catch (error) {
            console.error('Error playing notification sound:', error);
        }
    }
}

// ===========================
// Desktop Notifications
// ===========================

function requestNotificationPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
    }
}

function showDesktopNotification(title, options = {}) {
    if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(title, {
            icon: '🌍',
            ...options,
        });
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
    // Username Modal
    elements.usernameButton.addEventListener('click', setUsername);
    elements.usernameInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            setUsername();
        }
    });

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

    // Emoji Picker Items
    document.querySelectorAll('.emoji-item').forEach((item) => {
        item.addEventListener('click', () => {
            const emoji = item.getAttribute('data-emoji');
            insertEmoji(emoji);
        });
    });

    // Close Emoji Picker when clicking outside
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
    });

    // Prevent closing modal by clicking outside
    elements.usernameModal.addEventListener('click', (e) => {
        if (e.target === elements.usernameModal) {
            e.preventDefault();
        }
    });

    // Focus on username input on load
    elements.usernameInput.focus();
}

// ===========================
// Initialization
// ===========================

function initialize() {
    console.log('Initializing Earth Games Chat...');

    // Initialize Socket.IO
    initializeSocket();

    // Setup Event Listeners
    setupEventListeners();

    // Request Notification Permission
    requestNotificationPermission();

    // Load sound preference from localStorage
    const savedSoundPreference = localStorage.getItem('earthgames-sound-enabled');
    if (savedSoundPreference !== null) {
        state.soundEnabled = JSON.parse(savedSoundPreference);
        elements.soundToggle.checked = state.soundEnabled;
    }

    console.log('Earth Games Chat initialized');
}

// Start the application when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
} else {
    initialize();
}

// Save sound preference to localStorage when changed
window.addEventListener('beforeunload', () => {
    localStorage.setItem('earthgames-sound-enabled', JSON.stringify(state.soundEnabled));
});
