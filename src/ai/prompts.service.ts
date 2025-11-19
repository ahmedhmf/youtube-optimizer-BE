import { Injectable } from '@nestjs/common';
import { YouTubeVideo } from 'src/auth/types/youtube-video.model';

@Injectable()
export class PromptsService {
  public static getVideoTitlePrompt(
    video: YouTubeVideo,
    language: string,
    tone: string,
    aiModel: string,
  ): string {
    return `You are a world-class YouTube optimization expert with deep knowledge of algorithm trends, viewer psychology, and viral content strategies.

ANALYZE THIS VIDEO:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Title: "${video.title}"
Description: "${video.description}"
Current Tags: [${video.tags?.join(', ') ?? 'None provided'}]
Target Language: ${language}
Desired Tone: ${tone}
AI Model for Thumbnails: ${aiModel}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

YOUR TASK: Generate optimized metadata that will maximize click-through rates, engagement, and searchability.

REQUIREMENTS:

📝 TITLES (Generate exactly 3 options):
• Each title MUST be 45-60 characters (optimal for mobile + desktop)
• Include power words that trigger curiosity (Secret, Ultimate, Shocking, etc.)
• Use numbers when relevant (5 Ways, Top 3, etc.)
• Create emotional hooks (fear, excitement, surprise, benefit-driven)
• Consider trending YouTube title patterns for ${tone} content
• Ensure titles match the ${language} language and cultural context

📖 DESCRIPTION (Generate 1 comprehensive description):
• Start with a compelling hook sentence (first 125 characters visible in search)
• Include 3-5 high-search-volume keywords naturally throughout
• Structure: Hook → Value proposition → What viewers will learn → Call-to-action
• Length: 150-250 words for optimal SEO
• Add strategic line breaks for readability
• Include relevant hashtags at the end (3-5 max)
• Match ${tone} voice and ${language} language

🏷️ TAGS (Generate exactly 10 strategic tags):
• Mix of broad keywords (high volume) and long-tail phrases (high intent)
• Include variations of main topic keywords
• Add trending/seasonal keywords if relevant
• Use 2-4 word phrases (most effective for YouTube algorithm)
• Prioritize tags that competitors with high views are using
• Ensure grammatical correctness in ${language}

🎨 THUMBNAIL PROMPTS (Generate exactly 3 options for ${aiModel}):
Each prompt should be detailed and specific:
• Subject positioning and expression (close-up face with [emotion])
• Visual elements (bright colors, contrast, text overlay suggestions)
• Composition style (rule of thirds, eye-catching background)
• Text overlay recommendations (3-5 words max, readable font)
• Color psychology considerations (reds/oranges for excitement, blues for trust)
• Ensure cultural appropriateness for ${language} audience

RETURN FORMAT: Valid JSON only, no explanations:
{
  "titles": ["title1", "title2", "title3"],
  "description": "complete description with proper formatting",
  "tags": ["tag1", "tag2", "tag3", "tag4", "tag5", "tag6", "tag7", "tag8", "tag9", "tag10"],
  "thumbnailPrompts": ["detailed prompt 1", "detailed prompt 2", "detailed prompt 3"]
}

OPTIMIZATION FOCUS: Prioritize click-through rate while maintaining authenticity and delivering real value to viewers.`;
  }

