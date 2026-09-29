import React from 'react';
import { CharacterItem } from '../types/fashion';
import { getCharacters } from '../lib/dal';

interface CharacterSelectorProps {
  selectedCharacterId: string;
  onSelect: (char: CharacterItem) => void;
  skinTone?: string | null;
  onSkinToneChange?: (tone: string | null) => void;
}

export const SKIN_TONES: Array<{ hex: string; label: string }> = [
  { hex: '#F6D8C4', label: 'Sáng' },
  { hex: '#E8BD9C', label: 'Sáng ấm' },
  { hex: '#C99471', label: 'Trung bình' },
  { hex: '#A0694A', label: 'Rám nắng' },
  { hex: '#6E4530', label: 'Nâu sẫm' },
];

export const CharacterSelector: React.FC<CharacterSelectorProps> = ({
  selectedCharacterId,
  onSelect,
  skinTone = null,
  onSkinToneChange,
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

      {onSkinToneChange && (
        <fieldset className="rounded-lg border border-stone-800 bg-stone-950/50 p-3">
          <legend className="px-1 text-xs font-semibold text-stone-300">Tông da cho mockup</legend>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onSkinToneChange(null)}
              aria-pressed={!skinTone}
              className={`press min-h-10 rounded-full border px-3 text-xs ${!skinTone ? 'border-amber-400 text-amber-200' : 'border-stone-700 text-stone-400 hover:text-stone-200'}`}
            >
              Theo nhân vật
            </button>
            {SKIN_TONES.map((tone) => (
              <button
                key={tone.hex}
                type="button"
                onClick={() => onSkinToneChange(tone.hex)}
                aria-pressed={skinTone === tone.hex}
                aria-label={`Tông da ${tone.label}`}
                title={tone.label}
                className={`press size-10 rounded-full border-2 ${skinTone === tone.hex ? 'border-amber-300 ring-2 ring-amber-300/40' : 'border-stone-700 hover:border-stone-500'}`}
                style={{ backgroundColor: tone.hex }}
              />
            ))}
          </div>
        </fieldset>
      )}

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
