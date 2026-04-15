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

  // Auto-clear notification
  useEffect(() => {
    if (state.notification) {
      if (notifTimeout.current) clearTimeout(notifTimeout.current);
      notifTimeout.current = setTimeout(() => dispatch({ type: 'CLEAR_NOTIFICATION' }), 3000);
    }
  }, [state.notification, dispatch]);

  const currentPlayer = state.players[state.currentPlayerIndex];
  const topDiscard = state.discardPile[0] ?? null;

  // ── Determine which slots are selectable ───────────────────────────────────
  function getSelectableSlots(playerId: string): Set<number> {
    const p = state.players.find((pl) => pl.id === playerId);
    if (!p) return new Set();
    const filled = new Set(
      p.hand.map((c, i) => (c ? i : -1)).filter((i) => i >= 0),
    );

    const { phase } = state;
    const currentId = currentPlayer.id;

    // Swap drawn card with own hand
    if (phase === 'turn-drawn' && playerId === currentId) return filled;

    // 7/8: look at own
    if (phase === 'special-look-own' && playerId === currentId) return filled;

    // 9/10: look at other
    if (phase === 'special-look-other' && playerId !== currentId) return filled;

    // J/Q step 1: any card from any player
    if (phase === 'special-blind-1') return filled;

    // J/Q step 2: any card except the first selected
    if (phase === 'special-blind-2') {
      const first = state.special?.firstRef;
      if (!first) return filled;
      return new Set([...filled].filter((i) => !(playerId === first.playerId && i === first.slotIndex)));
    }

    // Black King look: any card
    if (phase === 'special-bk-look') return filled;

    // Black King switch: own card (not the looked card)
    if (phase === 'special-bk-switch' && playerId === currentId) {
      const lookedRef = state.special?.firstRef;
      return new Set(
        [...filled].filter(
          (i) => !(lookedRef && playerId === lookedRef.playerId && i === lookedRef.slotIndex),
        ),
      );
    }

    // Stick select: any card from any player
    if (phase === 'stick-select') return filled;

    // Stick give: own card of the sticker
    if (phase === 'stick-give') {
      if (!state.stick) return new Set();
      const stickerId = state.stick.checkOrder[state.stick.checkIndex];
      if (playerId === stickerId) return filled;
    }

    return new Set();
  }

  function getRevealedSlots(playerId: string): Set<number> {
    const { phase } = state;
    // Reveal drawn card display area — cards in hand stay face-down
    if (
      (phase === 'special-peek-reveal' || phase === 'special-bk-reveal') &&
      state.special?.firstRef?.playerId === playerId
    ) {
      return new Set([state.special.firstRef.slotIndex]);
    }
    return new Set();
  }

  function handleSelectSlot(ref: CardRef) {
    if (state.phase === 'turn-drawn') {
      dispatch({ type: 'SWAP_DRAWN_WITH_SLOT', slotIndex: ref.slotIndex });
    } else {
      dispatch({ type: 'SELECT_CARD', ref });
    }
  }

  // ── Determine phase-specific instruction text ──────────────────────────────
  function getInstruction(): string {
    const name = currentPlayer.name;
    switch (state.phase) {
      case 'turn-idle':
        return `${name}: draw a card or call Cambio.`;
      case 'turn-drawn':
        return `${name}: discard the drawn card (triggers ability), or tap one of your cards to swap it in.`;
      case 'special-look-own':
        return `${name}: tap one of your face-down cards to peek at it.`;
      case 'special-look-other':
        return `${name}: tap any opponent's face-down card to peek at it.`;
      case 'special-peek-reveal':
        return 'Memorise this card, then dismiss it.';
      case 'special-blind-1':
        return `${name}: tap the first card to swap (any player).`;
      case 'special-blind-2':
        return `${name}: tap the second card to complete the swap.`;
      case 'special-bk-look':
        return `${name} (Black King): tap any card to look at it.`;
      case 'special-bk-reveal':
        return 'Memorise this card. Swap it with one of your own, or skip.';
      case 'special-bk-switch':
        return `${name}: tap one of your own cards to swap with the looked card.`;
      case 'stick-offer': {
        const stickerId = state.stick?.checkOrder[state.stick.checkIndex];
        const stickerName = state.players.find((p) => p.id === stickerId)?.name ?? '';
        return `${stickerName}: do you want to stick on this discard (${topDiscard?.rank})?`;
      }
      case 'stick-select': {
        const stickerId = state.stick?.checkOrder[state.stick.checkIndex];
        const stickerName = state.players.find((p) => p.id === stickerId)?.name ?? '';
        return `${stickerName}: tap the card you think matches (${topDiscard?.rank}).`;
      }
      case 'stick-give': {
        const stickerId = state.stick?.checkOrder[state.stick.checkIndex];
        const stickerName = state.players.find((p) => p.id === stickerId)?.name ?? '';
        return `${stickerName}: tap one of your cards to give to the other player.`;
      }
      default:
        return '';
    }
  }

  const instruction = getInstruction();

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
          {state.turnsLeftAfterCambio} turn{state.turnsLeftAfterCambio !== 1 ? 's' : ''} remaining.
        </div>
      )}

      {/* Instruction bar */}
      {instruction && <div className={styles.instruction}>{instruction}</div>}

      {/* Opponents */}
      <div className={styles.opponents}>
        {state.players
          .filter((p) => p.id !== currentPlayer.id)
          .map((p) => (
            <PlayerHand
              key={p.id}
              player={p}
              revealedSlots={getRevealedSlots(p.id)}
              selectableSlots={getSelectableSlots(p.id)}
              onSelectSlot={handleSelectSlot}
              compact
            />
          ))}
      </div>

      {/* Centre table area */}
      <div className={styles.table}>
        {/* Deck */}
        <div className={styles.pileGroup}>
          <div className={styles.pileLabel}>Draw pile</div>
          <div
            className={`${styles.deckPile} ${state.phase === 'turn-idle' ? styles.deckSelectable : ''}`}
            onClick={() => state.phase === 'turn-idle' && dispatch({ type: 'DRAW_CARD' })}
            role="button"
            aria-label={`Draw pile (${state.deck.length} cards)`}
            tabIndex={state.phase === 'turn-idle' ? 0 : -1}
            onKeyDown={(e) => e.key === 'Enter' && state.phase === 'turn-idle' && dispatch({ type: 'DRAW_CARD' })}
          >
            {state.deck.length > 0 ? (
              <>
                {/* Slight stack illusion */}
                <div className={styles.deckShadow} />
                <Card card={state.deck[0]} faceUp={false} />
              </>
            ) : (
              <div className={styles.emptyPile}>Empty</div>
            )}
          </div>
          <div className={styles.deckCount}>{state.deck.length} left</div>
        </div>

        {/* Discard */}
        <div className={styles.pileGroup}>
          <div className={styles.pileLabel}>Discard pile</div>
          <Card card={topDiscard} faceUp={true} />
        </div>

        {/* Drawn card (if any) */}
        {state.drawnCard && (
          <div className={styles.pileGroup}>
            <div className={styles.pileLabel}>You drew</div>
            <Card card={state.drawnCard} faceUp={true} />
            <div className={styles.drawnActions}>
              <button
                className={styles.actionBtn}
                onClick={() => dispatch({ type: 'DISCARD_DRAWN' })}
              >
                Discard it
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Special reveal modal */}
      {(state.phase === 'special-peek-reveal' || state.phase === 'special-bk-reveal') &&
        state.special?.revealedCard && (
          <div className={styles.revealModal}>
            <p className={styles.revealTitle}>Your peek</p>
            <Card card={state.special.revealedCard} faceUp={true} />
            <div className={styles.revealActions}>
              <button
                className={styles.actionBtn}
                onClick={() => dispatch({ type: 'DONE_VIEWING' })}
              >
                Got it
              </button>
              {state.phase === 'special-bk-reveal' && (
                <button
                  className={styles.actionBtnSecondary}
                  onClick={() => dispatch({ type: 'SKIP_BK_SWITCH' })}
                >
                  Skip swap
                </button>
              )}
            </div>
          </div>
        )}

      {/* Stick offer controls */}
      {state.phase === 'stick-offer' && (
        <div className={styles.stickControls}>
          <button
            className={styles.actionBtn}
            onClick={() => dispatch({ type: 'STICK_RESPONSE', wants: true })}
          >
            Yes, stick!
          </button>
          <button
            className={styles.actionBtnSecondary}
            onClick={() => dispatch({ type: 'STICK_RESPONSE', wants: false })}
          >
            Pass
          </button>
        </div>
      )}

      {/* Cambio / turn-idle actions */}
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

      {/* Current player's hand */}
      <div className={styles.currentHand}>
        <PlayerHand
          player={currentPlayer}
          revealedSlots={getRevealedSlots(currentPlayer.id)}
          selectableSlots={getSelectableSlots(currentPlayer.id)}
          onSelectSlot={handleSelectSlot}
          showLabel={true}
        />
      </div>
    </div>
  );
}
