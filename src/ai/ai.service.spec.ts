import { Test, TestingModule } from '@nestjs/testing';
import { AiService } from './ai.service';
import { PromptsService } from './prompts.service';
import { YouTubeVideo } from '../auth/types/youtube-video.model';
import { AiSuggestions } from './models/ai.types';
import OpenAI from 'openai';
import * as fs from 'node:fs';

// Mock OpenAI
jest.mock('openai');
jest.mock('node:fs');

describe('AiService', () => {
  let service: AiService;
  let mockOpenAI: jest.Mocked<OpenAI>;

  // Test data setup
  const mockVideo: YouTubeVideo = {
    id: 'test-video-id',
    title: 'How to Learn JavaScript Fast',
    description: 'Complete guide to JavaScript fundamentals',
    tags: ['javascript', 'programming', 'tutorial'],
    publishedAt: '2024-01-15T10:00:00Z',
    channelId: 'test-channel-id',
    channelTitle: 'Tech Tutorials',
    thumbnails: {
      default: { url: 'https://example.com/thumb.jpg', width: 120, height: 90 },
      medium: {
        url: 'https://example.com/thumb_medium.jpg',
        width: 320,
        height: 180,
      },
      high: {
        url: 'https://example.com/thumb_high.jpg',
        width: 480,
        height: 360,
      },
    },
    duration: 'PT15M30S',
    viewCount: '1000',
    likeCount: '50',
    commentCount: '10',
  };

  const mockAiSuggestions: AiSuggestions = {
    titles: [
      'JavaScript Mastery: Learn Fast in 2024',
      'The Ultimate JavaScript Guide for Beginners',
      'JavaScript Secrets Every Developer Needs',
    ],
    description:
      'Master JavaScript with this comprehensive guide! Learn fundamentals, best practices, and advanced techniques.\n\n✓ Complete beginner-friendly tutorial\n✓ Real-world examples\n✓ Expert tips and tricks\n\n#JavaScript #Programming #WebDev',
    tags: [
      'javascript tutorial',
      'learn javascript',
      'programming basics',
      'web development',
      'coding tutorial',
      'javascript fundamentals',
      'beginner programming',
      'javascript course',
      'programming guide',
      'javascript tips',
    ],
    thumbnailPrompts: [
      'Close-up of excited developer with laptop, bright blue background, text overlay "LEARN JS FAST"',
      'Split screen showing code editor and final website result, modern tech aesthetic',
      'Professional developer pointing at JavaScript logo, confident expression, vibrant colors',
    ],
  };

  beforeEach(async () => {
    const mockOpenAIInstance = {
      chat: {
        completions: {
          create: jest.fn(),
        },
      },
      audio: {
        transcriptions: {
          create: jest.fn(),
        },
      },
    };

    (OpenAI as jest.MockedClass<typeof OpenAI>).mockImplementation(
      () => mockOpenAIInstance as any,
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiService,
        {
          provide: PromptsService,
          useValue: {
            getVideoTitlePrompt: jest.fn(),
            generateVideoSuggestionsFromText: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AiService>(AiService);
    mockOpenAI = mockOpenAIInstance as any;

    // Set up environment variable
    process.env.OPENAI_API_KEY = 'test-api-key';
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('generateVideoSuggestions', () => {
    const language = 'english';
    const tone = 'professional';
    const aiModel = 'gpt-4';

    beforeEach(() => {
      jest
        .spyOn(PromptsService, 'getVideoTitlePrompt')
        .mockReturnValue('test prompt');
    });

    it('should generate video suggestions successfully', async () => {
      // Arrange
      const mockResponse = {
        choices: [
          {
            message: {
              content: `Here are the suggestions: ${JSON.stringify(mockAiSuggestions)}`,
            },
          },
        ],
      };
      mockOpenAI.chat.completions.create.mockResolvedValue(mockResponse as any);

      // Act
      const result = await service.generateVideoSuggestions(
        mockVideo,
        language,
        tone,
        aiModel,
      );

      // Assert
      expect(PromptsService.getVideoTitlePrompt).toHaveBeenCalledWith(
        mockVideo,
        language,
        tone,
        aiModel,
      );
      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: 'test prompt' }],
        temperature: 0.7,
      });
      expect(result).toEqual(mockAiSuggestions);
    });

    it('should handle JSON response wrapped in markdown', async () => {
      // Arrange
      const mockResponse = {
        choices: [
          {
            message: {
              content: `\`\`\`json\n${JSON.stringify(mockAiSuggestions)}\n\`\`\``,
            },
          },
        ],
      };
      mockOpenAI.chat.completions.create.mockResolvedValue(mockResponse as any);

      // Act
      const result = await service.generateVideoSuggestions(
        mockVideo,
        language,
        tone,
        aiModel,
      );

      // Assert
      expect(result).toEqual(mockAiSuggestions);
    });

    it('should handle partial AI response with missing fields', async () => {
      // Arrange
      const partialResponse = {
        titles: ['Single Title'],
        description: 'Only description',
        // Missing tags and thumbnailPrompts
      };
      const mockResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify(partialResponse),
            },
          },
        ],
      };
      mockOpenAI.chat.completions.create.mockResolvedValue(mockResponse as any);

      // Act
      const result = await service.generateVideoSuggestions(
        mockVideo,
        language,
        tone,
        aiModel,
      );

      // Assert
      expect(result).toEqual({
        titles: ['Single Title'],
        description: 'Only description',
        tags: [],
        thumbnailPrompts: [],
      });
    });

    it('should handle empty AI response', async () => {
      // Arrange
      const mockResponse = {
        choices: [
          {
            message: {
              content: '',
            },
          },
        ],
      };
      mockOpenAI.chat.completions.create.mockResolvedValue(mockResponse as any);

      // Act
      const result = await service.generateVideoSuggestions(
        mockVideo,
        language,
        tone,
        aiModel,
      );

      // Assert
      expect(result).toEqual({
        titles: [],
        description: '',
        tags: [],
        thumbnailPrompts: [],
      });
    });

    it('should handle malformed JSON in AI response', async () => {
      // Arrange
      const mockResponse = {
        choices: [
          {
            message: {
              content: '{ "titles": ["test" } invalid json',
            },
          },
        ],
      };
      mockOpenAI.chat.completions.create.mockResolvedValue(mockResponse as any);

      // Act
      const result = await service.generateVideoSuggestions(
        mockVideo,
        language,
        tone,
        aiModel,
      );

      // Assert
      expect(result).toEqual({
        titles: [],
        description: '',
        tags: [],
        thumbnailPrompts: [],
      });
    });

    it('should handle OpenAI API failure', async () => {
      // Arrange
      const apiError = new Error('OpenAI API Error');
      mockOpenAI.chat.completions.create.mockRejectedValue(apiError);

      // Act
      const result = await service.generateVideoSuggestions(
        mockVideo,
        language,
        tone,
        aiModel,
      );

      // Assert
      expect(result).toEqual({
        titles: [],
        description: '',
        tags: [],
        thumbnailPrompts: [],
      });
    });

    it('should handle network timeout', async () => {
      // Arrange
      const timeoutError = new Error('Network timeout');
      mockOpenAI.chat.completions.create.mockRejectedValue(timeoutError);

      // Act
      const result = await service.generateVideoSuggestions(
        mockVideo,
        language,
        tone,
        aiModel,
      );

      // Assert
      expect(result).toEqual({
        titles: [],
        description: '',
        tags: [],
        thumbnailPrompts: [],
      });
    });
  });

  describe('transcribeLocalFile', () => {
    const mockFilePath = '/tmp/test-audio.mp3';

    beforeEach(() => {
      const mockFileStream = {} as any;
      (fs.createReadStream as jest.Mock).mockReturnValue(mockFileStream);
    });

    it('should transcribe audio file successfully', async () => {
      // Arrange
      const expectedTranscript = 'Hello world, this is a test transcript.';
      const mockResponse = {
        text: expectedTranscript,
      };
      mockOpenAI.audio.transcriptions.create.mockResolvedValue(
        mockResponse as any,
      );

      // Act
      const result = await service.transcribeLocalFile(mockFilePath);

      // Assert
      expect(fs.createReadStream).toHaveBeenCalledWith(mockFilePath);
      expect(mockOpenAI.audio.transcriptions.create).toHaveBeenCalledWith({
        file: expect.any(Object),
        model: 'whisper-1',
      });
      expect(result).toBe(expectedTranscript);
    });

    it('should handle empty transcript response', async () => {
      // Arrange
      const mockResponse = {
        text: '',
      };
      mockOpenAI.audio.transcriptions.create.mockResolvedValue(
        mockResponse as any,
      );

      // Act
      const result = await service.transcribeLocalFile(mockFilePath);

      // Assert
      expect(result).toBe('');
    });

    it('should handle null transcript response', async () => {
      // Arrange
      const mockResponse = {
        text: null,
      };
      mockOpenAI.audio.transcriptions.create.mockResolvedValue(
        mockResponse as any,
      );

      // Act
      const result = await service.transcribeLocalFile(mockFilePath);

      // Assert
      expect(result).toBe('');
    });

    it('should handle file read error', async () => {
      // Arrange
      const fileError = new Error('File not found');
      (fs.createReadStream as jest.Mock).mockImplementation(() => {
        throw fileError;
      });

      // Act & Assert
      await expect(service.transcribeLocalFile(mockFilePath)).rejects.toThrow(
        'File not found',
      );
    });

    it('should handle Whisper API error', async () => {
      // Arrange
      const whisperError = new Error('Whisper API Error');
      mockOpenAI.audio.transcriptions.create.mockRejectedValue(whisperError);

      // Act & Assert
      await expect(service.transcribeLocalFile(mockFilePath)).rejects.toThrow(
        'Whisper API Error',
      );
    });

    it('should handle unsupported file format', async () => {
      // Arrange
      const formatError = new Error('Unsupported audio format');
      mockOpenAI.audio.transcriptions.create.mockRejectedValue(formatError);

      // Act & Assert
      await expect(service.transcribeLocalFile(mockFilePath)).rejects.toThrow(
        'Unsupported audio format',
      );
    });
  });

  describe('summarizeTranscript', () => {
    const mockTranscript =
      'This is a long transcript about JavaScript programming. It covers variables, functions, and objects in detail. The tutorial is aimed at beginners who want to learn web development.';

    it('should summarize transcript successfully', async () => {
      // Arrange
      const expectedSummary = `• Topic: JavaScript programming fundamentals
• Target Audience: Beginners in web development
• Key Concepts: Variables, functions, and objects
• Format: Educational tutorial content
• Value Proposition: Comprehensive learning resource`;

      const mockResponse = {
        choices: [
          {
            message: {
              content: expectedSummary,
            },
          },
        ],
      };
      mockOpenAI.chat.completions.create.mockResolvedValue(mockResponse as any);

      // Act
      const result = await service.summarizeTranscript(mockTranscript);

      // Assert
      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content:
              'You are a YouTube content strategist. \n        Summarize the transcript into 5 bullet points capturing topic, angle, value, and notable moments.',
          },
          {
            role: 'user',
            content: mockTranscript,
          },
        ],
        temperature: 0.3,
      });
      expect(result).toBe(expectedSummary);
    });

    it('should truncate long transcripts to 15000 characters', async () => {
      // Arrange
      const longTranscript = 'a'.repeat(20000);
      const mockResponse = {
        choices: [
          {
            message: {
              content: 'Summary of truncated content',
            },
          },
        ],
      };
      mockOpenAI.chat.completions.create.mockResolvedValue(mockResponse as any);

      // Act
      await service.summarizeTranscript(longTranscript);

      // Assert
      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              role: 'user',
              content: longTranscript.slice(0, 15000),
            }),
          ]),
        }),
      );
    });

    it('should handle empty summary response', async () => {
      // Arrange
      const mockResponse = {
        choices: [
          {
            message: {
              content: '',
            },
          },
        ],
      };
      mockOpenAI.chat.completions.create.mockResolvedValue(mockResponse as any);

      // Act
      const result = await service.summarizeTranscript(mockTranscript);

      // Assert
      expect(result).toBe('');
    });

    it('should handle null summary response', async () => {
      // Arrange
      const mockResponse = {
        choices: [
          {
            message: {
              content: null,
            },
          },
        ],
      };
      mockOpenAI.chat.completions.create.mockResolvedValue(mockResponse as any);

      // Act
      const result = await service.summarizeTranscript(mockTranscript);

      // Assert
      expect(result).toBe('');
    });

    it('should handle API error during summarization', async () => {
      // Arrange
      const apiError = new Error('OpenAI API Error');
      mockOpenAI.chat.completions.create.mockRejectedValue(apiError);

      // Act & Assert
      await expect(service.summarizeTranscript(mockTranscript)).rejects.toThrow(
        'OpenAI API Error',
      );
    });
  });

  describe('generateVideoSuggestionsFromText', () => {
    const mockScript =
      'Welcome to our JavaScript tutorial. Today we will learn about variables, functions, and how to build your first web application.';

    beforeEach(() => {
      jest
        .spyOn(PromptsService, 'generateVideoSuggestionsFromText')
        .mockReturnValue('test script prompt');
    });

    it('should generate suggestions from script successfully', async () => {
      // Arrange
      const mockResponse = {
        choices: [
          {
            message: {
              content: `Analysis complete: ${JSON.stringify(mockAiSuggestions)}`,
            },
          },
        ],
      };
      mockOpenAI.chat.completions.create.mockResolvedValue(mockResponse as any);

      // Act
      const result = await service.generateVideoSuggestionsFromText(mockScript);

      // Assert
      expect(
        PromptsService.generateVideoSuggestionsFromText,
      ).toHaveBeenCalledWith(mockScript);
      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: 'test script prompt' }],
        temperature: 0.7,
      });
      expect(result).toEqual(mockAiSuggestions);
    });

    it('should handle nested JSON in response', async () => {
      // Arrange
      const nestedResponse = {
        analysis: 'Script analyzed successfully',
        suggestions: mockAiSuggestions,
      };
      const mockResponse = {
        choices: [
          {
            message: {
              content: `Result: ${JSON.stringify(nestedResponse)}`,
            },
          },
        ],
      };
      mockOpenAI.chat.completions.create.mockResolvedValue(mockResponse as any);

      // Act
      const result = await service.generateVideoSuggestionsFromText(mockScript);

      // Assert - Should gracefully return empty response
      expect(result).toEqual({
        titles: [],
        description: '',
        tags: [],
        thumbnailPrompts: [],
      });
    });

    it('should handle malformed JSON gracefully', async () => {
      // Arrange
      const mockResponse = {
        choices: [
          {
            message: {
              content: 'Invalid { json format here',
            },
          },
        ],
      };
      mockOpenAI.chat.completions.create.mockResolvedValue(mockResponse as any);

      // Act & Assert
      await expect(
        service.generateVideoSuggestionsFromText(mockScript),
      ).rejects.toThrow();
    });

    it('should handle empty script input', async () => {
      // Arrange
      const emptyScript = '';
      const mockResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                titles: ['Default Title'],
                description: 'Default description',
                tags: ['default'],
                thumbnailPrompts: ['Default thumbnail'],
              }),
            },
          },
        ],
      };
      mockOpenAI.chat.completions.create.mockResolvedValue(mockResponse as any);

      // Act
      const result =
        await service.generateVideoSuggestionsFromText(emptyScript);

      // Assert
      expect(
        PromptsService.generateVideoSuggestionsFromText,
      ).toHaveBeenCalledWith(emptyScript);
      expect(result.titles).toEqual(['Default Title']);
    });

    it('should handle very long scripts', async () => {
      // Arrange
      const longScript = 'javascript tutorial '.repeat(1000);
      const mockResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify(mockAiSuggestions),
            },
          },
        ],
      };
      mockOpenAI.chat.completions.create.mockResolvedValue(mockResponse as any);

      // Act
      const result = await service.generateVideoSuggestionsFromText(longScript);

      // Assert
      expect(result).toEqual(mockAiSuggestions);
      expect(
        PromptsService.generateVideoSuggestionsFromText,
      ).toHaveBeenCalledWith(longScript);
    });

    it('should handle API rate limiting', async () => {
      // Arrange
      const rateLimitError = new Error('Rate limit exceeded');
      mockOpenAI.chat.completions.create.mockRejectedValue(rateLimitError);

      // Act & Assert
      await expect(
        service.generateVideoSuggestionsFromText(mockScript),
      ).rejects.toThrow('Rate limit exceeded');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle undefined OpenAI API key', () => {
      // Arrange
      delete process.env.OPENAI_API_KEY;

      // Act & Assert
      expect(() => new AiService()).not.toThrow();
      expect(OpenAI).toHaveBeenCalledWith({ apiKey: undefined });
    });

    it('should handle concurrent API calls', async () => {
      // Arrange
      const mockResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify(mockAiSuggestions),
            },
          },
        ],
      };
      mockOpenAI.chat.completions.create.mockResolvedValue(mockResponse as any);
      jest
        .spyOn(PromptsService, 'getVideoTitlePrompt')
        .mockReturnValue('test prompt');

      // Act
      const promises = Array(5)
        .fill(null)
        .map(() =>
          service.generateVideoSuggestions(
            mockVideo,
            'english',
            'professional',
            'gpt-4',
          ),
        );
      const results = await Promise.all(promises);

      // Assert
      expect(results).toHaveLength(5);
      results.forEach((result) => {
        expect(result).toEqual(mockAiSuggestions);
      });
      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledTimes(5);
    });

    it('should handle special characters in video data', async () => {
      // Arrange
      const specialCharVideo = {
        ...mockVideo,
        title: 'How to Learn JS 💻 "Quotes" & Special chars: <>{}[]',
        description: 'Description with émojis 🚀 and spéciâl characters',
      };
      const mockResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify(mockAiSuggestions),
            },
          },
        ],
      };
      mockOpenAI.chat.completions.create.mockResolvedValue(mockResponse as any);
      jest
        .spyOn(PromptsService, 'getVideoTitlePrompt')
        .mockReturnValue('test prompt');

      // Act
      const result = await service.generateVideoSuggestions(
        specialCharVideo,
        'english',
        'professional',
        'gpt-4',
      );

      // Assert
      expect(result).toEqual(mockAiSuggestions);
      expect(PromptsService.getVideoTitlePrompt).toHaveBeenCalledWith(
        specialCharVideo,
        'english',
        'professional',
        'gpt-4',
      );
    });
  });
});
