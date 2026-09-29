import React from 'react';
import { AdaptiveRule, Source } from '../types/fashion';
import { checkAdaptive } from '../lib/adaptive/ruleEngine';

interface AdaptiveTailoringSheetProps {
  needCode?: string;
  garmentName: string;
  onClose?: () => void;
}

export const AdaptiveTailoringSheet: React.FC<AdaptiveTailoringSheetProps> = ({
  needCode,
  garmentName,
  onClose,
}) => {
  const result = checkAdaptive(needCode);

  return (
    <div className="bg-stone-900 border border-stone-800 rounded-2xl p-6 shadow-xl space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between border-b border-stone-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-amber-500/10 text-amber-400 rounded-lg">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.121 14.121L19 19m-7-7l7-7m-7 7l-2.879 2.879M12 12L9.121 9.121m0 5.758a3 3 0 10-4.243 4.243 3 3 0 004.243-4.243zm0-5.758a3 3 0 10-4.243-4.243 3 3 0 004.243 4.243z" />
              </svg>
            </span>
            <h3 className="font-serif text-lg font-bold text-stone-100">
              Cẩm Nang Kỹ Thuật May Đo Thích Ứng
            </h3>
          </div>
          <p className="text-xs text-stone-400 mt-1">
            Dành cho thợ may, nhà thiết kế và người mặc y phục truyền thống Việt Nam
          </p>
        </div>

        {onClose && (
          <button
            onClick={onClose}
            className="text-stone-400 hover:text-stone-200 text-lg p-1"
          >
            ✕
          </button>
        )}
      </div>

      {/* When no adaptive need is selected */}
      {!result.hasAdaptiveNeed && (
        <div className="bg-stone-950 p-4 rounded-xl border border-stone-800 text-stone-400 text-xs">
          Bạn chưa chọn thông số thích ứng nào. Bạn có thể chọn các chức năng hỗ trợ (ngồi xe lăn, giới hạn vận động tay, da nhạy cảm...) để xem hướng dẫn may đo kỹ thuật chi tiết.
        </div>
      )}

      {/* When adaptive need is not validated */}
      {result.hasAdaptiveNeed && !result.validated && (
        <div className="bg-amber-950/40 p-4 rounded-xl border border-amber-800/60 text-amber-200 text-xs space-y-1">
          <p className="font-semibold">Lưu ý kiểm định:</p>
          <p>{result.message}</p>
        </div>
      )}

      {/* Validated Technical Tailoring Sheet */}
      {result.hasAdaptiveNeed && result.validated && result.tailoringSpecs && (
        <div className="space-y-4">
          <div className="bg-stone-950/80 p-4 rounded-xl border border-amber-600/30 flex items-center justify-between">
            <div>
              <span className="text-xs text-amber-300 font-semibold block">
                Nhu cầu chức năng:
              </span>
              <p className="text-sm font-bold text-stone-100 mt-0.5">{result.needName}</p>
              <p className="text-xs text-stone-400 mt-1">Áp dụng cho: {garmentName}</p>
            </div>
            <span className="px-3 py-1 bg-emerald-500/10 text-emerald-400 text-xs rounded-full border border-emerald-500/30 font-medium">
              ✓ Đã Kiểm Định
            </span>
          </div>

          {/* Rationale */}
          <div className="space-y-1">
            <h4 className="text-sm font-semibold text-stone-300">
              Mục đích & Cơ sở khoa học:
            </h4>
            <p className="text-xs text-stone-300 leading-relaxed bg-stone-950/40 p-3 rounded-lg border border-stone-800">
              {result.reason}
            </p>
          </div>

          {/* Technical Tailoring Specifications Grid */}
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-stone-300">
              Thông số cắt may kỹ thuật cho xưởng may:
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              {result.tailoringSpecs.frontHemReduction && (
                <div className="bg-stone-950 p-3 rounded-xl border border-stone-800">
                  <span className="text-stone-400 block font-medium mb-1">Độ dài tà trước (Front Hem):</span>
                  <span className="text-amber-300 font-semibold">{result.tailoringSpecs.frontHemReduction}</span>
                </div>
              )}

              {result.tailoringSpecs.slitRaise && (
                <div className="bg-stone-950 p-3 rounded-xl border border-stone-800">
                  <span className="text-stone-400 block font-medium mb-1">Điểm xẻ tà (Slit Raise):</span>
                  <span className="text-amber-300 font-semibold">{result.tailoringSpecs.slitRaise}</span>
                </div>
              )}

              {result.tailoringSpecs.closureType && (
                <div className="bg-stone-950 p-3 rounded-xl border border-stone-800">
                  <span className="text-stone-400 block font-medium mb-1">Cơ chế đóng mở (Closures):</span>
                  <span className="text-stone-200">{result.tailoringSpecs.closureType}</span>
                </div>
              )}

              {result.tailoringSpecs.innerFabric && (
                <div className="bg-stone-950 p-3 rounded-xl border border-stone-800">
                  <span className="text-stone-400 block font-medium mb-1">Vải lót tiếp xúc da:</span>
                  <span className="text-stone-200">{result.tailoringSpecs.innerFabric}</span>
                </div>
              )}

              {result.tailoringSpecs.seamTechnique && (
                <div className="bg-stone-950 p-3 rounded-xl border border-stone-800">
                  <span className="text-stone-400 block font-medium mb-1">Kỹ thuật đường may:</span>
                  <span className="text-stone-200">{result.tailoringSpecs.seamTechnique}</span>
                </div>
              )}

              {result.tailoringSpecs.tagging && (
                <div className="bg-stone-950 p-3 rounded-xl border border-stone-800">
                  <span className="text-stone-400 block font-medium mb-1">Quy cách tem mác:</span>
                  <span className="text-stone-200">{result.tailoringSpecs.tagging}</span>
                </div>
              )}

              {result.tailoringSpecs.waistband && (
                <div className="bg-stone-950 p-3 rounded-xl border border-stone-800">
                  <span className="text-stone-400 block font-medium mb-1">Cạp quần thích ứng:</span>
                  <span className="text-stone-200">{result.tailoringSpecs.waistband}</span>
                </div>
              )}

              {result.tailoringSpecs.armhole && (
                <div className="bg-stone-950 p-3 rounded-xl border border-stone-800">
                  <span className="text-stone-400 block font-medium mb-1">Hạ nách & Vòng nách:</span>
                  <span className="text-stone-200">{result.tailoringSpecs.armhole}</span>
                </div>
              )}

              {result.tailoringSpecs.sideOpening && (
                <div className="bg-stone-950 p-3 rounded-xl border border-stone-800">
                  <span className="text-stone-400 block font-medium mb-1">Đường mở sườn trợ giúp:</span>
                  <span className="text-stone-200">{result.tailoringSpecs.sideOpening}</span>
                </div>
              )}
            </div>
          </div>

          {/* Source reference */}
          {result.source && (
            <div className="pt-2 border-t border-stone-800 text-[11px] text-stone-500 flex items-center justify-between">
              <span>Tiêu chuẩn: {result.source.title}</span>
              <span className="text-emerald-400">Thẩm định bởi {result.source.reviewedBy}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
