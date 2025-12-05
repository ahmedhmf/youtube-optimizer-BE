import sharp from 'sharp';

export interface BlurBackgroundTextOptions {
  title: string;
  backgroundImageBuffer: Buffer;
}

/**
 * BLUR BACKGROUND TEXT Template
 * Use for: how-to, explainers, commentary without face, minimalistic or clean thumbnails
 * 
 * Features:
 * - Blurred background for focus
 * - Large centered text
 * - Clean, distraction-free design
 * - Size: 1280x720
 */
export async function generateBlurBackgroundText(
  options: BlurBackgroundTextOptions,
): Promise<Buffer> {
  const { title, backgroundImageBuffer } = options;

  const words = extractKeyWords(title, 5);

  // First, blur the background
  const blurredBackground = await sharp(backgroundImageBuffer)
    .resize(1280, 720, { fit: 'cover', position: 'center' })
    .blur(15) // Strong blur effect
    .toBuffer();

  // Create text overlay
  const textSVG = `
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
      
      <!-- Semi-transparent center box -->
      <rect x="140" y="260" width="1000" height="200" fill="#000000" opacity="0.5" rx="10" />
      
      <!-- Shadow -->
      <text
        x="640"
        y="390"
        font-family="Montserrat, Arial Black, Arial"
        font-size="100"
        font-weight="900"
        text-anchor="middle"
        fill="#000000"
        filter="url(#shadow)"
      >${words}</text>
      
      <!-- Stroke -->
      <text
        x="640"
        y="390"
        font-family="Montserrat, Arial Black, Arial"
        font-size="100"
        font-weight="900"
        text-anchor="middle"
        fill="none"
        stroke="#000000"
        stroke-width="7"
        stroke-linejoin="round"
      >${words}</text>
      
      <!-- Main Text -->
      <text
        x="640"
        y="390"
        font-family="Montserrat, Arial Black, Arial"
        font-size="100"
        font-weight="900"
        text-anchor="middle"
        fill="#FFFFFF"
      >${words}</text>
    </svg>
  `;

  // Composite text over blurred background
  const result = await sharp(blurredBackground)
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
    words = title.toUpperCase().replace(/[^\w\s]/g, '').split(/\s+/).slice(0, maxWords);
  }

  return words.join(' ');
}
