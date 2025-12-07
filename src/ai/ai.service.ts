// apps/api/src/modules/ai/ai.service.ts
import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import type {
  TitleRewriteResult,
  DescriptionRewriteResult,
  KeywordExtractionResult,
  ChaptersResult,
  ThumbnailIdeaResult,
  VideoAnalysisResult,
  ThumbnailGenerationResult,
} from './models/ai.types';
import * as fs from 'node:fs';
import { PromptsService } from './prompts.service';
import { ThumbnailComposerService } from './thumbnail-composer.service';
import { ThumbnailPromptsService } from './thumbnail-prompts.service';
import { ThumbnailEnhancementService } from './thumbnail-enhancement.service';
import { ThumbnailAssetsComposerService } from './thumbnail-assets-composer.service';
import { SystemLogService } from '../logging/services/system-log.service';
import { LogSeverity, SystemLogCategory } from '../logging/dto/log.types';
import { UserPreferencesService } from '../user-preferences/user-preferences.service';
import { NotificationService } from '../notifications/notification.service';
import {
  NotificationType,
  NotificationSeverity,
} from '../notifications/models/notification.types';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly openai: OpenAI;
  private readonly fireworksApiKey: string;
  private readonly fireworksBaseUrl = 'https://api.fireworks.ai/inference/v1';

  constructor(
    private readonly systemLogService: SystemLogService,
    private readonly userPreferencesService: UserPreferencesService,
    private readonly notificationService: NotificationService,
    private readonly supabaseService: SupabaseService,
    private readonly thumbnailComposerService: ThumbnailComposerService,
    private readonly thumbnailAssetsComposerService: ThumbnailAssetsComposerService,
  ) {
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    this.fireworksApiKey = process.env.FIREWORKS_API_KEY || '';
    if (!this.fireworksApiKey) {
      this.logger.warn(
        'FIREWORKS_API_KEY not set, thumbnail generation will fail',
      );
    }
  }

  /**
   * Helper method to safely extract and parse JSON from AI response
   */
  private parseAIResponse<T>(text: string): T {
    const jsonStart = text.indexOf('{');
    const jsonEnd = text.lastIndexOf('}');
    const jsonStr = text.slice(jsonStart, jsonEnd + 1);
    return JSON.parse(jsonStr) as T;
  }

  async transcribeLocalFile(tmpPath: string): Promise<string> {
    const startTime = Date.now();
    try {
      const fileStream = fs.createReadStream(tmpPath);
      const res = await this.openai.audio.transcriptions.create({
        file: fileStream,
        model: 'whisper-1',
        // language: 'en',  // optionally force language
        // response_format: 'json',
      });

      const responseTime = Date.now() - startTime;
      await this.systemLogService.logSystem({
        logLevel: LogSeverity.INFO,
        category: SystemLogCategory.NETWORK,
        serviceName: 'AiService',
        message: 'OpenAI API call successful - transcribeLocalFile',
        details: {
          model: 'whisper-1',
          filePath: tmpPath,
          transcriptLength: res.text?.length,
          responseTimeMs: responseTime,
        },
      });

      return res.text ?? '';
    } catch (error) {
      const responseTime = Date.now() - startTime;
      await this.systemLogService.logSystem({
        logLevel: LogSeverity.ERROR,
        category: SystemLogCategory.NETWORK,
        serviceName: 'AiService',
        message: 'OpenAI API call failed - transcribeLocalFile',
        details: {
          model: 'whisper-1',
          filePath: tmpPath,
          responseTimeMs: responseTime,
          error: error instanceof Error ? error.message : String(error),
        },
        stackTrace: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  async summarizeTranscript(transcript: string): Promise<string> {
    const startTime = Date.now();
    try {
      const sys = `You are a YouTube content strategist. 
        Summarize the transcript into 5 bullet points capturing topic, angle, value, and notable moments.`;
      const out = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: sys },
          { role: 'user', content: transcript.slice(0, 15000) },
        ],
        temperature: 0.3,
      });

      const responseTime = Date.now() - startTime;
      await this.systemLogService.logSystem({
        logLevel: LogSeverity.INFO,
        category: SystemLogCategory.NETWORK,
        serviceName: 'AiService',
        message: 'OpenAI API call successful - summarizeTranscript',
        details: {
          model: 'gpt-4o-mini',
          transcriptLength: transcript.length,
          promptTokens: out.usage?.prompt_tokens,
          completionTokens: out.usage?.completion_tokens,
          totalTokens: out.usage?.total_tokens,
          responseTimeMs: responseTime,
        },
      });

      return out.choices[0].message?.content ?? '';
    } catch (error) {
      const responseTime = Date.now() - startTime;
      await this.systemLogService.logSystem({
        logLevel: LogSeverity.ERROR,
        category: SystemLogCategory.NETWORK,
        serviceName: 'AiService',
        message: 'OpenAI API call failed - summarizeTranscript',
        details: {
          model: 'gpt-4o-mini',
          transcriptLength: transcript.length,
          responseTimeMs: responseTime,
          error: error instanceof Error ? error.message : String(error),
        },
        stackTrace: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  /**
   * Select thumbnail template based on video content
   */
  async selectThumbnailTemplate(
    title: string,
    transcript: string,
  ): Promise<string> {
    const template = await this.thumbnailComposerService.selectTemplate(
      title,
      transcript,
    );
    return template;
  }

  // ============================================
  // NEW 7-PART VIDEO ANALYSIS METHODS
  // ============================================

  /**
   * 1. Title Rewrite - Generate optimized title options
   */
  async generateTitleRewrite(
    userId: string,
    transcript: string,
    originalTitle: string,
    languageOverride?: string,
    toneOverride?: string,
  ): Promise<TitleRewriteResult> {
    const startTime = Date.now();
    try {
      // Fetch user preferences
      const preferences =
        await this.userPreferencesService.getPreferences(userId);

      // Apply fallback chain: override params → saved preferences → defaults
      const language = languageOverride ?? preferences?.language ?? 'en';
      const tone = toneOverride ?? preferences?.tone ?? 'professional';
      const customInstructions = preferences?.customInstructions;

      // Send notification if using defaults due to missing preferences
      if (!preferences?.isCompleted && !languageOverride && !toneOverride) {
        await this.notificationService.sendNotification(
          userId,
          'Setup Content Preferences',
          'Using default settings for title generation. Setup your preferences for personalized content.',
          NotificationType.SYSTEM,
          {},
          NotificationSeverity.INFO,
          '/settings/content-preferences',
          'Setup Now',
        );
      }

      const prompt = PromptsService.getTitleRewritePrompt(
        transcript,
        language,
        tone,
        originalTitle,
        customInstructions,
      );

      const res = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.8,
      });

      const text = res.choices[0].message?.content ?? '{}';
      this.logger.log(`Title rewrite AI response: ${text.substring(0, 500)}`);

      const parsed = this.parseAIResponse<TitleRewriteResult>(text);
      this.logger.log(`Parsed titles count: ${parsed.titles?.length ?? 0}`);

      const responseTime = Date.now() - startTime;
      await this.systemLogService.logSystem({
        logLevel: LogSeverity.INFO,
        category: SystemLogCategory.NETWORK,
        serviceName: 'AiService',
        message: 'OpenAI API call successful - generateTitleRewrite',
        details: {
          model: 'gpt-4o-mini',
          transcriptLength: transcript.length,
          promptTokens: res.usage?.prompt_tokens,
          completionTokens: res.usage?.completion_tokens,
          totalTokens: res.usage?.total_tokens,
          responseTimeMs: responseTime,
          titlesGenerated: parsed.titles?.length ?? 0,
        },
      });

      return {
        titles: parsed.titles ?? [],
        reasoning: parsed.reasoning,
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      await this.systemLogService.logSystem({
        logLevel: LogSeverity.ERROR,
        category: SystemLogCategory.NETWORK,
        serviceName: 'AiService',
        message: 'OpenAI API call failed - generateTitleRewrite',
        details: {
          model: 'gpt-4o-mini',
          transcriptLength: transcript.length,
          responseTimeMs: responseTime,
          error: error instanceof Error ? error.message : String(error),
        },
        stackTrace: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  /**
   * 2. Description Rewrite - Generate SEO-optimized description
   */
  async generateDescriptionRewrite(
    userId: string,
    transcript: string,
    languageOverride?: string,
  ): Promise<DescriptionRewriteResult> {
    const startTime = Date.now();
    try {
      // Fetch user preferences
      const preferences =
        await this.userPreferencesService.getPreferences(userId);

      // Apply fallback chain: override param → saved preference → default
      const language = languageOverride ?? preferences?.language ?? 'en';
      const tone = preferences?.tone;
      const customInstructions = preferences?.customInstructions;

      // Send notification if using defaults due to missing preferences
      if (!preferences?.isCompleted && !languageOverride) {
        await this.notificationService.sendNotification(
          userId,
          'Setup Content Preferences',
          'Using default language for description. Setup your preferences for personalized content.',
          NotificationType.SYSTEM,
          {},
          NotificationSeverity.INFO,
          '/settings/content-preferences',
          'Setup Now',
        );
      }

      const prompt = PromptsService.getDescriptionRewritePrompt(
        transcript,
        language,
        tone,
        customInstructions,
      );

      const res = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
      });

      const text = res.choices[0].message?.content ?? '{}';
      const jsonStart = text.indexOf('{');
      const jsonEnd = text.lastIndexOf('}');
      const parsed = JSON.parse(
        text.slice(jsonStart, jsonEnd + 1),
      ) as DescriptionRewriteResult;

      const responseTime = Date.now() - startTime;
      await this.systemLogService.logSystem({
        logLevel: LogSeverity.INFO,
        category: SystemLogCategory.NETWORK,
        serviceName: 'AiService',
        message: 'OpenAI API call successful - generateDescriptionRewrite',
        details: {
          model: 'gpt-4o-mini',
          transcriptLength: transcript.length,
          promptTokens: res.usage?.prompt_tokens,
          completionTokens: res.usage?.completion_tokens,
          totalTokens: res.usage?.total_tokens,
          responseTimeMs: responseTime,
        },
      });

      return {
        description: parsed.description ?? '',
        hashtags: parsed.hashtags ?? [],
        keyPoints: parsed.keyPoints ?? [],
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      await this.systemLogService.logSystem({
        logLevel: LogSeverity.ERROR,
        category: SystemLogCategory.NETWORK,
        serviceName: 'AiService',
        message: 'OpenAI API call failed - generateDescriptionRewrite',
        details: {
          model: 'gpt-4o-mini',
          transcriptLength: transcript.length,
          responseTimeMs: responseTime,
          error: error instanceof Error ? error.message : String(error),
        },
        stackTrace: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  /**
   * Detect video category based on title, description, and transcript
   */
  async detectVideoCategory(
    userId: string,
    title: string,
    description: string,
    transcript: string,
  ): Promise<string> {
    const startTime = Date.now();
    try {
      const prompt = `Analyze this YouTube video and determine the most appropriate category.

Video Title: ${title}
Video Description: ${description.slice(0, 500)}
Transcript Sample: ${transcript.slice(0, 2000)}

Categories to choose from:
- Education
- Entertainment
- Gaming
- Technology
- Music
- Sports
- News
- Comedy
- Lifestyle
- Tutorial
- Review
- Vlog
- Documentary
- Science
- Health & Fitness
- Cooking
- Travel
- Business
- Finance
- Arts & Crafts

Respond with ONLY the category name, nothing else.`;

      const res = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
      });

      const category = (res.choices[0].message?.content ?? 'General').trim();

      const responseTime = Date.now() - startTime;
      await this.systemLogService.logSystem({
        logLevel: LogSeverity.INFO,
        category: SystemLogCategory.NETWORK,
        serviceName: 'AiService',
        message: 'OpenAI API call successful - detectVideoCategory',
        details: {
          model: 'gpt-4o-mini',
          videoTitle: title,
          detectedCategory: category,
          promptTokens: res.usage?.prompt_tokens,
          completionTokens: res.usage?.completion_tokens,
          totalTokens: res.usage?.total_tokens,
          responseTimeMs: responseTime,
        },
      });

      return category;
    } catch (error) {
      const responseTime = Date.now() - startTime;
      await this.systemLogService.logSystem({
        logLevel: LogSeverity.ERROR,
        category: SystemLogCategory.NETWORK,
        serviceName: 'AiService',
        message: 'OpenAI API call failed - detectVideoCategory',
        details: {
          model: 'gpt-4o-mini',
          videoTitle: title,
          responseTimeMs: responseTime,
          error: error instanceof Error ? error.message : String(error),
        },
        stackTrace: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  /**
   * 3. Keyword Extraction - Extract and categorize keywords
   */
  async extractKeywords(transcript: string): Promise<KeywordExtractionResult> {
    const startTime = Date.now();
    try {
      const prompt = PromptsService.getKeywordExtractionPrompt(transcript);

      const res = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.5,
      });

      const text = res.choices[0].message?.content ?? '{}';
      const jsonStart = text.indexOf('{');
      const jsonEnd = text.lastIndexOf('}');
      const parsed = JSON.parse(
        text.slice(jsonStart, jsonEnd + 1),
      ) as KeywordExtractionResult;

      const responseTime = Date.now() - startTime;
      await this.systemLogService.logSystem({
        logLevel: LogSeverity.INFO,
        category: SystemLogCategory.NETWORK,
        serviceName: 'AiService',
        message: 'OpenAI API call successful - extractKeywords',
        details: {
          model: 'gpt-4o-mini',
          transcriptLength: transcript.length,
          promptTokens: res.usage?.prompt_tokens,
          completionTokens: res.usage?.completion_tokens,
          totalTokens: res.usage?.total_tokens,
          responseTimeMs: responseTime,
        },
      });

      return {
        primaryKeywords: parsed.primaryKeywords ?? [],
        longTailKeywords: parsed.longTailKeywords ?? [],
        trendingKeywords: parsed.trendingKeywords ?? [],
        competitorKeywords: parsed.competitorKeywords ?? [],
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      await this.systemLogService.logSystem({
        logLevel: LogSeverity.ERROR,
        category: SystemLogCategory.NETWORK,
        serviceName: 'AiService',
        message: 'OpenAI API call failed - extractKeywords',
        details: {
          model: 'gpt-4o-mini',
          transcriptLength: transcript.length,
          responseTimeMs: responseTime,
          error: error instanceof Error ? error.message : String(error),
        },
        stackTrace: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  /**
   * 4. Chapters Generation - Create timestamp chapters
   */
  async generateChapters(transcript: string): Promise<ChaptersResult> {
    const startTime = Date.now();
    try {
      const prompt = PromptsService.getChaptersPrompt(transcript);

      const res = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.6,
      });

      const text = res.choices[0].message?.content ?? '{}';
      const jsonStart = text.indexOf('{');
      const jsonEnd = text.lastIndexOf('}');
      const parsed = JSON.parse(
        text.slice(jsonStart, jsonEnd + 1),
      ) as ChaptersResult;

      const responseTime = Date.now() - startTime;
      await this.systemLogService.logSystem({
        logLevel: LogSeverity.INFO,
        category: SystemLogCategory.NETWORK,
        serviceName: 'AiService',
        message: 'OpenAI API call successful - generateChapters',
        details: {
          model: 'gpt-4o-mini',
          transcriptLength: transcript.length,
          promptTokens: res.usage?.prompt_tokens,
          completionTokens: res.usage?.completion_tokens,
          totalTokens: res.usage?.total_tokens,
          responseTimeMs: responseTime,
        },
      });

      return {
        chapters: parsed.chapters ?? [],
        totalDuration: parsed.totalDuration,
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      await this.systemLogService.logSystem({
        logLevel: LogSeverity.ERROR,
        category: SystemLogCategory.NETWORK,
        serviceName: 'AiService',
        message: 'OpenAI API call failed - generateChapters',
        details: {
          model: 'gpt-4o-mini',
          transcriptLength: transcript.length,
          responseTimeMs: responseTime,
          error: error instanceof Error ? error.message : String(error),
        },
        stackTrace: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  /**
   * 5. Thumbnail Ideas - Generate thumbnail concepts
   */
  async generateThumbnailIdeas(
    userId: string,
    transcript: string,
    thumbnailStyleOverride?: string,
  ): Promise<ThumbnailIdeaResult[]> {
    const startTime = Date.now();
    try {
      // Fetch user preferences
      const preferences =
        await this.userPreferencesService.getPreferences(userId);

      // Apply fallback chain: override param → saved preference → undefined (no default)
      const thumbnailStyle =
        thumbnailStyleOverride ?? preferences?.thumbnailStyle;
      const customInstructions = preferences?.customInstructions;

      // Send notification if using no style due to missing preferences
      if (!preferences?.isCompleted && !thumbnailStyleOverride) {
        await this.notificationService.sendNotification(
          userId,
          'Setup Content Preferences',
          'Setup your thumbnail style preference for personalized thumbnail ideas.',
          NotificationType.SYSTEM,
          {},
          NotificationSeverity.INFO,
          '/settings/content-preferences',
          'Setup Now',
        );
      }

      const prompt = PromptsService.getThumbnailIdeaPrompt(
        transcript,
        thumbnailStyle,
        customInstructions,
      );

      const res = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.9,
      });

      const text = res.choices[0].message?.content ?? '{}';
      const jsonStart = text.indexOf('{');
      const jsonEnd = text.lastIndexOf('}');
      const parsed = JSON.parse(
        text.slice(jsonStart, jsonEnd + 1),
      ) as ThumbnailGenerationResult;

      const responseTime = Date.now() - startTime;
      await this.systemLogService.logSystem({
        logLevel: LogSeverity.INFO,
        category: SystemLogCategory.NETWORK,
        serviceName: 'AiService',
        message: 'OpenAI API call successful - generateThumbnailIdeas',
        details: {
          model: 'gpt-4o-mini',
          transcriptLength: transcript.length,
          promptTokens: res.usage?.prompt_tokens,
          completionTokens: res.usage?.completion_tokens,
          totalTokens: res.usage?.total_tokens,
          responseTimeMs: responseTime,
        },
      });

      return parsed.ideas ?? [];
    } catch (error) {
      const responseTime = Date.now() - startTime;
      await this.systemLogService.logSystem({
        logLevel: LogSeverity.ERROR,
        category: SystemLogCategory.NETWORK,
        serviceName: 'AiService',
        message: 'OpenAI API call failed - generateThumbnailIdeas',
        details: {
          model: 'gpt-4o-mini',
          transcriptLength: transcript.length,
          responseTimeMs: responseTime,
          error: error instanceof Error ? error.message : String(error),
        },
        stackTrace: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  /**
   * 6. Thumbnail AI Prompts - Generate single optimized AI image generation prompt
   * Optionally analyzes existing YouTube thumbnail for better context
   */
  async generateThumbnailAIPrompts(
    userId: string,
    transcript: string,
    imageStyleOverride?: string,
    existingThumbnailUrl?: string,
    videoTitle?: string,
  ): Promise<string[]> {
    const startTime = Date.now();
    try {
      // Fetch user preferences
      const preferences =
        await this.userPreferencesService.getPreferences(userId);

      // Apply fallback chain: override param → saved preference → undefined (no default)
      const imageStyle = imageStyleOverride ?? preferences?.imageStyle;
      const customInstructions = preferences?.customInstructions;

      // Send notification if using no style due to missing preferences
      if (!preferences?.isCompleted && !imageStyleOverride) {
        await this.notificationService.sendNotification(
          userId,
          'Setup Content Preferences',
          'Setup your image style preference for personalized AI thumbnail prompts.',
          NotificationType.SYSTEM,
          {},
          NotificationSeverity.INFO,
          '/settings/content-preferences',
          'Setup Now',
        );
      }

      // If YouTube video URL is provided, extract and analyze video frames
      let visualContext = '';
      if (existingThumbnailUrl) {
        try {
          // Extract video ID from thumbnail URL or use it directly
          // YouTube thumbnail URLs are like: https://i.ytimg.com/vi/VIDEO_ID/...
          const videoIdMatch = existingThumbnailUrl.match(/\/vi\/([^/]+)\//);

          if (videoIdMatch) {
            const videoId = videoIdMatch[1];

            // Construct URLs for multiple video frames from YouTube
            // YouTube provides frame images at different timestamps
            const frameUrls = [
              `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`, // High quality frame
              `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`, // Frame 1
            ];

            // Download images and convert to base64 data URLs
            const frameDataUrls: string[] = [];
            for (const url of frameUrls) {
              try {
                const response = await fetch(url);
                if (response.ok) {
                  const arrayBuffer = await response.arrayBuffer();
                  const buffer = Buffer.from(arrayBuffer);
                  const base64 = buffer.toString('base64');
                  frameDataUrls.push(`data:image/jpeg;base64,${base64}`);
                }
              } catch (fetchError) {
                this.logger.warn(
                  `Failed to download frame: ${url}`,
                  fetchError,
                );
              }
            }

            if (frameDataUrls.length === 0) {
              throw new Error('Could not download any video frames');
            }

            // Build content array with text and images
            const contentArray: any[] = [
              {
                type: 'text',
                text: `Analyze these YouTube video frames in detail to help create a thumbnail. Focus on visual elements (DO NOT try to identify specific individuals):

1. SCENE & COMPOSITION:
   - What type of scene is this? (indoor/outdoor, studio, office, kitchen, etc.)
   - Camera angle and framing (close-up, wide shot, overhead, etc.)
   - Subject positioning and composition rules used
   - Foreground and background elements

2. VISUAL ELEMENTS:
   - Objects, products, tools, technology visible (be specific: laptop model, phone type, equipment)
   - Text, graphics, or overlays shown in the frame
   - Any brands, logos, or recognizable items
   - Props and accessories

3. PEOPLE (General Description ONLY - no identification):
   - Number of people visible
   - General positioning and poses (pointing, gesturing, looking at camera, etc.)
   - Clothing colors and style (casual, professional, sportswear, etc.)
   - Body language and energy level (excited, calm, focused, etc.)
   - If showing hands/actions - what are they doing?

4. COLORS & LIGHTING:
   - Dominant color palette (specific shades)
   - Color temperature (warm/cool tones)
   - Lighting setup (front-lit, side-lit, dramatic shadows, soft lighting)
   - Contrast levels and saturation

5. STYLE & MOOD:
   - Video category (tech, gaming, cooking, fitness, education, etc.)
   - Production quality (professional studio, home setup, casual vlog)
   - Overall mood and energy (energetic, calm, dramatic, fun)
   - Visual effects or filters used

Provide detailed descriptions focusing on these visual elements to recreate the style and composition for a new thumbnail.`,
              },
            ];

            // Add downloaded frames as base64 data URLs
            for (const dataUrl of frameDataUrls) {
              contentArray.push({
                type: 'image_url',
                image_url: {
                  url: dataUrl,
                  detail: 'high',
                },
              });
            }

            // Analyze frames with GPT-4 Vision
            const visionResponse = await this.openai.chat.completions.create({
              model: 'gpt-4o',
              messages: [
                {
                  role: 'user',
                  content: contentArray,
                },
              ],
              max_tokens: 800,
            });

            visualContext = visionResponse.choices[0].message?.content ?? '';
            this.logger.log(
              `Analyzed video frames for context: ${visualContext.slice(0, 150)}...`,
            );
          } else {
            // Fallback: analyze the thumbnail itself (download and convert to base64)
            const response = await fetch(existingThumbnailUrl);
            if (!response.ok) {
              throw new Error('Could not download thumbnail image');
            }
            const arrayBuffer = await response.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            const base64 = buffer.toString('base64');
            const dataUrl = `data:image/jpeg;base64,${base64}`;

            const visionResponse = await this.openai.chat.completions.create({
              model: 'gpt-4o',
              messages: [
                {
                  role: 'user',
                  content: [
                    {
                      type: 'text',
                      text: 'Analyze this YouTube thumbnail for visual details to create a similar thumbnail. Focus on: scene composition, objects/products visible, text/graphics, color scheme, lighting setup, camera angle, and overall style. For people: describe poses, clothing colors/style, and actions WITHOUT identifying them. Be extremely specific about visual elements.',
                    },
                    {
                      type: 'image_url',
                      image_url: {
                        url: dataUrl,
                        detail: 'high',
                      },
                    },
                  ],
                },
              ],
              max_tokens: 600,
            });

            visualContext = visionResponse.choices[0].message?.content ?? '';
            this.logger.log(
              `Analyzed thumbnail for context: ${visualContext.slice(0, 150)}...`,
            );
          }
        } catch (visionError) {
          this.logger.warn(
            'Failed to analyze video frames/thumbnail, proceeding without visual context',
            visionError,
          );
        }
      }

      const prompt = PromptsService.getThumbnailAIPrompt(
        transcript,
        imageStyle || 'photorealistic',
        videoTitle,
        customInstructions,
      );

      // Use GPT-4o (not mini) for better quality prompt generation
      const res = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7, // Lower temp for more focused, consistent prompts
      });

      const text = res.choices[0].message?.content ?? '{}';
      const jsonStart = text.indexOf('{');
      const jsonEnd = text.lastIndexOf('}');
      const parsed = JSON.parse(text.slice(jsonStart, jsonEnd + 1)) as {
        aiPrompt?: string;
      };

      // Log the generated prompt for debugging
      if (parsed.aiPrompt) {
        this.logger.log(
          `Generated DALL-E prompt (${parsed.aiPrompt.length} chars): ${parsed.aiPrompt}`,
        );
      }

      const responseTime = Date.now() - startTime;
      await this.systemLogService.logSystem({
        logLevel: LogSeverity.INFO,
        category: SystemLogCategory.NETWORK,
        serviceName: 'AiService',
        message: 'OpenAI API call successful - generateThumbnailAIPrompts',
        details: {
          model: 'gpt-4o',
          transcriptLength: transcript.length,
          videoTitle: videoTitle,
          promptTokens: res.usage?.prompt_tokens,
          completionTokens: res.usage?.completion_tokens,
          totalTokens: res.usage?.total_tokens,
          responseTimeMs: responseTime,
          generatedPromptLength: parsed.aiPrompt?.length ?? 0,
        },
      });

      // Return as array with single prompt for backward compatibility
      return parsed.aiPrompt ? [parsed.aiPrompt] : [];
    } catch (error) {
      const responseTime = Date.now() - startTime;
      await this.systemLogService.logSystem({
        logLevel: LogSeverity.ERROR,
        category: SystemLogCategory.NETWORK,
        serviceName: 'AiService',
        message: 'OpenAI API call failed - generateThumbnailAIPrompts',
        details: {
          model: 'gpt-4o',
          transcriptLength: transcript.length,
          videoTitle: videoTitle,
          responseTimeMs: responseTime,
          error: error instanceof Error ? error.message : String(error),
        },
        stackTrace: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  /**
   * 7A. Generate Thumbnail Background Only - For Frontend Composition
   * Returns enhanced background with placeholders for text/images/logos
   */
  async generateThumbnailBackground(
    userId: string,
    aiPrompt: string,
    videoId: string,
    videoTitle?: string,
    transcript?: string,
  ): Promise<{
    backgroundUrl: string;
    template: string;
    enhancementStyle: string;
    placeholders: Array<{
      type: 'text' | 'image' | 'logo';
      id: string;
      x: number;
      y: number;
      width: number;
      height: number;
      zIndex: number;
    }>;
  }> {
    const startTime = Date.now();
    try {
      this.logger.log(
        `Generating thumbnail background for video: ${videoTitle || videoId}`,
      );

      // Step 1: Select template based on video content
      let selectedTemplate = 'BIG_BOLD_TEXT'; // Default
      let customPrompt = aiPrompt;

      if (videoTitle && transcript) {
        selectedTemplate = await this.thumbnailComposerService.selectTemplate(
          videoTitle,
          transcript,
        );
        this.logger.log(`Selected template: ${selectedTemplate}`);

        customPrompt = ThumbnailPromptsService.generateBackgroundPrompt(
          videoTitle,
          transcript,
          selectedTemplate as any,
        );
      }

      // Step 2: Generate background using Fireworks AI Flux (1792x1024)
      this.logger.log('Generating base image with Fireworks AI Flux...');
      this.logger.log(`Prompt: ${customPrompt}`);
      
      const fireworksResponse = await fetch(
        'https://api.fireworks.ai/inference/v1/workflows/accounts/fireworks/models/flux-1-schnell-fp8/text_to_image',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.fireworksApiKey}`,
            Accept: 'image/jpeg',
          },
          body: JSON.stringify({
            prompt: customPrompt,
            negative_prompt: 'blurry, low quality, distorted, deformed, ugly, bad anatomy, watermark, text, letters, words, signature, username, logo, people faces in focus, human subjects, cartoon, anime, illustration, painting',
            guidance_scale: 7.5,
            num_inference_steps: 30,
          }),
        },
      );

      if (!fireworksResponse.ok) {
        const errorText = await fireworksResponse.text();
        this.logger.error(`Fireworks API error: ${errorText}`);
        throw new Error(
          `Fireworks AI request failed: ${fireworksResponse.status} ${errorText}`,
        );
      }

      const baseBuffer = Buffer.from(await fireworksResponse.arrayBuffer());

      if (!baseBuffer || baseBuffer.length === 0) {
        throw new Error('No valid image returned from Fireworks AI');
      }

      this.logger.log('Successfully generated base image');

      // Step 3: Apply professional post-processing
      const enhancementStyle =
        ThumbnailEnhancementService.detectStyleFromContent(
          videoTitle || '',
          transcript || '',
        );

      const enhancedBuffer =
        await ThumbnailEnhancementService.enhanceBackground(
          baseBuffer,
          enhancementStyle as any,
        );

      this.logger.log(
        `Enhanced background with ${enhancementStyle} style post-processing`,
      );

      // Step 4: Upload background to Supabase
      const fileName = `thumbnails/${userId}/${videoId}_bg_${Date.now()}.png`;
      const supabase = this.supabaseService.getServiceClient();

      const { error: uploadError } = await supabase.storage
        .from('thumbnails')
        .upload(fileName, enhancedBuffer, {
          contentType: 'image/png',
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) {
        throw new Error(`Storage upload failed: ${uploadError.message}`);
      }

      const { data: publicUrlData } = supabase.storage
        .from('thumbnails')
        .getPublicUrl(fileName);

      const backgroundUrl = publicUrlData.publicUrl;
      this.logger.log(`Background uploaded: ${backgroundUrl}`);

      // Generate placeholders based on template
      const placeholders = this.generatePlaceholders(selectedTemplate);

      const responseTime = Date.now() - startTime;
      await this.systemLogService.logSystem({
        logLevel: LogSeverity.INFO,
        category: SystemLogCategory.NETWORK,
        serviceName: 'AiService',
        message: 'Thumbnail background generated successfully',
        details: {
          model: 'fireworks-flux-schnell',
          userId,
          videoId,
          template: selectedTemplate,
          enhancementStyle,
          responseTimeMs: responseTime,
        },
      });

      return {
        backgroundUrl,
        template: selectedTemplate,
        enhancementStyle,
        placeholders,
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      await this.systemLogService.logSystem({
        logLevel: LogSeverity.ERROR,
        category: SystemLogCategory.NETWORK,
        serviceName: 'AiService',
        message: 'Failed to generate thumbnail background',
        details: {
          userId,
          videoId,
          responseTimeMs: responseTime,
          error: error instanceof Error ? error.message : String(error),
        },
        stackTrace: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  /**
   * Generate complete thumbnail with user-provided assets
   */
  async generateCompleteThumbnail(
    userId: string,
    videoId: string,
    videoTitle: string,
    transcript: string,
    template: string,
    templateData: Record<string, any>,
    brandLogo?: {
      url: string;
      position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
      size: 'small' | 'medium' | 'large';
    },
    watermark?: string,
  ): Promise<string> {
    const startTime = Date.now();
    try {
      this.logger.log(
        `Generating complete thumbnail for video: ${videoTitle}, template: ${template}`,
      );

      // Step 1: Generate background prompt
      const backgroundPrompt = ThumbnailPromptsService.generateBackgroundPrompt(
        videoTitle,
        transcript,
        template as any,
      );

      // Step 2: Generate base background with Fireworks AI
      this.logger.log('Generating base background...');
      this.logger.log(`Prompt: ${backgroundPrompt}`);
      
      const fireworksResponse = await fetch(
        'https://api.fireworks.ai/inference/v1/workflows/accounts/fireworks/models/flux-1-schnell-fp8/text_to_image',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.fireworksApiKey}`,
            Accept: 'image/jpeg',
          },
          body: JSON.stringify({
            prompt: backgroundPrompt,
            negative_prompt: 'blurry, low quality, distorted, deformed, ugly, bad anatomy, watermark, text, letters, words, signature, username, logo, people faces in focus, human subjects, cartoon, anime, illustration, painting',
            guidance_scale: 7.5,
            num_inference_steps: 30,
          }),
        },
      );

      if (!fireworksResponse.ok) {
        const errorText = await fireworksResponse.text();
        throw new Error(
          `Fireworks AI request failed: ${fireworksResponse.status} ${errorText}`,
        );
      }

      const baseBuffer = Buffer.from(await fireworksResponse.arrayBuffer());

      // Step 3: Apply professional enhancement
      const enhancementStyle =
        ThumbnailEnhancementService.detectStyleFromContent(
          videoTitle,
          transcript,
        );

      const enhancedBuffer =
        await ThumbnailEnhancementService.enhanceBackground(
          baseBuffer,
          enhancementStyle as any,
        );

      this.logger.log('Enhanced background generated');

      // Step 4: Compose with user assets
      this.logger.log('Composing with user assets...');
      const finalBuffer = await this.thumbnailAssetsComposerService.composeWithAssets(
        enhancedBuffer,
        template,
        templateData,
        brandLogo,
        watermark,
      );

      // Step 5: Upload to Supabase
      const fileName = `thumbnails/${userId}/${videoId}_complete_${Date.now()}.png`;
      const supabase = this.supabaseService.getServiceClient();

      const { error: uploadError } = await supabase.storage
        .from('thumbnails')
        .upload(fileName, finalBuffer, {
          contentType: 'image/png',
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) {
        throw new Error(`Storage upload failed: ${uploadError.message}`);
      }

      const { data: publicUrlData } = supabase.storage
        .from('thumbnails')
        .getPublicUrl(fileName);

      const thumbnailUrl = publicUrlData.publicUrl;

      const responseTime = Date.now() - startTime;
      await this.systemLogService.logSystem({
        logLevel: LogSeverity.INFO,
        category: SystemLogCategory.NETWORK,
        serviceName: 'AiService',
        message: 'Complete thumbnail generated successfully',
        details: {
          userId,
          videoId,
          template,
          responseTimeMs: responseTime,
          thumbnailUrl,
        },
      });

      return thumbnailUrl;
    } catch (error) {
      const responseTime = Date.now() - startTime;
      await this.systemLogService.logSystem({
        logLevel: LogSeverity.ERROR,
        category: SystemLogCategory.NETWORK,
        serviceName: 'AiService',
        message: 'Failed to generate complete thumbnail',
        details: {
          userId,
          videoId,
          template,
          responseTimeMs: responseTime,
          error: error instanceof Error ? error.message : String(error),
        },
        stackTrace: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  /**
   * Generate placeholder positions based on template
   */
  private generatePlaceholders(
    template: string,
  ): Array<{
    type: 'text' | 'image' | 'logo';
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
    zIndex: number;
  }> {
    // Will be populated by frontend - return empty for now
    // You can define default positions per template if needed
    return [
      {
        type: 'text',
        id: 'main-text',
        x: 100,
        y: 100,
        width: 1592,
        height: 200,
        zIndex: 10,
      },
      {
        type: 'image',
        id: 'person-image',
        x: 100,
        y: 400,
        width: 500,
        height: 500,
        zIndex: 5,
      },
      {
        type: 'logo',
        id: 'brand-logo',
        x: 1500,
        y: 50,
        width: 200,
        height: 200,
        zIndex: 15,
      },
    ];
  }

  /**
   * 7. Generate Thumbnail Image - NEW SYSTEM with 10 Templates
   * Uses DALL-E 3 for background + Sharp.js for text overlays
   */
  async generateThumbnailImage(
    userId: string,
    aiPrompt: string,
    videoId: string,
    videoTitle?: string,
    transcript?: string,
  ): Promise<string> {
    const startTime = Date.now();
    try {
      this.logger.log(
        `Generating thumbnail for video: ${videoTitle || videoId}`,
      );

      // Step 1: Select template based on video content
      let selectedTemplate: any = null;
      let customPrompt = aiPrompt;

      if (videoTitle && transcript) {
        // AI-based template selection
        selectedTemplate = await this.thumbnailComposerService.selectTemplate(
          videoTitle,
          transcript,
        );
        this.logger.log(`Selected template: ${selectedTemplate}`);

        // Generate video-specific Flux prompt
        customPrompt = ThumbnailPromptsService.generateBackgroundPrompt(
          videoTitle,
          transcript,
          selectedTemplate,
        );
      }

      // Step 2: Generate background using Fireworks AI Flux (1792x1024)
      this.logger.log('Generating image with Fireworks AI Flux...');
      const fireworksResponse = await fetch(
        'https://api.fireworks.ai/inference/v1/workflows/accounts/fireworks/models/flux-1-schnell-fp8/text_to_image',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.fireworksApiKey}`,
            Accept: 'image/jpeg',
          },
          body: JSON.stringify({
            prompt: customPrompt,
          }),
        },
      );

      if (!fireworksResponse.ok) {
        const errorText = await fireworksResponse.text();
        this.logger.error(`Fireworks API error: ${errorText}`);
        throw new Error(
          `Fireworks AI request failed: ${fireworksResponse.status} ${errorText}`,
        );
      }

      // The response is the image itself (binary - BASE only, not final!)
      const baseBuffer = Buffer.from(await fireworksResponse.arrayBuffer());

      if (!baseBuffer || baseBuffer.length === 0) {
        throw new Error('No valid image returned from Fireworks AI');
      }

      this.logger.log(
        'Successfully generated BASE image with Fireworks AI Flux',
      );

      // Step 3: Apply professional post-processing (THIS IS THE MAGIC!)
      this.logger.log('Applying professional color grading and enhancement...');

      const enhancementStyle =
        ThumbnailEnhancementService.detectStyleFromContent(
          videoTitle || '',
          transcript || '',
        );

      const backgroundBuffer =
        await ThumbnailEnhancementService.enhanceBackground(
          baseBuffer,
          enhancementStyle as any,
        );

      this.logger.log(
        `Enhanced background with ${enhancementStyle} style post-processing`,
      );

      // Step 5: Compose with text overlay
      let finalBuffer: Buffer;

      if (videoTitle && transcript) {
        try {
          // Use template system with selected style
          finalBuffer = await this.thumbnailComposerService.composeThumbnail(
            backgroundBuffer,
            videoTitle,
            transcript,
            selectedTemplate,
          );
          this.logger.log('Thumbnail composed with template text overlay');
        } catch (compositionError) {
          this.logger.warn(
            'Failed to compose thumbnail with text, using background only',
            compositionError,
          );
          finalBuffer = backgroundBuffer; // Fallback to background only
        }
      } else {
        finalBuffer = backgroundBuffer; // No title/transcript, use background only
      }

      const fileName = `thumbnails/${userId}/${videoId}_${Date.now()}.png`;

      // Upload to Supabase Storage
      const supabase = this.supabaseService.getServiceClient();

      const { error: uploadError } = await supabase.storage
        .from('thumbnails')
        .upload(fileName, finalBuffer, {
          contentType: 'image/png',
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) {
        this.logger.error(
          `Failed to upload to Supabase: ${uploadError.message}`,
        );
        throw new Error(`Storage upload failed: ${uploadError.message}`);
      }

      // Get public URL
      const { data: publicUrlData } = supabase.storage
        .from('thumbnails')
        .getPublicUrl(fileName);

      const publicUrl = publicUrlData.publicUrl;
      this.logger.log(`Thumbnail uploaded successfully: ${publicUrl}`);

      const responseTime = Date.now() - startTime;
      await this.systemLogService.logSystem({
        logLevel: LogSeverity.INFO,
        category: SystemLogCategory.NETWORK,
        serviceName: 'AiService',
        message: 'Thumbnail image generated and uploaded successfully',
        details: {
          model: 'dall-e-3',
          userId,
          videoId,
          promptLength: aiPrompt.length,
          fileName,
          publicUrl,
          responseTimeMs: responseTime,
        },
      });

      return publicUrl;
    } catch (error) {
      const responseTime = Date.now() - startTime;
      await this.systemLogService.logSystem({
        logLevel: LogSeverity.ERROR,
        category: SystemLogCategory.NETWORK,
        serviceName: 'AiService',
        message: 'Failed to generate thumbnail image',
        details: {
          model: 'dall-e-3',
          userId,
          videoId,
          responseTimeMs: responseTime,
          error: error instanceof Error ? error.message : String(error),
        },
        stackTrace: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  /**
   * 8. Complete Video Analysis - Run all analyses and return combined results
   * This is the main method that combines all 7 analyses
   */
  async analyzeVideoComplete(
    userId: string,
    transcript: string,
    languageOverride?: string,
    thumbnailStyleOverride?: string,
    imageStyleOverride?: string,
  ): Promise<VideoAnalysisResult> {
    const startTime = Date.now();
    this.logger.log('Starting complete video analysis...');

    try {
      // Option 1: Run all analyses in parallel for speed
      const [
        descriptionRewrite,
        keywordExtraction,
        chapters,
        thumbnailIdeas,
        thumbnailAIPrompts,
      ] = await Promise.all([
        this.generateDescriptionRewrite(userId, transcript, languageOverride),
        this.extractKeywords(transcript),
        this.generateChapters(transcript),
        this.generateThumbnailIdeas(userId, transcript, thumbnailStyleOverride),
        this.generateThumbnailAIPrompts(userId, transcript, imageStyleOverride),
      ]);

      const responseTime = Date.now() - startTime;
      await this.systemLogService.logSystem({
        logLevel: LogSeverity.INFO,
        category: SystemLogCategory.NETWORK,
        serviceName: 'AiService',
        message: 'Complete video analysis successful',
        details: {
          transcriptLength: transcript.length,
          totalResponseTimeMs: responseTime,
          analysesCompleted: 6,
        },
      });

      return {
        descriptionRewrite,
        keywordExtraction,
        chapters,
        thumbnailGeneration: {
          ideas: thumbnailIdeas,
          aiPrompts: thumbnailAIPrompts,
        },
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      await this.systemLogService.logSystem({
        logLevel: LogSeverity.ERROR,
        category: SystemLogCategory.NETWORK,
        serviceName: 'AiService',
        message: 'Complete video analysis failed',
        details: {
          transcriptLength: transcript.length,
          totalResponseTimeMs: responseTime,
          error: error instanceof Error ? error.message : String(error),
        },
        stackTrace: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  // /**
  //  * Alternative: Master Analysis with Single API Call
  //  * More cost-efficient but less granular control
  //  */
  // async analyzeVideoCompleteSingleCall(
  //   transcript: string,
  // ): Promise<VideoAnalysisResult> {
  //   const startTime = Date.now();
  //   try {
  //     const prompt = PromptsService.getMasterAnalysisPrompt(transcript);

  //     const res = await this.openai.chat.completions.create({
  //       model: 'gpt-4o-mini',
  //       messages: [{ role: 'user', content: prompt }],
  //       temperature: 0.7,
  //     });

  //     const text = res.choices[0].message?.content ?? '{}';
  //     const jsonStart = text.indexOf('{');
  //     const jsonEnd = text.lastIndexOf('}');
  //     const parsed = JSON.parse(text.slice(jsonStart, jsonEnd + 1));

  //     const responseTime = Date.now() - startTime;
  //     await this.systemLogService.logSystem({
  //       logLevel: LogSeverity.INFO,
  //       category: SystemLogCategory.NETWORK,
  //       serviceName: 'AiService',
  //       message: 'OpenAI API call successful - analyzeVideoCompleteSingleCall',
  //       details: {
  //         model: 'gpt-4o-mini',
  //         transcriptLength: transcript.length,
  //         promptTokens: res.usage?.prompt_tokens,
  //         completionTokens: res.usage?.completion_tokens,
  //         totalTokens: res.usage?.total_tokens,
  //         responseTimeMs: responseTime,
  //       },
  //     });

  //     return {
  //       // titleRewrite: parsed.titleRewrite ?? { titles: [] },
  //       descriptionRewrite: parsed.descriptionRewrite ?? {
  //         description: '',
  //         hashtags: [],
  //         keyPoints: [],
  //       },
  //       keywordExtraction: parsed.keywordExtraction ?? {
  //         primaryKeywords: [],
  //         longTailKeywords: [],
  //         trendingKeywords: [],
  //         competitorKeywords: [],
  //       },
  //       chapters: parsed.chapters ?? { chapters: [] },
  //       thumbnailGeneration: parsed.thumbnailGeneration ?? {
  //         ideas: [],
  //         aiPrompts: [],
  //       },
  //     };
  //   } catch (error) {
  //     const responseTime = Date.now() - startTime;
  //     await this.systemLogService.logSystem({
  //       logLevel: LogSeverity.ERROR,
  //       category: SystemLogCategory.NETWORK,
  //       serviceName: 'AiService',
  //       message: 'OpenAI API call failed - analyzeVideoCompleteSingleCall',
  //       details: {
  //         model: 'gpt-4o-mini',
  //         transcriptLength: transcript.length,
  //         responseTimeMs: responseTime,
  //         error: error instanceof Error ? error.message : String(error),
  //       },
  //       stackTrace: error instanceof Error ? error.stack : undefined,
  //     });
  //     throw error;
  //   }
  // }
}
