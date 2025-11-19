// apps/api/src/modules/ai/ai.service.ts
import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { AiSuggestions } from './models/ai.types';
import { YouTubeVideo } from 'src/auth/types/youtube-video.model';
import * as fs from 'node:fs';
import { PromptsService } from './prompts.service';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly openai: OpenAI;

  constructor() {
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

    try {
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
      });

      const content = completion.choices[0].message?.content ?? '{}';
      this.logger.log(`AI response: ${content}`);

      const jsonStart = content.indexOf('{');
      const jsonEnd = content.lastIndexOf('}');
      const jsonStr = content.slice(jsonStart, jsonEnd + 1);
      const parsed = JSON.parse(jsonStr) as AiSuggestions;

      return {
        titles: parsed.titles ?? [],
        description: parsed.description ?? '',
        tags: parsed.tags ?? [],
        thumbnailPrompts: parsed.thumbnailPrompts ?? [],
      };
    } catch (err) {
      this.logger.error('AI generation failed', err);
      return { titles: [], description: '', tags: [], thumbnailPrompts: [] };
    }
  }

  async transcribeLocalFile(tmpPath: string): Promise<string> {
    const fileStream = fs.createReadStream(tmpPath);
    const res = await this.openai.audio.transcriptions.create({
      file: fileStream,
      model: 'whisper-1',
      // language: 'en',  // optionally force language
      // response_format: 'json',
    });
    return res.text ?? '';
  }

  async summarizeTranscript(transcript: string): Promise<string> {
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
    return out.choices[0].message?.content ?? '';
  }

  async generateVideoSuggestionsFromText(script: string) {
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
    return {
      titles: parsed.titles ?? [],
      description: parsed.description ?? '',
      tags: parsed.tags ?? [],
      thumbnailPrompts: parsed.thumbnailPrompts ?? [],
    };
  }
}
