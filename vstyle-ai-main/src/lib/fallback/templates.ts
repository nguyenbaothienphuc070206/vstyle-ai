import { Garment, CultureCheckResult } from '../../types/fashion';

export function getFallbackExplanation(garment: Garment, cultureResult: CultureCheckResult, eventName: string) {
  return {
    headline: `${garment.name} - Thanh Âm Di Sản Tôn Vinh ${eventName}`,
    editorialReview: `Bộ trang phục mang đậm tinh hoa ${garment.era}, giao hòa nét đoan trang cổ truyền với cá tính thời đại. Thiết kế phom suông thanh thoát tôn lên vóc dáng mà vẫn đảm bảo sự tôn nghiêm và thoải mái.`,
    culturalHarmony: `Đạt điểm Chuẩn bản sắc ${cultureResult.score}/100. Bảo tồn vẹn nguyên kết cấu vạt hữu nhậm và triết lý y phục Việt Nam.`,
    styleRemixVerdict: `Bản phối vừa vặn cho nhịp sống hiện đại: trân trọng di sản nhưng không gò bó, thể hiện rõ gu thẩm mỹ tự tin của người mặc.`,
    adviceForWearing: [
      `Cài đủ các hạt cúc từ cổ xuống sườn để giữ phom dáng chuẩn mực.`,
      `Khi di chuyển hoặc ngồi, khẽ vuốt nhẹ vạt áo trước sau để vải buông tự nhiên phẳng phiu.`,
      `Kết hợp phụ kiện tinh giản để tôn lên vẻ đẹp nguyên bản của đường kim mũi chỉ.`,
    ],
  };
}

export function getFallbackCaptions(garmentName: string, eventName: string) {
  return {
    instagramCaption: `Mang di sản nghìn năm bước vào nhịp sống hôm nay ✨\nDiện ${garmentName} nhân dịp ${eventName}, cảm nhận trọn vẹn sự tự hào về văn hóa và nét đẹp trang phục truyền thống Việt Nam.\n\nPhối Việt phục theo gu riêng, đúng bản sắc, vừa với mọi cơ thể cùng #Vstyle #VietPhucRemix #AoDaiNguThan #DiSanVietNam`,
    shortPunchyHook: `Việt phục không chỉ là quá khứ, đó là phong cách sống của hôm nay 🇻🇳`,
    culturalHighlight: `Mỗi đường kim mũi chỉ đều chuyên chở triết lý sống hòa hợp, khiêm nhường và đoan trang của người Việt.`,
    hashtags: ['#Vstyle', '#VietPhucRemix', '#VietnameseTraditionalClothes', '#GenZHeritage', '#ThoiTrangThichUng'],
  };
}
