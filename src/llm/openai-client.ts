import OpenAI from "openai";
import { ChatCompletionMessageParam } from "openai/resources/chat/completions";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export async function callLlm(
  messages: ChatCompletionMessageParam[]
): Promise<string> {
  const completion = await client.chat.completions.create({
    model: "gpt-4.1", // tweak as needed
    messages,
    response_format: { type: "json_object" }
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) {
    throw new Error("LLM returned no content");
  }

  return content;
}
