import type { Player } from '../types/game';
import PlayerHand from './PlayerHand';
import styles from './PeekView.module.css';

interface Props {
  player: Player;
  onDone: () => void;
}

/** The peek phase: show the player their 2 bottom (near) cards, let them memorise, then hide. */
export default function PeekView({ player, onDone }: Props) {
  // Slots 2 and 3 are the bottom row — the cards closest to the player.
  const revealed = new Set([2, 3]);

  return (
    <div className={styles.overlay}>
      <div className={styles.inner}>
        <h2 className={styles.heading}>Memorise your cards, {player.name}</h2>
        <p className={styles.sub}>These two are yours. Remember them — you won't see them again unless you earn a peek.</p>

        <PlayerHand
          player={player}
          revealedSlots={revealed}
          showLabel={false}
        />

        <button className={styles.btn} onClick={onDone}>
          Got it, hide them
        </button>
      </div>
    </div>
  );
}
