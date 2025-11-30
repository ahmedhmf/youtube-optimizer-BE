// apps/api/src/modules/ai/ai.service.ts
import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { AiSuggestions } from './models/ai.types';
import { YouTubeVideo } from 'src/auth/types/youtube-video.model';
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

  async generateVideoSuggestions(
    video: YouTubeVideo,
    language: string,
    tone: string,
    aiModel: string,
  ): Promise<AiSuggestions> {
    const prompt = PromptsService.getVideoTitlePrompt(
      video,
      language,
      tone,
      aiModel,
    );

    const startTime = Date.now();
    try {
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4.1',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
      });

      const content = completion.choices[0].message?.content ?? '{}';
      this.logger.log(`AI response: ${content}`);

      const jsonStart = content.indexOf('{');
      const jsonEnd = content.lastIndexOf('}');
      const jsonStr = content.slice(jsonStart, jsonEnd + 1);
      const parsed = JSON.parse(jsonStr) as AiSuggestions;

      const responseTime = Date.now() - startTime;
      await this.systemLogService.logSystem({
        logLevel: LogSeverity.INFO,
        category: SystemLogCategory.NETWORK,
        serviceName: 'AiService',
        message: 'OpenAI API call successful - generateVideoSuggestions',
        details: {
          model: 'gpt-4.1',
          videoTitle: video.title,
          promptTokens: completion.usage?.prompt_tokens,
          completionTokens: completion.usage?.completion_tokens,
          totalTokens: completion.usage?.total_tokens,
          responseTimeMs: responseTime,
        },
      });

      return {
        titles: parsed.titles ?? [],
        description: parsed.description ?? '',
        tags: parsed.tags ?? [],
        thumbnailPrompts: parsed.thumbnailPrompts ?? [],
      };
    } catch (err) {
      this.logger.error('AI generation failed', err);
      const responseTime = Date.now() - startTime;
      await this.systemLogService.logSystem({
        logLevel: LogSeverity.ERROR,
        category: SystemLogCategory.NETWORK,
        serviceName: 'AiService',
        message: 'OpenAI API call failed - generateVideoSuggestions',
        details: {
          model: 'gpt-4o-mini',
          videoTitle: video.title,
          responseTimeMs: responseTime,
          error: err instanceof Error ? err.message : String(err),
        },
        stackTrace: err instanceof Error ? err.stack : undefined,
      });
      return { titles: [], description: '', tags: [], thumbnailPrompts: [] };
    }
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

  async generateVideoSuggestionsFromText(script: string) {
    const startTime = Date.now();
    try {
      const prompt = PromptsService.generateVideoSuggestionsFromText(script);

      const res = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
      });

      const text = res.choices[0].message?.content ?? '{}';
      const jsonStart = text.indexOf('{'),
        jsonEnd = text.lastIndexOf('}');
      const parsed = JSON.parse(
        text.slice(jsonStart, jsonEnd + 1),
      ) as AiSuggestions;

      const responseTime = Date.now() - startTime;
      await this.systemLogService.logSystem({
        logLevel: LogSeverity.INFO,
        category: SystemLogCategory.NETWORK,
        serviceName: 'AiService',
        message:
          'OpenAI API call successful - generateVideoSuggestionsFromText',
        details: {
          model: 'gpt-4o-mini',
          scriptLength: script.length,
          promptTokens: res.usage?.prompt_tokens,
          completionTokens: res.usage?.completion_tokens,
          totalTokens: res.usage?.total_tokens,
          responseTimeMs: responseTime,
        },
      });

      return {
        titles: parsed.titles ?? [],
        description: parsed.description ?? '',
        tags: parsed.tags ?? [],
        thumbnailPrompts: parsed.thumbnailPrompts ?? [],
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      await this.systemLogService.logSystem({
        logLevel: LogSeverity.ERROR,
        category: SystemLogCategory.NETWORK,
        serviceName: 'AiService',
        message: 'OpenAI API call failed - generateVideoSuggestionsFromText',
        details: {
          model: 'gpt-4o-mini',
          scriptLength: script.length,
          responseTimeMs: responseTime,
          error: error instanceof Error ? error.message : String(error),
        },
        stackTrace: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }
}
