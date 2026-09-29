import React, { useState } from 'react';
import { Outfit } from '../types/fashion';
import { getGarmentById } from '../lib/dal';

interface ShareModalProps {
  outfit: Outfit | null;
  onClose: () => void;
}

export const ShareModal: React.FC<ShareModalProps> = ({ outfit, onClose }) => {
  const [includeAdaptive, setIncludeAdaptive] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!outfit) return null;

  const garment = getGarmentById(outfit.garmentId);
  const adaptiveNeedCodes = outfit.adaptiveNeedCodes ?? (outfit.adaptiveNeedCode ? [outfit.adaptiveNeedCode] : []);

  // Generate share link
  const shareDataParams = new URLSearchParams({
    id: outfit.id,
    garment: outfit.garmentId,
    color: outfit.primaryColor.replace('#', ''),
    chuan: String(outfit.chuanScore),
    chat: String(outfit.chatScore),
    vibe: outfit.styleVibe,
    ...(includeAdaptive && adaptiveNeedCodes.length ? { adaptive: adaptiveNeedCodes.join(',') } : {}),
  });

  const shareUrl = `${window.location.origin}?${shareDataParams.toString()}`;

  const defaultCaption = outfit.caption || `Mình vừa phối bộ ${garment?.name || 'Việt phục'} trên Vstyle! Điểm Chuẩn bản sắc: ${outfit.chuanScore}/100, Điểm Chất theo gu: ${outfit.chatScore}/100. #Vstyle #VietPhucRemix`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyCaption = () => {
    navigator.clipboard.writeText(`${defaultCaption}\n\nXem bản phối tại: ${shareUrl}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-stone-900 border border-stone-700 rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl my-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-stone-800 pb-3">
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-amber-500/10 text-amber-400 rounded-lg">🔗</span>
            <h3 className="font-serif text-lg font-bold text-stone-100">Chia Sẻ Bản Phối Việt Phục</h3>
          </div>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-100 text-lg p-1">
            ✕
          </button>
        </div>

        {/* Outfit Preview Card */}
        <div className="bg-stone-950 p-4 rounded-2xl border border-stone-800 space-y-3">
          <div className="flex items-start justify-between">
            <div>
              <h4 className="font-serif font-bold text-stone-100 text-base">{outfit.title}</h4>
              <p className="text-xs text-stone-400">{garment?.name}</p>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full font-mono">
                Chuẩn: {outfit.chuanScore}
              </span>
              <span className="text-xs bg-amber-500/10 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full font-mono">
                Chất: {outfit.chatScore}
              </span>
            </div>
          </div>

          {/* Social Caption Preview */}
          <div className="bg-stone-900/90 p-3 rounded-xl border border-stone-800 text-xs text-stone-300 whitespace-pre-line leading-relaxed">
            {defaultCaption}
          </div>
        </div>

        {/* Privacy Control for Adaptive Information */}
        {adaptiveNeedCodes.length > 0 && (
          <div className="bg-stone-950/70 p-3.5 rounded-xl border border-stone-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-stone-200">
                Hiển thị {adaptiveNeedCodes.length > 1 ? 'các nhu cầu' : 'nhu cầu'} thích ứng trong link công khai?
              </span>
              <button
                type="button"
                onClick={() => setIncludeAdaptive(!includeAdaptive)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  includeAdaptive ? 'bg-amber-600' : 'bg-stone-700'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    includeAdaptive ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
            <p className="text-[11px] text-stone-400">
              * Mặc định TẮT để bảo vệ sự riêng tư. Chỉ bật nếu bạn muốn truyền cảm hứng và chia sẻ kinh nghiệm may đo thích ứng cho cộng đồng.
            </p>
          </div>
        )}

        {/* Link and Copy Action */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-stone-400 uppercase tracking-wider block">
            Liên kết trực tiếp:
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={shareUrl}
              className="w-full bg-stone-950 border border-stone-700 rounded-xl px-3 py-2 text-xs text-stone-300 font-mono select-all focus:outline-none"
            />
            <button
              onClick={handleCopyLink}
              className="px-4 py-2 bg-stone-800 hover:bg-stone-700 text-stone-100 text-xs font-medium rounded-xl whitespace-nowrap transition"
            >
              {copied ? 'Đã chép! ✓' : 'Chép link'}
            </button>
          </div>
        </div>

        {/* Bottom Actions */}
        <div className="flex items-center justify-between pt-2 border-t border-stone-800">
          <button
            onClick={onClose}
            className="px-4 py-2 text-stone-400 hover:text-stone-200 text-xs font-medium"
          >
            Đóng
          </button>
          <button
            onClick={handleCopyCaption}
            className="px-5 py-2.5 bg-amber-600 hover:bg-amber-500 text-stone-950 font-bold text-xs rounded-xl shadow-lg transition flex items-center gap-1.5"
          >
            <span>📋 Chép Caption & Link để đăng</span>
          </button>
        </div>
      </div>
    </div>
  );
};
