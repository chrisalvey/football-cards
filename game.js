// Ultra-Simplified Football Card Game
class GameState {
    constructor() {
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
        this.gameId = 'football-card-game';
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.showScreen('welcome-screen');
        this.updateWelcomeDisplay();
        this.startPolling();
    }

    // === CORE GAME MECHANICS ===
    
    joinGame() {
        const name = document.getElementById('player-name-welcome').value.trim();
        
        if (!name || name.length > 20) {
            this.showMessage(name ? 'Name too long' : 'Please enter your name', 'error');
            return;
        }

        if (this.isNameTaken(name)) {
            this.showMessage('Name already taken', 'error');
            return;
        }

        this.currentPlayer = name;
        this.gameStarted = true;
        this.lastMessageCheck = Date.now();
        
        this.addPlayerToGame();
        this.startNewHand();
        this.showGameScreen();
    }

    startNewHand() {
        this.deck = createDeck();
        this.playerHand = [];
        this.score = 0;
        this.cardsPlayed = 0;
        this.playHistory = [];
        this.holdCards = [];
        this.activeEffects = {};
        
        this.dealCards(5);
        this.updateDisplay();
        this.saveMyData();
    }

    playCard(index) {
        const card = this.playerHand[index];
        if (!card) return;

        this.saveToHistory(card, index);
        this.playerHand.splice(index, 1);
        this.cardsPlayed++;

        if (card.type === 'event') {
            this.handleEventCard(card);
        } else if (card.playType === 'hold') {
            this.handleHoldCard(card);
        } else {
            this.handleActionCard(card, index);
            return; // Action cards handle their own flow
        }

        this.dealCards(1);
        this.updateDisplay();
        this.saveMyData();
    }

    handleEventCard(card) {
        let points = card.points;
        if (this.activeEffects.doubleNext) {
            points *= 2;
            delete this.activeEffects.doubleNext;
        }
        
        this.score += points;
        this.broadcastMessage(`${this.currentPlayer} played ${card.name} (${points} pts)`);
        this.showMessage(`${card.name} for ${points} points!`, 'success');
    }

    handleHoldCard(card) {
        this.holdCards.push(card);
        
        if (card.id === 'double_next_score') this.activeEffects.doubleNext = true;
        if (card.id === 'block_steal') this.activeEffects.blockSteal = true;
        
        this.broadcastMessage(`${this.currentPlayer} activated ${card.name}`);
        this.showMessage(`${card.name} activated!`, 'success');
    }

    handleActionCard(card) {
        // For immediate action cards, show modal for target selection
        const needsTarget = ['steal_random_card', 'swap_hands', 'peek_at_hand'].includes(card.id);
        
        if (needsTarget && this.getOtherPlayers().length === 0) {
            this.showMessage('No other players available', 'error');
            return;
        }

        if (needsTarget) {
            this.showActionModal(card);
        } else {
            this.executeActionCard(card);
        }
    }

    executeActionCard(card, target = null) {
        let result = '';
        
        switch (card.id) {
            case 'steal_random_card':
                result = this.stealFromPlayer(target);
                break;
            case 'swap_hands':
                result = this.swapWithPlayer(target);
                break;
            case 'draw_from_all':
                result = this.drawFromAll();
                break;
            case 'peek_at_hand':
                result = this.peekAtPlayer(target);
                break;
        }

        this.broadcastMessage(`${this.currentPlayer} played ${card.name}`);
        this.showMessage(result || `${card.name} played!`, 'success');
        this.closeActionModal();
        this.dealCards(1);
        this.updateDisplay();
        this.saveMyData();
    }

    // === ACTION CARD EFFECTS ===

    stealFromPlayer(targetName) {
        const gameData = this.loadGameData();
        const theirHand = gameData.hands?.[targetName];
        
        if (!theirHand?.length) return `${targetName} has no cards`;

        const stolenCard = theirHand.splice(Math.floor(Math.random() * theirHand.length), 1)[0];
        this.playerHand.push(stolenCard);
        this.saveGameData(gameData);
        
        return `Stole ${stolenCard.name} from ${targetName}!`;
    }

