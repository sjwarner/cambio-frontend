import type * as Party from 'partykit/server';
import { gameReducer, INITIAL_STATE } from '../src/store/reducer';
import type { GameState } from '../src/types/game';
import type { ClientMessage, LobbyPlayer, ServerMessage } from '../src/types/party';

// ─── Per-room player slot ─────────────────────────────────────────────────────

interface PlayerSlot {
  playerId: string;   // stable: "player-0", "player-1", …
  name: string;
  connectionId: string | null;  // null when disconnected
}

// ─── Server ───────────────────────────────────────────────────────────────────

export default class CambioServer implements Party.Server {
  private game: GameState = INITIAL_STATE;
  private slots: PlayerSlot[] = [];

  constructor(readonly room: Party.Room) {}

  // ── New connection ──────────────────────────────────────────────────────────
  onConnect(conn: Party.Connection) {
    // Send current state so a reconnecting player can resume immediately.
    this.send(conn, { type: 'state', state: this.game });
    this.broadcastLobby();
  }

  // ── Connection closed ───────────────────────────────────────────────────────
  onClose(conn: Party.Connection) {
    const slot = this.slots.find((s) => s.connectionId === conn.id);
    if (slot) slot.connectionId = null;
    this.broadcastLobby();
  }

  // ── Incoming message ────────────────────────────────────────────────────────
  onMessage(raw: string, sender: Party.Connection) {
    const msg = JSON.parse(raw) as ClientMessage;

    if (msg.type === 'join') {
      this.handleJoin(sender, msg.name, msg.claimId);
      return;
    }

    if (msg.type === 'action') {
      this.game = gameReducer(this.game, msg.action);
      this.broadcastState();
      return;
    }
  }

  // ── Join / reconnect ────────────────────────────────────────────────────────
  private handleJoin(conn: Party.Connection, name: string, claimId?: string) {
    let slot: PlayerSlot | undefined;

    // Reconnect: try to reclaim by stored playerId first, then by name.
    if (claimId) {
      slot = this.slots.find((s) => s.playerId === claimId);
    }
    if (!slot) {
      slot = this.slots.find((s) => s.name === name && s.connectionId === null);
    }

    // New player: add a slot.
    if (!slot) {
      const index = this.slots.length;
      slot = { playerId: `player-${index}`, name, connectionId: null };
      this.slots.push(slot);
    }

    slot.connectionId = conn.id;
    slot.name = name;  // update in case of name change on reconnect

    const isHost = this.slots.indexOf(slot) === 0;

    this.send(conn, { type: 'assigned', playerId: slot.playerId, isHost });
    this.send(conn, { type: 'state', state: this.game });
    this.broadcastLobby();
  }

  // ── Broadcast helpers ───────────────────────────────────────────────────────
  private send(conn: Party.Connection, msg: ServerMessage) {
    conn.send(JSON.stringify(msg));
  }

  private broadcastState() {
    const msg: ServerMessage = { type: 'state', state: this.game };
    this.room.broadcast(JSON.stringify(msg));
  }

  private broadcastLobby() {
    const players: LobbyPlayer[] = this.slots.map((s) => ({
      id: s.playerId,
      name: s.name,
      connected: s.connectionId !== null,
    }));
    const msg: ServerMessage = { type: 'lobby', players };
    this.room.broadcast(JSON.stringify(msg));
  }
}
