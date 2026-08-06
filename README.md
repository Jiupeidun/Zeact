# Zeact

> React 18 primitives for high-frequency interfaces: chat timelines, market data, and live media.

Zeact is an independently implemented TypeScript toolkit built on React 18. It provides focused hooks, stores, and headless-friendly components for interfaces that receive frequent updates and must remain responsive under load.

[Live demo](https://jiupeidun.github.io/Zeact/) · [Source code](https://github.com/Jiupeidun/Zeact)

Zeact is **not** a React fork, renderer, or replacement. It uses React's public APIs and concentrates scene-specific performance policies in reusable modules.

> [!IMPORTANT]
> Zeact is currently an experimental `0.x` project. The package is not yet published and `package.json` remains private while the public API is being stabilized. APIs may change before the first stable release.

## Why Zeact?

General-purpose state and rendering patterns are often sufficient for ordinary pages. High-frequency products have a different failure profile:

- Chat feeds must preserve the reader's visual position while messages arrive, prepend, or change height.
- Trading screens must ingest rapid updates without forcing an entire table or dashboard to re-render.
- Real-time charts need bounded histories, predictable animation scheduling, and explicit viewport controls.
- Live players need frame-level callbacks, latency estimation, and media state that stays synchronized with the element.

Zeact packages these concerns as composable React 18 primitives instead of imposing an application framework.

## Packages

| Entry point | Purpose | Main exports |
| --- | --- | --- |
| `@kertin/zeact` | Core and general hooks | Core utilities, `useLatest`, `useRafState`, `useStableCallback` |
| `@kertin/zeact/hooks` | Browser and scheduling hooks | `useElementSize`, `usePageVisibility`, `useReducedMotion` |
| `@kertin/zeact/chat` | Anchored virtual timelines | `VirtualChatList`, `useAnchoredVirtualList`, `SizeIndex` |
| `@kertin/zeact/trade` | External quote stores and charts | `createQuoteStore`, quote hooks, `RealtimeLineChart`, chart hooks |
| `@kertin/zeact/live` | Live-media synchronization | `useMediaState`, `useLiveLatency`, `useVideoFrames` |

The package exposes both ESM and CommonJS builds and ships TypeScript declarations.

## Requirements

- Node.js 20 or newer for development
- React 18.2 or newer, but lower than React 19
- React DOM 18.2 or newer, but lower than React 19
- A modern browser for DOM- and media-dependent hooks

## Getting started

The repository is currently intended for source development and local evaluation.

```bash
npm ci
npm run check
npm run dev
```

To consume a local build from another project:

```bash
npm run build
cd /path/to/your-app
npm install /absolute/path/to/zeact
```

After the first public release, the intended installation command is:

```bash
npm install @kertin/zeact react react-dom
```

Do not rely on that registry command until the package is marked public and a release is announced.

## Usage

### Anchored virtual chat

`VirtualChatList` renders the visible window plus overscan, measures variable-height rows, and preserves the viewport when content is prepended or resized.

```tsx
import { VirtualChatList } from '@kertin/zeact/chat';

type Message = {
  id: string;
  author: string;
  body: string;
};

export function Conversation({ messages }: { messages: Message[] }) {
  return (
    <VirtualChatList
      items={messages}
      getKey={(message) => message.id}
      estimateSize={64}
      overscan={8}
      followOutputThreshold={48}
      style={{ height: 480 }}
      renderItem={({ item: message }) => (
        <article>
          <strong>{message.author}</strong>
          <p>{message.body}</p>
        </article>
      )}
    />
  );
}
```

Use `useAnchoredVirtualList` directly when you need complete control over markup, scrolling containers, or row composition.

### Selective market-data subscriptions

The quote store uses React's external-store contract. Components subscribe to a symbol or selector rather than to the complete feed.

```tsx
import { createQuoteStore, useQuoteSelector } from '@kertin/zeact/trade';

type Quote = {
  symbol: string;
  price: number;
  changePercent: number;
  timestamp: number;
};

export const quoteStore = createQuoteStore<Quote>();

export function PriceCell({ symbol }: { symbol: string }) {
  const price = useQuoteSelector(
    quoteStore,
    symbol,
    (quote) => quote?.price,
  );

  return <output>{price?.toFixed(2) ?? '—'}</output>;
}

quoteStore.push({
  symbol: 'BTC/USDT',
  price: 65240.5,
  changePercent: 1.82,
  timestamp: Date.now(),
});
```

Feed transport is deliberately outside the store. WebSocket, Server-Sent Events, polling, replay, or test fixtures can all call the same ingestion API.

### Real-time line charts

Zeact includes primitives for bounded time series, animation-frame rendering, live-follow behavior, pan, zoom, pause, reset, crosshair inspection, grid lines, and canvas resizing.

```tsx
import {
  RealtimeLineChart,
  useQuoteTimeline,
} from '@kertin/zeact/trade';

import { quoteStore } from './quote-store';

export function MarketChart({ symbol }: { symbol: string }) {
  const series = useQuoteTimeline(quoteStore, symbol, {
    selectValue: (quote) => quote.price,
    selectTime: (quote) => quote.timestamp / 1_000,
    capacity: 1_200,
  });

  return (
    <div style={{ height: 320 }}>
      <RealtimeLineChart
        series={series}
        grid
        crosshair
        windowSeconds={30}
      />
    </div>
  );
}
```

Time values are Unix seconds. Convert millisecond timestamps before adding them to a series. Lower-level APIs such as `createRealtimeSeries`, `useChartControls`, and `useRealtimeLineChart` are available for custom renderers and controls.

### Live-media state and latency

The live module reads state from the media element, estimates distance from the live edge, and exposes frame callbacks with a safe fallback when `requestVideoFrameCallback` is unavailable.

```tsx
import { useState } from 'react';
import {
  useLiveLatency,
  useMediaState,
  useVideoFrames,
} from '@kertin/zeact/live';

export function LivePlayer({ src }: { src: string }) {
  const [video, setVideo] = useState<HTMLVideoElement | null>(null);
  const media = useMediaState(video);
  const latency = useLiveLatency(video, 6);

  useVideoFrames(video, ({ mediaTime }) => {
    // Synchronize captions, overlays, or telemetry with the decoded frame.
    void mediaTime;
  });

  return (
    <section>
      <video ref={setVideo} src={src} controls playsInline />
      <output>
        {media.paused ? 'Paused' : 'Playing'} ·{' '}
        {latency.latency === undefined
          ? 'Live edge unavailable'
          : `${latency.latency.toFixed(1)}s behind live`}
        {latency.isBehind ? ' · Catch-up recommended' : ''}
      </output>
    </section>
  );
}
```

### Animation-frame state

`useRafState` coalesces multiple updates into at most one React state update per animation frame.

```tsx
import { useRafState } from '@kertin/zeact/hooks';

export function PointerReadout() {
  const [point, setPoint] = useRafState({ x: 0, y: 0 });

  return (
    <div onPointerMove={(event) => setPoint({ x: event.clientX, y: event.clientY })}>
      {point.x}, {point.y}
    </div>
  );
}
```

## Design principles

1. **Subscribe narrowly.** A consumer should update only when the data it reads changes.
2. **Schedule intentionally.** Frame-bound work is coalesced; ingestion and rendering do not have to share a cadence.
3. **Keep histories bounded.** Streaming data structures must have explicit memory limits.
4. **Preserve user context.** New messages and market ticks should not unexpectedly move a user's viewport.
5. **Prefer public React contracts.** Zeact builds on React 18 APIs instead of patching React internals.
6. **Remain transport-agnostic.** Data sources and media delivery choices belong to the host application.

For implementation boundaries and data-flow details, see [Architecture](./docs/ARCHITECTURE.md).

## Server rendering and browser behavior

Zeact can be imported in server-rendered applications, but several features only become active in the browser:

- Element measurement and virtualization require layout information.
- Canvas rendering requires a browser canvas implementation.
- Media hooks require an `HTMLMediaElement` or `HTMLVideoElement`.
- Page visibility and reduced-motion hooks depend on browser APIs.

Create browser elements after mount and pass `null` until a ref is available. Applications using React Server Components should place stateful Zeact consumers behind a client-component boundary.

Zeact targets current evergreen browsers. `ResizeObserver` is required for element measurement. Frame callbacks use `requestVideoFrameCallback` when available and otherwise fall back to animation-frame scheduling.

## API stability

Zeact follows semantic versioning once releases begin. During `0.x` development:

- Breaking API changes may appear in minor releases.
- New behavior should include tests and documentation.
- Deprecation notices will be preferred when migration is practical.

Avoid importing internal source paths. Only the documented package entry points are considered public API candidates.

## Development

| Command | Description |
| --- | --- |
| `npm run dev` | Start the Vite example application |
| `npm run build` | Build ESM, CommonJS, and declaration output |
| `npm test` | Run the test suite once |
| `npm run test:watch` | Run tests in watch mode |
| `npm run typecheck` | Type-check the project without emitting files |
| `npm run check` | Run type-checking, tests, and the production build |

Before proposing a change, run:

```bash
npm run check
```

## Performance claims

Zeact is designed around bounded work, narrow subscriptions, and controlled scheduling. The project does not currently publish benchmark numbers, so no throughput or frame-rate guarantees should be inferred.

Future benchmarks should include reproducible hardware, browser, dataset, interaction, and comparison details. Changes presented as performance improvements should also include a regression test or measurable profile where practical.

## Contributing

Contributions are welcome while the API is taking shape.

1. Create a focused branch from the current default branch.
2. Keep changes scoped and add or update tests for observable behavior.
3. Update this README or architecture documentation when public behavior changes.
4. Run `npm run check` locally.
5. Open a pull request that explains the problem, approach, trade-offs, and verification performed.

Please discuss large API additions before implementing them. Bug reports should include a minimal reproduction, React and browser versions, expected behavior, and actual behavior. Performance reports should also include a trace or repeatable scenario.

By contributing, you agree that your contributions will be licensed under the project's MIT License.

## Roadmap

- Stabilize the initial hooks and package entry points.
- Add automated CI for supported Node.js and React versions.
- Publish reproducible chat, market-feed, chart, and live-player benchmarks.
- Expand accessibility coverage for example components and interactions.
- Add integration fixtures for SSR and common React application frameworks.
- Publish `@kertin/zeact` after the release and security processes are ready.

Roadmap items describe intent, not a release commitment.

## Security

Zeact has not completed a production security review. Do not include secrets in bug reports or reproducible examples. A private vulnerability-reporting channel and security policy will be published before the first public release.

## Independent implementation

Zeact is developed from first principles around publicly observable product requirements and documented platform APIs. It does not copy React internals or third-party project source code. Similarities in capabilities reflect common requirements of real-time interfaces, not shared implementation.

## License

Licensed under the [MIT License](./LICENSE).
