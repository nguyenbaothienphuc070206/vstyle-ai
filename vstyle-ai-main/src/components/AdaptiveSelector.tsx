import React from 'react';
import { getApprovedSources, getAdaptiveNeeds, getValidatedAdaptiveAdjustments } from '../lib/dal';

interface AdaptiveSelectorProps {
  selectedNeedCodes: string[];
  onChange: (codes: string[]) => void;
  onOpenTailoringSheet?: (needCode: string) => void;
}

export const AdaptiveSelector: React.FC<AdaptiveSelectorProps> = ({
  selectedNeedCodes,
  onChange,
  onOpenTailoringSheet,
}) => {
  const verifiedSourceIds = new Set(getApprovedSources().map((source) => source.id));
  const supportedCodes = new Set(
    getValidatedAdaptiveAdjustments()
      .filter((adjustment) => verifiedSourceIds.has(adjustment.sourceId))
      .map((adjustment) => adjustment.needCode),
  );
  const options = getAdaptiveNeeds().filter((need) => supportedCodes.has(need.code));
  const toggleNeed = (code: string) => {
    onChange(
      selectedNeedCodes.includes(code)
        ? selectedNeedCodes.filter((selected) => selected !== code)
        : [...selectedNeedCodes, code],
    );
  };

  return (
    <div className="bg-stone-900 border border-stone-800 rounded-xl p-4 sm:p-5 space-y-4">
      <div className="flex items-start justify-between gap-3 border-b border-stone-800 pb-3">
        <div>
          <h2 className="font-serif text-lg font-bold text-stone-100">Nhu cầu thích ứng</h2>
          <p className="text-xs text-stone-400 mt-1">
            Tùy chọn. Chỉ chọn điều bạn chủ động muốn chia sẻ; không suy đoán từ hình ảnh.
          </p>
        </div>
        <button
          type="button"
          onClick={() => onChange([])}
          aria-pressed={selectedNeedCodes.length === 0}
          className={`shrink-0 px-3 py-2 rounded-lg border text-xs font-semibold transition ${
            selectedNeedCodes.length === 0
              ? 'bg-amber-600 border-amber-500 text-stone-950'
              : 'bg-stone-950 border-stone-700 text-stone-300 hover:border-stone-500'
          }`}
        >
          Bỏ qua
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {options.map((need) => {
          const isSelected = selectedNeedCodes.includes(need.code);
          return (
            <button
              key={need.code}
              type="button"
              onClick={() => toggleNeed(need.code)}
              aria-pressed={isSelected}
              className={`p-3 rounded-lg border text-left transition flex items-start gap-3 ${
                isSelected
                  ? 'bg-amber-950/30 border-amber-500 text-stone-100'
                  : 'bg-stone-950 border-stone-800 text-stone-300 hover:border-stone-700'
              }`}
            >
              <span className={`mt-0.5 grid place-items-center size-4 rounded border ${isSelected ? 'bg-amber-500 border-amber-400 text-stone-950' : 'border-stone-600 text-transparent'}`} aria-hidden="true">✓</span>
              <div className="flex-1">
                <div className="font-medium text-sm text-stone-100">{need.name}</div>
                <div className="text-xs text-stone-400 mt-1 leading-relaxed">{need.description}</div>
              </div>
            </button>
          );
        })}
      </div>

      {selectedNeedCodes[0] && onOpenTailoringSheet && (
        <button
          type="button"
          onClick={() => onOpenTailoringSheet(selectedNeedCodes[0])}
          className="text-xs text-amber-300 hover:text-amber-200 underline underline-offset-4"
        >
          Xem thông tin điều chỉnh đã xác thực
        </button>
      )}
    </div>
  );
};
