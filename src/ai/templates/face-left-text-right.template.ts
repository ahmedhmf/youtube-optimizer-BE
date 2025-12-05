import sharp from 'sharp';

export interface FaceLeftTextRightOptions {
  title: string;
  backgroundImageBuffer: Buffer;
}

/**
 * FACE LEFT TEXT RIGHT Template
 * Use for: commentary, reactions, personal branding videos, vlogs, challenge videos
 * 
 * Features:
 * - Face/person on left side (60% width)
 * - Bold text on right side (40% width)
 * - Colorful background block behind text
 * - Size: 1280x720
 */
export async function generateFaceLeftTextRight(
  options: FaceLeftTextRightOptions,
): Promise<Buffer> {
  const { title, backgroundImageBuffer } = options;

  // Extract key words (max 4 for vertical layout)
  const words = extractKeyWords(title, 4);
  const lines = words.split(' ');

  // Create colored block + text SVG
  const textBlockSVG = `
    <svg width="1280" height="720">
      <!-- Colored background block for text area -->
      <rect x="768" y="0" width="512" height="720" fill="#FF6B00" opacity="0.95" />
      
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
      
      <!-- Text lines (stacked vertically) -->
      ${lines
        .map((line, index) => {
          const y = 250 + index * 80;
          return `
          <!-- Shadow -->
          <text
            x="1024"
            y="${y}"
            font-family="Montserrat, Arial Black, Arial"
            font-size="90"
            font-weight="900"
            text-anchor="middle"
            fill="#000000"
            filter="url(#shadow)"
          >${line}</text>
          
          <!-- Stroke -->
          <text
            x="1024"
            y="${y}"
            font-family="Montserrat, Arial Black, Arial"
            font-size="90"
            font-weight="900"
            text-anchor="middle"
            fill="none"
            stroke="#000000"
            stroke-width="6"
            stroke-linejoin="round"
          >${line}</text>
          
          <!-- Main Text -->
          <text
            x="1024"
            y="${y}"
            font-family="Montserrat, Arial Black, Arial"
            font-size="90"
            font-weight="900"
            text-anchor="middle"
            fill="#FFFFFF"
          >${line}</text>
        `;
        })
        .join('')}
    </svg>
  `;

  // Compose
  const result = await sharp(backgroundImageBuffer)
    .resize(1280, 720, { fit: 'cover', position: 'center' })
    .composite([
      {
        input: Buffer.from(textBlockSVG),
        top: 0,
        left: 0,
      },
    ])
    .png()
    .toBuffer();

  return result;
}

function extractKeyWords(title: string, maxWords: number): string {
  const fillers = [
    'how', 'to', 'the', 'a', 'an', 'in', 'on', 'at', 'for', 'with',
    'and', 'or', 'but', 'of', 'is', 'are', 'this', 'that',
  ];

  let words = title
    .toUpperCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter((word) => word.length > 0 && !fillers.includes(word.toLowerCase()));

  if (words.length > maxWords) {
    words = words.slice(0, maxWords);
  }

  if (words.length === 0) {
    words = title
      .toUpperCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .slice(0, maxWords);
  }

  return words.join(' ');
}
