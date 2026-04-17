import type { GameAction } from './actions';
import type { Card, CardRef, GameState, Player, SpecialState, SnapState } from '../types/game';
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
  snap: null,
  cambioCallerId: null,
  turnsLeftAfterCambio: 0,
  scores: [],
  winnerId: null,
  notification: null,
  lastActionRefs: [],
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

function buildEligibleIds(players: Player[]): string[] {
  return players.map((p) => p.id);
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
    snap: null,
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
      phase: 'turn-idle',
      currentPlayerIndex: nextIndex,
      drawnCard: null,
      special: null,
      snap: null,
      lastActionRefs: [],
      turnsLeftAfterCambio: remaining,
    };
  }

  return {
    ...state,
    phase: 'turn-idle',
    currentPlayerIndex: nextIndex,
    drawnCard: null,
    special: null,
    snap: null,
    lastActionRefs: [],
  };
}

/** Open the shared snap window after a discard. All players are eligible. */
function beginSnapPhase(state: GameState, discarderId: string): GameState {
  const eligibleIds = buildEligibleIds(state.players);
  const snap: SnapState = {
    eligibleIds,
    discarderId,
    claimedBy: null,
    targetRef: null,
    passedIds: [],
  };
  return { ...state, phase: 'snap-window', snap, special: null };
}

function afterSpecial(state: GameState): GameState {
  const discarderId = state.players[state.currentPlayerIndex].id;
  return beginSnapPhase({ ...state, special: null }, discarderId);
}

