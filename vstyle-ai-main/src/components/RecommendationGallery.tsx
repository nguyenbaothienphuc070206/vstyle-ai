import React from 'react';
import { getApprovedAccessories, getApprovedGarments } from '../lib/dal';
import { DeterministicRecommendation } from '../lib/recommendation/engine';

interface RecommendationGalleryProps {
  candidates: DeterministicRecommendation[];
  onSelect: (candidate: DeterministicRecommendation) => void;
}

const garmentsById = new Map(getApprovedGarments().map((garment) => [garment.id, garment]));
const accessoriesById = new Map(getApprovedAccessories().map((accessory) => [accessory.id, accessory]));

export const RecommendationGallery: React.FC<RecommendationGalleryProps> = ({ candidates, onSelect }) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
    {candidates.map((candidate, index) => {
      const garment = garmentsById.get(candidate.garmentId);
      const color = garment?.baseColors.find((item) => item.hex.toLowerCase() === candidate.color.toLowerCase());
      const accessoryNames = candidate.accessoryIds
        .map((id) => accessoriesById.get(id)?.name)
        .filter((name): name is string => Boolean(name));

      return (
        <article key={candidate.outfitId} className="overflow-hidden rounded-xl border border-stone-800 bg-stone-900">
          <div
            className="relative aspect-4/3 overflow-hidden bg-[radial-gradient(ellipse_at_50%_25%,rgba(250,204,21,0.14),transparent_65%),linear-gradient(145deg,#292524,#0c0a09)]"
            role="img"
            aria-label={`Bản phác màu ${color?.name ?? candidate.color} cho ${garment?.name ?? 'y phục'}`}
          >
            <div className="absolute bottom-0 left-1/2 h-[70%] w-28 -translate-x-1/2 rounded-t-[46%] bg-stone-800/80" />
            <div
              className="absolute bottom-[7%] left-1/2 h-[69%] w-[31%] -translate-x-1/2"
              style={{
                backgroundColor: candidate.color,
                clipPath: 'polygon(28% 0, 72% 0, 100% 19%, 86% 100%, 14% 100%, 0 19%)',
              }}
            />
            <div className="absolute bottom-[6%] left-1/2 h-[44%] w-[43%] -translate-x-1/2 bg-stone-950/90" />
            <span className="absolute left-3 top-3 rounded-md border border-white/10 bg-stone-950/75 px-2 py-1 text-[10px] font-medium uppercase text-stone-300">
              Phác thảo {index + 1}
            </span>
            <span className="absolute right-3 top-3 rounded-md bg-stone-950/80 px-2 py-1 text-xs font-semibold text-amber-300">
              {candidate.score}/100
            </span>
          </div>

          <div className="space-y-3 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="font-serif text-base font-bold text-stone-100">{garment?.name ?? 'Y phục'}</h3>
                <p className="mt-1 text-xs text-stone-400">{candidate.style.replaceAll('_', ' ')}</p>
              </div>
              <span className={`shrink-0 rounded-md border px-2 py-1 text-[10px] ${
                candidate.cultureStatus === 'KEEP'
                  ? 'border-emerald-800 bg-emerald-950/40 text-emerald-300'
                  : 'border-amber-800 bg-amber-950/40 text-amber-300'
              }`}>
                {candidate.cultureStatus}
              </span>
            </div>

            <div className="flex items-center gap-2 text-xs text-stone-300">
              <span className="size-4 rounded-full border border-stone-600" style={{ backgroundColor: candidate.color }} />
              <span>{color?.name ?? candidate.color}</span>
            </div>

            <div className="min-h-8 text-xs leading-relaxed text-stone-400">
              {accessoryNames.length ? accessoryNames.join(' · ') : 'Không thêm phụ kiện'}
            </div>

            <ul className="space-y-1 border-t border-stone-800 pt-3 text-xs leading-relaxed text-stone-300">
              {candidate.reasons.slice(0, 2).map((reason) => <li key={reason}>• {reason}</li>)}
            </ul>

            <button
              type="button"
              onClick={() => onSelect(candidate)}
              className="w-full rounded-lg bg-amber-500 px-3 py-2.5 text-sm font-bold text-stone-950 transition hover:bg-amber-400"
            >
              Mặc thử bản phối
            </button>
          </div>
        </article>
      );
    })}
  </div>
);