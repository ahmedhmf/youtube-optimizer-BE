import sharp from 'sharp';

export interface BeforeAfterOptions {
  title: string;
  backgroundImageBuffer: Buffer;
}

/**
 * BEFORE AFTER Template
 * Use for: tech reviews, transformations, fitness, makeovers, renovations, upgrades, comparisons
 * 
 * Features:
 * - Split screen with "BEFORE" and "AFTER" labels
 * - Arrow or VS in the middle
 * - Clear comparison layout
 * - Size: 1280x720
 */
export async function generateBeforeAfter(
  options: BeforeAfterOptions,
): Promise<Buffer> {
  const { title, backgroundImageBuffer } = options;

  // Create split screen overlay
  const splitSVG = `
    <svg width="1280" height="720">
      <defs>
        <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="12" />
          <feOffset dx="0" dy="3" result="offsetblur" />
          <feMerge>
            <feMergeNode />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      
      <!-- Left side label background -->
      <rect x="50" y="50" width="300" height="100" fill="#FF4444" opacity="0.9" rx="10" />
      
      <!-- Right side label background -->
      <rect x="930" y="50" width="300" height="100" fill="#44FF44" opacity="0.9" rx="10" />
      
      <!-- Center arrow background -->
      <circle cx="640" cy="360" r="60" fill="#FFCC00" opacity="0.95" />
      
      <!-- BEFORE text -->
      <text
        x="200"
        y="115"
        font-family="Montserrat, Arial Black, Arial"
        font-size="60"
        font-weight="900"
        text-anchor="middle"
        fill="#FFFFFF"
        filter="url(#shadow)"
      >BEFORE</text>
      
      <!-- AFTER text -->
      <text
        x="1080"
        y="115"
        font-family="Montserrat, Arial Black, Arial"
        font-size="60"
        font-weight="900"
        text-anchor="middle"
        fill="#FFFFFF"
        filter="url(#shadow)"
      >AFTER</text>
      
      <!-- Arrow or VS -->
      <text
        x="640"
        y="385"
        font-family="Arial Black, Arial"
        font-size="70"
        font-weight="900"
        text-anchor="middle"
        fill="#000000"
        filter="url(#shadow)"
      >→</text>
      
      <!-- Bottom title bar -->
      <rect x="0" y="620" width="1280" height="100" fill="#000000" opacity="0.8" />
      
      <!-- Title text -->
      <text
        x="640"
        y="685"
        font-family="Montserrat, Arial Black, Arial"
        font-size="50"
        font-weight="900"
        text-anchor="middle"
        fill="#FFFFFF"
        filter="url(#shadow)"
      >${extractKeyWords(title, 5)}</text>
    </svg>
  `;

  const result = await sharp(backgroundImageBuffer)
    .resize(1280, 720, { fit: 'cover', position: 'center' })
    .composite([
      {
        input: Buffer.from(splitSVG),
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

  return words.join(' ');
}
