import { useRef, useEffect, useLayoutEffect } from 'react';
import type { CardRef, GameState } from '../types/game';
import type { GameAction } from '../store/actions';
import Card from './Card';
import PlayerHand from './PlayerHand';
import styles from './GameBoard.module.css';

interface Props {
  state: GameState;
  dispatch: React.Dispatch<GameAction>;
  /**
   * undefined  → local play (no identity; show everything)
   * null       → online play, player ID not yet assigned (hide sensitive info)
   * string     → online play, assigned player ID
   */
  myPlayerId?: string | null;
}

export default function GameBoard({ state, dispatch, myPlayerId }: Props) {
  // undefined = local play: treat every action as "my turn" so nothing is hidden.
  // null      = online but not yet assigned: default to hiding (safer than revealing).
  // string    = online assigned: only true when it's actually this player's turn.
  const isMyTurn =
    myPlayerId === undefined
      ? true
      : myPlayerId !== null && state.players[state.currentPlayerIndex]?.id === myPlayerId;
  const notifTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  // FLIP animation state
  const prevCardPositions = useRef<Map<string, DOMRect>>(new Map());
  const prevLastActionKey = useRef<string>('');
  const prevDiscardTopId = useRef<string | null>(null);

  useEffect(() => {
    if (state.notification) {
      if (notifTimeout.current) clearTimeout(notifTimeout.current);
      notifTimeout.current = setTimeout(() => dispatch({ type: 'CLEAR_NOTIFICATION' }), 3000);
    }
  }, [state.notification, dispatch]);

  const currentPlayer = state.players[state.currentPlayerIndex];
  const topDiscard = state.discardPile[0] ?? null;

  // ── Which slots are selectable for a given player ─────────────────────────
  function flipCard(cardId: string) {
    const from = prevCardPositions.current.get(cardId);
    if (!from) return;
    const el = document.querySelector(`[data-card-id="${cardId}"]`) as HTMLElement | null;
    if (!el) return;
    const to = el.getBoundingClientRect();
    const dx = from.left - to.left;
    const dy = from.top - to.top;
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
    el.style.transition = 'none';
    el.style.transform = `translate(${dx}px, ${dy}px)`;
    el.style.zIndex = '50';
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        el.style.transition = 'transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)';
        el.style.transform = '';
        setTimeout(() => { el.style.zIndex = ''; }, 550);
      });
    });
  }

  // Runs after every render. Detects card movements via lastActionRefs and discard pile
  // changes, then animates using positions stored from the previous render.
  useLayoutEffect(() => {
    const actionKey = JSON.stringify(state.lastActionRefs);
    const discardTopId = state.discardPile[0]?.id ?? null;

    // Animate cards that moved to new hand slots (swap/keep actions)
    if (actionKey !== prevLastActionKey.current && state.lastActionRefs.length > 0) {
      state.lastActionRefs.forEach(({ playerId, slotIndex }) => {
        const card = state.players.find((p) => p.id === playerId)?.hand[slotIndex];
        if (card) flipCard(card.id);
      });
    }

    // Animate card that just arrived at the top of the discard pile
    if (discardTopId && discardTopId !== prevDiscardTopId.current) {
      flipCard(discardTopId);
    }

    prevLastActionKey.current = actionKey;
    prevDiscardTopId.current = discardTopId;

    // Snapshot positions of all visible cards for the next render's FLIP
    const snapshot = prevCardPositions.current;
    state.players.forEach((p) =>
      p.hand.forEach((c) => {
        if (!c) return;
        const el = document.querySelector(`[data-card-id="${c.id}"]`) as HTMLElement | null;
        if (el) snapshot.set(c.id, el.getBoundingClientRect());
      }),
    );
    if (state.drawnCard) {
      const el = document.querySelector(`[data-card-id="${state.drawnCard.id}"]`) as HTMLElement | null;
      if (el) snapshot.set(state.drawnCard.id, el.getBoundingClientRect());
    }
    if (state.discardPile[0]) {
      const el = document.querySelector(`[data-card-id="${state.discardPile[0].id}"]`) as HTMLElement | null;
      if (el) snapshot.set(state.discardPile[0].id, el.getBoundingClientRect());
    }
  });

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
    if (phase === 'special-bk-look' && playerId !== currentId) return filled;
    if (phase === 'special-bk-switch') return filled;
    if (phase === 'special-bk-swap-2') {
      const first = state.special?.firstRef;
      if (!first) return filled;
      return new Set([...filled].filter((i) => !(playerId === first.playerId && i === first.slotIndex)));
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
    // In online mode, use "You" when addressing the active player directly.
    const you = isMyTurn ? 'You' : name;
    const your = isMyTurn ? 'your' : `${name}'s`;
    switch (state.phase) {
      case 'turn-idle':
        return isMyTurn
          ? `Your turn — draw a card or call Cambio.`
          : `${name}'s turn — draw a card or call Cambio.`;
      case 'turn-drawn':
        return `${you}: discard the drawn card (use its ability), or hide it and swap it into ${your} hand.`;
      case 'turn-drawn-selecting':
        return `${you}: tap one of ${your} cards to swap the drawn card in (the card there will be discarded).`;
      case 'special-look-own':
        return `${you}: tap one of ${your} face-down cards to peek at it.`;
      case 'special-look-other':
        return `${you}: tap any opponent's face-down card to peek at it.`;
      case 'special-peek-reveal':
        return `${you}: memorise this card, then dismiss it.`;
      case 'special-blind-1':
        return `${you}: tap the first card to blind-swap (any player).`;
      case 'special-blind-2':
        return `${you}: tap the second card to complete the swap.`;
      case 'special-bk-look':
        return `${you} (Black King): tap any opponent's card to look at it.`;
      case 'special-bk-reveal':
        return `${you}: memorise this card. Then swap any two cards, or skip.`;
      case 'special-bk-switch':
        return `${you}: tap the first card to swap (any player).`;
      case 'special-bk-swap-2':
        return `${you}: tap the second card to complete the swap.`;
      case 'snap-window': {
        const rank = topDiscard?.rank ?? '?';
        return `${rank} discarded! Tap "Snap!" if you have a matching card.`;
      }
      case 'snap-select': {
        const snaperName = state.players.find((p) => p.id === state.snap?.claimedBy)?.name ?? '';
        const isMySnap = myPlayerId ? state.snap?.claimedBy === myPlayerId : true;
        return isMySnap
          ? `You snapped — tap the card you think matches the ${topDiscard?.rank}.`
          : `${snaperName} snapped — they're choosing a card to match the ${topDiscard?.rank}.`;
      }
      case 'snap-give': {
        const snaperName = state.players.find((p) => p.id === state.snap?.claimedBy)?.name ?? '';
        const isMySnap = myPlayerId ? state.snap?.claimedBy === myPlayerId : true;
        return isMySnap
          ? `You: tap one of your cards to give to the other player.`
          : `${snaperName}: choosing a card to give away.`;
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
                highlightedSlots={(() => {
                  const slots = state.lastActionRefs
                    .filter((ref) => ref.playerId === player.id)
                    .map((ref) => ref.slotIndex);
                  return slots.length > 0 ? new Set(slots) : undefined;
                })()}
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
            disabled={state.phase !== 'turn-idle' || state.deck.length === 0 || !isMyTurn}
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
            {isMyTurn ? (
              <>
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
              </>
            ) : (
              <>
                <div className={styles.pileLabel}>{currentPlayer.name} drew</div>
                <Card card={state.drawnCard} faceUp={false} />
              </>
            )}
          </div>
        )}
        {state.drawnCard && state.phase === 'turn-drawn-selecting' && (
          <div className={styles.pileGroup}>
            <div className={styles.pileLabel}>
              {isMyTurn ? 'Your drawn card' : `${currentPlayer.name}'s drawn card`}
            </div>
            <Card card={state.drawnCard} faceUp={false} />
          </div>
        )}
      </div>

      {/* Special peek reveal modal — only shown to the acting player in online mode */}
      {(state.phase === 'special-peek-reveal' || state.phase === 'special-bk-reveal') &&
        state.special?.revealedCard &&
        isMyTurn && (
          <div className={styles.revealModal}>
            <p className={styles.revealTitle}>Your peek</p>
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

      {/* Waiting indicator for non-acting players during a peek reveal */}
      {(state.phase === 'special-peek-reveal' || state.phase === 'special-bk-reveal') &&
        !isMyTurn && (
          <div className={styles.revealModal}>
            <p className={styles.revealTitle}>{currentPlayer.name} is peeking…</p>
          </div>
        )}

      {/* ── Snap window ──────────────────────────────────────────────────── */}
      {state.phase === 'snap-window' && state.snap && (
        <div className={styles.snapWindow}>
          <div className={styles.snapTop}>
            <span className={styles.snapTitle}>
              Snap on <strong>{topDiscard?.rank}</strong>?
            </span>
            {myPlayerId ? (
              <span className={styles.snapSub}>Tap "Snap!" to claim the window.</span>
            ) : (
              <span className={styles.snapSub}>First to tap their name wins the window!</span>
            )}
          </div>
          <div className={styles.snapButtons}>
            {myPlayerId ? (
              // Online mode: each player only claims for themselves.
              <button
                className={styles.snapPlayerBtn}
                onClick={() => dispatch({ type: 'CLAIM_SNAP', playerId: myPlayerId })}
              >
                Snap!
              </button>
            ) : (
              // Local mode: show all player name buttons.
              state.snap.eligibleIds.map((pid) => {
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
              })
            )}
            {myPlayerId ? (
              // Online: each player passes individually; window closes when all have passed.
              (() => {
                const hasPassed = state.snap.passedIds.includes(myPlayerId);
                const passedCount = state.snap.passedIds.length;
                const totalCount = state.snap.eligibleIds.length;
                return (
                  <button
                    className={styles.actionBtnSecondary}
                    onClick={() => dispatch({ type: 'SKIP_SNAP', playerId: myPlayerId })}
                    disabled={hasPassed}
                  >
                    {hasPassed
                      ? `Passed (${passedCount}/${totalCount})`
                      : 'Pass'}
                  </button>
                );
              })()
            ) : (
              // Local: close immediately.
              <button
                className={styles.actionBtnSecondary}
                onClick={() => dispatch({ type: 'SKIP_SNAP' })}
              >
                No one snaps
              </button>
            )}
          </div>
        </div>
      )}

      {/* Cambio button — only the active player can call it */}
      {state.phase === 'turn-idle' && !state.cambioCallerId && isMyTurn && (
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
