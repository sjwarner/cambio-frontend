import type { Card, Rank, Suit } from '../types/game';

const SUITS: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];
const RANKS: Rank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

/** Create a full 54-card deck (52 standard + 2 Jokers). */
export function createDeck(): Card[] {
  const cards: Card[] = [];
  let id = 0;

  for (const suit of SUITS) {
    for (const rank of RANKS) {
      cards.push({ id: String(id++), suit, rank });
    }
  }

  cards.push({ id: String(id++), suit: 'joker', rank: 'JOKER' });
  cards.push({ id: String(id++), suit: 'joker', rank: 'JOKER' });

  return cards;
}

/** Fisher-Yates shuffle — returns a new array. */
export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Draw `n` cards from the top of the deck; returns [drawn, remainingDeck]. */
export function drawCards(deck: Card[], n: number): [Card[], Card[]] {
  return [deck.slice(0, n), deck.slice(n)];
}
