import React from 'react';
import { Garment, Accessory, CharacterItem } from '../types/fashion';
import { OutfitMockupCanvas } from './OutfitMockupCanvas';
import { checkCulture } from '../lib/culture/ruleEngine';
import { calculateStyleScore } from '../lib/recommendation/engine';
import { getApprovedGarments, getApprovedAccessories, getCharacters } from '../lib/dal';

interface CompareViewProps {
  onClose: () => void;
}

export const CompareView: React.FC<CompareViewProps> = ({ onClose }) => {
  const garments = getApprovedGarments();
  const accessories = getApprovedAccessories();
  const characters = getCharacters();

  // Setup Outfit A: Nguyên bản Lễ phục Triều Nguyễn (Áo Tấc)
  const garmentA = garments.find((g) => g.id === 'garment-ao-tac') || garments[0];
  const accsA = accessories.filter((a) => ['acc-khan-dong', 'acc-the-bai', 'acc-hai-sen'].includes(a.id));
  const charA = characters.find((c) => c.id === 'char-nam-nho-nha') || characters[0];
  const cultureA = checkCulture({
    garmentId: garmentA.id,
    accessoryIds: accsA.map((a) => a.id),
    eventId: 'LE_TOT_NGHIEP',
    primaryColor: '#2B5C8F',
  });
  const styleA = calculateStyleScore(garmentA, '#2B5C8F', accsA.map((a) => a.id), 'LE_TOT_NGHIEP', 'TOI_GIAN');

  // Setup Outfit B: Remix Đương đại Gen Z (Áo Ngũ Thân Tân Thời + Sneaker + Túi cói)
  const garmentB = garments.find((g) => g.id === 'garment-ao-dai-ngu-than-remix') || garments[0];
  const accsB = accessories.filter((a) => ['acc-sneaker-retro', 'acc-tui-coi', 'acc-kieng-bac'].includes(a.id));
  const charB = characters.find((c) => c.id === 'char-tu-do-genz') || characters[0];
  const cultureB = checkCulture({
    garmentId: garmentB.id,
    accessoryIds: accsB.map((a) => a.id),
    eventId: 'DAO_PHO',
    primaryColor: '#3D5A45',
  });
  const styleB = calculateStyleScore(garmentB, '#3D5A45', accsB.map((a) => a.id), 'DAO_PHO', 'REMIX_GEN_Z');

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-stone-900 border border-stone-700 rounded-3xl max-w-5xl w-full p-6 space-y-6 shadow-2xl max-h-[92vh] overflow-y-auto my-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-stone-800 pb-4">
          <div>
            <span className="text-xs text-amber-400 font-mono uppercase tracking-wider font-semibold">
              Bàn So Sánh Phong Cách
            </span>
            <h3 className="font-serif text-2xl font-bold text-stone-100 mt-0.5">
              Nguyên Bản Cổ Truyền vs. Remix Đương Đại
            </h3>
            <p className="text-xs text-stone-400 mt-1">
              Phân tích trực quan giữa bảo tồn quy thức mẫu mực và tinh thần sáng tạo Gen Z
            </p>
          </div>

          <button
            onClick={onClose}
            className="text-stone-400 hover:text-stone-100 text-xl p-2 rounded-xl hover:bg-stone-800"
          >
            ✕
          </button>
        </div>

        {/* Side by side comparison */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Column A: Cổ Truyền Nguyên Bản */}
          <div className="bg-stone-950/80 rounded-2xl border border-stone-800 p-4 space-y-4">
            <div className="flex items-center justify-between">
              <span className="px-3 py-1 bg-amber-500/10 text-amber-400 border border-amber-500/30 rounded-full text-xs font-semibold">
                Phương Án A: Cổ Truyền Nguyên Bản
              </span>
              <span className="text-xs text-stone-400">Lễ Nghi Chuẩn Mực</span>
            </div>

            <div className="max-w-[280px] mx-auto">
              <OutfitMockupCanvas
                garment={garmentA}
                primaryColor="#2B5C8F"
                pantColor="#1C1C1E"
                accessories={accsA}
                character={charA}
              />
            </div>

            <div className="space-y-2">
              <h4 className="font-serif font-bold text-stone-100 text-base">{garmentA.name}</h4>
              <p className="text-xs text-stone-400">{garmentA.vietnameseTitle}</p>
            </div>

            {/* Scores */}
            <div className="grid grid-cols-2 gap-2 text-center">
              <div className="bg-stone-900 p-2.5 rounded-xl border border-stone-800">
                <span className="text-[11px] text-stone-400 block">Chuẩn Bản Sắc</span>
                <span className="text-lg font-bold text-emerald-400 font-mono">{cultureA.score}/100</span>
              </div>
              <div className="bg-stone-900 p-2.5 rounded-xl border border-stone-800">
                <span className="text-[11px] text-stone-400 block">Chất Theo Gu</span>
                <span className="text-lg font-bold text-amber-300 font-mono">{styleA.score}/100</span>
              </div>
            </div>

            {/* Pros & Context */}
            <div className="space-y-1.5 text-xs text-stone-300">
              <div className="font-semibold text-stone-200">Điểm mạnh bối cảnh:</div>
              <p className="bg-stone-900/60 p-2 rounded-lg border border-stone-800/60 text-stone-300 text-[11px]">
                Tuyệt đối trang nghiêm trong các sự kiện đại lễ: Lễ tốt nghiệp, Lễ Hỷ gia tiên, Thờ phụng tổ tiên. Tạo thần thái nho nhã, uy nghi.
              </p>
            </div>
          </div>

          {/* Column B: Remix Đương Đại */}
          <div className="bg-stone-950/80 rounded-2xl border border-stone-800 p-4 space-y-4">
            <div className="flex items-center justify-between">
              <span className="px-3 py-1 bg-violet-500/10 text-violet-400 border border-violet-500/30 rounded-full text-xs font-semibold">
                Phương Án B: Việt Phục Remix Gen Z
              </span>
              <span className="text-xs text-stone-400">Năng Động Hòa Nhập</span>
            </div>

            <div className="max-w-[280px] mx-auto">
              <OutfitMockupCanvas
                garment={garmentB}
                primaryColor="#3D5A45"
                pantColor="#EBE5D8"
                accessories={accsB}
                character={charB}
              />
            </div>

            <div className="space-y-2">
              <h4 className="font-serif font-bold text-stone-100 text-base">{garmentB.name}</h4>
              <p className="text-xs text-stone-400">{garmentB.vietnameseTitle}</p>
            </div>

            {/* Scores */}
            <div className="grid grid-cols-2 gap-2 text-center">
              <div className="bg-stone-900 p-2.5 rounded-xl border border-stone-800">
                <span className="text-[11px] text-stone-400 block">Chuẩn Bản Sắc</span>
                <span className="text-lg font-bold text-emerald-400 font-mono">{cultureB.score}/100</span>
              </div>
              <div className="bg-stone-900 p-2.5 rounded-xl border border-stone-800">
                <span className="text-lg font-bold text-violet-300 font-mono">{styleB.score}/100</span>
                <span className="text-[11px] text-stone-400 block">Chất Theo Gu</span>
              </div>
            </div>

            {/* Pros & Context */}
            <div className="space-y-1.5 text-xs text-stone-300">
              <div className="font-semibold text-stone-200">Điểm mạnh bối cảnh:</div>
              <p className="bg-stone-900/60 p-2 rounded-lg border border-stone-800/60 text-stone-300 text-[11px]">
                Linh hoạt cho dạo phố, cà phê, sự kiện sáng tạo trẻ hoặc làm việc. Dễ di chuyển, dễ thích ứng với mọi cơ thể và phong cách hiện đại.
              </p>
            </div>
          </div>
        </div>

        {/* Conclusion recommendation */}
        <div className="bg-stone-950 p-4 rounded-xl border border-stone-800 text-xs text-stone-300 flex items-start gap-3">
          <span className="text-amber-400 text-lg">💡</span>
          <div>
            <strong className="text-stone-100">Lời khuyên từ Vstyle:</strong> Cả hai phương án đều tôn trọng cốt cách y phục dân tộc (vạt hữu nhậm, kết cấu ngũ thân). Bạn hoàn toàn có thể chọn Phương án A khi cần sự tôn nghiêm, và chọn Phương án B khi muốn thể hiện cá tính thời trang trẻ trung năng động.
          </div>
        </div>
      </div>
    </div>
  );
};
