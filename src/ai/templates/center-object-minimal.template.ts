import sharp from 'sharp';

export interface CenterObjectMinimalOptions {
  title: string;
  backgroundImageBuffer: Buffer;
}

/**
 * CENTER OBJECT MINIMAL Template
 * Use for: product reviews, travel, food, artifacts, simple object-focused thumbnails, mystery reveals
 * 
 * Features:
 * - Clean, minimalistic design
 * - Object in center, text at bottom
 * - Simple white text with subtle shadow
 * - Size: 1280x720
 */
export async function generateCenterObjectMinimal(
  options: CenterObjectMinimalOptions,
): Promise<Buffer> {
  const { title, backgroundImageBuffer } = options;

  const words = extractKeyWords(title, 5);

  const textSVG = `
    <svg width="1280" height="720">
      <defs>
        <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="10" />
          <feOffset dx="0" dy="3" result="offsetblur" />
          <feMerge>
            <feMergeNode />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      
      <!-- Bottom text bar -->
      <rect x="0" y="600" width="1280" height="120" fill="#000000" opacity="0.6" />
      
      <!-- Shadow -->
      <text
        x="640"
        y="655"
        font-family="Montserrat, Arial, sans-serif"
        font-size="55"
        font-weight="700"
        text-anchor="middle"
        fill="#000000"
        filter="url(#shadow)"
      >${words}</text>
      
      <!-- Stroke -->
      <text
        x="640"
        y="655"
        font-family="Montserrat, Arial, sans-serif"
        font-size="55"
        font-weight="700"
        text-anchor="middle"
        fill="none"
        stroke="#000000"
        stroke-width="4"
        stroke-linejoin="round"
      >${words}</text>
      
      <!-- Main Text -->
      <text
        x="640"
        y="655"
        font-family="Montserrat, Arial, sans-serif"
        font-size="55"
        font-weight="700"
        text-anchor="middle"
        fill="#FFFFFF"
      >${words}</text>
    </svg>
  `;

  const result = await sharp(backgroundImageBuffer)
    .resize(1280, 720, { fit: 'cover', position: 'center' })
    .composite([
      {
        input: Buffer.from(textSVG),
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
