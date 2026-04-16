import { useRef, useEffect } from 'react';
import type { CardRef, GameState } from '../types/game';
import type { GameAction } from '../store/actions';
import Card from './Card';
import PlayerHand from './PlayerHand';
import styles from './GameBoard.module.css';

interface Props {
  state: GameState;
  dispatch: React.Dispatch<GameAction>;
}

export default function GameBoard({ state, dispatch }: Props) {
  const notifTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (state.notification) {
      if (notifTimeout.current) clearTimeout(notifTimeout.current);
      notifTimeout.current = setTimeout(() => dispatch({ type: 'CLEAR_NOTIFICATION' }), 3000);
    }
  }, [state.notification, dispatch]);

  const currentPlayer = state.players[state.currentPlayerIndex];
  const topDiscard = state.discardPile[0] ?? null;

  // ── Which slots are selectable for a given player ─────────────────────────
  function getSelectableSlots(playerId: string): Set<number> {
    const p = state.players.find((pl) => pl.id === playerId);
    if (!p) return new Set();
    const filled = new Set(p.hand.map((c, i) => (c ? i : -1)).filter((i) => i >= 0));
    const currentId = currentPlayer.id;
    const { phase } = state;

    if (phase === 'turn-drawn-selecting' && playerId === currentId) return filled;
    if (phase === 'special-look-own' && playerId === currentId) return filled;
    if (phase === 'special-look-other' && playerId !== currentId) return filled;
    if (phase === 'special-blind-1') return filled;
    if (phase === 'special-blind-2') {
      const first = state.special?.firstRef;
      if (!first) return filled;
      return new Set([...filled].filter((i) => !(playerId === first.playerId && i === first.slotIndex)));
    }
    if (phase === 'special-bk-look') return filled;
    if (phase === 'special-bk-switch' && playerId === currentId) {
      const lookedRef = state.special?.firstRef;
      return new Set([...filled].filter(
        (i) => !(lookedRef && playerId === lookedRef.playerId && i === lookedRef.slotIndex),
      ));
    }
    if (phase === 'snap-select') {
      const snaperId = state.snap?.claimedBy;
      if (!snaperId) return new Set();
      // Snaper can pick from any hand
      return filled;
    }
    if (phase === 'snap-give') {
      const snaperId = state.snap?.claimedBy;
      if (playerId === snaperId) return filled;
    }
    return new Set();
  }

  function getRevealedSlots(playerId: string): Set<number> {
    const { phase } = state;
    if (
      (phase === 'special-peek-reveal' || phase === 'special-bk-reveal') &&
      state.special?.firstRef?.playerId === playerId
    ) {
      return new Set([state.special.firstRef.slotIndex]);
    }
    return new Set();
  }

  function handleSelectSlot(ref: CardRef) {
    if (state.phase === 'turn-drawn-selecting') {
      dispatch({ type: 'SWAP_DRAWN_WITH_SLOT', slotIndex: ref.slotIndex });
    } else {
      dispatch({ type: 'SELECT_CARD', ref });
    }
  }

  // ── Instruction text ──────────────────────────────────────────────────────
  function getInstruction(): string {
    const name = currentPlayer.name;
    switch (state.phase) {
      case 'turn-idle':
        return `${name}'s turn — draw a card or call Cambio.`;
      case 'turn-drawn':
        return `${name}: discard the drawn card (use its ability), or hide it and swap it into your hand.`;
      case 'turn-drawn-selecting':
        return `${name}: tap one of your cards to swap the drawn card in (the card there will be discarded).`;
      case 'special-look-own':
        return `${name}: tap one of your face-down cards to peek at it.`;
      case 'special-look-other':
        return `${name}: tap any opponent's face-down card to peek at it.`;
      case 'special-peek-reveal':
        return `${name}: memorise this card, then dismiss it.`;
      case 'special-blind-1':
        return `${name}: tap the first card to blind-swap (any player).`;
      case 'special-blind-2':
        return `${name}: tap the second card to complete the swap.`;
      case 'special-bk-look':
        return `${name} (Black King): tap any card to look at it.`;
      case 'special-bk-reveal':
        return `${name}: memorise this card. Swap it with one of your own, or skip.`;
      case 'special-bk-switch':
        return `${name}: tap one of your own cards to swap with the peeked card.`;
      case 'snap-window': {
        const rank = topDiscard?.rank ?? '?';
        return `${rank} discarded! Anyone can snap — first to tap their name wins the window.`;
      }
      case 'snap-select': {
        const snaperName = state.players.find((p) => p.id === state.snap?.claimedBy)?.name ?? '';
        return `${snaperName}: tap the card you think matches the ${topDiscard?.rank}.`;
      }
      case 'snap-give': {
        const snaperName = state.players.find((p) => p.id === state.snap?.claimedBy)?.name ?? '';
        return `${snaperName}: tap one of your cards to give to the other player.`;
      }
      default:
        return '';
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className={styles.board}>

      {/* Notification toast */}
      {state.notification && (
        <div className={styles.notification}>{state.notification}</div>
      )}

      {/* Cambio banner */}
      {state.cambioCallerId && (
        <div className={styles.cambioBanner}>
          🔔 Cambio called by{' '}
          {state.players.find((p) => p.id === state.cambioCallerId)?.name}!{' '}
          {state.turnsLeftAfterCambio} turn{state.turnsLeftAfterCambio !== 1 ? 's' : ''} left.
        </div>
      )}

      {/* Instruction bar */}
      <div className={styles.instruction}>{getInstruction()}</div>

      {/* All player hands — shown simultaneously */}
      <div className={styles.handsGrid}>
        {state.players.map((player) => {
          const isCurrent = player.id === currentPlayer.id;
          const isSnapClaimant = state.snap?.claimedBy === player.id;
          return (
            <div
              key={player.id}
              className={`${styles.handWrapper} ${isCurrent ? styles.currentPlayer : ''} ${isSnapClaimant ? styles.snapClaimant : ''}`}
            >
              {isCurrent && <div className={styles.turnBadge}>● TURN</div>}
              <PlayerHand
                player={player}
                revealedSlots={getRevealedSlots(player.id)}
                selectableSlots={getSelectableSlots(player.id)}
                onSelectSlot={handleSelectSlot}
                showLabel
                compact={state.players.length > 3}
              />
            </div>
          );
        })}
      </div>

      {/* Centre table */}
      <div className={styles.table}>
        {/* Draw pile */}
        <div className={styles.pileGroup}>
          <div className={styles.pileLabel}>Draw pile</div>
          <button
            className={`${styles.deckPile} ${state.phase === 'turn-idle' ? styles.deckSelectable : ''}`}
            onClick={() => dispatch({ type: 'DRAW_CARD' })}
            disabled={state.phase !== 'turn-idle' || state.deck.length === 0}
            aria-label={`Draw pile (${state.deck.length} cards)`}
          >
            {state.deck.length > 0 ? (
              <>
                <div className={styles.deckShadow} aria-hidden="true" />
                <Card card={state.deck[0]} faceUp={false} />
              </>
            ) : (
              <div className={styles.emptyPile}>Empty</div>
            )}
          </button>
          <div className={styles.deckCount}>{state.deck.length} left</div>
        </div>

        {/* Discard pile */}
        <div className={styles.pileGroup}>
          <div className={styles.pileLabel}>Discard pile</div>
          <Card card={topDiscard} faceUp={true} />
        </div>

        {/* Drawn card */}
        {state.drawnCard && state.phase === 'turn-drawn' && (
          <div className={styles.pileGroup}>
            <div className={styles.pileLabel}>You drew</div>
            <Card card={state.drawnCard} faceUp={true} />
            <button
              className={styles.actionBtn}
              onClick={() => dispatch({ type: 'DISCARD_DRAWN' })}
            >
              Discard it
            </button>
            <button
              className={styles.actionBtnSecondary}
              onClick={() => dispatch({ type: 'HIDE_DRAWN_CARD' })}
            >
              Hide it — swap into hand
            </button>
          </div>
        )}
        {state.drawnCard && state.phase === 'turn-drawn-selecting' && (
          <div className={styles.pileGroup}>
            <div className={styles.pileLabel}>Your drawn card</div>
            <Card card={state.drawnCard} faceUp={false} />
          </div>
        )}
      </div>

      {/* Special peek reveal modal */}
      {(state.phase === 'special-peek-reveal' || state.phase === 'special-bk-reveal') &&
        state.special?.revealedCard && (
          <div className={styles.revealModal}>
            <p className={styles.revealTitle}>
              {state.players[state.currentPlayerIndex].name}'s peek
            </p>
            <Card card={state.special.revealedCard} faceUp={true} />
            <div className={styles.revealActions}>
              <button className={styles.actionBtn} onClick={() => dispatch({ type: 'DONE_VIEWING' })}>
                Got it
              </button>
              {state.phase === 'special-bk-reveal' && (
                <button className={styles.actionBtnSecondary} onClick={() => dispatch({ type: 'SKIP_BK_SWITCH' })}>
                  Skip swap
                </button>
              )}
            </div>
          </div>
        )}

      {/* ── Snap window ──────────────────────────────────────────────────── */}
      {state.phase === 'snap-window' && state.snap && (
        <div className={styles.snapWindow}>
          <div className={styles.snapTop}>
            <span className={styles.snapTitle}>
              Snap on <strong>{topDiscard?.rank}</strong>?
            </span>
            <span className={styles.snapSub}>First to tap their name wins the window!</span>
          </div>
          <div className={styles.snapButtons}>
            {state.snap.eligibleIds.map((pid) => {
              const name = state.players.find((p) => p.id === pid)?.name ?? '';
              return (
                <button
                  key={pid}
                  className={styles.snapPlayerBtn}
                  onClick={() => dispatch({ type: 'CLAIM_SNAP', playerId: pid })}
                >
                  {name}
                </button>
              );
            })}
            <button
              className={styles.actionBtnSecondary}
              onClick={() => dispatch({ type: 'SKIP_SNAP' })}
            >
              No one snaps
            </button>
          </div>
        </div>
      )}

      {/* Cambio button */}
      {state.phase === 'turn-idle' && !state.cambioCallerId && (
        <div className={styles.turnActions}>
          <button
            className={styles.cambioBtn}
            onClick={() => dispatch({ type: 'CALL_CAMBIO' })}
          >
            Call Cambio!
          </button>
        </div>
      )}
    </div>
  );
}
