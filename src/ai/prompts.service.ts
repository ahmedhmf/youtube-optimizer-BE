import { Injectable } from '@nestjs/common';

@Injectable()
export class PromptsService {
  // ============================================
  // NEW PROMPTS FOR 7-PART VIDEO ANALYSIS
  // ============================================

  /**
   * 1. Title Rewrite Prompt
   * Generates 5-7 optimized title options based on video content
   */
  public static getTitleRewritePrompt(
    transcript: string,
    language: string,
    tone: string,
    originalTitle: string,
  ): string {
    return `You are an expert YouTube Title Strategist.

The user wants rewritten titles in:
Language → {user_language}  
Tone → {user_tone}

Original Title:
${originalTitle}

Video Context (Transcript):
${transcript}

Title Language: ${language}
Title Tone: ${tone}

Generate 7 optimized title options that:
- Are 50-60 characters long (optimal for all devices)
- Increase click-through rate with power words
- Match the requested tone: ${tone}
- Are in the requested language: ${language}
- Use emotional hooks and curiosity gaps
- Include numbers or lists when relevant
- Are honest and deliver on the promise

Also provide brief strategic reasoning for your title choices.

Return ONLY valid JSON in this exact format:
{
  "titles": ["title 1", "title 2", "title 3", "title 4", "title 5", "title 6", "title 7"],
  "reasoning": "Brief explanation of the strategy behind these title choices"
}`;
  }

  /**
   * 2. Description Rewrite Prompt
   * Creates SEO-optimized video description with strategic keyword placement
   */
  public static getDescriptionRewritePrompt(transcript: string): string {
    return `You are a YouTube SEO copywriter specializing in high-converting video descriptions.

ANALYZE THIS VIDEO TRANSCRIPT:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${transcript.slice(0, 4000)}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

YOUR TASK: Write a comprehensive, SEO-optimized video description that drives engagement.

DESCRIPTION STRUCTURE:
1. HOOK (First 125 characters - visible in search)
   - Start with the most compelling benefit or question
   - Must capture attention immediately

2. VALUE PROPOSITION (2-3 sentences)
   - What viewers will learn/gain/discover
   - Why this video matters

3. KEY TAKEAWAYS (5-7 bullet points)
   - Use "✓" or "•" for formatting
   - Highlight main insights from the video
   - Be specific and actionable

4. CONTEXT/BACKGROUND (Optional, 1-2 sentences)
   - Why this topic is important now
   - Who this is for

5. CALL-TO-ACTION
   - Subscribe/like/comment prompt
   - Social media links placeholder
   - Related video suggestions

6. HASHTAGS (3-5 relevant hashtags)

REQUIREMENTS:
• Length: 200-300 words
• Include 7-10 relevant keywords naturally
• Use line breaks for readability
• Write in an engaging, conversational tone
• Front-load important information
• Include timestamps placeholder if applicable

RETURN FORMAT (JSON only):
{
  "description": "Complete formatted description with line breaks (use \\n)",
  "hashtags": ["#hashtag1", "#hashtag2", "#hashtag3", "#hashtag4", "#hashtag5"],
  "keyPoints": ["Key point 1", "Key point 2", "Key point 3", "Key point 4", "Key point 5"]
}`;
  }

  /**
   * 3. Keyword Extraction Prompt
   * Identifies and categorizes relevant keywords for SEO
   */
  public static getKeywordExtractionPrompt(transcript: string): string {
    return `You are a YouTube SEO analyst specializing in keyword research and optimization.

ANALYZE THIS VIDEO TRANSCRIPT:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${transcript.slice(0, 5000)}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

YOUR TASK: Extract and categorize keywords for maximum YouTube SEO impact.

KEYWORD CATEGORIES:

1. PRIMARY KEYWORDS (5-7 keywords)
   - Main topic keywords
   - High search volume terms
   - Core concepts from the video
   - Format: 1-2 word phrases

2. LONG-TAIL KEYWORDS (8-10 keywords)
   - Specific phrases people search for
   - Lower competition, higher intent
   - Question-based phrases
   - Format: 3-5 word phrases

3. TRENDING KEYWORDS (3-5 keywords)
   - Current trend-related terms
   - Seasonal or timely keywords
   - Viral topic connections
   - Format: 2-3 word phrases

4. COMPETITOR KEYWORDS (3-5 keywords)
   - Terms successful videos in this niche use
   - Related topic keywords
   - Adjacent category terms
   - Format: 2-3 word phrases

KEYWORD REQUIREMENTS:
• All keywords must be relevant to the actual content
• Prioritize search intent matching
• Mix broad and specific terms
• Consider voice search patterns
• Include both topic and benefit keywords

RETURN FORMAT (JSON only):
{
  "primaryKeywords": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5"],
  "longTailKeywords": ["long tail 1", "long tail 2", "long tail 3", "long tail 4", "long tail 5", "long tail 6", "long tail 7", "long tail 8"],
  "trendingKeywords": ["trend 1", "trend 2", "trend 3", "trend 4"],
  "competitorKeywords": ["competitor term 1", "competitor term 2", "competitor term 3"]
}`;
  }

