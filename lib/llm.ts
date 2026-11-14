import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import type { z } from "zod";
import type { ChatCompletionContentPart } from "openai/resources/chat/completions";

/**
 * The one place the app talks to a language model. The model only reads and matches;
 * every number shown to the user is computed elsewhere, in code.
 * OPENAI_BASE_URL lets any OpenAI-compatible server stand in (see docs/DECISIONS.md).
 */
export const MODEL = process.env.LLM_MODEL || "gpt-5.5";

let client: OpenAI | null = null;
const getClient = () =>
  (client ??= new OpenAI({ baseURL: process.env.OPENAI_BASE_URL || undefined, timeout: 60_000, maxRetries: 1 }));

export class LlmError extends Error {}

export type Content = string | ChatCompletionContentPart[];

export async function callJSON<T extends z.ZodType>(
  system: string, content: Content, schema: T, name: string, opts: { effort?: "minimal" | "low" | "medium" } = {},
): Promise<z.infer<T>> {
  const res = await getClient().chat.completions.parse({
    model: MODEL,
    messages: [
      { role: "system", content: system },
      { role: "user", content },
    ],
    response_format: zodResponseFormat(schema, name),
    ...(opts.effort ? { reasoning_effort: opts.effort } : {}),
  });
  const msg = res.choices[0]?.message;
  if (!msg || msg.refusal || !msg.parsed) throw new LlmError(msg?.refusal ? "llm_refusal" : "llm_no_output");
  return msg.parsed as z.infer<T>;
}

export const imagePart = (base64: string, mime = "image/jpeg"): ChatCompletionContentPart => ({
  type: "image_url",
  image_url: { url: `data:${mime};base64,${base64}`, detail: "high" },
});
