import type { AIProvider, Env } from "../types";
import { GeminiProvider } from "./gemini";

export function getAIProvider(env: Env): AIProvider {
  return new GeminiProvider(env);
}
