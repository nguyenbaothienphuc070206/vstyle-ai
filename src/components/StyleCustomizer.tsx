import React from 'react';
import { Garment, Accessory } from '../types/fashion';
import { getApprovedAccessories } from '../lib/dal';

interface StyleCustomizerProps {
  garment: Garment;
  selectedColorHex: string;
  selectedPantColorHex: string;
  selectedAccessoryIds: string[];
  eventId?: string;
  showColors?: boolean;
  showPantColors?: boolean;
  showAccessories?: boolean;
  onColorChange: (hex: string) => void;
  onPantColorChange: (hex: string) => void;
  onToggleAccessory: (id: string) => void;
}

export const StyleCustomizer: React.FC<StyleCustomizerProps> = ({
  garment,
  selectedColorHex,
  selectedPantColorHex,
  selectedAccessoryIds,
  eventId,
  showColors = true,
  showPantColors = true,
  showAccessories = true,
  onColorChange,
  onPantColorChange,
  onToggleAccessory,
}) => {
  const accessories = getApprovedAccessories().filter((accessory) =>
    accessory.compatibleGarmentIds.includes(garment.id) &&
    garment.compatibleAccessoryIds.includes(accessory.id) &&
    (!eventId || !accessory.compatibleEventIds.length || accessory.compatibleEventIds.includes(eventId)),
  );

  // Pant colors
  const pantColors = [
    { name: 'Trắng Ngà Tự Nhiên (Lễ Phục)', hex: '#F4F0E8' },
    { name: 'Đen Tuyển Lụa (Thanh Lịch)', hex: '#1C1C1E' },
    { name: 'Nâu Trầm Cổ', hex: '#5D4037' },
    { name: 'Đỏ Chu Sa (Hỷ Khúc)', hex: '#8B1E2B' },
  ];

  return (
    <div className="bg-stone-900 border border-stone-800 rounded-2xl p-5 shadow-lg space-y-5">
      <div className="border-b border-stone-800 pb-3">
        <h3 className="font-serif text-base font-bold text-stone-100 flex items-center gap-2">
          <span>{showAccessories && !showColors ? 'Phụ kiện phối lớp' : 'Màu sắc bản phối'}</span>
        </h3>
        <p className="text-xs text-stone-400 mt-0.5">
          {showAccessories && !showColors ? 'Chỉ hiện phụ kiện đã duyệt và hợp với y phục, dịp của bạn.' : 'Bảng màu lấy từ dữ liệu y phục đã xác thực.'}
        </p>
      </div>

      {/* 1. Primary Garment Color */}
      {showColors && <div className="space-y-2">
        <label className="text-sm font-semibold text-stone-200 block">
          Màu tà áo
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {garment.baseColors.map((color) => {
            const isSelected = color.hex.toLowerCase() === selectedColorHex.toLowerCase();
            return (
              <button
                key={color.hex}
                type="button"
                onClick={() => onColorChange(color.hex)}
                aria-pressed={isSelected}
                className={`press min-h-11 p-2 rounded-xl border flex items-center gap-2 transition ${
                  isSelected
                    ? 'bg-stone-800 border-amber-400 ring-1 ring-amber-400'
                    : 'bg-stone-950 border-stone-800 hover:border-stone-700'
                }`}
              >
                <span
                  className="w-4 h-4 rounded-full border border-stone-600 shrink-0"
                  style={{ backgroundColor: color.hex }}
                />
                <span className="text-xs text-stone-200 truncate">{color.name}</span>
              </button>
            );
          })}
        </div>
      </div>}

      {/* 2. Pant Color */}
      {showPantColors && <div className="space-y-2">
        <label className="text-sm font-semibold text-stone-200 block">
          Màu quần / chân váy
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {pantColors.map((pc) => {
            const isSelected = pc.hex.toLowerCase() === selectedPantColorHex.toLowerCase();
            return (
              <button
                key={pc.hex}
                type="button"
                onClick={() => onPantColorChange(pc.hex)}
                aria-pressed={isSelected}
                className={`press min-h-11 p-2 rounded-xl border flex items-center gap-2 transition ${
                  isSelected
                    ? 'bg-stone-800 border-amber-400 ring-1 ring-amber-400'
                    : 'bg-stone-950 border-stone-800 hover:border-stone-700'
                }`}
              >
                <span
                  className="w-4 h-4 rounded-full border border-stone-600 shrink-0"
                  style={{ backgroundColor: pc.hex }}
                />
                <span className="text-xs text-stone-200 truncate">{pc.name.split('(')[0]}</span>
              </button>
            );
          })}
        </div>
      </div>}

      {/* 3. Layered Accessories */}
      {showAccessories && <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <label className="text-sm font-semibold text-stone-200 block">
            Phụ kiện
          </label>
          <span className="text-[11px] text-stone-500">
            {selectedAccessoryIds.length} món đang chọn
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {accessories.map((acc) => {
            const isSelected = selectedAccessoryIds.includes(acc.id);
            const isNativeCompatible = true;

            return (
              <button
                key={acc.id}
                type="button"
                onClick={() => onToggleAccessory(acc.id)}
                  aria-pressed={isSelected}
                className={`p-2.5 rounded-xl border text-left flex items-start gap-2.5 transition ${
                  isSelected
                    ? 'bg-amber-950/40 border-amber-500 text-stone-100 ring-1 ring-amber-500'
                    : 'bg-stone-950 border-stone-800 text-stone-400 hover:border-stone-700'
                }`}
              >
                <div className="text-base mt-0.5">
                  {acc.type === 'HEADWEAR' && '◉'}
                  {acc.type === 'HAIR_ACCESSORY' && '✦'}
                  {acc.type === 'JEWELRY' && '◇'}
                  {acc.type === 'PENDANT' && '⌑'}
                  {acc.type === 'HANDHELD' && '≋'}
                  {acc.type === 'FOOTWEAR' && '⌑'}
                  {acc.type === 'BAG' && '▱'}
                  {acc.type === 'BELT_SASH' && '—'}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-semibold text-xs text-stone-200 truncate">{acc.name}</span>
                    {isNativeCompatible && <span className="text-[9px] px-1.5 py-0.5 bg-emerald-950 text-emerald-400 border border-emerald-800 rounded shrink-0">Tương thích</span>}
                  </div>
                  <p className="text-[10px] text-stone-400 mt-0.5 line-clamp-1">{acc.description}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>}
    </div>
  );
};
