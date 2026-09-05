import OpenAI from "openai";

let instance: OpenAI | null = null;

export function isAIConfigured(): boolean {
  return Boolean(process.env.AI_API_KEY?.trim());
}

export function getAIClient(): OpenAI {
  if (!instance) {
    const apiKey = process.env.AI_API_KEY?.trim();
    if (!apiKey) {
      throw new Error("AI_API_KEY is not configured.");
    }
    instance = new OpenAI({ apiKey });
  }
  return instance;
}

export function getAIModel(): string {
  return process.env.AI_MODEL?.trim() || "gpt-4o-mini";
}