  public static generateVideoSuggestionsFromText(script: string) {
    return `You are a world-class YouTube optimization expert specializing in content analysis and viral video strategies. You have deep expertise in algorithm trends, viewer psychology, and SEO optimization.

ANALYZE THIS VIDEO CONTENT:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Content Type: Video Script/Transcript
Content Preview: "${script.slice(0, 500)}..."
Full Content Length: ${script.length} characters
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

YOUR MISSION: Extract the core value and create irresistible YouTube metadata that maximizes discoverability and click-through rates.

CONTENT ANALYSIS INSTRUCTIONS:
1. Identify the main topic, key insights, and unique value propositions
2. Determine the content's emotional tone and target audience
3. Extract quotable moments and compelling hooks
4. Identify trending keywords and search terms related to the content
5. Consider what would make viewers click and stay engaged

GENERATION REQUIREMENTS:

🎯 TITLES (Generate exactly 5 diverse options):
• Length: 45-60 characters each (mobile + desktop optimized)
• Style variety: Question-based, benefit-driven, curiosity-gap, how-to, list-based
• Include power words: Ultimate, Secret, Shocking, Proven, Instant, Complete
• Use numbers when relevant (5 Steps, Top 3, etc.)
• Create urgency or exclusivity when appropriate
• Each title should target different search intents
• Hook formulas: "The [adjective] [noun] that [benefit]" or "[Number] [things] [authority figure] don't want you to know"

📝 DESCRIPTION (Generate 1 comprehensive SEO description):
STRUCTURE:
• Hook Line (First 125 chars - visible in search): Start with the most compelling benefit/question
• Value Proposition (2-3 sentences): What viewers will gain/learn/discover
• Key Highlights (5 bullet points): Main takeaways using "✓" or "•" 
• Social Proof/Authority: Why this content matters or who it's for
• Call-to-Action: Subscribe/like/comment prompt
• Strategic Keywords: Naturally integrate 5-7 relevant search terms
• Length: 150-250 words total
• End with 3-5 relevant hashtags

🏷️ TAGS (Generate exactly 15 strategic tags):
• Primary Keywords (3-4): Main topic variations
• Long-tail Keywords (5-6): Specific phrases people search for
• Related Topics (3-4): Adjacent subjects that could bring traffic  
• Competitor Keywords (2-3): Terms successful videos in this niche use
• Format: 2-4 word phrases (most algorithm-friendly)
• No hashtags (#) - just the phrases
• Include both broad (high volume) and specific (high intent) terms
• Consider seasonal/trending terms if relevant

🎨 THUMBNAIL PROMPTS (Generate exactly 3 distinct options):
Each prompt should be AI-image-generator ready:

Option 1 - EMOTION FOCUSED:
"[Detailed subject description] with [specific emotion] expression, [composition style], [color scheme], [lighting], optional text overlay: '[3-5 words]'"

Option 2 - CONCEPT VISUALIZATION:
"[Visual metaphor/concept] showing [main idea], [artistic style], [visual elements], [background], text overlay: '[hook phrase]'"

Option 3 - BEFORE/AFTER or COMPARISON:
"[Split screen or comparison layout] showing [contrast/transformation], [visual style], [color psychology], text: '[benefit/result]'"

Requirements for all thumbnail prompts:
• Specify facial expressions, body language, and emotions
• Include color psychology (reds/oranges for excitement, blues for trust)
• Mention composition (close-up, wide shot, rule of thirds)
• Suggest readable text overlays (3-5 words maximum)
• Consider cultural sensitivity and broad appeal
• Ensure high contrast and mobile visibility

CONTENT CONTEXT ANALYSIS:
Based on the script content, determine:
• Target audience demographics and interests  
• Main pain points or desires addressed
• Unique angles or fresh perspectives presented
• Emotional triggers present in the content
• Authority/credibility signals to highlight

RETURN FORMAT: Valid JSON only, no additional text or explanations:
{
  "titles": ["title1", "title2", "title3", "title4", "title5"],
  "description": "complete SEO-optimized description with proper formatting and strategic keyword placement",
  "tags": ["tag1", "tag2", "tag3", "tag4", "tag5", "tag6", "tag7", "tag8", "tag9", "tag10", "tag11", "tag12", "tag13", "tag14", "tag15"],
  "thumbnailPrompts": ["detailed prompt 1 with specific visual elements", "detailed prompt 2 with different approach", "detailed prompt 3 with unique angle"]
}

OPTIMIZATION PRIORITY: Focus on maximizing click-through rate while ensuring the content delivers on the promise made in titles and thumbnails.

SCRIPT/TRANSCRIPT CONTENT:
${script.slice(0, 12000)}`;
  }
}
