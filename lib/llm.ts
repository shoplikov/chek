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
/**
 * Per-task models. Reading the photo uses the stronger model; picking one of 15 candidates is an
 * easier text task, so it uses a cheaper one (same precision on the evals, about half the cost
 * per scan; see docs/DECISIONS.md). LLM_MODEL, when set, applies to both unless overridden.
 */
export const PARSE_MODEL = process.env.LLM_PARSE_MODEL || process.env.LLM_MODEL || "gpt-5.5";
export const MATCH_MODEL = process.env.LLM_MATCH_MODEL || process.env.LLM_MODEL || "gpt-5.4-mini";

let client: OpenAI | null = null;
const getClient = () =>
  (client ??= new OpenAI({ baseURL: process.env.OPENAI_BASE_URL || undefined, timeout: 60_000, maxRetries: 1 }));

export class LlmError extends Error {}

/** Running token totals for this process (read by the eval scripts to estimate cost). */
export const usage = { calls: 0, input: 0, cachedInput: 0, output: 0 };

export type Content = string | ChatCompletionContentPart[];

export async function callJSON<T extends z.ZodType>(
  system: string, content: Content, schema: T, name: string, opts: { effort?: "minimal" | "low" | "medium"; model?: string } = {},
): Promise<z.infer<T>> {
  const res = await getClient().chat.completions.parse({
    model: opts.model ?? MODEL,
    messages: [
      { role: "system", content: system },
      { role: "user", content },
    ],
    response_format: zodResponseFormat(schema, name),
    ...(opts.effort ? { reasoning_effort: opts.effort } : {}),
  });
  usage.calls++;
  usage.input += res.usage?.prompt_tokens ?? 0;
  usage.cachedInput += res.usage?.prompt_tokens_details?.cached_tokens ?? 0;
  usage.output += res.usage?.completion_tokens ?? 0;
  const msg = res.choices[0]?.message;
  if (!msg || msg.refusal || !msg.parsed) throw new LlmError(msg?.refusal ? "llm_refusal" : "llm_no_output");
  return msg.parsed as z.infer<T>;
}

export const imagePart = (base64: string, mime = "image/jpeg"): ChatCompletionContentPart => ({
  type: "image_url",
  image_url: { url: `data:${mime};base64,${base64}`, detail: "high" },
});