// ─── Reducer ──────────────────────────────────────────────────────────────────

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {

    // ── Setup ────────────────────────────────────────────────────────────────
    case 'START_GAME': {
      const deck = shuffle(createDeck());
      const playerCount = action.playerNames.length;
      const [dealt, rest] = drawCards(deck, playerCount * 4);

      const players: Player[] = action.playerNames.map((name, i) => ({
        id: `player-${i}`,
        name,
        hand: dealt.slice(i * 4, i * 4 + 4) as Card[],
      }));

      return {
        ...INITIAL_STATE,
        phase: 'peek-view',
        players,
        deck: rest,
        discardPile: [],
        peekPlayerIndex: 0,
      };
    }

    // ── Peek phase ───────────────────────────────────────────────────────────
    case 'DONE_PEEKING': {
      const nextPeek = state.peekPlayerIndex + 1;
      if (nextPeek >= state.players.length) {
        return { ...state, phase: 'turn-idle', currentPlayerIndex: 0, peekPlayerIndex: 0 };
      }
      return { ...state, phase: 'peek-view', peekPlayerIndex: nextPeek };
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
        phase: 'turn-idle',
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

      if (!ability) return beginSnapPhase(base, discarderId);

      const special: SpecialState = { type: ability, firstRef: null, revealedCard: null };
      const phaseMap: Record<string, GameState['phase']> = {
        '7-8': 'special-look-own',
        '9-10': 'special-look-other',
        'j-q': 'special-blind-1',
        'black-king': 'special-bk-look',
      };
      return { ...base, phase: phaseMap[ability], special };
    }

    // ── Player hides drawn card before picking swap slot ──────────────────────
    case 'HIDE_DRAWN_CARD': {
      if (state.phase !== 'turn-drawn') return state;
      return { ...state, phase: 'turn-drawn-selecting' };
    }

    // ── Keep drawn card: swap into hand slot ──────────────────────────────────
    case 'SWAP_DRAWN_WITH_SLOT': {
      if (!state.drawnCard) return state;
      const cp = state.players[state.currentPlayerIndex];
      const handCard = cp.hand[action.slotIndex];
      if (!handCard) return state;

      const discardPile = [handCard, ...state.discardPile];
      const players = setCard(state.players, cp.id, action.slotIndex, state.drawnCard);
      const lastActionRefs = [{ playerId: cp.id, slotIndex: action.slotIndex }];
      return beginSnapPhase({ ...state, players, discardPile, drawnCard: null, lastActionRefs }, cp.id);
    }

    // ── Card selection (multi-purpose) ────────────────────────────────────────
    case 'SELECT_CARD': {
      const { ref } = action;
      const currentId = state.players[state.currentPlayerIndex].id;

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

      if (state.phase === 'special-blind-1') {
        const card = state.players.find((p) => p.id === ref.playerId)?.hand[ref.slotIndex];
        if (!card) return state;
        return {
          ...state,
          phase: 'special-blind-2',
          special: { ...state.special!, firstRef: ref },
        };
      }

      if (state.phase === 'special-blind-2') {
        const first = state.special?.firstRef;
        if (!first) return state;
        if (ref.playerId === first.playerId && ref.slotIndex === first.slotIndex) return state;
        const players = swapCards(state.players, first, ref);
        return afterSpecial({ ...state, players, lastActionRefs: [first, ref] });
      }

      if (state.phase === 'special-bk-look') {
        const card = state.players.find((p) => p.id === ref.playerId)?.hand[ref.slotIndex];
        if (!card) return state;
        return {
          ...state,
          phase: 'special-bk-reveal',
          special: { ...state.special!, firstRef: ref, revealedCard: card },
        };
      }

      if (state.phase === 'special-bk-switch') {
        if (ref.playerId !== currentId) return state;
        const lookedRef = state.special?.firstRef;
        if (!lookedRef) return state;
        if (ref.playerId === lookedRef.playerId && ref.slotIndex === lookedRef.slotIndex) return state;
        const players = swapCards(state.players, lookedRef, ref);
        return afterSpecial({ ...state, players, lastActionRefs: [lookedRef, ref] });
      }

      // ── snap-select ───────────────────────────────────────────────────────
      if (state.phase === 'snap-select') {
        if (!state.snap?.claimedBy) return state;
        const snapperId = state.snap.claimedBy;
        const topDiscard = state.discardPile[0];
        if (!topDiscard) return state;

        const targetPlayer = state.players.find((p) => p.id === ref.playerId);
        const selectedCard = targetPlayer?.hand[ref.slotIndex];
        if (!selectedCard) return state;

        const isOwnCard = ref.playerId === snapperId;
        const rankMatch = selectedCard.rank === topDiscard.rank;
        const snapperName = state.players.find((p) => p.id === snapperId)?.name ?? '';

        if (rankMatch) {
          const discardPile = [selectedCard, ...state.discardPile];
          const players = setCard(state.players, ref.playerId, ref.slotIndex, null);

          if (isOwnCard) {
            return advanceToNextTurn({
              ...state,
              players,
              discardPile,
              snap: null,
              notification: `${snapperName} snapped a ${selectedCard.rank}!`,
            });
          } else {
            // Cross-player: snapper must give a card to the target player
            return {
              ...state,
              players,
              discardPile,
              snap: { ...state.snap!, targetRef: ref },
              phase: 'snap-give',
              notification: `${snapperName} snapped ${targetPlayer?.name}'s card! Choose a card to give them.`,
            };
          }
        } else {
          // Wrong — penalty
          const penaltyState = dealPenalty(state, snapperId);
          return advanceToNextTurn({
            ...penaltyState,
            snap: null,
            notification: `Wrong! ${snapperName} receives a penalty card.`,
          });
        }
      }

      // ── snap-give ─────────────────────────────────────────────────────────
      if (state.phase === 'snap-give') {
        if (!state.snap?.claimedBy) return state;
        const snapperId = state.snap.claimedBy;
        if (ref.playerId !== snapperId) return state;
        const giveCard = state.players.find((p) => p.id === snapperId)?.hand[ref.slotIndex];
        if (!giveCard) return state;
        const targetPlayerId = state.snap.targetRef?.playerId;
        if (!targetPlayerId) return state;

        let players = setCard(state.players, snapperId, ref.slotIndex, null);
        players = players.map((p) => {
          if (p.id !== targetPlayerId) return p;
          return { ...p, hand: [...p.hand, giveCard] };
        });
        return advanceToNextTurn({ ...state, players, snap: null, notification: null });
      }

      return state;
    }

    // ── Done viewing a revealed card ──────────────────────────────────────────
    case 'DONE_VIEWING': {
      if (state.phase === 'special-peek-reveal') {
        return afterSpecial({ ...state, special: { ...state.special!, revealedCard: null } });
      }
      if (state.phase === 'special-bk-reveal') {
        return { ...state, phase: 'special-bk-switch' };
      }
      return state;
    }

    case 'SKIP_BK_SWITCH': {
      return afterSpecial(state);
    }

    // ── Snapping: a player claims the window ──────────────────────────────────
    case 'CLAIM_SNAP': {
      if (state.phase !== 'snap-window' || !state.snap) return state;
      if (!state.snap.eligibleIds.includes(action.playerId)) return state;
      return {
        ...state,
        phase: 'snap-select',
        snap: { ...state.snap, claimedBy: action.playerId },
      };
    }

    // ── Snapping: a player passes on the snap window ──────────────────────────
    case 'SKIP_SNAP': {
      if (state.phase !== 'snap-window' || !state.snap) return state;

      // Local mode (no playerId): close immediately.
      if (!action.playerId) {
        return advanceToNextTurn({ ...state, snap: null });
      }

      // Online mode: record this player's pass; advance only when everyone has passed.
      const passedIds = state.snap.passedIds.includes(action.playerId)
        ? state.snap.passedIds
        : [...state.snap.passedIds, action.playerId];

      const allPassed = state.snap.eligibleIds.every((id) => passedIds.includes(id));
      if (allPassed) {
        return advanceToNextTurn({ ...state, snap: null });
      }
      return { ...state, snap: { ...state.snap, passedIds } };
    }

    case 'CLEAR_NOTIFICATION':
      return { ...state, notification: null };

    default:
      return state;
  }
}
