import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider, useToast } from '../src/notify';

function Demo() {
  const toast = useToast();
  return <>
    <button onClick={() => toast.success('Saved', { duration: 1_000 })}>save</button>
    <button onClick={() => toast.error('Failed', { duration: 0 })}>error</button>
    <button onClick={() => toast.info('Undoable', { action: { label: 'Undo', onClick: () => document.body.dataset.undone = 'yes' } })}>action</button>
  </>;
}

describe('ToastProvider', () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('shows centered notifications and supports manual dismissal', () => {
    vi.useFakeTimers();
    render(<ToastProvider><Demo /></ToastProvider>);
    fireEvent.click(screen.getByRole('button', { name: 'save' }));
    expect(screen.getByRole('status').textContent).toContain('Saved');
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss notification' }));
    act(() => vi.advanceTimersByTime(160));
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('automatically dismisses notifications after their duration', () => {
    vi.useFakeTimers();
    render(<ToastProvider><Demo /></ToastProvider>);
    fireEvent.click(screen.getByRole('button', { name: 'save' }));
    act(() => vi.advanceTimersByTime(1_160));
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('uses alert semantics for errors and keeps persistent messages until dismissed', () => {
    render(<ToastProvider><Demo /></ToastProvider>);
    fireEvent.click(screen.getByRole('button', { name: 'error' }));
    expect(screen.getByRole('alert').textContent).toContain('Failed');
  });

  it('supports top and bottom placement with safe offsets', () => {
    const { container } = render(<ToastProvider position="top-center" offset={20}><Demo /></ToastProvider>);
    const viewport = container.querySelector<HTMLElement>('[data-zeact-toast-viewport]');
    expect(viewport?.dataset.position).toBe('top-center');
    expect(viewport?.style.justifyContent).toBe('flex-start');
    expect(viewport?.style.paddingTop).toContain('20px');
  });

  it('runs an optional action and dismisses the notification', () => {
    vi.useFakeTimers();
    render(<ToastProvider variant="brand"><Demo /></ToastProvider>);
    fireEvent.click(screen.getByRole('button', { name: 'action' }));
    expect(screen.getByRole('status').style.background).toBe('rgb(29, 155, 240)');
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(document.body.dataset.undone).toBe('yes');
    act(() => vi.advanceTimersByTime(160));
    expect(screen.queryByRole('status')).toBeNull();
    delete document.body.dataset.undone;
  });
});
