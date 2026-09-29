import React from 'react';
import type { CharacterItem, FunctionalNeedCode } from '../types/fashion';
import { getApprovedAccessories, getApprovedGarments } from '../lib/dal';
import type { DeterministicRecommendation } from '../lib/recommendation/engine';
import { checkCulture } from '../lib/culture/ruleEngine';
import { STYLE_VIBE_BY_TAG, styleLabel } from '../lib/styles';
import { OutfitMockupCanvas } from './OutfitMockupCanvas';
import { SealStamp } from './ui/SealStamp';

interface RecommendationGalleryProps {
  candidates: DeterministicRecommendation[];
  character: CharacterItem;
  pantColor: string;
  adaptiveNeedCodes: FunctionalNeedCode[];
  rankedByGemini: boolean;
  onSelect: (candidate: DeterministicRecommendation) => void;
}

const garmentsById = new Map(getApprovedGarments().map((garment) => [garment.id, garment]));
const accessoriesById = new Map(getApprovedAccessories().map((accessory) => [accessory.id, accessory]));

export const RecommendationGallery: React.FC<RecommendationGalleryProps> = ({
  candidates,
  character,
  pantColor,
  adaptiveNeedCodes,
  rankedByGemini,
  onSelect,
}) => (
  <div className="space-y-3">
    <p className="text-xs text-stone-400">
      {rankedByGemini
        ? 'Thứ tự do Gemini xếp hạng theo bối cảnh của bạn; mọi bản phối đều đã qua bộ quy tắc văn hóa.'
        : 'Thứ tự theo điểm của bộ quy tắc Vstyle (Gemini chưa sẵn sàng); mọi bản phối đều đã qua kiểm tra văn hóa.'}
    </p>
    <ol className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {candidates.map((candidate, index) => {
        const garment = garmentsById.get(candidate.garmentId);
        if (!garment) return null;
        const color = garment.baseColors.find((item) => item.hex.toLowerCase() === candidate.color.toLowerCase());
        const accessories = candidate.accessoryIds.flatMap((id) => {
          const accessory = accessoriesById.get(id);
          return accessory ? [accessory] : [];
        });
        const culture = checkCulture({
          garmentId: candidate.garmentId,
          accessoryIds: candidate.accessoryIds,
          eventId: candidate.eventId,
          primaryColor: candidate.color,
          adaptiveNeedCode: adaptiveNeedCodes[0],
        });
        const styleId = STYLE_VIBE_BY_TAG[candidate.style] ?? candidate.style;

        return (
          <li key={candidate.outfitId} className="flex flex-col overflow-hidden rounded-2xl border border-stone-800 bg-stone-900 animate-rise" style={{ animationDelay: `${index * 70}ms` }}>
            <div className="relative">
              <OutfitMockupCanvas
                garment={garment}
                primaryColor={candidate.color}
                pantColor={pantColor}
                accessories={accessories}
                character={character}
                adaptiveNeedCodes={adaptiveNeedCodes}
                styleId={styleId}
                compact
              />
              <span className="absolute left-3 top-3 rounded-md border border-white/10 bg-stone-950/80 px-2 py-1 text-[11px] font-medium text-stone-200 backdrop-blur">
                {rankedByGemini ? `Gemini chọn #${index + 1}` : `Gợi ý #${index + 1}`}
              </span>
              <div className="absolute right-3 top-3">
                <SealStamp score={culture.score} status={culture.status} size="sm" />
              </div>
            </div>

            <div className="flex flex-1 flex-col gap-3 p-4">
              <div>
                <h3 className="font-serif text-lg font-semibold text-stone-100">{garment.name}</h3>
                <p className="mt-0.5 flex items-center gap-2 text-xs text-stone-400">
                  <span aria-hidden="true" className="size-3.5 rounded-full border border-white/15" style={{ backgroundColor: candidate.color }} />
                  {color?.name ?? candidate.color} · {styleLabel(styleId)}
                </p>
              </div>
              <p className="text-xs leading-relaxed text-stone-400">
                {accessories.length ? accessories.map((accessory) => accessory.name).join(' · ') : 'Không thêm phụ kiện'}
              </p>
              <ul className="space-y-1 border-t border-stone-800 pt-3 text-xs leading-relaxed text-stone-300">
                {candidate.reasons.slice(0, 2).map((reason) => <li key={reason}>· {reason}</li>)}
              </ul>
              <button
                type="button"
                onClick={() => onSelect(candidate)}
                className="press mt-auto min-h-11 w-full rounded-xl bg-amber-400 px-3 text-sm font-semibold text-stone-950 hover:bg-amber-300"
              >
                Chọn bản phối này
              </button>
            </div>
          </li>
        );
      })}
    </ol>
  </div>
);
