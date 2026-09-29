import React, { useState } from 'react';
import type { GeminiCaptionResponse, GeminiExplainResponse } from '../types/gemini';

interface AIRecommendationPanelProps {
  explanation: GeminiExplainResponse | null;
  caption: GeminiCaptionResponse | null;
  isLoadingExplain: boolean;
  isLoadingCaption: boolean;
  onRefreshExplain: () => void;
  onRequestCaption: () => void;
}

export const AIRecommendationPanel: React.FC<AIRecommendationPanelProps> = ({
  explanation,
  caption,
  isLoadingExplain,
  isLoadingCaption,
  onRefreshExplain,
  onRequestCaption,
}) => {
  const [copiedCaption, setCopiedCaption] = useState(false);

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedCaption(true);
      window.setTimeout(() => setCopiedCaption(false), 2000);
    } catch {
      setCopiedCaption(false);
    }
  };

  return (
    <section aria-labelledby="stylist-note-heading" aria-busy={isLoadingExplain} className="rounded-2xl border border-stone-800 bg-stone-900 p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3 border-b border-stone-800 pb-3">
        <div>
          <h3 id="stylist-note-heading" className="font-serif text-lg font-semibold text-stone-100">Lời bình của Gemini Stylist</h3>
          <p className="mt-0.5 text-xs text-stone-400">Chỉ diễn giải kết quả văn hóa đã kiểm chứng, không thêm sử liệu mới.</p>
        </div>
        <button
          type="button"
          onClick={onRefreshExplain}
          disabled={isLoadingExplain}
          className="press min-h-9 shrink-0 rounded-lg border border-stone-700 px-3 text-xs text-stone-300 hover:text-stone-100 disabled:opacity-50"
        >
          {isLoadingExplain ? 'Đang viết…' : 'Viết lại'}
        </button>
      </div>

      <div aria-live="polite">
        {isLoadingExplain && (
          <div role="status" className="space-y-2 py-4">
            <span className="sr-only">Gemini đang viết lời bình…</span>
            <div className="skeleton h-5 w-2/3 rounded" />
            <div className="skeleton h-3 w-full rounded" />
            <div className="skeleton h-3 w-11/12 rounded" />
            <div className="skeleton h-3 w-4/5 rounded" />
          </div>
        )}

        {!isLoadingExplain && explanation && (
          <div className="space-y-4 pt-4 text-sm animate-rise">
            <div>
              <p className="font-serif text-xl font-semibold italic leading-snug text-amber-200">“{explanation.headline}”</p>
              <p className="mt-2 leading-relaxed text-stone-300">{explanation.editorialReview}</p>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-stone-800 bg-stone-950/60 p-3">
                <p className="mb-1 text-xs font-semibold text-emerald-300">Giao hòa bản sắc</p>
                <p className="text-[13px] leading-relaxed text-stone-300">{explanation.culturalHarmony}</p>
              </div>
              <div className="rounded-xl border border-stone-800 bg-stone-950/60 p-3">
                <p className="mb-1 text-xs font-semibold text-amber-300">Chất Remix</p>
                <p className="text-[13px] leading-relaxed text-stone-300">{explanation.styleRemixVerdict}</p>
              </div>
            </div>
            {explanation.adviceForWearing.length > 0 && (
              <div>
                <p className="mb-1.5 text-xs font-semibold text-stone-300">Mẹo mặc</p>
                <ul className="space-y-1.5">
                  {explanation.adviceForWearing.map((advice) => (
                    <li key={advice} className="flex gap-2 text-[13px] leading-relaxed text-stone-300">
                      <span aria-hidden="true" className="text-amber-400">·</span>
                      <span>{advice}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {explanation.usedFallback && (
              <p className="text-xs text-stone-500">Lời bình mẫu từ dữ liệu Vstyle (Gemini chưa sẵn sàng).</p>
            )}
          </div>
        )}
      </div>

      <div className="mt-4 space-y-2 border-t border-stone-800 pt-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold text-stone-300">Caption mạng xã hội</p>
          <button
            type="button"
            onClick={onRequestCaption}
            disabled={isLoadingCaption}
            className="press min-h-9 rounded-lg border border-amber-500/40 px-3 text-xs font-semibold text-amber-200 hover:bg-amber-500/10 disabled:opacity-50"
          >
            {isLoadingCaption ? 'Đang viết…' : caption ? 'Viết caption khác' : 'Viết caption'}
          </button>
        </div>
        {caption && (
          <div className="space-y-2 rounded-xl border border-stone-800 bg-stone-950 p-3 text-sm animate-rise">
            <p className="text-xs font-semibold text-amber-200">{caption.shortPunchyHook}</p>
            <p className="whitespace-pre-line leading-relaxed text-stone-200">{caption.instagramCaption}</p>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-stone-900 pt-2">
              <span className="font-mono text-[11px] text-stone-500">{caption.hashtags.join(' ')}</span>
              <button
                type="button"
                onClick={() => handleCopy(`${caption.instagramCaption}\n${caption.hashtags.join(' ')}`)}
                className="press min-h-9 rounded-lg bg-stone-800 px-3 text-xs text-stone-200 hover:bg-stone-700"
              >
                {copiedCaption ? 'Đã chép' : 'Chép caption'}
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
