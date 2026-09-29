import React, { useRef, useState } from 'react';

export type StylistStage = 'idle' | 'parsing' | 'filtering' | 'ranking' | 'writing' | 'done' | 'error';

export interface StylistProgress {
  stage: StylistStage;
  summary?: string;
  usedFallback?: boolean;
  message?: string;
}

interface AiStylistComposerProps {
  progress: StylistProgress;
  geminiOnline: boolean | null;
  photoPreviewUrl?: string | null;
  onRun: (text: string) => void;
  onPickPhoto: (file: File) => void;
  onManualStart: () => void;
  onExplore: () => void;
}

const SAMPLE_PROMPTS = [
  'Lễ tốt nghiệp tháng 6 ở Sài Gòn, trời nóng, mình thích tối giản mà vẫn nổi.',
  'Đi đám cưới chị họ ở Huế, trời se lạnh, muốn sang trọng và đúng lễ.',
  'Chụp kỷ yếu cả lớp ở Văn Miếu, phong cách Remix Gen Z năng động.',
  'Du xuân ngày Tết, mình ngồi xe lăn, muốn áo đỏ may mắn dễ mặc.',
];

const PIPELINE: Array<{ stage: StylistStage; label: string; detail: string }> = [
  { stage: 'parsing', label: 'Gemini hiểu yêu cầu', detail: 'Chuyển câu nói thành dịp, thời tiết, phong cách, màu' },
  { stage: 'filtering', label: 'Lọc theo quy tắc văn hóa', detail: 'Chỉ giữ bản phối đã duyệt, có nguồn' },
  { stage: 'ranking', label: 'Gemini xếp hạng', detail: 'Chọn 3 bản phối hợp gu nhất' },
  { stage: 'writing', label: 'Viết lời bình', detail: 'Giải thích vì sao hợp, không bịa thêm sử liệu' },
];

const ORDER: StylistStage[] = ['parsing', 'filtering', 'ranking', 'writing', 'done'];

