import React from 'react';
import { Garment, Source } from '../types/fashion';
import { getAllSources } from '../lib/dal';
import { Dialog } from './ui/Dialog';

interface GarmentDetailModalProps {
  garment: Garment | null;
  onClose: () => void;
  onSelectForStyling?: (garment: Garment) => void;
}

export const GarmentDetailModal: React.FC<GarmentDetailModalProps> = ({
  garment,
  onClose,
  onSelectForStyling,
}) => {
  if (!garment) return null;

  const sourcesList = getAllSources();
  const sources = sourcesList.filter((s) => garment.sourceIds.includes(s.id));

  return (
    <Dialog bare title={garment.name} size="2xl" onClose={onClose}>
      <div className="bg-stone-900 border border-stone-700 rounded-t-3xl sm:rounded-3xl w-full p-5 sm:p-6 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-stone-800 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                {garment.status === 'APPROVED' ? '✓ Văn hóa đã xác thực' : 'Bản nháp nghiên cứu'}
              </span>
              <span className="text-xs text-stone-400">{garment.era}</span>
            </div>
            <h3 className="font-serif text-2xl font-bold text-stone-100 mt-1">
              {garment.name}
            </h3>
            <p className="text-xs text-stone-400 italic">{garment.vietnameseTitle}</p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="press grid size-10 place-items-center rounded-xl text-stone-400 hover:text-stone-100 hover:bg-stone-800"
          >
            ✕
          </button>
        </div>

        {/* Meaning & Historical Significance */}
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-amber-400">
            Nguồn gốc & ý nghĩa
          </h4>
          <p className="text-xs text-stone-300 leading-relaxed bg-stone-950/70 p-4 rounded-xl border border-stone-800">
            {garment.culturalMeaning}
          </p>
        </div>

        {/* Structural Characteristics */}
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-stone-300">
            Đặc trưng kết cấu
          </h4>
          <ul className="space-y-2 text-xs text-stone-300">
            {garment.characteristics.map((char, idx) => (
              <li key={idx} className="flex items-start gap-2 bg-stone-950/40 p-2.5 rounded-lg border border-stone-800/80">
                <span className="text-amber-500 font-bold mt-0.5">✦</span>
                <span>{char}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Non-negotiable Cultural Rules */}
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-son-400">
            Quy tắc không được làm sai
          </h4>
          <ul className="space-y-2 text-xs text-stone-300">
            {garment.nonNegotiables.map((rule, idx) => (
              <li key={idx} className="flex items-start gap-2 bg-rose-950/20 p-2.5 rounded-lg border border-rose-900/40 text-stone-200">
                <span aria-hidden="true" className="text-son-400 font-bold mt-0.5">▲</span>
                <span>{rule}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Base Colors */}
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-stone-300">
            Bảng màu đã duyệt
          </h4>
          <div className="flex flex-wrap gap-2">
            {garment.baseColors.map((color) => (
              <div
                key={color.hex}
                className="flex items-center gap-2 bg-stone-950 px-3 py-1.5 rounded-xl border border-stone-800 text-xs text-stone-200"
              >
                <span
                  className="w-4 h-4 rounded-full border border-stone-600 shadow-sm"
                  style={{ backgroundColor: color.hex }}
                ></span>
                <span>{color.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Verified Sources */}
        {sources.length > 0 && (
          <div className="space-y-2 pt-2 border-t border-stone-800">
            <h4 className="text-sm font-semibold text-stone-400">
              Nguồn khảo cứu
            </h4>
            <div className="space-y-2">
              {sources.map((src) => (
                <div key={src.id} className="text-xs bg-stone-950 p-3 rounded-xl border border-stone-800">
                  <div className="font-semibold text-stone-200">{src.title}</div>
                  <div className="text-[11px] text-stone-400 mt-0.5">
                    NXB: {src.publisher} • Thẩm định: <span className="text-emerald-400">{src.reviewedBy}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Bottom Action */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-stone-800">
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-medium"
          >
            Đóng
          </button>
          {onSelectForStyling && (
            <button
              onClick={() => {
                onSelectForStyling(garment);
                onClose();
              }}
              className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-stone-950 font-bold text-xs shadow-lg transition"
            >
              Phối với y phục này
            </button>
          )}
        </div>
      </div>
    </Dialog>
  );
};
