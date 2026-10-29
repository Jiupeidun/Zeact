import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';

export type ToastType = 'info' | 'success' | 'warning' | 'error';
export type ToastPosition = 'top-center' | 'bottom-center';
export type ToastVariant = 'neutral' | 'brand';

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastOptions {
  type?: ToastType;
  duration?: number;
  action?: ToastAction;
  dismissible?: boolean;
}

export interface ToastProviderProps {
  children: ReactNode;
  duration?: number;
  maxToasts?: number;
  offset?: number;
  position?: ToastPosition;
  variant?: ToastVariant;
}

export interface ToastApi {
  show: (message: ReactNode, options?: ToastOptions) => string;
  dismiss: (id: string) => void;
  success: (message: ReactNode, options?: Omit<ToastOptions, 'type'>) => string;
  info: (message: ReactNode, options?: Omit<ToastOptions, 'type'>) => string;
  warning: (message: ReactNode, options?: Omit<ToastOptions, 'type'>) => string;
  error: (message: ReactNode, options?: Omit<ToastOptions, 'type'>) => string;
}

interface ToastItem {
  action: ToastAction | undefined;
  closing: boolean;
  dismissible: boolean;
  duration: number;
  id: string;
  message: ReactNode;
  type: ToastType;
}

const EXIT_DURATION = 160;
const ToastContext = createContext<ToastApi | null>(null);
const NEUTRAL_COLORS: Record<ToastType, { accent: string; background: string }> = {
  info: { accent: '#60a5fa', background: '#172554' },
  success: { accent: '#34d399', background: '#052e2b' },
  warning: { accent: '#fbbf24', background: '#422006' },
  error: { accent: '#fb7185', background: '#4c0519' },
};
const BRAND_COLORS: Record<ToastType, { accent: string; background: string }> = {
  info: { accent: '#ffffff', background: '#1d9bf0' },
  success: { accent: '#ffffff', background: '#1d9bf0' },
  warning: { accent: '#ffffff', background: '#b66b00' },
  error: { accent: '#ffffff', background: '#d92736' },
};

const viewportStyle: CSSProperties = {
  alignItems: 'center', display: 'flex', flexDirection: 'column', gap: 8,
  inset: 0, pointerEvents: 'none', position: 'fixed', zIndex: 2_147_483_000,
};
const toastStyle: CSSProperties = {
  alignItems: 'center', border: '1px solid rgba(255,255,255,.18)', borderRadius: 8,
  boxShadow: '0 12px 36px rgba(0,0,0,.24)', color: '#fff', display: 'flex',
  font: '650 15px/1.4 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  gap: 12, justifyContent: 'space-between', maxWidth: 'min(calc(100vw - 32px), 520px)',
  minWidth: 'min(calc(100vw - 32px), 280px)', padding: '13px 16px', pointerEvents: 'auto',
};
const actionStyle: CSSProperties = {
  background: 'transparent', border: 0, color: 'inherit', cursor: 'pointer',
  flex: '0 0 auto', font: 'inherit', fontWeight: 800, padding: '3px 1px', textDecoration: 'underline',
  textUnderlineOffset: 3,
};
const dismissStyle: CSSProperties = {
  alignItems: 'center', background: 'rgba(0,0,0,.12)', border: 0, borderRadius: '50%',
  color: 'inherit', cursor: 'pointer', display: 'inline-flex', flex: '0 0 auto',
  fontSize: 18, height: 26, justifyContent: 'center', lineHeight: 1, padding: 0, width: 26,
};

const animationStyles = `
@keyframes zeact-toast-in-bottom { from { opacity: 0; transform: translateY(12px) scale(.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
@keyframes zeact-toast-in-top { from { opacity: 0; transform: translateY(-12px) scale(.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
@keyframes zeact-toast-out-bottom { from { opacity: 1; transform: translateY(0) scale(1); } to { opacity: 0; transform: translateY(8px) scale(.98); } }
@keyframes zeact-toast-out-top { from { opacity: 1; transform: translateY(0) scale(1); } to { opacity: 0; transform: translateY(-8px) scale(.98); } }
@media (prefers-reduced-motion: reduce) { [data-zeact-toast] { animation-duration: .01ms !important; } }
`;

