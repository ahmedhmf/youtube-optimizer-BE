// apps/api/src/modules/ai/ai.service.ts
import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { AiSuggestions } from './ai.types';
import { YouTubeVideo } from 'src/model/youtube-video.model';
import * as fs from 'node:fs';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly openai: OpenAI;

  constructor() {
    // Temporarily disable SSL verification for development
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

    // this.openai = new OpenAI({
    //   apiKey: process.env.OPENAI_API_KEY
    // });
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

  async generateVideoSuggestions(
    video: YouTubeVideo,
    language: string,
    tone: string,
    aiModel: string,
  ): Promise<AiSuggestions> {
    const prompt = `
You are an expert YouTube content strategist.
Here is a video you need to optimize:

Title: "${video.title}"
Description: "${video.description}"
Tags: [${video.tags?.join(', ') ?? ''}]

Generate improved metadata for this video.
Return valid JSON only with this structure:
{
  "titles": [ "string", "string", "string" ],
  "description": "string",
  "tags": ["string", "string", "string"],
  "thumbnailPrompts": ["string", "string", "string"]
}
Rules:
- Titles must be catchy (max 60 characters)
- Description should be SEO-optimized but natural
- Tags should focus on high-intent keywords
- Thumbnail prompts should describe what to show visually (subject, emotion, text) for AI image generation using ${aiModel}
- The language must be ${language} and the tone must be ${tone}
`;

    try {
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
      });

      const content = completion.choices[0].message?.content ?? '{}';
      this.logger.log(`AI response: ${content}`);
      // Try parsing JSON safely
      const jsonStart = content.indexOf('{');
      const jsonEnd = content.lastIndexOf('}');
      const jsonStr = content.slice(jsonStart, jsonEnd + 1);
      const parsed = JSON.parse(jsonStr);

      return {
        titles: parsed.titles ?? [],
        description: parsed.description ?? '',
        tags: parsed.tags ?? [],
        thumbnailPrompts: parsed.thumbnailPrompts ?? [],
      };
    } catch (err) {
      console.log('AI generation error:', err);
      this.logger.error('AI generation failed', err);
      return { titles: [], description: '', tags: [], thumbnailPrompts: [] };
    }
  }

  async transcribeLocalFile(tmpPath: string): Promise<string> {
    const fileStream = fs.createReadStream(tmpPath);
    const res = await this.openai.audio.transcriptions.create({
      // OpenAI accepts mp3, mp4, mpeg, mpga, wav, webm, etc.
      file: fileStream as any,
      model: 'whisper-1',
      // language: 'en',  // optionally force language
      // response_format: 'json',
    });
    // SDK returns { text: '...' }
    // @ts-ignore - depending on SDK version
    return res.text ?? (res as any).text ?? '';
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
    const prompt = `
You are an expert YouTube SEO assistant.

Based on the following video content (transcript or script), generate:
- 5 catchy, distinct TITLES (<= 60 chars)
- 1 SEO-optimized DESCRIPTION (<= 200 words, include 3 keyword-rich opening lines, 5 bullet highlights, 1 CTA)
- 15 TAGS (no #, long-tail preferred)
- 3 THUMBNAIL PROMPTS (each concise: subject, expression, composition, optional 3–5 words of on-image text)

Return strict JSON with keys: titles, description, tags, thumbnailPrompts.

CONTENT:
${script.slice(0, 12000)}
    `;

    const res = await this.openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
    });

    const text = res.choices[0].message?.content ?? '{}';
    const jsonStart = text.indexOf('{'),
      jsonEnd = text.lastIndexOf('}');
    const parsed = JSON.parse(text.slice(jsonStart, jsonEnd + 1));
    return {
      titles: parsed.titles ?? [],
      description: parsed.description ?? '',
      tags: parsed.tags ?? [],
      thumbnailPrompts: parsed.thumbnailPrompts ?? [],
    };
  }
}
