import React, { useEffect, useId, useRef } from 'react';

interface DialogProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  /** Tailwind max-width class for the panel. */
  size?: 'md' | 'lg' | 'xl' | '2xl' | '5xl';
  /** Drawer slides in from the right on large screens. */
  variant?: 'center' | 'drawer';
  description?: string;
  hideTitle?: boolean;
  /** Children render their own panel chrome; Dialog only supplies overlay, semantics and focus handling. */
  bare?: boolean;
}

const SIZE_CLASS: Record<NonNullable<DialogProps['size']>, string> = {
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  '5xl': 'max-w-5xl',
};

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Accessible modal: role="dialog", aria-modal, labelled title, Escape to close,
 * focus moves in on open, Tab is trapped, focus returns to the trigger on close.
 */
export const Dialog: React.FC<DialogProps> = ({
  title,
  onClose,
  children,
  size = 'lg',
  variant = 'center',
  description,
  hideTitle = false,
  bare = false,
}) => {
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    const first = panel?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? panel)?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab' || !panel) return;
      const focusable = [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((element) => element.offsetParent !== null);
      if (!focusable.length) return;
      const firstElement = focusable[0];
      const lastElement = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus?.();
    };
  }, []);

  const isDrawer = variant === 'drawer';

  return (
    <div
      className={`fixed inset-0 z-50 flex bg-black/75 backdrop-blur-sm ${isDrawer ? 'justify-end' : 'items-end sm:items-center justify-center p-0 sm:p-4'}`}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className={bare
          ? `w-full ${SIZE_CLASS[size]} max-h-[92dvh] overflow-y-auto rounded-t-3xl sm:rounded-3xl shadow-2xl shadow-black/60 animate-rise focus:outline-none`
          : isDrawer
          ? 'h-full w-full max-w-md overflow-y-auto border-l border-stone-800 bg-stone-900 p-5 sm:p-6 shadow-2xl animate-rise focus:outline-none'
          : `w-full ${SIZE_CLASS[size]} max-h-[92dvh] overflow-y-auto rounded-t-3xl sm:rounded-3xl border border-stone-700/70 bg-stone-900 p-5 sm:p-6 shadow-2xl shadow-black/60 animate-rise focus:outline-none`}
      >
        <div className={`flex items-start justify-between gap-4 ${hideTitle || bare ? 'sr-only' : 'border-b border-stone-800 pb-3 mb-4'}`}>
          <div className="min-w-0">
            <h2 id={titleId} className="font-serif text-xl font-semibold text-stone-100">{title}</h2>
            {description && <p id={descriptionId} className="mt-1 text-xs text-stone-400">{description}</p>}
          </div>
          {!hideTitle && !bare && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Đóng"
              className="press -mr-1 grid size-10 shrink-0 place-items-center rounded-xl text-stone-400 hover:bg-stone-800 hover:text-stone-100"
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
            </button>
          )}
        </div>
        {children}
      </div>
    </div>
  );
};