    swapWithPlayer(targetName) {
        const gameData = this.loadGameData();
        const theirHand = gameData.hands?.[targetName];
        
        if (!theirHand) return `Cannot swap with ${targetName}`;

        [this.playerHand, gameData.hands[targetName]] = [theirHand, this.playerHand];
        this.saveGameData(gameData);
        
        return `Swapped hands with ${targetName}!`;
    }

    drawFromAll() {
        const gameData = this.loadGameData();
        let drawn = 0;

        this.getOtherPlayers().forEach(playerName => {
            const theirHand = gameData.hands?.[playerName];
            if (theirHand?.length) {
                const card = theirHand.splice(Math.floor(Math.random() * theirHand.length), 1)[0];
                this.playerHand.push(card);
                drawn++;
            }
        });

        this.saveGameData(gameData);
        return `Drew ${drawn} cards!`;
    }

    peekAtPlayer(targetName) {
        const gameData = this.loadGameData();
        const theirHand = gameData.hands?.[targetName];
        
        if (!theirHand) return `Cannot peek at ${targetName}`;

        this.showPeekModal(targetName, theirHand);
        return `Peeking at ${targetName}'s hand...`;
    }

    // === UNDO SYSTEM ===

    undoLastPlay() {
        if (!this.playHistory.length) return;

        const lastPlay = this.playHistory.pop();
        this.score = lastPlay.scoreBefore;
        this.cardsPlayed = lastPlay.cardsPlayedBefore;

        // Remove from hold cards if it was a hold card
        if (lastPlay.type === 'hold') {
            this.holdCards = this.holdCards.filter(c => c.id !== lastPlay.card.id);
            if (lastPlay.card.id === 'double_next_score') delete this.activeEffects.doubleNext;
            if (lastPlay.card.id === 'block_steal') delete this.activeEffects.blockSteal;
        }

        // Return card to hand
        this.playerHand.splice(lastPlay.index, 0, lastPlay.card);
        if (this.playerHand.length > 5) this.playerHand.pop();

        this.updateDisplay();
        this.saveMyData();
        this.showMessage('Undid last play', 'info');
    }

    // === DATA MANAGEMENT ===

    loadGameData() {
        try {
            return JSON.parse(localStorage.getItem(this.gameId) || '{}');
        } catch {
            return {};
        }
    }

    saveGameData(data) {
        try {
            localStorage.setItem(this.gameId, JSON.stringify(data));
        } catch (e) {
            console.error('Save failed:', e);
        }
    }

    saveMyData() {
        const gameData = this.loadGameData();
        
        // Initialize structure
        if (!gameData.players) gameData.players = {};
        if (!gameData.hands) gameData.hands = {};
        if (!gameData.messages) gameData.messages = [];

        // Save my current state
        gameData.players[this.currentPlayer] = {
            name: this.currentPlayer,
            score: this.score,
            cardsInHand: this.playerHand.length,
            cardsPlayed: this.cardsPlayed,
            lastSeen: Date.now()
        };
        
        gameData.hands[this.currentPlayer] = [...this.playerHand];
        this.saveGameData(gameData);
    }

    addPlayerToGame() {
        const gameData = this.loadGameData();
        if (!gameData.players) gameData.players = {};
        
        gameData.players[this.currentPlayer] = {
            name: this.currentPlayer,
            score: 0,
            cardsInHand: 5,
            cardsPlayed: 0,
            lastSeen: Date.now()
        };
        
        this.saveGameData(gameData);
    }

    // === UTILITY FUNCTIONS ===

    dealCards(count) {
        for (let i = 0; i < count && this.deck.length > 0; i++) {
            this.playerHand.push(this.deck.pop());
        }
    }

