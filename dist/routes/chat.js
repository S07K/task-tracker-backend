"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const openai_1 = __importDefault(require("openai"));
const utils_1 = __importDefault(require("./utils"));
const ai_1 = require("../config/ai");
const assistant_1 = require("../services/assistant");
const tasks_1 = require("../services/tasks");
const authMiddleware = require("../middleware/auth");
const { apiResponse } = utils_1.default;
const express = require("express");
const app = express.Router();
const CLIENT_NOW_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
const TIME_ZONE_RE = /^[A-Za-z0-9_+\-/]{1,64}$/;
const errorResponse = (message, code, extra = {}) => (Object.assign(Object.assign({}, apiResponse({ message, error: { message, code } })), extra));
const serverNowUtc = () => new Date().toISOString().slice(0, 16);
/** Maps model-provider failures to messages; local (Ollama) errors include how to fix them. */
function providerErrorResponse(error, config) {
    var _a;
    const isLocal = config.provider === "ollama";
    if (error instanceof openai_1.default.RateLimitError) {
        const retryAfter = Number((_a = error.headers) === null || _a === void 0 ? void 0 : _a.get("retry-after")) || undefined;
        return errorResponse("The AI assistant is busy right now. Please try again in a moment.", "429", { retryAfter });
    }
    if (error instanceof openai_1.default.APIConnectionError) {
        console.error(`Can't reach the AI model at ${config.baseURL}:`, error.message);
        return errorResponse(isLocal
            ? `Can't reach the local AI model at ${config.baseURL}. Make sure Ollama is running (ollama serve).`
            : "Couldn't reach the AI service. Please try again.", "503");
    }
    if (error instanceof openai_1.default.APIError) {
        console.error(`AI provider error (${config.provider}, ${config.model})`, error.status, error.message);
        if (isLocal && error instanceof openai_1.default.NotFoundError) {
            return errorResponse(`The model "${config.model}" isn't available in Ollama. Pull it with: ollama pull ${config.model}`, "503");
        }
        return errorResponse(isLocal
            ? `The local model "${config.model}" returned an error: ${error.message}`
            : "The AI assistant couldn't respond. Please try again.", "502");
    }
    return null;
}
app.use(authMiddleware);
// chat with the task assistant
app.post("/", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c;
    let config;
    try {
        config = (0, ai_1.getAiConfig)();
    }
    catch (error) {
        if (!(error instanceof ai_1.AiConfigError))
            throw error;
        console.error("AI assistant is not configured:", error.message);
        res.send(errorResponse("The AI assistant isn't set up on the server yet.", "503"));
        return;
    }
    try {
        const history = (0, assistant_1.sanitizeHistory)((_a = req.body) === null || _a === void 0 ? void 0 : _a.messages);
        const clientNow = (_b = req.body) === null || _b === void 0 ? void 0 : _b.clientNow;
        const timeZone = (_c = req.body) === null || _c === void 0 ? void 0 : _c.timeZone;
        const result = yield (0, assistant_1.runAssistant)({
            client: (0, ai_1.getAiClient)(config),
            model: config.model,
            temperature: config.temperature,
            userId: req.user.id,
            history,
            now: typeof clientNow === "string" && CLIENT_NOW_RE.test(clientNow) ? clientNow : serverNowUtc(),
            timeZone: typeof timeZone === "string" && TIME_ZONE_RE.test(timeZone) ? timeZone : "UTC",
        });
        res.status(200).json(Object.assign({ message: "Assistant replied" }, result));
    }
    catch (error) {
        if (error instanceof tasks_1.TaskInputError) {
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
}));
// run an action the user confirmed in the chat (currently: deleting tasks)
app.post("/confirm", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    try {
        if (((_b = (_a = req.body) === null || _a === void 0 ? void 0 : _a.action) === null || _b === void 0 ? void 0 : _b.type) !== "delete") {
            throw new tasks_1.TaskInputError("Unsupported action");
        }
        const deleted = yield (0, tasks_1.deleteTasks)(req.user.id, req.body.action.taskIds);
        res.status(200).json({
            message: deleted.length ? "Tasks deleted successfully" : "Nothing to delete",
            deleted,
            changed: deleted.length > 0,
        });
    }
    catch (error) {
        if (error instanceof tasks_1.TaskInputError) {
            res.send(errorResponse(error.message, "400"));
        }
        else {
            console.error("Error in confirming assistant action", error);
            res.send(errorResponse("Something went wrong. Please try again.", "500"));
        }
    }
}));
const chatRouter = app;
exports.default = chatRouter;
//# sourceMappingURL=chat.js.map