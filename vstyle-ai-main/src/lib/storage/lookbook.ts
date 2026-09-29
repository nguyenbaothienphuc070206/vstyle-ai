import { Outfit } from '../../types/fashion';

const LOOKBOOK_STORAGE_KEY = 'vstyle_saved_outfits_v1';

export const PRESET_OUTFITS: Outfit[] = [
  {
    id: "preset-le-tot-nghiep-ngu-than",
    title: "Cử Nhân Tinh Hoa - Ngũ Thân Tay Chẽn",
    garmentId: "garment-ngu-than-tay-chen",
    primaryColor: "#2B5C8F",
    pantColor: "#1C1C1E",
    accessoryIds: ["acc-khan-dong", "acc-the-bai", "acc-hai-sen"],
    characterId: "char-nam-nho-nha",
    hairStyle: "GON_GANG",
    footwear: "HAI_SEN",
    eventId: "LE_TOT_NGHIEP",
    weatherId: "WEATHER_HOT",
    styleVibe: "TOI_GIAN",
    chuanScore: 98,
    chatScore: 92,
    cultureStatus: "KEEP",
    retainedCharacteristics: [
      "Vạt Hữu Nhậm đè sang phải chuẩn mực",
      "Đủ 5 thân áo bảo toàn thân con che chở",
      "5 hạt cúc ngũ thường Nhân - Lễ - Nghĩa - Trí - Tín"
    ],
    sources: ["src-ngan-nam-ao-mu", "src-dai-viet-co-phong"],
    explanation: "Bộ ngũ thân tay chẽn màu xanh thiên thanh mang lại khí chất nho nhã, tri thức và trang trọng cho ngày nhận bằng cử nhân.",
    caption: "Cầm tấm bằng cử nhân trên tay trong tà áo ngũ thân, thấy tự hào biết bao về nguồn cội! #Vstyle #TotNghiepVietPhuc",
    createdAt: "2024-06-15T09:00:00.000Z",
    isFavorite: true
  },
  {
    "id": "preset-hy-su-nhat-binh",
    "title": "Hỷ Khúc Hoàng Cung - Áo Nhật Bình & Kiềng Bạc",
    "garmentId": "garment-ao-nhat-binh",
    "primaryColor": "#9B111E",
    "pantColor": "#F4F0E8",
    "accessoryIds": ["acc-man-nu", "acc-kieng-bac", "acc-quat-tram-huong", "acc-hai-sen"],
    "characterId": "char-nu-duyen-dang",
    "hairStyle": "VAN_MAN",
    "footwear": "HAI_SEN",
    "eventId": "DAM_CUOI",
    "weatherId": "WEATHER_PLEASANT",
    "styleVibe": "SANG_TRONG",
    "chuanScore": 100,
    "chatScore": 96,
    cultureStatus: "KEEP",
    retainedCharacteristics: [
      "Cổ hình chữ nhật viền thêu Loan Phượng cung đình",
      "Dải ngũ sắc ngũ hành ở tay áo",
      "Mặc cùng quần lụa trắng thụng và mấn nhung vấn truyền thống"
    ],
    sources: ["src-ngan-nam-ao-mu", "src-kham-dinh-dai-nam"],
    explanation: "Sắc đỏ chu sa cùng cổ chữ nhật quyền quý tôn vinh vẻ đẹp lộng lẫy và ý nghĩa cát tường cho ngày hỷ sự.",
    caption: "Khoác lên mình tà Nhật Bình rực rỡ, ngày vui thêm phần thiêng liêng và đáng nhớ. #VietPhucRemix #HySuViet",
    createdAt: "2024-06-16T14:30:00.000Z",
    isFavorite: true
  },
  {
    "id": "preset-thich-ung-xe-lan",
    "title": "Hòa Nhập Tự Tin - Ngũ Thân Remix Thích Ứng",
    "garmentId": "garment-ao-dai-ngu-than-remix",
    "primaryColor": "#3D5A45",
    "pantColor": "#EBE5D8",
    "accessoryIds": ["acc-sneaker-retro", "acc-tui-coi", "acc-quat-xep-giay-do"],
    "characterId": "char-hoa-nhap-xe-lan",
    "hairStyle": "BOI_CAO",
    "footwear": "SNEAKER_RETRO",
    "adaptiveNeedCode": "WHEELCHAIR_SEATED",
    "includeAdaptiveInShare": true,
    "eventId": "DAO_PHO",
    "weatherId": "WEATHER_HOT",
    "styleVibe": "REMIX_GEN_Z",
    "chuanScore": 95,
    chatScore: 94,
    cultureStatus: "KEEP",
    retainedCharacteristics: [
      "Vạt áo Hữu Nhậm cổ lập lĩnh chuẩn mực",
      "Hạ độ dài tà trước 15cm chống đùn vải khi ngồi xe lăn",
      "Cúc nam châm ẩn cạnh sườn hỗ trợ thao tác tự chủ",
      "Chất vải đũi tơ tằm dệt mát lành"
    ],
    sources: ["src-adaptive-design-lab", "src-dai-viet-co-phong"],
    explanation: "Thiết kế thích ứng được tính toán tỉ mỉ cho tư thế ngồi xe lăn, giúp người mặc luôn thoải mái, phẳng phiu và tự tin tỏa sáng giữa phố đông.",
    caption: "Việt phục dành cho tất cả mọi người. Tự tin bước ra thế giới theo cách của chính mình! #Vstyle #AdaptiveFashion #VietPhucRemix",
    createdAt: "2024-06-18T10:15:00.000Z",
    isFavorite: true
  }
];

export function getSavedOutfits(): Outfit[] {
  try {
    const raw = localStorage.getItem(LOOKBOOK_STORAGE_KEY);
    if (!raw) {
      // Seed initial presets
      localStorage.setItem(LOOKBOOK_STORAGE_KEY, JSON.stringify(PRESET_OUTFITS));
      return PRESET_OUTFITS;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : PRESET_OUTFITS;
  } catch (e) {
    console.warn('Could not read from localStorage, using presets:', e);
    return PRESET_OUTFITS;
  }
}

export function saveOutfitToLookbook(outfit: Outfit): boolean {
  try {
    const current = getSavedOutfits();
    const existingIndex = current.findIndex((o) => o.id === outfit.id);
    let updated: Outfit[];
    if (existingIndex >= 0) {
      updated = [...current];
      updated[existingIndex] = outfit;
    } else {
      updated = [outfit, ...current];
    }
    localStorage.setItem(LOOKBOOK_STORAGE_KEY, JSON.stringify(updated));
    return true;
  } catch (e) {
    console.error('Failed to save outfit to lookbook:', e);
    return false;
  }
}

export function deleteOutfitFromLookbook(id: string): boolean {
  try {
    const current = getSavedOutfits();
    const filtered = current.filter((o) => o.id !== id);
    localStorage.setItem(LOOKBOOK_STORAGE_KEY, JSON.stringify(filtered));
    return true;
  } catch (e) {
    console.error('Failed to delete outfit:', e);
    return false;
  }
}

export function renameOutfitInLookbook(id: string, newTitle: string): boolean {
  try {
    const current = getSavedOutfits();
    const updated = current.map((o) => (o.id === id ? { ...o, title: newTitle } : o));
    localStorage.setItem(LOOKBOOK_STORAGE_KEY, JSON.stringify(updated));
    return true;
  } catch (e) {
    console.error('Failed to rename outfit:', e);
    return false;
  }
}
