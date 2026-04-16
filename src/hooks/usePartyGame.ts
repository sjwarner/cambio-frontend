import { useState, useEffect, useCallback, useRef } from 'react';
import PartySocket from 'partysocket';
import { INITIAL_STATE } from '../store/reducer';
import type { GameState } from '../types/game';
import type { GameAction } from '../store/actions';
import type { ClientMessage, LobbyPlayer, ServerMessage } from '../types/party';

// In dev, connect to the partykit dev server directly.
// In production, set VITE_PARTYKIT_HOST to your deployed partykit host.
const PARTYKIT_HOST = import.meta.env.VITE_PARTYKIT_HOST || 'localhost:1999';

export type ConnectionStatus = 'connecting' | 'connected' | 'error';

export interface PartyGameState {
  gameState: GameState;
  myPlayerId: string | null;
  isHost: boolean;
  lobbyPlayers: LobbyPlayer[];
  status: ConnectionStatus;
  dispatch: (action: GameAction) => void;
}

export function usePartyGame(roomId: string, playerName: string): PartyGameState {
  const [gameState, setGameState] = useState<GameState>(INITIAL_STATE);
  const [myPlayerId, setMyPlayerId] = useState<string | null>(null);
  const [isHost, setIsHost] = useState(false);
  const [lobbyPlayers, setLobbyPlayers] = useState<LobbyPlayer[]>([]);
  const [status, setStatus] = useState<ConnectionStatus>('connecting');

  const socketRef = useRef<PartySocket | null>(null);
  // Stable slot key so we can reclaim the same player on page-refresh.
  const slotKey = `cambio-slot-${roomId}`;

  useEffect(() => {
    const claimId = sessionStorage.getItem(slotKey) ?? undefined;

    const socket = new PartySocket({
      host: PARTYKIT_HOST,
      room: roomId,
    });
    socketRef.current = socket;

    socket.addEventListener('open', () => {
      setStatus('connected');
      const msg: ClientMessage = { type: 'join', name: playerName, claimId };
      socket.send(JSON.stringify(msg));
    });

    socket.addEventListener('message', (event: MessageEvent) => {
      const msg = JSON.parse(event.data as string) as ServerMessage;
      if (msg.type === 'assigned') {
        setMyPlayerId(msg.playerId);
        setIsHost(msg.isHost);
        sessionStorage.setItem(slotKey, msg.playerId);
      } else if (msg.type === 'lobby') {
        setLobbyPlayers(msg.players);
      } else if (msg.type === 'state') {
        setGameState(msg.state);
      }
    });

    socket.addEventListener('error', () => setStatus('error'));

    return () => {
      socket.close();
      socketRef.current = null;
    };
  }, [roomId, playerName, slotKey]);

  const dispatch = useCallback((action: GameAction) => {
    const msg: ClientMessage = { type: 'action', action };
    socketRef.current?.send(JSON.stringify(msg));
  }, []);

  return { gameState, myPlayerId, isHost, lobbyPlayers, status, dispatch };
}
