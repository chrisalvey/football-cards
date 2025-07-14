// Firebase-Enabled Football Card Game (ES5 Compatible)
function GameState() {
    // Core game state
    this.currentPlayer = null;
    this.gameStarted = false;
    this.playerHand = [];
    this.deck = [];
    this.score = 0;
    this.cardsPlayed = 0;
    this.playHistory = [];
    this.holdCards = [];
    this.activeEffects = {};
    this.lastMessageCheck = 0;
    this.gameRef = null;
    this.playersRef = null;
    this.messagesRef = null;
    
    this.init();
}

GameState.prototype.init = function() {
    this.setupFirebase();
    this.setupEventListeners();
    this.showScreen('welcome-screen');
    this.updateWelcomeDisplay();
};

GameState.prototype.setupFirebase = function() {
    var self = this;
    
    this.gameRef = firebase.database().ref('game');
    this.playersRef = firebase.database().ref('game/players');
    this.handsRef = firebase.database().ref('game/hands');
    this.messagesRef = firebase.database().ref('game/messages');
    
    this.playersRef.on('value', function(snapshot) {
        var players = snapshot.val() || {};
        self.handlePlayersUpdate(players);
    });
    
    this.messagesRef.on('child_added', function(snapshot) {
        var message = snapshot.val();
        self.handleNewMessage(message);
    });
    
    firebase.database().ref('game/resetNotification').on('value', function(snapshot) {
        var resetData = snapshot.val();
        if (resetData) {
            self.handleResetNotification(resetData);
        }
    });
};

GameState.prototype.savePlayerData = function() {
    if (!this.currentPlayer) return;
    
    var playerData = {
        name: this.currentPlayer,
        score: this.score,
        cardsInHand: this.playerHand.length,
        cardsPlayed: this.cardsPlayed,
        lastSeen: Date.now()
    };
    
    var handData = this.playerHand.slice();
    
    this.playersRef.child(this.currentPlayer).set(playerData);
    this.handsRef.child(this.currentPlayer).set(handData);
};

GameState.prototype.removePlayerData = function() {
    if (!this.currentPlayer) return;
    
    this.playersRef.child(this.currentPlayer).remove();
    this.handsRef.child(this.currentPlayer).remove();
};

GameState.prototype.getPlayerHand = function(playerName) {
    var self = this;
    return new Promise(function(resolve) {
        self.handsRef.child(playerName).once('value', function(snapshot) {
            resolve(snapshot.val() || []);
        });
    });
};

GameState.prototype.broadcastMessage = function(text) {
    var message = {
        text: text,
        timestamp: Date.now(),
        player: this.currentPlayer
    };
    
    this.messagesRef.push(message);
    
    var self = this;
    this.messagesRef.once('value', function(snapshot) {
        var messages = snapshot.val() || {};
        var messageKeys = Object.keys(messages);
        
        if (messageKeys.length > 20) {
            var oldKeys = messageKeys.slice(0, messageKeys.length - 20);
            var updates = {};
            for (var i = 0; i < oldKeys.length; i++) {
                updates[oldKeys[i]] = null;
            }
            self.messagesRef.update(updates);
        }
    });
};

GameState.prototype.handlePlayersUpdate = function(players) {
    this.players = players;
    
    if (this.gameStarted) {
        this.updateOtherPlayersDisplay();
        this.updateOnlineCount();
    } else {
        this.updateWelcomeDisplay();
    }
};

GameState.prototype.handleNewMessage = function(message) {
    if (!message || !this.currentPlayer) return;
    
    if (message.player !== this.currentPlayer && message.timestamp > this.lastMessageCheck) {
        this.showMessage(message.text, 'info');
        this.lastMessageCheck = Math.max(this.lastMessageCheck, message.timestamp);
    }
};

GameState.prototype.handleResetNotification = function(resetData) {
    if (!resetData || !this.currentPlayer) return;
    
    var resetTime = Date.now() - resetData.timestamp;
    
    if (resetTime < 10000 && resetData.resetBy !== this.currentPlayer) {
        this.showMessage(resetData.resetBy + ' reset the game for everyone!', 'info');
        
        setTimeout(function() {
            firebase.database().ref('game').remove().then(function() {
                location.reload();
            });
        }, 2000);
    }
};

