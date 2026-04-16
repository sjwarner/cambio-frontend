import type { Card as CardType, CardRef, Player } from '../types/game';
import Card from './Card';
import styles from './PlayerHand.module.css';

interface Props {
  player: Player;
  /** Slots currently revealed (shown face-up) */
  revealedSlots?: Set<number>;
  /** Slots that are clickable */
  selectableSlots?: Set<number>;
  /** Slot indices currently selected (amber glow — active selection) */
  selectedSlots?: Set<number>;
  /** Slot indices to highlight in green (e.g. just-swapped) */
  highlightedSlots?: Set<number>;
  onSelectSlot?: (ref: CardRef) => void;
  /** Show player name label */
  showLabel?: boolean;
  /** Compact view (for opponents) */
  compact?: boolean;
}

export default function PlayerHand({
  player,
  revealedSlots = new Set(),
  selectableSlots = new Set(),
  selectedSlots = new Set(),
  highlightedSlots = new Set(),
  onSelectSlot,
  showLabel = true,
  compact = false,
}: Props) {
  // hand may be longer than 4 if penalties have been dealt
  const rows = buildRows(player.hand);

  return (
    <div className={`${styles.wrapper} ${compact ? styles.compact : ''}`}>
      {showLabel && (
        <div className={styles.label}>
          <span>{player.name}</span>
          <span className={styles.cardCount}>{player.hand.filter(Boolean).length} cards</span>
        </div>
      )}
      <div className={styles.grid}>
        {rows.map((row, rowIdx) =>
          row.map((card, colIdx) => {
            const slotIndex = rowIdx * 2 + colIdx;
            const faceUp = revealedSlots.has(slotIndex);
            const selectable = selectableSlots.has(slotIndex) && card !== null;
            const selected = selectedSlots.has(slotIndex);
            const highlighted = highlightedSlots.has(slotIndex);

            return (
              <Card
                key={slotIndex}
                card={card}
                faceUp={faceUp}
                selectable={selectable}
                selected={selected}
                highlighted={highlighted}
                onClick={() =>
                  onSelectSlot?.({ playerId: player.id, slotIndex })
                }
              />
            );
          }),
        )}
      </div>
    </div>
  );
}

/** Split flat hand array into rows of 2 */
function buildRows(hand: (CardType | null)[]): (CardType | null)[][] {
  const rows: (CardType | null)[][] = [];
  for (let i = 0; i < hand.length; i += 2) {
    rows.push([hand[i] ?? null, hand[i + 1] ?? null]);
  }
  return rows;
}
