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
const groq_sdk_1 = __importDefault(require("groq-sdk"));
const utils_1 = __importDefault(require("./utils"));
const assistant_1 = require("../services/assistant");
const tasks_1 = require("../services/tasks");
const authMiddleware = require("../middleware/auth");
const { apiResponse } = utils_1.default;
const express = require("express");
const app = express.Router();
const DEFAULT_MODEL = "openai/gpt-oss-120b";
const CLIENT_NOW_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
const TIME_ZONE_RE = /^[A-Za-z0-9_+\-/]{1,64}$/;
let groqClient = null;
const getGroqClient = () => {
    if (!process.env.GROQ_API_KEY)
        return null;
    if (!groqClient)
        groqClient = new groq_sdk_1.default({ apiKey: process.env.GROQ_API_KEY });
    return groqClient;
};
const errorResponse = (message, code, extra = {}) => (Object.assign(Object.assign({}, apiResponse({ message, error: { message, code } })), extra));
const serverNowUtc = () => new Date().toISOString().slice(0, 16);
app.use(authMiddleware);
// chat with the task assistant
app.post("/", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d;
    const client = getGroqClient();
    if (!client) {
        res.send(errorResponse("The AI assistant isn't set up on the server yet.", "503"));
        return;
    }
    try {
        const history = (0, assistant_1.sanitizeHistory)((_a = req.body) === null || _a === void 0 ? void 0 : _a.messages);
        const clientNow = (_b = req.body) === null || _b === void 0 ? void 0 : _b.clientNow;
        const timeZone = (_c = req.body) === null || _c === void 0 ? void 0 : _c.timeZone;
        const result = yield (0, assistant_1.runAssistant)({
            client,
            model: process.env.GROQ_MODEL || DEFAULT_MODEL,
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
        }
        else if (error instanceof groq_sdk_1.default.RateLimitError) {
            const retryAfter = Number((_d = error.headers) === null || _d === void 0 ? void 0 : _d.get("retry-after")) || undefined;
            res.send(errorResponse("The AI assistant is busy right now. Please try again in a moment.", "429", { retryAfter }));
        }
        else if (error instanceof groq_sdk_1.default.APIError) {
            console.error("Groq API error", error.status, error.message);
            res.send(errorResponse("The AI assistant couldn't respond. Please try again.", "502"));
        }
        else {
            console.error("Error in assistant chat", error);
            res.send(errorResponse("Something went wrong. Please try again.", "500"));
        }
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