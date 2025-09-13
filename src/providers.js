// Minimal provider switcher for OpenAI-compatible endpoints.

import OpenAI from "openai";

export function makeClient() {
  // Choose provider by env PROVIDER or fallback to custom BASE_URL.
  const provider = (process.env.PROVIDER || "").toLowerCase();

  const presets = {
    // Local
    ollama: {
      baseURL: process.env.BASE_URL || "http://localhost:11434/v1",
      apiKey: process.env.API_KEY || "ollama" // ignored by Ollama
    },
    lmstudio: {
      baseURL: process.env.BASE_URL || "http://localhost:1234/v1",
      apiKey: process.env.API_KEY || "lmstudio"
    },

    // Hosted (OpenAI-compatible)
    deepseek: {
      baseURL: process.env.BASE_URL || "https://api.deepseek.com/v1",
      apiKey: process.env.DEEPSEEK_API_KEY
    },
    qwen: {
      // DashScope compatible-mode
      baseURL: process.env.BASE_URL || "https://dashscope.aliyuncs.com/compatible-mode/v1",
      apiKey: process.env.DASHSCOPE_API_KEY
    },
    groq: {
      baseURL: process.env.BASE_URL || "https://api.groq.com/openai/v1",
      apiKey: process.env.GROQ_API_KEY
    },
    together: {
      baseURL: process.env.BASE_URL || "https://api.together.xyz/v1",
      apiKey: process.env.TOGETHER_API_KEY
    },
    openai: {
      baseURL: process.env.BASE_URL || "https://api.openai.com/v1",
      apiKey: process.env.OPENAI_API_KEY
    },

    // Fallback: custom BASE_URL/API_KEY
    default: {
      baseURL: process.env.BASE_URL || "http://localhost:11434/v1",
      apiKey: process.env.API_KEY || "key"
    }
  };

  const cfg = presets[provider] || presets.default;

  if (!cfg.apiKey) {
    throw new Error(
      `Missing API key for provider '${provider || "default"}'. Set API_KEY or the provider-specific key env.`
    );
  }

  return new OpenAI({ baseURL: cfg.baseURL, apiKey: cfg.apiKey });
}
