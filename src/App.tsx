import { useReducer, useState } from 'react';
import { gameReducer, INITIAL_STATE } from './store/reducer';
import { usePartyGame } from './hooks/usePartyGame';
import HomeScreen from './components/HomeScreen';
import Lobby from './components/Lobby';
import SetupScreen from './components/SetupScreen';
import PeekView from './components/PeekView';
import GameBoard from './components/GameBoard';
import GameOver from './components/GameOver';

// ─── App modes ────────────────────────────────────────────────────────────────

type AppMode =
  | { kind: 'home' }
  | { kind: 'online'; roomId: string; playerName: string }
  | { kind: 'local' };

// ─── Online game (PartyKit-connected) ─────────────────────────────────────────

function OnlineGame({
  roomId,
  playerName,
  onLeave,
}: {
  roomId: string;
  playerName: string;
  onLeave: () => void;
}) {
  const { gameState, dispatch, myPlayerId, isHost, lobbyPlayers, status } =
    usePartyGame(roomId, playerName);

  const { phase, players, peekPlayerIndex } = gameState;

  // ── Lobby (game not started yet) ──────────────────────────────────────────
  if (phase === 'setup') {
    return (
      <Lobby
        roomId={roomId}
        players={lobbyPlayers}
        isHost={isHost}
        myPlayerId={myPlayerId}
        status={status}
        onStart={() =>
          dispatch({
            type: 'START_GAME',
            playerNames: lobbyPlayers.map((p) => p.name),
          })
        }
        onLeave={onLeave}
      />
    );
  }

  // ── Initial peek ──────────────────────────────────────────────────────────
  if (phase === 'peek-view') {
    const peekPlayer = players[peekPlayerIndex];
    const isMyPeek = myPlayerId === peekPlayer.id;

    if (isMyPeek) {
      return (
        <PeekView
          key={peekPlayerIndex}
          player={peekPlayer}
          playerIndex={peekPlayerIndex}
          totalPlayers={players.length}
          onDone={() => dispatch({ type: 'DONE_PEEKING' })}
          skipShield
        />
      );
    }

    // Show a waiting screen while another player peeks.
    return <WaitingPeek playerName={peekPlayer.name} />;
  }

  // ── Game over ─────────────────────────────────────────────────────────────
  if (phase === 'game-over') {
    return (
      <GameOver
        state={gameState}
        onPlayAgain={() => {
          // Clear the session slot so a fresh game assigns new IDs.
          sessionStorage.removeItem(`cambio-slot-${roomId}`);
          window.location.reload();
        }}
      />
    );
  }

  // ── Active game ───────────────────────────────────────────────────────────
  return <GameBoard state={gameState} dispatch={dispatch} myPlayerId={myPlayerId} />;
}

// ─── Waiting screen shown to non-peeking players ──────────────────────────────

function WaitingPeek({ playerName }: { playerName: string }) {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: 16,
        color: 'rgba(255,255,255,0.6)',
        fontSize: 18,
      }}
    >
      <div style={{ fontSize: 48 }}>🙈</div>
      <p style={{ margin: 0 }}>
        <strong style={{ color: 'rgba(255,255,255,0.9)' }}>{playerName}</strong> is peeking at
        their cards…
      </p>
      <p style={{ margin: 0, fontSize: 14 }}>Look away!</p>
    </div>
  );
}

// ─── Local game (existing pass-and-play behaviour) ────────────────────────────

function LocalGame({ onLeave }: { onLeave: () => void }) {
  const [state, dispatch] = useReducer(gameReducer, INITIAL_STATE);

  const { phase, players, peekPlayerIndex } = state;

  if (phase === 'setup') {
    return (
      <SetupScreen onStart={(names) => dispatch({ type: 'START_GAME', playerNames: names })} />
    );
  }

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

  if (phase === 'game-over') {
    return <GameOver state={state} onPlayAgain={onLeave} />;
  }

  return <GameBoard state={state} dispatch={dispatch} />;
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function App() {
  const [mode, setMode] = useState<AppMode>({ kind: 'home' });

  if (mode.kind === 'home') {
    return (
      <HomeScreen
        onCreateRoom={(name, roomId) => setMode({ kind: 'online', roomId, playerName: name })}
        onJoinRoom={(name, roomId) => setMode({ kind: 'online', roomId, playerName: name })}
        onPlayLocally={() => setMode({ kind: 'local' })}
      />
    );
  }

  if (mode.kind === 'local') {
    return <LocalGame onLeave={() => setMode({ kind: 'home' })} />;
  }

  return (
    <OnlineGame
      roomId={mode.roomId}
      playerName={mode.playerName}
      onLeave={() => {
        // Clean up URL and session slot on intentional leave.
        const url = new URL(window.location.href);
        url.searchParams.delete('room');
        window.history.replaceState(null, '', url.toString());
        sessionStorage.removeItem(`cambio-slot-${mode.roomId}`);
        setMode({ kind: 'home' });
      }}
    />
  );
}
