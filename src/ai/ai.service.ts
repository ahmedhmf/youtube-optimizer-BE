// apps/api/src/modules/ai/ai.service.ts
import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { AiSuggestions } from './ai.types';

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
        this.openai = new OpenAI({
            apiKey: process.env.GROQ_API_KEY,
            baseURL: 'https://openrouter.ai/api/v1',
        });
    }

    async generateVideoSuggestions(video: {
        title: string;
        description: string;
        tags: string[];
    }): Promise<AiSuggestions> {
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
- Thumbnail prompts should describe what to show visually (subject, emotion, text)
`;

        try {
            const completion = await this.openai.chat.completions.create({
                model: 'deepseek/deepseek-r1:free',
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.7,
            });

            const content = completion.choices[0].message?.content ?? '{}';

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
            this.logger.error('AI generation failed', err);
            return { titles: [], description: '', tags: [], thumbnailPrompts: [] };
        }
    }
}
