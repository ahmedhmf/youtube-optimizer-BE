import { ThumbnailStyle } from './models/thumbnail.interface';

export class ThumbnailPromptsService {
  /**
   * Generate DALL-E 3 prompt for thumbnail background image (1280x720)
   * Text will be added programmatically by Sharp.js templates
   */
  static generateBackgroundPrompt(
    videoTitle: string,
    transcript: string,
    templateStyle: ThumbnailStyle,
  ): string {
    const videoContext = `${videoTitle}. ${transcript.slice(0, 1500)}`;

    // Template-specific composition guidance
    const templateGuidance = this.getTemplateGuidance(templateStyle);

    return `Professional YouTube thumbnail background image (1280x720). 
    
VIDEO: ${videoTitle}

CONTEXT: ${videoContext}

TEMPLATE: ${templateStyle}
${templateGuidance}

CRITICAL RULES:
- NO text, words, letters, or typography in the image
- This is a BACKGROUND ONLY (text added later programmatically)
- Professional, eye-catching, high contrast
- Bold colors optimized for mobile viewing
- Photorealistic style unless otherwise specified
- Clean composition with strategic empty space for text
- 16:9 aspect ratio (1280x720)`;
  }

  private static getTemplateGuidance(style: ThumbnailStyle): string {
    switch (style) {
      case ThumbnailStyle.BIG_BOLD_TEXT:
        return `Big Bold Text Style:
- Main subject positioned in CENTER of frame
- Leave TOP 30% area clean and simple for large text overlay
- Professional, modern aesthetic
- High contrast background
- Subject should be visually striking but not overwhelming`;

      case ThumbnailStyle.FACE_LEFT_TEXT_RIGHT:
        return `Face Left, Text Right Style:
- Person/face positioned on LEFT 60% of frame
- RIGHT 40% should be clean, simple, solid color or subtle pattern
- Face should be looking forward or slightly right
- Expressive facial expression (confident, excited, thoughtful)
- Professional lighting on subject`;

      case ThumbnailStyle.DOCUMENTARY_STORY:
        return `Documentary Story Style:
- Cinematic, dramatic composition
- Subject in UPPER-CENTER area
- BOTTOM 25% darker/cleaner for magazine-style text
- Moody lighting (golden hour, dramatic shadows)
- Rich, saturated colors
- Elegant, premium aesthetic`;

      case ThumbnailStyle.BEFORE_AFTER:
        return `Before & After Style:
- Composition that can show transformation/comparison
- Can be split (left/right or top/bottom)
- Clear visual contrast between elements
- Subject showing change or comparison
- Leave space at CENTER and BOTTOM for labels ("BEFORE"/"AFTER" arrows)`;

      case ThumbnailStyle.CENTER_OBJECT_MINIMAL:
        return `Center Object Minimal Style:
- Product or object in CENTER 70% of frame
- Clean, uncluttered, minimalist background
- Simple backdrop (white, gradient, or subtle texture)
- BOTTOM 20% should be very simple for text bar
- Professional product photography lighting`;

      case ThumbnailStyle.NEON_TECH:
        return `Neon Tech Style:
- Futuristic, cyberpunk, or high-tech aesthetic
- Bold neon colors (cyan, magenta, electric blue, bright purple)
- Digital/technological elements
- Dramatic lighting with glow effects
- Subject in CENTER with tech-inspired background
- Modern, energetic vibe`;

      case ThumbnailStyle.REACTION_OBJECT:
        return `Reaction Object Style:
- Person with STRONG emotional expression (shocked, excited, amazed)
- Face positioned in CENTER-BOTTOM area
- TOP 20% should be simple for text banner
- Bright, vibrant colors
- Clear facial features and expression
- High energy, entertaining aesthetic`;

      case ThumbnailStyle.TWO_TONE:
        return `Two Tone Style:
- Split background with two complementary colors
- Diagonal or horizontal color division
- Clean, modern, professional aesthetic
- Subject in CENTER where colors meet
- Bold color contrast (blue/purple, orange/red, etc.)
- Suitable for tutorials and professional content`;

      case ThumbnailStyle.BLUR_BACKGROUND_TEXT:
        return `Blur Background Text Style:
- Background should be slightly out of focus
- Main subject visible but softly blurred
- CENTER area for large text overlay
- Dreamy, artistic effect
- Subtle colors and tones
- Clean, minimalist, distraction-free`;

      case ThumbnailStyle.MAGAZINE_STYLE:
        return `Magazine Style:
- Premium, sophisticated aesthetic
- Professional fashion/lifestyle photography style
- Subject in UPPER-CENTER area
- BOTTOM 25% should be clean for magazine layout
- Elegant lighting and composition
- High-end, polished look`;

      default:
        return `Generate a professional, eye-catching background suitable for YouTube thumbnails.`;
    }
  }
}
