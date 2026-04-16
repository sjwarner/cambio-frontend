import styles from './Lobby.module.css';
import type { LobbyPlayer } from '../types/party';

interface Props {
  roomId: string;
  players: LobbyPlayer[];
  isHost: boolean;
  myPlayerId: string | null;
  status: 'connecting' | 'connected' | 'error';
  onStart: () => void;
  onLeave: () => void;
}

export default function Lobby({ roomId, players, isHost, myPlayerId, status, onStart, onLeave }: Props) {
  const connectedCount = players.filter((p) => p.connected).length;
  const canStart = isHost && connectedCount >= 2;
  const shareUrl = `${window.location.origin}${window.location.pathname}?room=${roomId}`;

  function copyLink() {
    navigator.clipboard.writeText(shareUrl).catch(() => {});
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.card}>
        <h2 className={styles.title}>Waiting room</h2>

        {status === 'connecting' && (
          <p className={styles.connecting}>Connecting...</p>
        )}
        {status === 'error' && (
          <p className={styles.error}>Connection error. Please refresh.</p>
        )}

        <div className={styles.shareSection}>
          <span className={styles.shareLabel}>Room code</span>
          <span className={styles.roomCode}>{roomId}</span>
          <button className={styles.copyBtn} onClick={copyLink}>Copy link</button>
        </div>

        <div className={styles.playerList}>
          <div className={styles.playerListHeader}>
            Players ({connectedCount} connected)
          </div>
          {players.map((p) => (
            <div
              key={p.id}
              className={`${styles.playerRow} ${!p.connected ? styles.disconnected : ''} ${p.id === myPlayerId ? styles.me : ''}`}
            >
              <span className={styles.playerDot}>{p.connected ? '●' : '○'}</span>
              <span className={styles.playerName}>{p.name}</span>
              {p.id === myPlayerId && <span className={styles.youBadge}>you</span>}
              {p.id === 'player-0' && <span className={styles.hostBadge}>host</span>}
            </div>
          ))}
          {players.length === 0 && status === 'connected' && (
            <div className={styles.empty}>Joining...</div>
          )}
        </div>

        <div className={styles.actions}>
          {isHost ? (
            <>
              <button
                className={styles.startBtn}
                onClick={onStart}
                disabled={!canStart}
              >
                {canStart ? 'Start game' : `Waiting for players… (${connectedCount}/2 min)`}
              </button>
            </>
          ) : (
            <p className={styles.waitMsg}>Waiting for the host to start the game…</p>
          )}
          <button className={styles.leaveBtn} onClick={onLeave}>Leave</button>
        </div>
      </div>
    </div>
  );
}
