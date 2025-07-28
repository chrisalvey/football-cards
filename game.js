// Version: 2.0.0 - Solo Competitive Football Cards
function GameState() {
    this.currentPlayer = null;
    this.gameStarted = false;
    this.playerHand = [];
    this.score = 0;
    this.cardsPlayed = 0;
    this.playHistory = [];
    this.holdCards = [];
    this.activeEffects = {};
    
    // Game session tracking
    this.gameStartTime = null;
    this.gameEndTime = null;
    this.gameMode = 'quarter'; // quarter, half, full
    this.timeRemaining = null;
    
    // Leaderboard and stats
    this.personalBest = 0;
    this.gamesPlayed = 0;
    this.averageScore = 0;
    
    this.init();
}

GameState.prototype.init = function() {
    console.log('🏈 Football Cards - Solo Mode');
    this.loadPersonalStats();
    this.setupEventListeners();
    this.showScreen('welcome-screen');
    this.showMessage('Ready to compete! Play your best game!', 'success');
};

GameState.prototype.loadPersonalStats = function() {
    try {
        var stats = localStorage.getItem('football-cards-stats');
        if (stats) {
            var data = JSON.parse(stats);
            this.personalBest = data.personalBest || 0;
            this.gamesPlayed = data.gamesPlayed || 0;
            this.averageScore = data.averageScore || 0;
        }
    } catch (e) {
        console.log('No previous stats found');
    }
    
    this.updateStatsDisplay();
};

GameState.prototype.savePersonalStats = function() {
    var stats = {
        personalBest: this.personalBest,
        gamesPlayed: this.gamesPlayed,
        averageScore: this.averageScore,
        lastPlayed: Date.now()
    };
    
    localStorage.setItem('football-cards-stats', JSON.stringify(stats));
};

GameState.prototype.setupEventListeners = function() {
    var self = this;
    
    // Game mode selection
    var quarterBtn = document.getElementById('quarter-game-btn');
    if (quarterBtn) {
        quarterBtn.onclick = function() { self.startGame('quarter'); };
    }
    
    var halfBtn = document.getElementById('half-game-btn');
    if (halfBtn) {
        halfBtn.onclick = function() { self.startGame('half'); };
    }
    
    var fullBtn = document.getElementById('full-game-btn');
    if (fullBtn) {
        fullBtn.onclick = function() { self.startGame('full'); };
    }
    
    // Player name and start
    var startBtn = document.getElementById('join-game-btn');
    if (startBtn) {
        startBtn.onclick = function() { self.joinGame(); };
    }
    
    var nameInput = document.getElementById('player-name-welcome');
    if (nameInput) {
        nameInput.onkeypress = function(e) {
            if (e.key === 'Enter') self.joinGame();
        };
    }
    
    var undoBtn = document.getElementById('undo-btn');
    if (undoBtn) {
        undoBtn.onclick = function() { self.undoLastPlay(); };
    }
    
    var newGameBtn = document.getElementById('new-game-btn');
    if (newGameBtn) {
        newGameBtn.onclick = function() { self.endGame(); };
    }
    
    var viewStatsBtn = document.getElementById('view-stats-btn');
    if (viewStatsBtn) {
        viewStatsBtn.onclick = function() { self.showStatsScreen(); };
    }
};

GameState.prototype.joinGame = function() {
    var nameInput = document.getElementById('player-name-welcome');
    var name = nameInput.value.trim();
    
    if (!name) {
        this.showMessage('Please enter your name', 'error');
        return;
    }
    
    this.currentPlayer = name;
    this.showScreen('game-mode-screen');
};

GameState.prototype.startGame = function(mode) {
    console.log('🚀 Starting', mode, 'game for', this.currentPlayer);
    
    this.gameMode = mode;
    this.gameStarted = true;
    this.gameStartTime = Date.now();
    
    // Set game duration (in minutes)
    var durations = {
        'quarter': 15,
        'half': 30,
        'full': 60
    };
    
    this.timeRemaining = durations[mode] * 60; // Convert to seconds
    
    this.startNewHand();
    this.showGameScreen();
    this.startGameTimer();
    
    this.showMessage('Good luck, ' + this.currentPlayer + '! Game started!', 'success');
};

