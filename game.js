class FootballGame {
    constructor() {
        this.score = 0;
        this.comboMultiplier = 1;
        this.chainMultiplier = 1;
        this.cardsPlayed = 0;
        this.defensiveChain = 0;
        this.cards = this.generateCards();
        this.hand = [];
        this.playHistory = [];
        this.discardPile = [];
        this.hasStarterDiscardCard = false;
        
        // Use localStorage for persistent stats
        this.personalBest = parseInt(localStorage.getItem('football_best') || '0');
        this.gamesPlayed = parseInt(localStorage.getItem('football_games') || '0');
        this.averageScore = parseInt(localStorage.getItem('football_avg') || '0');
        
        this.init();
    }
    
    init() {
        this.updateStatsDisplay();
        this.setupEventListeners();
        this.dealHand();
    }
    
    generateCards() {
        const cardTypes = [
            { name: 'Touchdown', points: 7, type: 'event', count: 6, rarity: 'common' },
            { name: 'Field Goal', points: 3, type: 'event', count: 6, rarity: 'common' },
            { name: 'Interception', points: 5, type: 'event', count: 4, rarity: 'uncommon', category: 'defensive' },
            { name: 'Sack', points: 3, type: 'event', count: 5, rarity: 'common', category: 'defensive' },
            { name: 'Safety', points: 4, type: 'event', count: 2, rarity: 'rare' },
            { name: 'Penalty', points: 2, type: 'event', count: 4, rarity: 'common' },
            { name: 'First Down', points: 1, type: 'event', count: 8, rarity: 'common' },
            { name: 'Punt', points: 1, type: 'event', count: 5, rarity: 'common' },
            { name: 'Double Next', points: 0, type: 'action', count: 3, rarity: 'uncommon' },
            { name: 'Draw Cards', points: 0, type: 'action', count: 3, rarity: 'uncommon' },
            { name: 'Combo Boost', points: 0, type: 'action', count: 2, rarity: 'uncommon' },
            { name: 'Fumble Recovery', points: 4, type: 'event', count: 3, rarity: 'uncommon', category: 'defensive' },
            { name: 'Pick Six', points: 12, type: 'event', count: 1, rarity: 'legendary', category: 'defensive' },
            { name: 'Hail Mary', points: 12, type: 'event', count: 1, rarity: 'legendary' },
            { name: 'Blocked Kick', points: 5, type: 'event', count: 2, rarity: 'rare', category: 'defensive' },
            { name: 'Two-Point Conversion', points: 3, type: 'event', count: 1, rarity: 'rare' },
            { name: 'Red Zone Stop', points: 6, type: 'defensive', count: 2, rarity: 'uncommon' },
            { name: 'Discard', points: 0, type: 'special', count: 5, rarity: 'uncommon' }
        ];
        
        let deck = [];
        cardTypes.forEach(cardType => {
            for (let i = 0; i < cardType.count; i++) {
                deck.push({
                    id: `${cardType.name.toLowerCase().replace(/[^a-z]/g, '_')}_${i}`,
                    name: cardType.name,
                    points: cardType.points,
                    type: cardType.type,
                    rarity: cardType.rarity,
                    category: cardType.category || 'general',
                    description: this.getCardDescription(cardType.name)
                });
            }
        });
        
        return this.shuffleDeck(deck);
    }
    
    getCardDescription(cardName) {
        const descriptions = {
            'Touchdown': 'Player scores in the end zone',
            'Field Goal': 'Any successful kick through uprights - field goals during play or extra points after touchdowns',
            'Interception': 'Defense catches offensive pass - consecutive defensive plays increase point multipliers',
            'Sack': 'QB tackled behind line of scrimmage for a loss - consecutive defensive plays increase point multipliers',
            'Safety': 'Offensive player tackled in own end zone or intentional grounding in end zone',
            'Penalty': 'Referee throws penalty flag',
            'First Down': 'Offensive team earns first down through yardage gained or penalty (excludes possession changes)',
            'Punt': 'Team punts on 4th down',
            'Double Next': 'Play this card then your next event card will score 2x points',
            'Draw Cards': 'Add 2 cards to your hand (up to 10 card limit)',
            'Combo Boost': 'Gain 3 points immediately - if you have a defensive chain active, these points are multiplied by your current chain bonus',
            'Fumble Recovery': 'Opposing team recovers a fumble, resulting in change of possession (includes muffed punts - excludes same team recovering own fumble) - consecutive defensive plays increase point multipliers',
            'Pick Six': 'Interception returned for touchdown - consecutive defensive plays increase point multipliers',
            'Hail Mary': 'Long touchdown pass (40+ yards)',
            'Blocked Kick': 'Defense blocks field goal attempt, extra point, or punt - consecutive defensive plays increase point multipliers',
            'Two-Point Conversion': 'Team attempts 2-point conversion',
            'Red Zone Stop': 'Offense fails to get any score in the red zone - including at end of half/game. Consecutive defensive plays increase point multipliers',
            'Discard': 'Choose one card from your hand to return to the deck (one-time use)'
        };
        return descriptions[cardName];
    }
    
    shuffleDeck(deck) {
        for (let i = deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [deck[i], deck[j]] = [deck[j], deck[i]];
        }
        return deck;
    }
    
    dealHand() {
        this.hand = [];
        
        // Add starter discard card if this is a new game
        if (!this.hasStarterDiscardCard) {
            this.hand.push({
                id: 'starter_discard',
                name: 'Discard',
                points: 0,
                type: 'special',
                rarity: 'starter',
                category: 'special',
                description: 'Choose one card from your hand to return to the deck (one-time use)'
            });
            this.hasStarterDiscardCard = true;
        }
        
        // Deal regular cards
        for (let i = 0; i < 7 && this.cards.length > 0; i++) {
            this.hand.push(this.cards.pop());
        }
        
        this.displayHand();
        this.updateDisplay();
    }
    
    setupEventListeners() {
        document.getElementById('start-btn').onclick = () => this.startGame();
        document.getElementById('end-game-btn').onclick = () => this.endGame();
        document.getElementById('undo-btn').onclick = () => this.undoLastPlay();
        document.getElementById('modal-continue-btn').onclick = () => this.closeEndGameModal();
    }
    
    startGame() {
        this.showScreen('game-screen');
        this.showMessage('Game started! Good luck!', 'success');
    }
    
    playCard(cardIndex) {
        if (cardIndex < 0 || cardIndex >= this.hand.length) return;
        
        const card = this.hand[cardIndex];
        
        // Handle discard card specially
        if (card.type === 'special' && card.name === 'Discard') {
            this.showDiscardModal(cardIndex);
            return;
        }
        
        this.saveToHistory(card, cardIndex);
        this.hand.splice(cardIndex, 1);
        this.cardsPlayed++;
        
        // Add card to discard pile
        this.discardPile.push(card);
        
        this.processCard(card);
        
        if (this.hand.length <= 2 && this.cards.length > 0) {
            this.drawToHandSize(7);
        } else if (this.hand.length <= 2 && this.cards.length === 0 && this.discardPile.length > 0) {
            this.reshuffleDiscardPile();
            this.drawToHandSize(7);
        }
        
        this.displayHand();
        this.updateDisplay();
        this.checkMilestoneBonus();
    }
    
    showDiscardModal(discardCardIndex) {
        const otherCards = this.hand.filter((card, index) => index !== discardCardIndex);
        
        if (otherCards.length === 0) {
            this.showMessage('No other cards to discard!', 'info');
            return;
        }
        
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.id = 'discard-modal';
        
        let cardHtml = '<h3>Choose a Card to Discard</h3><div class="discard-cards-grid">';
        otherCards.forEach((card, index) => {
            const actualIndex = this.hand.findIndex(c => c.id === card.id);
            const pointsDisplay = card.points === 0 ? 'Special' : `${card.points} pts`;
            const rarityIcon = this.getRarityIcon(card.rarity);
            
            cardHtml += `
                <div class="discard-card" onclick="window.game.discardCard(${actualIndex}, ${discardCardIndex})">
                    <div class="card-header">
                        <span class="card-name">${card.name}</span>
                        <span class="card-points">${pointsDisplay}</span>
                    </div>
                    <div class="card-description">${card.description}</div>
                    ${rarityIcon ? `<div class="card-rarity">${rarityIcon}</div>` : ''}
                </div>
            `;
        });
        cardHtml += '</div>';
        
        modal.innerHTML = `
            <div class="modal-content">
                ${cardHtml}
                <button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
            </div>
        `;
        
        document.body.appendChild(modal);
    }
    
    discardCard(cardToDiscardIndex, discardCardIndex) {
        if (cardToDiscardIndex < 0 || cardToDiscardIndex >= this.hand.length) return;
        
        const cardToDiscard = this.hand[cardToDiscardIndex];
        const discardCard = this.hand[discardCardIndex];
        
        // Remove both cards from hand
        if (cardToDiscardIndex > discardCardIndex) {
            this.hand.splice(cardToDiscardIndex, 1);
            this.hand.splice(discardCardIndex, 1);
        } else {
            this.hand.splice(discardCardIndex, 1);
            this.hand.splice(cardToDiscardIndex, 1);
        }
        
        // Put discarded card back into deck and shuffle
        this.cards.push(cardToDiscard);
        this.cards = this.shuffleDeck(this.cards);
        
        // Close modal
        const modal = document.getElementById('discard-modal');
        if (modal) modal.remove();
        
        this.showMessage(`Discarded ${cardToDiscard.name} back to deck`, 'info');
        
        this.displayHand();
        this.updateDisplay();
    }
    
    processCard(card) {
        if (card.category === 'defensive' || card.type === 'defensive') {
            this.defensiveChain++;
            // Multiplier only applies starting from the 2nd consecutive defensive card
            this.chainMultiplier = this.defensiveChain >= 2 ? Math.min(1 + ((this.defensiveChain - 1) * 0.5), 3) : 1;
        } else {
            this.defensiveChain = 0;
            this.chainMultiplier = 1;
        }
        
        switch (card.type) {
            case 'event':
                this.handleEventCard(card);
                break;
            case 'action':
                this.handleActionCard(card);
                break;
            case 'defensive':
                this.handleDefensiveCard(card);
                break;
        }
        
        this.updateComboDisplay();
    }
    
    handleEventCard(card) {
        let multiplier = this.comboMultiplier * this.chainMultiplier;
        let points = Math.round(card.points * multiplier);
        this.score += points;
        
        let message = `${card.name} for ${points} points!`;
        if (multiplier > 1) {
            message += ` (${multiplier.toFixed(1)}x multiplier!)`;
        }
        
        if (card.rarity === 'legendary') {
            message = `🌟 LEGENDARY! ${message}`;
        }
        
        this.showMessage(message, card.rarity === 'legendary' ? 'special' : 'success');
        this.comboMultiplier = 1;
    }
    
    handleActionCard(card) {
        switch (card.name) {
            case 'Double Next':
                this.comboMultiplier = 2;
                this.showMessage('Next event card worth DOUBLE points!', 'success');
                break;
            case 'Draw Cards':
                this.drawExtraCards(2);
                this.showMessage('Drew 2 extra cards!', 'success');
                break;
            case 'Combo Boost':
                const immediateBonus = Math.round(3 * this.chainMultiplier);
                this.score += immediateBonus;
                this.showMessage(`Combo Boost! +${immediateBonus} immediate points!`, 'success');
                break;
        }
    }
    
    handleDefensiveCard(card) {
        let points = Math.round(card.points * this.chainMultiplier);
        this.score += points;
        this.showMessage(`🛡️ ${card.name}! +${points} points!`, 'success');
    }
    
    reshuffleDiscardPile() {
        if (this.discardPile.length === 0) return;
        
        // Move all discarded cards back to deck
        this.cards = [...this.discardPile];
        this.discardPile = [];
        
        // Shuffle the deck
        this.cards = this.shuffleDeck(this.cards);
        
        this.showMessage('♻️ Deck empty! Reshuffling played cards...', 'info');
    }
    
    drawExtraCards(count) {
        for (let i = 0; i < count && this.cards.length > 0 && this.hand.length < 10; i++) {
            this.hand.push(this.cards.pop());
        }
    }
    
    drawToHandSize(targetSize) {
        // Check if we need to reshuffle before drawing
        if (this.cards.length === 0 && this.discardPile.length > 0) {
            this.reshuffleDiscardPile();
        }
        
        const cardsToDraw = Math.min(targetSize - this.hand.length, this.cards.length);
        for (let i = 0; i < cardsToDraw; i++) {
            this.hand.push(this.cards.pop());
        }
        
        if (cardsToDraw > 0) {
            this.showMessage(`Drew ${cardsToDraw} cards!`, 'info');
        }
    }
    
    checkMilestoneBonus() {
        if (this.cardsPlayed > 0 && this.cardsPlayed % 10 === 0) {
            const bonus = 5;
            this.score += bonus;
            this.showMessage(`🎯 ${this.cardsPlayed} Cards Milestone! +${bonus} bonus points!`, 'success');
        }
        
        if (this.defensiveChain >= 3 && this.defensiveChain % 3 === 0) {
            const chainBonus = this.defensiveChain * 2;
            this.score += chainBonus;
            this.showMessage(`🔗 Defensive Chain ${this.defensiveChain}! +${chainBonus} chain bonus!`, 'special');
        }
    }
    
    undoLastPlay() {
        if (this.playHistory.length === 0) {
            this.showMessage('No moves to undo', 'info');
            return;
        }
        
        const lastPlay = this.playHistory.pop();
        this.score = lastPlay.scoreBefore;
        this.cardsPlayed = lastPlay.cardsPlayedBefore;
        this.defensiveChain = lastPlay.defensiveChainBefore;
        this.chainMultiplier = lastPlay.chainMultiplierBefore;
        
        // Remove card from discard pile and put back in hand
        const cardIndex = this.discardPile.findIndex(card => card.id === lastPlay.card.id);
        if (cardIndex !== -1) {
            this.discardPile.splice(cardIndex, 1);
        }
        
        this.hand.splice(lastPlay.cardIndex, 0, lastPlay.card);
        
        // If hand is over 7 cards, put extras back in deck
        while (this.hand.length > 7) {
            this.cards.push(this.hand.pop());
        }
        
        this.displayHand();
        this.updateDisplay();
        this.updateComboDisplay();
        this.showMessage('Move undone', 'info');
    }
    
    saveToHistory(card, cardIndex) {
        this.playHistory.push({
            card: card,
            cardIndex: cardIndex,
            scoreBefore: this.score,
            cardsPlayedBefore: this.cardsPlayed,
            defensiveChainBefore: this.defensiveChain,
            chainMultiplierBefore: this.chainMultiplier
        });
        
        if (this.playHistory.length > 5) {
            this.playHistory.shift();
        }
    }
    
    displayHand() {
        const container = document.getElementById('player-hand');
        const statusEl = document.getElementById('hand-status');
        
        container.innerHTML = '';
        container.classList.remove('at-limit');
        statusEl.style.display = 'none';
        
        // Show hand status notifications  
        const hasCards = this.cards.length > 0 || this.discardPile.length > 0;
        if (this.hand.length >= 10 && hasCards) {
            const drawCount = Math.min(7 - (this.hand.length - 1), this.cards.length);
            statusEl.textContent = `⚠️ Hand Full! Playing a card will draw ${drawCount} more`;
            statusEl.className = 'hand-notification hand-full';
            statusEl.style.display = 'block';
            container.classList.add('at-limit');
        } else if (this.hand.length <= 4 && this.hand.length >= 3 && hasCards) {
            const cardsToPlay = this.hand.length - 2;
            if (cardsToPlay === 1) {
                statusEl.textContent = `📋 Low Hand - Play one more card and you will automatically draw back to 7`;
            } else {
                statusEl.textContent = `📋 Low Hand - Play ${cardsToPlay} more cards and you will automatically draw back to 7`;
            }
            statusEl.className = 'hand-notification hand-low';
            statusEl.style.display = 'block';
        }
        
        // Sort cards by point value (lowest to highest), with special cards at the end
        const sortedHand = [...this.hand].map((card, originalIndex) => ({
            card,
            originalIndex
        })).sort((a, b) => {
            // Special cards (0 points) go to the end
            if (a.card.points === 0 && b.card.points === 0) {
                // Among special cards, sort by name for consistency
                return a.card.name.localeCompare(b.card.name);
            }
            if (a.card.points === 0) return 1;
            if (b.card.points === 0) return -1;
            
            // Regular cards sorted by points (lowest first)
            return a.card.points - b.card.points;
        });
        
        sortedHand.forEach(({card, originalIndex}) => {
            const cardDiv = document.createElement('div');
            cardDiv.className = `card ${card.type}`;
            
            // Special styling for discard cards
            if (card.type === 'special' && card.name === 'Discard') {
                cardDiv.classList.add('discard-card-style');
            }
            
            // Use original index for click handler to maintain correct card references
            cardDiv.onclick = () => this.playCard(originalIndex);
            
            const pointsDisplay = card.points === 0 ? 'Special' : `${card.points} pts`;
            const rarityIcon = this.getRarityIcon(card.rarity);
            
            cardDiv.innerHTML = `
                <div class="card-header">
                    <span class="card-name">${card.name}</span>
                    <span class="card-points">${pointsDisplay}</span>
                </div>
                <div class="card-description">${card.description}</div>
                ${rarityIcon ? `<div class="card-rarity">${rarityIcon}</div>` : ''}
            `;
            
            container.appendChild(cardDiv);
        });
    }
    
    getRarityIcon(rarity) {
        const icons = {
            'uncommon': '💎',
            'rare': '⭐',
            'legendary': '🏆'
        };
        return icons[rarity] || '';
    }
    
    updateDisplay() {
        document.getElementById('current-score').textContent = this.score;
        document.getElementById('cards-played').textContent = this.cardsPlayed;
        document.getElementById('cards-remaining').textContent = this.cards.length;
        document.getElementById('next-milestone').textContent = `${this.cardsPlayed} → ${Math.ceil((this.cardsPlayed + 1) / 10) * 10}`;
        
        // Check for milestone approach
        this.checkMilestoneApproach();
    }
    
    checkMilestoneApproach() {
        const nextMilestone = Math.ceil((this.cardsPlayed + 1) / 10) * 10;
        const cardsUntilMilestone = nextMilestone - this.cardsPlayed;
        
        const approachBanner = document.getElementById('milestone-approach-banner');
        
        if (cardsUntilMilestone === 1) {
            // Show approach notification
            if (!approachBanner) {
                this.createMilestoneApproachBanner();
            }
        } else {
            // Hide approach notification
            if (approachBanner) {
                approachBanner.remove();
            }
        }
    }
    
    createMilestoneApproachBanner() {
        const banner = document.createElement('div');
        banner.id = 'milestone-approach-banner';
        banner.className = 'milestone-approach-banner';
        banner.innerHTML = `
            <div class="milestone-banner-content">
                <div class="milestone-banner-icon">🎯</div>
                <div class="milestone-banner-text">
                    <div class="milestone-banner-title">MILESTONE APPROACHING!</div>
                    <div class="milestone-banner-subtitle">Next card earns milestone reward!</div>
                </div>
            </div>
        `;
        
        // Insert banner before the game stats
        const gameStats = document.querySelector('.game-stats');
        gameStats.parentNode.insertBefore(banner, gameStats);
    }
    
    updateComboDisplay() {
        const comboSection = document.getElementById('combo-section');
        const multiplierEl = document.getElementById('combo-multiplier');
        const descriptionEl = document.getElementById('combo-description');
        
        if (this.comboMultiplier > 1) {
            comboSection.style.display = 'block';
            multiplierEl.textContent = `${this.comboMultiplier}x NEXT CARD!`;
            descriptionEl.textContent = 'Special multiplier active on next event';
        } else {
            comboSection.style.display = 'none';
        }
        
        const chainSection = document.getElementById('chain-section');
        const chainCounter = document.getElementById('chain-counter');
        const chainDescription = document.getElementById('chain-description');
        
        if (this.defensiveChain > 0) {
            chainSection.style.display = 'block';
            chainCounter.textContent = `🔗 CHAIN x${this.chainMultiplier.toFixed(1)}`;
            chainDescription.textContent = `${this.defensiveChain} defensive plays in a row!`;
        } else {
            chainSection.style.display = 'none';
        }
    }
    
    endGame() {
        const baseScore = this.score;
        const cardsInHand = this.hand.length;
        
        // Calculate penalty based on actual point values of remaining cards
        const handPenalty = this.hand.reduce((total, card) => total + card.points, 0);
        
        // Calculate final score (base score minus actual card values)
        const finalScore = baseScore - handPenalty;
        this.score = finalScore;
        
        const isNewBest = finalScore > this.personalBest;
        
        this.updateStats();
        this.saveStats();
        
        // Show end game modal
        this.showEndGameModal(baseScore, cardsInHand, handPenalty, finalScore, isNewBest);
    }
    
    showEndGameModal(baseScore, cardsInHand, handPenalty, finalScore, isNewBest) {
        document.getElementById('modal-base-score').textContent = baseScore;
        
        // Show breakdown of remaining card values
        if (cardsInHand > 0) {
            const cardsList = this.hand.map(card => `${card.name} (${card.points}pts)`).join(', ');
            document.getElementById('modal-hand-penalty').textContent = `${cardsInHand} cards: ${cardsList} = -${handPenalty}`;
        } else {
            document.getElementById('modal-hand-penalty').textContent = '0 cards = 0';
        }
        
        document.getElementById('modal-final-score').textContent = finalScore;
        
        const newBestEl = document.getElementById('modal-new-best');
        newBestEl.style.display = isNewBest ? 'block' : 'none';
        
        document.getElementById('end-game-modal').style.display = 'flex';
    }
    
    closeEndGameModal() {
        document.getElementById('end-game-modal').style.display = 'none';
        this.resetGame();
        this.showScreen('welcome-screen');
    }
    
    updateStats() {
        if (this.score > this.personalBest) {
            this.personalBest = this.score;
        }
        this.gamesPlayed++;
        this.averageScore = Math.round(((this.averageScore * (this.gamesPlayed - 1)) + this.score) / this.gamesPlayed);
    }
    
    saveStats() {
        localStorage.setItem('football_best', this.personalBest.toString());
        localStorage.setItem('football_games', this.gamesPlayed.toString());
        localStorage.setItem('football_avg', this.averageScore.toString());
    }
    
    updateStatsDisplay() {
        document.getElementById('best-score').textContent = this.personalBest;
        document.getElementById('total-games').textContent = this.gamesPlayed;
        document.getElementById('avg-score').textContent = this.averageScore;
    }
    
    resetGame() {
        this.score = 0;
        this.comboMultiplier = 1;
        this.chainMultiplier = 1;
        this.cardsPlayed = 0;
        this.defensiveChain = 0;
        this.playHistory = [];
        this.discardPile = [];
        this.hasStarterDiscardCard = false;
        this.cards = this.generateCards();
        this.dealHand();
        this.updateStatsDisplay();
    }
    
    showScreen(screenId) {
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });
        document.getElementById(screenId).classList.add('active');
    }
    
    showMessage(text, type = 'info') {
        const container = document.getElementById('message-container');
        const message = document.createElement('div');
        message.className = `message message-${type}`;
        message.textContent = text;
        container.appendChild(message);
        
        setTimeout(() => {
            if (message.parentNode) {
                message.remove();
            }
        }, 4000);
    }
}

// Initialize the game when the page loads
window.addEventListener('load', () => {
    window.game = new FootballGame();
});