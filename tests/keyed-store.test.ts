import { describe, expect, it, vi } from 'vitest';
import { createKeyedStore } from '../src/core/keyed-store';

describe('createKeyedStore', () => {
  it('notifies only listeners for changed keys', () => {
    const store = createKeyedStore<string, number>();
    const btc = vi.fn();
    const eth = vi.fn();
    store.subscribe('BTC', btc);
    store.subscribe('ETH', eth);

    store.setMany([['BTC', 1], ['BTC', 2]]);
    expect(store.get('BTC')).toBe(2);
    expect(btc).toHaveBeenCalledTimes(1);
    expect(eth).not.toHaveBeenCalled();
  });
});
