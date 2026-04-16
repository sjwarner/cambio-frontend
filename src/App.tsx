import { useReducer } from 'react';
import { gameReducer, INITIAL_STATE } from './store/reducer';
import SetupScreen from './components/SetupScreen';
import PeekView from './components/PeekView';
import GameBoard from './components/GameBoard';
import GameOver from './components/GameOver';

export default function App() {
  const [state, dispatch] = useReducer(gameReducer, INITIAL_STATE);

  const { phase, players, peekPlayerIndex } = state;

  // ── Setup ────────────────────────────────────────────────────────────────────
  if (phase === 'setup') {
    return (
      <SetupScreen
        onStart={(names) => dispatch({ type: 'START_GAME', playerNames: names })}
      />
    );
  }

  // ── Initial peek (each player privately, shield pattern) ──────────────────────
  if (phase === 'peek-view') {
    return (
      <PeekView
        key={peekPlayerIndex}
        player={players[peekPlayerIndex]}
        playerIndex={peekPlayerIndex}
        totalPlayers={players.length}
        onDone={() => dispatch({ type: 'DONE_PEEKING' })}
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
