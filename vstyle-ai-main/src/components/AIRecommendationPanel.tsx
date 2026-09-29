import React, { useState } from 'react';
import { GeminiExplainResponse, GeminiCaptionResponse } from '../types/gemini';

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

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCaption(true);
    setTimeout(() => setCopiedCaption(false), 2000);
  };

  return (
    <div className="bg-stone-900 border border-stone-800 rounded-2xl p-5 shadow-lg space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-stone-800 pb-3">
        <div className="flex items-center gap-2">
          <span className="p-1.5 bg-amber-500/10 text-amber-400 rounded-lg">✨</span>
          <div>
            <h3 className="font-serif text-base font-bold text-stone-100">
              Nhận Định Thời Trang Từ Gemini AI
            </h3>
            <p className="text-[11px] text-stone-400">
              Phân tích gu thẩm mỹ & cảm hứng diện đồ dựa trên dữ liệu văn hóa chuẩn mực
            </p>
          </div>
        </div>

        <button
          onClick={onRefreshExplain}
          disabled={isLoadingExplain}
          className="text-xs text-stone-400 hover:text-stone-200 p-1.5 bg-stone-950 rounded-lg border border-stone-800 transition"
          title="Tạo lại nhận định thời trang"
        >
          {isLoadingExplain ? '...' : '↻ Làm mới'}
        </button>
      </div>

      {/* Loading state */}
      {isLoadingExplain && (
        <div className="py-6 flex flex-col items-center justify-center text-center space-y-2 text-stone-400 text-xs">
          <svg className="animate-spin w-5 h-5 text-amber-500" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
          </svg>
          <span>Gemini AI đang lắng nghe và phân tích bản phối...</span>
        </div>
      )}

      {/* Explanation Content */}
      {!isLoadingExplain && explanation && (
        <div className="space-y-4 text-xs">
          <div>
            <h4 className="font-serif text-base font-bold text-amber-300">
              "{explanation.headline}"
            </h4>
            <p className="text-stone-300 mt-1.5 leading-relaxed bg-stone-950/70 p-3 rounded-xl border border-stone-800">
              {explanation.editorialReview}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div className="bg-stone-950/60 p-3 rounded-xl border border-stone-800">
              <span className="text-[11px] font-semibold text-emerald-400 block mb-1">
                Giao hòa bản sắc:
              </span>
              <p className="text-stone-300">{explanation.culturalHarmony}</p>
            </div>

            <div className="bg-stone-950/60 p-3 rounded-xl border border-stone-800">
              <span className="text-[11px] font-semibold text-amber-400 block mb-1">
                Điểm nhấn phong cách:
              </span>
              <p className="text-stone-300">{explanation.styleRemixVerdict}</p>
            </div>
          </div>

          {/* Advice list */}
          {explanation.adviceForWearing && explanation.adviceForWearing.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider block">
                Mẹo mặc & phong thái chuẩn mực:
              </span>
              <ul className="space-y-1">
                {explanation.adviceForWearing.map((adv, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-stone-300">
                    <span className="text-amber-500 mt-0.5">✦</span>
                    <span>{adv}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Social Caption Generator */}
      <div className="pt-3 border-t border-stone-800 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-stone-300 flex items-center gap-1.5">
            <span>📱</span>
            <span>Caption Mạng Xã Hội (Instagram / TikTok):</span>
          </span>

          {!caption && (
            <button
              onClick={onRequestCaption}
              disabled={isLoadingCaption}
              className="px-3 py-1 bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 text-xs font-semibold rounded-lg border border-amber-500/30 transition"
            >
              {isLoadingCaption ? 'Đang viết...' : 'Tạo caption AI ✨'}
            </button>
          )}
        </div>

        {caption && (
          <div className="bg-stone-950 p-3 rounded-xl border border-stone-800 space-y-2 text-xs">
            <p className="text-stone-200 whitespace-pre-line leading-relaxed">
              {caption.instagramCaption}
            </p>
            <div className="flex items-center justify-between pt-2 border-t border-stone-900">
              <span className="text-[11px] text-stone-500 font-mono">
                {caption.hashtags.join(' ')}
              </span>
              <button
                onClick={() => handleCopy(caption.instagramCaption)}
                className="px-2.5 py-1 bg-stone-800 hover:bg-stone-700 text-stone-200 rounded text-[11px] transition"
              >
                {copiedCaption ? 'Đã chép! ✓' : 'Chép caption'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
