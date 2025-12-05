import sharp from 'sharp';

export interface TwoToneOptions {
  title: string;
  backgroundImageBuffer: Buffer;
}

/**
 * TWO TONE Template
 * Use for: tutorials, education, finance, presentations, clean/simple design content
 * 
 * Features:
 * - Split color background (diagonal or horizontal)
 * - Professional, clean aesthetic
 * - Bold contrasting text
 * - Size: 1280x720
 */
export async function generateTwoTone(
  options: TwoToneOptions,
): Promise<Buffer> {
  const { title, backgroundImageBuffer } = options;

  const words = extractKeyWords(title, 5);

  const twoToneSVG = `
    <svg width="1280" height="720">
      <defs>
        <linearGradient id="twoTone" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#2563EB;stop-opacity:0.9" />
          <stop offset="50%" style="stop-color:#2563EB;stop-opacity:0.9" />
          <stop offset="50%" style="stop-color:#7C3AED;stop-opacity:0.9" />
          <stop offset="100%" style="stop-color:#7C3AED;stop-opacity:0.9" />
        </linearGradient>
        <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="12" />
          <feOffset dx="0" dy="4" result="offsetblur" />
          <feMerge>
            <feMergeNode />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      
      <!-- Two-tone overlay -->
      <rect width="1280" height="720" fill="url(#twoTone)" />
      
      <!-- Shadow -->
      <text
        x="640"
        y="390"
        font-family="Montserrat, Arial, sans-serif"
        font-size="90"
        font-weight="800"
        text-anchor="middle"
        fill="#000000"
        filter="url(#shadow)"
      >${words}</text>
      
      <!-- Stroke -->
      <text
        x="640"
        y="390"
        font-family="Montserrat, Arial, sans-serif"
        font-size="90"
        font-weight="800"
        text-anchor="middle"
        fill="none"
        stroke="#000000"
        stroke-width="6"
        stroke-linejoin="round"
      >${words}</text>
      
      <!-- Main Text -->
      <text
        x="640"
        y="390"
        font-family="Montserrat, Arial, sans-serif"
        font-size="90"
        font-weight="800"
        text-anchor="middle"
        fill="#FFFFFF"
      >${words}</text>
    </svg>
  `;

  const result = await sharp(backgroundImageBuffer)
    .resize(1280, 720, { fit: 'cover', position: 'center' })
    .composite([
      {
        input: Buffer.from(twoToneSVG),
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
    words = title.toUpperCase().replace(/[^\w\s]/g, '').split(/\s+/).slice(0, maxWords);
  }

  return words.join(' ');
}
