import { useState } from 'react';
import type { Player } from '../types/game';
import PlayerHand from './PlayerHand';
import styles from './PeekView.module.css';

interface Props {
  player: Player;
  playerIndex: number;
  totalPlayers: number;
  onDone: () => void;
  /** Online mode: skip the "look away" shield and go straight to the cards. */
  skipShield?: boolean;
}

/**
 * Initial-peek screen.
 *
 * Local mode: shows a shield phase ("others look away") before revealing cards.
 * Online mode (skipShield): goes straight to the cards — each player is on
 * their own device so no shielding is needed.
 */
export default function PeekView({ player, playerIndex, totalPlayers, onDone, skipShield }: Props) {
  const [revealed, setRevealed] = useState(skipShield ?? false);

  return (
    <div className={styles.overlay}>
      <div className={styles.inner}>
        {!revealed ? (
          <>
            <div className={styles.icon}>👀</div>
            <h2 className={styles.heading}>
              {player.name}, get ready to peek
            </h2>
            <p className={styles.sub}>
              Everyone else: look away from the screen for a moment.
            </p>
            <p className={styles.counter}>
              Player {playerIndex + 1} of {totalPlayers}
            </p>
            <button className={styles.btn} onClick={() => setRevealed(true)}>
              Show my cards
            </button>
          </>
        ) : (
          <>
            <h2 className={styles.heading}>
              Memorise your two nearest cards, {player.name}
            </h2>
            <p className={styles.sub}>
              You won't see them again unless you earn a peek.
            </p>

            <PlayerHand
              player={player}
              revealedSlots={new Set([2, 3])}
              showLabel={false}
            />

            <button className={styles.btn} onClick={onDone}>
              Got it — hide them
            </button>
          </>
        )}
      </div>
    </div>
  );
}
