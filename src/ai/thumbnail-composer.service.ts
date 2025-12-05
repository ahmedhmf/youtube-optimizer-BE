import { Injectable, Logger } from '@nestjs/common';
import { ThumbnailStyle } from './models/thumbnail.interface';
import {
  generateBigBoldText,
  generateFaceLeftTextRight,
  generateDocumentaryStory,
  generateBeforeAfter,
  generateCenterObjectMinimal,
  generateNeonTech,
  generateReactionObject,
  generateTwoTone,
  generateBlurBackgroundText,
  generateMagazineStyle,
} from './templates';

@Injectable()
export class ThumbnailComposerService {
  private readonly logger = new Logger(ThumbnailComposerService.name);

  /**
   * AI-based template selector
   * Analyzes video content to choose the most appropriate template
   */
  async selectTemplate(
    title: string,
    transcript: string,
    aiDescription?: string,
  ): Promise<ThumbnailStyle> {
    const content = `${title} ${transcript} ${aiDescription || ''}`.toLowerCase();

    // Documentary/Story (history, mysteries, documentary-style)
    if (
      /ancient.*egypt|pharaoh|pyramid|archaeology|history|documentary|true.*crime|mystery|unsolved|investigation|story.*of|legend|civilization/i.test(
        content,
      )
    ) {
      this.logger.log('Selected template: DOCUMENTARY_STORY');
      return ThumbnailStyle.DOCUMENTARY_STORY;
    }

    // Before/After (transformations, reviews, comparisons)
    if (
      /before.*after|transformation|makeover|review|vs|versus|comparison|upgrade|renovation|fitness.*journey|weight.*loss|progress/i.test(
        content,
      )
    ) {
      this.logger.log('Selected template: BEFORE_AFTER');
      return ThumbnailStyle.BEFORE_AFTER;
    }

    // Neon Tech (AI, tech, coding, gaming, futuristic)
    if (
      /\bai\b|artificial.*intelligence|machine.*learning|neural|algorithm|code|coding|programming|hack|cyber|futuristic|digital|blockchain|crypto.*tech|gpu|nvidia/i.test(
        content,
      )
    ) {
      this.logger.log('Selected template: NEON_TECH');
      return ThumbnailStyle.NEON_TECH;
    }

    // Face Left Text Right (commentary, reactions, personal branding, challenges)
    if (
      /reaction|react.*to|commentary|my.*opinion|vlog|challenge.*accept|personal.*story|why.*i|let's.*talk|face.*reveal/i.test(
        content,
      )
    ) {
      this.logger.log('Selected template: FACE_LEFT_TEXT_RIGHT');
      return ThumbnailStyle.FACE_LEFT_TEXT_RIGHT;
    }

    // Reaction Object (entertainment, surprising events)
    if (
      /shocking|unbelievable|can't.*believe|omg|wow|insane|crazy|wild|unexpected|surprise|look.*what.*happen|gone.*wrong/i.test(
        content,
      )
    ) {
      this.logger.log('Selected template: REACTION_OBJECT');
      return ThumbnailStyle.REACTION_OBJECT;
    }

    // Center Object Minimal (product reviews, travel, food, simple objects)
    if (
      /product.*review|unboxing|travel.*to|food.*review|recipe|artifact|object|item|device|gadget|showcase/i.test(
        content,
      )
    ) {
      this.logger.log('Selected template: CENTER_OBJECT_MINIMAL');
      return ThumbnailStyle.CENTER_OBJECT_MINIMAL;
    }

    // Magazine Style (lifestyle, interviews, premium content)
    if (
      /interview|lifestyle|fashion|photography|influencer|premium|exclusive|magazine|profile|feature|spotlight/i.test(
        content,
      )
    ) {
      this.logger.log('Selected template: MAGAZINE_STYLE');
      return ThumbnailStyle.MAGAZINE_STYLE;
    }

    // Two Tone (clean tutorials, education, finance, presentations)
    if (
      /tutorial|how.*to.*\w+|step.*by.*step|guide|lesson|course|presentation|finance|business.*strategy|explained/i.test(
        content,
      )
    ) {
      this.logger.log('Selected template: TWO_TONE');
      return ThumbnailStyle.TWO_TONE;
    }

    // Blur Background Text (explainers, commentary without face, minimalistic)
    if (
      /explain|explainer|what.*is|definition|concept|theory|minimalist|simple|clean|basics|introduction/i.test(
        content,
      )
    ) {
      this.logger.log('Selected template: BLUR_BACKGROUND_TEXT');
      return ThumbnailStyle.BLUR_BACKGROUND_TEXT;
    }

    // Default to Big Bold Text (tutorials, business, education, general purpose)
    this.logger.log('Selected template: BIG_BOLD_TEXT (default)');
    return ThumbnailStyle.BIG_BOLD_TEXT;
  }

  /**
   * Compose thumbnail with selected template
   */
  async composeThumbnail(
    backgroundBuffer: Buffer,
    title: string,
    transcript: string,
    style?: ThumbnailStyle,
    aiDescription?: string,
  ): Promise<Buffer> {
    try {
      // Auto-select template if not provided
      const selectedStyle =
        style || (await this.selectTemplate(title, transcript, aiDescription));

      this.logger.log(
        `Composing thumbnail with style: ${selectedStyle} for title: "${title}"`,
      );

      // Route to appropriate template generator
      switch (selectedStyle) {
        case ThumbnailStyle.BIG_BOLD_TEXT:
          return await generateBigBoldText({
            title,
            backgroundImageBuffer: backgroundBuffer,
          });

        case ThumbnailStyle.FACE_LEFT_TEXT_RIGHT:
          return await generateFaceLeftTextRight({
            title,
            backgroundImageBuffer: backgroundBuffer,
          });

        case ThumbnailStyle.DOCUMENTARY_STORY:
          return await generateDocumentaryStory({
            title,
            backgroundImageBuffer: backgroundBuffer,
          });

        case ThumbnailStyle.BEFORE_AFTER:
          return await generateBeforeAfter({
            title,
            backgroundImageBuffer: backgroundBuffer,
          });

        case ThumbnailStyle.CENTER_OBJECT_MINIMAL:
          return await generateCenterObjectMinimal({
            title,
            backgroundImageBuffer: backgroundBuffer,
          });

        case ThumbnailStyle.NEON_TECH:
          return await generateNeonTech({
            title,
            backgroundImageBuffer: backgroundBuffer,
          });

        case ThumbnailStyle.REACTION_OBJECT:
          return await generateReactionObject({
            title,
            backgroundImageBuffer: backgroundBuffer,
          });

        case ThumbnailStyle.TWO_TONE:
          return await generateTwoTone({
            title,
            backgroundImageBuffer: backgroundBuffer,
          });

        case ThumbnailStyle.BLUR_BACKGROUND_TEXT:
          return await generateBlurBackgroundText({
            title,
            backgroundImageBuffer: backgroundBuffer,
          });

        case ThumbnailStyle.MAGAZINE_STYLE:
          return await generateMagazineStyle({
            title,
            backgroundImageBuffer: backgroundBuffer,
          });

        default:
          // Fallback to big bold text
          return await generateBigBoldText({
            title,
            backgroundImageBuffer: backgroundBuffer,
          });
      }
    } catch (error) {
      this.logger.error('Failed to compose thumbnail', error);
      throw new Error(
        `Thumbnail composition failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
