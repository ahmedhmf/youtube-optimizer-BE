import sharp from 'sharp';

export interface DocumentaryStoryOptions {
  title: string;
  backgroundImageBuffer: Buffer;
}

/**
 * DOCUMENTARY STORY Template
 * Use for: storytelling, history, Ancient Egypt, mysteries, true crime, documentary-style videos
 * 
 * Features:
 * - Cinematic dark vignette
 * - Elegant serif-style text at bottom
 * - Premium, mysterious aesthetic
 * - Size: 1280x720
 */
export async function generateDocumentaryStory(
  options: DocumentaryStoryOptions,
): Promise<Buffer> {
  const { title, backgroundImageBuffer } = options;

  // Extract key words
  const words = extractKeyWords(title, 6);

  // Create vignette + text SVG
  const compositeSVG = `
    <svg width="1280" height="720">
      <defs>
        <radialGradient id="vignette" cx="50%" cy="50%" r="70%">
          <stop offset="0%" style="stop-color:rgb(0,0,0);stop-opacity:0" />
          <stop offset="100%" style="stop-color:rgb(0,0,0);stop-opacity:0.8" />
        </radialGradient>
        <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="10" />
          <feOffset dx="0" dy="2" result="offsetblur" />
          <feMerge>
            <feMergeNode />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      
      <!-- Vignette overlay -->
      <rect width="1280" height="720" fill="url(#vignette)" />
      
      <!-- Bottom dark bar -->
      <rect x="0" y="550" width="1280" height="170" fill="#000000" opacity="0.7" />
      
      <!-- Shadow -->
      <text
        x="640"
        y="640"
        font-family="Georgia, Times New Roman, serif"
        font-size="60"
        font-weight="700"
        text-anchor="middle"
        fill="#000000"
        filter="url(#shadow)"
      >${words}</text>
      
      <!-- Stroke -->
      <text
        x="640"
        y="640"
        font-family="Georgia, Times New Roman, serif"
        font-size="60"
        font-weight="700"
        text-anchor="middle"
        fill="none"
        stroke="#DAA520"
        stroke-width="3"
        stroke-linejoin="round"
      >${words}</text>
      
      <!-- Main Text -->
      <text
        x="640"
        y="640"
        font-family="Georgia, Times New Roman, serif"
        font-size="60"
        font-weight="700"
        text-anchor="middle"
        fill="#F5F5DC"
      >${words}</text>
    </svg>
  `;

  const result = await sharp(backgroundImageBuffer)
    .resize(1280, 720, { fit: 'cover', position: 'center' })
    .composite([
      {
        input: Buffer.from(compositeSVG),
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
