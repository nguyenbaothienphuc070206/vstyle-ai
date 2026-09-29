import React from 'react';

interface NavbarProps {
  onOpenLookbook: () => void;
  onOpenCompare: () => void;
  onOpenTailoringSheet: () => void;
  onOpenAdmin: () => void;
  lookbookCount: number;
}

const ghost = 'press min-h-10 items-center gap-2 rounded-xl px-3 text-sm text-stone-300 hover:bg-stone-900 hover:text-stone-50';

export const Navbar: React.FC<NavbarProps> = ({
  onOpenLookbook,
  onOpenCompare,
  onOpenTailoringSheet,
  onOpenAdmin,
  lookbookCount,
}) => (
  <header className="sticky top-0 z-40 border-b border-stone-800/80 bg-stone-950/85 backdrop-blur-md">
    <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
      <a href="/" className="flex items-center gap-3 rounded-lg" aria-label="Vstyle — về trang đầu">
        <span aria-hidden="true" className="grid size-9 -rotate-6 place-items-center rounded-[9px] bg-son-600 font-serif text-lg font-bold text-amber-50 ring-2 ring-inset ring-son-400/40">V</span>
        <span className="leading-tight">
          <span className="block font-serif text-xl font-semibold tracking-tight text-stone-50">Vstyle</span>
          <span className="hidden text-[11px] text-stone-400 sm:block">Việt phục Remix · đúng bản sắc, vừa mọi cơ thể</span>
        </span>
      </a>

      <nav aria-label="Công cụ" className="flex items-center gap-1">
        <button type="button" onClick={onOpenCompare} className={`${ghost} hidden md:inline-flex`}>
          <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 3v18M5 7h4M15 7h4M4 15l3-8 3 8M14 15l3-8 3 8M4 15h6M14 15h6" /></svg>
          So sánh
        </button>
        <button type="button" onClick={onOpenTailoringSheet} className={`${ghost} hidden sm:inline-flex`}>
          <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="6" cy="6" r="3" /><circle cx="6" cy="18" r="3" /><path d="M8.5 7.5L20 18M8.5 16.5L20 6" /></svg>
          May đo thích ứng
        </button>
        <button type="button" onClick={onOpenAdmin} className={`${ghost} hidden lg:inline-flex`}>
          <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 19V6a2 2 0 012-2h12v15H6a2 2 0 00-2 2zM8 8h6M8 12h6" /></svg>
          Cơ sở tri thức
        </button>
        <button
          type="button"
          onClick={onOpenLookbook}
          className="press ml-1 inline-flex min-h-10 items-center gap-2 rounded-xl bg-stone-100 px-3.5 text-sm font-semibold text-stone-950 hover:bg-white"
        >
          Lookbook
          <span className="grid min-w-5 place-items-center rounded-full bg-stone-950 px-1.5 text-[11px] font-semibold text-amber-200 tabular" aria-label={`${lookbookCount} bản phối đã lưu`}>
            {lookbookCount}
          </span>
        </button>
      </nav>
    </div>
  </header>
);
