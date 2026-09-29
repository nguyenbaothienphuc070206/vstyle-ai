import React, { useState } from 'react';
import { getEvents, getWeatherContexts } from '../lib/dal';

const FORMALITY_LABELS: Record<string, string> = {
  CASUAL_SMART: 'Thường ngày',
  SEMI_FORMAL: 'Bán trang trọng',
  FORMAL: 'Trang trọng',
  HIGH_FORMAL: 'Đại lễ',
};

interface ContextSelectorProps {
  selectedEventId: string;
  selectedWeatherId: string;
  selectedLocation?: string;
  selectedDate?: string;
  onEventChange: (id: string) => void;
  onWeatherChange: (id: string) => void;
  onLocationChange?: (location: string) => void;
  onDateChange?: (date: string) => void;
  onNaturalLanguageSubmit: (text: string) => void;
  isAiParsing?: boolean;
}

export const ContextSelector: React.FC<ContextSelectorProps> = ({
  selectedEventId,
  selectedWeatherId,
  selectedLocation = '',
  selectedDate = '',
  onEventChange,
  onWeatherChange,
  onLocationChange,
  onDateChange,
  onNaturalLanguageSubmit,
  isAiParsing = false,
}) => {
  const [nlInput, setNlInput] = useState('');
  const eventsList = getEvents();
  const weatherList = getWeatherContexts();

  const handleNlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nlInput.trim()) return;
    onNaturalLanguageSubmit(nlInput.trim());
  };

  const samplePrompts = [
    'Tôi muốn một bộ Việt phục trẻ trung để đi lễ tốt nghiệp, trời nóng, thích phong cách tối giản.',
    'Phối đồ dự đám cưới bạn thân, cần sang trọng truyền thống và có phụ kiện kiềng bạc.',
    'Đi dạo phố cổ Hà Nội cuối tuần, thời tiết dịu mát, phong cách Remix Gen Z năng động.',
  ];

  return (
    <div className="bg-stone-900 border border-stone-800 rounded-2xl p-5 shadow-lg space-y-6">
      {/* 1. Natural Language AI Styling Input Box */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-semibold text-stone-200 flex items-center gap-1.5">
            Điền nhanh bằng một câu
          </label>
          <span className="text-[11px] text-stone-500">Gemini điền các ô bên dưới</span>
        </div>

        <form onSubmit={handleNlSubmit} className="relative">
          <input
            aria-label="Mô tả nhu cầu bằng một câu"
            type="text"
            value={nlInput}
            onChange={(e) => setNlInput(e.target.value)}
            placeholder="Tôi muốn mặc Việt phục đi lễ tốt nghiệp, trời nóng, thích phong cách tối giản."
            disabled={isAiParsing}
            className="w-full bg-stone-950 border border-stone-700 focus:border-amber-500 rounded-xl px-4 py-3 pr-24 text-sm text-stone-100 placeholder-stone-500 focus:outline-none focus:ring-1 focus:ring-amber-500 transition"
          />
          <button
            type="submit"
            disabled={isAiParsing || !nlInput.trim()}
            className="absolute right-1.5 top-1.5 bottom-1.5 px-4 bg-linear-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 disabled:opacity-40 text-stone-950 font-bold text-xs rounded-lg transition flex items-center gap-1 shadow"
          >
            {isAiParsing ? (
              <>
                <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                </svg>
                Đang xử lý
              </>
            ) : (
              'Điền giúp'
            )}
          </button>
        </form>

        {/* Quick sample prompt buttons */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-0.5">
          <span className="text-[10px] text-stone-500 whitespace-nowrap">Gợi ý câu:</span>
          {samplePrompts.map((p, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => {
                setNlInput(p);
                onNaturalLanguageSubmit(p);
              }}
              className="text-[11px] bg-stone-950 hover:bg-stone-800 text-stone-400 hover:text-stone-200 border border-stone-800 px-2.5 py-1 rounded-full whitespace-nowrap transition"
            >
              {p.slice(0, 36)}...
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="space-y-1.5 text-xs text-stone-300">
          <span className="block font-semibold">Địa điểm</span>
          <input
            type="text"
            value={selectedLocation}
            onChange={(event) => onLocationChange?.(event.target.value)}
            placeholder="Thành phố hoặc địa điểm"
            className="w-full bg-stone-950 border border-stone-700 rounded-lg px-3 py-2.5 text-sm text-stone-100 placeholder:text-stone-600 focus:outline-none focus:border-amber-500"
          />
        </label>
        <label className="space-y-1.5 text-xs text-stone-300">
          <span className="block font-semibold">Ngày diễn ra</span>
          <input
            type="date"
            value={selectedDate}
            onChange={(event) => onDateChange?.(event.target.value)}
            className="w-full bg-stone-950 border border-stone-700 rounded-lg px-3 py-2.5 text-sm text-stone-100 focus:outline-none focus:border-amber-500"
          />
        </label>
      </div>

      <div className="relative flex items-center justify-center">
        <div className="border-t border-stone-800 w-full"></div>
        <span className="bg-stone-900 px-3 text-xs text-stone-500 font-medium absolute">
          Hoặc chọn thông số thủ công
        </span>
      </div>

      {/* 2. Occasion / Event Selection */}
      <div className="space-y-2.5">
        <label className="text-sm font-semibold text-stone-200 block">
          Dịp xuất hiện
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {eventsList.map((evt) => {
            const isSelected = evt.id === selectedEventId;
            return (
              <button
                key={evt.id}
                type="button"
                onClick={() => onEventChange(evt.id)}
                aria-pressed={isSelected}
                className={`press min-h-20 p-3 rounded-xl border text-left transition flex flex-col justify-between ${
                  isSelected
                    ? 'bg-amber-950/40 border-amber-500 text-amber-200 ring-1 ring-amber-500'
                    : 'bg-stone-950 border-stone-800 text-stone-300 hover:border-stone-700'
                }`}
              >
                <div>
                  <div className="font-semibold text-xs text-stone-100">{evt.name}</div>
                  <div className="text-[10px] text-stone-400 line-clamp-1 mt-0.5">{evt.description}</div>
                </div>
                <div className="text-[11px] text-amber-300/80 mt-2">
                  {FORMALITY_LABELS[evt.formality] ?? evt.formality}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Weather & Context */}
      <div className="space-y-2.5">
        <label className="text-sm font-semibold text-stone-200 block">
          Thời tiết · chọn thủ công
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {weatherList.map((w) => {
            const isSelected = w.id === selectedWeatherId;
            return (
              <button
                key={w.id}
                type="button"
                onClick={() => onWeatherChange(w.id)}
                aria-pressed={isSelected}
                className={`press min-h-14 p-2.5 rounded-xl border text-left transition ${
                  isSelected
                    ? 'bg-amber-950/40 border-amber-500 text-amber-200 ring-1 ring-amber-500'
                    : 'bg-stone-950 border-stone-800 text-stone-300 hover:border-stone-700'
                }`}
              >
                <div className="font-medium text-xs text-stone-200 truncate">{w.name.split('(')[0]}</div>
                <div className="text-[10px] text-stone-500 truncate mt-0.5">{w.temperatureRange ?? w.name.match(/\(([^)]+)\)/)?.[1] ?? ''}</div>
              </button>
            );
          })}
        </div>
      </div>

      <p className="text-[11px] text-stone-500 border-t border-stone-800 pt-3">
        Gợi ý chất liệu theo thời tiết lấy từ dữ liệu Vstyle; bạn chọn thời tiết dự kiến của ngày diễn ra.
      </p>
    </div>
  );
};