    saveToHistory(card, index) {
        this.playHistory.push({
            card: {...card},
            index,
            scoreBefore: this.score,
            cardsPlayedBefore: this.cardsPlayed,
            type: card.type === 'event' ? 'event' : (card.playType || 'action')
        });
    }

    isNameTaken(name) {
        const gameData = this.loadGameData();
        const player = gameData.players?.[name];
        
        // If player exists, check if they're still active (seen in last 30 seconds)
        if (player) {
            const timeSinceLastSeen = Date.now() - player.lastSeen;
            if (timeSinceLastSeen > 30000) {
                // Player is inactive, remove them and allow name reuse
                delete gameData.players[name];
                delete gameData.hands?.[name];
                this.saveGameData(gameData);
                return false;
            }
            return true; // Player is still active
        }
        
        return false; // Name is available
    }

    getOtherPlayers() {
        const gameData = this.loadGameData();
        return Object.keys(gameData.players || {}).filter(name => name !== this.currentPlayer);
    }

    // === MESSAGING ===

    broadcastMessage(text) {
        const gameData = this.loadGameData();
        if (!gameData.messages) gameData.messages = [];
        
        gameData.messages.push({
            text,
            timestamp: Date.now(),
            player: this.currentPlayer
        });
        
        // Keep only last 10 messages
        gameData.messages = gameData.messages.slice(-10);
        this.saveGameData(gameData);
    }

    checkMessages() {
        const gameData = this.loadGameData();
        
        // Check for reset notification
        if (gameData.resetNotification) {
            const resetNotification = gameData.resetNotification;
            const resetTime = Date.now() - resetNotification.timestamp;
            
            // If reset happened recently and we didn't trigger it
            if (resetTime < 5000 && resetNotification.resetBy !== this.currentPlayer) {
                this.showMessage(`${resetNotification.resetBy} reset the game for everyone!`, 'info');
                setTimeout(() => {
                    localStorage.removeItem(this.gameId);
                    location.reload();
                }, 1000);
                return;
            }
        }
        
        // Check regular messages
        const newMessages = (gameData.messages || []).filter(msg => 
            msg.player !== this.currentPlayer && msg.timestamp > this.lastMessageCheck
        );

        newMessages.forEach(msg => this.showMessage(msg.text, 'info'));
        if (newMessages.length) this.lastMessageCheck = Date.now();
    }

    // === MULTIPLAYER SYNC ===

    startPolling() {
        setInterval(() => {
            if (this.gameStarted && this.currentPlayer) {
                this.saveMyData();
                this.updateOtherPlayersDisplay();
                this.checkMessages();
            } else {
                this.updateWelcomeDisplay();
            }
        }, 1000);
    }

    updateOtherPlayersDisplay() {
        const gameData = this.loadGameData();
        
        // Clean up inactive players (not seen in last 30 seconds)
        const now = Date.now();
        Object.keys(gameData.players || {}).forEach(playerName => {
            const player = gameData.players[playerName];
            if (playerName !== this.currentPlayer && now - player.lastSeen > 30000) {
                delete gameData.players[playerName];
                delete gameData.hands?.[playerName];
            }
        });
        this.saveGameData(gameData);
        
        const others = Object.values(gameData.players || {}).filter(p => p.name !== this.currentPlayer);
        
        const section = document.getElementById('other-players-section');
        const container = document.getElementById('other-players-list');
        
        if (!others.length) {
            section.style.display = 'none';
            return;
        }

        section.style.display = 'block';
        container.innerHTML = others.map(player => `
            <div class="other-player">
                <div class="player-info">
                    <div class="player-name-display">${player.name}</div>
                    <div class="player-stats">Score: ${player.score} • Played: ${player.cardsPlayed}</div>
                </div>
                <div class="player-card-count">${player.cardsInHand} cards</div>
            </div>
        `).join('');

        document.getElementById('players-online-game').textContent = Object.keys(gameData.players).length;
    }

