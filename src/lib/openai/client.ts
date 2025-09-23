// Singleton OpenAI client to eliminate cold start delays
import OpenAI from "openai";

let openaiClient: OpenAI | null = null;

export function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("Missing OPENAI_API_KEY environment variable");
    }

    openaiClient = new OpenAI({
      apiKey,
      // Optimize for performance
      timeout: 60000, // 60 second timeout
      maxRetries: 3,
      // Keep connections alive
      httpAgent: undefined, // Let Node.js handle connection pooling
    });

    console.log("[OpenAI] Client initialized and cached for reuse");
  }

  return openaiClient;
}

// Export for cleanup if needed
export function resetOpenAIClient() {
  openaiClient = null;
}
