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
} from './models/ai.types';
import * as fs from 'node:fs';
import { PromptsService } from './prompts.service';
import { SystemLogService } from '../logging/services/system-log.service';
import { LogSeverity, SystemLogCategory } from '../logging/dto/log.types';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly openai: OpenAI;

  constructor(private readonly systemLogService: SystemLogService) {
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
    transcript: string,
    language: string,
    tone: string,
    originalTitle: string,
  ): Promise<TitleRewriteResult> {
    const startTime = Date.now();
    try {
      const prompt = PromptsService.getTitleRewritePrompt(
        transcript,
        language,
        tone,
        originalTitle,
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
    transcript: string,
  ): Promise<DescriptionRewriteResult> {
    const startTime = Date.now();
    try {
      const prompt = PromptsService.getDescriptionRewritePrompt(transcript);

      const res = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
      });

      const text = res.choices[0].message?.content ?? '{}';
      const jsonStart = text.indexOf('{');
      const jsonEnd = text.lastIndexOf('}');
      const parsed = JSON.parse(text.slice(jsonStart, jsonEnd + 1));

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
      const parsed = JSON.parse(text.slice(jsonStart, jsonEnd + 1));

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
      const parsed = JSON.parse(text.slice(jsonStart, jsonEnd + 1));

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
    transcript: string,
  ): Promise<ThumbnailIdeaResult[]> {
    const startTime = Date.now();
    try {
      const prompt = PromptsService.getThumbnailIdeaPrompt(transcript);

      const res = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.9,
      });

      const text = res.choices[0].message?.content ?? '{}';
      const jsonStart = text.indexOf('{');
      const jsonEnd = text.lastIndexOf('}');
      const parsed = JSON.parse(text.slice(jsonStart, jsonEnd + 1));

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
   * 6. Thumbnail AI Prompts - Generate AI image generation prompts
   */
  async generateThumbnailAIPrompts(transcript: string): Promise<string[]> {
    const startTime = Date.now();
    try {
      const prompt = PromptsService.getThumbnailAIPrompt(transcript);

      const res = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.9,
      });

      const text = res.choices[0].message?.content ?? '{}';
      const jsonStart = text.indexOf('{');
      const jsonEnd = text.lastIndexOf('}');
      const parsed = JSON.parse(text.slice(jsonStart, jsonEnd + 1));

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

      return parsed.aiPrompts ?? [];
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
   * 7. Complete Video Analysis - Run all analyses and return combined results
   * This is the main method that combines all 7 analyses
   */
  async analyzeVideoComplete(transcript: string): Promise<VideoAnalysisResult> {
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
        this.generateDescriptionRewrite(transcript),
        this.extractKeywords(transcript),
        this.generateChapters(transcript),
        this.generateThumbnailIdeas(transcript),
        this.generateThumbnailAIPrompts(transcript),
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

  /**
   * Alternative: Master Analysis with Single API Call
   * More cost-efficient but less granular control
   */
  async analyzeVideoCompleteSingleCall(
    transcript: string,
  ): Promise<VideoAnalysisResult> {
    const startTime = Date.now();
    try {
      const prompt = PromptsService.getMasterAnalysisPrompt(transcript);

      const res = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
      });

      const text = res.choices[0].message?.content ?? '{}';
      const jsonStart = text.indexOf('{');
      const jsonEnd = text.lastIndexOf('}');
      const parsed = JSON.parse(text.slice(jsonStart, jsonEnd + 1));

      const responseTime = Date.now() - startTime;
      await this.systemLogService.logSystem({
        logLevel: LogSeverity.INFO,
        category: SystemLogCategory.NETWORK,
        serviceName: 'AiService',
        message: 'OpenAI API call successful - analyzeVideoCompleteSingleCall',
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
        // titleRewrite: parsed.titleRewrite ?? { titles: [] },
        descriptionRewrite: parsed.descriptionRewrite ?? {
          description: '',
          hashtags: [],
          keyPoints: [],
        },
        keywordExtraction: parsed.keywordExtraction ?? {
          primaryKeywords: [],
          longTailKeywords: [],
          trendingKeywords: [],
          competitorKeywords: [],
        },
        chapters: parsed.chapters ?? { chapters: [] },
        thumbnailGeneration: parsed.thumbnailGeneration ?? {
          ideas: [],
          aiPrompts: [],
        },
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      await this.systemLogService.logSystem({
        logLevel: LogSeverity.ERROR,
        category: SystemLogCategory.NETWORK,
        serviceName: 'AiService',
        message: 'OpenAI API call failed - analyzeVideoCompleteSingleCall',
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
}
