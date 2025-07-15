// Version: 1.0.9 - Simple Local Game (Works Immediately)b
function GameState() {
    this.currentPlayer = null;
    this.gameStarted = false;
    this.playerHand = [];
    this.score = 0;
    this.cardsPlayed = 0;
    this.playHistory = [];
    this.holdCards = [];
    this.activeEffects = {};
    this.storageKey = 'football-game-data';
    this.init();
}

GameState.prototype.init = function() {
    console.log('🚀 Game initializing...');
    this.setupEventListeners();
    this.showScreen('welcome-screen');
    this.startPolling();
    this.showMessage('Game ready!', 'success');
};

GameState.prototype.setupEventListeners = function() {
    var self = this;
    console.log('🔗 Setting up event listeners...');
    
    var startBtn = document.getElementById('join-game-btn');
    if (startBtn) {
        startBtn.onclick = function() { 
            console.log('🎯 Start button clicked');
            self.joinGame(); 
        };
        console.log('✅ Start button found and connected');
    } else {
        console.error('❌ Start button not found');
    }
    
    var nameInput = document.getElementById('player-name-welcome');
    if (nameInput) {
        nameInput.onkeypress = function(e) {
            if (e.key === 'Enter') self.joinGame();
        };
    }
    
    var undoBtn = document.getElementById('undo-btn');
    if (undoBtn) undoBtn.onclick = function() { self.undoLastPlay(); };
    
    var leaveBtn = document.getElementById('new-game-btn');
    if (leaveBtn) leaveBtn.onclick = function() { self.leaveGame(); };
};

GameState.prototype.joinGame = function() {
    console.log('🎯 Join game called!');
    
    var nameInput = document.getElementById('player-name-welcome');
    if (!nameInput) {
        console.error('❌ Name input not found!');
        return;
    }
    
    var name = nameInput.value.trim();
    console.log('📝 Player name:', name);
    
    if (!name) {
        this.showMessage('Please enter your name', 'error');
        return;
    }
    
    this.currentPlayer = name;
    this.gameStarted = true;
    this.startNewHand();
    this.showGameScreen();
    
    console.log('✅ Game started for:', name);
    
    // Immediately sync
    this.syncWithOthers();
};

GameState.prototype.startNewHand = function() {
    console.log('🃏 Starting new hand...');
    
    if (typeof createDeck !== 'function') {
        console.error('❌ createDeck not found! Check cards.js');
        this.showMessage('Error: Cards not loaded', 'error');
        return;
    }
    
    this.deck = createDeck();
    this.playerHand = [];
    this.score = 0;
    this.cardsPlayed = 0;
    this.playHistory = [];
    this.holdCards = [];
    this.activeEffects = {};
    
    for (var i = 0; i < 5 && this.deck.length > 0; i++) {
        this.playerHand.push(this.deck.pop());
    }
    
    this.updateDisplay();
    console.log('✅ Hand dealt:', this.playerHand.length, 'cards');
};

GameState.prototype.showScreen = function(screenId) {
    console.log('📱 Switching to screen:', screenId);
    
    var screens = document.querySelectorAll('.screen');
    for (var i = 0; i < screens.length; i++) {
        screens[i].classList.remove('active');
    }
    
    var targetScreen = document.getElementById(screenId);
    if (targetScreen) {
        targetScreen.classList.add('active');
        console.log('✅ Screen switched successfully');
    } else {
        console.error('❌ Screen not found:', screenId);
    }
};

GameState.prototype.showGameScreen = function() {
    console.log('🎮 Showing game screen...');
    
    var nameEl = document.getElementById('game-player-name');
    if (nameEl) {
        nameEl.textContent = this.currentPlayer;
    }
    
    this.showScreen('game-screen');
    this.showMessage('Welcome ' + this.currentPlayer + '!', 'success');
};

GameState.prototype.showMessage = function(text, type) {
    console.log('💬 Message:', text);
    
    var container = document.getElementById('message-container');
    if (!container) return;
    
    var message = document.createElement('div');
    message.className = 'message message-' + (type || 'info');
    message.textContent = text;
    container.appendChild(message);
    
    setTimeout(function() {
        if (message.parentNode) message.remove();
    }, 3000);
};

GameState.prototype.updateDisplay = function() {
    this.displayHand();
    this.updateStats();
};

GameState.prototype.displayHand = function() {
    var container = document.getElementById('player-hand');
    if (!container) return;
    
    container.innerHTML = '';
    
    for (var i = 0; i < this.playerHand.length; i++) {
        var card = this.playerHand[i];
        var cardDiv = document.createElement('div');
        cardDiv.className = 'card ' + card.type;
        
        var self = this;
        cardDiv.onclick = (function(index) {
            return function() {
                self.playCard(index);
            };
        })(i);
        
        cardDiv.innerHTML = '<div class="card-header"><span class="card-name">' + card.name + '</span><span class="card-points">' + card.points + ' pts</span></div><div class="card-description">' + card.description + '</div>';
        
        container.appendChild(cardDiv);
    }
};

