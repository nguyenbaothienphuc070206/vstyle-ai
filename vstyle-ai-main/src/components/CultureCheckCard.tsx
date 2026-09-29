import React, { useState } from 'react';
import { CultureCheckResult, Source } from '../types/fashion';
import { getAllSources } from '../lib/dal';

interface CultureCheckCardProps {
  result: CultureCheckResult;
}

export const CultureCheckCard: React.FC<CultureCheckCardProps> = ({ result }) => {
  const [selectedSource, setSelectedSource] = useState<Source | null>(null);

  const sourcesList = getAllSources();
  const verifiedSources = sourcesList.filter((s) => result.sourceIds.includes(s.id));

  const statusConfig = {
    KEEP: {
      label: 'Chuẩn Bản Sắc',
      badgeColor: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
      description: 'Bảo tồn trọn vẹn kết cấu và triết lý y phục truyền thống Việt Nam.',
      icon: '🛡️',
    },
    CONSIDER: {
      label: 'Cân Nhắc Bối Cảnh',
      badgeColor: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
      description: 'Có yếu tố biến tấu đương đại hoặc phụ kiện cần lưu ý bối cảnh xuất hiện.',
      icon: '⚖️',
    },
    WARNING: {
      label: 'Cần Lưu Ý Văn Hóa',
      badgeColor: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
      description: 'Phối này có điểm xung đột trực tiếp với quy thức trang phục cổ truyền đã được xác thực.',
      icon: '⚠️',
    },
  }[result.status];

  return (
    <div className="bg-stone-900 border border-stone-800 rounded-2xl p-5 shadow-lg flex flex-col gap-4">
      {/* Header with Chuẩn Score Gauge */}
      <div className="flex items-center justify-between border-b border-stone-800 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-lg">{statusConfig.icon}</span>
            <h3 className="font-serif text-lg font-bold text-stone-100">Chuẩn Bản Sắc</h3>
            <span className={`text-xs px-2.5 py-0.5 rounded-full border font-medium ${statusConfig.badgeColor}`}>
              {statusConfig.label}
            </span>
          </div>
          <p className="text-xs text-stone-400 mt-0.5">
            Kiểm tra dựa trên bộ quy tắc văn hóa của Vstyle.
          </p>
        </div>

        {/* Score Circle */}
        <div className="flex flex-col items-center">
          <div className="relative w-14 h-14 flex items-center justify-center rounded-full bg-stone-950 border-2 border-stone-700">
            <span className="text-lg font-bold text-amber-400 font-mono">{result.score}</span>
            <span className="text-[9px] text-stone-500 absolute bottom-1">/100</span>
          </div>
        </div>
      </div>

      {/* Rules evaluation */}
      <div className="space-y-2">
        <div className="text-xs font-semibold text-stone-300 uppercase tracking-wider">
          Đánh giá quy thức y phục:
        </div>
        <ul className="space-y-1.5">
          {result.reasons.map((reason, idx) => (
            <li key={idx} className="flex items-start gap-2 text-xs text-stone-300">
              <span className="text-amber-500 mt-0.5">✦</span>
              <span>{reason}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Retained Characteristics */}
      {result.retainedCharacteristics.length > 0 && (
        <div className="bg-stone-950/60 rounded-xl p-3 border border-stone-800/80">
          <div className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider mb-2">
            Đặc trưng văn hóa được bảo tồn:
          </div>
          <div className="flex flex-wrap gap-1.5">
            {result.retainedCharacteristics.map((item, idx) => (
              <span
                key={idx}
                className="text-[11px] bg-stone-800/80 text-stone-200 px-2.5 py-1 rounded-md border border-stone-700/50"
              >
                {item}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Sources Citations */}
      {verifiedSources.length > 0 && (
        <div className="pt-2 border-t border-stone-800">
          <div className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider mb-1.5">
            Tài liệu khảo cứu đã xác thực:
          </div>
          <div className="flex flex-wrap gap-2">
            {verifiedSources.map((src) => (
              <button
                key={src.id}
                onClick={() => setSelectedSource(src)}
                className="text-left text-xs bg-stone-950 hover:bg-stone-800 text-stone-300 hover:text-amber-300 px-2.5 py-1.5 rounded-lg border border-stone-800 transition flex items-center gap-1.5"
              >
                <span className="text-emerald-400 text-xs">✓</span>
                <span className="truncate max-w-[200px]">{src.title}</span>
                <span className="text-[10px] text-stone-500">({src.reviewedBy})</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Source Citation Modal */}
      {selectedSource && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-stone-900 border border-stone-700 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-stone-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
                <h4 className="font-serif font-bold text-stone-100 text-base">Hồ Sơ Nguồn Văn Hóa</h4>
              </div>
              <button
                onClick={() => setSelectedSource(null)}
                className="text-stone-400 hover:text-stone-100 text-lg p-1"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs text-stone-300">
              <div>
                <span className="text-stone-500 block mb-0.5">Tác phẩm / Thư tịch:</span>
                <p className="font-semibold text-stone-100 text-sm">{selectedSource.title}</p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-stone-500 block mb-0.5">Tác giả / Nhóm NC:</span>
                  <p className="text-stone-200">{selectedSource.author || 'Nhiều tác giả'}</p>
                </div>
                <div>
                  <span className="text-stone-500 block mb-0.5">Nhà xuất bản:</span>
                  <p className="text-stone-200">{selectedSource.publisher}</p>
                </div>
              </div>

              <div>
                <span className="text-stone-500 block mb-0.5">Hội đồng thẩm định:</span>
                <p className="text-emerald-400 font-medium">{selectedSource.reviewedBy} (Ngày {selectedSource.reviewedAt})</p>
              </div>

              {selectedSource.note && (
                <div className="bg-stone-950 p-3 rounded-lg border border-stone-800">
                  <span className="text-stone-400 block mb-1">Ghi chú chuyên môn:</span>
                  <p className="italic text-stone-300">{selectedSource.note}</p>
                </div>
              )}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setSelectedSource(null)}
                className="px-4 py-2 bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-medium rounded-lg"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