export function ToastProvider({ children, duration = 3_200, maxToasts = 3, offset = 28, position = 'bottom-center', variant = 'neutral' }: ToastProviderProps) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const exitTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const sequence = useRef(0);
  const viewportId = useId();

  const remove = useCallback((id: string) => {
    const timer = timers.current.get(id);
    if (timer !== undefined) clearTimeout(timer);
    timers.current.delete(id);
    const exitTimer = exitTimers.current.get(id);
    if (exitTimer !== undefined) clearTimeout(exitTimer);
    exitTimers.current.delete(id);
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const dismiss = useCallback((id: string) => {
    const timer = timers.current.get(id);
    if (timer !== undefined) clearTimeout(timer);
    timers.current.delete(id);
    setToasts((current) => current.map((toast) => toast.id === id ? { ...toast, closing: true } : toast));
    if (exitTimers.current.has(id)) return;
    exitTimers.current.set(id, setTimeout(() => remove(id), EXIT_DURATION));
  }, [remove]);

  const show = useCallback((message: ReactNode, options: ToastOptions = {}) => {
    const id = `${viewportId}-${sequence.current++}`;
    const toast: ToastItem = {
      action: options.action,
      closing: false,
      dismissible: options.dismissible ?? true,
      duration: options.duration ?? duration,
      id,
      message,
      type: options.type ?? 'info',
    };
    setToasts((current) => {
      const next = [...current, toast];
      const overflow = next.slice(0, Math.max(0, next.length - Math.max(1, maxToasts)));
      overflow.forEach((item) => {
        const timer = timers.current.get(item.id);
        if (timer !== undefined) clearTimeout(timer);
        timers.current.delete(item.id);
      });
      return next.slice(-Math.max(1, maxToasts));
    });
    if (toast.duration > 0) timers.current.set(id, setTimeout(() => dismiss(id), toast.duration));
    return id;
  }, [dismiss, duration, maxToasts, viewportId]);

  const api = useMemo<ToastApi>(() => ({
    dismiss,
    error: (message, options) => show(message, { ...options, type: 'error' }),
    info: (message, options) => show(message, { ...options, type: 'info' }),
    show,
    success: (message, options) => show(message, { ...options, type: 'success' }),
    warning: (message, options) => show(message, { ...options, type: 'warning' }),
  }), [dismiss, show]);

  useEffect(() => () => {
    timers.current.forEach((timer) => clearTimeout(timer));
    exitTimers.current.forEach((timer) => clearTimeout(timer));
    timers.current.clear();
    exitTimers.current.clear();
  }, []);

  const isTop = position === 'top-center';
  const colorsByType = variant === 'brand' ? BRAND_COLORS : NEUTRAL_COLORS;
  const safeOffset = `calc(${Math.max(0, offset)}px + env(safe-area-inset-${isTop ? 'top' : 'bottom'}))`;

  return <ToastContext.Provider value={api}>
    {children}
    <div
      aria-live="polite"
      aria-relevant="additions text"
      data-position={position}
      data-zeact-toast-viewport=""
      id={viewportId}
      style={{ ...viewportStyle, justifyContent: isTop ? 'flex-start' : 'flex-end', paddingBottom: isTop ? 0 : safeOffset, paddingTop: isTop ? safeOffset : 0 }}
    >
      <style>{animationStyles}</style>
      {toasts.map((toast) => {
        const colors = colorsByType[toast.type];
        const direction = isTop ? 'top' : 'bottom';
        const animation = toast.closing
          ? `zeact-toast-out-${direction} ${EXIT_DURATION}ms cubic-bezier(.4,0,1,1) forwards`
          : `zeact-toast-in-${direction} 220ms cubic-bezier(.16,1,.3,1) both`;
        return <div
          data-type={toast.type}
          data-zeact-toast=""
          key={toast.id}
          role={toast.type === 'error' ? 'alert' : 'status'}
          style={{ ...toastStyle, animation, background: colors.background, borderColor: variant === 'brand' ? 'rgba(255,255,255,.22)' : 'rgba(255,255,255,.14)', borderLeft: variant === 'neutral' ? `3px solid ${colors.accent}` : undefined }}
        >
          <span style={{ flex: '1 1 auto', minWidth: 0 }}>{toast.message}</span>
          {toast.action ? <button onClick={() => { toast.action?.onClick(); dismiss(toast.id); }} style={actionStyle} type="button">{toast.action.label}</button> : null}
          {toast.dismissible ? <button aria-label="Dismiss notification" onClick={() => dismiss(toast.id)} style={dismissStyle} type="button">×</button> : null}
        </div>;
      })}
    </div>
  </ToastContext.Provider>;
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within a ToastProvider');
  return context;
}
