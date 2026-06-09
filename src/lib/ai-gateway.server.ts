import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

export function createOpenAiProvider(apiKey: string, baseURL = "https://api.openai.com/v1") {
  return createOpenAICompatible({
    name: "openai",
    baseURL,
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });
}
