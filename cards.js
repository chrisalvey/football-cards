// Card deck data for football card game
const CARD_DECK = [
  // Event Cards - Things that happen in football
  {
    id: 'touchdown',
    name: 'Touchdown',
    type: 'event',
    points: 7,
    description: 'A player crosses the goal line with the ball',
    playType: null,
    quantity: 8
  },
  {
    id: 'field_goal',
    name: 'Field Goal',
    type: 'event',
    points: 3,
    description: 'Kicker successfully kicks ball through uprights',
    playType: null,
    quantity: 6
  },
  {
    id: 'safety',
    name: 'Safety',
    type: 'event',
    points: 2,
    description: 'Offensive player tackled in their own end zone',
    playType: null,
    quantity: 2
  },
  {
    id: 'interception',
    name: 'Interception',
    type: 'event',
    points: 5,
    description: 'Defense catches a pass intended for offense',
    playType: null,
    quantity: 4
  },
  {
    id: 'fumble',
    name: 'Fumble',
    type: 'event',
    points: 4,
    description: 'Player loses control of the ball',
    playType: null,
    quantity: 4
  },
  {
    id: 'sack',
    name: 'Sack',
    type: 'event',
    points: 3,
    description: 'Quarterback tackled behind line of scrimmage',
    playType: null,
    quantity: 6
  },
  {
    id: 'penalty_holding',
    name: 'Penalty - Holding',
    type: 'event',
    points: 2,
    description: 'Player illegally grabs or holds opponent',
    playType: null,
    quantity: 8
  },
  {
    id: 'penalty_false_start',
    name: 'Penalty - False Start',
    type: 'event',
    points: 2,
    description: 'Offensive player moves before snap',
    playType: null,
    quantity: 6
  },
  {
    id: 'penalty_offsides',
    name: 'Penalty - Offsides',
    type: 'event',
    points: 2,
    description: 'Player lines up on wrong side of ball',
    playType: null,
    quantity: 6
  },
  {
    id: 'first_down',
    name: 'First Down',
    type: 'event',
    points: 1,
    description: 'Team advances 10+ yards for new set of downs',
    playType: null,
    quantity: 12
  },
  {
    id: 'punt',
    name: 'Punt',
    type: 'event',
    points: 1,
    description: 'Team kicks ball to other team on 4th down',
    playType: null,
    quantity: 8
  },
  {
    id: 'timeout_called',
    name: 'Timeout Called',
    type: 'event',
    points: 1,
    description: 'Team or referee stops the clock',
    playType: null,
    quantity: 6
  },

  // Action Cards - Special abilities
  {
    id: 'steal_random_card',
    name: 'Steal Random Card',
    type: 'action',
    points: 0,
    description: 'Take 1 random card from target player',
    playType: 'immediate',
    quantity: 3
  },
  {
    id: 'swap_hands',
    name: 'Swap Hands',
    type: 'action',
    points: 0,
    description: 'Trade all cards with target player',
    playType: 'immediate',
    quantity: 2
  },
  {
    id: 'draw_from_all',
    name: 'Draw from All',
    type: 'action',
    points: 0,
    description: 'Draw 1 card from each other player',
    playType: 'immediate',
    quantity: 2
  },
  {
    id: 'double_next_score',
    name: 'Double Next Score',
    type: 'action',
    points: 0,
    description: 'Your next scored card is worth 2x points',
    playType: 'hold',
    quantity: 3
  },
  {
    id: 'block_steal',
    name: 'Block Steal',
    type: 'action',
    points: 0,
    description: 'Protects you from next steal attempt',
    playType: 'hold',
    quantity: 3
  },
  {
    id: 'peek_at_hand',
    name: 'Peek at Hand',
    type: 'action',
    points: 0,
    description: 'Look at target player\'s cards',
    playType: 'immediate',
    quantity: 2
  }
];

// Helper function to create a shuffled deck with all cards
function createDeck() {
  const deck = [];
  CARD_DECK.forEach(function(cardTemplate) {
    for (let i = 0; i < cardTemplate.quantity; i++) {
      deck.push({
        id: cardTemplate.id,
        name: cardTemplate.name,
        type: cardTemplate.type,
        points: cardTemplate.points,
        description: cardTemplate.description,
        playType: cardTemplate.playType,
        quantity: cardTemplate.quantity,
        uniqueId: cardTemplate.id + '_' + (i + 1)
      });
    }
  });
  return shuffleDeck(deck);
}

// Fisher-Yates shuffle algorithm
function shuffleDeck(deck) {
  const shuffled = deck.slice(); // Create a copy
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = shuffled[i];
    shuffled[i] = shuffled[j];
    shuffled[j] = temp;
  }
  return shuffled;
}

// Helper function to get card by ID
function getCardById(id) {
  for (let i = 0; i < CARD_DECK.length; i++) {
    if (CARD_DECK[i].id === id) {
      return CARD_DECK[i];
    }
  }
  return null;
}