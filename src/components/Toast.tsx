import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { X } from 'lucide-react';
import './Toast.css';

export type ToastTone = 'success' | 'error';

interface ToastApi {
  show(message: string, tone?: ToastTone): void;
}

interface ToastState {
  id: number;
  message: string;
  tone: ToastTone;
}

// Errors stay longer on screen because they ask the user to do something.
const DURATION_MS: Record<ToastTone, number> = { success: 5000, error: 10000 };

const ToastContext = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);

  const show = useCallback((message: string, tone: ToastTone = 'success') => {
    setToast((current) => ({ id: (current?.id ?? 0) + 1, message, tone }));
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), DURATION_MS[toast.tone]);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const api = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="aviso-regiao" aria-live="polite" aria-atomic="true">
        {toast && (
          <div key={toast.id} className={`aviso aviso--${toast.tone === 'error' ? 'erro' : 'sucesso'}`}>
            <p className="aviso__texto">{toast.message}</p>
            <button type="button" className="aviso__fechar" onClick={() => setToast(null)} aria-label="Fechar aviso">
              <X aria-hidden="true" />
            </button>
          </div>
        )}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) throw new Error('useToast must be used inside <ToastProvider>');
  return api;
}
