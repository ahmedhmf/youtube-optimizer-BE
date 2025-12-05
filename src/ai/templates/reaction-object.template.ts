import sharp from 'sharp';

export interface ReactionObjectOptions {
  title: string;
  backgroundImageBuffer: Buffer;
}

/**
 * REACTION OBJECT Template
 * Use for: entertainment, reaction videos, challenge videos, "look what happened" content, surprising events
 * 
 * Features:
 * - Shocked/excited expression area
 * - Bold exclamatory text
 * - Bright colors (yellow, red)
 * - Size: 1280x720
 */
export async function generateReactionObject(
  options: ReactionObjectOptions,
): Promise<Buffer> {
  const { title, backgroundImageBuffer } = options;

  const words = extractKeyWords(title, 4);

  const reactionSVG = `
    <svg width="1280" height="720">
      <defs>
        <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="15" />
          <feOffset dx="0" dy="5" result="offsetblur" />
          <feMerge>
            <feMergeNode />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      
      <!-- Top text area with bright background -->
      <rect x="100" y="50" width="1080" height="150" fill="#FFDD00" opacity="0.95" rx="15" />
      
      <!-- Shadow -->
      <text
        x="640"
        y="125"
        font-family="Montserrat, Arial Black, Arial"
        font-size="80"
        font-weight="900"
        text-anchor="middle"
        fill="#000000"
        filter="url(#shadow)"
      >${words}</text>
      
      <!-- Stroke (red for emphasis) -->
      <text
        x="640"
        y="125"
        font-family="Montserrat, Arial Black, Arial"
        font-size="80"
        font-weight="900"
        text-anchor="middle"
        fill="none"
        stroke="#FF0000"
        stroke-width="8"
        stroke-linejoin="round"
      >${words}</text>
      
      <!-- Main Text -->
      <text
        x="640"
        y="125"
        font-family="Montserrat, Arial Black, Arial"
        font-size="80"
        font-weight="900"
        text-anchor="middle"
        fill="#FFFFFF"
      >${words}</text>
    </svg>
  `;

  const result = await sharp(backgroundImageBuffer)
    .resize(1280, 720, { fit: 'cover', position: 'center' })
    .composite([
      {
        input: Buffer.from(reactionSVG),
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
