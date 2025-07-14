// Simple Shared Data Football Card Game
function GameState() {
    this.currentPlayer = null;
    this.gameStarted = false;
    this.playerHand = [];
    this.deck = [];
    this.score = 0;
    this.cardsPlayed = 0;
    this.playHistory = [];
    this.holdCards = [];
    this.activeEffects = {};
    this.players = {};
    this.lastMessageCheck = 0;
    this.gameDataUrl = 'https://api.jsonbin.io/v3/b/YOUR_BIN_ID';
    this.apiKey = 'TEMP_API_KEY';
    
    this.init();
}

GameState.prototype.init = function() {
    this.setupEventListeners();
    this.showScreen('welcome-screen');
    this.startPolling();
};

// Simple HTTP requests
GameState.prototype.loadGameData = function(callback) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', this.gameDataUrl + '/latest', true);
    xhr.setRequestHeader('X-Master-Key', this.apiKey);
    
    xhr.onreadystatechange = function() {
        if (xhr.readyState === 4) {
            if (xhr.status === 200) {
                try {
                    var response = JSON.parse(xhr.responseText);
                    callback(response.record || {});
                } catch (e) {
                    callback({});
                }
            } else {
                callback({});
            }
        }
    };
    
    xhr.send();
};

GameState.prototype.saveGameData = function(data, callback) {
    var xhr = new XMLHttpRequest();
    xhr.open('PUT', this.gameDataUrl, true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.setRequestHeader('X-Master-Key', this.apiKey);
    
    xhr.onreadystatechange = function() {
        if (xhr.readyState === 4 && callback) {
            callback(xhr.status === 200);
        }
    };
    
    xhr.send(JSON.stringify(data));
};

// But for now, let's use localStorage with a twist - we'll sync it manually
GameState.prototype.loadSharedData = function() {
    try {
        var data = localStorage.getItem('football-shared-game');
        return data ? JSON.parse(data) : this.createDefaultData();
    } catch (e) {
        return this.createDefaultData();
    }
};

GameState.prototype.saveSharedData = function(data) {
    try {
        data.lastUpdated = Date.now();
        localStorage.setItem('football-shared-game', JSON.stringify(data));
        return true;
    } catch (e) {
        return false;
    }
};

GameState.prototype.createDefaultData = function() {
    return {
        players: {},
        hands: {},
        messages: [],
        gameStarted: true,
        lastUpdated: Date.now()
    };
};

GameState.prototype.startPolling = function() {
    var self = this;
    setInterval(function() {
        if (self.gameStarted && self.currentPlayer) {
            self.syncWithOthers();
        } else {
            self.updateWelcomeDisplay();
        }
    }, 2000); // Check every 2 seconds
};

GameState.prototype.syncWithOthers = function() {
    var data = this.loadSharedData();
    
    // Update our player info
    if (!data.players) data.players = {};
    if (!data.hands) data.hands = {};
    
    data.players[this.currentPlayer] = {
        name: this.currentPlayer,
        score: this.score,
        cardsInHand: this.playerHand.length,
        cardsPlayed: this.cardsPlayed,
        lastSeen: Date.now()
    };
    
    data.hands[this.currentPlayer] = this.playerHand.slice();
    
    this.saveSharedData(data);
    
    // Update display with other players
    this.players = data.players;
    this.updateOtherPlayersDisplay();
    this.checkForMessages(data.messages || []);
};

GameState.prototype.broadcastMessage = function(text) {
    var data = this.loadSharedData();
    if (!data.messages) data.messages = [];
    
    data.messages.push({
        text: text,
        player: this.currentPlayer,
        timestamp: Date.now()
    });
    
    // Keep only last 10 messages
    if (data.messages.length > 10) {
        data.messages = data.messages.slice(-10);
    }
    
    this.saveSharedData(data);
};

GameState.prototype.checkForMessages = function(messages) {
    if (!messages) return;
    
    for (var i = 0; i < messages.length; i++) {
        var msg = messages[i];
        if (msg.player !== this.currentPlayer && msg.timestamp > this.lastMessageCheck) {
            this.showMessage(msg.text, 'info');
        }
    }
    
    this.lastMessageCheck = Date.now();
};

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
    
    // Check if name is taken
    var data = this.loadSharedData();
    if (data.players && data.players[name]) {
        var timeSince = Date.now() - data.players[name].lastSeen;
        if (timeSince < 30000) { // 30 seconds
            this.showMessage('Name already taken', 'error');
            return;
        }
    }
    
    this.currentPlayer = name;
    this.gameStarted = true;
    this.lastMessageCheck = Date.now();
    
    this.startNewHand();
    this.showGameScreen();
};

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
    var data = this.loadSharedData();
    var theirHand = data.hands[targetName];
    
    if (!theirHand || theirHand.length === 0) {
        this.showMessage(targetName + ' has no cards', 'info');
        return;
    }
    
    var randomIndex = Math.floor(Math.random() * theirHand.length);
    var stolenCard = theirHand.splice(randomIndex, 1)[0];
    this.playerHand.push(stolenCard);
    
    // Update their hand in shared data
    data.hands[targetName] = theirHand;
    data.players[targetName].cardsInHand = theirHand.length;
    this.saveSharedData(data);
    
    this.showMessage('Stole ' + stolenCard.name + ' from ' + targetName + '!', 'success');
};

