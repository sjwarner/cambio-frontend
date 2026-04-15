import type { GameState } from '../types/game';
import { cardPoints } from '../utils/scoring';
import styles from './GameOver.module.css';

interface Props {
  state: GameState;
  onPlayAgain: () => void;
}

export default function GameOver({ state, onPlayAgain }: Props) {
  const { scores, winnerId, players } = state;
  const sorted = [...scores].sort((a, b) => a.score - b.score);

  return (
    <div className={styles.overlay}>
      <div className={styles.card}>
        <h1 className={styles.title}>Game Over</h1>

        {winnerId && (
          <p className={styles.winner}>
            🏆 {players.find((p) => p.id === winnerId)?.name} wins!
          </p>
        )}

        <div className={styles.scoreList}>
          {sorted.map((entry, rank) => {
            const player = players.find((p) => p.id === entry.playerId)!;
            return (
              <div
                key={entry.playerId}
                className={`${styles.scoreRow} ${entry.playerId === winnerId ? styles.winnerRow : ''}`}
              >
                <span className={styles.rank}>
                  {rank === 0 ? '🥇' : rank === 1 ? '🥈' : rank === 2 ? '🥉' : `${rank + 1}.`}
                </span>
                <span className={styles.playerName}>
                  {entry.name}
                  {entry.calledCambio && (
                    <span className={styles.cambioBadge}>called Cambio</span>
                  )}
                </span>
                <span className={styles.score}>{entry.score} pts</span>

                {/* Card breakdown */}
                <div className={styles.cardBreakdown}>
                  {player.hand.filter(Boolean).map((c, i) => {
                    const pts = cardPoints(c!);
                    return (
                      <span key={i} className={styles.cardChip}>
                        {c!.rank}
                        {c!.suit !== 'joker' ? suitChar(c!.suit) : ''}
                        <span className={pts < 0 ? styles.neg : pts === 0 ? styles.zero : ''}>
                          {pts > 0 ? `+${pts}` : pts}
                        </span>
                      </span>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        <button className={styles.playAgainBtn} onClick={onPlayAgain}>
          Play Again
        </button>
      </div>
    </div>
  );
}

function suitChar(suit: string) {
  const map: Record<string, string> = {
    hearts: '♥',
    diamonds: '♦',
    clubs: '♣',
    spades: '♠',
  };
  return map[suit] ?? '';
}
