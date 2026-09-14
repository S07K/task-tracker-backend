import Groq from "groq-sdk";
import utils from "./utils";
import { runAssistant, sanitizeHistory } from "../services/assistant";
import { TaskInputError, deleteTasks } from "../services/tasks";
const authMiddleware = require("../middleware/auth");
const { apiResponse } = utils;

const express = require("express");
const app = express.Router();

const DEFAULT_MODEL = "openai/gpt-oss-120b";
const CLIENT_NOW_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
const TIME_ZONE_RE = /^[A-Za-z0-9_+\-/]{1,64}$/;

let groqClient: Groq | null = null;
const getGroqClient = (): Groq | null => {
  if (!process.env.GROQ_API_KEY) return null;
  if (!groqClient) groqClient = new Groq({ apiKey: process.env.GROQ_API_KEY });
  return groqClient;
};

const errorResponse = (message: string, code: string, extra: Record<string, unknown> = {}) => ({
  ...apiResponse({ message, error: { message, code } }),
  ...extra,
});

const serverNowUtc = () => new Date().toISOString().slice(0, 16);

app.use(authMiddleware);

// chat with the task assistant
app.post("/", async (req: any, res: any) => {
  const client = getGroqClient();
  if (!client) {
    res.send(errorResponse("The AI assistant isn't set up on the server yet.", "503"));
    return;
  }

  try {
    const history = sanitizeHistory(req.body?.messages);
    const clientNow = req.body?.clientNow;
    const timeZone = req.body?.timeZone;
    const result = await runAssistant({
      client,
      model: process.env.GROQ_MODEL || DEFAULT_MODEL,
      userId: req.user.id,
      history,
      now: typeof clientNow === "string" && CLIENT_NOW_RE.test(clientNow) ? clientNow : serverNowUtc(),
      timeZone: typeof timeZone === "string" && TIME_ZONE_RE.test(timeZone) ? timeZone : "UTC",
    });
    res.status(200).json({ message: "Assistant replied", ...result });
  } catch (error: any) {
    if (error instanceof TaskInputError) {
      res.send(errorResponse(error.message, "400"));
    } else if (error instanceof Groq.RateLimitError) {
      const retryAfter = Number(error.headers?.get("retry-after")) || undefined;
      res.send(
        errorResponse("The AI assistant is busy right now. Please try again in a moment.", "429", { retryAfter })
      );
    } else if (error instanceof Groq.APIError) {
      console.error("Groq API error", error.status, error.message);
      res.send(errorResponse("The AI assistant couldn't respond. Please try again.", "502"));
    } else {
      console.error("Error in assistant chat", error);
      res.send(errorResponse("Something went wrong. Please try again.", "500"));
    }
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
