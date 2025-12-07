import { ThumbnailStyle } from './models/thumbnail.interface';

export class ThumbnailPromptsService {
  /**
   * Generate cinematic BASE backgrounds (not final output)
   * Professional approach: Simple, blurred, atmospheric base for post-processing
   */
  static generateBackgroundPrompt(
    videoTitle: string,
    transcript: string,
    templateStyle: ThumbnailStyle,
  ): string {
    // Extract environment/mood from content
    const sceneType = this.extractSceneType(videoTitle, transcript);
    const lighting = this.getLighting(videoTitle, transcript);
    const composition = this.getCompositionGuidance(templateStyle);

    // Build Flux-optimized prompt with specific details
    return `Professional YouTube thumbnail background: ${sceneType}, ${lighting}, shallow depth of field, bokeh effect, cinematic color grading, high quality photography, ultra detailed, 8k resolution, ${composition}, empty center space, no text, no people in focus, no logos, clean composition, 16:9 aspect ratio`;
  }

  /**
   * Extract specific scene type that Flux can render well
   */
  private static extractSceneType(title: string, transcript: string): string {
    const content = `${title} ${transcript}`.toLowerCase();

    // Tech/Gaming
    if (content.includes('gaming') || content.includes('game')) {
      return 'RGB lit gaming setup with mechanical keyboard and ultrawide monitor, purple and cyan LED lights, dark room ambiance';
    }
    if (content.includes('coding') || content.includes('programming')) {
      return 'modern developer workspace with multiple monitors showing code, minimalist desk, MacBook, soft blue ambient lighting';
    }
    if (content.includes('tech') || content.includes('iphone') || content.includes('review')) {
      return 'sleek product photography setup, clean white surface, professional studio lighting, tech gadgets arranged aesthetically';
    }

    // Sports/Fitness
    if (content.includes('football') || content.includes('soccer')) {
      return 'professional football stadium during golden hour, green grass field, dramatic stadium lights, blurred crowd in background';
    }
    if (content.includes('basketball')) {
      return 'indoor basketball court with dramatic spotlights, polished wooden floor, arena atmosphere';
    }
    if (content.includes('fitness') || content.includes('workout') || content.includes('gym')) {
      return 'modern fitness gym interior, exercise equipment, dramatic side lighting, motivational atmosphere';
    }

    // Business/Finance
    if (content.includes('business') || content.includes('finance') || content.includes('money')) {
      return 'luxury modern office interior, floor-to-ceiling windows with city skyline view, executive desk, professional ambiance';
    }

    // Food/Cooking
    if (content.includes('food') || content.includes('recipe') || content.includes('cooking')) {
      return 'rustic kitchen countertop with marble surface, fresh ingredients artfully arranged, warm natural window light';
    }

    // Travel/Nature
    if (content.includes('travel') || content.includes('adventure')) {
      return 'breathtaking mountain landscape at sunset, dramatic clouds, vibrant sky colors, epic nature scenery';
    }

    // Education/Tutorial
    if (content.includes('tutorial') || content.includes('learn') || content.includes('how to')) {
      return 'clean minimalist workspace with notebook and coffee, soft natural lighting, inspirational study environment';
    }

    // Entertainment/Vlog
    if (content.includes('vlog') || content.includes('story') || content.includes('life')) {
      return 'cozy creator studio setup with ring light, camera equipment, warm ambient lighting, modern interior';
    }

    // Default: Generic cinematic
    return 'cinematic blurred bokeh background with smooth color gradients, professional photography studio lighting, abstract artistic composition';
  }

  /**
   * Extract main subject in simple terms
   */
  private static extractMainSubject(title: string, transcript: string): string {
    const content = `${title} ${transcript}`.toLowerCase();

    // Sports/Athletes
    if (
      content.includes('footballer') ||
      content.includes('player') ||
      content.includes('athlete') ||
      content.includes('football') ||
      content.includes('soccer')
    ) {
      return 'Professional footballer in action on field';
    }

    // Tech products
    if (content.includes('iphone')) return 'Person holding iPhone showing screen';
    if (content.includes('macbook')) return 'MacBook laptop on desk';
    if (content.includes('gaming') || content.includes('gamer'))
      return 'Gaming setup with monitor';

    // Coding/tech
    if (
      content.includes('coding') ||
      content.includes('programming') ||
      content.includes('python') ||
      content.includes('javascript')
    ) {
      return 'Developer working on laptop showing code';
    }

    // Food/cooking
    if (content.includes('recipe') || content.includes('cooking'))
      return 'Delicious food dish';

    // Fitness
    if (content.includes('workout') || content.includes('fitness'))
      return 'Person doing exercise';

    // Business
    if (content.includes('business') || content.includes('finance'))
      return 'Professional in business setting';

    // Default
    return `${title.split(' ').slice(0, 3).join(' ')} scene`;
  }