GameState.prototype.startGameTimer = function() {
    var self = this;
    
    this.gameTimer = setInterval(function() {
        self.timeRemaining--;
        self.updateTimerDisplay();
        
        if (self.timeRemaining <= 0) {
            self.endGame();
        }
        
        // Warning messages
        if (self.timeRemaining === 300) { // 5 minutes
            self.showMessage('5 minutes remaining!', 'info');
        } else if (self.timeRemaining === 60) { // 1 minute
            self.showMessage('1 minute left!', 'info');
        } else if (self.timeRemaining === 10) {
            self.showMessage('10 seconds!', 'info');
        }
    }, 1000);
};

GameState.prototype.updateTimerDisplay = function() {
    var minutes = Math.floor(this.timeRemaining / 60);
    var seconds = this.timeRemaining % 60;
    var timeString = minutes + ':' + (seconds < 10 ? '0' : '') + seconds;
    
    var timerEl = document.getElementById('game-timer');
    if (timerEl) {
        timerEl.textContent = timeString;
        
        // Color coding for urgency
        if (this.timeRemaining <= 60) {
            timerEl.style.color = '#ff4444';
        } else if (this.timeRemaining <= 300) {
            timerEl.style.color = '#ffaa00';
        } else {
            timerEl.style.color = '#4CAF50';
        }
    }
};

GameState.prototype.startNewHand = function() {
    if (typeof createDeck !== 'function') {
        this.showMessage('Error: Cards not loaded!', 'error');
        return;
    }
    
    this.deck = createDeck();
    this.playerHand = [];
    this.score = 0;
    this.cardsPlayed = 0;
    this.playHistory = [];
    this.holdCards = [];
    this.activeEffects = {};
    
    // Deal 7 cards for solo play (more strategic choices)
    for (var i = 0; i < 7 && this.deck.length > 0; i++) {
        this.playerHand.push(this.deck.pop());
    }
    
    this.updateDisplay();
    console.log('🃏 Dealt', this.playerHand.length, 'cards');
};

GameState.prototype.playCard = function(index) {
    var card = this.playerHand[index];
    if (!card) return;
    
    console.log('🃏 Playing:', card.name);
    
    this.saveToHistory(card, index);
    this.playerHand.splice(index, 1);
    this.cardsPlayed++;
    
    if (card.type === 'event') {
        this.handleEventCard(card);
    } else if (card.playType === 'hold') {
        this.handleHoldCard(card);
    } else {
        this.handleActionCard(card);
    }
    
    // Deal new card if deck has cards
    if (this.deck.length > 0) {
        this.playerHand.push(this.deck.pop());
    }
    
    this.updateDisplay();
    this.checkForBonuses();
};

GameState.prototype.handleEventCard = function(card) {
    var points = card.points;
    
    // Apply hold card effects
    if (this.activeEffects.doubleNext) {
        points *= 2;
        delete this.activeEffects.doubleNext;
        this.removeHoldCard('double_next_score');
        this.showMessage('DOUBLE POINTS! ' + card.name + ' for ' + points + ' points!', 'success');
    } else {
        this.showMessage(card.name + ' for ' + points + ' points!', 'success');
    }
    
    this.score += points;
    
    // Check for scoring streaks
    this.checkScoringStreak(card);
};

GameState.prototype.handleHoldCard = function(card) {
    this.holdCards.push(card);
    
    if (card.id === 'double_next_score') {
        this.activeEffects.doubleNext = true;
    } else if (card.id === 'block_steal') {
        this.activeEffects.blockSteal = true;
    }
    
    this.showMessage(card.name + ' activated! Hold card in play.', 'success');
};

GameState.prototype.handleActionCard = function(card) {
    // In solo mode, action cards give different benefits
    if (card.id === 'steal_random_card') {
        // Draw 2 extra cards
        this.drawCards(2);
        this.showMessage('Drew 2 bonus cards!', 'success');
    } else if (card.id === 'swap_hands') {
        // Shuffle and redraw hand
        this.shuffleHand();
        this.showMessage('Hand shuffled!', 'success');
    } else if (card.id === 'draw_from_all') {
        // Draw 3 extra cards
        this.drawCards(3);
        this.showMessage('Drew 3 bonus cards!', 'success');
    } else if (card.id === 'peek_at_hand') {
        // Show next 3 cards in deck
        this.peekAtDeck();
    }
};