GameState.prototype.swapWithPlayer = function(targetName) {
    var data = this.loadSharedData();
    var theirHand = data.hands[targetName];
    
    if (!theirHand) {
        this.showMessage('Cannot swap with ' + targetName, 'error');
        return;
    }
    
    var myHand = this.playerHand.slice();
    this.playerHand = theirHand.slice();
    
    // Update both hands
    data.hands[targetName] = myHand;
    data.hands[this.currentPlayer] = this.playerHand;
    data.players[targetName].cardsInHand = myHand.length;
    data.players[this.currentPlayer].cardsInHand = this.playerHand.length;
    this.saveSharedData(data);
    
    this.showMessage('Swapped hands with ' + targetName + '!', 'success');
};

GameState.prototype.drawFromAll = function() {
    var data = this.loadSharedData();
    var otherPlayers = this.getOtherPlayers();
    var drawn = 0;
    
    for (var i = 0; i < otherPlayers.length; i++) {
        var playerName = otherPlayers[i];
        var theirHand = data.hands[playerName];
        
        if (theirHand && theirHand.length > 0) {
            var randomIndex = Math.floor(Math.random() * theirHand.length);
            var card = theirHand.splice(randomIndex, 1)[0];
            this.playerHand.push(card);
            drawn++;
            
            data.hands[playerName] = theirHand;
            data.players[playerName].cardsInHand = theirHand.length;
        }
    }
    
    this.saveSharedData(data);
    this.showMessage('Drew ' + drawn + ' cards from other players!', 'success');
};

