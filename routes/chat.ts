import OpenAI from "openai";
import utils from "./utils";
import { AiConfig, AiConfigError, getAiClient, getAiConfig } from "../config/ai";
import { runAssistant, sanitizeHistory } from "../services/assistant";
import { TaskInputError, deleteTasks } from "../services/tasks";
const authMiddleware = require("../middleware/auth");
const { apiResponse } = utils;

const express = require("express");
const app = express.Router();

const CLIENT_NOW_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
const TIME_ZONE_RE = /^[A-Za-z0-9_+\-/]{1,64}$/;

const errorResponse = (message: string, code: string, extra: Record<string, unknown> = {}) => ({
  ...apiResponse({ message, error: { message, code } }),
  ...extra,
});

const serverNowUtc = () => new Date().toISOString().slice(0, 16);

/** Maps model-provider failures to messages; local (Ollama) errors include how to fix them. */
function providerErrorResponse(error: unknown, config: AiConfig) {
  const isLocal = config.provider === "ollama";

  if (error instanceof OpenAI.RateLimitError) {
    const retryAfter = Number(error.headers?.get("retry-after")) || undefined;
    return errorResponse("The AI assistant is busy right now. Please try again in a moment.", "429", { retryAfter });
  }
  if (error instanceof OpenAI.APIConnectionError) {
    console.error(`Can't reach the AI model at ${config.baseURL}:`, error.message);
    return errorResponse(
      isLocal
        ? `Can't reach the local AI model at ${config.baseURL}. Make sure Ollama is running (ollama serve).`
        : "Couldn't reach the AI service. Please try again.",
      "503"
    );
  }
  if (error instanceof OpenAI.APIError) {
    console.error(`AI provider error (${config.provider}, ${config.model})`, error.status, error.message);
    if (isLocal && error instanceof OpenAI.NotFoundError) {
      return errorResponse(
        `The model "${config.model}" isn't available in Ollama. Pull it with: ollama pull ${config.model}`,
        "503"
      );
    }
    return errorResponse(
      isLocal
        ? `The local model "${config.model}" returned an error: ${error.message}`
        : "The AI assistant couldn't respond. Please try again.",
      "502"
    );
  }
  return null;
}

app.use(authMiddleware);

// chat with the task assistant
app.post("/", async (req: any, res: any) => {
  let config: AiConfig;
  try {
    config = getAiConfig();
  } catch (error) {
    if (!(error instanceof AiConfigError)) throw error;
    console.error("AI assistant is not configured:", error.message);
    res.send(errorResponse("The AI assistant isn't set up on the server yet.", "503"));
    return;
  }

  try {
    const history = sanitizeHistory(req.body?.messages);
    const clientNow = req.body?.clientNow;
    const timeZone = req.body?.timeZone;
    const result = await runAssistant({
      client: getAiClient(config),
      model: config.model,
      temperature: config.temperature,
      userId: req.user.id,
      history,
      now: typeof clientNow === "string" && CLIENT_NOW_RE.test(clientNow) ? clientNow : serverNowUtc(),
      timeZone: typeof timeZone === "string" && TIME_ZONE_RE.test(timeZone) ? timeZone : "UTC",
    });
    res.status(200).json({ message: "Assistant replied", ...result });
  } catch (error: any) {
    if (error instanceof TaskInputError) {
      res.send(errorResponse(error.message, "400"));
      return;
    }
    const providerError = providerErrorResponse(error, config);
    if (providerError) {
      res.send(providerError);
      return;
    }
    console.error("Error in assistant chat", error);
    res.send(errorResponse("Something went wrong. Please try again.", "500"));
  }
});

// run an action the user confirmed in the chat (currently: deleting tasks)
app.post("/confirm", async (req: any, res: any) => {
  try {
    if (req.body?.action?.type !== "delete") {
      throw new TaskInputError("Unsupported action");
    }
    const deleted = await deleteTasks(req.user.id, req.body.action.taskIds);
    res.status(200).json({
      message: deleted.length ? "Tasks deleted successfully" : "Nothing to delete",
      deleted,
      changed: deleted.length > 0,
    });
  } catch (error: any) {
    if (error instanceof TaskInputError) {
      res.send(errorResponse(error.message, "400"));
    } else {
      console.error("Error in confirming assistant action", error);
      res.send(errorResponse("Something went wrong. Please try again.", "500"));
    }
  }
});

const chatRouter = app;
export default chatRouter;
