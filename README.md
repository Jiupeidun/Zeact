# Zeact

[![npm version](https://img.shields.io/npm/v/@kertin/zeact.svg)](https://www.npmjs.com/package/@kertin/zeact)
[![CI](https://github.com/Jiupeidun/Zeact/actions/workflows/ci.yml/badge.svg)](https://github.com/Jiupeidun/Zeact/actions/workflows/ci.yml)
[![license](https://img.shields.io/npm/l/@kertin/zeact.svg)](./LICENSE)

> React 18 primitives for high-frequency interfaces: chat timelines, market data, live media, and lightweight notifications.

Zeact is an experimental TypeScript toolkit built on public React 18 APIs. It provides focused hooks, stores, and headless-friendly components for interfaces that receive frequent updates while staying responsive. It is not a React fork, renderer, or replacement.

[Live demo](https://jiupeidun.github.io/Zeact/) · [Source code](https://github.com/Jiupeidun/Zeact)

## Install

```bash
npm install @kertin/zeact react@18 react-dom@18
```

Requirements: Node.js 20+ for development, React and React DOM 18.2+, and a modern browser for DOM/media features.

## Modules

| Entry point | Use it for |
| --- | --- |
| `@kertin/zeact` | Core utilities and general hooks |
| `@kertin/zeact/hooks` | Element size, visibility, reduced motion, latest values, and frame-coalesced state |
| `@kertin/zeact/chat` | Anchored virtual chat/message timelines |
| `@kertin/zeact/trade` | Quote stores, time series, realtime line charts, and stacked column charts |
| `@kertin/zeact/live` | Media state, live-edge latency, and video-frame callbacks |
| `@kertin/zeact/notify` | Centered Toast notifications |

ESM, CommonJS, and TypeScript declarations are included. Import from the documented entry points; internal source paths are not public API.

## Examples

### Virtual chat

```tsx
import { VirtualChatList } from '@kertin/zeact/chat';

<VirtualChatList
  items={messages}
  getKey={(message) => message.id}
  estimateSize={64}
  overscan={8}
  style={{ height: 480 }}
  renderItem={({ item }) => <article>{item.body}</article>}
/>
```

### Selective quote subscriptions

```tsx
import { createQuoteStore, useQuoteSelector } from '@kertin/zeact/trade';

const quotes = createQuoteStore<Quote>();

function PriceCell({ symbol }: { symbol: string }) {
  const price = useQuoteSelector(quotes, symbol, (quote) => quote?.price);
  return <output>{price?.toFixed(2) ?? '—'}</output>;
}

quotes.push({ symbol: 'BTC/USDT', price: 65240.5, changePercent: 1.82, timestamp: Date.now() });
```

### Centered Toast

Wrap the application once, then call `useToast()` from any descendant. Notifications are centered, accessible, auto-dismissed by default, and can be closed manually.

```tsx
import { ToastProvider, useToast } from '@kertin/zeact/notify';

function SaveButton() {
  const toast = useToast();
  return <button onClick={() => toast.success('Saved successfully')}>Save</button>;
}

function App() {
  return <ToastProvider><SaveButton /></ToastProvider>;
}
```

Available methods: `show(message, options)`, `info`, `success`, `warning`, `error`, and `dismiss(id)`. Options are `type` and `duration` in milliseconds; set `duration: 0` for a persistent notification. `ToastProvider` accepts `duration` and `maxToasts` defaults.

### Live media

```tsx
import { useState } from 'react';
import { useLiveLatency, useMediaState, useVideoFrames } from '@kertin/zeact/live';

function LivePlayer({ src }: { src: string }) {
  const [video, setVideo] = useState<HTMLVideoElement | null>(null);
  const media = useMediaState(video);
  const latency = useLiveLatency(video, 6);
  useVideoFrames(video, ({ mediaTime }) => { /* sync captions or telemetry */ void mediaTime; });
  return <video ref={setVideo} src={src} controls playsInline />;
}
```

## Design principles

- Subscribe narrowly so consumers update only when the data they read changes.
- Coalesce frame-bound work and keep streaming histories bounded.
- Preserve the user's viewport when new chat messages or market ticks arrive.
- Keep transport choices outside the library; WebSocket, SSE, polling, and fixtures can feed the same stores.
- Prefer public React contracts and explicit browser boundaries.

DOM measurement, canvas, media, visibility, and reduced-motion features activate in the browser. Pass `null` until a browser element is available when rendering on the server. `ResizeObserver` is required for element measurement; video frame callbacks fall back to animation frames when unavailable.

## Development

```bash
npm ci
npm run check       # typecheck, tests, build, and package smoke tests
npm run dev         # Vite example application
```

Other useful commands: `npm test`, `npm run typecheck`, `npm run build`, and `npm run check:package`.

## API stability and contribution

Zeact is a `0.x` project, so minor releases may include breaking API changes. Public behavior changes should include tests and documentation. Before opening a PR, keep the change focused, run `npm run check`, and describe the problem, approach, trade-offs, and verification.

The project does not currently publish benchmark numbers; performance claims should include a reproducible profile or regression test. Security reports should follow [SECURITY.md](./SECURITY.md). Licensed under the [MIT License](./LICENSE).
