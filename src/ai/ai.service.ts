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

  constructor(
    private readonly systemLogService: SystemLogService,
    private readonly userPreferencesService: UserPreferencesService,
    private readonly notificationService: NotificationService,
    private readonly supabaseService: SupabaseService,
  ) {
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
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
   */
  async generateThumbnailAIPrompts(
    userId: string,
    transcript: string,
    imageStyleOverride?: string,
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

      const prompt = PromptsService.getThumbnailAIPrompt(
        transcript,
        imageStyle,
        customInstructions,
      );

      const res = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.8,
      });

      const text = res.choices[0].message?.content ?? '{}';
      const jsonStart = text.indexOf('{');
      const jsonEnd = text.lastIndexOf('}');
      const parsed = JSON.parse(text.slice(jsonStart, jsonEnd + 1)) as {
        aiPrompt?: string;
      };

      const responseTime = Date.now() - startTime;
      await this.systemLogService.logSystem({
        logLevel: LogSeverity.INFO,
        category: SystemLogCategory.NETWORK,
        serviceName: 'AiService',
        message: 'OpenAI API call successful - generateThumbnailAIPrompts',
        details: {
          model: 'gpt-4o-mini',
          transcriptLength: transcript.length,
          promptTokens: res.usage?.prompt_tokens,
          completionTokens: res.usage?.completion_tokens,
          totalTokens: res.usage?.total_tokens,
          responseTimeMs: responseTime,
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
   * 7. Generate Thumbnail Image - Create actual thumbnail using DALL-E 3
   */
  async generateThumbnailImage(
    userId: string,
    aiPrompt: string,
    videoId: string,
  ): Promise<string> {
    const startTime = Date.now();
    try {
      this.logger.log(`Generating thumbnail image for user ${userId}...`);

      // Generate image using DALL-E 3
      // Note: DALL-E 3 supports 1024x1024, 1792x1024, or 1024x1792
      // We'll use 1792x1024 (16:9 landscape) which is closest to 1280x720

      // Enhance prompt to ensure no UI elements or play buttons
      const enhancedPrompt = `${aiPrompt}. IMPORTANT: This is a YouTube thumbnail background image. Do NOT include any play buttons, video player controls, YouTube logos, or text overlays. Focus only on the visual content and subjects. Create a clean, professional image suitable for adding text overlay later.`;

      const response = await this.openai.images.generate({
        model: 'dall-e-3',
        prompt: enhancedPrompt,
        n: 1,
        size: '1792x1024',
        quality: 'standard',
        response_format: 'url',
      });

      const imageUrl = response.data?.[0]?.url;
      if (!imageUrl) {
        throw new Error('No image URL returned from OpenAI');
      }

      this.logger.log(`Image generated successfully: ${imageUrl}`);

      // Download the image
      const imageResponse = await fetch(imageUrl);
      if (!imageResponse.ok) {
        throw new Error(
          `Failed to download image: ${imageResponse.statusText}`,
        );
      }

      const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
      const fileName = `thumbnails/${userId}/${videoId}_${Date.now()}.png`;

      // Upload to Supabase Storage
      const supabase = this.supabaseService.getServiceClient();

      // Ensure bucket exists (you may need to create 'thumbnails' bucket in Supabase Dashboard)
      const { error: uploadError } = await supabase.storage
        .from('thumbnails')
        .upload(fileName, imageBuffer, {
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
