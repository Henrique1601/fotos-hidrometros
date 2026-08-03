import { useEffect, useRef } from 'react';
import gsap from 'gsap';

interface Props {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  danger = false,
  onConfirm,
  onCancel,
}: Props) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(overlayRef.current!, { opacity: 0 }, { opacity: 1, duration: 0.2 });
      gsap.fromTo(panelRef.current!, { opacity: 0, y: 18, scale: 0.96 }, { opacity: 1, y: 0, scale: 1, duration: 0.28, ease: 'power2.out' });
    });
    return () => ctx.revert();
  }, [open]);

  if (!open) return null;

  return (
    <div ref={overlayRef} className="modal-overlay" onClick={onCancel}>
      <div ref={panelRef} className="modal-panel glass" onClick={(e) => e.stopPropagation()}>
        <h3 className="modal-title">{title}</h3>
        <p className="modal-msg">{message}</p>
        <div className="modal-actions">
          <button className="btn-ghost" onClick={onCancel}>{cancelLabel}</button>
          <button
            className={`btn-primary ${danger ? 'btn-danger' : ''}`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
