export type TaskKey = string | number | symbol | object;
export type ScheduledTask = () => void;

const requestFrame = typeof requestAnimationFrame === 'function'
  ? requestAnimationFrame
  : (callback: FrameRequestCallback) => setTimeout(() => callback(Date.now()), 16) as unknown as number;

const cancelFrame = typeof cancelAnimationFrame === 'function'
  ? cancelAnimationFrame
  : (handle: number) => clearTimeout(handle);

/** Coalesces tasks by key and runs the latest version once per visual frame. */
export class FrameScheduler {
  private readonly tasks = new Map<TaskKey, ScheduledTask>();
  private frame: number | undefined;

  schedule(task: ScheduledTask, key: TaskKey = task): () => void {
    this.tasks.set(key, task);
    this.ensureFrame();
    return () => this.cancel(key);
  }

  cancel(key: TaskKey): void {
    this.tasks.delete(key);
    if (this.tasks.size === 0 && this.frame !== undefined) {
      cancelFrame(this.frame);
      this.frame = undefined;
    }
  }

  flushNow(): void {
    if (this.frame !== undefined) {
      cancelFrame(this.frame);
      this.frame = undefined;
    }

    const current = [...this.tasks.values()];
    this.tasks.clear();
    current.forEach((task) => task());
  }

  clear(): void {
    this.tasks.clear();
    if (this.frame !== undefined) cancelFrame(this.frame);
    this.frame = undefined;
  }

  get size(): number {
    return this.tasks.size;
  }

  private ensureFrame(): void {
    if (this.frame !== undefined) return;
    this.frame = requestFrame(() => {
      this.frame = undefined;
      const current = [...this.tasks.values()];
      this.tasks.clear();
      current.forEach((task) => task());
      if (this.tasks.size > 0) this.ensureFrame();
    });
  }
}

export const frameScheduler = new FrameScheduler();
