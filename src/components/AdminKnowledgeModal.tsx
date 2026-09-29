import React, { useState } from 'react';
import { Garment, CultureRule, AdaptiveRule, Source } from '../types/fashion';
import { getGarments, getCultureRules, getAdaptiveAdjustments, getAllSources } from '../lib/dal';
import { Dialog } from './ui/Dialog';

interface AdminKnowledgeModalProps {
  onClose: () => void;
}

export const AdminKnowledgeModal: React.FC<AdminKnowledgeModalProps> = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState<'GARMENTS' | 'RULES' | 'ADAPTIVE' | 'SOURCES'>('GARMENTS');

  const garments = getGarments();
  const rules = getCultureRules();
  const adaptive = getAdaptiveAdjustments();
  const sources = getAllSources();

  return (
    <Dialog bare title="Cơ sở tri thức văn hóa" size="5xl" onClose={onClose}>
      <div className="bg-stone-900 border border-stone-700 rounded-t-3xl sm:rounded-3xl w-full p-5 sm:p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-stone-800 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-serif text-xl font-bold text-stone-100">
                Cơ sở tri thức văn hóa
              </h3>
            </div>
            <p className="text-xs text-stone-400 mt-0.5">
              Minh bạch hóa cơ sở dữ liệu văn hóa, quy tắc thẩm định và phân cấp APPROVED / DRAFT
            </p>
          </div>

          <button type="button" onClick={onClose} aria-label="Đóng" className="press grid size-10 place-items-center rounded-xl text-stone-400 hover:bg-stone-800 hover:text-stone-100">
            ✕
          </button>
        </div>

        {/* Tab Buttons */}
        <div className="flex items-center gap-2 border-b border-stone-800 pb-2 overflow-x-auto text-xs font-medium">
          <button
            onClick={() => setActiveTab('GARMENTS')}
            className={`px-3 py-1.5 rounded-lg transition ${
              activeTab === 'GARMENTS' ? 'bg-amber-600 text-stone-950 font-bold' : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            Y Phục ({garments.length})
          </button>
          <button
            onClick={() => setActiveTab('RULES')}
            className={`px-3 py-1.5 rounded-lg transition ${
              activeTab === 'RULES' ? 'bg-amber-600 text-stone-950 font-bold' : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            Bộ Quy Tắc Văn Hóa ({rules.length})
          </button>
          <button
            onClick={() => setActiveTab('ADAPTIVE')}
            className={`px-3 py-1.5 rounded-lg transition ${
              activeTab === 'ADAPTIVE' ? 'bg-amber-600 text-stone-950 font-bold' : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            Quy Chuẩn Thích Ứng ({adaptive.length})
          </button>
          <button
            onClick={() => setActiveTab('SOURCES')}
            className={`px-3 py-1.5 rounded-lg transition ${
              activeTab === 'SOURCES' ? 'bg-amber-600 text-stone-950 font-bold' : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            Thư Tịch & Nguồn Khảo Cứu ({sources.length})
          </button>
        </div>

        {/* Tab Content */}
        <div className="space-y-4 text-xs">
          {/* 1. Garments Management */}
          {activeTab === 'GARMENTS' && (
            <div className="space-y-3">
              {garments.map((g) => (
                <div key={g.id} className="bg-stone-950 p-4 rounded-xl border border-stone-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-stone-100 text-sm">{g.name} ({g.id})</span>
                    <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                      {g.status}
                    </span>
                  </div>
                  <p className="text-stone-400">{g.culturalMeaning}</p>
                  <div className="text-stone-500 text-[11px]">
                    Nguồn thẩm định: {g.sourceIds.join(', ')}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 2. Cultural Rules */}
          {activeTab === 'RULES' && (
            <div className="space-y-3">
              {rules.map((r) => (
                <div key={r.id} className="bg-stone-950 p-4 rounded-xl border border-stone-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-stone-100 text-sm">{r.name}</span>
                    <span className="px-2 py-0.5 rounded text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/30">
                      {r.severity} (Trọng số: {r.weight})
                    </span>
                  </div>
                  <p className="text-stone-300">{r.description}</p>
                  <div className="text-stone-500 text-[11px]">
                    Nguồn khảo cứu: {r.sourceId} • Đã thẩm duyệt: {r.verified ? '✓ ĐÚNG' : 'CHỜ DUYỆT'}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 3. Adaptive Standards */}
          {activeTab === 'ADAPTIVE' && (
            <div className="space-y-3">
              {adaptive.map((a) => (
                <div key={a.id} className="bg-stone-950 p-4 rounded-xl border border-stone-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-stone-100 text-sm">{a.needName} ({a.needCode})</span>
                    <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                      VALIDATED = {String(a.validated)}
                    </span>
                  </div>
                  <p className="text-stone-300"><strong>Kỹ thuật điều chỉnh:</strong> {a.adjustment}</p>
                  <p className="text-stone-400"><strong>Cơ sở chức năng:</strong> {a.reason}</p>
                </div>
              ))}
            </div>
          )}

          {/* 4. Sources */}
          {activeTab === 'SOURCES' && (
            <div className="space-y-3">
              {sources.map((s) => (
                <div key={s.id} className="bg-stone-950 p-4 rounded-xl border border-stone-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-stone-100 text-sm">{s.title}</span>
                    <span className="text-[10px] text-emerald-400">✓ Đã Thẩm Định</span>
                  </div>
                  <div className="text-stone-400">
                    Tác giả/NXB: {s.publisher} ({s.year}) • Thẩm định bởi: {s.reviewedBy}
                  </div>
                  {s.note && <div className="text-stone-500 italic">{s.note}</div>}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-stone-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs rounded-xl"
          >
            Đóng
          </button>
        </div>
      </div>
    </Dialog>
  );
};
