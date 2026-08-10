import type { ReactNode } from 'react';

interface ModalProps {
  title: string;
  subtitle?: string;
  /** Replaces the plain title line when a richer header is wanted (an avatar, a role badge). */
  header?: ReactNode;
  /** Extra class on the dialog itself, for per-modal layout such as `contact-modal`. */
  className?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}

export function Modal({ title, subtitle, header, className, onClose, children, footer }: ModalProps) {
  return (
    <div
      className="modal-overlay"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className={`modal${className ? ` ${className}` : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        {header ?? (
          <>
            <h3>{title}</h3>
            {subtitle && <p className="modal-sub">{subtitle}</p>}
          </>
        )}
        {children}
        {footer && <div className="modal-actions">{footer}</div>}
      </div>
    </div>
  );
}
