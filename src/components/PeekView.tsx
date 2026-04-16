import { useState } from 'react';
import type { Player } from '../types/game';
import PlayerHand from './PlayerHand';
import styles from './PeekView.module.css';

interface Props {
  player: Player;
  playerIndex: number;
  totalPlayers: number;
  onDone: () => void;
}

/**
 * Initial-peek shield screen.
 *
 * Phase 1 – "Others look away": player taps when ready to see their cards.
 * Phase 2 – Cards revealed: player memorises, then taps "Done".
 *
 * All other players should avert their eyes during phase 2 — just like the
 * physical game. No device hand-off needed.
 */
export default function PeekView({ player, playerIndex, totalPlayers, onDone }: Props) {
  const [revealed, setRevealed] = useState(false);

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
