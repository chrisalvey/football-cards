// Version: 1.0.5 - Firebase Backend (GitHub Pages Compatible)
// Football Card Game with Firebase Realtime Database
function GameState() {
    this.currentPlayer = null;
    this.gameStarted = false;
    this.playerHand = [];
    this.score = 0;
    this.cardsPlayed = 0;
    this.playHistory = [];
    this.holdCards = [];
    this.activeEffects = {};
    
    // Use Firebase Realtime Database (free, works on GitHub Pages)
    this.dataUrl = 'https://football-game-shared-default-rtdb.firebaseio.com/game.json';
    
    this.init();
}

GameState.prototype.init = function() {
    this.setupEventListeners();
    this.showScreen('welcome-screen');
    this.initializeSharedRoom();
};

// Initialize the shared room
GameState.prototype.initializeSharedRoom = function() {
    var self = this;
    
    this.testConnection(function(works) {
        if (works) {
            self.showMessage('Connected to shared game room', 'success');
        } else {
            self.showMessage('Connection failed', 'error');
        }
        self.startPolling();
    });
};

// Test if we can connect to Firebase
GameState.prototype.testConnection = function(callback) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', this.dataUrl, true);
    
    xhr.onreadystatechange = function() {
        if (xhr.readyState === 4) {
            callback(xhr.status === 200);
        }
    };
    
    xhr.timeout = 5000;
    xhr.ontimeout = function() {
        callback(false);
    };
    
    xhr.send();
};

// Load shared game data
GameState.prototype.loadSharedData = function(callback) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', this.dataUrl + '?t=' + Date.now(), true);
    
    xhr.onreadystatechange = function() {
        if (xhr.readyState === 4) {
            if (xhr.status === 200) {
                try {
                    var data = JSON.parse(xhr.responseText);
                    // Firebase returns null for empty data
                    if (!data) {
                        data = {
                            players: {},
                            hands: {},
                            messages: [],
                            gameActive: true,
                            lastUpdated: Date.now()
                        };
                    }
                    callback(data);
                } catch (e) {
                    console.log('❌ Error parsing data:', e);
                    callback(null);
                }
            } else {
                console.log('❌ Load failed, status:', xhr.status);
                callback(null);
            }
        }
    };
    
    xhr.onerror = function() {
        console.log('❌ Network error loading data');
        callback(null);
    };
    
    xhr.send();
};

// Save shared game data
GameState.prototype.saveSharedData = function(data, callback) {
    data.lastUpdated = Date.now();
    
    var xhr = new XMLHttpRequest();
    xhr.open('PUT', this.dataUrl, true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    
    xhr.onreadystatechange = function() {
        if (xhr.readyState === 4) {
            var success = (xhr.status === 200);
            console.log('💾 Save result:', success ? 'SUCCESS' : 'FAILED');
            if (callback) callback(success);
        }
    };
    
    xhr.onerror = function() {
        console.log('❌ Network error saving data');
        if (callback) callback(false);
    };
    
    xhr.send(JSON.stringify(data));
};

// Start polling for updates
GameState.prototype.startPolling = function() {
    var self = this;
    
    // Update every 2 seconds
    setInterval(function() {
        if (self.currentPlayer) {
            self.syncWithOthers();
        } else {
            self.updateWelcomeDisplay();
        }
    }, 2000);
};

// Sync with other players
GameState.prototype.syncWithOthers = function() {
    var self = this;
    
    console.log('🔄 Syncing with others...');
    
    this.loadSharedData(function(data) {
        console.log('📊 Loaded shared data:', data);
        
        if (!data) {
            console.log('❌ No shared data loaded');
            return;
        }
        
        // Ensure data structure exists
        if (!data.players) data.players = {};
        if (!data.hands) data.hands = {};
        if (!data.messages) data.messages = [];
        
        if (self.currentPlayer) {
            console.log('✅ Updating my player info:', self.currentPlayer);
            
            // Update my player data
            data.players[self.currentPlayer] = {
                name: self.currentPlayer,
                score: self.score,
                cardsInHand: self.playerHand.length,
                cardsPlayed: self.cardsPlayed,
                lastSeen: Date.now()
            };
            
            data.hands[self.currentPlayer] = self.playerHand.slice();
        }
        
        console.log('👥 All players in data:', Object.keys(data.players));
        
        // Save updated data
        self.saveSharedData(data, function(success) {
            if (success) {
                console.log('🎮 Updating display with players:', data.players);
                self.updateOtherPlayersDisplay(data.players);
                self.checkForMessages(data.messages || []);
            }
        });
    });
};

// Join the game
GameState.prototype.joinGame = function() {
    var nameInput = document.getElementById('player-name-welcome');
    var name = nameInput.value.trim();
    
    if (!name) {
        this.showMessage('Please enter your name', 'error');
        return;
    }
    
    if (name.length > 20) {
        this.showMessage('Name too long', 'error');
        return;
    }
    
    this.currentPlayer = name;
    this.gameStarted = true;
    
    this.startNewHand();
    this.showGameScreen();
    
    // Force an immediate sync when joining
    var self = this;
    setTimeout(function() {
        self.syncWithOthers();
    }, 500);
};

// Start new hand
GameState.prototype.startNewHand = function() {
    this.deck = createDeck();
    this.playerHand = [];
    this.score = 0;
    this.cardsPlayed = 0;
    this.playHistory = [];
    this.holdCards = [];
    this.activeEffects = {};
    
    this.dealCards(5);
    this.updateDisplay();
};

GameState.prototype.dealCards = function(count) {
    for (var i = 0; i < count && this.deck.length > 0; i++) {
        this.playerHand.push(this.deck.pop());
    }
};

// Play a card
GameState.prototype.playCard = function(index) {
    var card = this.playerHand[index];
    if (!card) return;
    
    this.saveToHistory(card, index);
    this.playerHand.splice(index, 1);
    this.cardsPlayed++;
    
    if (card.type === 'event') {
        this.handleEventCard(card);
    } else if (card.playType === 'hold') {
        this.handleHoldCard(card);
    } else {
        this.handleActionCard(card);
        return;
    }
    
    this.dealCards(1);
    this.updateDisplay();
    
    // Force sync after playing a card
    this
