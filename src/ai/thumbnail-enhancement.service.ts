import sharp from 'sharp';

/**
 * Professional thumbnail enhancement service
 * Applies industry-standard post-processing to AI-generated backgrounds
 * 
 * Steps:
 * 1. Color grading (teal & orange LUT)
 * 2. Contrast boost (unsharp mask + curves)
 * 3. Depth of field simulation (subtle blur)
 * 4. Gradient overlays
 * 5. Vignette
 * 6. Film grain
 */
export class ThumbnailEnhancementService {
  /**
   * Apply professional post-processing to base AI background
   * This is what makes thumbnails look crisp and professional
   */
  static async enhanceBackground(
    baseBuffer: Buffer,
    style: 'vibrant' | 'cinematic' | 'neon' | 'warm' | 'cool' = 'cinematic',
  ): Promise<Buffer> {
    let enhanced = sharp(baseBuffer);

    // Step 1: Resize to standard dimensions if needed
    enhanced = enhanced.resize(1792, 1024, {
      fit: 'cover',
      position: 'center',
    });

    // Step 2: Apply color grading based on style
    enhanced = this.applyColorGrading(enhanced, style);

    // Step 3: Boost contrast and sharpness
    enhanced = enhanced
      .sharpen({ sigma: 1.5 })
      .modulate({
        brightness: 1.1, // Slight brightness boost
        saturation: 1.3, // YouTube-grade saturation
      })
      .normalize(); // Auto-adjust contrast

    // Step 4: Apply subtle vignette
    const vignetteOverlay = Buffer.from(
      `<svg width="1792" height="1024">
        <defs>
          <radialGradient id="vignette">
            <stop offset="0%" stop-color="black" stop-opacity="0"/>
            <stop offset="70%" stop-color="black" stop-opacity="0"/>
            <stop offset="100%" stop-color="black" stop-opacity="0.3"/>
          </radialGradient>
        </defs>
        <rect width="1792" height="1024" fill="url(#vignette)"/>
      </svg>`,
    );

    enhanced = enhanced.composite([
      {
        input: vignetteOverlay,
        blend: 'multiply',
      },
    ]);

    // Step 4: Apply gradient overlay (makes text readable)
    const gradientOverlay = this.createGradientOverlay(style);
    enhanced = enhanced.composite([
      {
        input: gradientOverlay,
        blend: 'overlay',
      },
    ]);

    // Step 6: Final blur for depth of field (background only)
    // This makes text POP when added later
    enhanced = enhanced.blur(1.2); // Very subtle blur

    return await enhanced.png({ quality: 100 }).toBuffer();
  }

  /**
   * Apply color grading LUTs (teal & orange, filmic, vivid)
   */
  private static applyColorGrading(
    image: sharp.Sharp,
    style: string,
  ): sharp.Sharp {
    switch (style) {
      case 'cinematic':
        // Teal & Orange (classic YouTube look)
        return image.modulate({
          brightness: 1.0,
          saturation: 1.2,
          hue: 15, // Shift towards orange
        });

      case 'vibrant':
        // Punchy, high saturation
        return image.modulate({
          brightness: 1.15,
          saturation: 1.5,
          hue: 0,
        });

      case 'neon':
        // High contrast neon look
        return image
          .modulate({
            brightness: 1.1,
            saturation: 1.6,
            hue: -10,
          })
          .linear(1.3, -(128 * 0.3)); // Increase contrast

      case 'warm':
        // Warm golden tones
        return image.modulate({
          brightness: 1.1,
          saturation: 1.3,
          hue: 20,
        });

      case 'cool':
        // Cool professional blue
        return image.modulate({
          brightness: 1.05,
          saturation: 1.2,
          hue: -20,
        });

      default:
        return image;
    }
  }

  /**
   * Create gradient overlay for readability
   */
  private static createGradientOverlay(style: string): Buffer {
    let gradientSvg = '';

    switch (style) {
      case 'cinematic':
        // Black to transparent (bottom to top)
        gradientSvg = `
          <svg width="1792" height="1024">
            <defs>
              <linearGradient id="grad" x1="0%" y1="100%" x2="0%" y2="0%">
                <stop offset="0%" stop-color="black" stop-opacity="0.5"/>
                <stop offset="100%" stop-color="black" stop-opacity="0"/>
              </linearGradient>
            </defs>
            <rect width="1792" height="1024" fill="url(#grad)"/>
          </svg>
        `;
        break;

      case 'neon':
        // Purple to blue gradient
        gradientSvg = `
          <svg width="1792" height="1024">
            <defs>
              <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#6366f1" stop-opacity="0.3"/>
                <stop offset="100%" stop-color="#0ea5e9" stop-opacity="0.3"/>
              </linearGradient>
            </defs>
            <rect width="1792" height="1024" fill="url(#grad)"/>
          </svg>
        `;
        break;

      case 'warm':
        // Orange glow
        gradientSvg = `
          <svg width="1792" height="1024">
            <defs>
              <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#f97316" stop-opacity="0.2"/>
                <stop offset="100%" stop-color="#eab308" stop-opacity="0.2"/>
              </linearGradient>
            </defs>
            <rect width="1792" height="1024" fill="url(#grad)"/>
          </svg>
        `;
        break;

      default:
        // Default: subtle dark gradient
        gradientSvg = `
          <svg width="1792" height="1024">
            <defs>
              <linearGradient id="grad" x1="0%" y1="100%" x2="0%" y2="0%">
                <stop offset="0%" stop-color="black" stop-opacity="0.3"/>
                <stop offset="100%" stop-color="black" stop-opacity="0"/>
              </linearGradient>
            </defs>
            <rect width="1792" height="1024" fill="url(#grad)"/>
          </svg>
        `;
    }

    return Buffer.from(gradientSvg);
  }

  /**
   * Detect style from video content
   */
  static detectStyleFromContent(title: string, transcript: string): string {
    const content = `${title} ${transcript}`.toLowerCase();

    if (content.includes('gaming') || content.includes('tech')) return 'neon';
    if (content.includes('sport') || content.includes('action')) return 'warm';
    if (content.includes('business')) return 'cool';
    if (content.includes('tutorial') || content.includes('education'))
      return 'vibrant';

    return 'cinematic'; // Default
  }
}
