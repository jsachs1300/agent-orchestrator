import { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { callGemini } from "./gemini-client";
import { callOpenAi } from "./openai-client";
import { getLangCache } from "./langcache";

type Provider = "openai" | "gemini";

function getProvider(): Provider {
  const configured = (process.env.LLM_PROVIDER || "openai").toLowerCase();
  if (["gemini", "vertex", "vertexai"].includes(configured)) {
    return "gemini";
  }
  return "openai";
}

export async function callLlm(
  messages: ChatCompletionMessageParam[]
): Promise<string> {
  const provider = getProvider();
  const cache = await getLangCache();
  const serializedPrompt = JSON.stringify({ provider, messages });

  const cached = cache ? await cache.get(serializedPrompt) : null;
  if (cached) {
    return cached;
  }

  if (provider === "gemini") {
    const result = await callGemini(messages);
    if (cache) {
      await cache.set(serializedPrompt, result);
    }
    return result;
  }

  const result = await callOpenAi(messages);
  if (cache) {
    await cache.set(serializedPrompt, result);
  }
  return result;
}
