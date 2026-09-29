import React, { useState } from 'react';
import { Garment } from '../types/fashion';
import { getApprovedGarments, getGarments } from '../lib/dal';

interface GarmentDiscoveryProps {
  selectedGarmentId: string;
  onSelectGarment: (garment: Garment) => void;
  onViewDetails: (garment: Garment) => void;
  approvedOnly?: boolean;
}

export const GarmentDiscovery: React.FC<GarmentDiscoveryProps> = ({
  selectedGarmentId,
  onSelectGarment,
  onViewDetails,
  approvedOnly = false,
}) => {
  const [filterPeriod, setFilterPeriod] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');

  const garments = approvedOnly ? getApprovedGarments() : getGarments();
  const verifiedGarmentCount = garments.filter((garment) => garment.status === 'APPROVED' && garment.verified).length;

  const filteredGarments = garments.filter((g) => {
    const matchesPeriod = filterPeriod === 'ALL' || g.period === filterPeriod;
    const matchesSearch =
      g.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      g.vietnameseTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (g.culturalMeaning || g.description || '').toLowerCase().includes(searchTerm.toLowerCase());
    return matchesPeriod && matchesSearch;
  });

  return (
    <div className="bg-stone-900 border border-stone-800 rounded-2xl p-5 shadow-lg space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-800 pb-3">
        <div>
          <h3 className="font-serif text-lg font-bold text-stone-100 flex items-center gap-2">
            <span>Khám Phá Y Phục Truyền Thống</span>
            <span className="text-[11px] font-normal px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              {approvedOnly ? 'Chỉ dữ liệu đã duyệt' : `${verifiedGarmentCount} y phục đã xác thực`}
            </span>
          </h3>
          <p className="text-xs text-stone-400 mt-0.5">
            Dữ liệu y phục chuẩn xác theo điển chế triều đình và nghiên cứu phục dựng uy tín
          </p>
        </div>

        {/* Search input */}
        <div className="relative">
          <input
            aria-label="Tìm y phục"
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Tìm tên áo, hoa văn..."
            className="w-full sm:w-48 bg-stone-950 border border-stone-700 rounded-xl px-3 py-1.5 text-xs text-stone-200 placeholder-stone-500 focus:outline-none focus:border-amber-500"
          />
        </div>
      </div>

      {/* Period Filter Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
        {[
          { id: 'ALL', label: 'Tất cả triều đại' },
          { id: 'NGUYEN', label: 'Triều Nguyễn (Ngũ Thân, Tấc, Nhật Bình)' },
          { id: 'LE_TRAN_LY', label: 'Thời Lê - Trần - Lý (Giao Lĩnh, Đối Khâm)' },
          { id: 'DUONG_DAI', label: 'Đương Đại (Việt phục Remix)' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setFilterPeriod(tab.id)}
            className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition font-medium ${
              filterPeriod === tab.id
                ? 'bg-amber-600 text-stone-950 font-bold'
                : 'bg-stone-950 text-stone-400 hover:text-stone-200 border border-stone-800'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Garments Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {filteredGarments.map((g) => {
          const isSelected = g.id === selectedGarmentId;
          return (
            <div
              key={g.id}
              className={`rounded-2xl border p-4 flex flex-col justify-between transition-all ${
                isSelected
                  ? 'bg-amber-950/30 border-amber-500 ring-2 ring-amber-500/50 shadow-xl'
                  : 'bg-stone-950/70 border-stone-800 hover:border-stone-700'
              }`}
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between">
                  <span className="text-[10px] text-amber-400 uppercase font-mono tracking-wider font-semibold">
                    {g.era}
                  </span>
                  <div className="flex items-center gap-1.5">
                    {g.status === 'APPROVED' && g.verified ? (
                      <span className="text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 rounded font-medium">
                        ✓ Đã Thẩm Định
                      </span>
                    ) : g.status === 'DRAFT' ? (
                      <span className="text-[9px] bg-amber-500/10 text-amber-400 border border-amber-500/30 px-1.5 py-0.5 rounded font-medium">
                        Bản thảo
                      </span>
                    ) : (
                      <span className="text-[9px] bg-stone-800 text-stone-400 border border-stone-700 px-1.5 py-0.5 rounded font-medium">
                        Chưa xác thực
                      </span>
                    )}
                    <span className="text-[10px] bg-stone-800 text-stone-300 px-2 py-0.5 rounded">
                      {g.formalityLevel}
                    </span>
                  </div>
                </div>

                <div
                  role="img"
                  aria-label={`${g.name}, màu ${g.baseColors[0]?.name ?? 'chưa có màu'}`}
                  className="relative h-24 overflow-hidden rounded-lg border border-stone-800 bg-[radial-gradient(ellipse_at_50%_20%,rgba(245,158,11,0.12),transparent_70%),linear-gradient(145deg,#292524,#0c0a09)]"
                >
                  <div className="absolute bottom-0 left-1/2 h-[82%] w-20 -translate-x-1/2 rounded-t-full bg-stone-800/70" />
                  <div
                    className="absolute bottom-2 left-1/2 h-[74%] w-10 -translate-x-1/2"
                    style={{
                      backgroundColor: g.baseColors[0]?.hex ?? '#57534e',
                      clipPath: 'polygon(28% 0,72% 0,100% 18%,86% 100%,14% 100%,0 18%)',
                    }}
                  />
                  <span className="absolute bottom-2 right-2 rounded bg-black/50 px-2 py-1 text-[9px] text-stone-300">{g.baseColors[0]?.name}</span>
                </div>

                <div>
                  <h4 className="font-serif font-bold text-base text-stone-100">{g.name}</h4>
                  <p className="text-xs text-stone-400 line-clamp-2 mt-1 leading-relaxed">
                    {g.description}
                  </p>
                </div>

                <div className="flex flex-wrap gap-1.5 text-[10px] text-stone-400">
                  <span className="rounded bg-stone-900 px-2 py-1">{g.region.replaceAll('_', ' ')}</span>
                  {g.occasions.slice(0, 2).map((occasion) => (
                    <span key={occasion} className="rounded bg-stone-900 px-2 py-1">{occasion.replace('EVENT_', '').replaceAll('_', ' ')}</span>
                  ))}
                </div>

                {/* Base color dots */}
                <div className="flex items-center gap-1.5 pt-1">
                  <span className="text-[10px] text-stone-500">Màu sắc:</span>
                  <div className="flex items-center gap-1">
                    {g.baseColors.slice(0, 5).map((c) => (
                      <span
                        key={c.hex}
                        className="w-3 h-3 rounded-full border border-stone-700"
                        style={{ backgroundColor: c.hex }}
                        title={c.name}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 mt-4 pt-3 border-t border-stone-800">
                <button
                  type="button"
                  onClick={() => onViewDetails(g)}
                  className="flex-1 px-2.5 py-1.5 bg-stone-900 hover:bg-stone-800 text-stone-300 hover:text-white rounded-lg text-xs font-medium border border-stone-700/60 transition"
                >
                  Xem lai lịch & quy chuẩn
                </button>
                <button
                  type="button"
                  onClick={() => onSelectGarment(g)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                    isSelected
                      ? 'bg-amber-500 text-stone-950'
                      : 'bg-stone-800 hover:bg-amber-600 hover:text-stone-950 text-stone-200'
                  }`}
                >
                  {isSelected ? 'Đang chọn ✓' : 'Phối đồ'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
