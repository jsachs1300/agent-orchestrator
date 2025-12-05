import { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { callGemini } from "./gemini-client";
import { callOpenAi } from "./openai-client";

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
  if (provider === "gemini") {
    return callGemini(messages);
  }

  return callOpenAi(messages);
}