    updateWelcomeDisplay() {
        const gameData = this.loadGameData();
        const count = Object.keys(gameData.players || {}).length;
        document.getElementById('players-online').textContent = `${count} player(s) online`;
    }

    // === DISPLAY FUNCTIONS ===

    updateDisplay() {
        this.displayHand();
        this.displayHoldCards();
        this.updateStats();
        document.getElementById('undo-btn').disabled = !this.playHistory.length;
    }

    displayHand() {
        const container = document.getElementById('player-hand');
        container.innerHTML = this.playerHand.map((card, index) => `
            <div class="card ${card.type}" onclick="game.playCard(${index})">
                <div class="card-header">
                    <span class="card-name">${card.name}</span>
                    <span class="card-points">${card.points} pts</span>
                </div>
                <div class="card-description">${card.description}</div>
                <div class="card-type">${card.type}${card.playType ? ' • ' + card.playType : ''}</div>
            </div>
        `).join('');
    }

    displayHoldCards() {
        const section = document.getElementById('hold-cards-section');
        const container = document.getElementById('hold-cards');
        
        if (!this.holdCards.length) {
            section.style.display = 'none';
            return;
        }

        section.style.display = 'block';
        container.innerHTML = this.holdCards.map(card => `
            <div class="hold-card">
                <div class="hold-card-name">${card.name}</div>
                <div class="hold-card-desc">${card.description}</div>
            </div>
        `).join('');
    }

    updateStats() {
        document.getElementById('current-score').textContent = this.score;
        document.getElementById('cards-played').textContent = this.cardsPlayed;
        document.getElementById('cards-in-hand').textContent = this.playerHand.length;
    }

    // === MODALS ===

    showActionModal(card) {
        const others = this.getOtherPlayers();
        
        document.getElementById('action-title').textContent = card.name;
        document.getElementById('action-description').textContent = card.description;
        document.getElementById('target-selection').style.display = others.length ? 'block' : 'none';
        
        const gameData = this.loadGameData();
        document.getElementById('target-buttons').innerHTML = others.map(playerName => {
            const player = gameData.players[playerName];
            return `
                <div class="target-player" onclick="game.selectTarget('${playerName}', this)">
                    <div>
                        <strong>${playerName}</strong><br>
                        <small>${player.cardsInHand} cards • Score: ${player.score}</small>
                    </div>
                </div>
            `;
        }).join('');
        
        document.getElementById('action-modal').classList.add('active');
        this.currentActionCard = card;
        this.selectedTarget = null;
    }

    selectTarget(playerName, element) {
        document.querySelectorAll('.target-player').forEach(btn => btn.classList.remove('selected'));
        element.classList.add('selected');
        this.selectedTarget = playerName;
    }

    confirmAction() {
        if (this.getOtherPlayers().length && !this.selectedTarget) {
            this.showMessage('Please select a target', 'error');
            return;
        }
        this.executeActionCard(this.currentActionCard, this.selectedTarget);
    }

    closeActionModal() {
        document.getElementById('action-modal').classList.remove('active');
        this.currentActionCard = null;
        this.selectedTarget = null;
    }

    showPeekModal(playerName, hand) {
        const modal = document.createElement('div');
        modal.className = 'modal active';
        modal.innerHTML = `
            <div class="modal-content">
                <h3>👀 ${playerName}'s Hand</h3>
                <div style="max-height: 300px; overflow-y: auto;">
                    ${hand.map(card => `
                        <div class="card ${card.type}" style="margin-bottom: 8px; cursor: default;">
                            <div class="card-header">
                                <span class="card-name">${card.name}</span>
                                <span class="card-points">${card.points} pts</span>
                            </div>
                            <div class="card-description">${card.description}</div>
                        </div>
                    `).join('')}
                </div>
                <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">Close</button>
            </div>
        `;
        document.body.appendChild(modal);
        modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
    }

    // === SCREEN MANAGEMENT ===

    showScreen(screenId) {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        document.getElementById(screenId).classList.add('active');
    }

