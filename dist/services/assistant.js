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
Object.defineProperty(exports, "__esModule", { value: true });
exports.MAX_MESSAGE_CHARS = exports.MAX_HISTORY_MESSAGES = void 0;
exports.sanitizeHistory = sanitizeHistory;
exports.runAssistant = runAssistant;
const tasks_1 = require("./tasks");
// Limits keep each chat request small: Groq's free tier allows ~8K tokens/minute
// per organization, shared by every user of the app.
exports.MAX_HISTORY_MESSAGES = 12;
exports.MAX_MESSAGE_CHARS = 2000;
const MAX_TOOL_ROUNDS = 5;
const MAX_COMPLETION_TOKENS = 1024;
const TOOLS = [
    {
        type: "function",
        function: {
            name: "list_tasks",
            description: "List the user's tasks, optionally only those overlapping a date range and/or whose title contains some text. Use it to answer schedule questions and to find task ids.",
            parameters: {
                type: "object",
                properties: {
                    from: { type: "string", description: "First date to include, YYYY-MM-DD" },
                    to: { type: "string", description: "Last date to include, YYYY-MM-DD" },
                    query: { type: "string", description: "Case-insensitive text to match in task titles" },
                },
                additionalProperties: false,
            },
        },
    },
    {
        type: "function",
        function: {
            name: "create_task",
            description: "Create a new task on the user's calendar.",
            parameters: {
                type: "object",
                properties: {
                    title: { type: "string" },
                    allDay: { type: "boolean", description: "true for an all-day task" },
                    start: { type: "string", description: "Timed task: YYYY-MM-DDTHH:mm (24-hour). All-day task: YYYY-MM-DD" },
                    end: {
                        type: "string",
                        description: "Optional, same format as start. Timed tasks default to 30 minutes. For all-day tasks this is the last day (inclusive).",
                    },
                    color: {
                        type: "string",
                        description: "Optional: black, blue, purple, pink, red, orange, yellow, green, cyan, or #RRGGBB",
                    },
                },
                required: ["title", "start"],
                additionalProperties: false,
            },
        },
    },
    {
        type: "function",
        function: {
            name: "update_task",
            description: "Change an existing task. Include only the fields to change. Changing only start keeps the task's duration.",
            parameters: {
                type: "object",
                properties: {
                    id: { type: "string", description: "Task id from list_tasks" },
                    title: { type: "string" },
                    allDay: { type: "boolean" },
                    start: { type: "string", description: "Timed: YYYY-MM-DDTHH:mm. All-day: YYYY-MM-DD" },
                    end: { type: "string", description: "Timed: YYYY-MM-DDTHH:mm. All-day: last day YYYY-MM-DD" },
                    color: { type: "string" },
                },
                required: ["id"],
                additionalProperties: false,
            },
        },
    },
    {
        type: "function",
        function: {
            name: "delete_tasks",
            description: "Ask to delete one or more tasks. Nothing is deleted yet: the user must press Confirm in the app.",
            parameters: {
                type: "object",
                properties: {
                    ids: { type: "array", items: { type: "string" }, description: "Task ids from list_tasks" },
                },
                required: ["ids"],
                additionalProperties: false,
            },
        },
    },
];
function buildSystemPrompt(now, timeZone) {
    return [
        "You are the Task Tracker assistant. You help the signed-in user manage the tasks on their calendar using the provided tools.",
        "",
        "Rules:",
        "- Use tools to read or change tasks. Never invent task ids: call list_tasks to find them.",
        "- Timed tasks use YYYY-MM-DDTHH:mm (24-hour); all-day tasks use YYYY-MM-DD. If no duration is given, timed tasks last 30 minutes.",
        "- delete_tasks does not delete anything. After calling it, tell the user to press Confirm to delete.",
        "- If a request is ambiguous (for example several tasks match), ask a short question instead of guessing.",
        "- If a tool returns an error, fix the arguments and retry, or explain the problem to the user.",
        "- Only help with the user's tasks and schedule. Politely decline anything else.",
        "- Keep replies short and friendly. Write times like 3:30pm and dates like Mon, Sep 14. Never show task ids.",
        "",
        `Current local date and time: ${now} (${(0, tasks_1.dayOfWeek)(now)}), time zone ${timeZone}. Resolve relative dates such as "tomorrow" or "next Friday" from this.`,
    ].join("\n");
}
/** Keeps only well-formed user/assistant turns from the client, trimmed to the history limits. */
function sanitizeHistory(raw) {
    if (!Array.isArray(raw))
        throw new tasks_1.TaskInputError("messages must be a list");
    const turns = raw
        .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim() !== "")
        .map((m) => ({ role: m.role, content: m.content.trim().slice(0, exports.MAX_MESSAGE_CHARS) }))
        .slice(-exports.MAX_HISTORY_MESSAGES);
    if (turns.length === 0 || turns[turns.length - 1].role !== "user") {
        throw new tasks_1.TaskInputError("The last message must be a non-empty user message");
    }
    return turns;
}
function runTool(call, state) {
    return __awaiter(this, void 0, void 0, function* () {
        let args;
        try {
            args = call.function.arguments ? JSON.parse(call.function.arguments) : {};
        }
        catch (_a) {
            return { error: "Arguments were not valid JSON" };
        }
        if (!args || typeof args !== "object" || Array.isArray(args)) {
            return { error: "Arguments must be a JSON object" };
        }
        const input = args;
        try {
            switch (call.function.name) {
                case "list_tasks":
                    return yield (0, tasks_1.listTasks)(state.userId, input);
                case "create_task": {
                    const task = yield (0, tasks_1.createTask)(state.userId, input);
                    state.actions.push({ type: "created", task });
                    return { created: task };
                }
                case "update_task": {
                    const task = yield (0, tasks_1.updateTask)(state.userId, input);
                    state.actions.push({ type: "updated", task });
                    return { updated: task };
                }
                case "delete_tasks": {
                    const { tasks, notFound } = yield (0, tasks_1.findTasksForDeletion)(state.userId, input.ids);
                    if (tasks.length === 0)
                        return { error: "None of those tasks exist", notFound };
                    tasks.forEach((task) => state.pendingDeletes.set(task.id, task));
                    return { status: "awaiting_user_confirmation", tasks, notFound };
                }
                default:
                    return { error: `Unknown tool: ${call.function.name}` };
            }
        }
        catch (error) {
            if (error instanceof tasks_1.TaskInputError)
                return { error: error.message };
            throw error;
        }
    });
}
function runAssistant(options) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c, _d;
        const { client, model, userId, history, now, timeZone } = options;
        const state = { userId, actions: [], pendingDeletes: new Map() };
        const messages = [
            { role: "system", content: buildSystemPrompt(now, timeZone) },
            ...history,
        ];
        const result = (reply) => ({
            reply,
            actions: state.actions,
            pendingAction: state.pendingDeletes.size ? { type: "delete", tasks: Array.from(state.pendingDeletes.values()) } : null,
            changed: state.actions.length > 0,
        });
        for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
            const completion = yield client.chat.completions.create(Object.assign({ model,
                messages, tools: TOOLS, tool_choice: "auto", max_completion_tokens: MAX_COMPLETION_TOKENS }, (model.startsWith("openai/gpt-oss") ? { reasoning_effort: "low" } : {})));
            const message = (_a = completion.choices[0]) === null || _a === void 0 ? void 0 : _a.message;
            const toolCalls = (_b = message === null || message === void 0 ? void 0 : message.tool_calls) !== null && _b !== void 0 ? _b : [];
            if (toolCalls.length === 0) {
                const reply = (_c = message === null || message === void 0 ? void 0 : message.content) === null || _c === void 0 ? void 0 : _c.trim();
                return result(reply || "Sorry, I couldn't come up with a reply. Could you try rephrasing?");
            }
            messages.push({ role: "assistant", content: (_d = message === null || message === void 0 ? void 0 : message.content) !== null && _d !== void 0 ? _d : null, tool_calls: toolCalls });
            // Run calls in order so a create followed by an update behaves predictably.
            for (const call of toolCalls) {
                const output = yield runTool(call, state);
                messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(output) });
            }
        }
        return result("Sorry, that took too many steps. Could you break it into smaller requests?");
    });
}
//# sourceMappingURL=assistant.js.map