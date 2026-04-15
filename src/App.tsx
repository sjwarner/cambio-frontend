import { useReducer } from 'react';
import { gameReducer, INITIAL_STATE } from './store/reducer';
import SetupScreen from './components/SetupScreen';
import PassDevice from './components/PassDevice';
import PeekView from './components/PeekView';
import GameBoard from './components/GameBoard';
import GameOver from './components/GameOver';

export default function App() {
  const [state, dispatch] = useReducer(gameReducer, INITIAL_STATE);

  const { phase, players, currentPlayerIndex, peekPlayerIndex, stick } = state;

  // ── Setup ────────────────────────────────────────────────────────────────────
  if (phase === 'setup') {
    return (
      <SetupScreen
        onStart={(names) => dispatch({ type: 'START_GAME', playerNames: names })}
      />
    );
  }

  // ── Initial peek — pass device ────────────────────────────────────────────────
  if (phase === 'peek-pass') {
    const peeker = players[peekPlayerIndex];
    return (
      <PassDevice
        playerName={peeker.name}
        message="You'll get one chance to peek at your two nearest cards."
        onConfirm={() => dispatch({ type: 'CONFIRM_PASS' })}
      />
    );
  }

  // ── Initial peek — viewing ─────────────────────────────────────────────────────
  if (phase === 'peek-view') {
    const peeker = players[peekPlayerIndex];
    return (
      <PeekView
        player={peeker}
        onDone={() => dispatch({ type: 'DONE_PEEKING' })}
      />
    );
  }

  // ── Turn — pass device ────────────────────────────────────────────────────────
  if (phase === 'turn-pass') {
    const current = players[currentPlayerIndex];
    const isCambioTurn = state.cambioCallerId !== null;
    return (
      <PassDevice
        playerName={current.name}
        message={
          isCambioTurn
            ? `Cambio has been called! This is your final turn. (${state.turnsLeftAfterCambio} remaining)`
            : undefined
        }
        onConfirm={() => dispatch({ type: 'CONFIRM_PASS' })}
      />
    );
  }

  // ── Stick — pass device ────────────────────────────────────────────────────────
  if (phase === 'stick-pass' && stick) {
    const stickerName =
      players.find((p) => p.id === stick.checkOrder[stick.checkIndex])?.name ?? '';
    const topCard = state.discardPile[0];
    return (
      <PassDevice
        playerName={stickerName}
        message={
          topCard
            ? `Top of discard: ${topCard.rank} of ${topCard.suit}. Do you want to try to stick?`
            : undefined
        }
        onConfirm={() => dispatch({ type: 'CONFIRM_PASS' })}
      />
    );
  }

  // ── Game over ──────────────────────────────────────────────────────────────────
  if (phase === 'game-over') {
    return (
      <GameOver
        state={state}
        onPlayAgain={() => window.location.reload()}
      />
    );
  }

  // ── All active game phases render through GameBoard ───────────────────────────
  return <GameBoard state={state} dispatch={dispatch} />;
}
