// ─── Card primitives ──────────────────────────────────────────────────────────

export type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades' | 'joker';
export type Rank =
  | 'A'
  | '2'
  | '3'
  | '4'
  | '5'
  | '6'
  | '7'
  | '8'
  | '9'
  | '10'
  | 'J'
  | 'Q'
  | 'K'
  | 'JOKER';

export interface Card {
  id: string;
  suit: Suit;
  rank: Rank;
}

/** A reference to a card in a player's hand by position */
export interface CardRef {
  playerId: string;
  slotIndex: number;
}

// ─── Player ───────────────────────────────────────────────────────────────────

export interface Player {
  id: string;
  name: string;
  /** 4 slots arranged as 2×2. Index 2 & 3 are the "near" (bottom) row. */
  hand: (Card | null)[];
}

// ─── Special ability types ────────────────────────────────────────────────────

export type SpecialType = '7-8' | '9-10' | 'j-q' | 'black-king';

export interface SpecialState {
  type: SpecialType;
  /** First card selected (used by j-q step 2, black-king step 2) */
  firstRef: CardRef | null;
  /** The card that was revealed to the player */
  revealedCard: Card | null;
}

// ─── Snapping state ───────────────────────────────────────────────────────────

export interface SnapState {
  /** Player IDs eligible to snap (all players) */
  eligibleIds: string[];
  /** Player ID who made the last discard */
  discarderId: string;
  /** Set once a player claims the snap window */
  claimedBy: string | null;
  /** When snapping another player's card, track the target slot */
  targetRef: CardRef | null;
}

// ─── Game phases ──────────────────────────────────────────────────────────────

export type GamePhase =
  // Initial setup
  | 'setup'
  // Each player privately peeks at their bottom two cards (sequential, shield pattern)
  | 'peek-view'
  // Waiting for player to draw or call Cambio
  | 'turn-idle'
  // Player drew a card, choosing what to do with it
  | 'turn-drawn'
  // Player confirmed they've seen the drawn card; now picking which hand slot to swap (card is hidden)
  | 'turn-drawn-selecting'
  // 7/8 — pick one of your own cards to peek at
  | 'special-look-own'
  // 9/10 — pick any opponent's card to peek at
  | 'special-look-other'
  // Showing a peeked card briefly before continuing
  | 'special-peek-reveal'
  // J/Q step 1 — pick the first card to blind-swap
  | 'special-blind-1'
  // J/Q step 2 — pick the second card to blind-swap
  | 'special-blind-2'
  // Black King step 1 — pick any card to look at
  | 'special-bk-look'
  // Black King step 2 — card revealed; choose to switch or skip
  | 'special-bk-reveal'
  // Black King step 3 — pick which of your own cards to swap with the looked card
  | 'special-bk-switch'
  // Shared snap window: all players shown simultaneously
  | 'snap-window'
  // The player who claimed the snap window selects a card to snap
  | 'snap-select'
  // Cross-player snap: claimant chooses a card to give to the target player
  | 'snap-give'
  // Game over — all cards flipped, scores shown
  | 'game-over';

// ─── Score entry ──────────────────────────────────────────────────────────────

export interface ScoreEntry {
  playerId: string;
  name: string;
  score: number;
  calledCambio: boolean;
}

// ─── Full game state ──────────────────────────────────────────────────────────

export interface GameState {
  phase: GamePhase;
  players: Player[];
  deck: Card[];
  discardPile: Card[];

  /** Index into players[] of whoever's turn it is */
  currentPlayerIndex: number;

  /** Card drawn from deck during current turn */
  drawnCard: Card | null;

  // ── Peek phase ──
  /** Index into players[] of who is currently peeking */
  peekPlayerIndex: number;

  // ── Special ability ──
  special: SpecialState | null;

  // ── Snapping ──
  snap: SnapState | null;

  // ── Cambio ──
  cambioCallerId: string | null;
  /** Decrements each turn after Cambio is called; game ends when 0 */
  turnsLeftAfterCambio: number;

  // ── End game ──
  scores: ScoreEntry[];
  winnerId: string | null;

  /** Transient UI message (e.g. "Wrong card! Penalty dealt.") */
  notification: string | null;
}