GameState.prototype.drawCards = function(count) {
    var drawn = 0;
    for (var i = 0; i < count && this.deck.length > 0; i++) {
        this.playerHand.push(this.deck.pop());
        drawn++;
    }
    console.log('📥 Drew', drawn, 'additional cards');
};

GameState.prototype.shuffleHand = function() {
    // Put hand back in deck and redraw
    for (var i = 0; i < this.playerHand.length; i++) {
        this.deck.push(this.playerHand[i]);
    }
    
    // Shuffle deck
    this.deck = this.shuffleDeck(this.deck);
    
    // Redraw hand
    this.playerHand = [];
    var handSize = Math.min(7, this.deck.length);
    for (var j = 0; j < handSize; j++) {
        this.playerHand.push(this.deck.pop());
    }
};

GameState.prototype.shuffleDeck = function(deck) {
    var shuffled = deck.slice();
    for (var i = shuffled.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var temp = shuffled[i];
        shuffled[i] = shuffled[j];
        shuffled[j] = temp;
    }
    return shuffled;
};

GameState.prototype.peekAtDeck = function() {
    var upcoming = [];
    for (var i = 0; i < 3 && i < this.deck.length; i++) {
        upcoming.push(this.deck[this.deck.length - 1 - i]);
    }
    
    this.showPeekModal(upcoming);
};

GameState.prototype.checkScoringStreak = function(card) {
    // Check last few plays for streak bonuses
    var recentPlays = this.playHistory.slice(-3);
    var eventCount = 0;
    
    for (var i = 0; i < recentPlays.length; i++) {
        if (recentPlays[i].card.type === 'event') {
            eventCount++;
        }
    }
    
    if (eventCount === 3) {
        var bonus = 5;
        this.score += bonus;
        this.showMessage('🔥 SCORING STREAK! +' + bonus + ' bonus points!', 'success');
    }
};

GameState.prototype.checkForBonuses = function() {
    // Quarter/Half game bonuses
    var quarterTime = this.getGameDuration() / 4;
    var timeElapsed = (Date.now() - this.gameStartTime) / 1000;
    
    if (timeElapsed >= quarterTime && !this.quarterBonus) {
        this.quarterBonus = true;
        this.score += 3;
        this.showMessage('🏈 Quarter Bonus! +3 points!', 'success');
    }
};

GameState.prototype.getGameDuration = function() {
    var durations = {
        'quarter': 15 * 60,
        'half': 30 * 60,
        'full': 60 * 60
    };
    return durations[this.gameMode];
};

GameState.prototype.removeHoldCard = function(cardId) {
    for (var i = 0; i < this.holdCards.length; i++) {
        if (this.holdCards[i].id === cardId) {
            this.holdCards.splice(i, 1);
            break;
        }
    }
};

GameState.prototype.endGame = function() {
    if (this.gameTimer) {
        clearInterval(this.gameTimer);
    }
    
    this.gameEndTime = Date.now();
    this.gameStarted = false;
    
    // Update statistics
    this.updatePersonalStats();
    this.savePersonalStats();
    
    this.showEndGameScreen();
};

GameState.prototype.updatePersonalStats = function() {
    if (this.score > this.personalBest) {
        this.personalBest = this.score;
        this.showMessage('🏆 NEW PERSONAL BEST!', 'success');
    }
    
    this.gamesPlayed++;
    this.averageScore = Math.round(((this.averageScore * (this.gamesPlayed - 1)) + this.score) / this.gamesPlayed);
};

GameState.prototype.undoLastPlay = function() {
    if (this.playHistory.length === 0) {
        this.showMessage('No moves to undo', 'info');
        return;
    }
    
    var lastPlay = this.playHistory.pop();
    this.score = lastPlay.scoreBefore;
    this.cardsPlayed = lastPlay.cardsPlayedBefore;
    
    // Restore the card to hand
    this.playerHand.splice(lastPlay.index, 0, lastPlay.card);
    
    // Remove the newest card (that was dealt)
    if (this.playerHand.length > 7) {
        this.deck.push(this.playerHand.pop());
    }
    
    this.updateDisplay();
    this.showMessage('Move undone', 'info');
};

