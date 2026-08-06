import { StrictMode, memo, useEffect, useMemo, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { VirtualChatList } from '@kertin/zeact/chat';
import {
  createQuoteStore,
  createRealtimeSeries,
  RealtimeLineChart,
  useQuote,
  useQuoteTimeline,
} from '@kertin/zeact/trade';
import { useLiveLatency, useMediaState, useVideoFrames } from '@kertin/zeact/live';
import './styles.css';

interface Message {
  id: number;
  author: string;
  text: string;
  time: string;
  tone: 'blue' | 'green' | 'purple';
}

interface Quote {
  symbol: string;
  name: string;
  price: number;
  change: number;
}

const symbols = ['BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'TON/USDT'] as const;
const quoteStore = createQuoteStore<Quote>([
  { symbol: 'BTC/USDT', name: 'Bitcoin', price: 68_421.12, change: 2.41 },
  { symbol: 'ETH/USDT', name: 'Ethereum', price: 3_842.08, change: 1.17 },
  { symbol: 'SOL/USDT', name: 'Solana', price: 172.64, change: -0.82 },
  { symbol: 'TON/USDT', name: 'Toncoin', price: 6.42, change: 3.06 },
]);

const authors = ['Kertin', 'Nora', 'Evan', 'Mina'];
const messageBodies = [
  'The BTC feed is moving again — chart stayed smooth through the burst.',
  'Pinned the latest execution trace for review.',
  'Virtual rows are holding their anchor while history loads.',
  'Live overlay is synced to the decoded frame.',
  'Only the affected price cell rendered on that tick.',
];

const initialMessages: Message[] = Array.from({ length: 2_000 }, (_, index) => ({
  id: index + 1,
  author: authors[index % authors.length]!,
  text: messageBodies[index % messageBodies.length]!,
  time: `${String(9 + Math.floor((index % 180) / 60)).padStart(2, '0')}:${String(index % 60).padStart(2, '0')}`,
  tone: (['blue', 'green', 'purple'] as const)[index % 3]!,
}));

const predictionLayers = [
  { id: 'yes', label: 'Yes', color: '#78f6ca', series: createRealtimeSeries(1_024) },
  { id: 'no', label: 'No', color: '#ff7a9c', series: createRealtimeSeries(1_024) },
  { id: 'undecided', label: 'Undecided', color: '#8ea6ff', series: createRealtimeSeries(1_024) },
];

function BrandMark() {
  return <span className="brand-mark" aria-hidden="true">Z</span>;
}

const QuoteRow = memo(function QuoteRow({ symbol }: { symbol: string }) {
  const quote = useQuote(quoteStore, symbol);
  const positive = (quote?.change ?? 0) >= 0;

  return (
    <div className="quote-row">
      <span className="asset-icon">{symbol.slice(0, 1)}</span>
      <span className="asset-name"><strong>{symbol.split('/')[0]}</strong><small>{quote?.name}</small></span>
      <span className="quote-price">${quote?.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
      <span className={positive ? 'change up' : 'change down'}>
        {positive ? '+' : ''}{quote?.change.toFixed(2)}%
      </span>
    </div>
  );
});

function MarketChart() {
  const series = useQuoteTimeline(quoteStore, 'BTC/USDT', {
    capacity: 2_048,
    selectValue: (quote) => quote.price,
  });

  return (
    <div className="chart-shell">
      <div className="chart-heading">
        <div>
          <span className="eyebrow">BTC / USDT</span>
          <strong>$68,421.12</strong>
        </div>
        <span className="live-pill"><i /> Live</span>
      </div>
      <div className="market-chart">
        <RealtimeLineChart
          series={series}
          color="#78f6ca"
          theme="dark"
          grid
          area
          crosshair
          curve="soft"
          windows={[
            { label: '10s', seconds: 10 },
            { label: '30s', seconds: 30 },
            { label: '1m', seconds: 60 },
          ]}
          windowStyle="text"
          momentum
          pulse
          showValue
          valueMomentumColor
          formatValue={(value) => `$${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`}
        />
      </div>
    </div>
  );
}

function PredictionChart() {
  useEffect(() => {
    let yes = 48;
    let no = 34;
    const push = () => {
      const time = Date.now() / 1_000;
      yes = Math.min(76, Math.max(16, yes + (Math.random() - 0.48) * 3));
      no = Math.min(70, Math.max(10, no + (Math.random() - 0.52) * 2.4));
      const undecided = Math.max(2, 100 - yes - no);
      predictionLayers[0]!.series.append({ time, value: yes });
      predictionLayers[1]!.series.append({ time, value: no });
      predictionLayers[2]!.series.append({ time, value: undecided });
    };
    push();
    const timer = window.setInterval(push, 180);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <section className="panel prediction-panel">
      <div className="panel-heading">
        <div><span className="eyebrow">MULTI-SERIES</span><h2>Prediction stream</h2></div>
        <span className="status-badge">3 sources</span>
      </div>
      <div className="prediction-question">Will real-time interfaces become the default?</div>
      <div className="market-chart prediction-chart">
        <RealtimeLineChart
          series={predictionLayers[0]!.series}
          layers={predictionLayers}
          windows={[{ label: '15s', seconds: 15 }, { label: '30s', seconds: 30 }]}
          windowStyle="text"
          badge={false}
          area={false}
          grid
          crosshair
          formatValue={(value) => `${value.toFixed(1)}%`}
        />
      </div>
      <div className="legend">
        {predictionLayers.map((layer) => <span key={layer.id}><i style={{ background: layer.color }} />{layer.label}</span>)}
      </div>
    </section>
  );
}

function LiveDemo() {
  const [video, setVideo] = useState<HTMLVideoElement | null>(null);
  const [frame, setFrame] = useState({ mediaTime: 0, presentedFrames: 0 });
  const media = useMediaState(video);
  const edge = useLiveLatency(video, 3);

  useVideoFrames(video, ({ mediaTime, presentedFrames }) => {
    setFrame({ mediaTime, presentedFrames: presentedFrames ?? 0 });
  }, { maxFps: 4 });

  return (
    <section className="panel media-panel">
      <div className="panel-heading">
        <div><span className="eyebrow">FRAME-AWARE</span><h2>Live media primitives</h2></div>
        <span className="status-badge">rVFC</span>
      </div>
      <div className="video-shell">
        <video
          ref={setVideo}
          controls
          muted
          playsInline
          loop
          poster="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='960' height='540'%3E%3Crect width='100%25' height='100%25' fill='%23090d14'/%3E%3C/svg%3E"
          src="https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4"
        />
        <span className="video-label"><i /> Frame synchronized</span>
      </div>
      <div className="media-stats">
        <span><small>STATE</small><strong>{media.paused ? 'Paused' : 'Playing'}</strong></span>
        <span><small>MEDIA TIME</small><strong>{frame.mediaTime.toFixed(2)}s</strong></span>
        <span><small>FRAMES</small><strong>{frame.presentedFrames || '—'}</strong></span>
        <span><small>EDGE GAP</small><strong>{edge.latency?.toFixed(2) ?? '—'}s</strong></span>
      </div>
    </section>
  );
}

function ChatDemo() {
  const [messages, setMessages] = useState(initialMessages);
  const renderedMessages = useMemo(() => messages, [messages]);

  const appendMessage = () => setMessages((current) => [...current, {
    id: current.length + 1,
    author: 'Kertin',
    text: `Message ${current.length + 1} arrived without disturbing the viewport.`,
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    tone: 'blue',
  }]);

  return (
    <section className="panel chat-panel">
      <div className="panel-heading">
        <div><span className="eyebrow">ANCHORED VIRTUALIZATION</span><h2>Conversation stream</h2></div>
        <button className="action-button" type="button" onClick={appendMessage}>Add message</button>
      </div>
      <div className="chat-meta"><span><i /> # market-talk</span><span>{messages.length.toLocaleString()} messages</span></div>
      <VirtualChatList
        items={renderedMessages}
        getKey={(message) => message.id}
        estimateSize={72}
        overscan={7}
        className="chat"
        renderItem={({ item }) => (
          <article className="message">
            <span className={`avatar ${item.tone}`}>{item.author[0]}</span>
            <span className="message-copy">
              <span><b>{item.author}</b><time>{item.time}</time></span>
              <span>{item.text}</span>
            </span>
          </article>
        )}
      />
    </section>
  );
}

function App() {
  useEffect(() => {
    const timer = window.setInterval(() => {
      const symbol = symbols[Math.floor(Math.random() * symbols.length)]!;
      const current = quoteStore.get(symbol)!;
      const movement = (Math.random() - 0.495) * Math.max(0.08, current.price * 0.0003);
      quoteStore.push({
        symbol,
        price: Math.max(0.01, current.price + movement),
        change: current.change + (Math.random() - 0.5) * 0.08,
      });
    }, 8);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <main>
      <nav>
        <a className="brand" href="#top" aria-label="Zeact home"><BrandMark /><span>Zeact</span></a>
        <div className="nav-links">
          <a href="#demos">Demos</a>
          <a href="https://github.com/Jiupeidun/Zeact" target="_blank" rel="noreferrer">GitHub ↗</a>
        </div>
      </nav>

      <header id="top" className="hero">
        <div className="hero-copy">
          <span className="release-pill"><i /> React 18 · Experimental 0.1</span>
          <h1>React primitives for<br /><em>real-time interfaces.</em></h1>
          <p>Purpose-built hooks, stores, and components for chat timelines, market data, live charts, and frame-synchronized media.</p>
          <div className="hero-actions">
            <a className="primary-link" href="#demos">Explore live demos</a>
            <a className="secondary-link" href="https://github.com/Jiupeidun/Zeact#readme" target="_blank" rel="noreferrer">Read the docs</a>
          </div>
        </div>
        <div className="hero-code" aria-label="Code example">
          <div className="code-bar"><span /><span /><span /><small>quote-cell.tsx</small></div>
          <pre><code><span className="code-pink">const</span> price = <span className="code-blue">useQuoteSelector</span>({'('}{'\n'}  store, symbol,{'\n'}  quote =&gt; quote?.price{'\n'}{')'});</code></pre>
          <div className="code-result"><span>BTC / USDT</span><strong>$68,421.12</strong><em>+2.41%</em></div>
          <div className="code-foot"><i /> Only this cell re-rendered</div>
        </div>
      </header>

      <section className="principles" aria-label="Zeact principles">
        <span><strong>01</strong><b>Narrow subscriptions</b><small>Update only what changed</small></span>
        <span><strong>02</strong><b>Frame scheduling</b><small>Coalesce high-frequency work</small></span>
        <span><strong>03</strong><b>Bounded memory</b><small>Predictable streaming histories</small></span>
        <span><strong>04</strong><b>Stable context</b><small>Preserve the user's viewport</small></span>
      </section>

      <section id="demos" className="demo-intro">
        <span className="eyebrow">RUNNING IN YOUR BROWSER</span>
        <h2>Built for the interfaces that never stop.</h2>
        <p>Every panel below is powered by Zeact's public APIs and receives live updates while you interact with it.</p>
      </section>

      <div className="demo-grid">
        <section className="panel market-panel">
          <div className="panel-heading">
            <div><span className="eyebrow">SELECTIVE SUBSCRIPTIONS</span><h2>Market data</h2></div>
            <span className="status-badge">125 ticks/s</span>
          </div>
          <MarketChart />
          <div className="quotes">{symbols.map((symbol) => <QuoteRow key={symbol} symbol={symbol} />)}</div>
        </section>
        <ChatDemo />
        <PredictionChart />
        <LiveDemo />
      </div>

      <section className="cta">
        <BrandMark />
        <h2>Make fast interfaces feel effortless.</h2>
        <p>Zeact is open source, independently implemented, and ready for experimentation.</p>
        <a className="primary-link" href="https://github.com/Jiupeidun/Zeact" target="_blank" rel="noreferrer">View source on GitHub ↗</a>
      </section>

      <footer><span><BrandMark /> Zeact</span><small>MIT licensed · Built on React 18 public APIs</small></footer>
    </main>
  );
}

const demoGlobal = globalThis as typeof globalThis & { __zeactDemoRoot?: Root };
demoGlobal.__zeactDemoRoot ??= createRoot(document.getElementById('root')!);
demoGlobal.__zeactDemoRoot.render(<StrictMode><App /></StrictMode>);
