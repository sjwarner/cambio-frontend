import type { CardRef } from '../types/game';

// ─── Action discriminated union ───────────────────────────────────────────────

export type GameAction =
  /** Player entered names on the setup screen */
  | { type: 'START_GAME'; playerNames: string[] }
  /** Player has finished memorising their bottom two cards */
  | { type: 'DONE_PEEKING' }
  /** Draw the top card from the deck */
  | { type: 'DRAW_CARD' }
  /** Current player calls Cambio instead of drawing */
  | { type: 'CALL_CAMBIO' }
  /**
   * Discard the drawn card (plays it; triggers special ability if applicable).
   * Special ability does NOT fire if the player keeps the drawn card.
   */
  | { type: 'DISCARD_DRAWN' }
  /**
   * Keep the drawn card by swapping it into hand slot `slotIndex`;
   * the card currently in that slot is discarded (no special ability).
   */
  | { type: 'SWAP_DRAWN_WITH_SLOT'; slotIndex: number }
  /**
   * Select a card ref during a special ability or sticking phase.
   * Dual-purpose: used by look-own, look-other, blind-switch steps,
   * black-king steps, stick-select, and stick-give.
   */
  | { type: 'SELECT_CARD'; ref: CardRef }
  /** Dismiss a revealed card after peeking (7/8, 9/10, black-king reveal) */
  | { type: 'DONE_VIEWING' }
  /** Black King: skip the optional switch after looking */
  | { type: 'SKIP_BK_SWITCH' }
  /**
   * A player claims the right to stick in the stick-window.
   * Only one player may stick per discard — first to claim wins.
   */
  | { type: 'CLAIM_STICK'; playerId: string }
  /** Nobody sticks — advance to the next turn */
  | { type: 'SKIP_STICK' }
  /** Clear the transient notification message */
  | { type: 'CLEAR_NOTIFICATION' };