GameState.prototype.saveToHistory = function(card, index) {
    this.playHistory.push({
        card: card,
        index: index,
        scoreBefore: this.score,
        cardsPlayedBefore: this.cardsPlayed,
        timestamp: Date.now()
    });
    
    // Keep only last 10 moves for undo
    if (this.playHistory.length > 10) {
        this.playHistory.shift();
    }
};

// Display functions
GameState.prototype.showScreen = function(screenId) {
    var screens = document.querySelectorAll('.screen');
    for (var i = 0; i < screens.length; i++) {
        screens[i].classList.remove('active');
    }
    
    var targetScreen = document.getElementById(screenId);
    if (targetScreen) {
        targetScreen.classList.add('active');
    }
};

GameState.prototype.showGameScreen = function() {
    var nameEl = document.getElementById('game-player-name');
    if (nameEl) {
        nameEl.textContent = this.currentPlayer + ' (' + this.gameMode + ' game)';
    }
    
    this.showScreen('game-screen');
};

GameState.prototype.showEndGameScreen = function() {
    this.updateFinalStatsDisplay();
    this.showScreen('end-game-screen');
};

GameState.prototype.showStatsScreen = function() {
    this.updateStatsDisplay();
    this.showScreen('stats-screen');
};

GameState.prototype.showMessage = function(text, type) {
    console.log('💬', text);
    
    var container = document.getElementById('message-container');
    if (!container) return;
    
    var message = document.createElement('div');
    message.className = 'message message-' + (type || 'info');
    message.textContent = text;
    container.appendChild(message);
    
    setTimeout(function() {
        if (message.parentNode) message.remove();
    }, 4000);
};

GameState.prototype.updateDisplay = function() {
    this.displayHand();
    this.displayHoldCards();
    this.updateStats();
    this.updateGameProgress();
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
    
    var deckEl = document.getElementById('cards-remaining');
    if (deckEl) deckEl.textContent = this.deck.length;
};

GameState.prototype.updateGameProgress = function() {
    if (!this.gameStarted) return;
    
    var progressEl = document.getElementById('game-progress');
    if (progressEl) {
        var totalTime = this.getGameDuration();
        var elapsed = totalTime - this.timeRemaining;
        var percentage = (elapsed / totalTime) * 100;
        progressEl.style.width = percentage + '%';
    }
};

GameState.prototype.updateStatsDisplay = function() {
    var bestEl = document.getElementById('personal-best');
    if (bestEl) bestEl.textContent = this.personalBest;
    
    var gamesEl = document.getElementById('games-played');
    if (gamesEl) gamesEl.textContent = this.gamesPlayed;
    
    var avgEl = document.getElementById('average-score');
    if (avgEl) avgEl.textContent = this.averageScore;
};

GameState.prototype.updateFinalStatsDisplay = function() {
    var finalScoreEl = document.getElementById('final-score');
    if (finalScoreEl) finalScoreEl.textContent = this.score;
    
    var gameDurationEl = document.getElementById('game-duration');
    if (gameDurationEl) {
        var duration = Math.round((this.gameEndTime - this.gameStartTime) / 1000 / 60);
        gameDurationEl.textContent = duration + ' minutes';
    }
    
    var isNewBest = this.score === this.personalBest && this.gamesPlayed > 1;
    var newBestEl = document.getElementById('new-best-indicator');
    if (newBestEl) {
        newBestEl.style.display = isNewBest ? 'block' : 'none';
    }
};

GameState.prototype.showPeekModal = function(cards) {
    var modal = document.createElement('div');
    modal.className = 'modal active';
    
    var cardHtml = '<h3>🔮 Next Cards in Deck</h3>';
    for (var i = 0; i < cards.length; i++) {
        var card = cards[i];
        cardHtml += '<div class="peek-card"><strong>' + card.name + '</strong> (' + card.points + ' pts)<br><small>' + card.description + '</small></div>';
    }
    
    modal.innerHTML = '<div class="modal-content">' + cardHtml + '<button class="btn btn-secondary" onclick="this.closest(\'.modal\').remove()">Close</button></div>';
    
    document.body.appendChild(modal);
    modal.onclick = function(e) {
        if (e.target === modal) modal.remove();
    };
};