GameState.prototype.joinGame = function() {
    var name = document.getElementById('player-name-welcome').value.trim();
    
    if (!name || name.length > 20) {
        this.showMessage(name ? 'Name too long' : 'Please enter your name', 'error');
        return;
    }

    var self = this;
    this.playersRef.child(name).once('value', function(snapshot) {
        if (snapshot.exists()) {
            self.showMessage('Name already taken', 'error');
            return;
        }

        self.currentPlayer = name;
        self.gameStarted = true;
        self.lastMessageCheck = Date.now();
        
        self.startNewHand();
        self.savePlayerData();
        self.showGameScreen();
    });
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
    this.savePlayerData();
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
    var needsTarget = ['steal_random_card', 'swap_hands', 'peek_at_hand'].indexOf(card.id) !== -1;
    
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
    if (card.id === 'steal_random_card') {
        this.stealFromPlayer(target);
    } else if (card.id === 'swap_hands') {
        this.swapWithPlayer(target);
    } else if (card.id === 'draw_from_all') {
        this.drawFromAll();
    } else if (card.id === 'peek_at_hand') {
        this.peekAtPlayer(target);
    }

    this.broadcastMessage(this.currentPlayer + ' played ' + card.name);
    this.showMessage(card.name + ' played!', 'success');
    this.closeActionModal();
    this.dealCards(1);
    this.updateDisplay();
    this.savePlayerData();
};

GameState.prototype.stealFromPlayer = function(targetName) {
    var self = this;
    this.getPlayerHand(targetName).then(function(theirHand) {
        if (!theirHand.length) {
            self.showMessage(targetName + ' has no cards', 'info');
            return;
        }

        var stolenCard = theirHand.splice(Math.floor(Math.random() * theirHand.length), 1)[0];
        self.playerHand.push(stolenCard);
        
        self.handsRef.child(targetName).set(theirHand);
        self.playersRef.child(targetName).child('cardsInHand').set(theirHand.length);
        
        self.showMessage('Stole ' + stolenCard.name + ' from ' + targetName + '!', 'success');
    });
};

GameState.prototype.swapWithPlayer = function(targetName) {
    var self = this;
    this.getPlayerHand(targetName).then(function(theirHand) {
        if (!theirHand) {
            self.showMessage('Cannot swap with ' + targetName, 'error');
            return;
        }

        var myHand = self.playerHand.slice();
        self.playerHand = theirHand.slice();
        
        self.handsRef.child(targetName).set(myHand);
        self.handsRef.child(self.currentPlayer).set(self.playerHand);
        self.playersRef.child(targetName).child('cardsInHand').set(myHand.length);
        self.playersRef.child(self.currentPlayer).child('cardsInHand').set(self.playerHand.length);
        
        self.showMessage('Swapped hands with ' + targetName + '!', 'success');
    });
};

GameState.prototype.drawFromAll = function() {
    var otherPlayers = this.getOtherPlayers();
    var self = this;
    
    for (var i = 0; i < otherPlayers.length; i++) {
        var playerName = otherPlayers[i];
        this.getPlayerHand(playerName).then(function(theirHand) {
            if (theirHand.length > 0) {
                var card = theirHand.splice(Math.floor(Math.random() * theirHand.length), 1)[0];
                self.playerHand.push(card);
                
                self.handsRef.child(playerName).set(theirHand);
                self.playersRef.child(playerName).child('cardsInHand').set(theirHand.length);
            }
        });
    }

    this.showMessage('Drew cards from other players!', 'success');
};

GameState.prototype.peekAtPlayer = function(targetName) {
    var self = this;
    this.getPlayerHand(targetName).then(function(theirHand) {
        if (!theirHand) {
            self.showMessage('Cannot peek at ' + targetName, 'error');
            return;
        }

        self.showPeekModal(targetName, theirHand);
        self.showMessage('Peeking at ' + targetName + '\'s hand...', 'info');
    });
};

GameState.prototype.undoLastPlay = function() {
    if (!this.playHistory.length) return;

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
    this.savePlayerData();
    this.showMessage('Undid last play', 'info');
};

GameState.prototype.dealCards = function(count) {
    for (var i = 0; i < count && this.deck.length > 0; i++) {
        this.playerHand.push(this.deck.pop());
    }
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
    return Object.keys(this.players || {}).filter(function(name) {
        return name !== self.currentPlayer;
    });
};

GameState.prototype.updateDisplay = function() {
    this.displayHand();
    this.displayHoldCards();
    this.updateStats();
    document.getElementById('undo-btn').disabled = !this.playHistory.length;
};

