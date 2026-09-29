import React, { useRef, useState } from 'react';
import { Garment, Accessory, CharacterItem } from '../types/fashion';
import { FunctionalNeedCode } from '../types/domain';
import { createMockupScene, VisualAssetReference } from '../lib/visualization/assetRegistry';

interface OutfitMockupCanvasProps {
  garment: Garment;
  primaryColor: string;
  pantColor: string;
  accessories: Accessory[];
  character: CharacterItem;
  adaptiveNeedCode?: string;
  adaptiveNeedCodes?: FunctionalNeedCode[];
  styleId?: string;
  onColorChange?: (colorHex: string) => void;
  backgroundTheme?: 'MINIMAL_STUDIO' | 'HERITAGE_PALACE' | 'GARDEN_SPRING';
  /** Hides the toolbar (used in compare cards). */
  compact?: boolean;
}

function renderAccessoryFallback(variant: string, color: string | null): React.ReactNode {
  const fill = color ?? '#D6A75B';
  switch (variant) {
    case 'HEADWEAR_WRAP':
      return <path d="M174 72Q200 68 226 72V62Q200 58 174 62Z" fill={fill} stroke="#44403C" strokeWidth="1" />;
    case 'HEADWEAR_MANTLE':
      return <ellipse cx="200" cy="65" rx="30" ry="10" fill={fill} stroke="#F59E0B" strokeWidth="1.5" />;
    case 'HEADWEAR_SCARF':
      return <path d="M176 68Q200 55 224 68L215 86 200 78 185 86Z" fill={fill} stroke="#A8A29E" strokeWidth="1" />;
    case 'HEADWEAR_HAT':
      return <g><ellipse cx="200" cy="65" rx="48" ry="7" fill={fill} /><path d="M178 64Q181 42 200 40Q219 42 222 64Z" fill={fill} stroke="#A8A29E" strokeWidth="1" /></g>;
    case 'HAIR_PIN':
      return <path d="M218 60L235 50M226 55l4-7" stroke={fill} strokeWidth="3" strokeLinecap="round" />;
    case 'NECKLACE':
      return <path d="M188 122Q200 138 212 122" stroke={fill} strokeWidth="3" fill="none" strokeLinecap="round" />;
    case 'PENDANT':
      return <g><path d="M200 124v8" stroke={fill} strokeWidth="1.5" /><path d="M195 132h10v19h-10z" rx="2" fill={fill} stroke="#F59E0B" strokeWidth="0.8" /><circle cx="200" cy="131" r="2" fill="#EF4444" /></g>;
    case 'SASH':
      return <g><path d="M163 238h74v10h-74z" fill={fill} /><path d="M220 248l3 48h8l-2-48" fill={fill} /></g>;
    case 'INNER_BODICE':
      return <path d="M187 115l13 25 13-25-4 24h-18z" fill={fill} stroke="#F5F5F4" strokeWidth="1" />;
    case 'FAN':
      return <g transform="translate(100, 240) rotate(-15)"><path d="M0 30L20 0A30 30 0 0 1 50 15L20 40Z" fill={fill} opacity="0.95" /><line x1="10" y1="35" x2="35" y2="8" stroke="#78350F" strokeWidth="1" /></g>;
    case 'BAG':
      return <g><path d="M265 260h42l-4 48h-34z" fill={fill} stroke="#A8A29E" strokeWidth="1.5" /><path d="M274 260q1-20 12-20t12 20" fill="none" stroke={fill} strokeWidth="4" /></g>;
    default:
      return <path d="M200 230l10 10-10 10-10-10z" fill={fill} opacity="0.9" />;
  }
}

function renderShoeFallback(variant: string, color: string | null): React.ReactNode {
  const fill = color ?? '#8B1E2B';
  if (variant === 'SHOES_SNEAKER') {
    return <g><rect x="156" y="445" width="38" height="12" rx="4" fill={fill} stroke="#CBD5E1" strokeWidth="0.8" /><rect x="206" y="445" width="38" height="12" rx="4" fill={fill} stroke="#CBD5E1" strokeWidth="0.8" /></g>;
  }
  if (variant === 'SHOES_WOODEN') {
    return <g><path d="M158 446q18-2 35 0l3 8h-40z" fill={fill} stroke="#A87954" strokeWidth="2" /><path d="M204 446q18-2 35 0l3 8h-40z" fill={fill} stroke="#A87954" strokeWidth="2" /></g>;
  }
  if (variant === 'SHOES_CEREMONIAL') {
    return <g><path d="M158 448q17 0 32-4 5-5 7 1l-39 5z" fill={fill} /><path d="M206 448q17 0 32-4 5-5 7 1l-39 5z" fill={fill} /></g>;
  }
  return <g><ellipse cx="176" cy="450" rx="18" ry="5" fill={fill} /><ellipse cx="224" cy="450" rx="18" ry="5" fill={fill} /></g>;
}

