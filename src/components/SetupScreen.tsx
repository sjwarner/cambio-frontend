import { useState } from 'react';
import styles from './SetupScreen.module.css';

interface Props {
  onStart: (playerNames: string[]) => void;
}

const MIN_PLAYERS = 2;
const MAX_PLAYERS = 6;

export default function SetupScreen({ onStart }: Props) {
  const [count, setCount] = useState(2);
  const [names, setNames] = useState<string[]>(['', '']);

  function handleCountChange(n: number) {
    setCount(n);
    setNames((prev) => {
      const next = [...prev];
      while (next.length < n) next.push('');
      return next.slice(0, n);
    });
  }

  function handleNameChange(i: number, value: string) {
    setNames((prev) => {
      const next = [...prev];
      next[i] = value;
      return next;
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const resolved = names.map((n, i) => n.trim() || `Player ${i + 1}`);
    onStart(resolved);
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.card}>
        <h1 className={styles.title}>Cambio</h1>
        <p className={styles.subtitle}>The card memory game</p>

        <form onSubmit={handleSubmit} className={styles.form}>
          <label className={styles.fieldLabel}>Number of players</label>
          <div className={styles.countRow}>
            {Array.from({ length: MAX_PLAYERS - MIN_PLAYERS + 1 }, (_, i) => i + MIN_PLAYERS).map(
              (n) => (
                <button
                  key={n}
                  type="button"
                  className={`${styles.countBtn} ${n === count ? styles.countActive : ''}`}
                  onClick={() => handleCountChange(n)}
                >
                  {n}
                </button>
              ),
            )}
          </div>

          <div className={styles.nameList}>
            {names.map((name, i) => (
              <div key={i} className={styles.nameRow}>
                <span className={styles.playerIcon}>P{i + 1}</span>
                <input
                  className={styles.nameInput}
                  type="text"
                  placeholder={`Player ${i + 1}`}
                  value={name}
                  maxLength={20}
                  onChange={(e) => handleNameChange(i, e.target.value)}
                />
              </div>
            ))}
          </div>

          <button type="submit" className={styles.startBtn}>
            Deal Cards
          </button>
        </form>

        <details className={styles.rules}>
          <summary>Quick rules</summary>
          <ul>
            <li>Deal 4 cards to each player face-down (2×2).</li>
            <li>Each player peeks at their 2 <em>nearest</em> cards once.</li>
            <li>On your turn: draw from the deck, then discard it or swap with a hand card.</li>
            <li>Playing a 7/8: peek at your own card. 9/10: peek at an opponent's.</li>
            <li>J/Q: blind-swap any two cards. Black King: peek at any + optionally swap.</li>
            <li><strong>Stick:</strong> when a card lands on the discard, anyone can discard a matching rank.</li>
            <li>Call <strong>Cambio</strong> instead of drawing — all others get one final turn.</li>
            <li>Lowest score wins. Red King = −1 pt. Joker = 0 pt.</li>
          </ul>
        </details>
      </div>
    </div>
  );
}