  /**
   * Extract setting in simple terms
   */
  private static extractSetting(title: string, transcript: string): string {
    const content = `${title} ${transcript}`.toLowerCase();

    // Sports
    if (content.includes('football') || content.includes('soccer'))
      return 'on green football field';
    if (content.includes('basketball')) return 'on basketball court';
    if (content.includes('gym')) return 'in modern gym';

    // Tech
    if (content.includes('office') || content.includes('coding'))
      return 'in modern office';

    // Cooking
    if (content.includes('kitchen') || content.includes('cooking'))
      return 'in clean kitchen';

    // Outdoor
    if (content.includes('travel') || content.includes('outdoor'))
      return 'outdoors in nature';

    return 'in professional setting';
  }

  /**
   * Get specific lighting setup for better Flux results
   */
  private static getLighting(title: string, transcript: string): string {
    const content = `${title} ${transcript}`.toLowerCase();

    if (content.includes('gaming') || content.includes('tech')) {
      return 'dramatic RGB lighting with purple and cyan accents, volumetric light rays, neon glow effects';
    }

    if (content.includes('sport') || content.includes('action') || content.includes('fitness')) {
      return 'golden hour sunlight streaming through, high contrast lighting, dramatic shadows, warm backlight';
    }

    if (content.includes('business') || content.includes('finance')) {
      return 'soft professional LED lighting, clean highlights, subtle rim light, corporate atmosphere';
    }

    if (content.includes('food') || content.includes('cooking') || content.includes('recipe')) {
      return 'warm natural window light, soft diffused illumination, appetizing highlights, cozy ambiance';
    }

    if (content.includes('travel') || content.includes('nature') || content.includes('adventure')) {
      return 'epic sunset lighting with vibrant sky colors, dramatic cloud formations, cinematic landscape lighting';
    }

    if (content.includes('tutorial') || content.includes('education')) {
      return 'bright even lighting, clean and clear illumination, professional studio setup, no harsh shadows';
    }

    // Default cinematic
    return 'professional studio lighting with soft key light, subtle fill, dramatic rim light, cinematic three-point setup';
  }

  /**
   * Simple composition guidance
   */
  private static getCompositionGuidance(style: ThumbnailStyle): string {
    switch (style) {
      case ThumbnailStyle.BIG_BOLD_TEXT:
        return 'Subject centered, leave top 30% clear for text';

      case ThumbnailStyle.FACE_LEFT_TEXT_RIGHT:
        return 'Subject on left side, right 40% solid color background for text';

      case ThumbnailStyle.DOCUMENTARY_STORY:
        return 'Cinematic composition, subject in upper area, darker bottom for text';

      case ThumbnailStyle.BEFORE_AFTER:
        return 'Show contrast or transformation, leave center clear';

      case ThumbnailStyle.CENTER_OBJECT_MINIMAL:
        return 'Object centered on clean simple background, bottom area plain';

      case ThumbnailStyle.NEON_TECH:
        return 'Futuristic with cyan/magenta neon lights, subject centered';

      case ThumbnailStyle.REACTION_OBJECT:
        return 'Person with shocked/excited expression, top area clear';

      case ThumbnailStyle.TWO_TONE:
        return 'Split background two colors, subject in center';

      case ThumbnailStyle.BLUR_BACKGROUND_TEXT:
        return 'Slightly blurred subject, clean center for text';

      case ThumbnailStyle.MAGAZINE_STYLE:
        return 'Professional magazine photo, subject upper area, bottom clean';

      default:
        return 'Professional composition with space for text';
    }
  }
}
