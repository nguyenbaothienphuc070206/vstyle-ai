import React from 'react';

interface NavbarProps {
  onOpenLookbook: () => void;
  onOpenCompare: () => void;
  onOpenTailoringSheet: () => void;
  onOpenAdmin: () => void;
  lookbookCount: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  onOpenLookbook,
  onOpenCompare,
  onOpenTailoringSheet,
  onOpenAdmin,
  lookbookCount,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-stone-950/90 backdrop-blur-md border-b border-stone-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Logo and Tagline */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-600 to-amber-700 flex items-center justify-center text-stone-950 font-serif font-black text-xl shadow-lg border border-amber-400/40">
            V
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-serif text-xl font-bold tracking-tight text-stone-100">
                Vstyle
              </span>
              <span className="text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-full uppercase tracking-wider">
                Việt phục Remix
              </span>
            </div>
            <p className="text-[11px] text-stone-400 hidden sm:block">
              Phối Việt phục theo gu của bạn, đúng bản sắc, vừa với mọi cơ thể
            </p>
          </div>
        </div>

        {/* Navigation Action Buttons */}
        <div className="flex items-center gap-2 text-xs">
          <button
            onClick={onOpenCompare}
            className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-stone-300 border border-stone-800 transition"
          >
            <span>⚖️ So Sánh</span>
          </button>

          <button
            onClick={onOpenTailoringSheet}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-stone-300 border border-stone-800 transition"
          >
            <span>♿ May Đo Thích Ứng</span>
          </button>

          <button
            onClick={onOpenAdmin}
            className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-stone-400 hover:text-stone-200 border border-stone-800 transition"
            title="Tra cứu cơ sở dữ liệu và hội đồng thẩm định"
          >
            <span>🏛️ Cơ sở tri thức</span>
          </button>

          <button
            onClick={onOpenLookbook}
            className="relative flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-stone-950 font-bold transition shadow"
          >
            <span>📖 Lookbook</span>
            {lookbookCount > 0 && (
              <span className="w-5 h-5 rounded-full bg-stone-950 text-amber-300 text-[10px] flex items-center justify-center font-mono">
                {lookbookCount}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
