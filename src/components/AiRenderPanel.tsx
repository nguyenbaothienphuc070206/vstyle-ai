import React from 'react';
import type { GeminiRenderResponse } from '../types/gemini';

export interface RenderState {
  status: 'idle' | 'loading' | 'ready' | 'error';
  result?: GeminiRenderResponse;
  error?: string;
}

interface AiRenderPanelProps {
  state: RenderState;
  garmentName: string;
  canUseReference: boolean;
  useReference: boolean;
  imageRenderAvailable: boolean | null;
  onToggleReference: (value: boolean) => void;
  onGenerate: () => void;
}

export const AiRenderPanel: React.FC<AiRenderPanelProps> = ({
  state,
  garmentName,
  canUseReference,
  useReference,
  imageRenderAvailable,
  onToggleReference,
  onGenerate,
}) => {
  const download = () => {
    if (!state.result) return;
    const link = document.createElement('a');
    link.href = state.result.imageDataUrl;
    const extension = state.result.imageDataUrl.startsWith('data:image/png') ? 'png' : 'jpg';
    link.download = `Vstyle_AI_${garmentName.replace(/\s+/g, '_')}.${extension}`;
    link.click();
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-stone-800 bg-stone-900">
      <div className="relative aspect-[3/4] w-full bg-stone-950">
        {state.status === 'ready' && state.result ? (
          <img
            src={state.result.imageDataUrl}
            alt={`Ảnh minh họa do Gemini tạo: ${garmentName}`}
            className="h-full w-full object-cover animate-rise"
          />
        ) : state.status === 'loading' ? (
          <div role="status" className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
            <div className="skeleton absolute inset-0" aria-hidden="true" />
            <span className="relative size-8 animate-spin rounded-full border-2 border-stone-600 border-t-amber-300" aria-hidden="true" />
            <p className="relative text-sm text-stone-200">Gemini đang dựng ảnh theo dữ liệu đã xác thực…</p>
            <p className="relative text-xs text-stone-500">Thường mất 10–30 giây</p>
          </div>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center">
            <svg aria-hidden="true" viewBox="0 0 48 48" className="size-12 text-amber-300/80" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M24 5l3.5 9.5L37 18l-9.5 3.5L24 31l-3.5-9.5L11 18l9.5-3.5z" /><path d="M37 30l1.6 4.4L43 36l-4.4 1.6L37 42l-1.6-4.4L31 36l4.4-1.6z" /></svg>
            <div>
              <p className="font-serif text-lg font-semibold text-stone-100">Ảnh AI bản phối</p>
              <p className="mx-auto mt-1 max-w-xs text-xs leading-relaxed text-stone-400">
                Gemini (Nano Banana) vẽ ảnh chân dung từ đúng dữ liệu y phục, màu và phụ kiện bạn chọn, kèm các quy tắc không được sai (vạt hữu nhậm, kết cấu thân áo…).
              </p>
            </div>
            {state.status === 'error' && <p role="alert" className="max-w-xs text-xs text-son-300">{state.error}</p>}
            {imageRenderAvailable === false && (
              <p className="max-w-xs text-xs text-stone-500">Máy chủ chưa cấu hình khóa Gemini — bạn vẫn xem được bản mockup vector.</p>
            )}
          </div>
        )}
        <span className="absolute left-3 top-3 rounded-md border border-white/10 bg-stone-950/80 px-2 py-1 text-[11px] text-stone-300 backdrop-blur">
          Ảnh minh họa AI · không phải ảnh thật
        </span>
      </div>

      <div className="space-y-3 border-t border-stone-800 p-4">
        {canUseReference && (
          <label className="flex cursor-pointer items-center gap-3 text-xs text-stone-300">
            <input type="checkbox" checked={useReference} onChange={(event) => onToggleReference(event.target.checked)} className="size-4 accent-amber-400" />
            Dùng ảnh của tôi làm người mẫu (thử phối)
          </label>
        )}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onGenerate}
            disabled={state.status === 'loading'}
            className="press inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-amber-400 px-4 text-sm font-semibold text-stone-950 hover:bg-amber-300 disabled:opacity-50"
          >
            {state.status === 'ready' ? 'Tạo ảnh khác' : state.status === 'loading' ? 'Đang tạo…' : 'Tạo ảnh AI với Gemini'}
          </button>
          {state.status === 'ready' && (
            <button type="button" onClick={download} className="press min-h-11 rounded-xl border border-stone-700 px-4 text-sm text-stone-200 hover:border-stone-500">
              Tải ảnh
            </button>
          )}
        </div>

        {state.status === 'ready' && state.result && (
          <details className="rounded-xl border border-stone-800 bg-stone-950/60 p-3 text-xs text-stone-300" open>
            <summary className="cursor-pointer font-semibold text-stone-200">Đối chiếu ảnh với dữ liệu đã xác thực</summary>
            <p className="mt-2 text-stone-500">AI có thể vẽ sai chi tiết. Hãy kiểm tra các điểm dưới đây trước khi chia sẻ; thẻ Chuẩn văn hóa mới là kết quả chính thức.</p>
            <ul className="mt-2 space-y-1.5">
              {state.result.checklist.map((item) => (
                <li key={item} className="flex gap-2"><span aria-hidden="true" className="text-amber-400">▢</span><span>{item}</span></li>
              ))}
            </ul>
            <p className="mt-2 text-[11px] text-stone-500">Model: {state.result.model} · Ảnh có watermark SynthID của Google{state.result.usedReference ? ' · Dùng ảnh bạn tải lên làm mẫu' : ''}.</p>
          </details>
        )}
      </div>
    </div>
  );
};
