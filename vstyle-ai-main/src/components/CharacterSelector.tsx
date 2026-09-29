import React from 'react';
import { CharacterItem } from '../types/fashion';
import { getCharacters } from '../lib/dal';

interface CharacterSelectorProps {
  selectedCharacterId: string;
  onSelect: (char: CharacterItem) => void;
}

export const CharacterSelector: React.FC<CharacterSelectorProps> = ({
  selectedCharacterId,
  onSelect,
}) => {
  const characters = getCharacters();

  return (
    <div className="bg-stone-900 border border-stone-800 rounded-xl p-4 sm:p-5 space-y-3">
      <div className="flex items-center justify-between gap-3 border-b border-stone-800 pb-2.5">
        <div>
          <h2 className="font-serif text-lg font-bold text-stone-100">Chọn nhân vật</h2>
          <p className="text-xs text-stone-400 mt-1">Đại diện cơ thể, tông da và tư thế lấy từ hồ sơ mẫu đã chuẩn bị.</p>
        </div>
        <span className="text-[11px] text-stone-500">Không suy đoán</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2.5">
        {characters.map((c) => {
          const isSelected = c.id === selectedCharacterId;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => onSelect(c)}
              aria-pressed={isSelected}
              className={`p-3 rounded-lg border text-left transition flex items-start gap-3 ${
                isSelected
                  ? 'bg-amber-950/30 border-amber-500 text-stone-100'
                  : 'bg-stone-950 border-stone-800 text-stone-400 hover:border-stone-700'
              }`}
            >
              <div className="shrink-0 w-12 h-16 rounded-md bg-stone-900 border border-stone-700 flex flex-col items-center justify-center gap-1" aria-hidden="true">
                <span className="size-5 rounded-full border border-black/20" style={{ backgroundColor: c.skinTone }} />
                <span className="w-7 h-8 rounded-t-full" style={{ backgroundColor: c.skinTone }} />
              </div>
              <div className="min-w-0">
                <div className="font-semibold text-sm text-stone-100">{c.name}</div>
                <div className="text-xs text-stone-400 mt-1 leading-relaxed">{c.bodyRepresentation}</div>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-stone-400">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="size-3 rounded-full border border-stone-600" style={{ backgroundColor: c.skinTone }} />
                    Tông da
                  </span>
                  <span>{c.pose.replaceAll('_', ' ').toLowerCase()}</span>
                </div>
                {isSelected && <div className="text-[10px] text-amber-300 mt-2">Đang chọn</div>}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
