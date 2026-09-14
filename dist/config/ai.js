"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AiConfigError = void 0;
exports.getAiConfig = getAiConfig;
exports.getAiClient = getAiClient;
exports.describeAiConfig = describeAiConfig;
const openai_1 = __importDefault(require("openai"));
const GROQ_BASE_URL = "https://api.groq.com/openai/v1";
const DEFAULT_GROQ_MODEL = "openai/gpt-oss-120b";
const DEFAULT_OLLAMA_BASE_URL = "http://localhost:11434/v1";
const DEFAULT_OLLAMA_MODEL = "llama3.2:3b";
/** The assistant's environment variables are missing or invalid. */
class AiConfigError extends Error {
}
exports.AiConfigError = AiConfigError;
function getAiConfig(env = process.env) {
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
let cachedClient = null;
function getAiClient(config) {
    const key = `${config.provider}|${config.baseURL}|${config.apiKey}`;
    if (!cachedClient || cachedClient.key !== key) {
        const isLocal = config.provider === "ollama";
        cachedClient = {
            key,
            client: new openai_1.default({
                baseURL: config.baseURL,
                apiKey: config.apiKey,
                // Local models can take a while to load on the first request; retrying
                // a local server that isn't running just delays the error.
                timeout: isLocal ? 120000 : 60000,
                maxRetries: isLocal ? 0 : 2,
            }),
        };
    }
    return cachedClient.client;
}
/** One-line summary for the startup log, e.g. "ollama (llama3.2:3b at http://localhost:11434/v1)". */
function describeAiConfig(env = process.env) {
    try {
        const config = getAiConfig(env);
        return config.provider === "ollama"
            ? `ollama (${config.model} at ${config.baseURL})`
            : `groq (${config.model})`;
    }
    catch (error) {
        return `not configured (${error.message})`;
    }
}
//# sourceMappingURL=ai.js.map