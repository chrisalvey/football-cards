// Firebase-Enabled Football Card Game
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
        this.gameRef = null;
        this.playersRef = null;
        this.messagesRef = null;
        
        this.init();
    }

    init() {
        this.setupFirebase();
        this.setupEventListeners();
        this.showScreen('welcome-screen');
        this.updateWelcomeDisplay();
    }

    setupFirebase() {
        // Firebase references
        this.gameRef = database.ref('game');
        this.playersRef = database.ref('game/players');
        this.handsRef = database.ref('game/hands');
        this.messagesRef = database.ref('game/messages');
        
        // Listen for player changes
        this.playersRef.on('value', (snapshot) => {
            const players = snapshot.val() || {};
            this.handlePlayersUpdate(players);
        });
        
        // Listen for messages
        this.messagesRef.on('child_added', (snapshot) => {
            const message = snapshot.val();
            this.handleNewMessage(message);
        });
        
        // Listen for reset events
        database.ref('game/resetNotification').on('value', (snapshot) => {
            const resetData = snapshot.val();
            if (resetData) {
                this.handleResetNotification(resetData);
            }
        });
    }

    // === FIREBASE DATA MANAGEMENT ===
    
    async savePlayerData() {
        if (!this.currentPlayer) return;
        
        const playerData = {
            name: this.currentPlayer,
            score: this.score,
            cardsInHand: this.playerHand.length,
            cardsPlayed: this.cardsPlayed,
            lastSeen: Date.now()
        };
        
        const handData = [...this.playerHand];
        
        await Promise.all([
            this.playersRef.child(this.currentPlayer).set(playerData),
            this.handsRef.child(this.currentPlayer).set(handData)
        ]);
    }

    async removePlayerData() {
        if (!this.currentPlayer) return;
        
        await Promise.all([
            this.playersRef.child(this.currentPlayer).remove(),
            this.handsRef.child(this.currentPlayer).remove()
        ]);
    }

    async getPlayerHand(playerName) {
        const snapshot = await this.handsRef.child(playerName).once('value');
        return snapshot.val() || [];
    }

    async broadcastMessage(text) {
        const message = {
            text,
            timestamp: Date.now(),
            player: this.currentPlayer
        };
        
        await this.messagesRef.push(message);
        
        // Keep only last 20 messages
        const snapshot = await this.messagesRef.once('value');
        const messages = snapshot.val() || {};
        const messageKeys = Object.keys(messages);
        
        if (messageKeys.length > 20) {
            const oldKeys = messageKeys.slice(0, messageKeys.length - 20);
            const updates = {};
            oldKeys.forEach(key => updates[key] = null);
            await this.messagesRef.update(updates);
        }
    }

    // === FIREBASE EVENT HANDLERS ===
    
    handlePlayersUpdate(players) {
        this.players = players;
        
        if (this.gameStarted) {
            this.updateOtherPlayersDisplay();
            this.updateOnlineCount();
        } else {
            this.updateWelcomeDisplay();
        }
    }

    handleNewMessage(message) {
        if (!message || !this.currentPlayer) return;
        
        // Only show messages from other players that are newer than our last check
        if (message.player !== this.currentPlayer && message.timestamp > this.lastMessageCheck) {
            this.showMessage(message.text, 'info');
            this.lastMessageCheck = Math.max(this.lastMessageCheck, message.timestamp);
        }
    }

    async handleResetNotification(resetData) {
        if (!resetData || !this.currentPlayer) return;
        
        const resetTime = Date.now() - resetData.timestamp;
        
        // If reset happened recently and we didn't trigger it
        if (resetTime < 10000 && resetData.resetBy !== this.currentPlayer) {
            this.showMessage(`${resetData.resetBy} reset the game for everyone!`, 'info');
            
            setTimeout(() => {
                // Clear the reset notification and reload
                database.ref('game').remove().then(() => {
                    location.reload();
                });
            }, 2000);
        }
    }

    // === CORE GAME MECHANICS ===
    
    async joinGame() {
        const name = document.getElementById('player-name-welcome').value.trim();
        
        if (!name || name.length > 20) {
            this.showMessage(name ? 'Name too long' : 'Please enter your name', 'error');
            return;
        }

        // Check if name is taken
        const snapshot = await this.playersRef.child(name).once('value');
        if (snapshot.exists()) {
            this.showMessage('Name already taken', 'error');
            return;
        }

        this.currentPlayer = name;
        this.gameStarted = true;
        this.lastMessageCheck = Date.now();
        
        this.startNewHand();
        await this.savePlayerData();
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
    }

    async playCard(index) {
        const card = this.playerHand[index];
        if (!card) return;

        this.saveToHistory(card, index);
        this.playerHand.splice(index, 1);
        this.cardsPlayed++;

        if (card.type === 'event') {
            await this.handleEventCard(card);
        } else if (card.playType === 'hold') {
            await this.handleHoldCard(card);
        } else {
            this.handleActionCard(card);
            return; // Action cards handle their own flow
        }

        this.dealCards(1);
        this.updateDisplay();
        await this.savePlayerData();
    }

    async handleEventCard(card) {
        let points = card.points;
        if (this.activeEffects.doubleNext) {
            points *= 2;
            delete this.activeEffects.doubleNext;
        }
        
        this.score += points;
        await this.broadcastMessage(`${this.currentPlayer} played ${card.name} (${points} pts)`);
        this.showMessage(`${card.name} for ${points} points!`, 'success');
    }

    async handleHoldCard(card) {
        this.holdCards.push(card);
        
        if (card.id === 'double_next_score') this.activeEffects.doubleNext = true;
        if (card.id === 'block_steal') this.activeEffects.blockSteal = true;
        
        await this.broadcastMessage(`${this.currentPlayer} activated ${card.name}`);
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

    async executeActionCard(card, target = null) {
        let result = '';
        
        switch (card.id) {
            case 'steal_random_card':
                result = await this.stealFromPlayer(target);
                break;
            case 'swap_hands':
                result = await this.swapWithPlayer(target);
                break;
            case 'draw_from_all':
                result = await this.drawFromAll();
                break;
            case 'peek_at_hand':
                result = await this.peekAtPlayer(target);
                break;
        }

        await this.broadcastMessage(`${this.currentPlayer} played ${card.name}`);
        this.showMessage(result || `${card.name} played!`, 'success');
        this.closeActionModal();
        this.dealCards(1);
        this.updateDisplay();
        await this.savePlayerData();
    }

    // === ACTION CARD EFFECTS ===

    async stealFromPlayer(targetName) {
        const theirHand = await this.getPlayerHand(targetName);
        
        if (!theirHand.length) return `${targetName} has no cards`;

        const stolenCard = theirHand.splice(Math.floor(Math.random() * theirHand.length), 1)[0];
        this.playerHand.push(stolenCard);
        
        // Update their hand in Firebase
        await this.handsRef.child(targetName).set(theirHand);
        await this.playersRef.child(targetName).child('cardsInHand').set(theirHand.length);
        
        return `Stole ${stolenCard.name} from ${targetName}!`;
    }

    async swapWithPlayer(targetName) {
        const theirHand = await this.getPlayerHand(targetName);
        
        if (!theirHand) return `Cannot swap with ${targetName}`;

        const myHand = [...this.playerHand];
        this.playerHand = [...theirHand];
        
        // Update both hands in Firebase
        await Promise.all([
            this.handsRef.child(targetName).set(myHand),
            this.handsRef.child(this.currentPlayer).set(this.playerHand),
            this.playersRef.child(targetName).child('cardsInHand').set(myHand.length),
            this.playersRef.child(this.currentPlayer).child('cardsInHand').set(this.playerHand.length)
        ]);
        
        return `Swapped hands with ${targetName}!`;
    }

    async drawFromAll() {
        const otherPlayers = this.getOtherPlayers();
        let drawn = 0;
        
        for (const playerName of otherPlayers) {
            const theirHand = await this.getPlayerHand(playerName);
            if (theirHand.length > 0) {
                const card = theirHand.splice(Math.floor(Math.random() * theirHand.length), 1)[0];
                this.playerHand.push(card);
                drawn++;
                
                // Update their hand
                await this.handsRef.child(playerName).set(theirHand);
                await this.playersRef.child(playerName).child('cardsInHand').set(theirHand.length);
            }
        }

        return `Drew ${drawn} cards!`;
    }

    async peekAtPlayer(targetName) {
        const theirHand = await this.getPlayerHand(targetName);
        
        if (!theirHand) return `Cannot peek at ${targetName}`;

        this.showPeekModal(targetName, theirHand);
        return `Peeking at ${targetName}'s hand...`;
    }

    // === UNDO SYSTEM ===

    async undoLastPlay() {
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
        await this.savePlayerData();
        this.showMessage('Undid last play', 'info');
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

    getOtherPlayers() {
        return Object.keys(this.players || {}).filter(name => name !== this.currentPlayer);
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

    updateOtherPlayersDisplay() {
        const others = Object.values(this.players || {}).filter(p => p.name !== this.currentPlayer);
        
        const section = document.getElementById('other-players-section');
        const container = document.getElementById('other-players-list');
        
        if (!others.length) {
            section.style.display = 'none';
            return;
        }

        section.style.display = 'block';
    updateOtherPlayersDisplay() {
        const others = Object.values(this.players || {}).filter(p => p.name !== this.currentPlayer);
        
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
    }

    updateOnlineCount() {
        const count = Object.keys(this.players || {}).length;
        document.getElementById('players-online-game').textContent = count;
    }

    updateWelcomeDisplay() {
        const count = Object.keys(this.players || {}).length;
        document.getElementById('players-online').textContent = `${count} player(s) online`;
    }

    // === MODALS ===

    showActionModal(card) {
        const others = this.getOtherPlayers();
        
        document.getElementById('action-title').textContent = card.name;
        document.getElementById('action-description').textContent = card.description;
        document.getElementById('target-selection').style.display = others.length ? 'block' : 'none';
        
        document.getElementById('target-buttons').innerHTML = others.map(playerName => {
            const player = this.players[playerName];
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

    async resetGame() {
        if (confirm('Reset game for everyone?')) {
            // Send reset notification
            await database.ref('game/resetNotification').set({
                resetBy: this.currentPlayer,
                timestamp: Date.now()
            });
            
            // Clear all game data after a delay
            setTimeout(async () => {
                await database.ref('game').remove();
                location.reload();
            }, 2000);
        }
    }

    async leaveGame() {
        if (this.currentPlayer) {
            await this.removePlayerData();
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

        // Handle page unload to clean up player data
        window.addEventListener('beforeunload', () => {
            if (this.currentPlayer) {
                // Use sendBeacon for reliable cleanup on page unload
                navigator.sendBeacon && navigator.sendBeacon('/cleanup', JSON.stringify({
                    player: this.currentPlayer
                }));
            }
        });
    }
}

// Initialize
// Note: Game is now initialized from the HTML file after Firebase loads