import React from 'react';
import { StyleScoreResult } from '../types/fashion';

interface StyleScoreCardProps {
  result: StyleScoreResult;
  styleVibe: string;
}

export const StyleScoreCard: React.FC<StyleScoreCardProps> = ({ result, styleVibe }) => {
  const vibeLabels: Record<string, string> = {
    TOI_GIAN: 'Tối Giản Tinh Tế',
    REMIX_GEN_Z: 'Remix Trẻ Trung Gen Z',
    SANG_TRONG: 'Sang Trọng Đẳng Cấp',
    TRUYEN_THONG_HOANG_GIA: 'Hoàng Gia Cổ Điển',
    TRUYEN_THONG: 'Truyền Thống',
    NANG_DONG: 'Trẻ Trung Năng Động',
    THANH_LICH: 'Thanh Lịch',
  };

  const harmonyLabels = {
    PERFECT: { label: 'Tuyệt Mỹ Cổ Điển', color: 'text-emerald-400 bg-emerald-500/10' },
    BALANCED: { label: 'Hài Hòa Nhã Nhặn', color: 'text-amber-400 bg-amber-500/10' },
    BOLD: { label: 'Phá Cách Nổi Bật', color: 'text-violet-400 bg-violet-500/10' },
    MUTED: { label: 'Trầm Lắng Hoài Cổ', color: 'text-stone-400 bg-stone-500/10' },
  }[result.colorHarmony];

  return (
    <div className="bg-stone-900 border border-stone-800 rounded-2xl p-5 shadow-lg flex flex-col gap-4">
      {/* Header with Chất Score Gauge */}
      <div className="flex items-center justify-between border-b border-stone-800 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-lg">✨</span>
            <h3 className="font-serif text-lg font-bold text-stone-100">Chất Theo Gu</h3>
            <span className="text-xs px-2.5 py-0.5 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-300 font-medium">
              {result.label}
            </span>
          </div>
          <p className="text-xs text-stone-400 mt-0.5">
            Đánh giá độ hài hòa thời trang và cá tính phối đồ riêng của bạn.
          </p>
        </div>

        {/* Score Circle */}
        <div className="flex flex-col items-center">
          <div className="relative w-14 h-14 flex items-center justify-center rounded-full bg-stone-950 border-2 border-amber-500/60 shadow-inner">
            <span className="text-lg font-bold text-amber-300 font-mono">{result.score}</span>
            <span className="text-[9px] text-stone-500 absolute bottom-1">/100</span>
          </div>
        </div>
      </div>

      {/* Style Elements Breakdown */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="bg-stone-950/70 p-2.5 rounded-xl border border-stone-800/80">
          <span className="text-[11px] text-stone-400 block mb-1">Phong cách hướng tới:</span>
          <span className="font-semibold text-stone-200">{vibeLabels[styleVibe] || styleVibe}</span>
        </div>

        <div className="bg-stone-950/70 p-2.5 rounded-xl border border-stone-800/80">
          <span className="text-[11px] text-stone-400 block mb-1">Phối màu sắc:</span>
          <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-medium ${harmonyLabels.color}`}>
            {harmonyLabels.label}
          </span>
        </div>
      </div>

      {/* Feedback notes */}
      <div className="space-y-1.5">
        <div className="text-xs font-semibold text-stone-300 uppercase tracking-wider">
          Ghi chú phối phong cách:
        </div>
        <ul className="space-y-1.5">
          {result.feedback.map((note, idx) => (
            <li key={idx} className="flex items-start gap-2 text-xs text-stone-300">
              <span className="text-amber-400 mt-0.5">✔</span>
              <span>{note}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="pt-2 border-t border-stone-800 text-[11px] text-stone-500 italic">
        * "Chất theo gu" tôn vinh tính cá nhân hóa và sự tự do biểu đạt phong cách, không mang tính phán xét văn hóa bắt buộc.
      </div>
    </div>
  );
};
