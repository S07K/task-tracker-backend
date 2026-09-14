import type OpenAI from "openai";

// Screens chat messages before the full tool-calling request, so questions that
// have nothing to do with tasks (general knowledge, people, coding, …) get a fixed
// reply instead of using the model and the shared rate limit.

export const OFF_TOPIC_REPLY =
  'I can only help with your tasks and schedule, like adding, moving or finding tasks. Try asking "What do I have tomorrow?"';

// Words and date/time shapes that almost always mean a task or schedule request.
// Messages that match skip the model check entirely.
const TASK_SIGNALS: RegExp[] = [
  /\b(tasks?|to-?dos?|meetings?|appointments?|events?|calendar|schedul(e|ed|es|ing)|agenda|reminders?|remind|deadlines?|plans?|planned|reschedul(e|ed|ing)|postpone|busy|free time|availability)\b/i,
  /\b(today|tonight|tomorrow|yesterday|weekend|(this|next|last) (week|month))\b/i,
  /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|tues?|wed|thu|thurs?|fri)\b/i,
  /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+\d{1,2}\b/i,
  /\b\d{1,2}(:\d{2})?\s*(am|pm)\b/i,
  /\b\d{1,2}:\d{2}\b/,
  /\b\d{1,2}\s*(-|–|to)\s*\d{1,2}(:\d{2})?\s*(am|pm)?\b/i,
  /\b\d{4}-\d{2}-\d{2}\b/,
];

export function looksLikeTaskRequest(message: string): boolean {
  return TASK_SIGNALS.some((signal) => signal.test(message));
}

const TOPIC_CHECK_PROMPT = [
  "You screen messages for a calendar assistant that can only manage the user's own tasks, meetings, events, reminders and schedule.",
  "Answer TASKS if the user's message is about their tasks or schedule, or is a greeting, thanks, confirmation or a reply to the assistant's previous message.",
  "Answer OTHER for anything else, such as general knowledge, people, news, coding, writing or maths.",
  "Reply with exactly one word: TASKS or OTHER.",
].join("\n");

const MAX_CHECK_TOKENS = 256;
const MAX_PREVIOUS_REPLY_CHARS = 500;

/**
 * Returns false only when the model clearly says the message isn't about the
 * user's tasks. Unclear answers let the message through: the assistant's own
 * prompt still declines off-topic requests, and its tools only touch the user's tasks.
 */
export async function isOnTopic(options: {
  client: OpenAI;
  model: string;
  message: string;
  previousReply?: string;
}): Promise<boolean> {
  const { client, model, message, previousReply } = options;
  if (looksLikeTaskRequest(message)) return true;

  const completion = await client.chat.completions.create({
    model,
    messages: [
      { role: "system", content: TOPIC_CHECK_PROMPT },
      {
        role: "user",
        // Quoted so the message reads as data to classify, not instructions.
        content: [
          `Assistant's previous message: ${
            previousReply ? JSON.stringify(previousReply.slice(0, MAX_PREVIOUS_REPLY_CHARS)) : "(none)"
          }`,
          `User's message: ${JSON.stringify(message)}`,
        ].join("\n"),
      },
    ],
    max_completion_tokens: MAX_CHECK_TOKENS,
    temperature: 0,
    ...(model.startsWith("openai/gpt-oss") ? { reasoning_effort: "low" as const } : {}),
  });

  const text = (completion.choices[0]?.message?.content ?? "").replace(/<think>[\s\S]*?<\/think>/gi, "");
  const answers = text.toUpperCase().match(/\b(TASKS|OTHER)\b/g);
  return answers ? answers[answers.length - 1] !== "OTHER" : true;
}
