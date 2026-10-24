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

export interface ToastOptions {
  type?: ToastType;
  duration?: number;
}

export interface ToastProviderProps {
  children: ReactNode;
  duration?: number;
  maxToasts?: number;
}

export interface ToastApi {
  show: (message: ReactNode, options?: ToastOptions) => string;
  dismiss: (id: string) => void;
  success: (message: ReactNode, options?: Omit<ToastOptions, 'type'>) => string;
  info: (message: ReactNode, options?: Omit<ToastOptions, 'type'>) => string;
  warning: (message: ReactNode, options?: Omit<ToastOptions, 'type'>) => string;
  error: (message: ReactNode, options?: Omit<ToastOptions, 'type'>) => string;
}

interface ToastItem extends Required<ToastOptions> {
  id: string;
  message: ReactNode;
}

const ToastContext = createContext<ToastApi | null>(null);
const COLORS: Record<ToastType, { accent: string; background: string }> = {
  info: { accent: '#60a5fa', background: '#172554' },
  success: { accent: '#34d399', background: '#052e2b' },
  warning: { accent: '#fbbf24', background: '#422006' },
  error: { accent: '#fb7185', background: '#4c0519' },
};

const viewportStyle: CSSProperties = {
  alignItems: 'center', display: 'flex', flexDirection: 'column', gap: 8,
  inset: 0, justifyContent: 'center', pointerEvents: 'none', position: 'fixed', zIndex: 1000,
};
const toastStyle: CSSProperties = {
  alignItems: 'center', border: '1px solid rgba(255,255,255,.14)', borderRadius: 10,
  boxShadow: '0 12px 36px rgba(0,0,0,.28)', color: '#f8fafc', display: 'flex',
  font: '500 14px/1.4 system-ui, sans-serif', gap: 12, maxWidth: 'min(90vw, 480px)',
  padding: '11px 14px', pointerEvents: 'auto',
};

export function ToastProvider({ children, duration = 3_200, maxToasts = 3 }: ToastProviderProps) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const sequence = useRef(0);
  const viewportId = useId();

  const dismiss = useCallback((id: string) => {
    const timer = timers.current.get(id);
    if (timer !== undefined) clearTimeout(timer);
    timers.current.delete(id);
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const show = useCallback((message: ReactNode, options: ToastOptions = {}) => {
    const id = `${viewportId}-${sequence.current++}`;
    const toast: ToastItem = { duration: options.duration ?? duration, id, message, type: options.type ?? 'info' };
    setToasts((current) => [...current, toast].slice(-Math.max(1, maxToasts)));
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
    timers.current.clear();
  }, []);

  return <ToastContext.Provider value={api}>
    {children}
    <div aria-live="polite" aria-relevant="additions text" id={viewportId} style={viewportStyle}>
      {toasts.map((toast) => {
        const colors = COLORS[toast.type];
        return <div key={toast.id} role={toast.type === 'error' ? 'alert' : 'status'} style={{ ...toastStyle, background: colors.background, borderLeft: `3px solid ${colors.accent}` }}>
          <span>{toast.message}</span>
          <button aria-label="Dismiss notification" onClick={() => dismiss(toast.id)} style={{ background: 'transparent', border: 0, color: 'inherit', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: 2 }} type="button">×</button>
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
