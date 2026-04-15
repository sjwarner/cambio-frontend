import styles from './PassDevice.module.css';

interface Props {
  playerName: string;
  message?: string;
  onConfirm: () => void;
}

export default function PassDevice({ playerName, message, onConfirm }: Props) {
  return (
    <div className={styles.overlay}>
      <div className={styles.card}>
        <div className={styles.icon}>📱</div>
        <h2 className={styles.heading}>Pass the device to</h2>
        <p className={styles.name}>{playerName}</p>
        {message && <p className={styles.message}>{message}</p>}
        <button className={styles.btn} onClick={onConfirm}>
          I'm ready →
        </button>
      </div>
    </div>
  );
}
