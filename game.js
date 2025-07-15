// Simplified Football Card Game with Shared Data
function GameState() {
    this.currentPlayer = null;
    this.gameStarted = false;
    this.playerHand = [];
    this.score = 0;
    this.cardsPlayed = 0;
    this.playHistory = [];
    this.holdCards = [];
    this.activeEffects = {};
    
    // Simple shared data using a public JSON store
    this.gameRoom = 'football-game-' + (new URLSearchParams(window.location.search).get('room') || 'default');
    this.binId = null; // Will be set when room is created/joined
    
    this.init();
}

GameState.prototype.init = function() {
    this.setupEventListeners();
    this.showScreen('welcome-screen');
    this.checkForExistingRoom();
};

// Check if there's already a room going
GameState.prototype.checkForExistingRoom = function() {
    var self = this;
    var roomData = localStorage.getItem('current-room-data');
    
    if (roomData) {
        try {
            var data = JSON.parse(roomData);
            self.binId = data.binId;
            self.gameRoom = data.roomName;
            document.getElementById('room-display').textContent = 'Room: ' + self.gameRoom;
            self.startPolling();
        } catch (e) {
            // Clear invalid data
            localStorage.removeItem('current-room-data');
        }
    }
};

// Create a new game room
GameState.prototype.createRoom = function() {
    var self = this;
    var roomName = this.generateRoomCode();
    
    var initData = {
        roomName: roomName,
        players: {},
        hands: {},
        messages: [],
        gameActive: true,
        created: Date.now()
    };
    
    // Create bin at JSONBin.io (free service)
    var xhr = new XMLHttpRequest();
    xhr.open('POST', 'https://api.jsonbin.io/v3/b', true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.setRequestHeader('X-Master-Key', '$2a$10$qZ9wJQz5qH8rC3xK2yF6yO8xL4vN7mP9sT1uE6wA3bG5dI2jK8lM4n'); // Public demo key
    xhr.setRequestHeader('X-Bin-Name', roomName);
    xhr.setRequestHeader('X-Bin-Private', 'false');
    
    xhr.onreadystatechange = function() {
        if (xhr.readyState === 4) {
            if (xhr.status === 200) {
                try {
                    var response = JSON.parse(xhr.responseText);
                    self.binId = response.metadata.id;
                    self.gameRoom = roomName;
                    
                    // Save room info locally
                    localStorage.setItem('current-room-data', JSON.stringify({
                        binId: self.binId,
                        roomName: roomName
                    }));
                    
                    document.getElementById('room-display').textContent = 'Room: ' + roomName;
                    document.getElementById('share-code').textContent = roomName;
                    self.showMessage('Room created: ' + roomName, 'success');
                    self.startPolling();
                } catch (e) {
                    self.showMessage('Failed to create room', 'error');
                }
            } else {
                self.showMessage('Failed to create room', 'error');
            }
        }
    };
    
    xhr.send(JSON.stringify(initData));
};

// Join existing room
GameState.prototype.joinRoom = function() {
    var roomCode = document.getElementById('room-code-input').value.trim().toUpperCase();
    
    if (!roomCode) {
        this.showMessage('Please enter a room code', 'error');
        return;
    }
    
    var self = this;
    
    // Search for room by name
    var xhr = new XMLHttpRequest();
    xhr.open('GET', 'https://api.jsonbin.io/v3/c/collection/bins', true);
    xhr.setRequestHeader('X-Master-Key', '$2a$10$qZ9wJQz5qH8rC3xK2yF6yO8xL4vN7mP9sT1uE6wA3bG5dI2jK8lM4n');
    
    xhr.onreadystatechange = function() {
        if (xhr.readyState === 4) {
            if (xhr.status === 200) {
                try {
                    var response = JSON.parse(xhr.responseText);
                    var foundBin = null;
                    
                    // Look for matching room name
                    for (var i = 0; i < response.length; i++) {
                        if (response[i].name === roomCode) {
                            foundBin = response[i];
                            break;
                        }
                    }
                    
                    if (foundBin) {
                        self.binId = foundBin.id;
                        self.gameRoom = roomCode;
                        
                        localStorage.setItem('current-room-data', JSON.stringify({
                            binId: self.binId,
                            roomName: roomCode
                        }));
                        
                        document.getElementById('room-display').textContent = 'Room: ' + roomCode;
                        self.showMessage('Joined room: ' + roomCode, 'success');
                        self.startPolling();
                    } else {
                        self.showMessage('Room not found', 'error');
                    }
                } catch (e) {
                    self.showMessage('Error finding room', 'error');
                }
            } else {
                self.showMessage('Error finding room', 'error');
            }
        }
    };
    
    xhr.send();
};

// Generate simple room code
GameState.prototype.generateRoomCode = function() {
    var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed confusing chars
    var result = '';
    for (var i = 0; i < 4; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
};

// Load shared game data
GameState.prototype.loadSharedData = function(callback) {
    if (!this.binId) {
        callback(null);
        return;
    }
    
    var xhr = new XMLHttpRequest();
    xhr.open('GET', 'https://api.jsonbin.io/v3/b/' + this.binId + '/latest', true);
    xhr.setRequestHeader('X-Master-Key', '$2a$10$qZ9wJQz5qH8rC3xK2yF6yO8xL4vN7mP9sT1uE6wA3bG5dI2jK8lM4n');
    
    xhr.onreadystatechange = function() {
        if (xhr.readyState === 4) {
            if (xhr.status === 200) {
                try {
                    var response = JSON.parse(xhr.responseText);
                    callback(response.record);
                } catch (e) {
                    callback(null);
                }
            } else {
                callback(null);
            }
        }
    };
    
    xhr.send();
};

// Save shared game data
GameState.prototype.saveSharedData = function(data, callback) {
    if (!this.binId) {
        if (callback) callback(false);
        return;
    }
    
    var xhr = new XMLHttpRequest();
    xhr.open('PUT', 'https://api.jsonbin.io/v3/b/' + this.binId, true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.setRequestHeader('X-Master-Key', '$2a$10$qZ9wJQz5qH8rC3xK2yF6yO8xL4vN7mP9sT1uE6wA3bG5dI2jK8lM4n');
    
    xhr.onreadystatechange = function() {
        if (xhr.readyState === 4) {
            if (callback) callback(xhr.status === 200);
        }
    };
    
    xhr.send(JSON.stringify(data));
};

// Start polling for updates
GameState.prototype.startPolling = function() {
    var self = this;
    
    // Update every 3 seconds
    setInterval(function() {
        if (self.binId) {
            self.syncWithOthers();
        }
    }, 3000);
    
    // Update welcome screen
    setInterval(function() {
        if (!self.currentPlayer) {
            self.updateWelcomeDisplay();
        }
    }, 5000);
};

// Sync with other players
GameState.prototype.syncWithOthers = function() {
    var self = this;
    
    this.loadSharedData(function(data) {
        if (!data) return;
        
        // Update my info
        if (!data.players) data.players = {};
        if (!data.hands) data.hands = {};
        
        if (self.currentPlayer) {
            data.players[self.currentPlayer] = {
                name: self.currentPlayer,
                score: self.score,
                cardsInHand: self.playerHand.length,
                cardsPlayed: self.cardsPlayed,
                lastSeen: Date.now()
            };
            
            data.hands[self.currentPlayer] = self.playerHand.slice();
        }
        
        // Save updated data
        self.saveSharedData(data, function(success) {
            if (success) {
                // Update display with other players
                self.updateOtherPlayersDisplay(data.players);
                self.checkForMessages(data.messages || []);
            }
        });
    });
};

// Join the game
GameState.prototype.joinGame = function() {
    if (!this.binId) {
        this.showMessage('Please create or join a room first', 'error');
        return;
    }
    
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
};

GameState.prototype.handleEventCard = function(card) {
    var points = card.points;
    if (this.activeEffects.doubleNext) {
        points *= 2;
        delete this.activeEffects.doubleNext;
    }
    
    this.score += points;
    this.broadcastMessage(this.currentPlayer + ' played ' + card.name + ' (' + points + ' pts)');
    this.showMessage(card.name + ' for ' + points + ' points!', 'success');
};

GameState.prototype.handleHoldCard = function(card) {
    this.holdCards.push(card);
    
    if (card.id === 'double_next_score') this.activeEffects.doubleNext = true;
    if (card.id === 'block_steal') this.activeEffects.blockSteal = true;
    
    this.broadcastMessage(this.currentPlayer + ' activated ' + card.name);
    this.showMessage(card.name + ' activated!', 'success');
};

GameState.prototype.handleActionCard = function(card) {
    var needsTarget = card.id === 'steal_random_card' || card.id === 'swap_hands' || card.id === 'peek_at_hand';
    
    if (needsTarget && this.getOtherPlayers().length === 0) {
        this.showMessage('No other players available', 'error');
        return;
    }
    
    if (needsTarget) {
        this.showActionModal(card);
    } else {
        this.executeActionCard(card);
    }
};

GameState.prototype.executeActionCard = function(card, target) {
    if (card.id === 'steal_random_card' && target) {
        this.stealFromPlayer(target);
    } else if (card.id === 'swap_hands' && target) {
        this.swapWithPlayer(target);
    } else if (card.id === 'draw_from_all') {
        this.drawFromAll();
    } else if (card.id === 'peek_at_hand' && target) {
        this.peekAtPlayer(target);
    }
    
    this.broadcastMessage(this.currentPlayer + ' played ' + card.name);
    this.showMessage(card.name + ' played!', 'success');
    this.closeActionModal();
    this.dealCards(1);
    this.updateDisplay();
};

GameState.prototype.stealFromPlayer = function(targetName) {
    var self = this;
    
    this.loadSharedData(function(data) {
        var theirHand = data.hands[targetName];
        
        if (!theirHand || theirHand.length === 0) {
            self.showMessage(targetName + ' has no cards', 'info');
            return;
        }
        
        var randomIndex = Math.floor(Math.random() * theirHand.length);
        var stolenCard = theirHand.splice(randomIndex, 1)[0];
        self.playerHand.push(stolenCard);
        
        // Update their hand in shared data
        data.hands[targetName] = theirHand;
        data.players[targetName].cardsInHand = theirHand.length;
        self.saveSharedData(data);
        
        self.showMessage('Stole ' + stolenCard.name + ' from ' + targetName + '!', 'success');
    });
};

GameState.prototype.swapWithPlayer = function(targetName) {
    var self = this;
    
    this.loadSharedData(function(data) {
        var theirHand = data.hands[targetName];
        
        if (!theirHand) {
            self.showMessage('Cannot swap with ' + targetName, 'error');
            return;
        }
        
        var myHand = self.playerHand.slice();
        self.playerHand = theirHand.slice();
        
        // Update both hands
        data.hands[targetName] = myHand;
        data.hands[self.currentPlayer] = self.playerHand;
        data.players[targetName].cardsInHand = myHand.length;
        data.players[self.currentPlayer].cardsInHand = self.playerHand.length;
        self.saveSharedData(data);
        
        self.showMessage('Swapped hands with ' + targetName + '!', 'success');
        self.updateDisplay();
    });
};

GameState.prototype.drawFromAll = function() {
    var self = this;
    
    this.loadSharedData(function(data) {
        var otherPlayers = self.getOtherPlayersFromData(data.players);
        var drawn = 0;
        
        for (var i = 0; i < otherPlayers.length; i++) {
            var playerName = otherPlayers[i];
            var theirHand = data.hands[playerName];
            
            if (theirHand && theirHand.length > 0) {
                var randomIndex = Math.floor(Math.random() * theirHand.length);
                var card = theirHand.splice(randomIndex, 1)[0];
                self.playerHand.push(card);
                drawn++;
                
                data.hands[playerName] = theirHand;
                data.players[playerName].cardsInHand = theirHand.length;
            }
        }
        
        self.saveSharedData(data);
        self.showMessage('Drew ' + drawn + ' cards from other players!', 'success');
        self.updateDisplay();
    });
};

GameState.prototype.peekAtPlayer = function(targetName) {
    var self = this;
    
    this.loadSharedData(function(data) {
        var theirHand = data.hands[targetName];
        
        if (!theirHand) {
            self.showMessage('Cannot peek at ' + targetName, 'error');
            return;
        }
        
        self.showPeekModal(targetName, theirHand);
        self.showMessage('Peeking at ' + targetName + '\'s hand...', 'info');
    });
};

// Broadcast message to other players
GameState.prototype.broadcastMessage = function(text) {
    var self = this;
    
    this.loadSharedData(function(data) {
        if (!data) return;
        
        if (!data.messages) data.messages = [];
        
        data.messages.push({
            text: text,
            player: self.currentPlayer,
            timestamp: Date.now()
        });
        
        // Keep only last 10 messages
        if (data.messages.length > 10) {
            data.messages = data.messages.slice(-10);
        }
        
        self.saveSharedData(data);
    });
};

GameState.prototype.getOtherPlayers = function() {
    var self = this;
    var others = [];
    
    for (var name in this.cachedPlayers || {}) {
        if (name !== self.currentPlayer) {
            others.push(name);
        }
    }
    
    return others;
};

GameState.prototype.getOtherPlayersFromData = function(allPlayers) {
    var self = this;
    var others = [];
    
    for (var name in allPlayers) {
        if (name !== self.currentPlayer) {
            others.push(name);
        }
    }
    
    return others;
};

// Update display of other players
GameState.prototype.updateOtherPlayersDisplay = function(allPlayers) {
    if (!allPlayers) return;
    
    this.cachedPlayers = allPlayers; // Cache for other methods
    
    var others = [];
    for (var name in allPlayers) {
        if (name !== this.currentPlayer) {
            // Check if player is still active (seen in last 60 seconds)
            var timeSince = Date.now() - allPlayers[name].lastSeen;
            if (timeSince < 60000) {
                others.push(allPlayers[name]);
            }
        }
    }
    
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
    
    // Update online count
    var onlineEl = document.getElementById('players-online-game');
    if (onlineEl) {
        onlineEl.textContent = others.length + 1; // +1 for current player
    }
};

GameState.prototype.updateWelcomeDisplay = function() {
    var self = this;
    
    if (!this.binId) {
        var onlineEl = document.getElementById('players-online');
        if (onlineEl) onlineEl.textContent = 'No room joined';
        return;
    }
    
    this.loadSharedData(function(data) {
        if (!data || !data.players) return;
        
        var activeCount = 0;
        var now = Date.now();
        
        for (var name in data.players) {
            if (now - data.players[name].lastSeen < 60000) {
                activeCount++;
            }
        }
        
        var onlineEl = document.getElementById('players-online');
        if (onlineEl) onlineEl.textContent = activeCount + ' player(s) in room';
    });
};

// Message checking
GameState.prototype.checkForMessages = function(messages) {
    if (!messages) return;
    
    if (!this.lastMessageCheck) this.lastMessageCheck = Date.now();
    
    for (var i = 0; i < messages.length; i++) {
        var msg = messages[i];
        if (msg.player !== this.currentPlayer && msg.timestamp > this.lastMessageCheck) {
            this.showMessage(msg.text, 'info');
        }
    }
    
    this.lastMessageCheck = Date.now();
};

GameState.prototype.undoLastPlay = function() {
    if (this.playHistory.length === 0) return;
    
    var lastPlay = this.playHistory.pop();
    this.score = lastPlay.scoreBefore;
    this.cardsPlayed = lastPlay.cardsPlayedBefore;
    
    if (lastPlay.type === 'hold') {
        var self = this;
        this.holdCards = this.holdCards.filter(function(c) {
            return c.id !== lastPlay.card.id;
        });
        if (lastPlay.card.id === 'double_next_score') delete this.activeEffects.doubleNext;
        if (lastPlay.card.id === 'block_steal') delete this.activeEffects.blockSteal;
    }
    
    this.playerHand.splice(lastPlay.index, 0, lastPlay.card);
    if (this.playerHand.length > 5) this.playerHand.pop();
    
    this.updateDisplay();
    this.showMessage('Undid last play', 'info');
};

GameState.prototype.saveToHistory = function(card, index) {
    this.playHistory.push({
        card: {
            id: card.id,
            name: card.name,
            type: card.type,
            points: card.points,
            description: card.description,
            playType: card.playType
        },
        index: index,
        scoreBefore: this.score,
        cardsPlayedBefore: this.cardsPlayed,
        type: card.type === 'event' ? 'event' : (card.playType || 'action')
    });
};

// Display methods
GameState.prototype.updateDisplay = function() {
    this.displayHand();
    this.displayHoldCards();
    this.updateStats();
    var undoBtn = document.getElementById('undo-btn');
    if (undoBtn) undoBtn.disabled = this.playHistory.length === 0;
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
        
        cardDiv.innerHTML = '<div class="card-header"><span class="card-name">' + card.name + '</span><span class="card-points">' + card.points + ' pts</span></div><div class="card-description">' + card.description + '</div><div class="card-type">' + card.type + (card.playType ? ' • ' + card.playType : '') + '</div>';
        
        container.appendChild(cardDiv);
    }
};

GameState.prototype.displayHoldCards = function() {
    var section = document.getElementById('hold-cards-section');
    var container = document.getElementById('hold-cards');
    
    if (!section || !container) return;
    
    if (this.holdCards.length === 0) {
        section.style.display = 'none';
        return;
    }
    
    section.style.display = 'block';
    container.innerHTML = '';
    
    for (var i = 0; i < this.holdCards.length; i++) {
        var card = this.holdCards[i];
        var div = document.createElement('div');
        div.className = 'hold-card';
        div.innerHTML = '<div class="hold-card-name">' + card.name + '</div><div class="hold-card-desc">' + card.description + '</div>';
        container.appendChild(div);
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

// Action card modals
GameState.prototype.showActionModal = function(card) {
    var others = this.getOtherPlayers();
    
    var titleEl = document.getElementById('action-title');
    var descEl = document.getElementById('action-description');
    var targetEl = document.getElementById('target-selection');
    var buttonsEl = document.getElementById('target-buttons');
    
    if (!titleEl || !descEl || !targetEl || !buttonsEl) return;
    
    titleEl.textContent = card.name;
    descEl.textContent = card.description;
    targetEl.style.display = others.length ? 'block' : 'none';
    
    buttonsEl.innerHTML = '';
    
    var self = this;
    for (var i = 0; i < others.length; i++) {
        var playerName = others[i];
        var player = this.cachedPlayers[playerName];
        var btn = document.createElement('div');
        btn.className = 'target-player';
        btn.innerHTML = '<div><strong>' + playerName + '</strong><br><small>' + player.cardsInHand + ' cards • Score: ' + player.score + '</small></div>';
        
        btn.onclick = (function(name, element) {
            return function() {
                self.selectTarget(name, element);
            };
        })(playerName, btn);
        
        buttonsEl.appendChild(btn);
    }
    
    var modal = document.getElementById('action-modal');
    if (modal) modal.classList.add('active');
    
    this.currentActionCard = card;
    this.selectedTarget = null;
};

GameState.prototype.selectTarget = function(playerName, element) {
    var buttons = document.querySelectorAll('.target-player');
    for (var i = 0; i < buttons.length; i++) {
        buttons[i].classList.remove('selected');
    }
    element.classList.add('selected');
    this.selectedTarget = playerName;
};

GameState.prototype.confirmAction = function() {
    if (this.getOtherPlayers().length && !this.selectedTarget) {
        this.showMessage('Please select a target', 'error');
        return;
    }
    this.executeActionCard(this.currentActionCard, this.selectedTarget);
};

GameState.prototype.closeActionModal = function() {
    var modal = document.getElementById('action-modal');
    if (modal) modal.classList.remove('active');
    this.currentActionCard = null;
    this.selectedTarget = null;
};

GameState.prototype.showPeekModal = function(playerName, hand) {
    var modal = document.createElement('div');
    modal.className = 'modal active';
    
    var cardHtml = '';
    for (var i = 0; i < hand.length; i++) {
        var card = hand[i];
        cardHtml += '<div class="card ' + card.type + '" style="margin-bottom: 8px; cursor: default;"><div class="card-header"><span class="card-name">' + card.name + '</span><span class="card-points">' + card.points + ' pts</span></div><div class="card-description">' + card.description + '</div></div>';
    }
    
    modal.innerHTML = '<div class="modal-content"><h3>👀 ' + playerName + '\'s Hand</h3><div style="max-height: 300px; overflow-y: auto;">' + cardHtml + '</div><button class="btn btn-secondary" onclick="this.closest(\'.modal\').remove()">Close</button></div>';
    
    document.body.appendChild(modal);
    modal.onclick = function(e) {
        if (e.target === modal) modal.remove();
    };
};

// Screen management
GameState.prototype.showScreen = function(screenId) {
    var screens = document.querySelectorAll('.screen');
    for (var i = 0; i < screens.length; i++) {
        screens[i].classList.remove('active');
    }
    
    var targetScreen = document.getElementById(screenId);
    if (targetScreen) targetScreen.classList.add('active');
};

GameState.prototype.showGameScreen = function() {
    var nameEl = document.getElementById('game-player-name');
    if (nameEl) nameEl.textContent = this.currentPlayer;
    
    this.showScreen('game-screen');
    this.showMessage('Welcome ' + this.currentPlayer + '!', 'success');
};

GameState.prototype.leaveGame = function() {
    this.currentPlayer = null;
    this.gameStarted = false;
    var nameInput = document.getElementById('player-name-welcome');
    if (nameInput) nameInput.value = '';
    this.showScreen('welcome-screen');
    this.showMessage('Left game', 'info');
};

// Message system
GameState.prototype.showMessage = function(text, type) {
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

// Event listeners
GameState.prototype.setupEventListeners = function() {
    var self = this;
    
    var createBtn = document.getElementById('create-room-btn');
    if (createBtn) {
        createBtn.onclick = function() { self.createRoom(); };
    }
    
    var joinBtn = document.getElementById('join-room-btn');
    if (joinBtn) {
        joinBtn.onclick = function() { self.joinRoom(); };
    }
    
    var startBtn = document.getElementById('join-game-btn');
    if (startBtn) {
        startBtn.onclick = function() { self.joinGame(); };
    }
    
    var undoBtn = document.getElementById('undo-btn');
    if (undoBtn) {
        undoBtn.onclick = function() { self.undoLastPlay(); };
    }
    
    var leaveBtn = document.getElementById('new-game-btn');
    if (leaveBtn) {
        leaveBtn.onclick = function() { self.leaveGame(); };
    }
    
    var confirmBtn = document.getElementById('action-confirm');
    if (confirmBtn) {
        confirmBtn.onclick = function() { self.confirmAction(); };
    }
    
    var cancelBtn = document.getElementById('action-cancel');
    if (cancelBtn) {
        cancelBtn.onclick = function() { self.closeActionModal(); };
    }
    
    var modal = document.getElementById('action-modal');
    if (modal) {
        modal.onclick = function(e) {
            if (e.target.id === 'action-modal') self.closeActionModal();
        };
    }
    
    // Auto-uppercase room code input
    var roomInput = document.getElementById('room-code-input');
    if (roomInput) {
        roomInput.oninput = function() {
            this.value = this.value.toUpperCase();
        };
        roomInput.onkeypress = function(e) {
            if (e.key === 'Enter') self.joinRoom();
        };
    }
    
    var nameInput = document.getElementById('player-name-welcome');
    if (nameInput) {
        nameInput.onkeypress = function(e) {
            if (e.key === 'Enter') self.joinGame();
        };
    }
};
