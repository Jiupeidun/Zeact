import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider, useToast } from '../src/notify';

function Demo() {
  const toast = useToast();
  return <>
    <button onClick={() => toast.success('Saved', { duration: 1_000 })}>save</button>
    <button onClick={() => toast.error('Failed', { duration: 0 })}>error</button>
  </>;
}

describe('ToastProvider', () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('shows centered notifications and supports manual dismissal', () => {
    render(<ToastProvider><Demo /></ToastProvider>);
    fireEvent.click(screen.getByRole('button', { name: 'save' }));
    expect(screen.getByRole('status').textContent).toContain('Saved');
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss notification' }));
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('automatically dismisses notifications after their duration', () => {
    vi.useFakeTimers();
    render(<ToastProvider><Demo /></ToastProvider>);
    fireEvent.click(screen.getByRole('button', { name: 'save' }));
    act(() => vi.advanceTimersByTime(1_000));
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('uses alert semantics for errors and keeps persistent messages until dismissed', () => {
    render(<ToastProvider><Demo /></ToastProvider>);
    fireEvent.click(screen.getByRole('button', { name: 'error' }));
    expect(screen.getByRole('alert').textContent).toContain('Failed');
  });
});
