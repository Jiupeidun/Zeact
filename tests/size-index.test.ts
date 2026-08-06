import { describe, expect, it } from 'vitest';
import { SizeIndex } from '../src/chat/size-index';

describe('SizeIndex', () => {
  it('maps offsets and applies dynamic measurements', () => {
    const index = new SizeIndex(4, 50);
    expect(index.totalSize).toBe(200);
    expect(index.indexAt(0)).toBe(0);
    expect(index.indexAt(50)).toBe(1);

    expect(index.update(1, 80)).toBe(30);
    expect(index.offsetOf(2)).toBe(130);
    expect(index.totalSize).toBe(230);
    expect(index.indexAt(120)).toBe(1);
    expect(index.indexAt(130)).toBe(2);
  });
});
