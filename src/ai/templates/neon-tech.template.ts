import sharp from 'sharp';

export interface NeonTechOptions {
  title: string;
  backgroundImageBuffer: Buffer;
}

/**
 * NEON TECH Template
 * Use for: AI, tech, coding, gaming, digital topics, futuristic themes
 * 
 * Features:
 * - Neon glow effect
 * - Futuristic cyan/magenta colors
 * - Bold uppercase text
 * - Size: 1280x720
 */
export async function generateNeonTech(
  options: NeonTechOptions,
): Promise<Buffer> {
  const { title, backgroundImageBuffer } = options;

  const words = extractKeyWords(title, 4);

  // Create neon effect with multiple glowing layers
  const neonSVG = `
    <svg width="1280" height="720">
      <defs>
        <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="10" />
          <feOffset dx="0" dy="0" result="offsetblur" />
          <feFlood flood-color="#00FFFF" flood-opacity="1" />
          <feComposite in2="offsetblur" operator="in" />
          <feMerge>
            <feMergeNode />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="glow2" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="20" />
          <feOffset dx="0" dy="0" result="offsetblur" />
          <feFlood flood-color="#FF00FF" flood-opacity="0.8" />
          <feComposite in2="offsetblur" operator="in" />
          <feMerge>
            <feMergeNode />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      
      <!-- Dark overlay for contrast -->
      <rect x="0" y="0" width="1280" height="720" fill="#000000" opacity="0.4" />
      
      <!-- Outer glow (magenta) -->
      <text
        x="640"
        y="390"
        font-family="Montserrat, Arial Black, Arial"
        font-size="100"
        font-weight="900"
        text-anchor="middle"
        fill="#FF00FF"
        filter="url(#glow2)"
      >${words}</text>
      
      <!-- Inner glow (cyan) -->
      <text
        x="640"
        y="390"
        font-family="Montserrat, Arial Black, Arial"
        font-size="100"
        font-weight="900"
        text-anchor="middle"
        fill="#00FFFF"
        filter="url(#glow)"
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
        stroke-width="6"
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

  const result = await sharp(backgroundImageBuffer)
    .resize(1280, 720, { fit: 'cover', position: 'center' })
    .composite([
      {
        input: Buffer.from(neonSVG),
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
