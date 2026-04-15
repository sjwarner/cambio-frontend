import { GameAction } from './actions';
import { Card, CardRef, GameState, Player, SpecialState, StickState } from '../types/game';
import { createDeck, drawCards, shuffle } from '../utils/deck';
import { computeScores, determineWinner, getSpecialAbility } from '../utils/scoring';

// ─── Initial state ────────────────────────────────────────────────────────────

export const INITIAL_STATE: GameState = {
  phase: 'setup',
  players: [],
  deck: [],
  discardPile: [],
  currentPlayerIndex: 0,
  drawnCard: null,
  peekPlayerIndex: 0,
  special: null,
  stick: null,
  cambioCallerId: null,
  turnsLeftAfterCambio: 0,
  scores: [],
  winnerId: null,
  notification: null,
};

// ─── Pure helpers ─────────────────────────────────────────────────────────────

function nextPlayerIndex(state: GameState): number {
  return (state.currentPlayerIndex + 1) % state.players.length;
}

function setCard(
  players: Player[],
  playerId: string,
  slotIndex: number,
  card: Card | null,
): Player[] {
  return players.map((p) => {
    if (p.id !== playerId) return p;
    const hand = [...p.hand];
    hand[slotIndex] = card;
    return { ...p, hand };
  });
}

function swapCards(players: Player[], a: CardRef, b: CardRef): Player[] {
  const cardA = players.find((p) => p.id === a.playerId)?.hand[a.slotIndex] ?? null;
  const cardB = players.find((p) => p.id === b.playerId)?.hand[b.slotIndex] ?? null;
  let next = setCard(players, a.playerId, a.slotIndex, cardB);
  next = setCard(next, b.playerId, b.slotIndex, cardA);
  return next;
}

function dealPenalty(state: GameState, playerId: string): GameState {
  if (state.deck.length === 0) return state;
  const [drawn, deck] = drawCards(state.deck, 1);
  const players = state.players.map((p) => {
    if (p.id !== playerId) return p;
    return { ...p, hand: [...p.hand, drawn[0]] };
  });
  return { ...state, players, deck };
}

function buildStickCheckOrder(players: Player[], discarderId: string): string[] {
  return players.filter((p) => p.id !== discarderId).map((p) => p.id);
}

function endGame(state: GameState): GameState {
  const scores = computeScores(state.players, state.cambioCallerId);
  const winnerId = determineWinner(scores);
  return {
    ...state,
    phase: 'game-over',
    scores,
    winnerId,
    drawnCard: null,
    special: null,
    stick: null,
  };
}

function advanceToNextTurn(state: GameState): GameState {
  const nextIndex = nextPlayerIndex(state);

  if (state.cambioCallerId !== null) {
    const remaining = state.turnsLeftAfterCambio - 1;
    if (remaining <= 0) {
      return endGame({ ...state, currentPlayerIndex: nextIndex });
    }
    return {
      ...state,
      phase: 'turn-pass',
      currentPlayerIndex: nextIndex,
      drawnCard: null,
      special: null,
      stick: null,
      turnsLeftAfterCambio: remaining,
    };
  }

  return {
    ...state,
    phase: 'turn-pass',
    currentPlayerIndex: nextIndex,
    drawnCard: null,
    special: null,
    stick: null,
  };
}

function beginStickPhase(state: GameState, discarderId: string): GameState {
  const checkOrder = buildStickCheckOrder(state.players, discarderId);
  if (checkOrder.length === 0) {
    return advanceToNextTurn(state);
  }
  const stick: StickState = { checkOrder, checkIndex: 0, discarderId, targetRef: null };
  return { ...state, phase: 'stick-pass', stick, special: null };
}

function afterSpecial(state: GameState): GameState {
  const discarderId = state.players[state.currentPlayerIndex].id;
  return beginStickPhase({ ...state, special: null }, discarderId);
}

function advanceStickCheck(state: GameState): GameState {
  if (!state.stick) return advanceToNextTurn(state);
  const { checkOrder, checkIndex } = state.stick;
  if (checkIndex >= checkOrder.length) {
    return advanceToNextTurn(state);
  }
  return { ...state, phase: 'stick-pass' };
}

