import React from 'react';
import type { HarmonyResult } from '../lib/color/harmony';

interface ColorHarmonyCardProps {
  result: HarmonyResult;
  swatches: Array<{ label: string; hex: string }>;
  compact?: boolean;
}

const NOTE_STYLE = {
  good: { icon: '●', className: 'text-emerald-400' },
  info: { icon: '◆', className: 'text-amber-300' },
  warn: { icon: '▲', className: 'text-son-400' },
} as const;

export const ColorHarmonyCard: React.FC<ColorHarmonyCardProps> = ({ result, swatches, compact = false }) => {
  const barTone = result.score >= 85 ? 'bg-emerald-400' : result.score >= 70 ? 'bg-amber-400' : 'bg-son-500';

  return (
    <section aria-labelledby="harmony-heading" className="rounded-2xl border border-stone-800 bg-stone-900 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 id="harmony-heading" className="font-serif text-lg font-semibold text-stone-100">Hài hòa màu sắc</h3>
          <p className="mt-0.5 text-xs text-stone-400">{result.relationLabel} · tương phản sáng/tối {result.contrast}:1</p>
        </div>
        <div className="text-right">
          <p className="font-serif text-2xl font-semibold text-stone-100 tabular">{result.score}<span className="text-sm text-stone-500">/100</span></p>
          <p className="text-xs font-medium text-stone-300">{result.label}</p>
        </div>
      </div>

      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-stone-800" aria-hidden="true">
        <div className={`h-full rounded-full ${barTone}`} style={{ width: `${result.score}%` }} />
      </div>

      <ul aria-label="Các màu trong bản phối" className="mt-4 flex flex-wrap gap-3">
        {swatches.map((swatch) => (
          <li key={`${swatch.label}-${swatch.hex}`} className="flex items-center gap-2 text-xs text-stone-300">
            <span aria-hidden="true" className="size-7 rounded-lg border border-white/10 shadow-inner" style={{ backgroundColor: swatch.hex }} />
            <span>{swatch.label}</span>
          </li>
        ))}
      </ul>

      {!compact && (
        <ul className="mt-4 space-y-2">
          {result.notes.map((note) => (
            <li key={note.text} className="flex gap-2 text-sm leading-relaxed text-stone-300">
              <span aria-hidden="true" className={`mt-0.5 text-[10px] ${NOTE_STYLE[note.tone].className}`}>{NOTE_STYLE[note.tone].icon}</span>
              <span>{note.text}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};
