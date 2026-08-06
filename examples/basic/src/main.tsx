import { StrictMode, memo, useEffect, useMemo, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { VirtualChatList } from '@kertin/zeact/chat';
import {
  createQuoteStore, createRealtimeSeries, RealtimeLineChart, useQuote, useQuoteTimeline,
} from '@kertin/zeact/trade';
import { useLiveLatency, useMediaState } from '@kertin/zeact/live';
import './styles.css';

interface Message { id: number; author: string; text: string }
interface Quote { symbol: string; price: number; change: number }

const initialMessages: Message[] = Array.from({ length: 1_000 }, (_, index) => ({
  id: index + 1,
  author: index % 3 === 0 ? 'Kertin' : `User ${index % 9}`,
  text: index % 7 === 0
    ? '这是一条更长的动态高度消息，用来验证聊天列表在内容换行后的滚动锚点。'
    : `Message ${index + 1}`,
}));

const symbols = ['BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'TON/USDT'];
const quoteStore = createQuoteStore<Quote>(symbols.map((symbol, index) => ({
  symbol,
  price: 100 * (index + 1),
  change: 0,
})));

const predictionLayers = [
  { id: 'yes', label: 'Yes', color: '#5271ff', series: createRealtimeSeries(1_024) },
  { id: 'no', label: 'No', color: '#fb7185', series: createRealtimeSeries(1_024) },
  { id: 'maybe', label: 'Maybe', color: '#fbbf24', series: createRealtimeSeries(1_024) },
];

const QuoteRow = memo(function QuoteRow({ symbol }: { symbol: string }) {
  const quote = useQuote(quoteStore, symbol);
  return (
    <div className="quote-row">
      <strong>{symbol}</strong>
      <span>{quote?.price.toFixed(2)}</span>
      <span className={(quote?.change ?? 0) >= 0 ? 'up' : 'down'}>{quote?.change.toFixed(2)}%</span>
    </div>
  );
});

function MarketChart() {
  const series = useQuoteTimeline(quoteStore, 'BTC/USDT', {
    capacity: 2_048,
    selectValue: (quote) => quote.price,
  });
  return (
    <div className="market-chart">
      <RealtimeLineChart
        series={series}
        color="#7c8cff"
        windows={[{ label: '10s', seconds: 10 }, { label: '30s', seconds: 30 }, { label: '1m', seconds: 60 }]}
        windowStyle="rounded"
        allowModeToggle
        candleSeconds={3}
        momentum
        pulse
        showValue
        valueMomentumColor
        degen={{ particles: 12, shake: 0.8, threshold: 0.004 }}
        referenceLine={{ value: 100, label: 'Baseline' }}
        orderbook={{
          bids: [[98, 12], [96, 7]],
          asks: [[102, 9], [104, 5]],
        }}
        formatValue={(value) => `$${value.toFixed(2)}`}
      />
    </div>
  );
}

function PredictionChart() {
  useEffect(() => {
    let yes = 46;
    let no = 36;
    const push = () => {
      const time = Date.now() / 1_000;
      yes = Math.min(75, Math.max(15, yes + (Math.random() - 0.5) * 4));
      no = Math.min(75, Math.max(10, no + (Math.random() - 0.5) * 3));
      const maybe = Math.max(2, 100 - yes - no);
      predictionLayers[0]!.series.append({ time, value: yes });
      predictionLayers[1]!.series.append({ time, value: no });
      predictionLayers[2]!.series.append({ time, value: maybe });
    };
    push();
    const timer = window.setInterval(push, 180);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <section className="card">
      <h2>Multi-series prediction</h2>
      <div className="market-chart">
        <RealtimeLineChart
          series={predictionLayers[0]!.series}
          layers={predictionLayers}
          windows={[{ label: '15s', seconds: 15 }, { label: '30s', seconds: 30 }]}
          windowStyle="text"
          badge={false}
          area={false}
          formatValue={(value) => `${value.toFixed(1)}%`}
        />
      </div>
    </section>
  );
}

function LiveDemo() {
  const [video, setVideo] = useState<HTMLVideoElement | null>(null);
  const media = useMediaState(video);
  const live = useLiveLatency(video);
  return (
    <section className="card">
      <h2>Live primitives</h2>
      <video ref={setVideo} controls muted playsInline />
      <p>状态：{media.paused ? 'paused' : 'playing'} · readyState {media.readyState}</p>
      <p>直播延迟：{live.latency === undefined ? '等待直播源' : `${live.latency.toFixed(1)}s`}</p>
    </section>
  );
}

function App() {
  const [messages, setMessages] = useState(initialMessages);
  const renderedMessages = useMemo(() => messages, [messages]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const symbol = symbols[Math.floor(Math.random() * symbols.length)]!;
      const current = quoteStore.get(symbol)!;
      const delta = (Math.random() - 0.5) * 2;
      quoteStore.push({ symbol, price: current.price + delta, change: delta });
    }, 8);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <main>
      <header><h1>Zeact playground</h1><p>React 18, tuned for live data.</p></header>
      <div className="grid">
        <section className="card">
          <div className="title-row">
            <h2>1,000 messages</h2>
            <button type="button" onClick={() => setMessages((current) => [...current, {
              id: current.length + 1, author: 'Kertin', text: `New message ${current.length + 1}`,
            }])}>追加消息</button>
          </div>
          <VirtualChatList
            items={renderedMessages}
            getKey={(message) => message.id}
            estimateSize={62}
            className="chat"
            renderItem={({ item }) => <article className="message"><b>{item.author}</b><span>{item.text}</span></article>}
          />
        </section>
        <section className="card">
          <h2>125 ticks/s input</h2>
          <MarketChart />
          <div className="quotes">{symbols.map((symbol) => <QuoteRow key={symbol} symbol={symbol} />)}</div>
        </section>
        <PredictionChart />
        <LiveDemo />
      </div>
    </main>
  );
}

const demoGlobal = globalThis as typeof globalThis & { __zeactDemoRoot?: Root };
demoGlobal.__zeactDemoRoot ??= createRoot(document.getElementById('root')!);
demoGlobal.__zeactDemoRoot.render(<StrictMode><App /></StrictMode>);
