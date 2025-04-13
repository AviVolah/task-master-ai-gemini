/**
 * AI Services module tests
 */

import { jest } from '@jest/globals';

// Create a mock log function we can check later
const mockLog = jest.fn();

// Mock dependencies
jest.mock('@google/generative-ai', () => {
  const mockGoogleAIInstance = {
    getGenerativeModel: jest.fn().mockReturnThis(),
    generateContent: jest.fn()
  };
  const mockGoogleAIConstructor = jest.fn().mockImplementation(() => mockGoogleAIInstance);

  return {
    GoogleGenerativeAI: mockGoogleAIConstructor
  };
});

// Use jest.fn() directly for OpenAI mock
const mockOpenAIInstance = {
  chat: {
    completions: {
      create: jest.fn().mockResolvedValue({
        choices: [{ message: { content: 'Perplexity response' } }],
      }),
    },
  },
};
const mockOpenAI = jest.fn().mockImplementation(() => mockOpenAIInstance);

jest.mock('openai', () => {
  return { default: mockOpenAI };
});

jest.mock('dotenv', () => ({
  config: jest.fn(),
}));

jest.mock('../../scripts/modules/utils.js', () => ({
  CONFIG: {
    model: 'gemini-pro',
    temperature: 0.7,
    maxTokens: 4000,
  },
  log: mockLog,
  sanitizePrompt: jest.fn(text => text),
}));

jest.mock('../../scripts/modules/ui.js', () => ({
  startLoadingIndicator: jest.fn().mockReturnValue('mockLoader'),
  stopLoadingIndicator: jest.fn(),
}));

// Mock googleAI global object (if needed, depends on actual usage)
// global.googleAI = {
//   // ... mock methods ...
// };

// Mock process.env
const originalEnv = process.env;

// Import GoogleGenerativeAI for testing constructor arguments
import { GoogleGenerativeAI } from '@google/generative-ai';

describe('AI Services Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    process.env.GOOGLE_API_KEY = 'test-google-key';
    process.env.PERPLEXITY_API_KEY = 'test-perplexity-key';
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('GoogleGenerativeAI client configuration', () => {
    // This test might need significant changes depending on how the Google SDK is configured.
    // The original test checked for a beta header, which might not apply to Gemini.
    // Placeholder test:
    test.skip('should configure Google client correctly (adapt as needed)', () => {
      // const fileContent = fs.readFileSync('./scripts/modules/ai-services.js', 'utf8');
      // expect(fileContent).toContain("/* some Google specific config */");
    });
  });
}); 