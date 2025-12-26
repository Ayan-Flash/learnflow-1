import { GoogleGenerativeAI, type GenerationConfig } from "@google/generative-ai";

import type { DepthConfig } from "./depthEngine";

export interface GeminiResult {
  text: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
  model: string;
}

const approximateTokenCount = (text: string): number => {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  const parts = trimmed.match(/[\p{L}\p{N}]+|[^\s\p{L}\p{N}]/gu);
  return parts ? parts.length : Math.ceil(trimmed.length / 4);
};

export class GeminiClient {
  private readonly genAI: GoogleGenerativeAI;
  private readonly modelName: string;

  constructor(apiKey: string, modelName: string) {
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.modelName = modelName;
  }

  async generate(prompt: string, depth: DepthConfig): Promise<GeminiResult> {
    const model = this.genAI.getGenerativeModel({ model: this.modelName });

    const generationConfig: GenerationConfig = {
      temperature: depth.temperature,
      maxOutputTokens: depth.max_output_tokens,
      topP: 0.9,
      topK: 40
    };

    const inputTokensApprox = approximateTokenCount(prompt);

    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig
    });

    const response = result.response;
    const text = response.text();

    const usage = (response as unknown as { usageMetadata?: any }).usageMetadata;
    const input_tokens =
      typeof usage?.promptTokenCount === "number" ? usage.promptTokenCount : inputTokensApprox;
    const output_tokens =
      typeof usage?.candidatesTokenCount === "number"
        ? usage.candidatesTokenCount
        : approximateTokenCount(text);

    return {
      text,
      usage: { input_tokens, output_tokens },
      model: this.modelName
    };
  }
}

export const createGeminiClientFromEnv = (): GeminiClient => {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) throw new Error("Missing GOOGLE_API_KEY");
  const modelName = process.env.GEMINI_MODEL || "gemini-1.5-flash";
  return new GeminiClient(apiKey, modelName);
};
