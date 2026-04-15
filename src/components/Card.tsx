import type { Card as CardType } from '../types/game';
import { cardPoints } from '../utils/scoring';
import styles from './Card.module.css';

interface Props {
  card: CardType | null;
  faceUp?: boolean;
  selected?: boolean;
  selectable?: boolean;
  dimmed?: boolean;
  onClick?: () => void;
  label?: string; // aria-label override
}

const SUIT_SYMBOL: Record<string, string> = {
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
  spades: '♠',
  joker: '★',
};

const SUIT_CLASS: Record<string, string> = {
  hearts: styles.red,
  diamonds: styles.red,
  clubs: styles.black,
  spades: styles.black,
  joker: styles.joker,
};

export default function Card({
  card,
  faceUp = false,
  selected = false,
  selectable = false,
  dimmed = false,
  onClick,
  label,
}: Props) {
  if (!card) {
    return <div className={`${styles.card} ${styles.empty}`} aria-hidden="true" />;
  }

  const isJoker = card.rank === 'JOKER';
  const suitSymbol = SUIT_SYMBOL[card.suit] ?? '?';
  const suitClass = SUIT_CLASS[card.suit] ?? '';
  const pts = cardPoints(card);

  const classNames = [
    styles.card,
    faceUp ? styles.faceUp : styles.faceDown,
    selected ? styles.selected : '',
    selectable ? styles.selectable : '',
    dimmed ? styles.dimmed : '',
    faceUp ? suitClass : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      className={classNames}
      onClick={selectable ? onClick : undefined}
      disabled={!selectable}
      aria-label={
        label ??
        (faceUp
          ? `${card.rank} of ${card.suit}${isJoker ? '' : ` (${pts >= 0 ? '+' : ''}${pts}pts)`}`
          : 'Face-down card')
      }
      aria-pressed={selected}
    >
      {faceUp ? (
        <>
          <span className={styles.corner}>
            <span className={styles.rank}>{isJoker ? '★' : card.rank}</span>
            <span className={styles.suit}>{suitSymbol}</span>
          </span>
          <span className={styles.center}>
            {isJoker ? (
              <span className={styles.jokerLabel}>JOKER</span>
            ) : (
              <span className={styles.suitLarge}>{suitSymbol}</span>
            )}
          </span>
          <span className={`${styles.corner} ${styles.cornerBottom}`}>
            <span className={styles.rank}>{isJoker ? '★' : card.rank}</span>
            <span className={styles.suit}>{suitSymbol}</span>
          </span>
        </>
      ) : (
        <span className={styles.backPattern} aria-hidden="true" />
      )}
    </button>
  );
}
