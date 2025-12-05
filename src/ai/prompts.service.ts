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
    customInstructions?: string,
  ): string {
    const customSection = customInstructions
      ? `

CUSTOM INSTRUCTIONS FROM USER:
${customInstructions}
Please incorporate these preferences into your title generation.`
      : '';

    return `You are an expert YouTube Title Strategist.

The user wants rewritten titles in:
Language → ${language}  
Tone → ${tone}${customSection}

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
  public static getDescriptionRewritePrompt(
    transcript: string,
    language?: string,
    tone?: string,
    customInstructions?: string,
  ): string {
    const langInstruction = language
      ? `\n\nIMPORTANT: Generate the description in ${language} language.`
      : '';
    const toneInstruction = tone
      ? `\nTONE: Use a ${tone} tone throughout the description.`
      : '';
    const customSection = customInstructions
      ? `\n\nCUSTOM INSTRUCTIONS FROM USER:\n${customInstructions}\nPlease incorporate these preferences into your description.`
      : '';

    return `You are a YouTube SEO copywriter specializing in high-converting video descriptions.${langInstruction}${toneInstruction}${customSection}

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
  public static getThumbnailIdeaPrompt(
    transcript: string,
    thumbnailStyle?: string,
    customInstructions?: string,
  ): string {
    const styleInstruction = thumbnailStyle
      ? `\n\nTHUMBNAIL STYLE REQUIREMENT: All thumbnails must follow ${thumbnailStyle} style. This should influence the visual concept, composition, and overall aesthetic.`
      : '';
    const customSection = customInstructions
      ? `\n\nCUSTOM INSTRUCTIONS FROM USER:\n${customInstructions}\nPlease incorporate these preferences into your thumbnail concepts.`
      : '';

    return `You are a YouTube thumbnail designer specializing in high-CTR visual concepts.${styleInstruction}${customSection}

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
   * 6. AI Image Generation Prompts for Thumbnails (NEW - 1280x720 Background Only)
   * Creates prompts for DALL-E 3 to generate background images for thumbnails
   * Text overlays will be added programmatically by Sharp.js
   */
  public static getThumbnailAIPrompt(
    transcript: string,
    templateStyle: string,
    videoTitle?: string,
    customInstructions?: string,
  ): string {
    // Legacy function - kept for compatibility
    const titleInfo = videoTitle ? `Video: ${videoTitle}` : '';

    return `Professional YouTube thumbnail background. ${titleInfo}

Context: ${transcript.slice(0, 1500)}${customInstructions ? `\n${customInstructions}` : ''}

NO text in image. High contrast, bold colors, photorealistic.

ANALYZE THIS VIDEO TRANSCRIPT:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${transcript.slice(0, 3000)}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

YOUR TASK: Create ONE perfect, highly detailed AI image generation prompt optimized for YouTube thumbnail creation.

CRITICAL ANALYSIS STEPS:
1. Identify the SPECIFIC topic, niche, and main subject of this video
2. Extract key visual elements mentioned or implied (people, objects, settings, tools, technology)
3. Determine the video's tone and target audience
4. Identify any specific brands, products, locations, or recognizable elements mentioned
5. Note any emotions, reactions, or dramatic moments described
6. Consider the video category (tech review, tutorial, vlog, gaming, education, etc.)

CUSTOMIZATION REQUIREMENTS:
• Base the thumbnail DIRECTLY on specific details from THIS video
• If the video mentions specific products/tools/technology, include them visually
• If it's a tutorial, show the specific skill/task being taught
• If it's a review, feature the actual product being reviewed
• If people are discussed, describe their appearance, clothing, expressions based on context
• Match the thumbnail style to the video's niche (tech = futuristic/modern, cooking = warm/appetizing, fitness = energetic/dynamic)
• Include relevant props, tools, or environment specific to this video's content
• For TRANSFORMATION/BEFORE-AFTER content: Show clear split composition with visible contrast between states
• For CHALLENGE/EXTREME content: Show intense action moment with dramatic background element representing the challenge, person centered with shocked/determined expression
• For CONTRADICTION/MIND-BLOWING content: Show surprising juxtaposition or unexpected elements, person with shocked/confused expression, visual that creates curiosity and makes viewer question their assumptions

PROMPT STRUCTURE REQUIREMENTS:
1. Subject/Main Focus (person, object, scene from the video content)
2. Emotion/Expression (strong, eye-catching emotional reaction if applicable)
3. Action/Pose (dynamic, engaging)
4. Composition (rule of thirds, subject placement for text space)
5. Lighting (dramatic, professional, attention-grabbing)
6. Color Palette (bold, high contrast colors for mobile visibility)
7. Style (photorealistic, cinematic, or specified style)
8. Background/Setting (clean, not distracting, complements subject)
9. Technical Quality (ultra detailed, sharp, professional)

PROMPT BEST PRACTICES:
• Be extremely specific and detailed (250+ words minimum)
• Use vivid, descriptive adjectives for every element
• Specify exact colors (don't say "blue" - say "electric blue" or "navy blue")
• Include precise lighting details (rim lighting, key light position, fill light, etc.)
• Describe exact camera angles and framing (close-up, medium shot, overhead, eye-level)
• Specify materials and textures (glossy, matte, metallic, fabric type)
• Include professional photography terms (bokeh, depth of field, golden hour lighting)
• Leave strategic empty space for text overlay (specify location: top third, bottom third, left/right side)
• Optimize for tiny mobile screens - bold, simple, high contrast
• Focus on ONE hero element that's instantly recognizable
• Use complementary colors that pop (orange/teal, red/green, yellow/purple)
• Create visual hierarchy with size and positioning
• Add subtle depth with foreground/background separation
• Make expressions and gestures exaggerated and clear
• Ensure the image tells a story at a glance
• Composition should allow for text without obscuring key elements

CRITICAL REQUIREMENTS:
• DO NOT include play buttons, YouTube logos, or video player UI elements
• DO NOT add text or words - this is a background image only (text will be added programmatically)
• Focus on the actual content/subject matter from the video
• Create a standalone image that works as a thumbnail background
• Make it eye-catching and scroll-stopping
• Leave strategic space for text overlay (typically top or bottom third)

EXAMPLES BY VIDEO TYPE:

Tech Tutorial:
"Ultra detailed photorealistic scene showing hands typing on mechanical keyboard with specific code editor (VS Code) visible on screen displaying Python code, glowing syntax highlighting in purple and cyan, MacBook Pro laptop with recognizable design, dramatic overhead lighting with blue and orange rim lights, dark wooden desk with specific tech accessories (wireless mouse, coffee mug, smartphone), modern minimalist home office background slightly blurred, 16:9 composition with code editor on left two-thirds leaving clean space for text overlay at top, professional commercial photography style, 8K detail, sharp focus on keyboard and screen, high contrast, no text, no UI elements"

Cooking Video:
"Photorealistic overhead shot of chef's hands sprinkling fresh basil over steaming homemade margherita pizza on rustic wooden cutting board, melted mozzarella cheese stretching, bright red tomato sauce visible, professional kitchen countertop with scattered ingredients (cherry tomatoes, basil leaves, olive oil bottle), warm golden lighting from side creating appetizing glow, shallow depth of field with blurred kitchen background, 16:9 composition with pizza centered leaving clear space at top for text overlay, commercial food photography style, ultra detailed texture on pizza crust, 8K resolution, high saturation colors, no text, no UI elements"

Product Review:
"Photorealistic shot of hands holding and examining the specific product (e.g., iPhone 15 Pro in titanium blue), visible product details and features, dramatic studio lighting with gradient background transitioning from deep blue to black, product reflection on glossy surface below, lens flare effect from side, professional commercial product photography, person's face partially visible in background showing impressed expression, 16:9 composition with product on left third, generous clean space on right for text overlay, ultra sharp focus on product, 8K detail, high contrast, bokeh background, no text, no UI elements"

Before & After / Transformation:
"Split composition showing dramatic transformation, left side showing 'before' state (dull, unimpressive, problematic), right side showing 'after' state (vibrant, impressive, solved), clear visual divide down the middle with subtle gradient or line, same person or subject in both sides for comparison, dramatic lighting difference between sides (darker on left, brighter on right), professional photography, clear facial expressions showing contrast (frustrated/uncertain on left, confident/happy on right), 16:9 composition with clean space at center top or bottom for text overlay spanning both sides, high contrast, no text, no UI elements, emphasis on the transformation journey"

Challenge / Extreme:
"Photorealistic dramatic action shot showing intense moment of challenge or danger, wide-eyed person in center frame with shocked or determined expression, dramatic background element showing the challenge (e.g., shark fin visible in water behind diver, cliff edge with extreme height visible, wild animal in background, massive wave approaching), high-energy composition with person positioned in middle third, dramatic lighting with rim lights creating separation from background, motion blur or dynamic elements suggesting action and intensity, vibrant colors with high saturation, person wearing appropriate gear for challenge (diving suit, climbing gear, protective equipment), 16:9 composition with clear space at top for bold text overlay, ultra high contrast, professional action photography style, no text, no UI elements, eye-catching and scroll-stopping impact"

Contradiction / Mind-Blowing:
"Photorealistic scene showing surprising juxtaposition or unexpected contradiction, person in center with shocked, confused, or amazed facial expression (wide eyes, open mouth, raised eyebrows), hand gestures pointing or indicating disbelief (pointing at something, hand on head, confused gesture), background showing two contrasting or contradictory elements side by side or one unexpected element that challenges expectations, dramatic lighting highlighting the contradiction, bright colors with high contrast, professional photography style with clean composition, person positioned in center or slightly off-center, 16:9 composition with clear space at top for provocative text overlay, elements that make viewer question what they see, visual that creates curiosity gap, no text, no UI elements, emphasis on creating 'wait, what?' reaction"

RETURN FORMAT (JSON only):
{
  "aiPrompt": "Your single, detailed, video-specific prompt here (250+ words)..."
}

Generate ONE perfect, comprehensive prompt that is SPECIFICALLY tailored to THIS video's unique content, not a generic thumbnail.`;
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
