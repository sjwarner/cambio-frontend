# Cambio

A digital implementation of the card memory game Cambio, playable online with friends or locally on a single device.

## The game

Each player is dealt 4 face-down cards arranged in a 2×2 grid. At the start, everyone secretly peeks at their two nearest cards. On your turn, draw a card from the deck — then either discard it (triggering its special ability) or swap it into your hand. Special cards let you peek at cards or perform blind swaps. Anyone can **snap** a matching card onto the discard pile at any time. Call **Cambio** when you think you have the lowest total — everyone else gets one final turn. Lowest score wins. Red King = −1, Joker = 0, Ace = 1, face cards = 10.

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 19 + TypeScript, Vite |
| Game logic | Pure reducer (`src/store/reducer.ts`) — no side effects |
| Multiplayer | [PartyKit](https://partykit.io) WebSocket server (`party/index.ts`) |
| Frontend hosting | GitHub Pages, deployed via GitHub Actions |
| Party server hosting | PartyKit (free tier) |

## Development

Requires Node 20+.

```bash
npm install
npm run dev        # starts Vite (port 5173) + PartyKit dev server (port 1999)
```

Open `http://localhost:5173`. Online multiplayer connects to the local PartyKit server automatically in dev.

Individual servers if needed:
```bash
npm run dev:client   # Vite only
npm run dev:party    # PartyKit only
```

## Deployment

There are two independent deployments: the **party server** (PartyKit) and the **frontend** (GitHub Pages).

### Party server (PartyKit)

The party server holds authoritative game state and must be redeployed whenever any of these files change:

- `party/index.ts`
- `src/store/reducer.ts`
- `src/store/actions.ts`
- `src/types/game.ts`
- `src/utils/deck.ts`
- `src/utils/scoring.ts`

```bash
npm run deploy     # runs: partykit deploy
```

You'll need to be logged in (`npx partykit login`) the first time. The deployed host will be something like `cambio.your-username.partykit.dev`.

### Frontend (GitHub Pages)

Deployed automatically via GitHub Actions on every push to `main`. No manual step needed.

The action reads `VITE_PARTYKIT_HOST` from the repository's **Variables** (not Secrets) — set this once in GitHub: **Settings → Secrets and variables → Actions → Variables tab → `VITE_PARTYKIT_HOST`** = your PartyKit host from above.

To trigger a manual redeploy: **Actions → Deploy to GitHub Pages → Run workflow**.

## Architecture notes

Game state lives entirely in a single deterministic reducer (`src/store/reducer.ts`). The party server imports and runs this same reducer, applies incoming actions, and broadcasts the resulting state to all connected clients. Because the reducer has no side effects, the server is the single source of truth and clients are pure renderers.

In online mode, each player's browser only receives the state — card visibility filtering (drawn cards, peek reveals) is enforced in the UI layer based on `myPlayerId`.