// ─── Reducer ──────────────────────────────────────────────────────────────────

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {

    // ── Setup ────────────────────────────────────────────────────────────────
    case 'START_GAME': {
      const deck = shuffle(createDeck());
      const playerCount = action.playerNames.length;
      const [dealt, rest] = drawCards(deck, playerCount * 4);
      const [firstDiscard, finalDeck] = drawCards(rest, 1);

      const players: Player[] = action.playerNames.map((name, i) => ({
        id: `player-${i}`,
        name,
        hand: dealt.slice(i * 4, i * 4 + 4) as Card[],
      }));

      return {
        ...INITIAL_STATE,
        phase: 'peek-pass',
        players,
        deck: finalDeck,
        discardPile: firstDiscard,
        peekPlayerIndex: 0,
      };
    }

    // ── Universal "pass device" confirmation ──────────────────────────────────
    case 'CONFIRM_PASS': {
      if (state.phase === 'peek-pass') return { ...state, phase: 'peek-view' };
      if (state.phase === 'turn-pass') return { ...state, phase: 'turn-idle' };
      if (state.phase === 'stick-pass') return { ...state, phase: 'stick-offer' };
      return state;
    }

    // ── Peek phase ───────────────────────────────────────────────────────────
    case 'DONE_PEEKING': {
      const nextPeek = state.peekPlayerIndex + 1;
      if (nextPeek >= state.players.length) {
        return { ...state, phase: 'turn-pass', currentPlayerIndex: 0, peekPlayerIndex: 0 };
      }
      return { ...state, phase: 'peek-pass', peekPlayerIndex: nextPeek };
    }

    // ── Drawing ──────────────────────────────────────────────────────────────
    case 'DRAW_CARD': {
      if (state.deck.length === 0) return state;
      const [drawn, deck] = drawCards(state.deck, 1);
      return { ...state, drawnCard: drawn[0], deck, phase: 'turn-drawn' };
    }

    case 'CALL_CAMBIO': {
      if (state.cambioCallerId !== null) return state;
      const callerId = state.players[state.currentPlayerIndex].id;
      const othersCount = state.players.length - 1;
      if (othersCount <= 0) {
        return endGame({ ...state, cambioCallerId: callerId });
      }
      return {
        ...state,
        phase: 'turn-pass',
        cambioCallerId: callerId,
        turnsLeftAfterCambio: othersCount,
        currentPlayerIndex: nextPlayerIndex(state),
        drawnCard: null,
      };
    }

    // ── Discard drawn card (may trigger special) ──────────────────────────────
    case 'DISCARD_DRAWN': {
      if (!state.drawnCard) return state;
      const card = state.drawnCard;
      const discardPile = [card, ...state.discardPile];
      const discarderId = state.players[state.currentPlayerIndex].id;
      const base = { ...state, drawnCard: null, discardPile };
      const ability = getSpecialAbility(card);

      if (!ability) return beginStickPhase(base, discarderId);

      const special: SpecialState = { type: ability, firstRef: null, revealedCard: null };
      const phaseMap: Record<string, GameState['phase']> = {
        '7-8': 'special-look-own',
        '9-10': 'special-look-other',
        'j-q': 'special-blind-1',
        'black-king': 'special-bk-look',
      };
      return { ...base, phase: phaseMap[ability], special };
    }

    // ── Keep drawn card: swap into hand slot ──────────────────────────────────
    case 'SWAP_DRAWN_WITH_SLOT': {
      if (!state.drawnCard) return state;
      const cp = state.players[state.currentPlayerIndex];
      const handCard = cp.hand[action.slotIndex];
      if (!handCard) return state;

      const discardPile = [handCard, ...state.discardPile];
      const players = setCard(state.players, cp.id, action.slotIndex, state.drawnCard);
      return beginStickPhase({ ...state, players, discardPile, drawnCard: null }, cp.id);
    }

    // ── Card selection (multi-purpose) ────────────────────────────────────────
    case 'SELECT_CARD': {
      const { ref } = action;
      const currentId = state.players[state.currentPlayerIndex].id;

      // ── 7/8: look at own card ─────────────────────────────────────────────
      if (state.phase === 'special-look-own') {
        if (ref.playerId !== currentId) return state;
        const card = state.players.find((p) => p.id === ref.playerId)?.hand[ref.slotIndex];
        if (!card) return state;
        return {
          ...state,
          phase: 'special-peek-reveal',
          special: { ...state.special!, firstRef: ref, revealedCard: card },
        };
      }

      // ── 9/10: look at opponent card ───────────────────────────────────────
      if (state.phase === 'special-look-other') {
        if (ref.playerId === currentId) return state;
        const card = state.players.find((p) => p.id === ref.playerId)?.hand[ref.slotIndex];
        if (!card) return state;
        return {
          ...state,
          phase: 'special-peek-reveal',
          special: { ...state.special!, firstRef: ref, revealedCard: card },
        };
      }

      // ── J/Q blind switch step 1 ───────────────────────────────────────────
      if (state.phase === 'special-blind-1') {
        const card = state.players.find((p) => p.id === ref.playerId)?.hand[ref.slotIndex];
        if (!card) return state;
        return {
          ...state,
          phase: 'special-blind-2',
          special: { ...state.special!, firstRef: ref },
        };
      }

      // ── J/Q blind switch step 2 ───────────────────────────────────────────
      if (state.phase === 'special-blind-2') {
        const first = state.special?.firstRef;
        if (!first) return state;
        if (ref.playerId === first.playerId && ref.slotIndex === first.slotIndex) return state;
        const players = swapCards(state.players, first, ref);
        return afterSpecial({ ...state, players });
      }

      // ── Black King: look at any card ──────────────────────────────────────
      if (state.phase === 'special-bk-look') {
        const card = state.players.find((p) => p.id === ref.playerId)?.hand[ref.slotIndex];
        if (!card) return state;
        return {
          ...state,
          phase: 'special-bk-reveal',
          special: { ...state.special!, firstRef: ref, revealedCard: card },
        };
      }

      // ── Black King: pick own card to swap with looked card ────────────────
      if (state.phase === 'special-bk-switch') {
        if (ref.playerId !== currentId) return state;
        const lookedRef = state.special?.firstRef;
        if (!lookedRef) return state;
        if (ref.playerId === lookedRef.playerId && ref.slotIndex === lookedRef.slotIndex) return state;
        const players = swapCards(state.players, lookedRef, ref);
        return afterSpecial({ ...state, players });
      }

      // ── Stick select ──────────────────────────────────────────────────────
      if (state.phase === 'stick-select') {
        if (!state.stick) return state;
        const stickerId = state.stick.checkOrder[state.stick.checkIndex];
        const topDiscard = state.discardPile[0];
        if (!topDiscard) return state;

        const targetPlayer = state.players.find((p) => p.id === ref.playerId);
        const selectedCard = targetPlayer?.hand[ref.slotIndex];
        if (!selectedCard) return state;

        const isOwnCard = ref.playerId === stickerId;
        const rankMatch = selectedCard.rank === topDiscard.rank;

        if (rankMatch) {
          const discardPile = [selectedCard, ...state.discardPile];
          const players = setCard(state.players, ref.playerId, ref.slotIndex, null);
          const stickerName = state.players.find((p) => p.id === stickerId)?.name ?? '';

          if (isOwnCard) {
            const stick = { ...state.stick, checkIndex: state.stick.checkIndex + 1, targetRef: null };
            return advanceStickCheck({
              ...state,
              players,
              discardPile,
              stick,
              notification: `${stickerName} stuck a ${selectedCard.rank}!`,
            });
          } else {
            // Cross-player: sticker now chooses a card to give away
            const stick = { ...state.stick, targetRef: ref };
            return {
              ...state,
              players,
              discardPile,
              stick,
              phase: 'stick-give',
              notification: `${stickerName} stuck ${targetPlayer?.name}'s card! Choose a card to give them.`,
            };
          }
        } else {
          // Wrong — penalty
          let next = dealPenalty(state, stickerId);
          const stickerName = state.players.find((p) => p.id === stickerId)?.name ?? '';
          const stick = { ...state.stick, checkIndex: state.stick.checkIndex + 1, targetRef: null };
          next = { ...next, stick, notification: `Wrong! ${stickerName} receives a penalty card.` };
          return advanceStickCheck(next);
        }
      }

      // ── Stick give (cross-player: give one of your cards to target) ────────
      if (state.phase === 'stick-give') {
        if (!state.stick) return state;
        const stickerId = state.stick.checkOrder[state.stick.checkIndex];
        if (ref.playerId !== stickerId) return state;
        const giveCard = state.players.find((p) => p.id === stickerId)?.hand[ref.slotIndex];
        if (!giveCard) return state;
        const targetPlayerId = state.stick.targetRef?.playerId;
        if (!targetPlayerId) return state;

        let players = setCard(state.players, stickerId, ref.slotIndex, null);
        players = players.map((p) => {
          if (p.id !== targetPlayerId) return p;
          return { ...p, hand: [...p.hand, giveCard] };
        });
        const stick = { ...state.stick, checkIndex: state.stick.checkIndex + 1, targetRef: null };
        return advanceStickCheck({ ...state, players, stick, notification: null });
      }

      return state;
    }

    // ── Done viewing a revealed card ──────────────────────────────────────────
    case 'DONE_VIEWING': {
      if (state.phase === 'special-peek-reveal') {
        return afterSpecial({ ...state, special: { ...state.special!, revealedCard: null } });
      }
      if (state.phase === 'special-bk-reveal') {
        // Move to switch step — special.revealedCard kept for display
        return { ...state, phase: 'special-bk-switch' };
      }
      return state;
    }

    // ── Black King: skip switch after looking ─────────────────────────────────
    case 'SKIP_BK_SWITCH': {
      return afterSpecial(state);
    }

    // ── Sticking: player responds ─────────────────────────────────────────────
    case 'STICK_RESPONSE': {
      if (!state.stick) return state;
      if (!action.wants) {
        const stick = { ...state.stick, checkIndex: state.stick.checkIndex + 1, targetRef: null };
        return advanceStickCheck({ ...state, stick });
      }
      return { ...state, phase: 'stick-select' };
    }

    case 'CLEAR_NOTIFICATION':
      return { ...state, notification: null };

    default:
      return state;
  }
}
