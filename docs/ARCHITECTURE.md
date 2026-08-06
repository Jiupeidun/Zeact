# Zeact architecture

Zeact is a React 18 companion, not a renderer and not a React fork. React owns
reconciliation, effects and concurrent rendering. Zeact owns the high-frequency
data boundary between an application and React.

## Design rules

1. Keep mutable, high-frequency sources outside React state.
2. Expose immutable, cached snapshots through `useSyncExternalStore`.
3. Subscribe at the smallest useful key: message, symbol or media element.
4. Coalesce visual updates to animation frames and background work to idle time.
5. Preserve user intent: chat scroll anchoring beats automatic follow-to-bottom.
6. Browser-only APIs need deterministic server snapshots or explicit fallbacks.

## Packages

- `@kertin/zeact/hooks`: callback stability, frame state, element size and visibility.
- `@kertin/zeact/chat`: variable-height anchored windowing for message timelines.
- `@kertin/zeact/trade`: keyed quote store, fixed-memory timelines and an imperative Canvas chart hook.
- `@kertin/zeact/live`: media state subscriptions and video-frame sampling.

## Non-goals

- Reimplementing the React virtual DOM.
- Depending on React internals or undocumented scheduler APIs.
- Providing a general application state manager.
- Hiding browser media restrictions or transport/network concerns.

## Market rendering pipeline

Quote transport and React rendering are intentionally separated:

1. `QuoteStore` coalesces websocket bursts once per animation frame.
2. `useQuoteTimeline` appends one symbol to a fixed-capacity typed-array ring.
3. `useRealtimeLineChart` reads the ring imperatively and paints Canvas.
4. `useChartControls` handles low-frequency UI state such as mode and window.

Line, candles, multi-series, depth bands, annotations and effects share one
coordinate system. None of these visual layers require a React update per tick.
