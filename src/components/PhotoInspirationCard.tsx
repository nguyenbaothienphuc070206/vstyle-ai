import React, { useRef } from 'react';
import type { GeminiVisionResponse } from '../types/gemini';
import { getApprovedGarments, getEventById } from '../lib/dal';
import { styleLabel } from '../lib/styles';

interface PhotoInspirationCardProps {
  previewUrl: string | null;
  analysis: GeminiVisionResponse | null;
  isAnalyzing: boolean;
  error: string | null;
  consentForRender: boolean;
  onPickPhoto: (file: File) => void;
  onAnalyze: () => void;
  onClear: () => void;
  onConsentChange: (value: boolean) => void;
  onApplyMatch: (garmentId: string, colorHex: string) => void;
  onApplyContext: (styleId: string | null, eventId: string | null) => void;
}

const garmentNames = new Map(getApprovedGarments().map((garment) => [garment.id, garment.name]));

export const PhotoInspirationCard: React.FC<PhotoInspirationCardProps> = ({
  previewUrl,
  analysis,
  isAnalyzing,
  error,
  consentForRender,
  onPickPhoto,
  onAnalyze,
  onClear,
  onConsentChange,
  onApplyMatch,
  onApplyContext,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <section aria-labelledby="photo-heading" className="rounded-2xl border border-stone-800 bg-stone-900 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="photo-heading" className="font-serif text-lg font-semibold text-stone-100">Ảnh cảm hứng</h2>
          <p className="mt-1 max-w-prose text-xs leading-relaxed text-stone-400">
            Tải ảnh vải, bộ đồ bạn thích hoặc ảnh của chính bạn. Gemini đọc bảng màu và gợi ý Việt phục hợp gu. Vstyle không bình luận về cơ thể hay khuôn mặt.
          </p>
        </div>
        <input
            aria-label="Tải ảnh cảm hứng"
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) onPickPhoto(file);
            event.target.value = '';
          }}
        />
      </div>

      {!previewUrl ? (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="press mt-4 flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-stone-700 bg-stone-950/60 px-4 py-8 text-sm text-stone-300 hover:border-amber-500/60 hover:text-amber-100"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" className="size-7 text-stone-500" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="9" cy="11" r="2" /><path d="M21 17l-5-5-6 6" /></svg>
          Chọn ảnh (JPG, PNG, WEBP — tối đa 12 MB)
        </button>
      ) : (
        <div className="mt-4 grid gap-4 sm:grid-cols-[140px_1fr]">
          <div className="space-y-2">
            <img src={previewUrl} alt="Ảnh cảm hứng bạn đã tải lên" className="aspect-[3/4] w-full rounded-xl border border-stone-800 object-cover" />
            <div className="flex gap-2">
              <button type="button" onClick={() => inputRef.current?.click()} className="press min-h-9 flex-1 rounded-lg border border-stone-700 text-xs text-stone-300 hover:text-stone-100">Đổi ảnh</button>
              <button type="button" onClick={onClear} className="press min-h-9 flex-1 rounded-lg border border-stone-800 text-xs text-stone-400 hover:text-son-300">Xóa</button>
            </div>
          </div>

          <div className="min-w-0 space-y-3">
            {!analysis && !isAnalyzing && (
              <button
                type="button"
                onClick={onAnalyze}
                className="press inline-flex min-h-11 items-center gap-2 rounded-xl bg-amber-400 px-4 text-sm font-semibold text-stone-950 hover:bg-amber-300"
              >
                Phân tích bằng Gemini
              </button>
            )}
            {isAnalyzing && (
              <div role="status" className="space-y-2">
                <p className="text-sm text-stone-300">Gemini đang đọc màu sắc và chất liệu…</p>
                <div className="skeleton h-3 w-3/4 rounded" />
                <div className="skeleton h-3 w-1/2 rounded" />
                <div className="flex gap-2 pt-1">{[0, 1, 2, 3].map((index) => <div key={index} className="skeleton size-8 rounded-full" />)}</div>
              </div>
            )}
            {error && <p role="alert" className="text-sm text-son-300">{error}</p>}

            {analysis && (
              <div className="space-y-3 animate-rise">
                <p className="text-sm leading-relaxed text-stone-200">{analysis.summary}</p>
                {analysis.dominantColors.length > 0 && (
                  <ul aria-label="Bảng màu từ ảnh" className="flex flex-wrap gap-2">
                    {analysis.dominantColors.map((color) => (
                      <li key={`${color.hex}-${color.name}`} className="flex items-center gap-2 rounded-full border border-stone-800 bg-stone-950 py-1 pl-1 pr-3 text-xs text-stone-300">
                        <span aria-hidden="true" className="size-6 rounded-full border border-white/10" style={{ backgroundColor: color.hex }} />
                        {color.name}
                      </li>
                    ))}
                  </ul>
                )}
                {analysis.detectedItems.length > 0 && (
                  <p className="text-xs text-stone-400">Nhận ra: {analysis.detectedItems.join(' · ')}</p>
                )}

                {analysis.colorMatches.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-stone-300">Màu gần nhất trong bảng màu Việt phục đã duyệt</p>
                    <ul className="space-y-2">
                      {analysis.colorMatches.map((match) => (
                        <li key={`${match.garmentId}-${match.colorHex}`} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-stone-800 bg-stone-950/70 p-2">
                          <span className="flex items-center gap-2 text-xs text-stone-300">
                            <span aria-hidden="true" className="size-5 rounded-full border border-white/10" style={{ backgroundColor: match.sourceHex }} />
                            <span aria-hidden="true" className="text-stone-600">→</span>
                            <span aria-hidden="true" className="size-5 rounded-full border border-white/10" style={{ backgroundColor: match.colorHex }} />
                            <span><strong className="font-medium text-stone-100">{match.colorName}</strong> · {garmentNames.get(match.garmentId)}</span>
                          </span>
                          <button
                            type="button"
                            onClick={() => onApplyMatch(match.garmentId, match.colorHex)}
                            className="press min-h-9 rounded-lg border border-amber-500/40 px-3 text-xs font-semibold text-amber-200 hover:bg-amber-500/10"
                          >
                            Dùng màu này
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {(analysis.styleId || analysis.eventId) && (
                  <button
                    type="button"
                    onClick={() => onApplyContext(analysis.styleId, analysis.eventId)}
                    className="press min-h-9 rounded-lg border border-stone-700 px-3 text-xs text-stone-200 hover:border-stone-500"
                  >
                    Áp dụng gợi ý{analysis.styleId ? ` phong cách ${styleLabel(analysis.styleId)}` : ''}{analysis.eventId ? ` · ${getEventById(analysis.eventId)?.name ?? ''}` : ''}
                  </button>
                )}
                {analysis.usedFallback && (
                  <p className="text-xs text-stone-500">Gemini chưa sẵn sàng nên chưa phân tích được ảnh. Bạn vẫn có thể chọn thủ công.</p>
                )}
              </div>
            )}

            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-stone-800 bg-stone-950/50 p-3 text-xs leading-relaxed text-stone-300">
              <input
                type="checkbox"
                checked={consentForRender}
                onChange={(event) => onConsentChange(event.target.checked)}
                className="mt-0.5 size-4 accent-amber-400"
              />
              <span>
                Cho phép dùng ảnh này làm người mẫu khi tạo <strong className="text-stone-100">ảnh AI thử phối</strong>. Ảnh chỉ gửi tới Gemini khi bạn bấm tạo ảnh, không lưu trên máy chủ Vstyle.
              </span>
            </label>
          </div>
        </div>
      )}
    </section>
  );
};
