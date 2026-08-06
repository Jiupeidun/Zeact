import { describe, expect, it, vi } from 'vitest';
import { createQuoteStore } from '../src/trade/quote-store';

describe('createQuoteStore', () => {
  it('coalesces patches and notifies per symbol', () => {
    const store = createQuoteStore<{ symbol: string; price: number; volume: number }>();
    const btc = vi.fn();
    const eth = vi.fn();
    store.subscribe('BTC', btc);
    store.subscribe('ETH', eth);

    store.push({ symbol: 'BTC', price: 10 });
    store.push({ symbol: 'BTC', volume: 20 });
    store.flush();

    expect(store.get('BTC')).toEqual({ symbol: 'BTC', price: 10, volume: 20 });
    expect(btc).toHaveBeenCalledTimes(1);
    expect(eth).not.toHaveBeenCalled();
  });
});