GameState.prototype.updateStats = function() {
    var scoreEl = document.getElementById('current-score');
    if (scoreEl) scoreEl.textContent = this.score;
    
    var playedEl = document.getElementById('cards-played');
    if (playedEl) playedEl.textContent = this.cardsPlayed;
    
    var handEl = document.getElementById('cards-in-hand');
    if (handEl) handEl.textContent = this.playerHand.length;
};

GameState.prototype.playCard = function(index) {
    var card = this.playerHand[index];
    if (!card) return;
    
    console.log('🃏 Playing card:', card.name);
    
    this.playerHand.splice(index, 1);
    this.cardsPlayed++;
    
    if (card.type === 'event') {
        var points = card.points;
        this.score += points;
        this.showMessage(card.name + ' for ' + points + ' points!', 'success');
    }
    
    // Deal a new card
    if (this.deck.length > 0) {
        this.playerHand.push(this.deck.pop());
    }
    
    this.updateDisplay();
    this.syncWithOthers();
};

GameState.prototype.undoLastPlay = function() {
    this.showMessage('Undo not implemented yet', 'info');
};

GameState.prototype.leaveGame = function() {
    this.currentPlayer = null;
    this.gameStarted = false;
    var nameInput = document.getElementById('player-name-welcome');
    if (nameInput) nameInput.value = '';
    this.showScreen('welcome-screen');
    this.showMessage('Left game', 'info');
};

// Simple local storage with cross-tab communication
GameState.prototype.startPolling = function() {
    var self = this;
    
    // Listen for storage changes from other tabs
    window.addEventListener('storage', function(e) {
        if (e.key === self.storageKey && e.newValue && self.currentPlayer) {
            console.log('📡 Got update from another tab');
            try {
                var data = JSON.parse(e.newValue);
                self.updateOtherPlayersDisplay(data.players);
            } catch (error) {
                console.log('❌ Error parsing storage event:', error);
            }
        }
    });
    
    // Also poll every 3 seconds for safety
    setInterval(function() {
        if (self.currentPlayer) {
            self.syncWithOthers();
        } else {
            self.updateWelcomeDisplay();
        }
    }, 3000);
};

GameState.prototype.loadSharedData = function() {
    try {
        var data = localStorage.getItem(this.storageKey);
        if (data) {
            return JSON.parse(data);
        } else {
            return { players: {}, hands: {}, messages: [], lastUpdated: Date.now() };
        }
    } catch (e) {
        console.log('❌ Error loading data:', e);
        return { players: {}, hands: {}, messages: [], lastUpdated: Date.now() };
    }
};

GameState.prototype.saveSharedData = function(data) {
    try {
        data.lastUpdated = Date.now();
        localStorage.setItem(this.storageKey, JSON.stringify(data));
        console.log('💾 Data saved successfully');
        return true;
    } catch (e) {
        console.log('❌ Error saving data:', e);
        return false;
    }
};

GameState.prototype.syncWithOthers = function() {
    var data = this.loadSharedData();
    
    if (!data.players) data.players = {};
    if (!data.hands) data.hands = {};
    
    if (this.currentPlayer) {
        data.players[this.currentPlayer] = {
            name: this.currentPlayer,
            score: this.score,
            cardsInHand: this.playerHand.length,
            cardsPlayed: this.cardsPlayed,
            lastSeen: Date.now()
        };
        
        data.hands[this.currentPlayer] = this.playerHand.slice();
    }
    
    console.log('👥 All players:', Object.keys(data.players));
    
    this.saveSharedData(data);
    this.updateOtherPlayersDisplay(data.players);
};

GameState.prototype.updateOtherPlayersDisplay = function(allPlayers) {
    if (!allPlayers) return;
    
    var others = [];
    var now = Date.now();
    
    for (var name in allPlayers) {
        if (name !== this.currentPlayer) {
            var timeSince = now - allPlayers[name].lastSeen;
            if (timeSince < 30000) { // 30 seconds
                others.push(allPlayers[name]);
            }
        }
    }
    
    console.log('👁️ Found', others.length, 'other active players');
    
    var section = document.getElementById('other-players-section');
    var container = document.getElementById('other-players-list');
    
    if (!section || !container) return;
    
    if (others.length === 0) {
        section.style.display = 'none';
        return;
    }
    
    section.style.display = 'block';
    container.innerHTML = '';
    
    for (var i = 0; i < others.length; i++) {
        var player = others[i];
        var div = document.createElement('div');
        div.className = 'other-player';
        div.innerHTML = '<div class="player-info"><div class="player-name-display">' + player.name + '</div><div class="player-stats">Score: ' + player.score + ' • Played: ' + player.cardsPlayed + '</div></div><div class="player-card-count">' + player.cardsInHand + ' cards</div>';
        container.appendChild(div);
    }
    
    var onlineEl = document.getElementById('players-online-game');
    if (onlineEl) {
        onlineEl.textContent = others.length + 1;
    }
};

GameState.prototype.updateWelcomeDisplay = function() {
    var data = this.loadSharedData();
    
    if (!data || !data.players) return;
    
    var activeCount = 0;
    var now = Date.now();
    
    for (var name in data.players) {
        if (now - data.players[name].lastSeen < 30000) {
            activeCount++;
        }
    }
    
    var onlineEl = document.getElementById('players-online');
    if (onlineEl) onlineEl.textContent = activeCount + ' player(s) online';
};
