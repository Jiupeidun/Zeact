/** Fenwick tree for O(log n) size updates and offset lookup. */
export class SizeIndex {
  private readonly tree: Float64Array;
  private readonly sizes: Float64Array;

  constructor(readonly count: number, estimate: number) {
    this.tree = new Float64Array(count + 1);
    this.sizes = new Float64Array(count);
    this.sizes.fill(estimate);
    for (let index = 0; index < count; index += 1) this.add(index, estimate);
  }

  get totalSize(): number {
    return this.offsetOf(this.count);
  }

  sizeOf(index: number): number {
    return this.sizes[index] ?? 0;
  }

  update(index: number, size: number): number {
    if (index < 0 || index >= this.count || size <= 0) return 0;
    const previous = this.sizes[index] ?? 0;
    const delta = size - previous;
    if (delta === 0) return 0;
    this.sizes[index] = size;
    this.add(index, delta);
    return delta;
  }

  offsetOf(index: number): number {
    let cursor = Math.min(Math.max(index, 0), this.count);
    let sum = 0;
    while (cursor > 0) {
      sum += this.tree[cursor] ?? 0;
      cursor -= cursor & -cursor;
    }
    return sum;
  }

  indexAt(offset: number): number {
    if (this.count === 0) return 0;
    const target = Math.max(0, Math.min(offset, this.totalSize));
    let index = 0;
    let sum = 0;
    let bit = 1;
    while ((bit << 1) <= this.count) bit <<= 1;

    while (bit !== 0) {
      const next = index + bit;
      const value = this.tree[next] ?? 0;
      if (next <= this.count && sum + value <= target) {
        index = next;
        sum += value;
      }
      bit >>= 1;
    }

    return Math.min(index, this.count - 1);
  }

  private add(index: number, delta: number): void {
    let cursor = index + 1;
    while (cursor <= this.count) {
      this.tree[cursor] = (this.tree[cursor] ?? 0) + delta;
      cursor += cursor & -cursor;
    }
  }
}
