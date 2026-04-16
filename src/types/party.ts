import type { GameState } from './game';
import type { GameAction } from '../store/actions';

// ─── Messages: client → server ────────────────────────────────────────────────

export type ClientMessage =
  | {
      type: 'join';
      name: string;
      /** Stored playerId from a previous session — used to reclaim a slot on reconnect. */
      claimId?: string;
    }
  | {
      type: 'action';
      action: GameAction;
    };

// ─── Messages: server → client ────────────────────────────────────────────────

export type ServerMessage =
  | {
      type: 'assigned';
      playerId: string;
      isHost: boolean;
    }
  | {
      type: 'lobby';
      players: LobbyPlayer[];
    }
  | {
      type: 'state';
      state: GameState;
    };

// ─── Lobby ────────────────────────────────────────────────────────────────────

export interface LobbyPlayer {
  id: string;
  name: string;
  connected: boolean;
}
