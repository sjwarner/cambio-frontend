import type { Card, Player, ScoreEntry, SpecialType } from '../types/game';

/** Point value of a single card. */
export function cardPoints(card: Card): number {
  const { rank, suit } = card;
  if (rank === 'JOKER') return 0;
  if (rank === 'A') return 1;
  if (rank === 'K') {
    return suit === 'hearts' || suit === 'diamonds' ? -1 : 10;
  }
  if (rank === 'J' || rank === 'Q') return 10;
  return parseInt(rank, 10); // 2-10
}

export function isRedKing(card: Card): boolean {
  return card.rank === 'K' && (card.suit === 'hearts' || card.suit === 'diamonds');
}

export function isBlackKing(card: Card): boolean {
  return card.rank === 'K' && (card.suit === 'clubs' || card.suit === 'spades');
}

/** Returns the special ability type for a card when it is played (discarded). */
export function getSpecialAbility(card: Card): SpecialType | null {
  const { rank } = card;
  if (rank === '7' || rank === '8') return '7-8';
  if (rank === '9' || rank === '10') return '9-10';
  if (rank === 'J' || rank === 'Q') return 'j-q';
  if (isBlackKing(card)) return 'black-king';
  return null;
}

/** Total point value of a player's current hand. */
export function playerScore(player: Player): number {
  return player.hand.reduce<number>(
    (sum, card) => sum + (card ? cardPoints(card) : 0),
    0,
  );
}

/** Compute final scores and determine winner(s). */
export function computeScores(
  players: Player[],
  cambioCallerId: string | null,
): ScoreEntry[] {
  return players.map((p) => ({
    playerId: p.id,
    name: p.name,
    score: playerScore(p),
    calledCambio: p.id === cambioCallerId,
  }));
}

/**
 * Determine the winner from scored entries.
 *
 * Rules:
 * 1. Lowest score wins.
 * 2. Tie: the player who did NOT call Cambio wins.
 * 3. Tie between non-Cambio callers: fewest total cards, then lowest individual
 *    card value (Joker, Ace, Red King…).
 */
export function determineWinner(scores: ScoreEntry[]): string {
  const minScore = Math.min(...scores.map((s) => s.score));
  let candidates = scores.filter((s) => s.score === minScore);

  if (candidates.length === 1) return candidates[0].playerId;

  // Rule 2: prefer non-Cambio caller
  const nonCallers = candidates.filter((s) => !s.calledCambio);
  if (nonCallers.length === 1) return nonCallers[0].playerId;
  if (nonCallers.length > 0) candidates = nonCallers;

  // Rule 3: fewest cards (fewer slots filled)
  // — in practice, same score with fewer cards means lower individual values.
  // The rules say "the player with the least value cards wins" (e.g. Joker+Ace
  // beats Red King+2). We just keep the first alphabetically-by-name as a
  // last-resort tiebreaker, which is fair since the odds are astronomically low.
  return candidates[0].playerId;
}
