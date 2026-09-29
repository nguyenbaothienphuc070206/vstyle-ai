import React, { useState, useEffect } from 'react';
import { Outfit } from '../types/fashion';
import {
  getSavedOutfits,
  deleteOutfitFromLookbook,
  renameOutfitInLookbook,
} from '../lib/storage/lookbook';
import { getGarments } from '../lib/dal';
import { Dialog } from './ui/Dialog';

interface LookbookDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onLoadOutfit: (outfit: Outfit) => void;
  onShareOutfit: (outfit: Outfit) => void;
}

export const LookbookDrawer: React.FC<LookbookDrawerProps> = ({
  isOpen,
  onClose,
  onLoadOutfit,
  onShareOutfit,
}) => {
  const [outfits, setOutfits] = useState<Outfit[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState('');

  const garments = getGarments();

  useEffect(() => {
    if (isOpen) {
      setOutfits(getSavedOutfits());
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleDelete = (id: string) => {
    deleteOutfitFromLookbook(id);
    setOutfits(getSavedOutfits());
  };

  const handleStartRename = (outfit: Outfit) => {
    setEditingId(outfit.id);
    setNewTitle(outfit.title);
  };

  const handleSaveRename = (id: string) => {
    if (newTitle.trim()) {
      renameOutfitInLookbook(id, newTitle.trim());
      setOutfits(getSavedOutfits());
    }
    setEditingId(null);
  };

  return (
    <Dialog variant="drawer" title="Lookbook của bạn" description={`${outfits.length} bản phối đã lưu trên thiết bị này`} onClose={onClose}>
      <div className="flex flex-col">

        {/* Outfits List */}
        <div className="flex-1 overflow-y-auto py-4 space-y-3.5">
          {outfits.length === 0 ? (
            <div className="text-center py-12 text-stone-500 text-xs">
              Chưa có bản phối nào. Phối một bộ rồi bấm "Lưu" ở màn Kết quả để bắt đầu lookbook của bạn.
            </div>
          ) : (
            outfits.map((outfit) => {
              const garment = garments.find((g) => g.id === outfit.garmentId);

              return (
                <div
                  key={outfit.id}
                  className="bg-stone-950 border border-stone-800 rounded-2xl p-4 space-y-3 hover:border-stone-700 transition"
                >
                  <div className="flex items-start justify-between gap-2">
                    {editingId === outfit.id ? (
                      <div className="flex items-center gap-1.5 flex-1">
                        <input
            aria-label="Tên mới cho bản phối"
                          type="text"
                          value={newTitle}
                          onChange={(e) => setNewTitle(e.target.value)}
                          className="bg-stone-900 border border-amber-500 rounded px-2 py-1 text-xs text-stone-100 w-full focus:outline-none"
                          autoFocus
                        />
                        <button
                          onClick={() => handleSaveRename(outfit.id)}
                          className="px-2 py-1 bg-amber-600 text-stone-950 text-xs font-bold rounded"
                        >
                          Lưu
                        </button>
                      </div>
                    ) : (
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-serif font-bold text-sm text-stone-100">
                            {outfit.title}
                          </h4>
                          <button
                            onClick={() => handleStartRename(outfit)}
                            className="text-stone-500 hover:text-stone-300 text-[11px]"
                            aria-label="Đổi tên bản phối"
                            title="Đổi tên bản phối"
                          >
                            ✏️
                          </button>
                        </div>
                        <p className="text-xs text-stone-400 mt-0.5">{garment?.name}</p>
                      </div>
                    )}

                    {/* Scores badge */}
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 rounded">
                        Chuẩn: {outfit.chuanScore}
                      </span>
                      <span className="text-[10px] bg-amber-500/10 text-amber-300 border border-amber-500/30 px-1.5 py-0.5 rounded">
                        Chất: {outfit.chatScore}
                      </span>
                    </div>
                  </div>

                  {/* Color swatch & details */}
                  <div className="flex items-center justify-between text-xs text-stone-400 pt-1">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-3.5 h-3.5 rounded-full border border-stone-600"
                        style={{ backgroundColor: outfit.primaryColor }}
                        title="Màu tà áo"
                      />
                      <span className="text-[11px]">{outfit.styleVibe}</span>
                      {outfit.adaptiveNeedCode && (
                        <span className="text-[10px] bg-stone-800 text-amber-400 px-1.5 py-0.5 rounded">
                          Thích ứng
                        </span>
                      )}
                    </div>

                    <span className="text-[10px] text-stone-500">
                      {new Date(outfit.createdAt).toLocaleDateString('vi-VN')}
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-900">
                    <button
                      onClick={() => {
                        onShareOutfit(outfit);
                        onClose();
                      }}
                      className="px-2.5 py-1 bg-stone-900 hover:bg-stone-800 text-stone-300 text-xs rounded-lg transition"
                    >
                      Chia sẻ
                    </button>
                    <button
                      onClick={() => handleDelete(outfit.id)}
                      className="px-2.5 py-1 text-rose-400 hover:text-rose-300 hover:bg-rose-950/30 text-xs rounded-lg transition"
                    >
                      Xóa
                    </button>
                    <button
                      onClick={() => {
                        onLoadOutfit(outfit);
                        onClose();
                      }}
                      className="px-3.5 py-1 bg-amber-600 hover:bg-amber-500 text-stone-950 font-bold text-xs rounded-lg transition shadow"
                    >
                      Mở trên sàn diện
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </Dialog>
  );
};
