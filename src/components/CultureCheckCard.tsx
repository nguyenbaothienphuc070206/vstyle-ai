import React, { useState } from 'react';
import { CultureCheckResult, Source } from '../types/fashion';
import { getAllSources } from '../lib/dal';
import { Dialog } from './ui/Dialog';
import { SealStamp } from './ui/SealStamp';

interface CultureCheckCardProps {
  result: CultureCheckResult;
}

export const CultureCheckCard: React.FC<CultureCheckCardProps> = ({ result }) => {
  const [selectedSource, setSelectedSource] = useState<Source | null>(null);

  const sourcesList = getAllSources();
  const verifiedSources = sourcesList.filter((s) => result.sourceIds.includes(s.id));

  const statusConfig = {
    KEEP: {
      label: 'Giữ chuẩn',
      badgeColor: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
      description: 'Bảo tồn trọn vẹn kết cấu và triết lý y phục truyền thống Việt Nam.',
    },
    CONSIDER: {
      label: 'Cân nhắc bối cảnh',
      badgeColor: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
      description: 'Có yếu tố biến tấu đương đại hoặc phụ kiện cần lưu ý bối cảnh xuất hiện.',
    },
    WARNING: {
      label: 'Cần lưu ý văn hóa',
      badgeColor: 'bg-son-500/10 text-son-300 border-son-500/40',
      description: 'Phối này có điểm xung đột trực tiếp với quy thức trang phục cổ truyền đã được xác thực.',
    },
  }[result.status];

  return (
    <div className="bg-stone-900 border border-stone-800 rounded-2xl p-5 shadow-lg flex flex-col gap-4">
      {/* Header with Chuẩn Score Gauge */}
      <div className="flex items-center justify-between border-b border-stone-800 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-serif text-lg font-semibold text-stone-100">Chuẩn văn hóa</h3>
            <span className={`text-xs px-2.5 py-0.5 rounded-full border font-medium ${statusConfig.badgeColor}`}>
              {statusConfig.label}
            </span>
          </div>
          <p className="text-xs text-stone-400 mt-0.5">
            Bộ quy tắc có nguồn của Vstyle chấm — Gemini không thể thay đổi kết quả này.
          </p>
        </div>

        <SealStamp score={result.score} status={result.status} size="md" />
      </div>

      {/* Rules evaluation */}
      <div className="space-y-2">
        <div className="text-sm font-semibold text-stone-200">
          Đánh giá
        </div>
        <ul className="space-y-1.5">
          {result.reasons.map((reason, idx) => (
            <li key={idx} className="flex items-start gap-2 text-sm leading-relaxed text-stone-300">
              <span className="text-amber-500 mt-0.5">✦</span>
              <span>{reason}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Retained Characteristics */}
      {result.retainedCharacteristics.length > 0 && (
        <div className="bg-stone-950/60 rounded-xl p-3 border border-stone-800/80">
          <div className="text-xs font-semibold text-stone-300 mb-2">
            Đặc trưng được giữ lại
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
          <div className="text-xs font-semibold text-stone-300 mb-1.5">
            Nguồn đã thẩm định
          </div>
          <div className="flex flex-wrap gap-2">
            {verifiedSources.map((src) => (
              <button
                key={src.id}
                type="button"
                onClick={() => setSelectedSource(src)}
                className="min-h-10 text-left text-xs bg-stone-950 hover:bg-stone-800 text-stone-300 hover:text-amber-300 px-2.5 py-1.5 rounded-lg border border-stone-800 transition flex items-center gap-1.5"
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
        <Dialog title="Hồ sơ nguồn văn hóa" size="md" onClose={() => setSelectedSource(null)}>
          <div className="space-y-3 text-sm text-stone-300">
            <div>
              <span className="mb-0.5 block text-xs text-stone-500">Tác phẩm / thư tịch</span>
              <p className="font-semibold text-stone-100">{selectedSource.title}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="mb-0.5 block text-xs text-stone-500">Tác giả / nhóm nghiên cứu</span>
                <p className="text-stone-200">{selectedSource.author || 'Nhiều tác giả'}</p>
              </div>
              <div>
                <span className="mb-0.5 block text-xs text-stone-500">Nhà xuất bản</span>
                <p className="text-stone-200">{selectedSource.publisher}{selectedSource.year ? ` · ${selectedSource.year}` : ''}</p>
              </div>
            </div>
            <div>
              <span className="mb-0.5 block text-xs text-stone-500">Thẩm định</span>
              <p className="text-emerald-300">{selectedSource.reviewedBy}{selectedSource.reviewedAt ? ` · ${selectedSource.reviewedAt}` : ''}</p>
            </div>
            {(selectedSource.notes || selectedSource.note) && (
              <p className="rounded-lg border border-stone-800 bg-stone-950 p-3 text-xs italic text-stone-300">{selectedSource.notes || selectedSource.note}</p>
            )}
            {selectedSource.url && (
              <a href={selectedSource.url} target="_blank" rel="noreferrer noopener" className="inline-flex min-h-10 items-center text-xs font-medium text-amber-300 underline underline-offset-4">
                Mở nguồn tham khảo ↗
              </a>
            )}
          </div>
        </Dialog>
      )}
    </div>
  );
};