export const AiStylistComposer: React.FC<AiStylistComposerProps> = ({
  progress,
  geminiOnline,
  photoPreviewUrl,
  onRun,
  onPickPhoto,
  onManualStart,
  onExplore,
}) => {
  const [text, setText] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const busy = ['parsing', 'filtering', 'ranking', 'writing'].includes(progress.stage);
  const currentIndex = ORDER.indexOf(progress.stage);

  const submit = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed || busy) return;
    onRun(trimmed);
  };

  return (
    <section aria-labelledby="stylist-heading" className="relative mb-8 overflow-hidden rounded-[28px] border border-stone-800 bg-stone-900/80 shadow-2xl shadow-black/50">
      <div aria-hidden="true" className="pointer-events-none absolute -right-24 -top-24 size-80 rounded-full bg-amber-500/10 blur-3xl" />
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-32 left-10 size-72 rounded-full bg-son-600/10 blur-3xl" />

      <div className="relative grid gap-8 p-5 sm:p-8 lg:grid-cols-[1.25fr_0.75fr] lg:p-10">
        <div>
          <p className="flex flex-wrap items-center gap-2 text-xs font-medium text-amber-300">
            <span className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1">Đề Audition · Việt phục Remix</span>
            <span className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 ${geminiOnline ? 'border-emerald-700/60 bg-emerald-950/40 text-emerald-300' : 'border-stone-700 bg-stone-950/60 text-stone-400'}`}>
              <span aria-hidden="true" className={`size-1.5 rounded-full ${geminiOnline ? 'bg-emerald-400' : 'bg-stone-500'}`} />
              {geminiOnline === null ? 'Đang kiểm tra Gemini…' : geminiOnline ? 'Gemini đang bật' : 'Chế độ dự phòng (chưa có khóa Gemini)'}
            </span>
          </p>

          <h1 id="stylist-heading" className="mt-4 max-w-2xl font-serif text-[2rem] font-semibold leading-[1.08] tracking-tight text-stone-50 sm:text-5xl">
            Kể dịp của bạn.<br />
            <span className="italic text-amber-300">Vstyle phối Việt phục</span> đúng bản sắc.
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-stone-300 sm:text-base">
            Một câu là đủ: dịp gì, ở đâu, trời ra sao, gu thế nào. Gemini hiểu ý bạn, bộ quy tắc văn hóa có nguồn kiểm chứng giữ cho bản phối không lệch bản sắc.
          </p>

          <form
            className="mt-6"
            onSubmit={(event) => {
              event.preventDefault();
              submit(text);
            }}
          >
            <label htmlFor="stylist-input" className="sr-only">Mô tả dịp và gu của bạn</label>
            <div className="rounded-2xl border border-stone-700 bg-stone-950/80 p-2 focus-within:border-amber-400/70 focus-within:ring-2 focus-within:ring-amber-400/20">
              <textarea
                id="stylist-input"
                value={text}
                onChange={(event) => setText(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    submit(text);
                  }
                }}
                rows={3}
                maxLength={1000}
                disabled={busy}
                placeholder="Ví dụ: Chụp kỷ yếu ở Hội An cuối tuần, trời nắng, mình thích Remix Gen Z màu xanh…"
                className="w-full resize-none bg-transparent px-3 py-2 text-[15px] leading-relaxed text-stone-100 placeholder:text-stone-500 focus:outline-none"
              />
              <div className="flex flex-wrap items-center justify-between gap-2 px-1 pb-1">
                <div className="flex items-center gap-2">
                  <input
            aria-label="Tải ảnh cảm hứng"
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                    className="sr-only"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) onPickPhoto(file);
                      event.target.value = '';
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="press inline-flex min-h-10 items-center gap-2 rounded-xl border border-stone-700 px-3 text-xs font-medium text-stone-300 hover:border-stone-500 hover:text-stone-100"
                  >
                    {photoPreviewUrl
                      ? <img src={photoPreviewUrl} alt="" className="size-6 rounded-md object-cover" />
                      : <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="9" cy="11" r="2" /><path d="M21 17l-5-5-6 6" /></svg>}
                    {photoPreviewUrl ? 'Đổi ảnh cảm hứng' : 'Thêm ảnh cảm hứng'}
                  </button>
                  <span className="hidden text-[11px] text-stone-500 sm:inline">Enter để gửi · Shift+Enter xuống dòng</span>
                </div>
                <button
                  type="submit"
                  disabled={busy || !text.trim()}
                  className="press inline-flex min-h-11 items-center gap-2 rounded-xl bg-amber-400 px-5 text-sm font-semibold text-stone-950 shadow-lg shadow-amber-900/30 hover:bg-amber-300 disabled:opacity-40"
                >
                  {busy ? 'Đang phối…' : 'Phối giúp mình'}
                  <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
                </button>
              </div>
            </div>
          </form>

          <div className="mt-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:thin]">
            {SAMPLE_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                type="button"
                disabled={busy}
                onClick={() => {
                  setText(prompt);
                  submit(prompt);
                }}
                className="press shrink-0 rounded-full border border-stone-800 bg-stone-950/60 px-3 py-2 text-xs text-stone-300 hover:border-amber-500/50 hover:text-amber-100 disabled:opacity-50"
              >
                {prompt.length > 46 ? `${prompt.slice(0, 44)}…` : prompt}
              </button>
            ))}
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
            <button type="button" onClick={onManualStart} className="font-medium text-stone-200 underline decoration-stone-600 underline-offset-4 hover:decoration-amber-400">
              Tự phối từng bước
            </button>
            <button type="button" onClick={onExplore} className="font-medium text-stone-400 underline decoration-stone-700 underline-offset-4 hover:text-stone-200">
              Tra cứu 8 loại Việt phục
            </button>
          </div>
        </div>

        <aside aria-label="Quy trình AI Stylist" className="self-end rounded-2xl border border-stone-800 bg-stone-950/70 p-4 sm:p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-500">Cách Vstyle phối</p>
          <ol className="mt-3 space-y-3" aria-live="polite">
            {PIPELINE.map((step, index) => {
              const state = progress.stage === 'error'
                ? 'idle'
                : currentIndex > index ? 'done' : currentIndex === index ? 'active' : 'idle';
              return (
                <li key={step.stage} className="flex gap-3">
                  <span
                    aria-hidden="true"
                    className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-full border text-[11px] font-semibold ${
                      state === 'done'
                        ? 'border-emerald-600 bg-emerald-600 text-stone-950'
                        : state === 'active'
                          ? 'border-amber-400 text-amber-300'
                          : 'border-stone-700 text-stone-500'
                    }`}
                  >
                    {state === 'done' ? '✓' : state === 'active' ? <span className="size-2 animate-pulse rounded-full bg-amber-300" /> : index + 1}
                  </span>
                  <span>
                    <span className={`block text-sm font-medium ${state === 'idle' ? 'text-stone-400' : 'text-stone-100'}`}>{step.label}</span>
                    <span className="block text-xs text-stone-500">{step.detail}</span>
                  </span>
                </li>
              );
            })}
          </ol>
          {progress.summary && (
            <p className="mt-4 border-t border-stone-800 pt-3 text-xs leading-relaxed text-stone-300">
              <span className="font-semibold text-amber-300">{progress.usedFallback ? 'Nhận diện (dự phòng): ' : 'Gemini hiểu là: '}</span>
              {progress.summary}
            </p>
          )}
          {progress.stage === 'error' && progress.message && (
            <p role="alert" className="mt-4 border-t border-stone-800 pt-3 text-xs text-son-300">{progress.message}</p>
          )}
        </aside>
      </div>
    </section>
  );
};
