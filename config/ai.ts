import OpenAI from "openai";

/**
 * Model settings for the AI assistant. Groq and Ollama both serve the
 * OpenAI-compatible chat completions API, so one client works for either.
 *
 * - AI_PROVIDER=groq (default): hosted Groq. Needs GROQ_API_KEY; GROQ_MODEL is optional.
 * - AI_PROVIDER=ollama: a local Ollama model for development. OLLAMA_BASE_URL and
 *   OLLAMA_MODEL are optional.
 */
export type AiProvider = "groq" | "ollama";

export interface AiConfig {
  provider: AiProvider;
  baseURL: string;
  apiKey: string;
  model: string;
  /** Sampling temperature; unset uses the provider's default. */
  temperature?: number;
}

const GROQ_BASE_URL = "https://api.groq.com/openai/v1";
const DEFAULT_GROQ_MODEL = "openai/gpt-oss-120b";
const DEFAULT_OLLAMA_BASE_URL = "http://localhost:11434/v1";
const DEFAULT_OLLAMA_MODEL = "llama3.2:3b";

/** The assistant's environment variables are missing or invalid. */
export class AiConfigError extends Error {}

export function getAiConfig(env: NodeJS.ProcessEnv = process.env): AiConfig {
  const provider = (env.AI_PROVIDER || "groq").trim().toLowerCase();

  if (provider === "ollama") {
    return {
      provider: "ollama",
      baseURL: env.OLLAMA_BASE_URL || DEFAULT_OLLAMA_BASE_URL,
      // Ollama ignores the key, but the client requires one.
      apiKey: "ollama",
      model: env.OLLAMA_MODEL || DEFAULT_OLLAMA_MODEL,
      // Small local models produce more consistent tool arguments at a low temperature.
      temperature: 0.2,
    };
  }

  if (provider !== "groq") {
    throw new AiConfigError(`Unknown AI_PROVIDER "${provider}"; use "groq" or "ollama"`);
  }
  if (!env.GROQ_API_KEY) {
    throw new AiConfigError("GROQ_API_KEY is not set");
  }
  return {
    provider: "groq",
    baseURL: GROQ_BASE_URL,
    apiKey: env.GROQ_API_KEY,
    model: env.GROQ_MODEL || DEFAULT_GROQ_MODEL,
  };
}

let cachedClient: { key: string; client: OpenAI } | null = null;

export function getAiClient(config: AiConfig): OpenAI {
  const key = `${config.provider}|${config.baseURL}|${config.apiKey}`;
  if (!cachedClient || cachedClient.key !== key) {
    const isLocal = config.provider === "ollama";
    cachedClient = {
      key,
      client: new OpenAI({
        baseURL: config.baseURL,
        apiKey: config.apiKey,
        // Local models can take a while to load on the first request; retrying
        // a local server that isn't running just delays the error.
        timeout: isLocal ? 120_000 : 60_000,
        maxRetries: isLocal ? 0 : 2,
      }),
    };
  }
  return cachedClient.client;
}

/** One-line summary for the startup log, e.g. "ollama (llama3.2:3b at http://localhost:11434/v1)". */
export function describeAiConfig(env: NodeJS.ProcessEnv = process.env): string {
  try {
    const config = getAiConfig(env);
    return config.provider === "ollama"
      ? `ollama (${config.model} at ${config.baseURL})`
      : `groq (${config.model})`;
  } catch (error) {
    return `not configured (${(error as Error).message})`;
  }
}