  /**
   * 4. Chapters/Timestamps Prompt
   * Creates organized chapter markers for video navigation
   */
  public static getChaptersPrompt(transcript: string): string {
    return `You are a YouTube content organizer specializing in creating viewer-friendly chapter timestamps.

ANALYZE THIS VIDEO TRANSCRIPT:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${transcript.slice(0, 8000)}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

YOUR TASK: Create logical chapter breaks with timestamps that help viewers navigate the video.

CHAPTER REQUIREMENTS:
• Identify 5-10 distinct sections based on topic changes
• Create clear, descriptive chapter titles (30-50 characters)
• Estimate logical timestamp positions (format: MM:SS or HH:MM:SS)
• First chapter must start at 0:00
• Each chapter should be at least 30 seconds long
• Titles should be engaging and descriptive
• Include brief descriptions for each chapter

CHAPTER TITLE BEST PRACTICES:
• Start with action words (Learn, Discover, Understand, Avoid)
• Be specific about what's covered
• Use numbers when relevant (3 Key Points, Step 1)
• Front-load important words
• Keep concise but informative

RETURN FORMAT (JSON only):
{
  "chapters": [
    {
      "timestamp": "0:00",
      "title": "Introduction - What You'll Learn",
      "description": "Brief overview of the chapter content"
    },
    {
      "timestamp": "2:15",
      "title": "Chapter 2 Title",
      "description": "What's covered in this section"
    }
  ],
  "totalDuration": "15:30"
}

NOTE: Estimate timestamps based on natural topic transitions in the transcript.`;
  }

  /**
   * 5. Thumbnail Text + Idea Generation Prompt
   * Creates thumbnail concepts with text overlays and visual ideas
   */
  public static getThumbnailIdeaPrompt(transcript: string): string {
    return `You are a YouTube thumbnail designer specializing in high-CTR visual concepts.

ANALYZE THIS VIDEO TRANSCRIPT:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${transcript.slice(0, 3000)}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

YOUR TASK: Create 5 distinct thumbnail concepts that maximize click-through rate.

THUMBNAIL CONCEPT REQUIREMENTS:

For each of the 5 thumbnail ideas, provide:

1. TEXT OVERLAY (3-5 words max)
   - Bold, readable words that create curiosity
   - Use numbers, questions, or power words
   - Examples: "This Changed Everything", "Step 1: ???", "The Secret Method"

2. VISUAL CONCEPT
   - Describe the main visual element or scene
   - Include emotional expression if human subject
   - Specify composition (close-up, wide shot, split screen)

3. VISUAL ELEMENTS
   - List 3-5 specific elements to include
   - Icons, arrows, graphics, objects, backgrounds
   - Consider contrast and eye-catching details

4. COLOR SCHEME
   - Primary colors to use
   - Consider color psychology (red=urgency, blue=trust, yellow=attention)
   - High contrast combinations for mobile visibility

5. COMPOSITION STYLE
   - Layout approach (rule of thirds, centered, asymmetric)
   - Subject positioning
   - Text placement recommendations

THUMBNAIL STRATEGIES TO USE:
• Emotion-focused (surprised face, excitement)
• Before/After comparison
• Problem visualization
• Benefit highlight
• Mystery/Curiosity gap
• Authority/Expert positioning

RETURN FORMAT (JSON only):
{
  "ideas": [
    {
      "textOverlay": "The Secret Method",
      "concept": "Person pointing at glowing screen with shocked expression",
      "visualElements": ["Shocked facial expression", "Pointing finger", "Glowing screen", "Yellow highlight arrows", "Dark background"],
      "colorScheme": "Orange and blue high contrast with yellow accents",
      "composition": "Close-up face on left, screen on right, text at top"
    }
  ]
}

Generate exactly 5 diverse thumbnail ideas.`;
  }

