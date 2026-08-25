import type { AIProvider } from "@/lib/ai/provider";
import { AnthropicProvider } from "@/lib/ai/anthropic";

let cached: AIProvider | null = null;

/**
 * Factory for the active AI provider. Swap the implementation here (or via an
 * env switch) to change providers app-wide. Constructed lazily so the app can
 * boot without an API key present (e.g. during build).
 */
export function getAIProvider(): AIProvider {
  if (!cached) {
    cached = new AnthropicProvider();
  }
  return cached;
}

export type { AIProvider } from "@/lib/ai/provider";
