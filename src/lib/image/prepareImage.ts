import type { Base64Image } from '../../types/gemini';

export interface PreparedImage {
  image: Base64Image;
  previewUrl: string;
  width: number;
  height: number;
}

const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
export const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;

export class ImagePrepareError extends Error {}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new ImagePrepareError('Không đọc được ảnh này. Hãy thử ảnh JPG hoặc PNG khác.'));
    image.src = url;
  });
}

/**
 * Downscales a user photo in the browser (longest side ≤ maxSide) and re-encodes it as JPEG.
 * Keeps uploads small, strips EXIF (incl. GPS) because the pixels are redrawn on a canvas.
 */
export async function prepareImageForGemini(file: File, maxSide = 1024): Promise<PreparedImage> {
  if (!ACCEPTED.includes(file.type) && !/\.(jpe?g|png|webp|heic|heif)$/i.test(file.name)) {
    throw new ImagePrepareError('Chỉ hỗ trợ ảnh JPG, PNG, WEBP hoặc HEIC.');
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new ImagePrepareError('Ảnh lớn hơn 12 MB. Hãy chọn ảnh nhỏ hơn.');
  }

  const sourceUrl = URL.createObjectURL(file);
  try {
    const image = await loadImage(sourceUrl);
    const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new ImagePrepareError('Trình duyệt không hỗ trợ xử lý ảnh.');
    context.drawImage(image, 0, 0, width, height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.86);
    const data = dataUrl.slice(dataUrl.indexOf(',') + 1);
    return { image: { mimeType: 'image/jpeg', data }, previewUrl: dataUrl, width, height };
  } finally {
    URL.revokeObjectURL(sourceUrl);
  }
}