  /**
   * 6. AI Image Generation Prompts for Thumbnails
   * Creates detailed prompts for AI image generators (DALL-E, Midjourney, etc.)
   */
  public static getThumbnailAIPrompt(transcript: string): string {
    return `You are an AI image prompt engineer specializing in creating detailed prompts for YouTube thumbnail generation.

ANALYZE THIS VIDEO TRANSCRIPT:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${transcript.slice(0, 3000)}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

YOUR TASK: Create 5 detailed AI image generation prompts optimized for thumbnail creation.

PROMPT STRUCTURE:
Each prompt should include:
1. Subject/Main Focus (person, object, scene)
2. Emotion/Expression (if applicable)
3. Action/Pose
4. Composition (framing, angle, perspective)
5. Lighting (dramatic, soft, bright, neon)
6. Color Palette (specific colors and mood)
7. Style (photorealistic, cinematic, illustration, 3D render)
8. Background/Setting
9. Text Overlay Suggestion (what text to add in post-production)
10. Technical specs (high detail, 4K, sharp focus)

PROMPT BEST PRACTICES:
• Be extremely specific and detailed
• Use descriptive adjectives
• Specify technical quality (ultra detailed, 8K, photorealistic)
• Include style references (cinematic lighting, studio photography)
• Mention text space/placement
• Consider YouTube thumbnail aspect ratio (16:9)
• Optimize for mobile visibility

EXAMPLE PROMPT FORMAT:
"Photorealistic close-up portrait of excited person with wide eyes and open mouth expressing shock, pointing finger at glowing laptop screen, dramatic side lighting with orange and blue color grading, dark background with subtle tech elements, cinematic composition with subject on left third, space for bold text overlay at top right, ultra detailed, 8K quality, professional studio photography style, high contrast for mobile visibility"

RETURN FORMAT (JSON only):
{
  "aiPrompts": [
    "Detailed prompt 1 for AI image generator...",
    "Detailed prompt 2 for AI image generator...",
    "Detailed prompt 3 for AI image generator...",
    "Detailed prompt 4 for AI image generator...",
    "Detailed prompt 5 for AI image generator..."
  ]
}

Generate exactly 5 diverse, detailed prompts ready for DALL-E, Midjourney, or Stable Diffusion.`;
  }

  /**
   * 7. Master Analysis Prompt
   * Combines all analyses into one comprehensive prompt (for efficiency)
   */
  public static getMasterAnalysisPrompt(transcript: string): string {
    return `You are an elite YouTube optimization expert conducting a comprehensive video analysis.

ANALYZE THIS VIDEO TRANSCRIPT:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${transcript.slice(0, 6000)}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

YOUR TASK: Provide a complete YouTube optimization analysis covering all aspects.

DELIVER THE FOLLOWING:

1. TITLE REWRITE (7 options, 45-60 chars each)
2. DESCRIPTION (200-300 words, SEO-optimized with hashtags)
3. KEYWORDS (Categorized: primary, long-tail, trending, competitor)
4. CHAPTERS (5-10 timestamp sections with descriptions)
5. THUMBNAIL IDEAS (5 concepts with text, visuals, colors, composition)
6. AI IMAGE PROMPTS (5 detailed prompts for AI generators)

RETURN FORMAT (JSON only, no additional text):
{
  "titleRewrite": {
    "titles": ["title1", "title2", "title3", "title4", "title5", "title6", "title7"],
    "reasoning": "Strategy explanation"
  },
  "descriptionRewrite": {
    "description": "Full formatted description",
    "hashtags": ["#tag1", "#tag2", "#tag3", "#tag4", "#tag5"],
    "keyPoints": ["point1", "point2", "point3", "point4", "point5"]
  },
  "keywordExtraction": {
    "primaryKeywords": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5"],
    "longTailKeywords": ["longtail1", "longtail2", "longtail3", "longtail4", "longtail5", "longtail6", "longtail7", "longtail8"],
    "trendingKeywords": ["trend1", "trend2", "trend3", "trend4"],
    "competitorKeywords": ["comp1", "comp2", "comp3"]
  },
  "chapters": {
    "chapters": [
      {"timestamp": "0:00", "title": "Chapter title", "description": "Brief description"}
    ],
    "totalDuration": "XX:XX"
  },
  "thumbnailGeneration": {
    "ideas": [
      {
        "textOverlay": "3-5 words",
        "concept": "Visual concept description",
        "visualElements": ["element1", "element2", "element3"],
        "colorScheme": "Color description",
        "composition": "Layout description"
      }
    ],
    "aiPrompts": ["detailed prompt 1", "detailed prompt 2", "detailed prompt 3", "detailed prompt 4", "detailed prompt 5"]
  }
}`;
  }
}
