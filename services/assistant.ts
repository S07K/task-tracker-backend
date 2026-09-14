import type Groq from "groq-sdk";
import type {
  ChatCompletionMessageParam,
  ChatCompletionMessageToolCall,
  ChatCompletionTool,
} from "groq-sdk/resources/chat/completions";
import {
  TaskInputError,
  TaskView,
  createTask,
  dayOfWeek,
  findTasksForDeletion,
  listTasks,
  updateTask,
} from "./tasks";

// Limits keep each chat request small: Groq's free tier allows ~8K tokens/minute
// per organization, shared by every user of the app.
export const MAX_HISTORY_MESSAGES = 12;
export const MAX_MESSAGE_CHARS = 2000;
const MAX_TOOL_ROUNDS = 5;
const MAX_COMPLETION_TOKENS = 1024;

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface AssistantAction {
  type: "created" | "updated";
  task: TaskView;
}

export interface AssistantResult {
  reply: string;
  actions: AssistantAction[];
  /** Tasks the model asked to delete; nothing is deleted until the user confirms. */
  pendingAction: { type: "delete"; tasks: TaskView[] } | null;
  changed: boolean;
}

const TOOLS: ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "list_tasks",
      description:
        "List the user's tasks, optionally only those overlapping a date range and/or whose title contains some text. Use it to answer schedule questions and to find task ids.",
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
            description:
              "Optional, same format as start. Timed tasks default to 30 minutes. For all-day tasks this is the last day (inclusive).",
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
      description:
        "Change an existing task. Include only the fields to change. Changing only start keeps the task's duration.",
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
      description:
        "Ask to delete one or more tasks. Nothing is deleted yet: the user must press Confirm in the app.",
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

function buildSystemPrompt(now: string, timeZone: string): string {
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
    `Current local date and time: ${now} (${dayOfWeek(now)}), time zone ${timeZone}. Resolve relative dates such as "tomorrow" or "next Friday" from this.`,
  ].join("\n");
}

/** Keeps only well-formed user/assistant turns from the client, trimmed to the history limits. */
export function sanitizeHistory(raw: unknown): ChatTurn[] {
  if (!Array.isArray(raw)) throw new TaskInputError("messages must be a list");
  const turns = raw
    .filter(
      (m): m is ChatTurn =>
        m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim() !== ""
    )
    .map((m) => ({ role: m.role, content: m.content.trim().slice(0, MAX_MESSAGE_CHARS) }))
    .slice(-MAX_HISTORY_MESSAGES);
  if (turns.length === 0 || turns[turns.length - 1].role !== "user") {
    throw new TaskInputError("The last message must be a non-empty user message");
  }
  return turns;
}

interface ToolState {
  userId: string;
  actions: AssistantAction[];
  pendingDeletes: Map<string, TaskView>;
}

async function runTool(call: ChatCompletionMessageToolCall, state: ToolState): Promise<unknown> {
  let args: unknown;
  try {
    args = call.function.arguments ? JSON.parse(call.function.arguments) : {};
  } catch {
    return { error: "Arguments were not valid JSON" };
  }
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    return { error: "Arguments must be a JSON object" };
  }
  const input = args as Record<string, unknown>;

  try {
    switch (call.function.name) {
      case "list_tasks":
        return await listTasks(state.userId, input);
      case "create_task": {
        const task = await createTask(state.userId, input);
        state.actions.push({ type: "created", task });
        return { created: task };
      }
      case "update_task": {
        const task = await updateTask(state.userId, input);
        state.actions.push({ type: "updated", task });
        return { updated: task };
      }
      case "delete_tasks": {
        const { tasks, notFound } = await findTasksForDeletion(state.userId, input.ids);
        if (tasks.length === 0) return { error: "None of those tasks exist", notFound };
        tasks.forEach((task) => state.pendingDeletes.set(task.id, task));
        return { status: "awaiting_user_confirmation", tasks, notFound };
      }
      default:
        return { error: `Unknown tool: ${call.function.name}` };
    }
  } catch (error) {
    if (error instanceof TaskInputError) return { error: error.message };
    throw error;
  }
}

export async function runAssistant(options: {
  client: Groq;
  model: string;
  userId: string;
  history: ChatTurn[];
  now: string;
  timeZone: string;
}): Promise<AssistantResult> {
  const { client, model, userId, history, now, timeZone } = options;
  const state: ToolState = { userId, actions: [], pendingDeletes: new Map() };
  const messages: ChatCompletionMessageParam[] = [
    { role: "system", content: buildSystemPrompt(now, timeZone) },
    ...history,
  ];

  const result = (reply: string): AssistantResult => ({
    reply,
    actions: state.actions,
    pendingAction: state.pendingDeletes.size ? { type: "delete", tasks: Array.from(state.pendingDeletes.values()) } : null,
    changed: state.actions.length > 0,
  });

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const completion = await client.chat.completions.create({
      model,
      messages,
      tools: TOOLS,
      tool_choice: "auto",
      max_completion_tokens: MAX_COMPLETION_TOKENS,
      // gpt-oss models reason before answering; low effort keeps token use down.
      ...(model.startsWith("openai/gpt-oss") ? { reasoning_effort: "low" as const } : {}),
    });

    const message = completion.choices[0]?.message;
    const toolCalls = message?.tool_calls ?? [];

    if (toolCalls.length === 0) {
      const reply = message?.content?.trim();
      return result(reply || "Sorry, I couldn't come up with a reply. Could you try rephrasing?");
    }

    messages.push({ role: "assistant", content: message?.content ?? null, tool_calls: toolCalls });
    // Run calls in order so a create followed by an update behaves predictably.
    for (const call of toolCalls) {
      const output = await runTool(call, state);
      messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(output) });
    }
  }

  return result("Sorry, that took too many steps. Could you break it into smaller requests?");
}
