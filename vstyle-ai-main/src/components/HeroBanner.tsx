import React from 'react';

interface HeroBannerProps {
  onQuickStart: () => void;
  onExploreGarments: () => void;
}

export const HeroBanner: React.FC<HeroBannerProps> = ({ onQuickStart, onExploreGarments }) => {
  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-b from-stone-900 via-stone-900/90 to-stone-950 border border-stone-800 p-6 sm:p-10 shadow-2xl mb-8">
      {/* Decorative background glow */}
      <div className="absolute top-0 right-0 -mt-10 -mr-10 w-80 h-80 bg-amber-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 -mb-10 w-64 h-64 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 max-w-3xl space-y-4">
        {/* Challenge pill */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-semibold">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
          Audition Challenge: Việt phục Remix
        </div>

        {/* Main Headline */}
        <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-black text-stone-100 tracking-tight leading-tight">
          Phối Việt phục theo gu của bạn,{' '}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500">
            đúng bản sắc, vừa với mọi cơ thể
          </span>
        </h1>

        {/* Subtitle */}
        <p className="text-sm sm:text-base text-stone-300 leading-relaxed max-w-2xl">
          Trợ lý thời trang ứng dụng trí tuệ nhân tạo và công cụ thẩm định văn hóa chuẩn mực. Giúp thế hệ trẻ tự tin diện Áo Ngũ Thân, Áo Tấc, Áo Nhật Bình trong lễ tốt nghiệp, hỷ sự và đời sống thường nhật — tích hợp công nghệ may đo thích ứng cho tất cả mọi người.
        </p>

        {/* Key Features Badges */}
        <div className="flex flex-wrap gap-2.5 pt-2 text-xs">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-stone-950/80 border border-stone-800 text-stone-300">
            <span className="text-emerald-400 font-bold">🛡️</span>
            <span>Bộ quy tắc văn hóa độc lập</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-stone-950/80 border border-stone-800 text-stone-300">
            <span className="text-amber-400 font-bold">♿</span>
            <span>Thời trang thích ứng (Adaptive Fashion)</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-stone-950/80 border border-stone-800 text-stone-300">
            <span className="text-violet-400 font-bold">✨</span>
            <span>Chấm điểm Chuẩn & Chất thời gian thực</span>
          </div>
        </div>

        {/* CTAs */}
        <div className="flex items-center gap-3 pt-3">
          <button
            onClick={onQuickStart}
            className="px-6 py-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-stone-950 font-bold text-sm shadow-xl transition transform hover:-translate-y-0.5"
          >
            Bắt Đầu Phối Đồ Ngay →
          </button>
          <button
            onClick={onExploreGarments}
            className="px-5 py-3 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 font-medium text-sm border border-stone-700 transition"
          >
            Tra Cứu Y Phục
          </button>
        </div>
      </div>
    </div>
  );
};
