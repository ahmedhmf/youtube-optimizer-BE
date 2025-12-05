import sharp from 'sharp';

export interface BigBoldTextOptions {
  title: string;
  backgroundImageBuffer: Buffer;
}

/**
 * BIG BOLD TEXT Template
 * Use for: tutorials, how-to, education, business, coding, productivity, finance, explainer videos
 * 
 * Features:
 * - Large centered headline (150px Montserrat ExtraBold)
 * - Dark gradient overlay (top-to-bottom, transparent to black)
 * - Maximum 5 words
 * - Black stroke (8px) with subtle shadow
 * - Size: 1280x720
 */
export async function generateBigBoldText(
  options: BigBoldTextOptions,
): Promise<Buffer> {
  const { title, backgroundImageBuffer } = options;

  // Extract key words (max 5)
  const words = extractKeyWords(title, 5);

  // Create gradient overlay SVG
  const gradientSVG = `
    <svg width="1280" height="720">
      <defs>
        <linearGradient id="darkGradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" style="stop-color:rgb(0,0,0);stop-opacity:0" />
          <stop offset="100%" style="stop-color:rgb(0,0,0);stop-opacity:0.7" />
        </linearGradient>
      </defs>
      <rect width="1280" height="720" fill="url(#darkGradient)" />
    </svg>
  `;

  // Create text SVG
  const textSVG = `
    <svg width="1280" height="720">
      <defs>
        <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="15" />
          <feOffset dx="0" dy="4" result="offsetblur" />
          <feMerge>
            <feMergeNode />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      
      <!-- Shadow -->
      <text
        x="640"
        y="400"
        font-family="Montserrat, Arial Black, Arial"
        font-size="120"
        font-weight="900"
        text-anchor="middle"
        fill="#000000"
        filter="url(#shadow)"
      >${words}</text>
      
      <!-- Stroke -->
      <text
        x="640"
        y="400"
        font-family="Montserrat, Arial Black, Arial"
        font-size="120"
        font-weight="900"
        text-anchor="middle"
        fill="none"
        stroke="#000000"
        stroke-width="8"
        stroke-linejoin="round"
      >${words}</text>
      
      <!-- Main Text -->
      <text
        x="640"
        y="400"
        font-family="Montserrat, Arial Black, Arial"
        font-size="120"
        font-weight="900"
        text-anchor="middle"
        fill="#FFFFFF"
      >${words}</text>
    </svg>
  `;

  // Compose layers
  const result = await sharp(backgroundImageBuffer)
    .resize(1280, 720, { fit: 'cover', position: 'center' })
    .composite([
      {
        input: Buffer.from(gradientSVG),
        top: 0,
        left: 0,
      },
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

/**
 * Extract key words from title
 */
function extractKeyWords(title: string, maxWords: number = 5): string {
  const fillers = [
    'how', 'to', 'the', 'a', 'an', 'in', 'on', 'at', 'for', 'with',
    'and', 'or', 'but', 'of', 'is', 'are', 'this', 'that', 'these',
    'those', 'my', 'your', 'i', 'you', 'we', 'they',
  ];

  let words = title
    .toUpperCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter((word) => word.length > 0);

  // Remove filler words
  words = words.filter((word) => !fillers.includes(word.toLowerCase()));

  // Take first N important words
  if (words.length > maxWords) {
    words = words.slice(0, maxWords);
  }

  // If too short, use original title
  if (words.length === 0) {
    words = title
      .toUpperCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .slice(0, maxWords);
  }

  return words.join(' ');
}
