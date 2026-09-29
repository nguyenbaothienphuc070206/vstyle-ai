import React, { useState } from 'react';
import type { Outfit } from '../types/fashion';
import type { GeminiCaptionResponse } from '../types/gemini';
import { getEventById, getGarmentById } from '../lib/dal';
import { styleLabel } from '../lib/styles';
import { Dialog } from './ui/Dialog';
import { SealStamp } from './ui/SealStamp';

interface ShareModalProps {
  outfit: Outfit;
  caption?: GeminiCaptionResponse | null;
  isLoadingCaption?: boolean;
  onRequestCaption?: () => void;
  onClose: () => void;
}

export function buildShareUrl(outfit: Outfit, includeAdaptive: boolean): string {
  const adaptiveNeedCodes = outfit.adaptiveNeedCodes ?? (outfit.adaptiveNeedCode ? [outfit.adaptiveNeedCode] : []);
  const params = new URLSearchParams({
    garment: outfit.garmentId,
    color: outfit.primaryColor.replace('#', ''),
    pant: outfit.pantColor.replace('#', ''),
    event: outfit.eventId,
    vibe: outfit.styleVibe,
    ...(outfit.accessoryIds.length ? { acc: outfit.accessoryIds.join(',') } : {}),
    ...(includeAdaptive && adaptiveNeedCodes.length ? { adaptive: adaptiveNeedCodes.join(',') } : {}),
  });
  return `${window.location.origin}${window.location.pathname}?${params.toString()}`;
}

export const ShareModal: React.FC<ShareModalProps> = ({ outfit, caption, isLoadingCaption = false, onRequestCaption, onClose }) => {
  const [includeAdaptive, setIncludeAdaptive] = useState(false);
  const [copied, setCopied] = useState<'link' | 'caption' | null>(null);

  const garment = getGarmentById(outfit.garmentId);
  const event = getEventById(outfit.eventId);
  const adaptiveNeedCodes = outfit.adaptiveNeedCodes ?? (outfit.adaptiveNeedCode ? [outfit.adaptiveNeedCode] : []);
  const shareUrl = buildShareUrl(outfit, includeAdaptive);
  const captionText = caption
    ? `${caption.instagramCaption}${caption.hashtags.length ? `\n${caption.hashtags.join(' ')}` : ''}`
    : outfit.caption || `Mình vừa phối ${garment?.name ?? 'Việt phục'} cho ${event?.name ?? 'dịp đặc biệt'} trên Vstyle. Chuẩn bản sắc ${outfit.chuanScore}/100 · Chất theo gu ${outfit.chatScore}/100. #Vstyle #VietPhucRemix`;

  const copy = async (text: string, kind: 'link' | 'caption') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      window.setTimeout(() => setCopied(null), 2000);
    } catch {
      setCopied(null);
    }
  };

  const nativeShare = async () => {
    try {
      await navigator.share({ title: `Vstyle · ${outfit.title}`, text: captionText, url: shareUrl });
    } catch {
      // user cancelled
    }
  };

  return (
    <Dialog title="Chia sẻ lookbook Việt phục" description="Gửi bản phối kèm caption. Người nhận mở link sẽ thấy đúng y phục, màu, phụ kiện và dịp." size="lg" onClose={onClose}>
      <div className="space-y-5">
        <div className="flex items-start gap-4 rounded-2xl border border-stone-800 bg-stone-950 p-4">
          <SealStamp score={outfit.chuanScore} status={outfit.cultureStatus} size="md" />
          <div className="min-w-0">
            <h3 className="font-serif text-lg font-semibold text-stone-100">{outfit.title}</h3>
            <p className="mt-0.5 text-xs text-stone-400">{garment?.name} · {styleLabel(outfit.styleVibe)} · {event?.name}</p>
            <p className="mt-2 text-xs text-stone-300">Chất theo gu <strong className="tabular text-amber-300">{outfit.chatScore}/100</strong></p>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold text-stone-300">Caption</p>
            {onRequestCaption && (
              <button
                type="button"
                onClick={onRequestCaption}
                disabled={isLoadingCaption}
                className="press min-h-9 rounded-lg border border-amber-500/40 px-3 text-xs font-semibold text-amber-200 hover:bg-amber-500/10 disabled:opacity-50"
              >
                {isLoadingCaption ? 'Gemini đang viết…' : caption ? 'Viết lại bằng Gemini' : 'Viết caption bằng Gemini'}
              </button>
            )}
          </div>
          <div aria-live="polite" className="whitespace-pre-line rounded-xl border border-stone-800 bg-stone-950/70 p-3 text-sm leading-relaxed text-stone-200">
            {isLoadingCaption ? <span className="text-stone-400">Đang viết caption theo đúng dữ liệu văn hóa của bản phối…</span> : captionText}
          </div>
          {caption && !caption.usedFallback && caption.culturalHighlight && (
            <p className="text-xs text-stone-400"><span className="text-amber-300">Điểm văn hóa:</span> {caption.culturalHighlight}</p>
          )}
        </div>

        {adaptiveNeedCodes.length > 0 && (
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-stone-800 bg-stone-950/60 p-3 text-xs leading-relaxed text-stone-300">
            <input type="checkbox" checked={includeAdaptive} onChange={(eventChange) => setIncludeAdaptive(eventChange.target.checked)} className="mt-0.5 size-4 accent-amber-400" />
            <span>
              Kèm thông tin may đo thích ứng trong link công khai. <span className="text-stone-500">Mặc định tắt để bảo vệ quyền riêng tư của bạn.</span>
            </span>
          </label>
        )}

        <div className="space-y-2">
          <label htmlFor="share-link" className="text-xs font-semibold text-stone-300">Liên kết</label>
          <div className="flex gap-2">
            <input id="share-link" type="text" readOnly value={shareUrl} onFocus={(focusEvent) => focusEvent.target.select()} className="min-h-11 w-full rounded-xl border border-stone-700 bg-stone-950 px-3 font-mono text-xs text-stone-300" />
            <button type="button" onClick={() => copy(shareUrl, 'link')} className="press min-h-11 shrink-0 rounded-xl border border-stone-700 px-4 text-xs font-medium text-stone-100 hover:border-stone-500">
              {copied === 'link' ? 'Đã chép' : 'Chép link'}
            </button>
          </div>
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t border-stone-800 pt-4">
          {typeof navigator !== 'undefined' && 'share' in navigator && (
            <button type="button" onClick={nativeShare} className="press min-h-11 rounded-xl border border-stone-700 px-4 text-sm text-stone-200 hover:border-stone-500">
              Chia sẻ…
            </button>
          )}
          <button type="button" onClick={() => copy(`${captionText}\n\nXem bản phối: ${shareUrl}`, 'caption')} className="press min-h-11 rounded-xl bg-amber-400 px-5 text-sm font-semibold text-stone-950 hover:bg-amber-300">
            {copied === 'caption' ? 'Đã chép caption + link' : 'Chép caption + link'}
          </button>
        </div>
      </div>
    </Dialog>
  );
};