GameState.prototype.peekAtPlayer = function(targetName) {
    var data = this.loadSharedData();
    var theirHand = data.hands[targetName];
    
    if (!theirHand) {
        this.showMessage('Cannot peek at ' + targetName, 'error');
        return;
    }
    
    this.showPeekModal(targetName, theirHand);
    this.showMessage('Peeking at ' + targetName + '\'s hand...', 'info');
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

GameState.prototype.getOtherPlayers = function() {
    var self = this;
    return Object.keys(this.players).filter(function(name) {
        return name !== self.currentPlayer;
    });
};

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

GameState.prototype.updateOtherPlayersDisplay = function() {
    var self = this;
    var others = [];
    
    for (var name in this.players) {
        if (name !== this.currentPlayer) {
            others.push(this.players[name]);
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
    if (onlineEl) onlineEl.textContent = Object.keys(this.players).length;
};

GameState.prototype.updateWelcomeDisplay = function() {
    var data = this.loadSharedData();
    var count = Object.keys(data.players || {}).length;
    var onlineEl = document.getElementById('players-online');
    if (onlineEl) onlineEl.textContent = count + ' player(s) online';
};

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
        var player = this.players[playerName];
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

GameState.prototype.viewCards = function() {
    var eventCards = [];
    var actionCards = [];
    
    for (var i = 0; i < CARD_DECK.length; i++) {
        if (CARD_DECK[i].type === 'event') {
            eventCards.push(CARD_DECK[i]);
        } else {
            actionCards.push(CARD_DECK[i]);
        }
    }
    
    var html = '<h3 style="color: #4CAF50; margin: 20px 0 15px 0;">Event Cards</h3>';
    for (var j = 0; j < eventCards.length; j++) {
        html += this.createCardDisplay(eventCards[j]);
    }
    html += '<h3 style="color: #ff9800; margin: 20px 0 15px 0;">Action Cards</h3>';
    for (var k = 0; k < actionCards.length; k++) {
        html += this.createCardDisplay(actionCards[k]);
    }
    
    var container = document.getElementById('cards-list');
    if (container) container.innerHTML = html;
    
    this.showScreen('card-viewer-screen');
};

GameState.prototype.createCardDisplay = function(card) {
    return '<div style="background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); border-radius: 10px; padding: 15px; margin-bottom: 10px; border-left: 4px solid ' + (card.type === 'event' ? '#4CAF50' : '#ff9800') + ';"><div style="display: flex; justify-content: space-between; margin-bottom: 8px;"><strong>' + card.name + '</strong><span style="background: rgba(255,255,255,0.2); padding: 4px 8px; border-radius: 12px;">' + card.points + ' pts × ' + card.quantity + '</span></div><p style="opacity: 0.9; margin-bottom: 5px;">' + card.description + '</p>' + (card.playType ? '<p style="opacity: 0.7; font-style: italic;">Play: ' + card.playType + '</p>' : '') + '</div>';
};

GameState.prototype.resetGame = function() {
    if (confirm('Reset game for everyone?')) {
        var data = this.createDefaultData();
        data.resetBy = this.currentPlayer;
        data.resetTime = Date.now();
        this.saveSharedData(data);
        
        setTimeout(function() {
            location.reload();
        }, 1000);
    }
};

GameState.prototype.leaveGame = function() {
    if (this.currentPlayer) {
        var data = this.loadSharedData();
        delete data.players[this.currentPlayer];
        delete data.hands[this.currentPlayer];
        this.saveSharedData(data);
    }
    
    this.currentPlayer = null;
    this.gameStarted = false;
    var nameInput = document.getElementById('player-name-welcome');
    if (nameInput) nameInput.value = '';
    this.showScreen('welcome-screen');
    this.showMessage('Left game', 'info');
};

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

GameState.prototype.setupEventListeners = function() {
    var self = this;
    
    var joinBtn = document.getElementById('join-game-btn');
    if (joinBtn) {
        joinBtn.onclick = function() { self.joinGame(); };
    }
    
    var nameInput = document.getElementById('player-name-welcome');
    if (nameInput) {
        nameInput.onkeypress = function(e) {
            if (e.key === 'Enter') self.joinGame();
        };
    }
    
    var viewBtn = document.getElementById('view-cards-btn');
    if (viewBtn) {
        viewBtn.onclick = function() { self.viewCards(); };
    }
    
    var backBtn = document.getElementById('back-to-welcome-cards');
    if (backBtn) {
        backBtn.onclick = function() { self.showScreen('welcome-screen'); };
    }
    
    var menuBtn = document.getElementById('back-to-menu-btn');
    if (menuBtn) {
        menuBtn.onclick = function() { self.showScreen('welcome-screen'); };
    }
    
    var undoBtn = document.getElementById('undo-btn');
    if (undoBtn) {
        undoBtn.onclick = function() { self.undoLastPlay(); };
    }
    
    var leaveBtn = document.getElementById('new-game-btn');
    if (leaveBtn) {
        leaveBtn.onclick = function() { self.leaveGame(); };
    }
    
    var resetBtn = document.getElementById('reset-for-everyone-btn');
    if (resetBtn) {
        resetBtn.onclick = function() { self.resetGame(); };
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
};