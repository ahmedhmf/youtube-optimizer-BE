// Quick test for title generation
// Run with: npx ts-node test-title-generation.ts

import { PromptsService } from './src/ai/prompts.service';

const transcript = `
Welcome to this video where we'll explore the best practices for building scalable web applications.
Today I'll show you five key strategies that will help you improve your application performance.
We'll start with caching strategies, then move to database optimization, and finally discuss 
load balancing techniques. By the end of this tutorial, you'll have a complete understanding
of how to build applications that can handle millions of users.
`;

const prompt = PromptsService.getTitleRewritePrompt(
  transcript,
  'en',
  'professional',
  '5 Tips for Better Apps',
);

console.log('=== GENERATED PROMPT ===');
console.log(prompt);
console.log('\n=== EXPECTED JSON FORMAT ===');
console.log(JSON.stringify({
  titles: ['Title 1', 'Title 2', 'Title 3', 'Title 4', 'Title 5', 'Title 6', 'Title 7'],
  reasoning: 'Brief explanation...'
}, null, 2));
