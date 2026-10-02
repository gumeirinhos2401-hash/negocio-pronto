import { useEffect, useId, useRef, type MouseEvent, type ReactNode } from 'react';
import { X } from 'lucide-react';
import './Dialog.css';

interface DialogProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}

// Built on the native <dialog>: showModal() keeps focus inside and Esc closes it.
export function Dialog({ open, title, onClose, children }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLElement | null>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      trigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else dialog.setAttribute('open', '');
    } else if (!open && dialog.open) {
      if (typeof dialog.close === 'function') dialog.close();
      else dialog.removeAttribute('open');
    }
  }, [open]);

  const handleClose = () => {
    // Give focus back to the control that opened the dialog, when it still exists.
    const previous = trigger.current;
    trigger.current = null;
    if (previous?.isConnected) previous.focus();
    onClose();
  };

  const handleBackdropClick = (event: MouseEvent<HTMLDialogElement>) => {
    if (event.target === ref.current) ref.current?.close();
  };

  return (
    <dialog ref={ref} className="dialogo" aria-labelledby={titleId} onClose={handleClose} onClick={handleBackdropClick}>
      {open && (
        <div className="dialogo__caixa">
          <div className="dialogo__topo">
            <h2 className="dialogo__titulo" id={titleId}>{title}</h2>
            <button type="button" className="dialogo__fechar" onClick={() => ref.current?.close()} aria-label="Fechar">
              <X aria-hidden="true" />
            </button>
          </div>
          <div className="dialogo__corpo">{children}</div>
        </div>
      )}
    </dialog>
  );
}