interface SvgAssetImageProps {
  asset: VisualAssetReference;
  opacity?: number;
}

const SvgAssetImage: React.FC<SvgAssetImageProps> = ({ asset, opacity = 1 }) => {
  const [failed, setFailed] = useState(false);
  if (!asset.source || failed) return null;

  return (
    <image
      href={asset.source}
      x="0"
      y="0"
      width="400"
      height="500"
      preserveAspectRatio="xMidYMid meet"
      opacity={opacity}
      onError={() => setFailed(true)}
      data-asset-id={asset.assetId}
    />
  );
};

export const OutfitMockupCanvas: React.FC<OutfitMockupCanvasProps> = ({
  garment,
  primaryColor,
  pantColor,
  accessories,
  character,
  adaptiveNeedCode,
  adaptiveNeedCodes,
  styleId,
  onColorChange,
  backgroundTheme = 'MINIMAL_STUDIO',
  compact = false,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);

  const selectedNeedCodes = adaptiveNeedCodes ??
    (adaptiveNeedCode && adaptiveNeedCode !== 'NONE' ? [adaptiveNeedCode as FunctionalNeedCode] : []);
  const scene = createMockupScene({
    garment,
    character,
    accessories,
    primaryColor,
    adaptiveNeedCodes: selectedNeedCodes,
    backgroundId: backgroundTheme,
    styleId,
  });
  const isWheelchair = scene.adaptive.isSeated || character.posture === 'WHEELCHAIR_SEATED';

  // Export SVG to PNG
  const handleDownload = () => {
    if (!svgRef.current) return;
    const svgData = new XMLSerializer().serializeToString(svgRef.current);
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const URL = window.URL || window.webkitURL || window;
    const blobURL = URL.createObjectURL(svgBlob);
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 800;
      canvas.height = 1000;
      const context = canvas.getContext('2d');
      if (context) {
        context.drawImage(image, 0, 0, 800, 1000);
        const png = canvas.toDataURL('image/png');
        const downloadLink = document.createElement('a');
        downloadLink.download = `Vstyle_${garment.name.replace(/\s+/g, '_')}.png`;
        downloadLink.href = png;
        downloadLink.click();
      }
    };
    image.src = blobURL;
  };

  return (
    <div className="relative flex flex-col items-center justify-center w-full bg-stone-900 rounded-2xl overflow-hidden border border-stone-800 shadow-2xl">
      {/* Canvas Top Bar */}
      {!compact && <div className="absolute top-3 left-3 right-3 z-10 flex items-center justify-between pointer-events-none">
        <div className="flex items-center gap-2 bg-stone-950/80 backdrop-blur-md px-3 py-1.5 rounded-full border border-stone-800 text-xs font-medium text-stone-300 pointer-events-auto">
          <span aria-hidden="true" className="w-2 h-2 rounded-full bg-amber-400"></span>
          Mockup vector
        </div>
        <div className="flex items-center gap-2 pointer-events-auto">
          <button
            type="button"
            onClick={handleDownload}
            className="press flex min-h-9 items-center gap-1.5 px-3 py-1.5 bg-stone-950/80 backdrop-blur-md border border-stone-700 hover:border-amber-400/60 text-stone-100 text-xs font-semibold rounded-lg"
            aria-label="Tải ảnh mockup (PNG)"
          >
            <svg aria-hidden="true" className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Tải ảnh Look
          </button>
        </div>
      </div>}

      {/* Main SVG Render Area */}
      <div className="w-full aspect-4/5 max-w-105 flex items-center justify-center p-2">
        <svg
          ref={svgRef}
          viewBox="0 0 400 500"
          className="w-full h-full drop-shadow-md select-none"
          role="img"
          aria-label={`Bản phối minh họa ${garment.name}, ${character.name}`}
          data-scene-layers={scene.layers.join(',')}
          data-style-id={scene.style.dataId}
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            {/* Background Gradients */}
            <linearGradient id="bg-minimal" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#242220" />
              <stop offset="50%" stopColor="#181615" />
              <stop offset="100%" stopColor="#0F0E0D" />
            </linearGradient>

            <linearGradient id="bg-heritage" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#2D1F1C" />
              <stop offset="100%" stopColor="#120E0D" />
            </linearGradient>

            <linearGradient id="bg-garden" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#25352D" />
              <stop offset="100%" stopColor="#101713" />
            </linearGradient>

            {/* Fabric Texture Shading */}
            <linearGradient id="fabric-shading" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#000000" stopOpacity="0.25" />
              <stop offset="35%" stopColor="#ffffff" stopOpacity="0.12" />
              <stop offset="70%" stopColor="#000000" stopOpacity="0.05" />
              <stop offset="100%" stopColor="#000000" stopOpacity="0.35" />
            </linearGradient>

            <linearGradient id="nhat-binh-stripes" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#2563EB" />
              <stop offset="20%" stopColor="#EAB308" />
              <stop offset="40%" stopColor="#F8FAFC" />
              <stop offset="60%" stopColor="#DC2626" />
              <stop offset="80%" stopColor="#18181B" />
              <stop offset="100%" stopColor="#2563EB" />
            </linearGradient>

            <radialGradient id="halo-glow" cx="50%" cy="30%" r="50%">
              <stop offset="0%" stopColor="#D97706" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#D97706" stopOpacity="0" />
            </radialGradient>
          </defs>

          <g
            id="layer-background"
            data-layer-id={scene.background.dataId}
            data-asset-id={scene.background.assetId}
            data-asset-source={scene.background.source ?? ''}
            data-fallback-key={scene.background.fallbackKey}
          >
            <rect
              width="400"
              height="500"
              rx="16"
              fill={backgroundTheme === 'HERITAGE_PALACE'
                ? 'url(#bg-heritage)'
                : backgroundTheme === 'GARDEN_SPRING' ? 'url(#bg-garden)' : 'url(#bg-minimal)'}
            />
              <SvgAssetImage asset={scene.background} />
            <circle cx="200" cy="180" r="160" fill="url(#halo-glow)" />
            {scene.style.dataId === 'REMIX_GEN_Z' || scene.style.dataId === 'CONTEMPORARY' ? (
              <g fill={scene.style.accent} opacity="0.2" aria-hidden="true">
                <circle cx="64" cy="150" r="18" />
                <circle cx="330" cy="210" r="12" />
                <path d="M35 300h42M320 120h38" stroke={scene.style.accent} strokeWidth="3" />
              </g>
            ) : (
              <path d="M85 485V220a115 115 0 0 1 230 0v265" fill="none" stroke={scene.style.accent} strokeWidth="1" opacity="0.25" />
            )}

            <path
              d="M 100 480 L 100 220 A 100 100 0 0 1 300 220 L 300 480"
              fill="none"
              stroke="#443E38"
              strokeWidth="1.5"
              strokeDasharray="4 4"
              opacity="0.5"
            />

            <ellipse cx="200" cy="460" rx="90" ry="14" fill="#050505" opacity="0.6" />
          </g>

          {/* Adaptive support is a separate data-backed layer. */}
          {(isWheelchair || selectedNeedCodes.length > 0) && (
            <g id="layer-adaptive" data-layer-id={scene.adaptive.dataId} data-need-codes={scene.adaptive.needCodes.join(',')}>
              {isWheelchair && <g id="wheelchair-frame">
              {/* Backrest & Seating Frame */}
              <rect x="140" y="240" width="120" height="150" rx="10" fill="#292524" stroke="#78716C" strokeWidth="3" />
              {/* Armrests */}
              <rect x="125" y="270" width="15" height="70" rx="4" fill="#44403C" />
              <rect x="260" y="270" width="15" height="70" rx="4" fill="#44403C" />
              {/* Wheels */}
              <circle cx="130" cy="380" r="45" fill="none" stroke="#D97706" strokeWidth="4" />
              <circle cx="130" cy="380" r="12" fill="#78716C" />
              <circle cx="270" cy="380" r="45" fill="none" stroke="#D97706" strokeWidth="4" />
              <circle cx="270" cy="380" r="12" fill="#78716C" />
              {/* Footrest */}
              <rect x="160" y="440" width="80" height="10" rx="3" fill="#57534E" />
              </g>}
              {selectedNeedCodes.length > 0 && (
                <g transform="translate(20, 440)">
                  <rect x="0" y="0" width="130" height="26" rx="13" fill="#0C0A09" fillOpacity="0.85" stroke={scene.style.accent} strokeWidth="1" />
                  <circle cx="13" cy="13" r="6" fill={scene.style.accent} />
                  <text x="26" y="17" fill="#FEF3C7" fontSize="10" fontWeight="600" fontFamily="sans-serif">May đo thích ứng</text>
                </g>
              )}
            </g>
          )}

          {/* 3. LAYER: CHARACTER BASE (Head, Neck, Hands, Posture) */}
          <g
            id="layer-character"
            data-layer-id={scene.character.dataId}
            data-asset-id={scene.character.assetId}
            data-asset-source={scene.character.source ?? ''}
            data-fallback-key={scene.character.fallbackKey}
            data-pose-id={scene.character.poseId}
            data-body-representation={character.bodyRepresentation}
          >
            <g id="character-body-vector" data-character-variant={scene.character.variant}>
              {scene.character.variant === 'CHARACTER_MASCULINE' ? (
                <path d="M157 132Q143 133 135 151L114 220Q109 239 124 245Q139 247 145 230L166 180H234L255 230Q261 247 276 245Q291 239 286 220L265 151Q257 133 243 132Z" fill={character.skinTone} />
              ) : scene.character.variant === 'CHARACTER_CURVY' ? (
                <path d="M158 132Q141 134 133 153L112 218Q105 239 122 248Q139 251 147 231L168 178H232L253 231Q261 251 278 248Q295 239 288 218L267 153Q259 134 242 132Z" fill={character.skinTone} />
              ) : (
                <path d="M160 132Q145 134 138 151L119 222Q114 240 129 245Q143 247 149 231L168 178H232L251 231Q257 247 271 245Q286 240 281 222L262 151Q255 134 240 132Z" fill={character.skinTone} />
              )}
              <path d="M124 238q-7 8-4 17 4 7 12 2l10-15zM276 238q7 8 4 17-4 7-12 2l-10-15z" fill={character.skinTone} />
            </g>
            {/* Neck */}
            <rect x="190" y="100" width="20" height="35" rx="5" fill={character.defaultSkinTone} />
            {/* Head */}
            <ellipse cx="200" cy="85" rx="26" ry="32" fill={character.defaultSkinTone} />
            {/* Facial subtle details */}
            <path d="M 194 85 Q 200 88 206 85" stroke="#9A3412" strokeWidth="1.2" fill="none" opacity="0.4" />
            <path d="M 192 78 Q 196 76 200 78" stroke="#78350F" strokeWidth="1" fill="none" opacity="0.5" />
            <path d="M 200 78 Q 204 76 208 78" stroke="#78350F" strokeWidth="1" fill="none" opacity="0.5" />
            <SvgAssetImage asset={scene.character} />

          </g>

          <g id="layer-hair" data-layer-id={scene.hair.dataId} data-character-id={scene.hair.characterId} data-fallback-key={scene.hair.fallbackKey}>
            {scene.character.variant === 'CHARACTER_MASCULINE' ? (
              <path d="M174 84c0-38 52-38 52 0l-7 13c-6-8-13-12-19-12s-13 4-19 12z" fill="#18181B" />
            ) : scene.character.variant === 'CHARACTER_UNISEX' ? (
              <path d="M174 84c0-39 52-39 52 0l-4 17-12-9-10 7-10-7-12 9z" fill="#18181B" />
            ) : (
              <path d="M174 85c0-40 52-40 52 0v39l-11 8-4-35c-7-7-18-7-25 0l-4 35-8-8z" fill="#18181B" />
            )}
          </g>

          {/* 4. LAYER: PANTS / BOTTOM (Quần thụng lụa hoặc chân váy) */}
          <g id="layer-garment-bottom" data-layer-id={`${garment.id}:bottom`} data-garment-id={garment.id}>
            {!isWheelchair ? (
              // Standing pants
              <path
                d="M 165 280 L 160 445 Q 180 448 196 445 L 198 320 L 202 320 L 204 445 Q 220 448 240 445 L 235 280 Z"
                fill={pantColor}
                stroke="#000"
                strokeWidth="0.5"
                opacity="0.95"
              />
            ) : (
              // Seated pants
              <path
                d="M 155 270 Q 150 350 160 410 L 240 410 Q 250 350 245 270 Z"
                fill={pantColor}
                stroke="#000"
                strokeWidth="0.5"
                opacity="0.95"
              />
            )}
          </g>

          {/* 5. LAYER: GARMENT BODY (Deterministic SVG Shapes) */}
          <g
            id="layer-garment"
            data-layer-id={scene.garment.dataId}
            data-asset-id={scene.garment.assetId}
            data-asset-source={scene.garment.source ?? ''}
            data-template-id={scene.garment.templateId}
            data-fallback-key={scene.garment.fallbackKey}
          >
            <g id="layer-garment-color" data-layer-id={scene.garmentColor.dataId} data-color={scene.garmentColor.value}>
            {/* A. Áo Ngũ Thân Tay Chẽn */}
            {garment.svgTemplate === 'NGU_THAN_TAY_CHEN' && (
              <g id="template-ngu-than-tay-chen">
                {/* Main Coat Body - Hữu Nhậm (Vạt đè sang phải) */}
                <path
                  d="M 155 125 L 130 145 L 140 270 L 150 405 Q 200 415 250 405 L 260 270 L 270 145 L 245 125 Z"
                  fill={primaryColor}
                />
                <path
                  d="M 155 125 L 130 145 L 140 270 L 150 405 Q 200 415 250 405 L 260 270 L 270 145 L 245 125 Z"
                  fill="url(#fabric-shading)"
                />

                {/* Internal Thân Con (Tiểu phẩm) accent line */}
                <path d="M 195 125 L 188 280 L 180 405" stroke="#FFFFFF" strokeWidth="0.8" opacity="0.25" strokeDasharray="3 3" />

                {/* Vạt đè bên phải (Hữu Nhậm flap) */}
                <path
                  d="M 200 120 L 212 155 Q 215 190 216 230 L 216 408"
                  stroke="#FFFFFF"
                  strokeWidth="1.5"
                  fill="none"
                  opacity="0.6"
                />

                {/* Tay chẽn gọn gàng */}
                <path d="M 145 135 L 115 240 L 130 250 L 155 170 Z" fill={primaryColor} />
                <path d="M 255 135 L 285 240 L 270 250 L 245 170 Z" fill={primaryColor} />

                {/* 5 Cúc Áo (Ngũ thường) */}
                <circle cx="202" cy="125" r="2.5" fill="#F59E0B" stroke="#78350F" strokeWidth="0.8" />
                <circle cx="206" cy="142" r="2.5" fill="#F59E0B" stroke="#78350F" strokeWidth="0.8" />
                <circle cx="211" cy="165" r="2.5" fill="#F59E0B" stroke="#78350F" strokeWidth="0.8" />
                <circle cx="215" cy="195" r="2.5" fill="#F59E0B" stroke="#78350F" strokeWidth="0.8" />
                <circle cx="216" cy="230" r="2.5" fill="#F59E0B" stroke="#78350F" strokeWidth="0.8" />

                {/* Cổ lập lĩnh ôm sát */}
                <path d="M 188 129 Q 200 132 212 129 L 213 118 Q 200 120 187 118 Z" fill={primaryColor} stroke="#E5E7EB" strokeWidth="0.8" />
              </g>
            )}

            {/* B. Áo Tấc (Áo thụng ngũ thân) */}
            {garment.svgTemplate === 'AO_TAC' && (
              <g id="template-ao-tac">
                {/* Thân áo dài trang nghiêm */}
                <path
                  d="M 150 125 L 110 160 L 130 300 L 140 435 Q 200 445 260 435 L 270 300 L 290 160 L 250 125 Z"
                  fill={primaryColor}
                />
                <path
                  d="M 150 125 L 110 160 L 130 300 L 140 435 Q 200 445 260 435 L 270 300 L 290 160 L 250 125 Z"
                  fill="url(#fabric-shading)"
                />

                {/* Ống tay thụng rộng xòe đặc trưng Áo Tấc */}
                <path
                  d="M 140 135 L 75 270 Q 100 310 140 280 L 155 170 Z"
                  fill={primaryColor}
                  stroke="#FFFFFF"
                  strokeWidth="0.8"
                  opacity="0.95"
                />
                <path
                  d="M 260 135 L 325 270 Q 300 310 260 280 L 245 170 Z"
                  fill={primaryColor}
                  stroke="#FFFFFF"
                  strokeWidth="0.8"
                  opacity="0.95"
                />

                {/* Viền nẹp tà 1 tấc */}
                <path d="M 140 435 Q 200 445 260 435" stroke="#F59E0B" strokeWidth="3" fill="none" opacity="0.8" />

                {/* Cổ lập lĩnh & Cúc ngũ thường */}
                <path d="M 188 129 Q 200 132 212 129 L 213 118 Q 200 120 187 118 Z" fill={primaryColor} stroke="#E5E7EB" strokeWidth="0.8" />
                <circle cx="202" cy="125" r="3" fill="#D97706" />
                <circle cx="207" cy="145" r="3" fill="#D97706" />
                <circle cx="212" cy="170" r="3" fill="#D97706" />
                <circle cx="216" cy="200" r="3" fill="#D97706" />
                <circle cx="217" cy="235" r="3" fill="#D97706" />
              </g>
            )}

            {/* C. Áo Nhật Bình */}
            {garment.svgTemplate === 'AO_NHAT_BINH' && (
              <g id="template-ao-nhat-binh">
                {/* Thân áo */}
                <path
                  d="M 150 125 L 120 160 L 135 300 L 145 425 Q 200 435 255 425 L 265 300 L 280 160 L 250 125 Z"
                  fill={primaryColor}
                />
                <path
                  d="M 150 125 L 120 160 L 135 300 L 145 425 Q 200 435 255 425 L 265 300 L 280 160 L 250 125 Z"
                  fill="url(#fabric-shading)"
                />

                {/* Cổ áo hình chữ nhật đặc trưng cung đình triều Nguyễn */}
                <rect x="175" y="119" width="50" height="91" rx="3" fill="#FBBF24" stroke="#B45309" strokeWidth="1.8" />
                <rect x="183" y="125" width="34" height="75" fill="#991B1B" opacity="0.9" />

                {/* Hai dải kết phi phong buông thõng */}
                <path d="M 188 210 L 188 320 L 194 320 L 194 210 Z" fill="#D97706" stroke="#92400E" strokeWidth="0.5" />
                <path d="M 206 210 L 206 320 L 212 320 L 212 210 Z" fill="#D97706" stroke="#92400E" strokeWidth="0.5" />

                {/* Cổ tay áo dải hoa văn ngũ sắc */}
                <rect x="105" y="240" width="25" height="18" fill="url(#nhat-binh-stripes)" rx="2" />
                <rect x="270" y="240" width="25" height="18" fill="url(#nhat-binh-stripes)" rx="2" />

                {/* Cúc ngọc ở giữa cổ */}
                <circle cx="200" cy="120" r="4" fill="#E0E7FF" stroke="#4338CA" strokeWidth="1" />
              </g>
            )}

            {/* D. Áo Giao Lĩnh */}
            {garment.svgTemplate === 'AO_GIAO_LINH' && (
              <g id="template-ao-giao-linh">
                <path
                  d="M 150 125 L 115 155 L 135 290 L 140 420 Q 200 430 260 420 L 265 290 L 285 155 L 250 125 Z"
                  fill={primaryColor}
                />
                <path
                  d="M 150 125 L 115 155 L 135 290 L 140 420 Q 200 430 260 420 L 265 290 L 285 155 L 250 125 Z"
                  fill="url(#fabric-shading)"
                />
                {/* Cổ chéo chữ V giao nhau - Hữu nhậm (trái đè sang phải) */}
                <path d="M 180 115 L 225 185" stroke="#FFFFFF" strokeWidth="4" fill="none" opacity="0.8" />
                <path d="M 220 115 L 175 185" stroke="#E5E7EB" strokeWidth="3" fill="none" opacity="0.6" />
                {/* Dải thắt lưng vải bay bổng */}
                <rect x="165" y="225" width="70" height="14" rx="2" fill="#78350F" />
                <path d="M 205 239 L 200 340 L 210 340 L 215 239 Z" fill="#78350F" opacity="0.9" />
              </g>
            )}

            {/* E. Áo Đối Khâm */}
            {garment.svgTemplate === 'AO_DOI_KHAM' && (
              <g id="template-ao-doi-kham">
                {/* Lớp áo lót trong */}
                <path d="M 175 125 L 175 320 L 225 320 L 225 125 Z" fill="#F5F5F4" />
                {/* Hai vạt mở song song buông thẳng */}
                <path d="M 145 125 L 125 155 L 135 410 L 175 410 L 175 125 Z" fill={primaryColor} />
                <path d="M 255 125 L 275 155 L 265 410 L 225 410 L 225 125 Z" fill={primaryColor} />
                {/* Nẹp viền thêu đối xứng */}
                <rect x="168" y="125" width="8" height="285" fill="#FBBF24" opacity="0.8" />
                <rect x="224" y="125" width="8" height="285" fill="#FBBF24" opacity="0.8" />
              </g>
            )}

            {/* G. Áo Tứ Thân: hai vạt trước buông, thắt nút trước bụng, mặc cùng váy và yếm */}
            {garment.svgTemplate === 'AO_TU_THAN' && (
              <g id="template-ao-tu-than">
                <path d="M 168 250 L 152 446 L 248 446 L 232 250 Z" fill={pantColor} opacity="0.96" />
                <path d="M 155 125 L 128 150 L 140 300 L 158 430 L 196 430 L 198 244 L 186 125 Z" fill={primaryColor} />
                <path d="M 245 125 L 272 150 L 260 300 L 242 430 L 204 430 L 202 244 L 214 125 Z" fill={primaryColor} />
                <path d="M 155 125 L 128 150 L 140 300 L 158 430 L 196 430 L 198 244 L 186 125 Z" fill="url(#fabric-shading)" />
                <path d="M 245 125 L 272 150 L 260 300 L 242 430 L 204 430 L 202 244 L 214 125 Z" fill="url(#fabric-shading)" />
                <path d="M 145 135 L 115 240 L 130 250 L 155 170 Z" fill={primaryColor} />
                <path d="M 255 135 L 285 240 L 270 250 L 245 170 Z" fill={primaryColor} />
                {/* Nút thắt hai vạt trước */}
                <ellipse cx="200" cy="246" rx="9" ry="6" fill={primaryColor} stroke="#FFFFFF" strokeOpacity="0.45" strokeWidth="1" />
                <path d="M 196 250 L 190 300 L 197 300 Z M 204 250 L 210 300 L 203 300 Z" fill={primaryColor} stroke="#000" strokeOpacity="0.25" strokeWidth="0.6" />
              </g>
            )}

            {/* H. Áo Dài truyền thống: thân ôm, xẻ tà cao, tay dài, cúc chéo sang nách phải */}
            {garment.svgTemplate === 'AO_DAI' && (
              <g id="template-ao-dai">
                <path d="M 166 238 L 234 238 L 244 446 Q 200 452 156 446 Z" fill={primaryColor} />
                <path d="M 166 238 L 234 238 L 244 446 Q 200 452 156 446 Z" fill="url(#fabric-shading)" />
                <path d="M 160 125 L 140 145 L 160 242 L 240 242 L 260 145 L 240 125 Z" fill={primaryColor} />
                <path d="M 160 125 L 140 145 L 160 242 L 240 242 L 260 145 L 240 125 Z" fill="url(#fabric-shading)" />
                <path d="M 145 135 L 116 250 L 128 256 L 158 160 Z" fill={primaryColor} />
                <path d="M 255 135 L 284 250 L 272 256 L 242 160 Z" fill={primaryColor} />
                <path d="M 200 121 Q 222 132 246 152" stroke="#FFFFFF" strokeWidth="1.2" fill="none" opacity="0.55" />
                <circle cx="208" cy="126" r="2.2" fill="#F5E7C4" />
                <circle cx="219" cy="133" r="2.2" fill="#F5E7C4" />
                <circle cx="231" cy="141" r="2.2" fill="#F5E7C4" />
                <circle cx="242" cy="149" r="2.2" fill="#F5E7C4" />
                <path d="M 188 129 Q 200 132 212 129 L 213 118 Q 200 120 187 118 Z" fill={primaryColor} stroke="#E5E7EB" strokeWidth="0.8" />
              </g>
            )}

            {/* F. Áo Ngũ Thân Tân Thời (Remix) */}
            {garment.svgTemplate === 'NGU_THAN_REMIX' && (
              <g id="template-ngu-than-remix">
                {/* Tà lửng trẻ trung ngang gối */}
                <path
                  d="M 155 125 L 130 145 L 140 260 L 152 360 Q 200 370 248 360 L 260 260 L 270 145 L 245 125 Z"
                  fill={primaryColor}
                />
                <path
                  d="M 155 125 L 130 145 L 140 260 L 152 360 Q 200 370 248 360 L 260 260 L 270 145 L 245 125 Z"
                  fill="url(#fabric-shading)"
                />
                {/* Nẹp vạt hữu nhậm phong cách tối giản */}
                <path d="M 200 120 L 214 150 L 216 360" stroke="#FFFFFF" strokeWidth="1.2" fill="none" opacity="0.7" />
                {/* Nẹp cúc nam châm ẩn phẳng phiu */}
                <circle cx="203" cy="126" r="2.5" fill="#E2E8F0" />
                <circle cx="208" cy="148" r="2.5" fill="#E2E8F0" />
                <circle cx="214" cy="175" r="2.5" fill="#E2E8F0" />
              </g>
            )}
            {!scene.garment.hasVectorTemplate && (
              <g id="template-generic-vector">
                <path d="M155 125L125 150 140 290 150 420Q200 430 250 420L260 290 275 150 245 125Z" fill={primaryColor} />
                <path d="M155 125L125 150 140 290 150 420Q200 430 250 420L260 290 275 150 245 125Z" fill="url(#fabric-shading)" />
                <path d="M200 120L214 155V420" stroke="#FFFFFF" strokeWidth="1.5" opacity="0.6" />
              </g>
            )}
            <SvgAssetImage asset={scene.garment} opacity={0.35} />
            </g>
          </g>

          <g id="layer-accessories" data-layer-id={scene.accessories.map((item) => item.dataId).join(',')}>
            {scene.accessories.map((item) => (
              <g
                key={item.dataId}
                data-layer-id={item.dataId}
                data-asset-id={item.assetId}
                data-asset-source={item.source ?? ''}
                data-fallback-key={item.fallbackKey}
              >
                {renderAccessoryFallback(item.variant, item.color)}
                <SvgAssetImage asset={item} opacity={0.9} />
              </g>
            ))}
          </g>

          <g id="layer-shoes" data-layer-id={scene.shoes.map((item) => item.dataId).join(',')}>
            {scene.shoes.map((item) => (
              <g
                key={item.dataId}
                data-layer-id={item.dataId}
                data-asset-id={item.assetId}
                data-asset-source={item.source ?? ''}
                data-fallback-key={item.fallbackKey}
                transform={isWheelchair ? 'translate(0,-28)' : undefined}
              >
                {renderShoeFallback(item.variant, item.color)}
                <SvgAssetImage asset={item} opacity={0.9} />
              </g>
            ))}
          </g>
        </svg>
      </div>

      {/* Interactive Quick Color Swatches */}
      {onColorChange && garment.baseColors.length > 0 && (
        <div className="w-full px-4 py-3 bg-stone-950/90 border-t border-stone-800 flex items-center justify-between gap-2 overflow-x-auto">
          <span className="text-xs text-stone-400 font-medium whitespace-nowrap">Màu sắc y phục:</span>
          <div className="flex items-center gap-2">
            {garment.baseColors.map((color) => {
              const isSelected = color.hex.toLowerCase() === primaryColor.toLowerCase();
              return (
                <button
                  key={color.hex}
                  type="button"
                  onClick={() => onColorChange(color.hex)}
                  title={color.name}
                  aria-label={`Màu ${color.name}`}
                  aria-pressed={isSelected}
                  className={`press relative size-9 rounded-full border ${
                    isSelected ? 'ring-2 ring-amber-300 ring-offset-2 ring-offset-stone-950 border-white/60' : 'border-stone-700 hover:scale-105'
                  }`}
                  style={{ backgroundColor: color.hex }}
                >
                  {isSelected && (
                    <span className="absolute inset-0 flex items-center justify-center text-[10px] text-white font-bold drop-shadow">
                      ✓
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
