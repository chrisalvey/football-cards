// Basic Football Card Game - Simple Version
function GameState() {
    this.currentPlayer = null;
    this.gameStarted = false;
    this.playerHand = [];
    this.deck = [];
    this.score = 0;
    this.cardsPlayed = 0;
    this.players = {};
    
    console.log('GameState constructor called');
    this.init();
}

GameState.prototype.init = function() {
    console.log('GameState init called');
    this.setupEventListeners();
    this.showScreen('welcome-screen');
};

GameState.prototype.setupEventListeners = function() {
    var self = this;
    console.log('Setting up event listeners');
    
    var joinBtn = document.getElementById('join-game-btn');
    if (joinBtn) {
        joinBtn.onclick = function() {
            self.joinGame();
        };
    }
    
    var viewBtn = document.getElementById('view-cards-btn');
    if (viewBtn) {
        viewBtn.onclick = function() {
            self.viewCards();
        };
    }
    
    var backBtn = document.getElementById('back-to-welcome-cards');
    if (backBtn) {
        backBtn.onclick = function() {
            self.showScreen('welcome-screen');
        };
    }
};

GameState.prototype.joinGame = function() {
    console.log('Join game called');
    var nameInput = document.getElementById('player-name-welcome');
    var name = nameInput.value.trim();
    
    if (!name) {
        alert('Please enter your name');
        return;
    }
    
    this.currentPlayer = name;
    this.gameStarted = true;
    this.startNewHand();
    this.showGameScreen();
};

GameState.prototype.startNewHand = function() {
    console.log('Starting new hand');
    this.deck = createDeck();
    this.playerHand = [];
    this.score = 0;
    this.cardsPlayed = 0;
    
    this.dealCards(5);
    this.updateDisplay();
};

GameState.prototype.dealCards = function(count) {
    for (var i = 0; i < count && this.deck.length > 0; i++) {
        this.playerHand.push(this.deck.pop());
    }
};

GameState.prototype.playCard = function(index) {
    console.log('Playing card at index:', index);
    var card = this.playerHand[index];
    if (!card) return;
    
    this.playerHand.splice(index, 1);
    this.cardsPlayed++;
    
    if (card.type === 'event') {
        this.score += card.points;
        alert('Played ' + card.name + ' for ' + card.points + ' points!');
    }
    
    this.dealCards(1);
    this.updateDisplay();
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
    var scoreElement = document.getElementById('current-score');
    if (scoreElement) scoreElement.textContent = this.score;
    
    var playedElement = document.getElementById('cards-played');
    if (playedElement) playedElement.textContent = this.cardsPlayed;
    
    var handElement = document.getElementById('cards-in-hand');
    if (handElement) handElement.textContent = this.playerHand.length;
};

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
    var nameElement = document.getElementById('game-player-name');
    if (nameElement) nameElement.textContent = this.currentPlayer;
    
    this.showScreen('game-screen');
    alert('Welcome ' + this.currentPlayer + '!');
};

GameState.prototype.viewCards = function() {
    var container = document.getElementById('cards-list');
    if (!container) return;
    
    var html = '<h3>All Cards</h3>';
    for (var i = 0; i < CARD_DECK.length; i++) {
        var card = CARD_DECK[i];
        html += '<div style="margin: 10px 0; padding: 10px; border: 1px solid white; border-radius: 5px;">';
        html += '<strong>' + card.name + '</strong> (' + card.points + ' pts)<br>';
        html += card.description;
        html += '</div>';
    }
    
    container.innerHTML = html;
    this.showScreen('card-viewer-screen');
};

console.log('GameState function defined successfully');