GameState.prototype.displayHand = function() {
    var container = document.getElementById('player-hand');
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
    
    if (!this.holdCards.length) {
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
    document.getElementById('current-score').textContent = this.score;
    document.getElementById('cards-played').textContent = this.cardsPlayed;
    document.getElementById('cards-in-hand').textContent = this.playerHand.length;
};

GameState.prototype.updateOtherPlayersDisplay = function() {
    var self = this;
    var others = Object.values(this.players || {}).filter(function(p) {
        return p.name !== self.currentPlayer;
    });
    
    var section = document.getElementById('other-players-section');
    var container = document.getElementById('other-players-list');
    
    if (!others.length) {
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
};

GameState.prototype.updateOnlineCount = function() {
    var count = Object.keys(this.players || {}).length;
    document.getElementById('players-online-game').textContent = count;
};

GameState.prototype.updateWelcomeDisplay = function() {
    var count = Object.keys(this.players || {}).length;
    document.getElementById('players-online').textContent = count + ' player(s) online';
};

GameState.prototype.showActionModal = function(card) {
    var others = this.getOtherPlayers();
    
    document.getElementById('action-title').textContent = card.name;
    document.getElementById('action-description').textContent = card.description;
    document.getElementById('target-selection').style.display = others.length ? 'block' : 'none';
    
    var targetButtons = document.getElementById('target-buttons');
    targetButtons.innerHTML = '';
    
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
        
        targetButtons.appendChild(btn);
    }
    
    document.getElementById('action-modal').classList.add('active');
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
    document.getElementById('action-modal').classList.remove('active');
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
    document.getElementById(screenId).classList.add('active');
};

GameState.prototype.showGameScreen = function() {
    document.getElementById('game-player-name').textContent = this.currentPlayer;
    this.showScreen('game-screen');
    this.showMessage('Welcome ' + this.currentPlayer + '!', 'success');
};

GameState.prototype.viewCards = function() {
    var eventCards = CARD_DECK.filter(function(c) { return c.type === 'event'; });
    var actionCards = CARD_DECK.filter(function(c) { return c.type === 'action'; });
    
    var html = '<h3 style="color: #4CAF50; margin: 20px 0 15px 0;">Event Cards</h3>';
    for (var i = 0; i < eventCards.length; i++) {
        html += this.createCardDisplay(eventCards[i]);
    }
    html += '<h3 style="color: #ff9800; margin: 20px 0 15px 0;">Action Cards</h3>';
    for (var j = 0; j < actionCards.length; j++) {
        html += this.createCardDisplay(actionCards[j]);
    }
    
    document.getElementById('cards-list').innerHTML = html;
    this.showScreen('card-viewer-screen');
};

GameState.prototype.createCardDisplay = function(card) {
    return '<div style="background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); border-radius: 10px; padding: 15px; margin-bottom: 10px; border-left: 4px solid ' + (card.type === 'event' ? '#4CAF50' : '#ff9800') + ';"><div style="display: flex; justify-content: space-between; margin-bottom: 8px;"><strong>' + card.name + '</strong><span style="background: rgba(255,255,255,0.2); padding: 4px 8px; border-radius: 12px;">' + card.points + ' pts × ' + card.quantity + '</span></div><p style="opacity: 0.9; margin-bottom: 5px;">' + card.description + '</p>' + (card.playType ? '<p style="opacity: 0.7; font-style: italic;">Play: ' + card.playType + '</p>' : '') + '</div>';
};

GameState.prototype.resetGame = function() {
    if (confirm('Reset game for everyone?')) {
        firebase.database().ref('game/resetNotification').set({
            resetBy: this.currentPlayer,
            timestamp: Date.now()
        });
        
        setTimeout(function() {
            firebase.database().ref('game').remove().then(function() {
                location.reload();
            });
        }, 2000);
    }
};

GameState.prototype.leaveGame = function() {
    if (this.currentPlayer) {
        this.removePlayerData();
    }
    
    this.currentPlayer = null;
    this.gameStarted = false;
    document.getElementById('player-name-welcome').value = '';
    this.showScreen('welcome-screen');
    this.showMessage('Left game', 'info');
};

GameState.prototype.showMessage = function(text, type) {
    var container = document.getElementById('message-container');
    var message = document.createElement('div');
    message.className = 'message message-' + (type || 'info');
    message.textContent = text;
    container.appendChild(message);
    setTimeout(function() {
        message.remove();
    }, 3000);
};

GameState.prototype.setupEventListeners = function() {
    var self = this;
    
    document.getElementById('join-game-btn').onclick = function() {
        self.joinGame();
    };
    
    document.getElementById('player-name-welcome').onkeypress = function(e) {
        if (e.key === 'Enter') self.joinGame();
    };

    document.getElementById('view-cards-btn').onclick = function() {
        self.viewCards();
    };
    
    document.getElementById('back-to-welcome-cards').onclick = function() {
        self.showScreen('welcome-screen');
    };
    
    document.getElementById('back-to-menu-btn').onclick = function() {
        self.showScreen('welcome-screen');
    };

    document.getElementById('undo-btn').onclick = function() {
        self.undoLastPlay();
    };
    
    document.getElementById('new-game-btn').onclick = function() {
        self.leaveGame();
    };
    
    document.getElementById('reset-for-everyone-btn').onclick = function() {
        self.resetGame();
    };

    document.getElementById('action-confirm').onclick = function() {
        self.confirmAction();
    };
    
    document.getElementById('action-cancel').onclick = function() {
        self.closeActionModal();
    };
    
    document.getElementById('action-modal').onclick = function(e) {
        if (e.target.id === 'action-modal') self.closeActionModal();
    };
};