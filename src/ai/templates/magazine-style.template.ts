import sharp from 'sharp';

export interface MagazineStyleOptions {
  title: string;
  backgroundImageBuffer: Buffer;
}

/**
 * MAGAZINE STYLE Template
 * Use for: lifestyle, interviews, premium content, photography, fashion, influencers
 * 
 * Features:
 * - Elegant layout with clean typography
 * - Sophisticated color palette
 * - Professional magazine aesthetic
 * - Size: 1280x720
 */
export async function generateMagazineStyle(
  options: MagazineStyleOptions,
): Promise<Buffer> {
  const { title, backgroundImageBuffer } = options;

  const words = extractKeyWords(title, 6);

  const magazineSVG = `
    <svg width="1280" height="720">
      <defs>
        <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="8" />
          <feOffset dx="0" dy="3" result="offsetblur" />
          <feMerge>
            <feMergeNode />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      
      <!-- Top colored bar -->
      <rect x="0" y="0" width="1280" height="15" fill="#D4AF37" />
      
      <!-- Bottom text area -->
      <rect x="0" y="550" width="1280" height="170" fill="#FFFFFF" opacity="0.95" />
      
      <!-- Accent line -->
      <rect x="100" y="540" width="1080" height="5" fill="#D4AF37" />
      
      <!-- Title text (dark on light background) -->
      <text
        x="640"
        y="640"
        font-family="Georgia, Times New Roman, serif"
        font-size="60"
        font-weight="700"
        text-anchor="middle"
        fill="#1A1A1A"
        filter="url(#shadow)"
      >${words}</text>
      
      <!-- Subtitle line -->
      <line x1="400" y1="660" x2="880" y2="660" stroke="#D4AF37" stroke-width="2" />
    </svg>
  `;

  const result = await sharp(backgroundImageBuffer)
    .resize(1280, 720, { fit: 'cover', position: 'center' })
    .composite([
      {
        input: Buffer.from(magazineSVG),
        top: 0,
        left: 0,
      },
    ])
    .png()
    .toBuffer();

  return result;
}

function extractKeyWords(title: string, maxWords: number): string {
  const fillers = ['how', 'to', 'the', 'a', 'an', 'in', 'on', 'at', 'for', 'with', 'and', 'or', 'but', 'of'];

  let words = title
    .toUpperCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter((word) => word.length > 0 && !fillers.includes(word.toLowerCase()));

  if (words.length > maxWords) {
    words = words.slice(0, maxWords);
  }

  if (words.length === 0) {
    words = title.replace(/[^\w\s]/g, '').split(/\s+/).slice(0, maxWords);
  }

  return words.join(' ');
}
