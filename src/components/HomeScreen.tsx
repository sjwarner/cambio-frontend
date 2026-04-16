import { useState, useEffect } from 'react';
import styles from './HomeScreen.module.css';

interface Props {
  onCreateRoom: (playerName: string, roomId: string) => void;
  onJoinRoom: (playerName: string, roomId: string) => void;
  onPlayLocally: () => void;
}

function generateRoomId(): string {
  // Unambiguous uppercase characters (no I/O/0/1)
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 5 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

export default function HomeScreen({ onCreateRoom, onJoinRoom, onPlayLocally }: Props) {
  const [name, setName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [view, setView] = useState<'main' | 'join'>('main');

  // Pre-fill room code if one is in the URL (?room=XXXXX)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get('room');
    if (roomParam) {
      setJoinCode(roomParam.toUpperCase());
      setView('join');
    }
  }, []);

  const trimmedName = name.trim();
  const trimmedCode = joinCode.trim().toUpperCase();

  function handleCreate() {
    if (!trimmedName) return;
    const roomId = generateRoomId();
    // Push the room into the URL so the host can share it easily.
    const url = new URL(window.location.href);
    url.searchParams.set('room', roomId);
    window.history.replaceState(null, '', url.toString());
    onCreateRoom(trimmedName, roomId);
  }

  function handleJoin() {
    if (!trimmedName || !trimmedCode) return;
    onJoinRoom(trimmedName, trimmedCode);
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.card}>
        <h1 className={styles.title}>Cambio</h1>
        <p className={styles.subtitle}>The card memory game</p>

        <div className={styles.nameRow}>
          <label className={styles.fieldLabel} htmlFor="player-name">Your name</label>
          <input
            id="player-name"
            className={styles.nameInput}
            type="text"
            placeholder="Enter your name"
            value={name}
            maxLength={20}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && view === 'main' && trimmedName) handleCreate();
              if (e.key === 'Enter' && view === 'join' && trimmedName && trimmedCode) handleJoin();
            }}
            autoFocus
          />
        </div>

        {view === 'main' ? (
          <div className={styles.actions}>
            <button
              className={styles.primaryBtn}
              onClick={handleCreate}
              disabled={!trimmedName}
            >
              Create game
            </button>
            <button
              className={styles.secondaryBtn}
              onClick={() => setView('join')}
              disabled={!trimmedName}
            >
              Join game
            </button>
            <button
              className={styles.tertiaryBtn}
              onClick={onPlayLocally}
            >
              Play locally (same device)
            </button>
          </div>
        ) : (
          <div className={styles.actions}>
            <label className={styles.fieldLabel} htmlFor="room-code">Room code</label>
            <input
              id="room-code"
              className={styles.codeInput}
              type="text"
              placeholder="e.g. AB3XY"
              value={joinCode}
              maxLength={5}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && trimmedName && trimmedCode) handleJoin();
              }}
            />
            <button
              className={styles.primaryBtn}
              onClick={handleJoin}
              disabled={!trimmedName || trimmedCode.length < 5}
            >
              Join
            </button>
            <button className={styles.tertiaryBtn} onClick={() => setView('main')}>
              Back
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