    showGameScreen() {
        document.getElementById('game-player-name').textContent = this.currentPlayer;
        this.showScreen('game-screen');
        this.showMessage(`Welcome ${this.currentPlayer}!`, 'success');
    }

    viewCards() {
        const eventCards = CARD_DECK.filter(c => c.type === 'event');
        const actionCards = CARD_DECK.filter(c => c.type === 'action');
        
        document.getElementById('cards-list').innerHTML = `
            <h3 style="color: #4CAF50; margin: 20px 0 15px 0;">Event Cards</h3>
            ${eventCards.map(this.createCardDisplay).join('')}
            <h3 style="color: #ff9800; margin: 20px 0 15px 0;">Action Cards</h3>
            ${actionCards.map(this.createCardDisplay).join('')}
        `;
        
        this.showScreen('card-viewer-screen');
    }

    createCardDisplay(card) {
        return `
            <div style="background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); 
                        border-radius: 10px; padding: 15px; margin-bottom: 10px; 
                        border-left: 4px solid ${card.type === 'event' ? '#4CAF50' : '#ff9800'};">
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                    <strong>${card.name}</strong>
                    <span style="background: rgba(255,255,255,0.2); padding: 4px 8px; border-radius: 12px;">
                        ${card.points} pts × ${card.quantity}
                    </span>
                </div>
                <p style="opacity: 0.9; margin-bottom: 5px;">${card.description}</p>
                ${card.playType ? `<p style="opacity: 0.7; font-style: italic;">Play: ${card.playType}</p>` : ''}
            </div>
        `;
    }

    // === UTILITY ===

    resetGame() {
        if (confirm('Reset game for everyone?')) {
            // Send reset notification to all players
            const gameData = this.loadGameData();
            gameData.resetNotification = {
                resetBy: this.currentPlayer,
                timestamp: Date.now()
            };
            this.saveGameData(gameData);
            
            // Wait a moment for other players to see the notification
            setTimeout(() => {
                localStorage.removeItem(this.gameId);
                location.reload();
            }, 500);
        }
    }

    leaveGame() {
        // Clean up our player data when leaving
        if (this.currentPlayer) {
            const gameData = this.loadGameData();
            delete gameData.players?.[this.currentPlayer];
            delete gameData.hands?.[this.currentPlayer];
            this.saveGameData(gameData);
        }
        
        this.currentPlayer = null;
        this.gameStarted = false;
        document.getElementById('player-name-welcome').value = '';
        this.showScreen('welcome-screen');
        this.showMessage('Left game', 'info');
    }

    showMessage(text, type = 'info') {
        const container = document.getElementById('message-container');
        const message = document.createElement('div');
        message.className = `message message-${type}`;
        message.textContent = text;
        container.appendChild(message);
        setTimeout(() => message.remove(), 3000);
    }

    // === EVENT LISTENERS ===

    setupEventListeners() {
        // Join game
        document.getElementById('join-game-btn').onclick = () => this.joinGame();
        document.getElementById('player-name-welcome').onkeypress = (e) => {
            if (e.key === 'Enter') this.joinGame();
        };

        // Navigation
        document.getElementById('view-cards-btn').onclick = () => this.viewCards();
        document.getElementById('back-to-welcome-cards').onclick = () => this.showScreen('welcome-screen');
        document.getElementById('back-to-menu-btn').onclick = () => this.showScreen('welcome-screen');

        // Game controls
        document.getElementById('undo-btn').onclick = () => this.undoLastPlay();
        document.getElementById('new-game-btn').onclick = () => this.leaveGame();
        document.getElementById('reset-for-everyone-btn').onclick = () => this.resetGame();

        // Action modal
        document.getElementById('action-confirm').onclick = () => this.confirmAction();
        document.getElementById('action-cancel').onclick = () => this.closeActionModal();
        document.getElementById('action-modal').onclick = (e) => {
            if (e.target.id === 'action-modal') this.closeActionModal();
        };
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    window.game = new GameState();
});