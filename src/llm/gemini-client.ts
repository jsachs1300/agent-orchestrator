import { VertexAI } from "@google-cloud/vertexai";
import { ChatCompletionMessageParam } from "openai/resources/chat/completions";

type GeminiContent = { role: string; parts: Array<{ text: string }> };

function mapMessages(
  messages: ChatCompletionMessageParam[]
): {
  contents: GeminiContent[];
  systemInstruction?: GeminiContent;
} {
  const contents: GeminiContent[] = [];
  let systemInstruction: GeminiContent | undefined;

  for (const msg of messages) {
    if (!msg || typeof msg.content === "undefined") continue;

    const text =
      typeof msg.content === "string"
        ? msg.content
        : Array.isArray(msg.content)
          ? msg.content.map((c: any) => c?.text ?? "").join("\n")
          : JSON.stringify(msg.content);

    if (msg.role === "system") {
      systemInstruction = { role: "system", parts: [{ text }] };
      continue;
    }

    const role = msg.role === "assistant" ? "model" : "user";
    contents.push({ role, parts: [{ text }] });
  }

  return { contents, systemInstruction };
}

export async function callGemini(
  messages: ChatCompletionMessageParam[]
): Promise<string> {
  const project = process.env.VERTEX_PROJECT || process.env.GOOGLE_CLOUD_PROJECT;
  if (!project) {
    throw new Error(
      "Gemini requires VERTEX_PROJECT or GOOGLE_CLOUD_PROJECT to be set"
    );
  }

  const location = process.env.VERTEX_LOCATION || "us-central1";
  const modelName = process.env.VERTEX_MODEL || "gemini-1.5-pro-002";

  const vertex = new VertexAI({ project, location });
  const model = vertex.getGenerativeModel({ model: modelName });

  const { contents, systemInstruction } = mapMessages(messages);

  const result = await model.generateContent({
    contents,
    systemInstruction,
    generationConfig: { responseMimeType: "application/json" }
  });

  const text = result.response.candidates
    ?.flatMap(candidate => candidate.content?.parts || [])
    .map(part => part.text || "")
    .join("\n")
    .trim();

  if (!text) {
    throw new Error("Gemini returned no content");
  }

  return text;
}
